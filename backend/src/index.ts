/**
 * precio-real API — Cloudflare Worker
 *
 * Routes:
 *   GET  /api/health             → { ok: true }
 *   GET  /api/price?url=<url>    → { product, current_price, price_7d_ago, real_discount_pct,
 *                                    inflated, last_scraped_at, history_days, history }
 *   GET  /api/stats              → { products, prices, last_scraped_at, oldest_scraped_at,
 *                                    products_with_prices }
 *   GET  /api/search?q=<keyword>&limit=<n>&offset=<n>
 *                                → { total, count, offset, results: [{ id, url, title, seller, image_url }] }
 *                                  total = full match count (for pagination); count = items in this page
 *   GET  /api/movers?limit=&min_drop=
 *                                → { generated_at, count, min_drop_pct, movers: [...] }
 *                                  Top real-discount products (current price below
 *                                  ~7-day-ago baseline). Used by the landing page
 *                                  for "ofertas reales hoy".
 *   GET  /api/products?limit=<n>&offset=<n>&seller=<seller>
 *                                → { total, count, offset, results: [{ id, url, title, seller, image_url }] }
 *                                  Paginated catalog browse (all tracked products, optional seller filter).
 *                                  Results ordered by id DESC (newest-discovered first).
 *   GET  /api/trending?limit=<n> → { generated_at, count, results: [{ id, url, title, seller, image_url, price_count, last_scraped_at }] }
 *                                  Most-tracked products by price observation count (highest data density first).
 *                                  Useful for surfacing products with the richest price history.
 *   GET  /api/sellers?limit=<n>  → { count, results: [{ seller, product_count, price_count, last_scraped_at }] }
 *                                  Top sellers ranked by number of tracked products.
 *                                  Useful for the landing page "vendedores más seguidos" widget.
 *   GET  /api/compare?urls=<url1>,<url2>,...  → { count, results: [{ url, found, product?, ...stats }] }
 *                                  Batch price lookup for up to COMPARE_MAX_URLS URLs.
 *                                  Each item carries the same fields as /api/price (minus full history).
 *                                  Useful for the extension's "comparar en otras tiendas" panel and
 *                                  for the landing page's product-vs-product widget.
 *   POST /api/observe          → Browser-extension observed price insert.
 *   POST /api/scrape/wayback?url=<url> → { inserted, scanned, failed }
 *   POST /api/scrape/run         → manual trigger of the scheduled scraper (debug/seed)
 *   *                             → 404
 *
 * Cron:
 *   "0 * * * *" → runScheduledScrape (Hot Sale mode: hourly refresh)
 */

import type { ProductRow, PriceRow } from "./types";
import { computeStats } from "./lib/analytics";
import { extractMLAId, normalizeMLUrl } from "./lib/ml-url";
import { fetchMovers, clampLimit, clampMinDrop } from "./lib/movers";
import { validateObservation } from "./lib/observe";
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

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

// Short-lived edge cache for read-only endpoints that are cheap to re-derive
// but expensive to query (D1 read units). During Hot Sale, observed prices can
// change hourly; stats and movers don't need to be fresher than 5 min for the UI.
const CACHE_PRICE = "public, max-age=900, stale-while-revalidate=3600";
const CACHE_STATS = "public, max-age=300, stale-while-revalidate=900";
const CACHE_MOVERS = "public, max-age=300, stale-while-revalidate=900";
const CACHE_TRENDING = "public, max-age=600, stale-while-revalidate=1800";

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

  return json(
    {
      product,
      ...stats,
      last_scraped_at,
      history_days,
      history: rows,
    },
    200,
    { "Cache-Control": CACHE_PRICE },
  );
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

  return json(out, 200, { "Cache-Control": CACHE_STATS });
}

const SEARCH_MAX_LIMIT = 50;
const SEARCH_MAX_OFFSET = 10_000;

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
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0
    ? Math.min(SEARCH_MAX_OFFSET, Math.floor(rawOffset))
    : 0;

  // LOWER() on both sides for case-insensitive matching (SQLite LIKE is only
  // ASCII-case-insensitive; LOWER() covers accented chars in product titles).
  const pattern = `%${q.toLowerCase().replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  // Fetch total count + page results in parallel to keep the round-trip to
  // D1 bounded at 2 queries rather than sequential. The total lets callers
  // build pagination UI ("mostrando 1-10 de 47 resultados") without issuing
  // a separate count request.
  const [countRow, rows] = await Promise.all([
    env.DB
      .prepare(
        "SELECT COUNT(*) AS n FROM products WHERE LOWER(title) LIKE ?1 ESCAPE '\\'",
      )
      .bind(pattern)
      .first<{ n: number }>(),
    env.DB
      .prepare(
        "SELECT id, url, title, seller, image_url FROM products WHERE LOWER(title) LIKE ?1 ESCAPE '\\' ORDER BY id DESC LIMIT ?2 OFFSET ?3",
      )
      .bind(pattern, limit, offset)
      .all<Pick<ProductRow, "id" | "url" | "title" | "seller" | "image_url">>(),
  ]);

  const results = rows.results ?? [];
  const total = countRow?.n ?? results.length;
  return json({ total, count: results.length, offset, results });
}

const PRODUCTS_MAX_LIMIT = 100;
const PRODUCTS_MAX_OFFSET = 50_000;

async function handleProducts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(PRODUCTS_MAX_LIMIT, Math.floor(rawLimit))
    : 20;
  const rawOffset = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0
    ? Math.min(PRODUCTS_MAX_OFFSET, Math.floor(rawOffset))
    : 0;
  const seller = (url.searchParams.get("seller") ?? "").trim();

  // Fetch total count + page in parallel. Optional seller filter uses an
  // exact case-insensitive match (LOWER() on both sides) — sellers are
  // normalised at discovery time (ML nickname) so partial matching would
  // surface unrelated rows.
  if (seller) {
    const sellerPattern = `%${seller.toLowerCase().replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const [countRow, rows] = await Promise.all([
      env.DB
        .prepare("SELECT COUNT(*) AS n FROM products WHERE LOWER(seller) LIKE ?1 ESCAPE '\\'")
        .bind(sellerPattern)
        .first<{ n: number }>(),
      env.DB
        .prepare(
          "SELECT id, url, title, seller, image_url FROM products WHERE LOWER(seller) LIKE ?1 ESCAPE '\\' ORDER BY id DESC LIMIT ?2 OFFSET ?3",
        )
        .bind(sellerPattern, limit, offset)
        .all<Pick<ProductRow, "id" | "url" | "title" | "seller" | "image_url">>(),
    ]);
    const results = rows.results ?? [];
    const total = countRow?.n ?? results.length;
    return json(
      { total, count: results.length, offset, results },
      200,
      { "Cache-Control": CACHE_STATS },
    );
  }

  // No seller filter: return full paginated catalog.
  const [countRow, rows] = await Promise.all([
    env.DB
      .prepare("SELECT COUNT(*) AS n FROM products")
      .first<{ n: number }>(),
    env.DB
      .prepare(
        "SELECT id, url, title, seller, image_url FROM products ORDER BY id DESC LIMIT ?1 OFFSET ?2",
      )
      .bind(limit, offset)
      .all<Pick<ProductRow, "id" | "url" | "title" | "seller" | "image_url">>(),
  ]);
  const results = rows.results ?? [];
  const total = countRow?.n ?? results.length;
  return json(
    { total, count: results.length, offset, results },
    200,
    { "Cache-Control": CACHE_STATS },
  );
}

const TRENDING_MAX_LIMIT = 50;

async function handleTrending(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(TRENDING_MAX_LIMIT, Math.floor(rawLimit))
    : 20;

  // Join products with prices to count observations per product.
  // Order by price_count DESC so the most-tracked products come first.
  // We also surface last_scraped_at so callers can show data freshness.
  const rows = await env.DB
    .prepare(
      `SELECT p.id, p.url, p.title, p.seller, p.image_url,
              COUNT(po.id) AS price_count,
              MAX(po.scraped_at) AS last_scraped_at
       FROM products p
       JOIN prices po ON po.product_id = p.id
       GROUP BY p.id
       ORDER BY price_count DESC
       LIMIT ?1`,
    )
    .bind(limit)
    .all<{
      id: number;
      url: string;
      title: string | null;
      seller: string | null;
      image_url: string | null;
      price_count: number;
      last_scraped_at: number | null;
    }>();

  const results = rows.results ?? [];
  return json(
    {
      generated_at: Math.floor(Date.now() / 1000),
      count: results.length,
      results,
    },
    200,
    { "Cache-Control": CACHE_TRENDING },
  );
}

async function handleMovers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const minDropParam = url.searchParams.get("min_drop");
  const minDropPct = minDropParam == null ? undefined : clampMinDrop(minDropParam);

  const movers = await fetchMovers(env, { limit, minDropPct });

  return json(
    {
      generated_at: Math.floor(Date.now() / 1000),
      count: movers.length,
      limit,
      min_drop_pct: minDropPct ?? 10,
      movers,
    },
    200,
    { "Cache-Control": CACHE_MOVERS },
  );
}

const SELLERS_MAX_LIMIT = 100;
const CACHE_SELLERS = "public, max-age=600, stale-while-revalidate=1800";

async function handleSellers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(SELLERS_MAX_LIMIT, Math.floor(rawLimit))
    : 20;

  // Join products + prices to surface seller activity metrics. NULL seller
  // rows are excluded — they come from old discovery inserts that didn't
  // capture the seller nickname and would produce a meaningless null entry.
  const rows = await env.DB
    .prepare(
      `SELECT p.seller,
              COUNT(DISTINCT p.id)  AS product_count,
              COUNT(po.id)          AS price_count,
              MAX(po.scraped_at)    AS last_scraped_at
       FROM products p
       LEFT JOIN prices po ON po.product_id = p.id
       WHERE p.seller IS NOT NULL AND p.seller != ''
       GROUP BY p.seller
       ORDER BY product_count DESC, price_count DESC
       LIMIT ?1`,
    )
    .bind(limit)
    .all<{ seller: string; product_count: number; price_count: number; last_scraped_at: number | null }>();

  const results = rows.results ?? [];
  return json(
    { count: results.length, results },
    200,
    { "Cache-Control": CACHE_SELLERS },
  );
}

// Maximum URLs accepted by /api/compare in a single request.
// Bounded to keep D1 read cost predictable (each URL = 2 queries: product lookup + price fetch).
const COMPARE_MAX_URLS = 5;
// History rows fetched per product for compare (fewer than /api/price — we only need stats,
// not the full chart). 60 rows covers ~30 days at 2 scrapes/day, giving a reliable 30-day
// baseline for price_30d_ago (used to detect pre-event inflation during Hot Sale / CyberMonday).
const COMPARE_HISTORY_LIMIT = 60;
const CACHE_COMPARE = "public, max-age=300, stale-while-revalidate=900";
const OBSERVE_DEDUPE_WINDOW_SEC = 600;

interface CompareItem {
  url: string;
  found: boolean;
  product?: Pick<ProductRow, "id" | "title" | "seller" | "image_url">;
  current_price?: number | null;
  price_7d_ago?: number | null;
  real_discount_pct?: number | null;
  inflated?: boolean;
  baseline_age_days?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  price_30d_ago?: number | null;
  last_scraped_at?: number | null;
}

async function lookupOne(target: string, env: Env): Promise<CompareItem> {
  // Tolerant lookup: exact match first, then normalized fallback.
  let product = await env.DB
    .prepare("SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1")
    .bind(target)
    .first<ProductRow>();

  if (!product) {
    let normalized: string | null = null;
    try { normalized = normalizeMLUrl(target); } catch { normalized = null; }
    if (normalized && normalized !== target) {
      product = await env.DB
        .prepare("SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1")
        .bind(normalized)
        .first<ProductRow>();
    }
  }

  if (!product) {
    return { url: target, found: false };
  }

  const history = await env.DB
    .prepare(
      "SELECT price, currency, scraped_at FROM prices WHERE product_id = ?1 ORDER BY scraped_at DESC LIMIT ?2",
    )
    .bind(product.id, COMPARE_HISTORY_LIMIT)
    .all<PriceRow>();

  const rows = history.results ?? [];
  const stats = computeStats(rows);
  const last_scraped_at = rows.length > 0 ? rows[0].scraped_at : null;

  return {
    url: product.url,
    found: true,
    product: {
      id: product.id,
      title: product.title,
      seller: product.seller,
      image_url: product.image_url,
    },
    current_price: stats.current_price,
    price_7d_ago: stats.price_7d_ago,
    real_discount_pct: stats.real_discount_pct,
    inflated: stats.inflated,
    baseline_age_days: stats.baseline_age_days,
    price_min: stats.price_min,
    price_max: stats.price_max,
    price_30d_ago: stats.price_30d_ago,
    last_scraped_at,
  };
}

async function handleCompare(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawUrls = url.searchParams.get("urls") ?? "";
  if (!rawUrls.trim()) {
    return json({ error: "Missing required query parameter: urls (comma-separated list)" }, 400);
  }

  // Split, trim whitespace, deduplicate, cap at COMPARE_MAX_URLS.
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const u of rawUrls.split(",")) {
    const trimmed = u.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    targets.push(trimmed);
    if (targets.length >= COMPARE_MAX_URLS) break;
  }

  if (targets.length === 0) {
    return json({ error: "No valid URLs provided" }, 400);
  }

  // Run all lookups concurrently — each is 2 D1 queries (product + prices).
  // COMPARE_MAX_URLS=5 keeps the fan-out bounded.
  const results = await Promise.all(targets.map((t) => lookupOne(t, env)));

  return json(
    { count: results.length, results },
    200,
    { "Cache-Control": CACHE_COMPARE },
  );
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

async function handleObserve(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const observation = validateObservation((body ?? {}) as Record<string, unknown>);
  if ("error" in observation) {
    return json({ error: observation.error }, 400);
  }

  let product = await env.DB
    .prepare("SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1")
    .bind(observation.url)
    .first<ProductRow>();

  if (!product) {
    await env.DB
      .prepare("INSERT INTO products (url, title, seller, image_url) VALUES (?1, ?2, ?3, ?4)")
      .bind(observation.url, observation.title, observation.seller, observation.image_url)
      .run();
    product = await env.DB
      .prepare("SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1")
      .bind(observation.url)
      .first<ProductRow>();
  } else if (
    (!product.title && observation.title) ||
    (!product.seller && observation.seller) ||
    (!product.image_url && observation.image_url)
  ) {
    await env.DB
      .prepare("UPDATE products SET title = COALESCE(title, ?1), seller = COALESCE(seller, ?2), image_url = COALESCE(image_url, ?3) WHERE id = ?4")
      .bind(observation.title, observation.seller, observation.image_url, product.id)
      .run();
  }

  if (!product) {
    return json({ error: "Product insert failed" }, 500);
  }

  const latest = await env.DB
    .prepare("SELECT price, scraped_at FROM prices WHERE product_id = ?1 ORDER BY scraped_at DESC LIMIT 1")
    .bind(product.id)
    .first<{ price: number; scraped_at: number }>();
  const now = Math.floor(Date.now() / 1000);

  if (
    latest &&
    now - latest.scraped_at <= OBSERVE_DEDUPE_WINDOW_SEC &&
    Math.abs(latest.price - observation.price) < 0.01
  ) {
    return json({
      ok: true,
      inserted: false,
      deduped: true,
      product_id: product.id,
      observed_at: latest.scraped_at,
    });
  }

  await env.DB
    .prepare("INSERT INTO prices (product_id, price, currency, scraped_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(product.id, observation.price, observation.currency, now)
    .run();

  return json({
    ok: true,
    inserted: true,
    deduped: false,
    product_id: product.id,
    observed_at: now,
  });
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

    if (request.method === "GET" && url.pathname === "/api/products") {
      try {
        return await handleProducts(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/trending") {
      try {
        return await handleTrending(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/sellers") {
      try {
        return await handleSellers(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/compare") {
      try {
        return await handleCompare(request, env);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return json({ error: "Internal error", detail: message }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/observe") {
      try {
        return await handleObserve(request, env);
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
