/**
 * Argentine price parsing + HTML price extraction.
 * Worker has no DOM, so HTML extraction is regex/JSON-based only.
 */

export function parseArgentinePrice(s: string): number | null {
  if (s == null) return null;
  const trimmed = String(s).trim();
  if (!trimmed) return null;

  // Keep only digits, dots, commas, minus.
  const cleaned = trimmed.replace(/[^\d.,-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  let normalized: string;
  if (hasDot && hasComma) {
    // AR format: dots = thousands, comma = decimal.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Only comma → decimal separator.
    normalized = cleaned.replace(",", ".");
  } else if (hasDot) {
    // Only dot: ambiguous. Treat as thousands sep when string has 4+ digits AND
    // the dot is followed by exactly 3 digits (e.g. "1.234"); else decimal.
    const lastDot = cleaned.lastIndexOf(".");
    const afterDot = cleaned.slice(lastDot + 1);
    const digitCount = cleaned.replace(/[^\d]/g, "").length;
    if (digitCount >= 4 && afterDot.length === 3 && /^\d+$/.test(afterDot)) {
      normalized = cleaned.replace(/\./g, "");
    } else {
      normalized = cleaned;
    }
  } else {
    normalized = cleaned;
  }

  if (!normalized || normalized === "-" || normalized === ".") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const MAX_PLAUSIBLE_PRICE = 100_000_000;

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isPlausible(n: number | null): n is number {
  return n != null && n > 0 && n <= MAX_PLAUSIBLE_PRICE;
}

// Recursive walk: find first plausible offers.price within a parsed JSON-LD blob.
function findOfferPrice(node: unknown): number | null {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findOfferPrice(item);
      if (found != null) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;

  if ("offers" in obj) {
    const offers = obj.offers;
    if (Array.isArray(offers)) {
      for (const offer of offers) {
        if (offer && typeof offer === "object") {
          const price = coerceNumber((offer as Record<string, unknown>).price);
          if (isPlausible(price)) return price;
        }
      }
    } else if (offers && typeof offers === "object") {
      const price = coerceNumber((offers as Record<string, unknown>).price);
      if (isPlausible(price)) return price;
      // Recurse into offers in case of nested structures.
      const nested = findOfferPrice(offers);
      if (nested != null) return nested;
    }
  }

  for (const key of Object.keys(obj)) {
    if (key === "offers") continue;
    const found = findOfferPrice(obj[key]);
    if (found != null) return found;
  }
  return null;
}

export function extractPriceFromHTML(html: string): number | null {
  if (!html) return null;

  // Strategy 1: JSON-LD blocks.
  const ldRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = ldRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const price = findOfferPrice(parsed);
      if (isPlausible(price)) return price;
    } catch {
      // Skip malformed JSON-LD blocks.
    }
  }

  // Strategy 2: microdata <meta itemprop="price" content="...">.
  const metaMatch = html.match(/<meta\s+itemprop=["']price["']\s+content=["']([^"']+)["']/i);
  if (metaMatch) {
    const price = coerceNumber(metaMatch[1]);
    if (isPlausible(price)) return price;
  }

  // Strategy 3: inlined state (e.g. __PRELOADED_STATE__). Skip values <= 100 since
  // tiny "price":0 fields are usually unrelated (discounts, shipping, etc).
  const stateRegex = /"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/g;
  while ((match = stateRegex.exec(html)) !== null) {
    const price = coerceNumber(match[1]);
    if (isPlausible(price) && price > 100) return price;
  }

  return null;
}
