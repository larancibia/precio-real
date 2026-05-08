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
