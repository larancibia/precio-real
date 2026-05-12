/**
 * Wayback Machine scraper for MercadoLibre product price history.
 * Read-only access to web.archive.org (CDX API + raw snapshot HTML via id_ flag).
 * Used to backfill historical prices into the prices table.
 */

import type { WaybackSnapshot } from "../types";
import { normalizeMLUrl } from "../lib/ml-url";
import { extractPriceFromHTML } from "../lib/price-parse";

const USER_AGENT = "precio-real/0.1 (+https://precioreal.ar)";
const CDX_TIMEOUT_MS = 10_000;
const SNAPSHOT_TIMEOUT_MS = 15_000;

export interface FetchSnapshotsOpts {
  fromDays?: number;
  maxSnapshots?: number;
  throttleMs?: number;
}

export interface BackfillResult {
  inserted: number;
  scanned: number;
  failed: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Exported for unit tests (tests/run.ts). Pure helpers, no I/O.
export function formatYYYYMMDD(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}${m}${d}`;
}

// Convert "YYYYMMDDHHMMSS" → unix seconds (UTC). Returns null if malformed.
// Exported for unit tests (tests/run.ts).
export function wayback14ToUnix(ts14: string): number | null {
  if (!/^\d{14}$/.test(ts14)) return null;
  const year = Number(ts14.slice(0, 4));
  const month = Number(ts14.slice(4, 6));
  const day = Number(ts14.slice(6, 8));
  const hour = Number(ts14.slice(8, 10));
  const minute = Number(ts14.slice(10, 12));
  const second = Number(ts14.slice(12, 14));
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * Decides whether to trigger a Wayback backfill for a product.
 * Exported for unit tests (tests/run.ts).
 *
 * Rules:
 *  - 0 rows   → true  (no data at all, critical to backfill)
 *  - ≥5 rows  → false (sufficient history, skip)
 *  - 1-4 rows → true only if the newest row is stale (> 12 hours old)
 *
 * The 12-hour staleness check prevents 50 concurrent Hot-Sale requests
 * from all firing parallel Wayback scrapes for the same sparse product.
 */
export function shouldTriggerWayback(
  rows: { scraped_at: number }[],
  nowSec: number,
): boolean {
  if (rows.length === 0) return true;
  if (rows.length >= 5) return false;
  // rows is ordered DESC by scraped_at, so rows[0] is the newest
  const newestSec = rows[0].scraped_at;
  return nowSec - newestSec > 43200; // 12 hours
}

// Evenly sample n elements down to k while preserving order; dedupe by reference index.
// Exported for unit tests (tests/run.ts).
export function evenSample<T>(arr: T[], k: number): T[] {
  if (arr.length <= k || k <= 0) return arr.slice();
  if (k === 1) return [arr[0]];
  const seen = new Set<number>();
  const picked: T[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i * (arr.length - 1)) / (k - 1));
    if (!seen.has(idx)) {
      seen.add(idx);
      picked.push(arr[idx]);
    }
  }
  return picked;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json,text/html;q=0.9,*/*;q=0.5",
      },
      signal: controller.signal,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[wayback] fetch error url=${url} err=${message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Parse CDX JSON: first row = column headers, subsequent rows = data. Returns 14-char timestamp strings.
// Exported for unit tests (tests/run.ts).
export function parseCdxResponse(payload: unknown): string[] {
  if (!Array.isArray(payload) || payload.length === 0) return [];
  const out: string[] = [];
  // Skip header row at index 0.
  for (let i = 1; i < payload.length; i++) {
    const row = payload[i];
    if (!Array.isArray(row) || row.length === 0) continue;
    const ts = row[0];
    if (typeof ts === "string" && /^\d{14}$/.test(ts)) {
      out.push(ts);
    }
  }
  return out;
}

export async function fetchWaybackSnapshots(
  url: string,
  opts: FetchSnapshotsOpts = {},
): Promise<WaybackSnapshot[]> {
  const fromDays = opts.fromDays ?? 365;
  const maxSnapshots = opts.maxSnapshots ?? 12;
  const throttleMs = opts.throttleMs ?? 1500;

  const now = new Date();
  const from = new Date(now.getTime() - fromDays * 86_400 * 1000);
  const fromStr = formatYYYYMMDD(from);
  const toStr = formatYYYYMMDD(now);

  const cdxUrl =
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}` +
    `&output=json&fl=timestamp&filter=statuscode:200` +
    `&from=${fromStr}&to=${toStr}&collapse=timestamp:8`;

  const cdxRes = await fetchWithTimeout(cdxUrl, CDX_TIMEOUT_MS);
  if (!cdxRes || !cdxRes.ok) {
    if (cdxRes) {
      console.warn(`[wayback] CDX non-2xx status=${cdxRes.status} url=${url}`);
    }
    return [];
  }

  let payload: unknown;
  try {
    const text = await cdxRes.text();
    if (!text || !text.trim()) return [];
    payload = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[wayback] CDX parse error url=${url} err=${message}`);
    return [];
  }

  const ts14List = parseCdxResponse(payload);
  if (ts14List.length === 0) return [];

  // Pair each 14-char ts with its unix-seconds version; sort ascending; sample.
  const paired = ts14List
    .map((ts14) => ({ ts14, unix: wayback14ToUnix(ts14) }))
    .filter((p): p is { ts14: string; unix: number } => p.unix !== null)
    .sort((a, b) => a.unix - b.unix);

  const sampled = evenSample(paired, maxSnapshots);

  const results: WaybackSnapshot[] = [];
  for (let i = 0; i < sampled.length; i++) {
    if (i > 0) {
      await sleep(throttleMs);
    }
    const { ts14, unix } = sampled[i];
    const snapshotUrl = `https://web.archive.org/web/${ts14}id_/${url}`;
    const res = await fetchWithTimeout(snapshotUrl, SNAPSHOT_TIMEOUT_MS);
    if (!res || !res.ok) {
      if (res) {
        console.warn(
          `[wayback] snapshot non-2xx status=${res.status} ts=${ts14} url=${url}`,
        );
      }
      continue;
    }
    let html: string;
    try {
      html = await res.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[wayback] snapshot body read failed ts=${ts14} err=${message}`);
      continue;
    }
    const price = extractPriceFromHTML(html);
    if (price != null && price > 0) {
      results.push({ timestamp: unix, price });
    }
  }

  results.sort((a, b) => a.timestamp - b.timestamp);
  return results;
}

interface DupeRow {
  id: number;
}

export async function backfillWaybackHistory(
  productId: number,
  url: string,
  env: { DB: D1Database },
  opts: FetchSnapshotsOpts = {},
): Promise<BackfillResult> {
  const normalizedUrl = normalizeMLUrl(url);
  const snapshots = await fetchWaybackSnapshots(normalizedUrl, opts);

  const scanned = snapshots.length;
  let inserted = 0;
  let failed = 0;

  if (scanned === 0) {
    console.warn(`[wayback] no snapshots for url=${normalizedUrl}`);
    return { inserted: 0, scanned: 0, failed: 0 };
  }

  for (const snap of snapshots) {
    try {
      const lo = snap.timestamp - 3600;
      const hi = snap.timestamp + 3600;
      const dupe = await env.DB
        .prepare(
          "SELECT id FROM prices WHERE product_id = ?1 AND scraped_at BETWEEN ?2 AND ?3 LIMIT 1",
        )
        .bind(productId, lo, hi)
        .first<DupeRow>();
      if (dupe) continue;

      await env.DB
        .prepare(
          "INSERT INTO prices (product_id, price, currency, scraped_at) VALUES (?1, ?2, 'ARS', ?3)",
        )
        .bind(productId, snap.price, snap.timestamp)
        .run();
      inserted += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[wayback] insert failed product_id=${productId} ts=${snap.timestamp} err=${message}`,
      );
    }
  }

  console.log(
    `[wayback] backfill product_id=${productId} scanned=${scanned} inserted=${inserted} failed=${failed}`,
  );
  return { inserted, scanned, failed };
}
