#!/usr/bin/env tsx
/**
 * Backend test harness — pure-function unit tests.
 *
 * Why a hand-rolled harness (no vitest/jest):
 *   - Mirrors `extension/tests/run.js` style (zero-dep, deterministic, fast).
 *   - Cloudflare Worker libs under test are pure TS modules with no D1 / fetch
 *     dependency at the function boundary, so we can import + invoke them
 *     directly via tsx without spinning up Miniflare.
 *   - For the one D1-dependent module (movers.fetchMovers) we provide an
 *     in-memory stub that mimics the D1 prepare/bind/all surface used.
 *
 * Run:
 *   npm run test               (from backend/)
 *   npx tsx tests/run.ts
 *
 * Exit code 0 if every assert passes, 1 if any fails.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { computeStats } from "../src/lib/analytics";
import { extractMLAId, normalizeMLUrl } from "../src/lib/ml-url";
import { parseArgentinePrice, extractPriceFromHTML } from "../src/lib/price-parse";
import { clampLimit, clampMinDrop, fetchMovers } from "../src/lib/movers";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assertEq<T>(actual: T, expected: T, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

// ── ml-url ──────────────────────────────────────────────────────────────────
{
  assertEq(extractMLAId("https://articulo.mercadolibre.com.ar/MLA-1234567890-foo"), "MLA1234567890", "extractMLAId hyphen form");
  assertEq(extractMLAId("https://www.mercadolibre.com.ar/foo/p/MLA28066215"), "MLA28066215", "extractMLAId compact form");
  assertEq(extractMLAId("https://www.mercadolibre.com.ar/foo/p/mla28066215"), "MLA28066215", "extractMLAId case-insensitive");
  assertEq(extractMLAId("https://www.mercadolibre.com.ar/no-id-here/p/foo"), null, "extractMLAId no match returns null");

  assertEq(
    normalizeMLUrl("https://www.MercadoLibre.com.AR/foo/p/MLA123/"),
    "https://www.mercadolibre.com.ar/foo/p/MLA123",
    "normalizeMLUrl lowercases host + strips trailing slash",
  );
  assertEq(
    normalizeMLUrl("https://www.mercadolibre.com.ar/"),
    "https://www.mercadolibre.com.ar/",
    "normalizeMLUrl preserves single-slash root",
  );
  assertEq(
    normalizeMLUrl("https://www.mercadolibre.com.ar/foo/p/MLA999"),
    "https://www.mercadolibre.com.ar/foo/p/MLA999",
    "normalizeMLUrl idempotent on canonical input",
  );
}

// ── price-parse: parseArgentinePrice ────────────────────────────────────────
{
  assertEq(parseArgentinePrice("$ 1.234,56"), 1234.56, "AR fmt: dot thousands + comma decimal");
  assertEq(parseArgentinePrice("12.345"), 12345, "AR fmt: dot thousands (4-digit input, exact 3 after dot)");
  assertEq(parseArgentinePrice("12,5"), 12.5, "comma-only treated as decimal");
  assertEq(parseArgentinePrice("1.5"), 1.5, "ambiguous dot-only, short string → decimal");
  assertEq(parseArgentinePrice("ARS 1.299.000"), 1299000, "thousands sep, multiple dots");
  assertEq(parseArgentinePrice(""), null, "empty string → null");
  assertEq(parseArgentinePrice("   "), null, "whitespace → null");
  assertEq(parseArgentinePrice("---"), null, "garbage → null");
  assertEq(parseArgentinePrice("100"), 100, "plain integer string");
}

// ── price-parse: extractPriceFromHTML ───────────────────────────────────────
{
  const ldHtml = `
    <html><head>
      <script type="application/ld+json">
        {"@type":"Product","offers":{"@type":"Offer","price":"459999.00","priceCurrency":"ARS"}}
      </script>
    </head></html>
  `;
  assertEq(extractPriceFromHTML(ldHtml), 459999, "JSON-LD offers.price string-coerced");

  const metaHtml = `<html><body><meta itemprop="price" content="129000"/></body></html>`;
  assertEq(extractPriceFromHTML(metaHtml), 129000, "microdata meta itemprop=price");

  const stateHtml = `
    <html><body>
      <script>window.__STATE__={"product":{"price":749000,"available":true}}</script>
    </body></html>
  `;
  assertEq(extractPriceFromHTML(stateHtml), 749000, "inlined-state price field");

  const tinyHtml = `<script>{"price":50}</script>`; // below threshold (100)
  assertEq(extractPriceFromHTML(tinyHtml), null, "inlined state ignores tiny price values");

  assertEq(extractPriceFromHTML(""), null, "empty html → null");
  assertEq(extractPriceFromHTML("<html><body>no price here</body></html>"), null, "no price in HTML → null");
}

// ── analytics: computeStats ─────────────────────────────────────────────────
{
  const NOW = 1_700_000_000; // fixed reference timestamp (UTC)
  const DAY = 86400;

  // Empty → null fields
  assertEq(
    computeStats([], NOW),
    { current_price: null, price_7d_ago: null, real_discount_pct: null, inflated: false },
    "computeStats empty history",
  );

  // Single recent row → no baseline
  const single = computeStats(
    [{ price: 100, currency: "ARS", scraped_at: NOW }],
    NOW,
  );
  assertEq(single.current_price, 100, "computeStats single recent row → current_price");
  assertEq(single.price_7d_ago, null, "computeStats single recent row → no baseline");
  assertEq(single.real_discount_pct, null, "computeStats single recent row → no pct");
  assertEq(single.inflated, false, "computeStats single recent row → not inflated");

  // Real discount: baseline 1000, current 800 → 20% off, not inflated
  const discount = computeStats(
    [
      { price: 800, currency: "ARS", scraped_at: NOW },
      { price: 1000, currency: "ARS", scraped_at: NOW - 7 * DAY },
    ],
    NOW,
  );
  assertEq(discount.current_price, 800, "discount: current=800");
  assertEq(discount.price_7d_ago, 1000, "discount: baseline=1000");
  assertEq(discount.real_discount_pct, 20.0, "discount: 20% real_discount_pct");
  assertEq(discount.inflated, false, "discount: not inflated");

  // Inflated: baseline 1000, current 1200 → -20% pct, inflated=true
  const inflated = computeStats(
    [
      { price: 1200, currency: "ARS", scraped_at: NOW },
      { price: 1000, currency: "ARS", scraped_at: NOW - 7 * DAY },
    ],
    NOW,
  );
  assertEq(inflated.real_discount_pct, -20.0, "inflated: -20% pct");
  assertEq(inflated.inflated, true, "inflated: inflated=true");

  // Picks closest-to-7-days-ago row when several historical rows exist
  const multi = computeStats(
    [
      { price: 800, currency: "ARS", scraped_at: NOW },
      { price: 950, currency: "ARS", scraped_at: NOW - 3 * DAY },
      { price: 1000, currency: "ARS", scraped_at: NOW - 7 * DAY },
      { price: 1100, currency: "ARS", scraped_at: NOW - 30 * DAY },
    ],
    NOW,
  );
  assertEq(multi.price_7d_ago, 1000, "multi: picks 7d-ago row by min |delta|");
  assertEq(multi.real_discount_pct, 20.0, "multi: 20% real_discount_pct");
}

// ── movers: clamp helpers ───────────────────────────────────────────────────
{
  assertEq(clampLimit("20"), 20, "clampLimit numeric string");
  assertEq(clampLimit("5"), 5, "clampLimit small numeric string");
  assertEq(clampLimit("999"), 100, "clampLimit caps at MAX_LIMIT");
  assertEq(clampLimit("-3"), 20, "clampLimit negative → DEFAULT_LIMIT");
  assertEq(clampLimit("abc"), 20, "clampLimit garbage → DEFAULT_LIMIT");
  assertEq(clampLimit(null), 20, "clampLimit null → DEFAULT_LIMIT");
  assertEq(clampLimit("0"), 20, "clampLimit zero → DEFAULT_LIMIT (n<=0 branch)");
  assertEq(clampLimit("1.7"), 1, "clampLimit floors floats");

  assertEq(clampMinDrop("15"), 15, "clampMinDrop numeric string");
  assertEq(clampMinDrop("-50"), -50, "clampMinDrop accepts negatives");
  assertEq(clampMinDrop("250"), 99, "clampMinDrop caps at 99");
  assertEq(clampMinDrop("abc"), 10, "clampMinDrop garbage → DEFAULT_MIN_DROP_PCT");
  assertEq(clampMinDrop(null), 10, "clampMinDrop null → DEFAULT_MIN_DROP_PCT");
  assertEq(clampMinDrop(undefined), 10, "clampMinDrop undefined → DEFAULT_MIN_DROP_PCT");
  assertEq(clampMinDrop(""), 10, "clampMinDrop empty string → DEFAULT_MIN_DROP_PCT");
  assertEq(clampMinDrop("0"), 0, "clampMinDrop explicit 0 string → 0 (caller asked)");
  assertEq(clampMinDrop("99"), 99, "clampMinDrop 99 boundary → 99");
  assertEq(clampMinDrop("99.5"), 99, "clampMinDrop above 99 → caps at 99");
}

// ── movers: fetchMovers (in-memory D1 stub) ─────────────────────────────────
//
// The D1 stub captures the bound parameters and returns a fixed result set
// regardless of the SQL string — fetchMovers only inspects the rows shape.
// This lets us validate:
//   - the JS-side post-filtering by min_drop_pct
//   - the JS-side pct-desc re-sort (vs SQL's absolute-drop ordering)
//   - the limit slice
//   - the discount math
async function main(): Promise<void> {
  type Row = {
    product_id: number;
    url: string;
    title: string | null;
    seller: string | null;
    image_url: string | null;
    current_price: number;
    current_scraped_at: number;
    baseline_price: number;
    baseline_scraped_at: number;
  };
  const NOW = 1_700_000_000;
  const DAY = 86400;
  const rows: Row[] = [
    {
      product_id: 1, url: "https://ml.com/p/MLA1", title: "expensive thing", seller: "S", image_url: null,
      current_price: 950000, current_scraped_at: NOW,
      baseline_price: 1000000, baseline_scraped_at: NOW - 7 * DAY,
    },
    {
      product_id: 2, url: "https://ml.com/p/MLA2", title: "cheap deal", seller: "S", image_url: null,
      current_price: 400, current_scraped_at: NOW,
      baseline_price: 1000, baseline_scraped_at: NOW - 7 * DAY,
    },
    {
      product_id: 3, url: "https://ml.com/p/MLA3", title: "mid deal", seller: null, image_url: null,
      current_price: 7500, current_scraped_at: NOW,
      baseline_price: 10000, baseline_scraped_at: NOW - 6 * DAY,
    },
    {
      product_id: 4, url: "https://ml.com/p/MLA4", title: "tiny mover", seller: null, image_url: null,
      current_price: 9600, current_scraped_at: NOW,
      baseline_price: 10000, baseline_scraped_at: NOW - 8 * DAY,
    },
  ];

  const stubEnv = (data: Row[]) => ({
    DB: {
      prepare: (_sql: string) => ({
        bind: (..._args: unknown[]) => ({
          all: async <_T>() => ({ results: data }),
        }),
      }),
    } as any,
  });

  // Default min_drop=10 → only 60% and 25% pass; 5% (product 1) and 4% (product 4)
  // are below the threshold. Output ordered by pct desc.
  const defaultMovers = await fetchMovers(stubEnv(rows), { nowSec: NOW });
  assertEq(defaultMovers.length, 2, "fetchMovers default: 2 rows after min_drop=10 filter");
  assertEq(defaultMovers.map((m) => m.product_id), [2, 3], "fetchMovers default: pct-desc order [2,3]");
  assertEq(defaultMovers[0].real_discount_pct, 60, "fetchMovers default: top pct rounding (60)");
  assertEq(defaultMovers[1].real_discount_pct, 25, "fetchMovers default: second pct rounding (25)");
  assertEq(defaultMovers[1].baseline_age_days, 6, "fetchMovers: baseline_age_days from scraped_at delta");

  // Custom min_drop=20 → still 60% and 25% pass.
  const filtered = await fetchMovers(stubEnv(rows), { nowSec: NOW, minDropPct: 20 });
  assertEq(filtered.length, 2, "fetchMovers min_drop=20: 2 rows");
  assertEq(filtered.map((m) => m.product_id), [2, 3], "fetchMovers min_drop=20: [2,3]");

  // Custom min_drop=30 → only 60% passes.
  const tightOnly = await fetchMovers(stubEnv(rows), { nowSec: NOW, minDropPct: 30 });
  assertEq(tightOnly.length, 1, "fetchMovers min_drop=30: 1 row");
  assertEq(tightOnly[0].product_id, 2, "fetchMovers min_drop=30: only top mover");

  // Limit slicing: limit=1 should cut to top mover only.
  const limited = await fetchMovers(stubEnv(rows), { nowSec: NOW, limit: 1 });
  assertEq(limited.length, 1, "fetchMovers limit=1: single row");
  assertEq(limited[0].product_id, 2, "fetchMovers limit=1: top mover wins");

  // Negative min_drop = "show me everything" semantics.
  const allMovers = await fetchMovers(stubEnv(rows), { nowSec: NOW, minDropPct: -100 });
  assertEq(allMovers.length, 4, "fetchMovers min_drop=-100: 4 rows (no filter)");
  // pct-desc order: 60, 25, 5, 4 → product ids 2, 3, 1, 4
  assertEq(
    allMovers.map((m) => m.product_id),
    [2, 3, 1, 4],
    "fetchMovers min_drop=-100: pct-desc order across full set",
  );

  // Empty result set.
  const empty = await fetchMovers(stubEnv([]), { nowSec: NOW });
  assertEq(empty.length, 0, "fetchMovers empty: 0 rows");

  // Drop rows with non-numeric or zero baseline (defensive): should be skipped.
  const bad: Row[] = [
    { ...rows[2], baseline_price: 0, product_id: 99 },
  ];
  const skipBad = await fetchMovers(stubEnv(bad), { nowSec: NOW, minDropPct: -100 });
  assertEq(skipBad.length, 0, "fetchMovers: zero baseline_price rows are skipped");
}

main()
  .then(() => {
    if (failed === 0) {
      process.stdout.write(`\n[backend tests] ${passed} passed, 0 failed.\n`);
      process.exit(0);
    } else {
      process.stdout.write(`\n[backend tests] ${passed} passed, ${failed} FAILED:\n`);
      for (const f of failures) process.stdout.write(`  - ${f}\n`);
      process.exit(1);
    }
  })
  .catch((err) => {
    process.stderr.write(`[backend tests] uncaught: ${String(err)}\n`);
    process.exit(1);
  });
