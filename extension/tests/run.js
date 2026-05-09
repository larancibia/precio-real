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

// ── Mini-DOM nodos sintéticos para testear helpers que esperan elementos ────
// Construimos objetos que simulan la interfaz de Element que usan
// isStrikethroughPrice/isInstallmentPrice: tagName, className, getAttribute,
// parentElement, textContent, closest. No necesitan todo el DOM, solo lo
// que el código realmente toca.
function fakeEl({ tag = 'span', className = '', text = '', attrs = {}, parent = null } = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    className,
    textContent: text,
    parentElement: parent,
    _attrs: { ...attrs },
    getAttribute(name) {
      if (name === 'class') return this.className || null;
      return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
    },
  };
  // closest: walk up parentElement and check tag/class via simple matching.
  // Soportamos solo selectores de tag o `.class`. Suficiente para los tests.
  node.closest = function (sel) {
    let cur = this;
    while (cur) {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        if ((cur.className || '').split(/\s+/).includes(cls)) return cur;
      } else if (cur.tagName && cur.tagName.toLowerCase() === sel.toLowerCase()) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  };
  return node;
}

// isStrikethroughPrice — patrones AR + camelCase VTEX/Magento/Shopify.
{
  const PR = freshNs();
  // Wrapper directo <s>/<del>/<strike>.
  assertEq(PR.isStrikethroughPrice(fakeEl({ tag: 's' })), true, 'isStrikethroughPrice <s>');
  assertEq(PR.isStrikethroughPrice(fakeEl({ tag: 'del' })), true, 'isStrikethroughPrice <del>');
  assertEq(PR.isStrikethroughPrice(fakeEl({ tag: 'strike' })), true, 'isStrikethroughPrice <strike>');
  // Clases típicas (kebab + camel).
  const cases = [
    'old-price', 'oldPrice', 'list-price', 'listPrice', 'regular-price', 'regularPrice',
    'was-price', 'wasPrice', 'original-price', 'originalPrice', 'compareAt', 'compare-at',
    'productPriceOld', 'priceOld', 'txt-strike', 'crossedOut', 'reference-price',
    'referencePrice', 'precio-anterior', 'precioTachado', 'antes', 'tachado', 'line-through',
    'price--compare-at', 'from-price', 'fromPrice',
  ];
  for (const c of cases) {
    assertEq(
      PR.isStrikethroughPrice(fakeEl({ tag: 'span', className: c })),
      true,
      `isStrikethroughPrice class "${c}"`
    );
  }
  // Falsos negativos esperados (clases que NO deberían matchear).
  const safe = ['price', 'product-price', 'sale-price', 'final-price', 'andes-money-amount'];
  for (const c of safe) {
    assertEq(
      PR.isStrikethroughPrice(fakeEl({ tag: 'span', className: c })),
      false,
      `isStrikethroughPrice class "${c}" (should not match)`
    );
  }
  // Inline style con line-through.
  assertEq(
    PR.isStrikethroughPrice(fakeEl({ tag: 'span', attrs: { style: 'text-decoration: line-through;' } })),
    true,
    'isStrikethroughPrice inline style'
  );
  // Ancestro tachado.
  const parent = fakeEl({ tag: 'div', className: 'oldPrice' });
  const child = fakeEl({ tag: 'span', className: 'amount', parent });
  assertEq(PR.isStrikethroughPrice(child), true, 'isStrikethroughPrice parent oldPrice');
}

// isInstallmentPrice — texto + ancestros.
{
  const PR = freshNs();
  // Texto del propio elemento (cuotas).
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '12 cuotas de $1.234,56' })),
    true,
    'isInstallmentPrice "12 cuotas de"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Cuotas sin interés' })),
    true,
    'isInstallmentPrice "Cuotas sin interés"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '$1.234 x 12 cuotas' })),
    true,
    'isInstallmentPrice "$X x 12 cuotas"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '$1.234 por mes' })),
    true,
    'isInstallmentPrice "por mes"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '$1.234 al mes' })),
    true,
    'isInstallmentPrice "al mes"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '12x $1.234' })),
    true,
    'isInstallmentPrice "12x $1.234"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Hasta en 12 cuotas' })),
    true,
    'isInstallmentPrice "Hasta en 12 cuotas"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '6 cuotas mensuales' })),
    true,
    'isInstallmentPrice "cuotas mensuales"'
  );
  // Ancestro con marker.
  const inst = fakeEl({ tag: 'div', className: 'installment-row' });
  const price = fakeEl({ tag: 'span', text: '$1.234', parent: inst });
  assertEq(PR.isInstallmentPrice(price), true, 'isInstallmentPrice ancestor "installment"');
  const promo = fakeEl({ tag: 'div', className: 'promo-bancaria' });
  const price2 = fakeEl({ tag: 'span', text: '$1.234', parent: promo });
  assertEq(PR.isInstallmentPrice(price2), true, 'isInstallmentPrice ancestor "promo-bancaria"');
  // Ancestro con data-testid="ahora-12" (CFK Argentina).
  const ahora12 = fakeEl({ tag: 'div', attrs: { 'data-testid': 'ahora-12-row' } });
  const price3 = fakeEl({ tag: 'span', text: '$1.234', parent: ahora12 });
  assertEq(PR.isInstallmentPrice(price3), true, 'isInstallmentPrice ancestor data-testid ahora-12');
  // Texto normal de precio: no debería matchear.
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '$1.234,56' })),
    false,
    'isInstallmentPrice plain price'
  );
}

// isHiddenNode — display:none, visibility:hidden, aria-hidden=true.
{
  const PR = freshNs();
  // meta nunca es "hidden" (siempre invisible pero válido).
  assertEq(PR.isHiddenNode(fakeEl({ tag: 'meta' })), false, 'isHiddenNode meta tag');
  // aria-hidden=true.
  assertEq(
    PR.isHiddenNode(fakeEl({ tag: 'span', attrs: { 'aria-hidden': 'true' } })),
    true,
    'isHiddenNode aria-hidden=true'
  );
  // aria-hidden=false explícito.
  assertEq(
    PR.isHiddenNode(fakeEl({ tag: 'span', attrs: { 'aria-hidden': 'false' } })),
    false,
    'isHiddenNode aria-hidden=false'
  );
  // Inline display:none.
  assertEq(
    PR.isHiddenNode(fakeEl({ tag: 'span', attrs: { style: 'display: none;' } })),
    true,
    'isHiddenNode display:none inline'
  );
  // Inline visibility:hidden.
  assertEq(
    PR.isHiddenNode(fakeEl({ tag: 'span', attrs: { style: 'visibility: hidden' } })),
    true,
    'isHiddenNode visibility:hidden inline'
  );
  // Sin atributos: visible.
  assertEq(PR.isHiddenNode(fakeEl({ tag: 'span' })), false, 'isHiddenNode default');
  // Null/undefined: defensivo.
  assertEq(PR.isHiddenNode(null), false, 'isHiddenNode null');
  assertEq(PR.isHiddenNode(undefined), false, 'isHiddenNode undefined');
}

// walkLdJson via API pública: cargamos un script ld+json sintético y validamos
// que tryLdJsonPrice() aplica las reglas nuevas (availability, @graph, lowPrice
// como fallback).
function makeContextWithLd(ldNodes) {
  // Re-uso makeContext pero inyecto un querySelectorAll que devuelve scripts
  // ld+json sintéticos.
  const ctx = makeContext();
  ctx.document.querySelectorAll = (sel) => {
    if (sel === 'script[type="application/ld+json"]') {
      return ldNodes.map((n) => ({ textContent: typeof n === 'string' ? n : JSON.stringify(n) }));
    }
    return [];
  };
  ctx.document.querySelector = () => null;
  loadInto(ctx, 'utils/retailers.js');
  loadInto(ctx, 'utils/helpers.js');
  return ctx.window.PrecioReal;
}

{
  // 1) Offer simple → toma price.
  const PR = makeContextWithLd([
    { '@type': 'Product', offers: { '@type': 'Offer', price: 9999, availability: 'https://schema.org/InStock' } },
  ]);
  // No puedo invocar tryLdJsonPrice() directo (no exportado), pero
  // extractPriceInfo() lo usa como fallback cuando nada matcheó. En este
  // contexto querySelector siempre devuelve null, así que llegamos al ld+json.
  const info = PR.extractPriceInfo('mercadolibre');
  assert(info && info.price === 9999, 'ld+json: Offer.price simple');
}
{
  // 2) AggregateOffer con OutOfStock primero, el segundo InStock con price.
  const PR = makeContextWithLd([
    {
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', price: 5555, availability: 'http://schema.org/OutOfStock' },
        { '@type': 'Offer', price: 7777, availability: 'http://schema.org/InStock' },
      ],
    },
  ]);
  const info = PR.extractPriceInfo('mercadolibre');
  assert(info && info.price === 7777, 'ld+json: skip OutOfStock, take InStock');
}
{
  // 3) priceSpecification.price (Carrefour Argentina lo emite así).
  const PR = makeContextWithLd([
    { '@type': 'Product', offers: { '@type': 'Offer', priceSpecification: { price: 4321 } } },
  ]);
  const info = PR.extractPriceInfo('carrefour');
  assert(info && info.price === 4321, 'ld+json: priceSpecification.price');
}
{
  // 4) @graph wrapping (algunos retailers VTEX/Shopify).
  const PR = makeContextWithLd([
    {
      '@graph': [
        { '@type': 'WebPage' },
        { '@type': 'Product', offers: { '@type': 'Offer', price: 123456 } },
      ],
    },
  ]);
  const info = PR.extractPriceInfo('jumbo');
  assert(info && info.price === 123456, 'ld+json: @graph wrapping');
}
{
  // 5) lowPrice como fallback (no hay price).
  const PR = makeContextWithLd([
    { '@type': 'Product', offers: { '@type': 'AggregateOffer', lowPrice: 8888, highPrice: 9999 } },
  ]);
  const info = PR.extractPriceInfo('falabella');
  assert(info && info.price === 8888, 'ld+json: lowPrice fallback');
}
{
  // 6) Todos los offers OutOfStock → no devuelve precio del ld+json.
  const PR = makeContextWithLd([
    {
      '@type': 'Product',
      offers: [
        { '@type': 'Offer', price: 5555, availability: 'OutOfStock' },
        { '@type': 'Offer', price: 6666, availability: 'http://schema.org/Discontinued' },
      ],
    },
  ]);
  const info = PR.extractPriceInfo('mercadolibre');
  assert(!info, 'ld+json: all OutOfStock → null');
}

// ── Resultado ───────────────────────────────────────────────────────────────
console.log(`[precio-real tests] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error('  - ' + f + '\n');
  process.exit(1);
}
process.exit(0);
