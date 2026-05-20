/**
 * Scheduled cron handler — refreshes known ML prices on the configured cron.
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
import { classifyProductUrl } from "../lib/product-url-classifier";
import { fetchMLItem } from "./ml-api";
import { runDiscovery } from "./discovery";

const PRODUCT_LIMIT = 500;
const BATCH_SIZE = 10;

export interface ProductRow {
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
  quarantined: number;
  considered: number;
  discovery: { queries: number; candidates: number; inserted: number; failed: number };
}

interface ProductMetaRow {
  title: string | null;
  image_url: string | null;
}

export interface ScheduledWorkSelection {
  work: { row: ProductRow; mlaId: string }[];
  skipped: number;
  quarantined: number;
}

export function selectScheduledWork(rows: ProductRow[]): ScheduledWorkSelection {
  let skipped = 0;
  let quarantined = 0;
  const work: { row: ProductRow; mlaId: string }[] = [];

  for (const row of rows) {
    const classification = classifyProductUrl(row.url);
    if (classification.quarantine) {
      quarantined++;
      skipped++;
      continue;
    }
    const mlaId = extractMLAId(row.url);
    if (!mlaId) {
      skipped++;
      continue;
    }
    work.push({ row, mlaId });
  }

  return { work, skipped, quarantined };
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

  // Patch null title/image_url on the product row if the ML API now has them.
  // Discovery INSERT OR IGNORE leaves these null when the search result was
  // missing the field; the items API (/items/MLAXXX) is more authoritative.
  // We only patch when the current stored values are NULL — never overwrite
  // an existing human-verified title or thumbnail.
  if (item.title || item.thumbnail) {
    try {
      const meta = await env.DB
        .prepare("SELECT title, image_url FROM products WHERE id = ?1")
        .bind(row.id)
        .first<ProductMetaRow>();
      if (meta && (!meta.title || !meta.image_url)) {
        const newTitle = !meta.title && item.title ? item.title : meta.title;
        const newImage = !meta.image_url && item.thumbnail ? item.thumbnail : meta.image_url;
        await env.DB
          .prepare("UPDATE products SET title = ?1, image_url = ?2 WHERE id = ?3")
          .bind(newTitle, newImage, row.id)
          .run();
      }
    } catch (err) {
      // Non-fatal: price was already inserted. Log and continue.
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[cron] meta patch failed for product_id=${row.id}: ${message}`);
    }
  }
}

export async function runScheduledScrape(env: ScheduledEnv): Promise<ScheduledResult> {
  const discovery = await runDiscovery(env).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron] discovery threw: ${message}`);
    return { queries: 0, candidates: 0, inserted: 0, failed: 0 };
  });

  // Stale-first ordering: prefer products whose latest scraped_at is oldest
  // (NULLS first via COALESCE → 0 for products that have no prices yet, so
  // freshly discovered items get an initial datapoint on their first cron).
  // Bounded by PRODUCT_LIMIT to keep the cron under CF subrequest budgets
  // (each fetchMLItem = 1 outbound fetch).
  const result = await env.DB
    .prepare(
      `SELECT p.id AS id, p.url AS url
       FROM products p
       LEFT JOIN (
         SELECT product_id, MAX(scraped_at) AS last_scraped_at
         FROM prices
         GROUP BY product_id
       ) px ON px.product_id = p.id
       ORDER BY COALESCE(px.last_scraped_at, 0) ASC, p.id DESC
       LIMIT ?1`,
    )
    .bind(PRODUCT_LIMIT)
    .all<ProductRow>();

  const rows = result.results ?? [];
  if (rows.length === 0) {
    console.log("[cron] scraped=0 failed=0 skipped=0 (empty products table)");
    return { scraped: 0, failed: 0, skipped: 0, quarantined: 0, considered: 0, discovery };
  }

  let scraped = 0;
  let failed = 0;
  const { work, skipped, quarantined } = selectScheduledWork(rows);

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
    `[cron] considered=${rows.length} scraped=${scraped} failed=${failed} skipped=${skipped} quarantined=${quarantined}`,
  );
  return { scraped, failed, skipped, quarantined, considered: rows.length, discovery };
}
