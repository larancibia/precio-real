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

  return {
    current_price,
    price_7d_ago,
    real_discount_pct,
    inflated,
    baseline_at,
    baseline_age_days,
  };
}
