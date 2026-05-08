/**
 * MercadoLibre public API helper.
 * Fetches a single item by MLA id (no auth required).
 * Returns null on any failure (delisted, network error, validation).
 */

import type { MLItem } from "../types";

const ML_ITEM_ATTRIBUTES = "id,title,price,currency_id,permalink,thumbnail,seller_id";
const ML_USER_AGENT = "precio-real/0.1 (+https://precioreal.ar)";
const ML_TIMEOUT_MS = 10_000;

interface MLApiResponse {
  id?: unknown;
  title?: unknown;
  price?: unknown;
  currency_id?: unknown;
  permalink?: unknown;
  thumbnail?: unknown;
}

export async function fetchMLItem(id: string): Promise<MLItem | null> {
  if (!/^MLA\d+$/i.test(id)) {
    return null;
  }

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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[ml-api] error fetching ${id}: ${message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
