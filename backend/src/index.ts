/**
 * precio-real API — Cloudflare Worker
 *
 * Routes:
 *   GET  /api/health             → { ok: true }
 *   GET  /api/price?url=<url>    → { product, current_price, price_7d_ago, real_discount_pct, inflated, history }
 *   POST /api/scrape/wayback?url=<url> → { inserted, scanned, failed }
 *   POST /api/scrape/run         → manual trigger of the scheduled scraper (debug/seed)
 *   *                             → 404
 *
 * Cron:
 *   "0 *\/6 * * *" → runScheduledScrape (top 500 popular MLA products, issue #11)
 */

import type { ProductRow, PriceRow } from "./types";
import { computeStats } from "./lib/analytics";
import { extractMLAId } from "./lib/ml-url";
import { backfillWaybackHistory } from "./scrapers/wayback";
import { runScheduledScrape } from "./scrapers/scheduled";

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

  const product = await env.DB
    .prepare("SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1")
    .bind(target)
    .first<ProductRow>();

  if (!product) {
    return json({ error: "Product not found", url: target }, 404);
  }

  const history = await env.DB
    .prepare(
      "SELECT price, currency, scraped_at FROM prices WHERE product_id = ?1 ORDER BY scraped_at DESC",
    )
    .bind(product.id)
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

  return json({
    product,
    ...stats,
    history: rows,
  });
}

async function handleWaybackScrape(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return json({ error: "Missing required query parameter: url" }, 400);
  }

  const product = await env.DB
    .prepare("SELECT id, url, title, seller, image_url, created_at FROM products WHERE url = ?1")
    .bind(target)
    .first<ProductRow>();

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
