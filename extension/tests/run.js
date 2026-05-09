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
    ['www.coto.com.ar', 'coto'],
    ['www.naldo.com.ar', 'naldo'],
    ['www.musimundo.com', 'musimundo'],
    ['www.cetrogar.com.ar', 'cetrogar'],
    ['www.megatone.net', 'megatone'],
    ['diaonline.supermercadosdia.com.ar', 'dia'],
    ['www.jumbo.com.ar', 'jumbo'],
    ['www.disco.com.ar', 'disco'],
    ['www.sodimac.com.ar', 'sodimac'],
    ['www.easy.com.ar', 'easy'],
    // Ciclo 1582.
    ['www.changomas.com.ar', 'changomas'],
    ['www.electrolux.com.ar', 'electrolux'],
    ['www.drean.com.ar', 'drean'],
    ['www.motorola.com.ar', 'motorola'],
    ['www.todomodo.com.ar', 'todomodo'],
    // Ciclo 1584.
    ['www.amazon.com.ar', 'amazon'],
    ['www.hipertehno.com.ar', 'hipertehno'],
    ['www.hendel.com.ar', 'hendel'],
    ['www.rodo.com.ar', 'rodo'],
    ['www.ribeiro.com.ar', 'ribeiro'],
    ['www.compumundo.com.ar', 'compumundo'],
    ['shop.samsung.com.ar', 'samsung'],
    // Ciclo 14: marcas con tienda oficial AR.
    ['www.lg.com', 'lg'],
    ['www.sony.com.ar', 'sony'],
    ['www.philips.com.ar', 'philips'],
    ['www.bgh.com.ar', 'bgh'],
    ['www.noblex.com.ar', 'noblex'],
    ['www.whirlpool.com.ar', 'whirlpool'],
    // Ciclo 1599: Xiaomi Store, Philco, Venex.
    ['tienda.mi.com', 'xiaomi'],
    ['www.philco.com.ar', 'philco'],
    ['www.venex.com.ar', 'venex'],
    // Ciclo 1596: Hisense AR, TCL AR, Pycca.
    ['www.hisense.com.ar', 'hisense'],
    ['www.tcl.com.ar', 'tcl'],
    ['www.pycca.com.ar', 'pycca'],
    // Ciclo 1594: Bgood, HP Tienda, Lenovo Store, Alphatec, EXO.
    ['www.bgood.com.ar', 'bgood'],
    ['www.hptienda.com.ar', 'hptienda'],
    ['ar.lenovo.com', 'lenovo'],
    ['www.alphatec.com.ar', 'alphatec'],
    ['www.exo.com.ar', 'exo'],
    // Ciclo 1613: Newsan, Asus Store AR, Mac Center.
    ['www.newsan.com.ar', 'newsan'],
    ['store.asus.com', 'asus'],
    ['www.maccenter.com.ar', 'maccenter'],
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
  // Ciclo 1596: Shopify /collections/ son listados; /products/ son PDPs.
  assertEq(PR.urlLooksLikeListing('tcl', '/collections/televisores'), true, 'Shopify /collections/ is listing');
  assertEq(PR.urlLooksLikeListing('tcl', '/collections/all'), true, 'Shopify /collections/all is listing');
  assertEq(PR.urlLooksLikeListing('tcl', '/products/tcl-55-4k'), false, 'Shopify /products/ is product');
  assertEq(PR.urlLooksLikeListing(null, '/collections/verano'), true, 'Shopify /collections/ generic is listing');
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

// RETAILERS coverage — los 20 retailers del manifest.json (+3 ciclo 12).
{
  const PR = freshNs();
  const expected = [
    'mercadolibre', 'fravega', 'garbarino', 'falabella', 'carrefour', 'coto',
    'naldo', 'musimundo', 'cetrogar', 'megatone', 'dia', 'jumbo', 'disco',
    'sodimac', 'easy', 'hendel', 'rodo',
    // Ciclo 12: Ribeiro (SAP Commerce), Compumundo (sister Garbarino, VTEX),
    // Samsung Argentina (Hybris).
    'ribeiro', 'compumundo', 'samsung',
    // Ciclo 14: marcas con tienda oficial AR.
    'lg', 'sony', 'philips', 'bgh', 'noblex', 'whirlpool',
    // Ciclo 1582: nuevos retailers Hot Sale AR.
    'changomas', 'electrolux', 'drean', 'motorola', 'todomodo',
    // Ciclo 1584: Amazon AR + HiperTehno.
    'amazon', 'hipertehno',
  ];
  for (const k of expected) {
    assert(PR.RETAILERS && PR.RETAILERS[k], `RETAILERS["${k}"] exists`);
    assert(
      Array.isArray(PR.RETAILERS[k].selectors) && PR.RETAILERS[k].selectors.length > 0,
      `RETAILERS["${k}"].selectors not empty`
    );
  }
  // SUPPORTED_SITES debe incluir los 3 nuevos del ciclo 12 + 6 del ciclo 14
  // + 5 del ciclo 1582 + 2 del ciclo 1584.
  assert(PR.SUPPORTED_SITES.includes('ribeiro'), 'SUPPORTED_SITES includes ribeiro');
  assert(PR.SUPPORTED_SITES.includes('compumundo'), 'SUPPORTED_SITES includes compumundo');
  assert(PR.SUPPORTED_SITES.includes('samsung'), 'SUPPORTED_SITES includes samsung');
  for (const k of ['lg', 'sony', 'philips', 'bgh', 'noblex', 'whirlpool']) {
    assert(PR.SUPPORTED_SITES.includes(k), `SUPPORTED_SITES includes ${k}`);
  }
  for (const k of ['changomas', 'electrolux', 'drean', 'motorola', 'todomodo', 'amazon', 'hipertehno']) {
    assert(PR.SUPPORTED_SITES.includes(k), `SUPPORTED_SITES includes ${k} (ciclo 1582/1584)`);
  }
  // Ciclo 1599: Xiaomi Store AR, Philco AR, Venex.
  for (const k of ['xiaomi', 'philco', 'venex']) {
    assert(PR.SUPPORTED_SITES.includes(k), `SUPPORTED_SITES includes ${k} (ciclo 1599)`);
    assert(PR.RETAILERS && PR.RETAILERS[k], `RETAILERS["${k}"] exists (ciclo 1599)`);
    assert(
      Array.isArray(PR.RETAILERS[k] && PR.RETAILERS[k].selectors) && PR.RETAILERS[k].selectors.length > 0,
      `RETAILERS["${k}"].selectors not empty (ciclo 1599)`
    );
  }
  // Ciclo 1594: Bgood, HP Tienda, Lenovo Store, Alphatec, EXO.
  for (const k of ['bgood', 'hptienda', 'lenovo', 'alphatec', 'exo']) {
    assert(PR.SUPPORTED_SITES.includes(k), `SUPPORTED_SITES includes ${k} (ciclo 1594)`);
    assert(PR.RETAILERS && PR.RETAILERS[k], `RETAILERS["${k}"] exists (ciclo 1594)`);
    assert(
      Array.isArray(PR.RETAILERS[k] && PR.RETAILERS[k].selectors) && PR.RETAILERS[k].selectors.length > 0,
      `RETAILERS["${k}"].selectors not empty (ciclo 1594)`
    );
  }
  // Ciclo 1596: Hisense, TCL, Pycca.
  for (const k of ['hisense', 'tcl', 'pycca']) {
    assert(PR.SUPPORTED_SITES.includes(k), `SUPPORTED_SITES includes ${k} (ciclo 1596)`);
    assert(PR.RETAILERS && PR.RETAILERS[k], `RETAILERS["${k}"] exists (ciclo 1596)`);
    assert(
      Array.isArray(PR.RETAILERS[k] && PR.RETAILERS[k].selectors) && PR.RETAILERS[k].selectors.length > 0,
      `RETAILERS["${k}"].selectors not empty (ciclo 1596)`
    );
  }
  // Ciclo 1613: Newsan, Asus Store AR, Mac Center.
  for (const k of ['newsan', 'asus', 'maccenter']) {
    assert(PR.SUPPORTED_SITES.includes(k), `SUPPORTED_SITES includes ${k} (ciclo 1613)`);
    assert(PR.RETAILERS && PR.RETAILERS[k], `RETAILERS["${k}"] exists (ciclo 1613)`);
    assert(
      Array.isArray(PR.RETAILERS[k] && PR.RETAILERS[k].selectors) && PR.RETAILERS[k].selectors.length > 0,
      `RETAILERS["${k}"].selectors not empty (ciclo 1613)`
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
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this._attrs, name);
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
    // Ciclo 11: patrones adicionales.
    'msrp', 'retail-price', 'retailPrice', 'before-price', 'beforePrice',
    'pre-discount', 'preDiscount', 'sale-off', 'saleOff', 'wasAmount', 'was-amount',
  ];
  for (const c of cases) {
    assertEq(
      PR.isStrikethroughPrice(fakeEl({ tag: 'span', className: c })),
      true,
      `isStrikethroughPrice class "${c}"`
    );
  }
  // Ciclo 12: nuevos patrones (viejo-precio, precio-lista, RRP, PVP, was__,
  // crossed-price, was-value).
  const cicl12Cases = [
    'viejo-precio', 'viejoPrecio', 'precio-lista', 'precioLista', 'precio-viejo',
    'precioViejo', 'crossed-price', 'crossedPrice', 'was__price', 'price__was',
    'price--was', 'recommended-retail', 'recommendedRetail', 'rrp', 'pvp',
    'catalog-price', 'catalogPrice', 'standard-price', 'standardPrice',
    'undiscounted', 'non-sale', 'nonSale', 'wasvalue', 'was-value',
  ];
  for (const c of cicl12Cases) {
    assertEq(
      PR.isStrikethroughPrice(fakeEl({ tag: 'span', className: c })),
      true,
      `isStrikethroughPrice class "${c}" (ciclo 12)`
    );
  }
  // Ciclo 14: precio-de-lista, precio-full, full-price, slashed-price,
  // striked-price, prevprice, pvp-anterior, tachado-precio, sin-descuento.
  const cicl14Cases = [
    'precio-de-lista', 'precioDeLista', 'precio-full', 'precioFull',
    'full-price', 'fullPrice', 'slashed-price', 'slashedPrice',
    'striked-price', 'strikedPrice', 'prevprice', 'pvp-anterior',
    'pvpAnterior', 'tachado-precio', 'tachadoPrecio', 'sin-descuento',
    'sinDescuento',
  ];
  for (const c of cicl14Cases) {
    assertEq(
      PR.isStrikethroughPrice(fakeEl({ tag: 'span', className: c })),
      true,
      `isStrikethroughPrice class "${c}" (ciclo 14)`
    );
  }
  // data-pricetype="WAS" (Samsung Hybris) y similares.
  assertEq(
    PR.isStrikethroughPrice(fakeEl({ tag: 'span', attrs: { 'data-pricetype': 'WAS' } })),
    true,
    'isStrikethroughPrice data-pricetype=WAS'
  );
  assertEq(
    PR.isStrikethroughPrice(fakeEl({ tag: 'span', attrs: { 'data-pricetype': 'was' } })),
    true,
    'isStrikethroughPrice data-pricetype=was lowercase'
  );
  assertEq(
    PR.isStrikethroughPrice(fakeEl({ tag: 'span', attrs: { 'data-price-type': 'list' } })),
    true,
    'isStrikethroughPrice data-price-type=list'
  );
  // data-pricetype="finalPrice" NO debería matchear (es el bueno).
  assertEq(
    PR.isStrikethroughPrice(fakeEl({ tag: 'span', attrs: { 'data-pricetype': 'finalPrice' } })),
    false,
    'isStrikethroughPrice data-pricetype=finalPrice (not strikethrough)'
  );
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
  // Ciclo 11: nuevos patrones (Cuota Simple gov, sin interés, financiación).
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Cuota Simple en 3 cuotas' })),
    true,
    'isInstallmentPrice "Cuota Simple"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '$1.234 sin interés' })),
    true,
    'isInstallmentPrice "sin interés"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Financiación en 6 pagos' })),
    true,
    'isInstallmentPrice "Financiación"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '6 pagos de $1.234' })),
    true,
    'isInstallmentPrice "X pagos de"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Precio mensual $1.234' })),
    true,
    'isInstallmentPrice "Precio mensual"'
  );
  // Ancestro Cuota Simple (clases de wrapper).
  const cuotaSimple = fakeEl({ tag: 'div', className: 'cuota-simple-row' });
  const priceCS = fakeEl({ tag: 'span', text: '$1.234', parent: cuotaSimple });
  assertEq(PR.isInstallmentPrice(priceCS), true, 'isInstallmentPrice ancestor cuota-simple');
  const paymentPlan = fakeEl({ tag: 'div', className: 'payment-plan-info' });
  const pricePP = fakeEl({ tag: 'span', text: '$1.234', parent: paymentPlan });
  assertEq(PR.isInstallmentPrice(pricePP), true, 'isInstallmentPrice ancestor payment-plan');

  // Ciclo 12: tarjeta-naranja, tarjeta-shopping, "más cuotas", "tasa fija",
  // "X cuotas fijas", "Plan Ahora 12", "Plan Z", recurring-payment ancestor.
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Tarjeta Naranja en 12 cuotas' })),
    true,
    'isInstallmentPrice "Tarjeta Naranja"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Tarjeta Shopping' })),
    true,
    'isInstallmentPrice "Tarjeta Shopping"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Más cuotas con tu banco' })),
    true,
    'isInstallmentPrice "Más cuotas"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '12 cuotas fijas de $1.234' })),
    true,
    'isInstallmentPrice "X cuotas fijas"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Plan Ahora 12' })),
    true,
    'isInstallmentPrice "Plan Ahora 12"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Tasa fija 0%' })),
    true,
    'isInstallmentPrice "Tasa fija"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Promoción bancaria del banco' })),
    true,
    'isInstallmentPrice "Promoción bancaria"'
  );
  // Ancestros nuevos.
  const tarjetaNaranja = fakeEl({ tag: 'div', className: 'tarjeta-naranja-row' });
  const priceTN = fakeEl({ tag: 'span', text: '$1.234', parent: tarjetaNaranja });
  assertEq(PR.isInstallmentPrice(priceTN), true, 'isInstallmentPrice ancestor tarjeta-naranja');
  const masCuotas = fakeEl({ tag: 'div', className: 'mas-cuotas-block' });
  const priceMC = fakeEl({ tag: 'span', text: '$1.234', parent: masCuotas });
  assertEq(PR.isInstallmentPrice(priceMC), true, 'isInstallmentPrice ancestor mas-cuotas');
  const subscription = fakeEl({ tag: 'div', className: 'subscription-price' });
  const priceSub = fakeEl({ tag: 'span', text: '$1.234', parent: subscription });
  assertEq(PR.isInstallmentPrice(priceSub), true, 'isInstallmentPrice ancestor subscription-price');

  // Ciclo 14: "Hasta X sin interés" sin "cuotas", "X sin interés" suelto,
  // "$X / mes" slash format.
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Hasta 12 sin interés' })),
    true,
    'isInstallmentPrice "Hasta 12 sin interés"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: 'Hasta en 6 sin interés' })),
    true,
    'isInstallmentPrice "Hasta en 6 sin interés"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '12 sin interés' })),
    true,
    'isInstallmentPrice "12 sin interés" suelto'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '$1.234 / mes' })),
    true,
    'isInstallmentPrice "$X / mes"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '$1.234/mensual' })),
    true,
    'isInstallmentPrice "$X/mensual"'
  );
  assertEq(
    PR.isInstallmentPrice(fakeEl({ tag: 'span', text: '$1.234,56 /cuota' })),
    true,
    'isInstallmentPrice "$X /cuota"'
  );
}

// isPriceTextUSD (ciclo 14) — defensa contra precios USD visibles aunque
// el documento declare ARS.
{
  const PR = freshNs();
  assertEq(
    PR.isPriceTextUSD(fakeEl({ tag: 'span', text: 'U$S 1.299' })),
    true,
    'isPriceTextUSD "U$S 1.299"'
  );
  assertEq(
    PR.isPriceTextUSD(fakeEl({ tag: 'span', text: 'U$D 999' })),
    true,
    'isPriceTextUSD "U$D 999"'
  );
  assertEq(
    PR.isPriceTextUSD(fakeEl({ tag: 'span', text: 'US$ 1299' })),
    true,
    'isPriceTextUSD "US$ 1299"'
  );
  assertEq(
    PR.isPriceTextUSD(fakeEl({ tag: 'span', text: '1299 USD' })),
    true,
    'isPriceTextUSD "1299 USD"'
  );
  assertEq(
    PR.isPriceTextUSD(fakeEl({ tag: 'span', text: '1299 dólares' })),
    true,
    'isPriceTextUSD "1299 dólares"'
  );
  // Plain ARS price (default $) no debería matchear — $ solo es ambiguo en AR.
  assertEq(
    PR.isPriceTextUSD(fakeEl({ tag: 'span', text: '$ 1.299.000' })),
    false,
    'isPriceTextUSD "$ 1.299.000" (ARS, no match)'
  );
  // Texto vacío.
  assertEq(
    PR.isPriceTextUSD(fakeEl({ tag: 'span', text: '' })),
    false,
    'isPriceTextUSD empty text'
  );
  // meta tag siempre falso (el atributo se valida via detectDocumentCurrency).
  assertEq(
    PR.isPriceTextUSD(fakeEl({ tag: 'meta', text: 'USD' })),
    false,
    'isPriceTextUSD meta tag always false'
  );
  // Defensivo.
  assertEq(PR.isPriceTextUSD(null), false, 'isPriceTextUSD null');
}

// isLoadingSkeleton (ciclo 12) — descarta nodos shimmer/skeleton/loading.
{
  const PR = freshNs();
  // Patrones cross-framework.
  const skelCases = [
    'skeleton', 'skeleton-loader', 'skeletonLoader', 'shimmer', 'loading-placeholder',
    'loadingPlaceholder', 'placeholder-glow', 'placeholderGlow', 'placeholder-wave',
    'is-loading', 'isLoading', 'loading-pulse', 'pulse-loading', 'pulseLoading',
    'animate-pulse', 'animatePulse', 'content-loader', 'contentLoader', 'MuiSkeleton',
    'react-loading-skeleton', 'sk-loading',
  ];
  for (const c of skelCases) {
    assertEq(
      PR.isLoadingSkeleton(fakeEl({ tag: 'span', className: c })),
      true,
      `isLoadingSkeleton class "${c}"`
    );
  }
  // aria-busy=true en el wrapper.
  assertEq(
    PR.isLoadingSkeleton(fakeEl({ tag: 'span', attrs: { 'aria-busy': 'true' } })),
    true,
    'isLoadingSkeleton aria-busy=true'
  );
  // Wrapper skeleton, child precio.
  const skelParent = fakeEl({ tag: 'div', className: 'skeleton' });
  const priceChild = fakeEl({ tag: 'span', className: 'price', parent: skelParent });
  assertEq(PR.isLoadingSkeleton(priceChild), true, 'isLoadingSkeleton via parent skeleton');
  // Clases normales no skeleton.
  const normalCases = ['price', 'product-price', 'sale-price', 'final-price', 'andes-money-amount'];
  for (const c of normalCases) {
    assertEq(
      PR.isLoadingSkeleton(fakeEl({ tag: 'span', className: c })),
      false,
      `isLoadingSkeleton class "${c}" (should not match)`
    );
  }
  // meta tag siempre false.
  assertEq(
    PR.isLoadingSkeleton(fakeEl({ tag: 'meta', className: 'skeleton' })),
    false,
    'isLoadingSkeleton meta tag (always false)'
  );
  // Defensivo.
  assertEq(PR.isLoadingSkeleton(null), false, 'isLoadingSkeleton null');
  assertEq(PR.isLoadingSkeleton(undefined), false, 'isLoadingSkeleton undefined');
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
  // Ciclo 11: HTML5 `hidden` attribute.
  assertEq(
    PR.isHiddenNode(fakeEl({ tag: 'span', attrs: { hidden: '' } })),
    true,
    'isHiddenNode HTML5 hidden attr'
  );
  // Ciclo 11: opacity:0 + pointer-events:none combo.
  assertEq(
    PR.isHiddenNode(fakeEl({ tag: 'span', attrs: { style: 'opacity: 0; pointer-events: none;' } })),
    true,
    'isHiddenNode opacity:0 + pointer-events:none'
  );
  // opacity:0 solo NO debería ocultar (el nodo aún reserva espacio y puede
  // tener color fade-in).
  assertEq(
    PR.isHiddenNode(fakeEl({ tag: 'span', attrs: { style: 'opacity: 0;' } })),
    false,
    'isHiddenNode opacity:0 alone (not hidden)'
  );
}

// isPlaceholderPriceText (ciclo 11) — descarta nodos con "Consultar precio",
// "Sin stock", etc. cuando no contienen dígitos.
{
  const PR = freshNs();
  assertEq(
    PR.isPlaceholderPriceText(fakeEl({ tag: 'span', text: 'Consultar precio' })),
    true,
    'isPlaceholderPriceText "Consultar precio"'
  );
  assertEq(
    PR.isPlaceholderPriceText(fakeEl({ tag: 'span', text: 'Sin stock' })),
    true,
    'isPlaceholderPriceText "Sin stock"'
  );
  assertEq(
    PR.isPlaceholderPriceText(fakeEl({ tag: 'span', text: 'Agotado' })),
    true,
    'isPlaceholderPriceText "Agotado"'
  );
  assertEq(
    PR.isPlaceholderPriceText(fakeEl({ tag: 'span', text: 'Próximamente' })),
    true,
    'isPlaceholderPriceText "Próximamente"'
  );
  assertEq(
    PR.isPlaceholderPriceText(fakeEl({ tag: 'span', text: 'No disponible' })),
    true,
    'isPlaceholderPriceText "No disponible"'
  );
  // Precio numérico real: no debería matchear.
  assertEq(
    PR.isPlaceholderPriceText(fakeEl({ tag: 'span', text: '$1.234,56' })),
    false,
    'isPlaceholderPriceText real price (no match)'
  );
  // meta tag siempre falso (no tiene textContent visible).
  assertEq(
    PR.isPlaceholderPriceText(fakeEl({ tag: 'meta', text: 'Consultar' })),
    false,
    'isPlaceholderPriceText meta tag (always false)'
  );
  // Texto vacío: false.
  assertEq(
    PR.isPlaceholderPriceText(fakeEl({ tag: 'span', text: '' })),
    false,
    'isPlaceholderPriceText empty (false)'
  );
  // Defensivo.
  assertEq(PR.isPlaceholderPriceText(null), false, 'isPlaceholderPriceText null');
}

// detectDocumentCurrency (ciclo 11) — lee og:price:currency / itemprop /
// ld+json. Retorna uppercased string o null.
{
  function makeContextWithCurrency({ metaCurrency = null, ldCurrency = null } = {}) {
    const ctx = makeContext();
    ctx.document.querySelector = (sel) => {
      if (metaCurrency) {
        if (sel === 'meta[property="og:price:currency"]') {
          return { getAttribute: () => metaCurrency };
        }
        if (sel === 'meta[property="product:price:currency"]') {
          return { getAttribute: () => metaCurrency };
        }
        if (sel === 'meta[itemprop="priceCurrency"]') {
          return { getAttribute: () => metaCurrency };
        }
      }
      return null;
    };
    ctx.document.querySelectorAll = (sel) => {
      if (sel === 'script[type="application/ld+json"]' && ldCurrency) {
        return [{ textContent: `{"@type":"Product","offers":{"priceCurrency":"${ldCurrency}"}}` }];
      }
      return [];
    };
    loadInto(ctx, 'utils/retailers.js');
    loadInto(ctx, 'utils/helpers.js');
    return ctx.window.PrecioReal;
  }
  const prArs = makeContextWithCurrency({ metaCurrency: 'ARS' });
  assertEq(prArs.detectDocumentCurrency(), 'ARS', 'detectDocumentCurrency ARS via og:price:currency');
  const prUsd = makeContextWithCurrency({ metaCurrency: 'usd' });
  assertEq(prUsd.detectDocumentCurrency(), 'USD', 'detectDocumentCurrency uppercases');
  const prLd = makeContextWithCurrency({ ldCurrency: 'ARS' });
  assertEq(prLd.detectDocumentCurrency(), 'ARS', 'detectDocumentCurrency from ld+json');
  const prNone = makeContextWithCurrency({});
  assertEq(prNone.detectDocumentCurrency(), null, 'detectDocumentCurrency null when absent');
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

// Ciclo 12: currency mismatch hard-stop en extractPriceInfo. Si el documento
// declara USD/EUR/etc, no devolvemos precio porque el histórico es ARS.
{
  function makeContextWithCurrencyAndLd(currency, ldNodes) {
    const ctx = makeContext();
    ctx.document.querySelector = (sel) => {
      if (sel === 'meta[property="og:price:currency"]' && currency) {
        return { getAttribute: () => currency };
      }
      return null;
    };
    ctx.document.querySelectorAll = (sel) => {
      if (sel === 'script[type="application/ld+json"]') {
        return ldNodes.map((n) => ({ textContent: typeof n === 'string' ? n : JSON.stringify(n) }));
      }
      return [];
    };
    loadInto(ctx, 'utils/retailers.js');
    loadInto(ctx, 'utils/helpers.js');
    return ctx.window.PrecioReal;
  }
  // ARS declarado: pasa.
  const prArs = makeContextWithCurrencyAndLd('ARS', [
    { '@type': 'Product', offers: { '@type': 'Offer', price: 9999 } },
  ]);
  const infoArs = prArs.extractPriceInfo('mercadolibre');
  assert(infoArs && infoArs.price === 9999, 'extractPriceInfo: ARS currency passes');

  // USD declarado: hard-stop, devuelve null.
  const prUsd = makeContextWithCurrencyAndLd('USD', [
    { '@type': 'Product', offers: { '@type': 'Offer', price: 9999 } },
  ]);
  const infoUsd = prUsd.extractPriceInfo('mercadolibre');
  assert(!infoUsd, 'extractPriceInfo: USD currency → null (hard-stop)');

  // Sin currency declarada: pasa (fail-open).
  const prNone = makeContextWithCurrencyAndLd(null, [
    { '@type': 'Product', offers: { '@type': 'Offer', price: 9999 } },
  ]);
  const infoNone = prNone.extractPriceInfo('mercadolibre');
  assert(infoNone && infoNone.price === 9999, 'extractPriceInfo: no currency → pass (fail-open)');
}

// affiliates coverage (ciclo 1591) — todos los retailers en RETAILERS deben
// tener entrada en AFFILIATES para que el CTA "Ir al producto →" aparezca.
{
  function freshNsWithAffiliates(opts) {
    const ctx = makeContext(opts);
    loadInto(ctx, 'utils/retailers.js');
    loadInto(ctx, 'utils/helpers.js');
    loadInto(ctx, 'utils/affiliates.js');
    return ctx.window.PrecioReal;
  }
  const PR = freshNsWithAffiliates();
  const allRetailerKeys = Object.keys(PR.RETAILERS);
  for (const k of allRetailerKeys) {
    assert(
      PR.AFFILIATES && PR.AFFILIATES[k],
      `AFFILIATES["${k}"] should exist for retailer coverage`
    );
    assert(
      PR.AFFILIATES && PR.AFFILIATES[k] && PR.AFFILIATES[k].enabled === true,
      `AFFILIATES["${k}"].enabled should be true`
    );
    // affiliateWrap deve devolver una URL cuando se le pasa una URL válida.
    if (PR.AFFILIATES && PR.AFFILIATES[k] && PR.AFFILIATES[k].enabled) {
      const result = PR.affiliateWrap('https://example.com/product', k);
      assert(result && result.url, `affiliateWrap("${k}") should return url`);
    }
  }
  // coto.com.ar detectado como 'coto' (detectSite cubre ambos dominios).
  assert(PR.detectSite('www.coto.com.ar') === 'coto', 'detectSite coto.com.ar → coto');
  assert(PR.detectSite('coto.com.ar') === 'coto', 'detectSite coto.com.ar (bare) → coto');
}

// classifyFromStats (ciclo 1592) — 7d baseline primario + 30d fallback.
// Cargamos content.js con un shim mínimo del entorno browser que necesita para
// ejecutar su IIFE sin errores (hookHistory, run, etc.) y luego accedemos a
// _classifyFromStats que exportamos cuando __precioRealTest es true.
{
  function freshContentNs() {
    const fakeStorage = () => {
      const m = new Map();
      return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: (k) => m.delete(k),
        clear: () => m.clear(),
      };
    };
    const noop = () => {};
    const noopEl = { getAttribute: () => null, setAttribute: noop };
    const fakeWindow = {
      PrecioReal: undefined,
      PrecioRealConfig: { API_BASE: 'http://localhost:8787' },
      __precioRealTest: true,  // activa el export de test
      addEventListener: noop,
      dispatchEvent: noop,
      __precioRealLoaded: undefined,
    };
    const fakeHistory = {
      pushState: noop,
      replaceState: noop,
    };
    const fakeDocument = {
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        style: {},
        textContent: '',
        innerHTML: '',
        dataset: {},
        _children: [],
        _attrs: {},
        appendChild: noop,
        remove: noop,
        setAttribute(k, v) { this._attrs[k] = v; },
        getAttribute(k) { return this._attrs[k] != null ? this._attrs[k] : null; },
        addEventListener: noop,
        replaceChildren: noop,
        isConnected: true,
      }),
      createEvent: () => ({ initEvent: noop }),
      body: { appendChild: noop, classList: { contains: () => false } },
      documentElement: { appendChild: noop },
      readyState: 'complete',
      addEventListener: noop,
      visibilityState: 'visible',
    };
    const ctx = {
      window: fakeWindow,
      document: fakeDocument,
      location: {
        hostname: 'www.fravega.com',
        pathname: '/producto/tv-55/TV-123',
        href: 'https://www.fravega.com/producto/tv-55/TV-123',
        search: '',
      },
      history: fakeHistory,
      sessionStorage: fakeStorage(),
      localStorage: fakeStorage(),
      MutationObserver: function () { return { observe: noop, disconnect: noop }; },
      AbortController: function () { return { abort: noop, signal: {} }; },
      fetch: () => Promise.resolve({ ok: false, status: 503 }),
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
      Promise,
      setTimeout: noop,
      clearTimeout: noop,
      Event: function (type) { return { type }; },
      CustomEvent: function (type) { return { type }; },
    };
    vm.createContext(ctx);
    loadInto(ctx, 'utils/retailers.js');
    loadInto(ctx, 'utils/helpers.js');
    loadInto(ctx, 'utils/affiliates.js');
    loadInto(ctx, 'content/content.js');
    return ctx.window.PrecioReal;
  }

  let PR;
  try {
    PR = freshContentNs();
  } catch (e) {
    failed++;
    failures.push('classifyFromStats bootstrap failed: ' + (e && e.message));
    PR = null;
  }

  if (PR && typeof PR._classifyFromStats === 'function') {
    const fn = PR._classifyFromStats;

    // ── 7d baseline (primario) ───────────────────────────────────────────────
    // Descuento real (>=5% baja en 7d).
    {
      const v = fn(9000, { real_discount_pct: 10, inflated: false, price_7d_ago: 10000, price_30d_ago: 10500, baseline_age_days: 7 });
      assertEq(v.kind, 'real', 'classifyFromStats 7d: descuento real');
      assert(v.sub.includes('7 días atrás'), 'classifyFromStats 7d: sub mentions 7 días');
    }
    // Inflado (>5% sube en 7d).
    {
      const v = fn(11000, { real_discount_pct: -10, inflated: true, price_7d_ago: 10000, price_30d_ago: 9500, baseline_age_days: 7 });
      assertEq(v.kind, 'inflated', 'classifyFromStats 7d: inflado');
      assert(v.sub.includes('7 días atrás'), 'classifyFromStats 7d: inflado sub mentions 7d');
    }
    // Neutral (<5% movimiento).
    {
      const v = fn(9800, { real_discount_pct: 2, inflated: false, price_7d_ago: 10000, price_30d_ago: null, baseline_age_days: 7 });
      assertEq(v.kind, 'neutral', 'classifyFromStats 7d: neutral');
      assert(v.sub.includes('7 días atrás'), 'classifyFromStats 7d: neutral sub mentions 7d');
    }

    // ── 30d baseline (fallback cuando price_7d_ago es null) ──────────────────
    // Descuento real (>=10% baja en 30d).
    {
      const v = fn(8000, { real_discount_pct: null, inflated: false, price_7d_ago: null, price_30d_ago: 10000, baseline_age_days: null });
      assertEq(v.kind, 'real', 'classifyFromStats 30d fallback: descuento real');
      assert(v.sub.includes('30 días atrás'), 'classifyFromStats 30d: sub mentions 30 días');
    }
    // Inflado en 30d (>10% sube).
    {
      const v = fn(11500, { real_discount_pct: null, inflated: false, price_7d_ago: null, price_30d_ago: 10000, baseline_age_days: null });
      assertEq(v.kind, 'inflated', 'classifyFromStats 30d fallback: inflado');
      assert(v.sub.includes('30 días atrás'), 'classifyFromStats 30d: inflado sub mentions 30d');
    }
    // Neutral en 30d (<10% movimiento).
    {
      const v = fn(9700, { real_discount_pct: null, inflated: false, price_7d_ago: null, price_30d_ago: 10000, baseline_age_days: null });
      assertEq(v.kind, 'neutral', 'classifyFromStats 30d fallback: neutral');
      assert(v.sub.includes('30 días atrás'), 'classifyFromStats 30d: neutral sub mentions 30d');
    }
    // Exactamente en el umbral 10%: debe ser real.
    {
      const v = fn(9000, { real_discount_pct: null, inflated: false, price_7d_ago: null, price_30d_ago: 10000, baseline_age_days: null });
      assertEq(v.kind, 'real', 'classifyFromStats 30d: exactly 10% → real');
    }
    // Exactamente en el umbral inflado 10%: debe ser inflado.
    {
      const v = fn(11001, { real_discount_pct: null, inflated: false, price_7d_ago: null, price_30d_ago: 10000, baseline_age_days: null });
      assertEq(v.kind, 'inflated', 'classifyFromStats 30d: >10% inflado threshold');
    }

    // ── Sin ningún baseline ──────────────────────────────────────────────────
    {
      const v = fn(10000, { real_discount_pct: null, inflated: false, price_7d_ago: null, price_30d_ago: null, baseline_age_days: null });
      assertEq(v.kind, 'neutral', 'classifyFromStats no baseline: neutral/sin datos');
      assert(v.label.includes('sin datos'), 'classifyFromStats no baseline: label says sin datos');
    }
    // 7d baseline tiene precedencia sobre 30d.
    {
      const v = fn(9000, { real_discount_pct: 10, inflated: false, price_7d_ago: 10000, price_30d_ago: 5000, baseline_age_days: 7 });
      // Con 30d=5000, precio actual 9000 subiría vs 30d → inflado. Pero 7d tiene precedencia: descuento real.
      assertEq(v.kind, 'real', 'classifyFromStats: 7d baseline has precedence over 30d');
      assert(v.sub.includes('7 días atrás'), 'classifyFromStats: 7d wins sub label');
    }
  } else {
    failed++;
    failures.push('classifyFromStats not exported (_classifyFromStats missing on PrecioReal)');
  }
}

// isProductPageStrict — detección por body class para Magento 2, Shopify, PrestaShop.
// Ciclo 1596: verifica los nuevos caminos de detección sin depender de DOM real.
{
  // Helper: crea un PR con body class personalizado y ruta específica.
  function freshNsWithBodyClass(hostname, pathname, bodyClass) {
    const ctx = makeContext({ hostname, pathname });
    const classList = new Set(bodyClass ? bodyClass.split(' ') : []);
    ctx.document.body = {
      classList: {
        contains: (c) => classList.has(c),
      },
    };
    loadInto(ctx, 'utils/retailers.js');
    loadInto(ctx, 'utils/helpers.js');
    return ctx.window.PrecioReal;
  }

  // Magento 2: catalog-product-view en body → es PDP.
  {
    const PR = freshNsWithBodyClass('www.pycca.com.ar', '/heladera-samsung-360/p', 'catalog-product-view cms-index');
    assert(PR.isProductPageStrict('pycca') === true, 'isProductPageStrict pycca: catalog-product-view body class');
  }
  {
    const PR = freshNsWithBodyClass('www.cetrogar.com.ar', '/notebook-lenovo/p', 'catalog-product-view');
    assert(PR.isProductPageStrict('cetrogar') === true, 'isProductPageStrict cetrogar: catalog-product-view body class');
  }

  // Shopify (TCL): /products/ en la ruta → es PDP.
  {
    const PR = freshNsWithBodyClass('www.tcl.com.ar', '/products/tcl-55-4k', '');
    assert(PR.isProductPageStrict('tcl') === true, 'isProductPageStrict tcl: /products/ pathname');
  }
  // Shopify: body.template-product → es PDP.
  {
    const PR = freshNsWithBodyClass('www.tcl.com.ar', '/products/tcl-55-4k', 'template-product');
    assert(PR.isProductPageStrict('tcl') === true, 'isProductPageStrict tcl: template-product body class');
  }

  // PrestaShop: page-product en body → es PDP.
  {
    const PR = freshNsWithBodyClass('www.todomodo.com.ar', '/celular-motorola-123.html', 'page-product');
    assert(PR.isProductPageStrict('todomodo') === true, 'isProductPageStrict todomodo: page-product body class');
  }
  {
    const PR = freshNsWithBodyClass('www.alphatec.com.ar', '/monitor-24/product', 'product-page');
    assert(PR.isProductPageStrict('alphatec') === true, 'isProductPageStrict alphatec: product-page body class');
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
