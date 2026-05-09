/**
 * Product discovery — populates the `products` table with popular MLA items.
 *
 * Why this exists:
 *   The cron (issue #11) needs to refresh "top 500 Hot Sale" products. ML doesn't
 *   expose a public Hot Sale endpoint, so we approximate "popular" by querying
 *   the public ML Argentina search across a curated set of high-traffic terms
 *   and capturing the top results from each. The result is bounded, deterministic
 *   per run, and uses no auth.
 *
 *   Discovery only INSERT OR IGNOREs into `products` — it never overwrites
 *   existing rows (their data is owned by the extension/wayback paths). The cron
 *   then refreshes prices for the union of all known products.
 *
 * Source: https://api.mercadolibre.com/sites/MLA/search?q=<term>&limit=<n>
 */

const ML_USER_AGENT = "precio-real/0.1 (+https://precioreal.ar)";
const ML_TIMEOUT_MS = 10_000;

// Curated list of high-traffic Argentine retail categories. Hitting 25 queries
// at limit 20 yields up to 500 candidates per discovery run. The terms span
// the Hot Sale flagship verticals: tech, electrodomésticos, hogar, deportes.
const DISCOVERY_QUERIES = [
  "celular",
  "notebook",
  "televisor",
  "auriculares",
  "heladera",
  "lavarropas",
  "aire acondicionado",
  "smart tv",
  "smartwatch",
  "tablet",
  "monitor",
  "playstation",
  "xbox",
  "consola",
  "perfume",
  "zapatillas",
  "bicicleta",
  "cafetera",
  "microondas",
  "freidora de aire",
  "aspiradora",
  "ventilador",
  "colchon",
  "anafe",
  "secarropas",
];
const LIMIT_PER_QUERY = 20;

interface MLSearchItem {
  id?: unknown;
  title?: unknown;
  price?: unknown;
  permalink?: unknown;
  thumbnail?: unknown;
  seller?: { nickname?: unknown };
}

interface MLSearchResponse {
  results?: MLSearchItem[];
}

interface DiscoveryEnv {
  DB: D1Database;
}

export interface DiscoveryResult {
  queries: number;
  candidates: number;
  inserted: number;
  failed: number;
}

async function fetchSearch(query: string): Promise<MLSearchItem[]> {
  const url =
    `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}` +
    `&limit=${LIMIT_PER_QUERY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ML_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[discovery] search ${query} → ${res.status}`);
      return [];
    }
    const body = (await res.json()) as MLSearchResponse;
    return body.results ?? [];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[discovery] search ${query} failed: ${message}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Discovers popular MLA products and INSERT-OR-IGNOREs them into `products`.
 * Idempotent: re-runs touch only newly seen URLs.
 */
export async function runDiscovery(env: DiscoveryEnv): Promise<DiscoveryResult> {
  const seen = new Set<string>();
  let candidates = 0;
  let inserted = 0;
  let failed = 0;

  for (const query of DISCOVERY_QUERIES) {
    const items = await fetchSearch(query);
    for (const item of items) {
      if (typeof item.permalink !== "string") continue;
      if (typeof item.title !== "string") continue;
      if (typeof item.price !== "number" || !Number.isFinite(item.price)) continue;
      if (seen.has(item.permalink)) continue;
      seen.add(item.permalink);
      candidates++;

      const seller =
        item.seller && typeof item.seller.nickname === "string"
          ? item.seller.nickname
          : null;
      const image = typeof item.thumbnail === "string" ? item.thumbnail : null;

      try {
        const result = await env.DB
          .prepare(
            "INSERT OR IGNORE INTO products (url, title, seller, image_url) VALUES (?1, ?2, ?3, ?4)",
          )
          .bind(item.permalink, item.title, seller, image)
          .run();
        // D1 returns meta.changes for affected rows.
        const changes = result?.meta?.changes ?? 0;
        if (changes > 0) inserted++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[discovery] insert failed for ${item.permalink}: ${message}`);
      }
    }
  }

  console.log(
    `[discovery] queries=${DISCOVERY_QUERIES.length} candidates=${candidates} inserted=${inserted} failed=${failed}`,
  );

  return {
    queries: DISCOVERY_QUERIES.length,
    candidates,
    inserted,
    failed,
  };
}
