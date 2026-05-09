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

import { DISCOVERY_QUERIES } from "../lib/discovery-queries";

const ML_USER_AGENT = "precio-real/0.1 (+https://precioreal.ar)";
const ML_TIMEOUT_MS = 10_000;

// DISCOVERY_QUERIES is the shared list (see src/lib/discovery-queries.ts).
// Each query asks ML for LIMIT_PER_QUERY top results; INSERT OR IGNORE means
// duplicates across queries don't count as new rows.
const LIMIT_PER_QUERY = 20;
const DISCOVERY_CONCURRENCY = 5;

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
 *
 * Implementation:
 *   - Search fetches run in concurrent waves of DISCOVERY_CONCURRENCY to keep
 *     the cron well under Cloudflare's subrequest budget while still hitting
 *     the full query list quickly (sequential was 25-45s+ wall time at peak).
 *   - INSERT OR IGNOREs are funneled sequentially per item to keep D1 writes
 *     deterministic and avoid contention with the cron's price-row writes
 *     that share the same transaction-ish window.
 */
export async function runDiscovery(env: DiscoveryEnv): Promise<DiscoveryResult> {
  const allItems: MLSearchItem[] = [];

  for (let i = 0; i < DISCOVERY_QUERIES.length; i += DISCOVERY_CONCURRENCY) {
    const wave = DISCOVERY_QUERIES.slice(i, i + DISCOVERY_CONCURRENCY);
    const settled = await Promise.allSettled(wave.map((q) => fetchSearch(q)));
    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        allItems.push(...outcome.value);
      }
    }
  }

  const seen = new Set<string>();
  let candidates = 0;
  let inserted = 0;
  let failed = 0;

  for (const item of allItems) {
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
