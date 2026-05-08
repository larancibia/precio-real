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
    };
  }

  const current_price = history[0]?.price ?? null;

  // If only one row exists and it's within the last 24h, we have no historical baseline.
  let price_7d_ago: number | null;
  if (history.length === 1) {
    const onlyRow = history[0];
    if (Math.abs(now - onlyRow.scraped_at) <= DAY_SEC) {
      price_7d_ago = null;
    } else {
      price_7d_ago = onlyRow.price;
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

  return {
    current_price,
    price_7d_ago,
    real_discount_pct,
    inflated,
  };
}
