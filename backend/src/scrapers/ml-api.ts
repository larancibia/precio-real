/**
 * MercadoLibre public API helper.
 * Fetches a single item by MLA id (no auth required).
 * Returns null on any failure (delisted, network error, validation).
 *
 * Retries transient failures (HTTP 429/5xx, AbortError on timeout, network
 * errors) via the shared withRetry helper so the cron doesn't lose a price
 * datapoint for a popular item every time ML hiccups. Permanent failures
 * (404 delisted, 401/403, schema mismatch) short-circuit and return null.
 */

import type { MLItem } from "../types";
import { isTransientHttpStatus, withRetry } from "../lib/retry";

const ML_ITEM_ATTRIBUTES = "id,title,price,currency_id,permalink,thumbnail,seller_id";
const ML_USER_AGENT = "precio-real/0.1 (+https://precioreal.ar)";
const ML_TIMEOUT_MS = 10_000;
// Retry budget aligned with discovery.ts: 3 total tries × 750ms linear
// backoff. The cron processes ML items in batches of 10 in parallel
// (scheduled.ts BATCH_SIZE), so worst-case retry latency stays well under
// CF subrequest time budgets.
const ML_MAX_ATTEMPTS = 3;
const ML_RETRY_BASE_MS = 750;

interface MLApiResponse {
  id?: unknown;
  title?: unknown;
  price?: unknown;
  currency_id?: unknown;
  permalink?: unknown;
  thumbnail?: unknown;
}

async function fetchMLItemOnce(id: string): Promise<MLItem | null> {
  const upperId = id.toUpperCase();
  const url = `https://api.mercadolibre.com/items/${upperId}?attributes=${ML_ITEM_ATTRIBUTES}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ML_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      // Transient → throw so withRetry retries; permanent → null shortcut.
      if (isTransientHttpStatus(res.status)) {
        const err = new Error(`ML items ${res.status} for ${upperId}`);
        (err as Error & { transient?: boolean }).transient = true;
        throw err;
      }
      return null;
    }

    const body = (await res.json()) as MLApiResponse;

    if (typeof body.price !== "number" || !Number.isFinite(body.price)) {
      return null;
    }
    if (typeof body.permalink !== "string") {
      return null;
    }
    if (typeof body.id !== "string") {
      return null;
    }
    if (typeof body.title !== "string") {
      return null;
    }
    if (typeof body.currency_id !== "string") {
      return null;
    }

    const thumbnail = typeof body.thumbnail === "string" ? body.thumbnail : null;

    return {
      id: body.id,
      title: body.title,
      price: body.price,
      currency_id: body.currency_id,
      permalink: body.permalink,
      thumbnail,
      seller_nickname: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMLItem(id: string): Promise<MLItem | null> {
  if (!/^MLA\d+$/i.test(id)) {
    return null;
  }

  try {
    return await withRetry(() => fetchMLItemOnce(id), {
      maxAttempts: ML_MAX_ATTEMPTS,
      baseDelayMs: ML_RETRY_BASE_MS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[ml-api] error fetching ${id} after retries: ${message}`);
    return null;
  }
}
