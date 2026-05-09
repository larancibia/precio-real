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
