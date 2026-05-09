/**
 * Price history analytics.
 * Computes 7-day discount + inflation flag from D1 price rows.
 */

import type { PriceRow, PriceStats } from "../types";

const DAY_SEC = 86400;

export function computeStats(history: PriceRow[], nowSec?: number): PriceStats {
  const now = nowSec ?? Math.floor(Date.now() / 1000);

  if (!history || history.length === 0) {
    return {
      current_price: null,
      price_7d_ago: null,
      real_discount_pct: null,
      inflated: false,
      baseline_at: null,
      baseline_age_days: null,
      price_min: null,
      price_max: null,
      price_30d_ago: null,
      price_30d_pct: null,
    };
  }

  const current_price = history[0]?.price ?? null;
  const current_at = history[0]?.scraped_at ?? null;

  // If only one row exists and it's within the last 24h, we have no historical baseline.
  let price_7d_ago: number | null;
  let baseline_at: number | null = null;
  if (history.length === 1) {
    const onlyRow = history[0];
    if (Math.abs(now - onlyRow.scraped_at) <= DAY_SEC) {
      price_7d_ago = null;
    } else {
      price_7d_ago = onlyRow.price;
      baseline_at = onlyRow.scraped_at;
    }
  } else {
    const target = now - 7 * DAY_SEC;
    let closest = history[0];
    let bestDelta = Math.abs(history[0].scraped_at - target);
    for (let i = 1; i < history.length; i++) {
      const delta = Math.abs(history[i].scraped_at - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        closest = history[i];
      }
    }
    price_7d_ago = closest.price;
    baseline_at = closest.scraped_at;
  }

  let real_discount_pct: number | null = null;
  if (current_price != null && price_7d_ago != null && price_7d_ago > 0) {
    const pct = ((price_7d_ago - current_price) / price_7d_ago) * 100;
    real_discount_pct = Math.round(pct * 10) / 10;
  }

  const inflated =
    price_7d_ago != null &&
    current_price != null &&
    current_price > price_7d_ago * 1.05;

  // Baseline age: prefer delta against current price's scraped_at (matches what
  // movers.ts exposes, makes "hace N días" copy stable across requests within
  // the same scrape window). Falls back to `now` when there is no current row.
  // Floored at 0 so single-row-stale-baseline doesn't surface negative ages.
  let baseline_age_days: number | null = null;
  if (baseline_at != null) {
    const ref = current_at ?? now;
    baseline_age_days = Math.max(0, Math.round((ref - baseline_at) / DAY_SEC));
  }

  // Price range across the full history window. Lets callers render chart
  // Y-axis bounds or "precio más bajo / más alto en el período" copy without
  // scanning the history array client-side.
  let price_min: number | null = null;
  let price_max: number | null = null;
  for (const row of history) {
    if (price_min === null || row.price < price_min) price_min = row.price;
    if (price_max === null || row.price > price_max) price_max = row.price;
  }

  // 30-day baseline: price row closest to (now - 30 days). Only populated when
  // history spans far enough back — a product with only 7 days of data returns
  // null here. Used to detect pre-event manipulation (Hot Sale / CyberMonday
  // sellers often inflate prices 2-4 weeks before the event).
  let price_30d_ago: number | null = null;
  if (history.length > 1) {
    const target30 = now - 30 * DAY_SEC;
    let closest30 = history[0];
    let bestDelta30 = Math.abs(history[0].scraped_at - target30);
    for (let i = 1; i < history.length; i++) {
      const delta = Math.abs(history[i].scraped_at - target30);
      if (delta < bestDelta30) {
        bestDelta30 = delta;
        closest30 = history[i];
      }
    }
    // Only return the 30d baseline when the closest row is actually older than
    // 20 days — otherwise we'd return the same data as price_7d_ago for products
    // with sparse history and mislead callers into thinking the baseline is 30d.
    if (now - closest30.scraped_at >= 20 * DAY_SEC) {
      price_30d_ago = closest30.price;
    }
  }

  // 30-day discount pct: (price_30d_ago - current) / price_30d_ago * 100.
  // Mirrors real_discount_pct but against the longer baseline. Negative value
  // means price rose since 30d ago — a pre-event inflation signal the extension
  // can surface as "precio subió X% en el último mes".
  let price_30d_pct: number | null = null;
  if (current_price != null && price_30d_ago != null && price_30d_ago > 0) {
    const pct = ((price_30d_ago - current_price) / price_30d_ago) * 100;
    price_30d_pct = Math.round(pct * 10) / 10;
  }

  return {
    current_price,
    price_7d_ago,
    real_discount_pct,
    inflated,
    baseline_at,
    baseline_age_days,
    price_min,
    price_max,
    price_30d_ago,
    price_30d_pct,
  };
}
