/**
 * Scheduled cron handler — refreshes ML prices every 6h (issue #11).
 * Reads up to 100 products, fetches current price via ML API, inserts a new
 * `prices` row. Does NOT update `products` (cron is a refresh, not an upsert).
 */

import { extractMLAId } from "../lib/ml-url";
import { fetchMLItem } from "./ml-api";

const PRODUCT_LIMIT = 100;
const BATCH_SIZE = 10;

interface ProductRow {
  id: number;
  url: string;
}

interface ScheduledEnv {
  DB: D1Database;
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

export async function runScheduledScrape(
  env: ScheduledEnv,
): Promise<{ scraped: number; failed: number; skipped: number }> {
  // TODO: filter by "popular" / Hot Sale list later — for now scope is bounded by limit.
  const result = await env.DB
    .prepare("SELECT id, url FROM products LIMIT ?1")
    .bind(PRODUCT_LIMIT)
    .all<ProductRow>();

  const rows = result.results ?? [];
  if (rows.length === 0) {
    console.log("[cron] scraped=0 failed=0 skipped=0");
    return { scraped: 0, failed: 0, skipped: 0 };
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

  console.log(`[cron] scraped=${scraped} failed=${failed} skipped=${skipped}`);
  return { scraped, failed, skipped };
}
