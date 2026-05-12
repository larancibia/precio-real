import type { ProductRow } from "../types";

export interface ObservationInput {
  url?: unknown;
  title?: unknown;
  seller?: unknown;
  image_url?: unknown;
  price?: unknown;
  currency?: unknown;
}

export interface ValidObservation {
  url: string;
  title: string | null;
  seller: string | null;
  image_url: string | null;
  price: number;
  currency: string;
}

const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 300;
const MAX_SELLER_LENGTH = 120;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_PRICE_ARS = 1_000_000_000;

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeObservedUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith("mercadolibre.com.ar")) return null;

  parsed.hash = "";
  parsed.search = "";
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  parsed.hostname = host;
  return parsed.toString();
}

function normalizeImageUrl(raw: unknown): string | null {
  const image = cleanString(raw, MAX_IMAGE_URL_LENGTH);
  if (!image) return null;
  try {
    const parsed = new URL(image);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeCurrency(raw: unknown): string {
  if (typeof raw !== "string") return "ARS";
  const currency = raw.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(currency)) return currency;
  return "ARS";
}

// Minimal D1 surface used by upsertObservedProduct — structurally compatible
// with D1Database so the real worker works and tests can inject a stub.
interface ObserveDB {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<{ meta?: { changes?: number } }>;
    };
  };
}

/**
 * Upsert the observed product row and patch any null metadata fields.
 *
 * Uses INSERT OR IGNORE so that concurrent requests observing the same URL
 * don't race to a UNIQUE constraint error (which previously caused 500s under
 * Hot Sale traffic). The re-SELECT after the INSERT always finds the row
 * regardless of which concurrent request actually inserted it.
 *
 * Returns the product row, or null if the row cannot be found after the upsert
 * (should never happen in practice — signals a D1 error).
 */
export async function upsertObservedProduct(
  db: ObserveDB,
  obs: ValidObservation,
): Promise<ProductRow | null> {
  // Fast path: product already in DB — skip the INSERT.
  let product = await db
    .prepare(
      "SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1",
    )
    .bind(obs.url)
    .first<ProductRow>();

  if (!product) {
    // INSERT OR IGNORE: if a concurrent request wins the race and inserts the
    // same URL first, the UNIQUE constraint is silently ignored rather than
    // propagating an error. The re-SELECT below finds the winning row either way.
    await db
      .prepare(
        "INSERT OR IGNORE INTO products (url, title, seller, image_url) VALUES (?1, ?2, ?3, ?4)",
      )
      .bind(obs.url, obs.title, obs.seller, obs.image_url)
      .run();

    product = await db
      .prepare(
        "SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1",
      )
      .bind(obs.url)
      .first<ProductRow>();
  }

  if (!product) return null;

  // Patch null metadata. Applies whether we just inserted or found an existing
  // row — the concurrent-insert race can leave fields null when the other
  // inserter also had no metadata and our observation carries richer data.
  if (
    (!product.title && obs.title) ||
    (!product.seller && obs.seller) ||
    (!product.image_url && obs.image_url)
  ) {
    await db
      .prepare(
        "UPDATE products SET title = COALESCE(title, ?1), seller = COALESCE(seller, ?2), image_url = COALESCE(image_url, ?3) WHERE id = ?4",
      )
      .bind(obs.title, obs.seller, obs.image_url, product.id)
      .run();
  }

  return product;
}

export function validateObservation(input: ObservationInput): ValidObservation | { error: string } {
  const url = normalizeObservedUrl(input.url);
  if (!url) return { error: "invalid url" };

  const price = typeof input.price === "number" ? input.price : Number(input.price);
  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE_ARS) {
    return { error: "invalid price" };
  }

  return {
    url,
    title: cleanString(input.title, MAX_TITLE_LENGTH),
    seller: cleanString(input.seller, MAX_SELLER_LENGTH),
    image_url: normalizeImageUrl(input.image_url),
    price: Math.round(price * 100) / 100,
    currency: normalizeCurrency(input.currency),
  };
}
