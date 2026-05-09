/**
 * /api/movers — top real-discount drops across the tracked catalog.
 *
 * Definition of a "mover":
 *   - Product has at least one recent price (≤ MAX_RECENT_AGE_DAYS old).
 *   - Product has at least one historical price ≥ MIN_BASELINE_AGE_DAYS old.
 *   - Real discount = (baseline_price - latest_price) / baseline_price * 100.
 *   - Mover qualifies when real_discount_pct ≥ min_drop AND not inflated.
 *
 * "Inflated" mirrors the /api/price verdict semantics: latest price > baseline * 1.05.
 * It can't show up here as a positive discount (math would yield negative pct), but
 * we still tag it so callers can sanity-check.
 *
 * The query selects, per product, the latest price row + the price row whose
 * scraped_at is closest to (now - 7 days), bounded to the configured window.
 * D1 / SQLite supports window functions, but per-product subqueries with
 * ORDER BY + LIMIT 1 are simpler to reason about and the products table is
 * small (≤ a few thousand rows), so the planner can index-walk efficiently.
 */

const DAY_SEC = 86400;

// How recent the latest price row must be for a product to count as a mover.
// Anything older means the cron hasn't refreshed it lately and it would be
// noise to surface as a "current deal".
const MAX_RECENT_AGE_DAYS = 2;

// How old the baseline must be. We aim for ~7 days but accept anywhere in
// [MIN_BASELINE_AGE_DAYS, MAX_BASELINE_AGE_DAYS] to keep the cohort large
// during the cron's first weeks (when 7-day-exact rows may be sparse).
const MIN_BASELINE_AGE_DAYS = 5;
const MAX_BASELINE_AGE_DAYS = 14;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_MIN_DROP_PCT = 10;

export interface MoverRow {
  product_id: number;
  url: string;
  title: string | null;
  seller: string | null;
  image_url: string | null;
  current_price: number;
  baseline_price: number;
  baseline_age_days: number;
  real_discount_pct: number;
  last_scraped_at: number;
}

export interface MoversOptions {
  limit?: number;
  minDropPct?: number;
  nowSec?: number;
}

interface MoversEnv {
  DB: D1Database;
}

interface RawMoverRow {
  product_id: number;
  url: string;
  title: string | null;
  seller: string | null;
  image_url: string | null;
  current_price: number;
  current_scraped_at: number;
  baseline_price: number;
  baseline_scraped_at: number;
}

export function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)));
}

export function clampMinDrop(raw: unknown): number {
  // Treat null/undefined/empty-string as "missing" (DEFAULT). Without this
  // guard, Number(null) === 0 and Number("") === 0 would silently coerce a
  // missing query param into "show me 0%-and-above movers" instead of the
  // documented default of 10%, breaking the landing page's expected feed size.
  if (raw == null || raw === "") return DEFAULT_MIN_DROP_PCT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_MIN_DROP_PCT;
  // Accept negatives too — a caller asking for min_drop=-100 effectively says
  // "show me everything". We still cap at 99 on the high side to avoid the
  // pathological "show only 100% drops" case.
  return Math.min(99, n);
}

export async function fetchMovers(
  env: MoversEnv,
  opts: MoversOptions = {},
): Promise<MoverRow[]> {
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const limit = clampLimit(opts.limit);
  const minDrop = clampMinDrop(opts.minDropPct);

  const recentCutoff = now - MAX_RECENT_AGE_DAYS * DAY_SEC;
  const baselineMin = now - MAX_BASELINE_AGE_DAYS * DAY_SEC;
  const baselineMax = now - MIN_BASELINE_AGE_DAYS * DAY_SEC;
  const baselineTarget = now - 7 * DAY_SEC;

  // Per-product correlated subqueries pick:
  //   current  → latest price row newer than recentCutoff
  //   baseline → price row in the [baselineMin, baselineMax] window whose
  //              scraped_at is closest to baselineTarget (~7 days ago)
  // The outer WHERE filters out products lacking either side. We don't
  // compute the discount in SQL — D1 does not have a clean ROUND-to-1-decimal
  // helper across versions, and post-filtering in JS lets the caller tweak
  // min_drop without re-prepare()ing.
  //
  // SQL ORDER BY is by raw price-drop magnitude (a $1M item dropping 5% can
  // outrank a $10k item dropping 50% on absolute drop), so we always pull
  // MAX_LIMIT rows and let the JS-side pct sort pick the true top-N. The
  // outer MAX_LIMIT cap on `limit` keeps this bounded.
  //
  // SQLite has no ROW_NUMBER() syntax that would let us pre-sort by pct in a
  // single query without nested CTEs, and MAX_LIMIT rows is well under D1's
  // payload budget. Doing it client-side keeps the SQL portable and lets us
  // tweak min_drop without re-prepare()ing.
  const overfetch = MAX_LIMIT;

  const sql = `
    SELECT
      p.id          AS product_id,
      p.url         AS url,
      p.title       AS title,
      p.seller      AS seller,
      p.image_url   AS image_url,
      cur.price     AS current_price,
      cur.scraped_at AS current_scraped_at,
      base.price    AS baseline_price,
      base.scraped_at AS baseline_scraped_at
    FROM products p
    JOIN (
      SELECT product_id, price, scraped_at
      FROM prices px
      WHERE scraped_at >= ?1
        AND scraped_at = (
          SELECT MAX(scraped_at) FROM prices WHERE product_id = px.product_id
        )
    ) cur ON cur.product_id = p.id
    JOIN (
      SELECT product_id, price, scraped_at
      FROM prices px
      WHERE scraped_at BETWEEN ?2 AND ?3
        AND ABS(scraped_at - ?4) = (
          SELECT MIN(ABS(scraped_at - ?4))
          FROM prices
          WHERE product_id = px.product_id
            AND scraped_at BETWEEN ?2 AND ?3
        )
    ) base ON base.product_id = p.id
    WHERE cur.price > 0
      AND base.price > 0
      AND cur.price < base.price
    ORDER BY (base.price - cur.price) DESC
    LIMIT ?5
  `;

  const result = await env.DB
    .prepare(sql)
    .bind(recentCutoff, baselineMin, baselineMax, baselineTarget, overfetch)
    .all<RawMoverRow>();

  const raw = result.results ?? [];

  const movers: MoverRow[] = [];
  for (const row of raw) {
    if (
      typeof row.current_price !== "number" ||
      typeof row.baseline_price !== "number" ||
      row.baseline_price <= 0
    ) {
      continue;
    }
    const pctRaw = ((row.baseline_price - row.current_price) / row.baseline_price) * 100;
    const real_discount_pct = Math.round(pctRaw * 10) / 10;
    if (real_discount_pct < minDrop) continue;
    const baseline_age_days = Math.max(
      0,
      Math.round((row.current_scraped_at - row.baseline_scraped_at) / DAY_SEC),
    );
    movers.push({
      product_id: row.product_id,
      url: row.url,
      title: row.title,
      seller: row.seller,
      image_url: row.image_url,
      current_price: row.current_price,
      baseline_price: row.baseline_price,
      baseline_age_days,
      real_discount_pct,
      last_scraped_at: row.current_scraped_at,
    });
  }

  // Final sort by pct desc, slice to requested limit. SQL pre-sort was by
  // absolute drop, so this re-orders the headroom into pct-sorted output.
  movers.sort((a, b) => b.real_discount_pct - a.real_discount_pct);
  return movers.slice(0, limit);
}
