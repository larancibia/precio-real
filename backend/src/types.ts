/**
 * Shared types for precio-real API.
 * D1 row shapes plus derived analytics + external data shapes.
 */

export interface ProductRow {
  id: number;
  url: string;
  title: string | null;
  seller: string | null;
  image_url: string | null;
  created_at: number;
}

export interface PriceRow {
  price: number;
  currency: string;
  scraped_at: number;
}

export interface PriceStats {
  current_price: number | null;
  price_7d_ago: number | null;
  real_discount_pct: number | null;
  inflated: boolean;
  // Unix seconds of the price row picked as the "7-day-ago" baseline.
  // Null when there is no usable baseline (empty history or single recent row).
  baseline_at: number | null;
  // Age in days of the baseline relative to the latest price row (or `now` when
  // there's no current_price). Always >= 0. Null mirrors baseline_at.
  // Lets the client render accurate copy ("vs precio de hace 6 días") instead
  // of hard-coding "7 días" — the cron's bucket may pick anywhere in [5, 14] d.
  baseline_age_days: number | null;
  // Min and max price seen across the history window. Null when history is empty.
  // Useful for rendering chart Y-axis bounds and showing "precio más bajo / más
  // alto en el período" copy without the client scanning the full history array.
  price_min: number | null;
  price_max: number | null;
  // 30-day baseline — price closest to 30 days ago. Null when history doesn't
  // span back that far. A second reference point that's harder to manipulate
  // than the 7-day baseline during Hot Sale / CyberMonday when sellers inflate
  // prices for weeks before the event.
  price_30d_ago: number | null;
  // Discount pct vs the 30-day baseline: (price_30d_ago - current) / price_30d_ago * 100.
  // Negative means price rose vs 30d ago (pre-event inflation signal).
  // Null when price_30d_ago is null. Companion to real_discount_pct (7d window).
  price_30d_pct: number | null;
}

export interface WaybackSnapshot {
  timestamp: number;
  price: number;
}

export interface MLItem {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  permalink: string;
  thumbnail: string | null;
  seller_nickname: string | null;
}
