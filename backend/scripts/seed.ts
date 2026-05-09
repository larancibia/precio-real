/**
 * precio-real — seed script
 *
 * Approach: emit a SQL file (`scripts/seed.sql`) that can be applied with
 *   `wrangler d1 execute precio-real --file=scripts/seed.sql`
 *   `wrangler d1 execute precio-real --local --file=scripts/seed.sql`
 *
 * Why a SQL file (not direct DB writes from this script)?
 *   - Works against both local and remote D1 with the same artifact.
 *   - No Cloudflare auth/binding needed at seed-time; we just hit the public
 *     MercadoLibre API and emit deterministic INSERTs.
 *   - The user controls when/where it gets applied (`npm run db:seed:apply`).
 *
 * Run:
 *   npx tsx scripts/seed.ts            # writes scripts/seed.sql
 *   npm run db:seed:apply              # applies it to remote D1
 *   npm run db:seed:apply:local        # applies it to local D1
 *
 * Source: public MercadoLibre Argentina items API (no auth required).
 *   GET https://api.mercadolibre.com/sites/MLA/search?q=<query>&limit=10
 *
 * History generation:
 *   For each product, we generate 30 daily price points (daysAgo 0..29) using
 *   one of three patterns rotated by index (idx % 3):
 *     bucket 0 — stable      : flat around currentPrice (±2% noise)
 *     bucket 1 — real discount: was ~25% higher >7d ago, dropped to currentPrice
 *     bucket 2 — inflated     : "fake discount" — baseline -> spike -> drop
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DISCOVERY_QUERIES } from "../src/lib/discovery-queries";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface MLSearchItem {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  permalink: string;
  thumbnail: string;
  seller?: { nickname?: string };
}

interface MLSearchResponse {
  results: MLSearchItem[];
}

// QUERIES is imported from src/lib/discovery-queries (single source of truth
// shared with the production cron). The seed uses LIMIT_PER_QUERY=10 (vs the
// cron's 20) to keep the local SQL file under D1's wrangler-execute timeouts
// while still exercising the same Hot-Sale-flagship vertical mix.
const QUERIES = DISCOVERY_QUERIES;
const LIMIT_PER_QUERY = 10;
const HISTORY_DAYS = 30;
// Mirror discovery.ts: parallel waves keep total wall time bounded even if a
// few queries are slow, without saturating ML's public search.
const FETCH_CONCURRENCY = 5;
// Per-fetch timeout. ML API search is usually well under a second; 10s is a
// generous ceiling that catches network hangs without giving up too eagerly
// during transient slowness.
const FETCH_TIMEOUT_MS = 10_000;
// Retry transient failures (5xx, 429, network/timeout). Two retries with a
// short linear backoff is enough for the occasional flake without dragging
// the whole seed when ML is genuinely down.
const FETCH_MAX_RETRIES = 2;
const FETCH_RETRY_DELAY_MS = 750;

function sqlEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Returns 30 entries with daysAgo from 0..29.
 * Pattern depends on `bucket`:
 *   0 stable   — flat around currentPrice ±2%
 *   1 real     — baseline ~25% above currentPrice for daysAgo>=7, lerp down to
 *                currentPrice for daysAgo<7
 *   2 inflated — baseline = currentPrice*0.95 for daysAgo>14, lerp up to
 *                currentPrice*1.30 for 7<daysAgo<=14, hold the peak for
 *                3<daysAgo<=7, drop down to currentPrice for daysAgo<=3
 * All prices have ±2% noise via Math.random().
 */
function generateHistory(
  currentPrice: number,
  bucket: 0 | 1 | 2,
): { price: number; daysAgo: number }[] {
  const out: { price: number; daysAgo: number }[] = [];
  const noise = () => 1 + (Math.random() * 0.04 - 0.02); // [-2%, +2%]

  for (let daysAgo = 0; daysAgo < HISTORY_DAYS; daysAgo++) {
    let p: number;
    if (bucket === 0) {
      // stable
      p = currentPrice * noise();
    } else if (bucket === 1) {
      // real discount
      const baseline = currentPrice / 0.8; // ~25% above
      if (daysAgo >= 7) {
        p = baseline * noise();
      } else {
        // lerp from currentPrice (at daysAgo=0) to baseline (at daysAgo=7)
        const t = (7 - daysAgo) / 7; // 1 at daysAgo=0, 0 at daysAgo=7
        const v = currentPrice + (baseline - currentPrice) * (1 - t);
        p = v * noise();
      }
    } else {
      // inflated / fake discount
      const trueBaseline = currentPrice * 0.95;
      const peak = currentPrice * 1.3;
      if (daysAgo > 14) {
        p = trueBaseline * noise();
      } else if (daysAgo > 7) {
        // lerp upward from trueBaseline (at daysAgo=14) to peak (at daysAgo=8)
        // t=0 at daysAgo=14, t=1 at daysAgo=8
        const t = (14 - daysAgo) / (14 - 8);
        const v = trueBaseline + (peak - trueBaseline) * t;
        p = v * noise();
      } else if (daysAgo > 3) {
        // hold the peak
        p = peak * noise();
      } else {
        // drop from peak (at daysAgo=3) to currentPrice (at daysAgo=0)
        const t = (3 - daysAgo) / 3; // 1 at daysAgo=0, 0 at daysAgo=3
        const v = peak + (currentPrice - peak) * t;
        p = v * noise();
      }
    }
    out.push({ price: round2(p), daysAgo });
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchQueryOnce(query: string): Promise<MLSearchItem[]> {
  const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=${LIMIT_PER_QUERY}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "precio-real-seed/0.1 (+https://precioreal.ar)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const transient = res.status === 429 || res.status >= 500;
      const err = new Error(`ML API ${res.status} for query=${query}`);
      (err as Error & { transient?: boolean }).transient = transient;
      throw err;
    }
    const body = (await res.json()) as MLSearchResponse;
    return body.results ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchQuery(query: string): Promise<MLSearchItem[]> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= FETCH_MAX_RETRIES; attempt++) {
    try {
      return await fetchQueryOnce(query);
    } catch (err) {
      lastErr = err;
      // Retry on AbortError (timeout), network errors, and transient HTTP.
      const isAbort =
        err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
      const isTransientHttp =
        err instanceof Error && (err as Error & { transient?: boolean }).transient === true;
      const isNetwork =
        err instanceof Error &&
        !isTransientHttp &&
        !(err as Error & { transient?: boolean }).transient &&
        !err.message.startsWith("ML API ");
      const retriable = isAbort || isTransientHttp || isNetwork;
      if (!retriable || attempt === FETCH_MAX_RETRIES) break;
      await sleep(FETCH_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function main(): Promise<void> {
  const lines: string[] = [];
  lines.push("-- precio-real seed (auto-generated by scripts/seed.ts)");
  lines.push(
    `-- Generated by scripts/seed.ts at ${new Date().toISOString()}. ` +
      `Up to ${QUERIES.length * LIMIT_PER_QUERY} products x ${HISTORY_DAYS} history points x 3 patterns (stable/real/inflated rotated by index).`,
  );
  lines.push("-- Source: api.mercadolibre.com/sites/MLA/search");
  lines.push(
    "-- NOTE: this seed file fully resets the prices and products tables before re-inserting.",
  );
  lines.push("-- It is intended for LOCAL DEV use only. Do NOT apply to a populated remote DB.");
  lines.push("");
  lines.push("BEGIN TRANSACTION;");
  lines.push("");
  lines.push("-- Idempotent reset (LOCAL DEV ONLY)");
  lines.push("DELETE FROM prices;");
  lines.push("DELETE FROM products;");
  lines.push("");

  const seenUrls = new Set<string>();
  let productsInserted = 0;
  let pricesInserted = 0;
  let idx = 0;
  let queriesFailed = 0;

  // Fetch in concurrent waves so total wall time scales with QUERIES.length /
  // FETCH_CONCURRENCY instead of being strictly sequential. We still emit SQL
  // in original query order so the bucket rotation (idx % 3) remains stable
  // and the output diff stays human-readable across runs.
  const fetched: { query: string; items: MLSearchItem[] | null; error?: string }[] = [];

  for (let i = 0; i < QUERIES.length; i += FETCH_CONCURRENCY) {
    const wave = QUERIES.slice(i, i + FETCH_CONCURRENCY);
    process.stderr.write(`[seed] fetching wave ${i / FETCH_CONCURRENCY + 1}: ${wave.join(", ")}\n`);
    const settled = await Promise.allSettled(wave.map((q) => fetchQuery(q)));
    settled.forEach((outcome, j) => {
      const query = wave[j];
      if (outcome.status === "fulfilled") {
        fetched.push({ query, items: outcome.value });
      } else {
        const message =
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
        fetched.push({ query, items: null, error: message });
      }
    });
  }

  for (const { query, items, error } of fetched) {
    if (items === null) {
      process.stderr.write(`[seed] "${query}" FAILED (${error})\n`);
      lines.push(`-- Query: ${query} (FAILED: ${error})`);
      lines.push("");
      queriesFailed++;
      continue;
    }
    process.stderr.write(`[seed] "${query}" got ${items.length}\n`);

    lines.push(`-- Query: ${query} (${items.length} items)`);

    for (const item of items) {
      if (!item.permalink || typeof item.price !== "number") continue;
      if (seenUrls.has(item.permalink)) continue;
      seenUrls.add(item.permalink);

      const seller = item.seller?.nickname ?? null;
      const bucket = (idx % 3) as 0 | 1 | 2;
      const bucketLabel = bucket === 0 ? "stable" : bucket === 1 ? "real" : "inflated";
      const currency = item.currency_id || "ARS";

      lines.push(
        `-- product idx=${idx} bucket=${bucket} (${bucketLabel}) currentPrice=${item.price}`,
      );
      lines.push(
        `INSERT OR IGNORE INTO products (url, title, seller, image_url) VALUES (` +
          [
            sqlEscape(item.permalink),
            sqlEscape(item.title),
            sqlEscape(seller),
            sqlEscape(item.thumbnail),
          ].join(", ") +
          `);`,
      );
      productsInserted++;

      const history = generateHistory(item.price, bucket);
      const urlSql = sqlEscape(item.permalink);
      const currencySql = sqlEscape(currency);
      for (const point of history) {
        lines.push(
          `INSERT INTO prices (product_id, price, currency, scraped_at) ` +
            `SELECT id, ${point.price.toFixed(2)}, ${currencySql}, ` +
            `strftime('%s','now') - ${point.daysAgo}*86400 ` +
            `FROM products WHERE url = ${urlSql};`,
        );
        pricesInserted++;
      }

      idx++;
    }
    lines.push("");
  }

  lines.push("COMMIT;");
  lines.push("");

  const outPath = resolve(__dirname, "seed.sql");
  writeFileSync(outPath, lines.join("\n"), "utf8");

  process.stderr.write(
    `[seed] wrote ${outPath}\n` +
      `[seed] queries: ${QUERIES.length} (failed: ${queriesFailed}), ` +
      `products: ${productsInserted}, price rows: ${pricesInserted}\n`,
  );
  process.stderr.write(`[seed] apply with: npm run db:seed:apply (remote) or db:seed:apply:local\n`);
}

main().catch((err) => {
  console.error("[seed] fatal:", err);
  process.exit(1);
});
