/**
 * Scheduled cron handler — refreshes ML prices every 6h (issue #11).
 *
 * Steps:
 *   1. Discovery: ensure the top popular MLA products are present in `products`
 *      (INSERT OR IGNORE — no overwrites). See `discovery.ts`.
 *   2. Scrape: pick the most-recently-tracked products (ORDER BY id DESC) up to
 *      PRODUCT_LIMIT and insert a fresh `prices` row for each via the public
 *      ML items API. Does NOT update `products` (cron is a refresh, not upsert).
 *
 * The 500 cap reflects the issue's "top 500 Hot Sale" target. ML doesn't expose
 * an official Hot Sale list publicly, so we approximate by querying the popular
 * categories (see discovery.ts) — at 25 queries × 20 results = up to 500 unique
 * candidates per discovery run.
 */

import { extractMLAId } from "../lib/ml-url";
import { fetchMLItem } from "./ml-api";
import { runDiscovery } from "./discovery";

const PRODUCT_LIMIT = 500;
const BATCH_SIZE = 10;

interface ProductRow {
  id: number;
  url: string;
}

interface ScheduledEnv {
  DB: D1Database;
}

export interface ScheduledResult {
  scraped: number;
  failed: number;
  skipped: number;
  considered: number;
  discovery: { queries: number; candidates: number; inserted: number; failed: number };
}

async function fetchAndInsert(row: ProductRow, mlaId: string, env: ScheduledEnv): Promise<void> {
  const item = await fetchMLItem(mlaId);
  if (!item) {
    throw new Error(`fetch failed for ${mlaId}`);
  }
  if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price <= 0) {
    throw new Error(`invalid price for ${mlaId}`);
  }

  const currency = item.currency_id || "ARS";

  await env.DB
    .prepare(
      "INSERT INTO prices (product_id, price, currency, scraped_at) VALUES (?1, ?2, ?3, unixepoch())",
    )
    .bind(row.id, item.price, currency)
    .run();
}

export async function runScheduledScrape(env: ScheduledEnv): Promise<ScheduledResult> {
  const discovery = await runDiscovery(env).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron] discovery threw: ${message}`);
    return { queries: 0, candidates: 0, inserted: 0, failed: 0 };
  });

  // Newest-first so freshly discovered popular items get refreshed before older
  // long-tail products. Bounded by PRODUCT_LIMIT to keep the cron under CF
  // subrequest budgets (each fetchMLItem = 1 outbound fetch).
  const result = await env.DB
    .prepare("SELECT id, url FROM products ORDER BY id DESC LIMIT ?1")
    .bind(PRODUCT_LIMIT)
    .all<ProductRow>();

  const rows = result.results ?? [];
  if (rows.length === 0) {
    console.log("[cron] scraped=0 failed=0 skipped=0 (empty products table)");
    return { scraped: 0, failed: 0, skipped: 0, considered: 0, discovery };
  }

  let scraped = 0;
  let failed = 0;
  let skipped = 0;

  // Pre-filter rows that don't have a parseable MLA id.
  const work: { row: ProductRow; mlaId: string }[] = [];
  for (const row of rows) {
    const mlaId = extractMLAId(row.url);
    if (!mlaId) {
      skipped++;
      continue;
    }
    work.push({ row, mlaId });
  }

  for (let i = 0; i < work.length; i += BATCH_SIZE) {
    const batch = work.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(({ row, mlaId }) => fetchAndInsert(row, mlaId, env)),
    );
    for (const outcome of settled) {
      if (outcome.status === "fulfilled") {
        scraped++;
      } else {
        failed++;
      }
    }
  }

  console.log(
    `[cron] considered=${rows.length} scraped=${scraped} failed=${failed} skipped=${skipped}`,
  );
  return { scraped, failed, skipped, considered: rows.length, discovery };
}
