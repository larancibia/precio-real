#!/usr/bin/env node
// Harness mínimo de tests Node-puro para las funciones puras de helpers.js.
// No usa jsdom para mantener la cero-dep filosofía del proyecto: stubeamos
// solo la superficie que helpers.js consume al cargar (window, document,
// location, sessionStorage, localStorage, URLSearchParams). Cualquier test
// que necesite DOM real se puede sumar después con un shim por test.
//
// Uso:
//   node extension/tests/run.js
// Sale con código 0 si todo pasa, 1 si falla algún assert.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;
const failures = [];

function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
  }
}

// ── Mini DOM/window shim para cargar helpers.js + retailers.js ──────────────
function makeContext({ hostname = 'www.mercadolibre.com.ar', pathname = '/p/MLA123456', search = '' } = {}) {
  const fakeStorage = () => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      clear: () => m.clear(),
    };
  };
  const fakeDocument = {
    // Devuelve null para todas las queries: helpers.js maneja eso.
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const fakeWindow = {
    // helpers.js hace `(window.PrecioReal = window.PrecioReal || {})`.
    PrecioReal: undefined,
    PrecioRealConfig: { API_BASE: 'http://localhost:8787' },
  };
  const fakeLocation = {
    hostname,
    pathname,
    search,
    href: `https://${hostname}${pathname}${search}`,
  };
  const ctx = {
    window: fakeWindow,
    document: fakeDocument,
    location: fakeLocation,
    sessionStorage: fakeStorage(),
    localStorage: fakeStorage(),
    URL,
    URLSearchParams,
    console,
    Number,
    Math,
    Array,
    Object,
    JSON,
    String,
    Boolean,
    setTimeout,
    clearTimeout,
  };
  // helpers.js usa `window.X = ...` y luego se referencia como `X` (no, siempre por window).
  // Pero también algunos paths usan `location.x` directo (sin window) → expongo location global.
  vm.createContext(ctx);
  return ctx;
}

function loadInto(ctx, file) {
  const src = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  vm.runInContext(src, ctx, { filename: file });
}

// ── Cargar utils ────────────────────────────────────────────────────────────
function freshNs(opts) {
  const ctx = makeContext(opts);
  loadInto(ctx, 'utils/retailers.js');
  loadInto(ctx, 'utils/helpers.js');
  return ctx.window.PrecioReal;
}

// ── Tests ───────────────────────────────────────────────────────────────────
console.log('[precio-real tests] starting…');

// detectSite — todos los retailers del manifest deben ser detectables.
{
  const PR = freshNs();
  const cases = [
    ['articulo.mercadolibre.com.ar', 'mercadolibre'],
    ['www.mercadolibre.com.ar', 'mercadolibre'],
    ['www.fravega.com', 'fravega'],
    ['www.garbarino.com', 'garbarino'],
    ['www.falabella.com.ar', 'falabella'],
    ['www.carrefour.com.ar', 'carrefour'],
    ['www.cotodigital3.com.ar', 'coto'],
    ['www.naldo.com.ar', 'naldo'],
    ['www.musimundo.com', 'musimundo'],
    ['www.cetrogar.com.ar', 'cetrogar'],
    ['www.megatone.net', 'megatone'],
    ['diaonline.supermercadosdia.com.ar', 'dia'],
    ['www.jumbo.com.ar', 'jumbo'],
    ['www.disco.com.ar', 'disco'],
    ['www.sodimac.com.ar', 'sodimac'],
    ['www.easy.com.ar', 'easy'],
    ['www.hendel.com.ar', 'hendel'],
    ['www.rodo.com.ar', 'rodo'],
    ['www.amazon.com', null],
    ['', null],
  ];
  for (const [host, expected] of cases) {
    assertEq(PR.detectSite(host), expected, `detectSite("${host}")`);
  }
}

// normalizePrice — formatos AR, US, schema.org.
{
  const PR = freshNs();
  const cases = [
    ['$ 1.234.567,89', null, 1234567.89],     // AR clásico
    ['1.234.567,89', null, 1234567.89],
    ['$1.234,56', null, 1234.56],
    ['1234,56', null, 1234.56],                // AR sin separador miles
    ['1234.56', null, 1234.56],                // schema.org / US: 2 dígitos detrás del punto = decimal
    ['1234', null, 1234],
    ['1.234', null, 1234],                     // AR sin decimales: 1.234 == 1234 (3 dígitos detrás)
    ['1,234,567.89', null, 1234567.89],        // US clásico
    ['1234.56', { forceUSDecimal: true }, 1234.56],
    ['1,234.56', { forceUSDecimal: true }, 1234.56],
    ['', null, null],
    [null, null, null],
    ['abc', null, null],
    ['$', null, null],
    ['-', null, null],
  ];
  for (const [raw, opts, expected] of cases) {
    assertEq(PR.normalizePrice(raw, opts), expected, `normalizePrice(${JSON.stringify(raw)}, ${JSON.stringify(opts)})`);
  }
}

// canonicalUrl — pathname normalizado, host lower, sin query/hash.
{
  const PR = freshNs();
  assertEq(
    PR.canonicalUrl('https://Articulo.MercadoLibre.com.ar/MLA-123?x=1#frag'),
    'https://articulo.mercadolibre.com.ar/MLA-123',
    'canonicalUrl drops query+hash, lowercases host'
  );
  assertEq(
    PR.canonicalUrl('not a url'),
    'not a url',
    'canonicalUrl returns input on parse error'
  );
}

// isPriceSane — rechaza ceros, negativos, infinitos, > 1e9.
{
  const PR = freshNs();
  assertEq(PR.isPriceSane(0), false, 'isPriceSane(0)');
  assertEq(PR.isPriceSane(0.5), false, 'isPriceSane(0.5)');
  assertEq(PR.isPriceSane(1), true, 'isPriceSane(1)');
  assertEq(PR.isPriceSane(1500), true, 'isPriceSane(1500)');
  assertEq(PR.isPriceSane(1e9), true, 'isPriceSane(1e9 exact, allowed)');
  assertEq(PR.isPriceSane(1e9 + 1), false, 'isPriceSane(>1e9)');
  assertEq(PR.isPriceSane(NaN), false, 'isPriceSane(NaN)');
  assertEq(PR.isPriceSane(-1), false, 'isPriceSane(-1)');
  assertEq(PR.isPriceSane(Infinity), false, 'isPriceSane(Infinity)');
}

// urlLooksLikeListing — heurísticas de URL para descartar listados.
{
  const PR = freshNs();
  assertEq(PR.urlLooksLikeListing('mercadolibre', '/listado/celulares'), true, 'ML /listado');
  assertEq(PR.urlLooksLikeListing('mercadolibre', '/c/electronica'), true, 'ML /c/');
  assertEq(PR.urlLooksLikeListing('mercadolibre', '/jm/search?as_word=foo'), true, 'ML /jm/search');
  assertEq(PR.urlLooksLikeListing(null, '/categoria/heladeras'), true, '/categoria/');
  assertEq(PR.urlLooksLikeListing(null, '/ofertas/hot-sale'), true, '/ofertas');
  assertEq(PR.urlLooksLikeListing(null, '/marca/samsung'), true, '/marca');
  assertEq(PR.urlLooksLikeListing(null, '/p/MLA123456'), false, '/p/<id> is product');
  assertEq(PR.urlLooksLikeListing(null, '/producto/heladera-xyz'), false, '/producto is product');
}

// fallbackClassify — clasificación con histórico sintético.
{
  const PR = freshNs();
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  // Caso REAL: precio actual mucho más bajo que mediana 7-30 días.
  const histReal = [];
  for (let i = 0; i < 25; i++) {
    histReal.push({ scraped_at: now - (i + 8) * DAY, price: 10000 });
  }
  for (let i = 0; i < 5; i++) {
    histReal.push({ scraped_at: now - i * DAY, price: 8000 });
  }
  const v1 = PR.fallbackClassify(8000, histReal);
  assertEq(v1.kind, 'real', 'fallbackClassify: descuento real');

  // Caso INFLATED: precio anterior estable, subió la última semana.
  const histInflated = [];
  for (let i = 0; i < 25; i++) {
    histInflated.push({ scraped_at: now - (i + 8) * DAY, price: 10000 });
  }
  for (let i = 0; i < 5; i++) {
    histInflated.push({ scraped_at: now - i * DAY, price: 12000 });
  }
  const v2 = PR.fallbackClassify(11500, histInflated);
  assertEq(v2.kind, 'inflated', 'fallbackClassify: precio inflado');

  // Caso UNKNOWN: histórico insuficiente.
  const v3 = PR.fallbackClassify(8000, [{ scraped_at: now, price: 8000 }]);
  assertEq(v3.kind, 'unknown', 'fallbackClassify: histórico insuficiente');

  // Caso UNKNOWN: 5+ puntos pero todos en últimos 7 días (sin baseline).
  const histNoBaseline = [];
  for (let i = 0; i < 6; i++) {
    histNoBaseline.push({ scraped_at: now - i * DAY, price: 8000 });
  }
  const v4 = PR.fallbackClassify(8000, histNoBaseline);
  assertEq(v4.kind, 'unknown', 'fallbackClassify: sin baseline');
}

// formatDiscount — sanity.
{
  const PR = freshNs();
  assertEq(PR.formatDiscount(12.345), '+12.3%', 'formatDiscount positive');
  assertEq(PR.formatDiscount(-4), '-4.0%', 'formatDiscount negative');
  assertEq(PR.formatDiscount(null), '—', 'formatDiscount null');
  assertEq(PR.formatDiscount(NaN), '—', 'formatDiscount NaN');
}

// productKey — incluye sku/variation cuando hay query, sin DOM cae al canonical.
{
  const PR = freshNs();
  // Sin query ni DOM: productKey === canonical.
  const k1 = PR.productKey('https://articulo.mercadolibre.com.ar/MLA-123');
  assertEq(k1, 'https://articulo.mercadolibre.com.ar/MLA-123', 'productKey base');
  // Con query variation.
  const k2 = PR.productKey('https://articulo.mercadolibre.com.ar/MLA-123?variation=4242');
  assert(k2.includes('variation=4242'), 'productKey incluye variation query');
}

// RETAILERS coverage — los 17 retailers del manifest.json.
{
  const PR = freshNs();
  const expected = [
    'mercadolibre', 'fravega', 'garbarino', 'falabella', 'carrefour', 'coto',
    'naldo', 'musimundo', 'cetrogar', 'megatone', 'dia', 'jumbo', 'disco',
    'sodimac', 'easy', 'hendel', 'rodo',
  ];
  for (const k of expected) {
    assert(PR.RETAILERS && PR.RETAILERS[k], `RETAILERS["${k}"] exists`);
    assert(
      Array.isArray(PR.RETAILERS[k].selectors) && PR.RETAILERS[k].selectors.length > 0,
      `RETAILERS["${k}"].selectors not empty`
    );
  }
}

// ── Resultado ───────────────────────────────────────────────────────────────
console.log(`[precio-real tests] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error('  - ' + f + '\n');
  process.exit(1);
}
process.exit(0);
