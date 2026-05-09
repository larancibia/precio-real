/**
 * precio-real API — Cloudflare Worker
 *
 * Routes:
 *   GET  /api/health             → { ok: true }
 *   GET  /api/price?url=<url>    → { product, current_price, price_7d_ago, real_discount_pct,
 *                                    inflated, last_scraped_at, history_days, history }
 *   GET  /api/stats              → { products, prices, last_scraped_at, oldest_scraped_at,
 *                                    products_with_prices }
 *   GET  /api/search?q=<keyword>&limit=<n>
 *                                → { count, results: [{ id, url, title, seller, image_url }] }
 *   GET  /api/movers?limit=&min_drop=
 *                                → { generated_at, count, min_drop_pct, movers: [...] }
 *                                  Top real-discount products (current price below
 *                                  ~7-day-ago baseline). Used by the landing page
 *                                  for "ofertas reales hoy".
 *   POST /api/scrape/wayback?url=<url> → { inserted, scanned, failed }
 *   POST /api/scrape/run         → manual trigger of the scheduled scraper (debug/seed)
 *   *                             → 404
 *
 * Cron:
 *   "0 *\/6 * * *" → runScheduledScrape (top 500 popular MLA products, issue #11)
 */

import type { ProductRow, PriceRow } from "./types";
import { computeStats } from "./lib/analytics";
import { extractMLAId, normalizeMLUrl } from "./lib/ml-url";
import { fetchMovers, clampLimit, clampMinDrop } from "./lib/movers";
import { backfillWaybackHistory } from "./scrapers/wayback";
import { runScheduledScrape } from "./scrapers/scheduled";

// Cap history rows returned by /api/price. The extension only needs enough
// points to render the verdict + a small chart; an unbounded history grows
// the response payload (and DB scan cost) for nothing once the cron has been
// running for a while.
const PRICE_HISTORY_LIMIT = 180;

export interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

async function handlePrice(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return json({ error: "Missing required query parameter: url" }, 400);
  }

  // Be tolerant of trailing-slash / case differences between the extension's
  // canonicalUrl() and the permalink stored at discovery time. Try the
  // exact URL first, then fall back to a normalized lookup.
  let product = await env.DB
    .prepare("SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1")
    .bind(target)
    .first<ProductRow>();

  if (!product) {
    let normalized: string | null = null;
    try {
      normalized = normalizeMLUrl(target);
    } catch {
      normalized = null;
    }
    if (normalized && normalized !== target) {
      product = await env.DB
        .prepare(
          "SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1",
        )
        .bind(normalized)
        .first<ProductRow>();
    }
  }

  if (!product) {
    return json({ error: "Product not found", url: target }, 404);
  }

  const history = await env.DB
    .prepare(
      "SELECT price, currency, scraped_at FROM prices WHERE product_id = ?1 ORDER BY scraped_at DESC LIMIT ?2",
    )
    .bind(product.id, PRICE_HISTORY_LIMIT)
    .all<PriceRow>();

  const rows = history.results ?? [];
  const stats = computeStats(rows);

  if (rows.length < 5 && extractMLAId(product.url)) {
    ctx.waitUntil(
      backfillWaybackHistory(product.id, product.url, env).catch((err) =>
        console.warn("[price] waitUntil wayback failed:", err),
      ),
    );
  }

  // Freshness metadata: rows is ordered DESC by scraped_at, so [0] is newest
  // and [length-1] is oldest in the (capped) window. The extension/landing can
  // use this to render "datos al X de Y" copy without re-deriving from history.
  const last_scraped_at = rows.length > 0 ? rows[0].scraped_at : null;
  const oldest_scraped_at = rows.length > 0 ? rows[rows.length - 1].scraped_at : null;
  const history_days =
    last_scraped_at != null && oldest_scraped_at != null
      ? Math.max(0, Math.round((last_scraped_at - oldest_scraped_at) / 86400))
      : 0;

  return json({
    product,
    ...stats,
    last_scraped_at,
    history_days,
    history: rows,
  });
}

interface StatsRow {
  products: number;
  prices: number;
  last_scraped_at: number | null;
  oldest_scraped_at: number | null;
  products_with_prices: number;
}

async function handleStats(env: Env): Promise<Response> {
  // Single-query aggregate snapshot. Cheap on D1 because each table has its
  // own indexed scan and we only need MIN/MAX/COUNT — D1 short-circuits these.
  // We expose this for the landing page transparency widget ("seguimos N
  // productos / última actualización: hace X horas") without giving callers a
  // way to enumerate the tables.
  const products = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM products")
    .first<{ n: number }>();
  const priceAgg = await env.DB
    .prepare(
      "SELECT COUNT(*) AS n, MIN(scraped_at) AS oldest, MAX(scraped_at) AS newest, " +
        "COUNT(DISTINCT product_id) AS unique_products FROM prices",
    )
    .first<{ n: number; oldest: number | null; newest: number | null; unique_products: number }>();

  const out: StatsRow = {
    products: products?.n ?? 0,
    prices: priceAgg?.n ?? 0,
    last_scraped_at: priceAgg?.newest ?? null,
    oldest_scraped_at: priceAgg?.oldest ?? null,
    products_with_prices: priceAgg?.unique_products ?? 0,
  };

  return json(out, 200);
}

const SEARCH_MAX_LIMIT = 50;

async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return json({ error: "Missing required query parameter: q" }, 400);
  }
  const rawLimit = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(SEARCH_MAX_LIMIT, Math.floor(rawLimit))
    : 10;

  const pattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const rows = await env.DB
    .prepare(
      "SELECT id, url, title, seller, image_url FROM products WHERE title LIKE ?1 ESCAPE '\\' ORDER BY id DESC LIMIT ?2",
    )
    .bind(pattern, limit)
    .all<Pick<ProductRow, "id" | "url" | "title" | "seller" | "image_url">>();

  const results = rows.results ?? [];
  return json({ count: results.length, results });
}

async function handleMovers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const minDropParam = url.searchParams.get("min_drop");
  const minDropPct = minDropParam == null ? undefined : clampMinDrop(minDropParam);

  const movers = await fetchMovers(env, { limit, minDropPct });

  return json({
    generated_at: Math.floor(Date.now() / 1000),
    count: movers.length,
    limit,
    min_drop_pct: minDropPct ?? 10,
    movers,
  });
}

async function handleWaybackScrape(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return json({ error: "Missing required query parameter: url" }, 400);
  }

  // Mirror handlePrice's tolerant lookup: try the exact URL first, then a
  // normalized fallback. Without this, callers that hit /api/scrape/wayback
  // with a trailing-slashed or mixed-case URL would 404 even though the
  // product exists in `products` under its canonical form.
  let product = await env.DB
    .prepare("SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1")
    .bind(target)
    .first<ProductRow>();

  if (!product) {
    let normalized: string | null = null;
    try {
      normalized = normalizeMLUrl(target);
    } catch {
      normalized = null;
    }
    if (normalized && normalized !== target) {
      product = await env.DB
        .prepare(
          "SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1",
        )
        .bind(normalized)
        .first<ProductRow>();
    }
  }

  if (!product) {
    return json({ error: "Product not found", url: target }, 404);
  }

  try {
    const result = await backfillWaybackHistory(product.id, product.url, env);
    return json(result);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "scrape failed", detail }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/api/price") {
      try {
        return await handlePrice(request, env, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/stats") {
      try {
        return await handleStats(env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/search") {
      try {
        return await handleSearch(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/movers") {
      try {
        return await handleMovers(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/scrape/wayback") {
      try {
        return await handleWaybackScrape(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/scrape/run") {
      try {
        const result = await runScheduledScrape(env);
        return json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    return json({ error: "Not found", path: url.pathname }, 404);
  },

  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runScheduledScrape(env));
  },
} satisfies ExportedHandler<Env>;
