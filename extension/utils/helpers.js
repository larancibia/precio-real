// Content scripts no son módulos ES; exponemos en namespace global para evitar colisiones.
(function () {
  'use strict';

  const ns = (window.PrecioReal = window.PrecioReal || {});

  // ── Logger condicional ────────────────────────────────────────────────────
  // Activado por:
  //   • Query param `?precio_real_debug=1` (sticky en sessionStorage)
  //   • localStorage.precioRealDebug = '1'
  //   • localStorage.precioRealDebug = '<retailer>' (filtra solo ese retailer)
  // Nada de logs en producción a menos que el dev/usuario los pida explícitamente.
  function readDebugFlag() {
    try {
      const params = new URLSearchParams(location.search);
      const q = params.get('precio_real_debug');
      if (q === '1' || q === 'true') {
        try { sessionStorage.setItem('precioRealDebug', '1'); } catch (_) {}
        return '1';
      }
      const ss = (function () {
        try { return sessionStorage.getItem('precioRealDebug'); } catch (_) { return null; }
      })();
      if (ss) return ss;
      const ls = (function () {
        try { return localStorage.getItem('precioRealDebug'); } catch (_) { return null; }
      })();
      return ls;
    } catch (_) { return null; }
  }
  const DEBUG_FLAG = readDebugFlag();
  const DEBUG = !!DEBUG_FLAG;
  function debugMatches(siteKey) {
    if (!DEBUG) return false;
    if (DEBUG_FLAG === '1' || DEBUG_FLAG === 'true' || DEBUG_FLAG === '*') return true;
    if (!siteKey) return true;
    return DEBUG_FLAG === siteKey;
  }
  const log = {
    debug(siteKey, ...args) {
      if (debugMatches(siteKey)) {
        try { console.log('[Precio Real][debug]', siteKey || '-', ...args); } catch (_) {}
      }
    },
    info(...args) { try { console.info('[Precio Real]', ...args); } catch (_) {} },
    warn(...args) { try { console.warn('[Precio Real]', ...args); } catch (_) {} },
  };

  const SUPPORTED_SITES = [
    'mercadolibre',
    'fravega',
    'garbarino',
    'falabella',
    'carrefour',
    'coto',
    'naldo',
    'musimundo',
    'cetrogar',
    'megatone',
    'dia',
    'jumbo',
    'disco',
    'sodimac',
    'easy',
    'hendel',
    'rodo'
  ];

  function detectSite(hostname) {
    if (!hostname || typeof hostname !== 'string') return null;
    const h = hostname.toLowerCase();
    if (h.endsWith('mercadolibre.com.ar')) return 'mercadolibre';
    if (h.endsWith('fravega.com')) return 'fravega';
    if (h.endsWith('garbarino.com')) return 'garbarino';
    if (h.endsWith('falabella.com.ar')) return 'falabella';
    if (h.endsWith('carrefour.com.ar')) return 'carrefour';
    if (h.endsWith('cotodigital3.com.ar')) return 'coto';
    if (h.endsWith('naldo.com.ar')) return 'naldo';
    if (h.endsWith('musimundo.com')) return 'musimundo';
    if (h.endsWith('cetrogar.com.ar')) return 'cetrogar';
    if (h.endsWith('megatone.net')) return 'megatone';
    if (h.endsWith('diaonline.supermercadosdia.com.ar')) return 'dia';
    if (h.endsWith('jumbo.com.ar')) return 'jumbo';
    if (h.endsWith('disco.com.ar')) return 'disco';
    if (h.endsWith('sodimac.com.ar')) return 'sodimac';
    if (h.endsWith('easy.com.ar')) return 'easy';
    if (h.endsWith('hendel.com.ar')) return 'hendel';
    if (h.endsWith('rodo.com.ar')) return 'rodo';
    return null;
  }

  // Acepta múltiples formatos:
  //   "$ 1.234.567,89" (AR) → 1234567.89
  //   "1,234,567.89"   (US) → 1234567.89
  //   "1234.56"        (schema.org / meta itemprop="price") → 1234.56
  //   "1234,56"        (AR sin separador de miles) → 1234.56
  // Heurística: si aparecen los dos separadores, el último es el decimal.
  // Si aparece uno solo, es decimal sólo si quedan 1–2 dígitos detrás.
  // Si rawString viene de un meta/attribute (forceUSDecimal=true), forzamos
  // formato US porque schema.org lo exige así.
  function normalizePrice(rawString, opts) {
    if (rawString == null) return null;
    const forceUSDecimal = !!(opts && opts.forceUSDecimal);
    const s = String(rawString).trim();
    if (!s) return null;
    let cleaned = s.replace(/[^\d.,-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return null;

    if (forceUSDecimal) {
      // Formato schema.org: "1234.56" o "1,234.56" — coma siempre miles.
      cleaned = cleaned.replace(/,/g, '');
    } else {
      const hasDot = cleaned.includes('.');
      const hasComma = cleaned.includes(',');
      if (hasDot && hasComma) {
        // El separador más a la derecha es el decimal.
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        if (lastComma > lastDot) {
          // AR clásico: "1.234.567,89"
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
          // US clásico: "1,234,567.89"
          cleaned = cleaned.replace(/,/g, '');
        }
      } else if (hasComma) {
        // Sólo coma: decimal si quedan 1–2 dígitos detrás, miles si más.
        const after = cleaned.length - cleaned.lastIndexOf(',') - 1;
        if (after === 1 || after === 2) {
          cleaned = cleaned.replace(',', '.');
        } else {
          cleaned = cleaned.replace(/,/g, '');
        }
      } else if (hasDot) {
        // Sólo punto: decimal si quedan 1–2 dígitos detrás, miles si más.
        const after = cleaned.length - cleaned.lastIndexOf('.') - 1;
        if (after === 1 || after === 2) {
          // ya está bien
        } else {
          cleaned = cleaned.replace(/\./g, '');
        }
      }
    }

    if (!cleaned || cleaned === '-' || cleaned === '.') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  // Selectores por retailer viven en utils/retailers.js (issue #6).
  // Fallback inline para defensa en profundidad si retailers.js no cargó.
  const RETAILERS = (ns && ns.RETAILERS) || {};
  const PRICE_SELECTORS = Object.fromEntries(
    Object.entries(RETAILERS).map(([k, cfg]) => [k, cfg.selectors || []])
  );

  const GENERIC_PRICE_SELECTORS = (ns && ns.GENERIC_PRICE_SELECTORS) || [
    'meta[itemprop="price"]',
    '[itemprop="price"]',
    '.price',
    '.product-price',
    '[data-testid*="price" i]',
  ];

  // Devuelve { raw, fromAttribute }. fromAttribute=true significa que el valor
  // viene de un atributo (meta content / data-* / itemprop content) y por lo
  // tanto debe parsearse como formato US (schema.org).
  function readPriceFromElement(el) {
    if (!el) return { raw: null, fromAttribute: false };
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'meta') {
      return { raw: el.getAttribute('content'), fromAttribute: true };
    }
    if (el.getAttribute && el.getAttribute('itemprop') === 'price') {
      const c = el.getAttribute('content');
      if (c) return { raw: c, fromAttribute: true };
      return { raw: el.textContent, fromAttribute: false };
    }
    // Algunos retailers exponen el precio como data-price="1234.56" en formato US.
    if (el.dataset) {
      const dp = el.dataset.price || el.dataset.value || el.dataset.amount;
      if (dp) return { raw: dp, fromAttribute: true };
    }
    return { raw: el.textContent, fromAttribute: false };
  }

  function tryLdJsonPrice() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        let parsed;
        try {
          parsed = JSON.parse(s.textContent);
        } catch (e) {
          continue;
        }
        // Algunos retailers (VTEX, Shopify) emiten ld+json envuelto en @graph
        // (un array de nodos hermanos). walkLdJson ya recurse por keys, pero
        // promovemos @graph al toplevel para asegurar el find del Product.
        const root = (parsed && parsed['@graph']) ? parsed['@graph'] : parsed;
        const found = walkLdJson(root);
        if (found != null) {
          const n = Number(found);
          if (Number.isFinite(n) && n > 0) return n;
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  // Devuelve true si el offer está OutOfStock/Discontinued/SoldOut según
  // schema.org availability. Cualquier otro valor (InStock, PreOrder, ausente)
  // se considera vendible y por lo tanto se acepta su precio.
  function isOfferOutOfStock(offer) {
    if (!offer || typeof offer !== 'object') return false;
    const av = offer.availability;
    if (!av) return false;
    const s = String(av).toLowerCase();
    return /outofstock|discontinued|soldout/.test(s);
  }

  function pickOfferPrice(offer) {
    if (!offer || typeof offer !== 'object') return null;
    if (isOfferOutOfStock(offer)) return null;
    // Preferencia: price > priceSpecification.price > lowPrice. lowPrice/highPrice
    // son del AggregateOffer y suelen ser el rango de listado, no el precio
    // del producto seleccionado en la PDP. Sólo usamos lowPrice como último
    // recurso (cuando no hay price visible).
    if (offer.price != null) return offer.price;
    if (offer.priceSpecification && typeof offer.priceSpecification === 'object') {
      const ps = offer.priceSpecification;
      if (ps.price != null) return ps.price;
      // priceSpecification también puede ser array (rare).
      if (Array.isArray(ps) && ps[0] && ps[0].price != null) return ps[0].price;
    }
    if (offer.lowPrice != null) return offer.lowPrice;
    return null;
  }

  function walkLdJson(node) {
    if (node == null) return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const r = walkLdJson(item);
        if (r != null) return r;
      }
      return null;
    }
    if (typeof node !== 'object') return null;

    const t = node['@type'];
    const isProduct = t === 'Product' || (Array.isArray(t) && t.includes('Product'));
    if (isProduct && node.offers) {
      const offers = node.offers;
      if (Array.isArray(offers)) {
        // Recorrer todos los offers y devolver el primero con precio válido
        // y stock disponible. Esto evita devolver lowPrice de un offer
        // OutOfStock cuando hay otro offer con stock más arriba en la PDP.
        for (const o of offers) {
          const p = pickOfferPrice(o);
          if (p != null) return p;
        }
      } else if (typeof offers === 'object') {
        const p = pickOfferPrice(offers);
        if (p != null) return p;
      }
    }

    // Walk nested values
    for (const k of Object.keys(node)) {
      const r = walkLdJson(node[k]);
      if (r != null) return r;
    }
    return null;
  }

  // Detecta precios "antes" tachados (line-through) para ignorarlos.
  // Mira el elemento y hasta 3 ancestros: si el style computado, inline style,
  // o cualquier clase contiene line-through / "old"/"previous"/"antes"/"strike"
  // lo skip. También detecta wrappers <s> y <del>.
  function isStrikethroughPrice(el) {
    if (!el || typeof el.closest !== 'function') return false;
    let node = el;
    for (let i = 0; i < 4 && node; i++) {
      const tag = (node.tagName || '').toLowerCase();
      if (tag === 's' || tag === 'del' || tag === 'strike') return true;
      const cls = ((node.className && node.className.baseVal) || node.className || '') + '';
      // Patrones AR (antes, tachado), EN (line-through, strike, crossed), VTEX
      // camelCase (oldPrice, originalPrice, listPrice, regularPrice, wasPrice,
      // productPriceOld), Magento (old-price, special-price-from), Shopify
      // (price--compare-at, price__compare-at), txt-strike, sale-price-from.
      if (/line-through|strike|crossed|old[-_]?price|oldprice|previous[-_]?price|prev[-_]?price|list[-_]?price|listprice|regular[-_]?price|regularprice|was[-_]?price|wasprice|antes|tachad|original[-_]?price|originalprice|compare[-_]?at|compareat|product[-_]?price[-_]?old|priceold|txt[-_]?strike|crossed[-_]?out|crossedout|from[-_]?price|fromprice|reference[-_]?price|referenceprice|previousprice|preciotachado|precio[-_]?anterior|sale[-_]?off|saleoff|msrp|retail[-_]?price|retailprice|before[-_]?price|beforeprice|pretty[-_]?strike|pre[-_]?discount|prediscount|de\s*\$|wasamount|was[-_]?amount/i.test(cls)) {
        return true;
      }
      // Inline style (algunos retailers usan style="text-decoration: line-through")
      try {
        const inline = (node.getAttribute && node.getAttribute('style')) || '';
        if (/line-through/i.test(inline)) return true;
      } catch (_) { /* ignore */ }
      try {
        const cs = node.ownerDocument && node.ownerDocument.defaultView
          ? node.ownerDocument.defaultView.getComputedStyle(node) : null;
        if (cs && (cs.textDecorationLine || cs.textDecoration || '').includes('line-through')) {
          return true;
        }
      } catch (_) { /* ignore */ }
      node = node.parentElement;
    }
    return false;
  }

  // Detecta precios que en realidad son cuotas/intereses ("12 cuotas de $1.234,56",
  // "$1.234,56 x 12 cuotas", "Cuotas sin interés", "promo bancaria"). Mira el
  // texto del elemento y hasta 4 ancestros buscando indicadores típicos AR.
  // Si el texto del propio elemento es "12 cuotas de $1.234" lo descartamos sin
  // mirar ancestros: extraer ese precio como total seria un bug grave (suele ser
  // 1/12 del precio real).
  function isInstallmentPrice(el) {
    if (!el || typeof el.closest !== 'function') return false;
    // 1) Inspección directa del texto del elemento (más rápido y certero).
    let ownText = '';
    try { ownText = (el.textContent || '').trim(); } catch (_) {}
    if (/\bcuotas?\s+(de|sin|fijas|con|mensuales|fijas\s+sin)\b/i.test(ownText)) return true;
    if (/\bx\s+\d{1,2}\s+cuotas?\b/i.test(ownText)) return true;
    if (/\b\d{1,2}\s*x\s*\$/i.test(ownText)) return true; // "12x $1.234"
    if (/\bpor\s+mes\b/i.test(ownText)) return true; // "$1.234 por mes"
    if (/\bal\s+mes\b/i.test(ownText)) return true; // "$1.234 al mes"
    if (/\bmensuales?\b/i.test(ownText) && /\$/.test(ownText)) return true;
    if (/\bhasta\s+(en\s+)?\d{1,2}\s+cuotas?\b/i.test(ownText)) return true;
    // Programa "Cuota Simple" del gobierno argentino (3/6 cuotas fijas con tasa).
    if (/\bcuota\s+simple\b/i.test(ownText)) return true;
    // "Sin interés" usado solo en contexto de cuotas (raramente aparece sin "cuotas"
    // al lado en un nodo de precio principal — si aparece, es indicador de cuotas).
    if (/\bsin\s+inter[eé]s\b/i.test(ownText)) return true;
    // "Financiación" / "financiado en X pagos".
    if (/\bfinanciaci[oó]n\b/i.test(ownText)) return true;
    if (/\b\d{1,2}\s+pagos?\s+(de|sin|fijos)\b/i.test(ownText)) return true;
    // "Precio por mes" / "Precio mensual" explícito.
    if (/\bprecio\s+mensual\b/i.test(ownText)) return true;
    // 2) Ancestros: buscar contenedores marcados como cuotas/promo/instalment.
    let node = el;
    for (let i = 0; i < 4 && node; i++) {
      const cls = ((node.className && node.className.baseVal) || node.className || '') + '';
      const id = (node.id || '') + '';
      const dataTest = (node.getAttribute && (node.getAttribute('data-testid') || node.getAttribute('data-test-id'))) || '';
      const blob = `${cls} ${id} ${dataTest}`;
      // installment / cuota / finance / monthly / promo bancaria / mensual / Ahora-12 (Argentina) /
      // Cuota Simple, financiacion, pagos-fijos, finance-row, paymentplan.
      if (/installment|cuota|finance|finan|monthly|per[-_]?month|permonth|promo[-_]?banc|promobanc|mensual|ahora[-_]?12|ahora12|ahora-?\d{1,2}|nowx\d|cuota[-_]?simple|cuotasimple|payment[-_]?plan|paymentplan|pago[-_]?fijo|pagofijo/i.test(blob)) return true;
      node = node.parentElement;
    }
    return false;
  }

  // Detecta nodos visualmente ocultos. Algunos retailers conservan en el DOM
  // un precio "anterior" con display:none / visibility:hidden / aria-hidden=true
  // que tiene mejor markup que el visible (data-price-amount, content="…"),
  // así que un parser ingenuo lo agarra primero. Filtrarlo evita falsos
  // descuentos. Sólo aplica a elementos no-meta (un meta itemprop="price"
  // legítimamente nunca está visible).
  function isHiddenNode(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'meta' || tag === 'link' || tag === 'script') return false;
    try {
      if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return true;
      // HTML5 `hidden` attribute (algunos retailers la usan para variantes
      // no-seleccionadas que tienen su propio precio renderizado en el DOM).
      if (el.hasAttribute && el.hasAttribute('hidden')) return true;
      const inline = (el.getAttribute && el.getAttribute('style')) || '';
      if (/display\s*:\s*none/i.test(inline)) return true;
      if (/visibility\s*:\s*hidden/i.test(inline)) return true;
      // opacity:0 + pointer-events:none es otro patrón típico.
      if (/opacity\s*:\s*0(?!\.)/i.test(inline) && /pointer-events\s*:\s*none/i.test(inline)) return true;
      const cs = el.ownerDocument && el.ownerDocument.defaultView
        ? el.ownerDocument.defaultView.getComputedStyle(el) : null;
      if (cs) {
        if (cs.display === 'none') return true;
        if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return true;
      }
    } catch (_) { /* ignore */ }
    return false;
  }

  function extractPrice(siteKey) {
    const info = extractPriceInfo(siteKey);
    return info ? info.price : null;
  }

  // Detecta nodos cuyo textContent es un placeholder no-numérico ("Consultar
  // precio", "Sin stock", "Agotado", "Producto agotado", "Próximamente"). Algunos
  // retailers AR (Garbarino, Naldo, Cetrogar) renderizan estos strings dentro del
  // mismo selector `.product-price` cuando no hay precio. Sin este filtro, el
  // parser puede agarrar un meta `itemprop="price"` con `content="0"` que ya
  // pasa isPriceSane (rechazado por <1) — pero sirve también para evitar
  // selectores `.price` con texto literal.
  function isPlaceholderPriceText(el) {
    if (!el || !el.textContent) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'meta') return false; // los metas no tienen textContent visible
    let txt = '';
    try { txt = (el.textContent || '').trim(); } catch (_) { return false; }
    if (!txt) return false;
    // Placeholders típicos: si el nodo NO tiene ningún dígito, claramente no es precio.
    if (!/\d/.test(txt)) {
      if (/consultar|agotad|sin\s+stock|próximamente|proximamente|no\s+disponible|preventa|comuníquese|comuniquese|pre[-_]?venta|stock\s+limitado/i.test(txt)) {
        return true;
      }
    }
    return false;
  }

  // Detecta currency mismatch: si el documento expone og:price:currency u otra
  // pista y NO es ARS (algunos retailers AR listan electrónicos con precio USD
  // y un disclaimer "USD se convierte al cambio"), preferimos no clasificar
  // porque el histórico que tenemos en backend es siempre ARS y el cruce sería
  // engañoso. Devuelve la currency declarada (uppercased) o null.
  function detectDocumentCurrency() {
    try {
      const sels = [
        'meta[property="og:price:currency"]',
        'meta[property="product:price:currency"]',
        'meta[itemprop="priceCurrency"]',
      ];
      for (const sel of sels) {
        const el = document.querySelector(sel);
        const c = el && el.getAttribute && el.getAttribute('content');
        if (c) return String(c).trim().toUpperCase();
      }
      // Fallback: ld+json sin walkear todo.
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const txt = s.textContent || '';
        const m = txt.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/);
        if (m) return m[1];
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  // Sanity check: descartar precios obviamente espurios. Hot Sale AR rara vez
  // tiene productos por menos de $100 (excepto centavos sueltos de error de
  // parsing) ni más de $1.000.000.000 (son outliers de typos en JSON-LD).
  // El piso bajo es 1 porque schema.org permite "0.00" para "ver precio en
  // el carrito" — si quedó en 0 no es informativo. El techo alto evita que
  // un parse de "12345678901" como cents (123.456.789,01) pase como real.
  function isPriceSane(n) {
    if (!Number.isFinite(n)) return false;
    if (n < 1) return false;
    if (n > 1e9) return false;
    return true;
  }

  // Para Mercado Libre: el `.andes-money-amount__fraction` contiene solo la
  // parte entera ("1.234"). Para precios con cents no triviales (raro en ARS
  // pero ocurre), preferimos leer el ancestro `.andes-money-amount` que tiene
  // el precio completo ("$ 1.234,56") en su textContent + un atributo
  // `aria-label="Pesos 1234 con 56 centavos"`.
  function readMlPrice(el) {
    if (!el) return null;
    // Si el elemento ya es .andes-money-amount, usar su aria-label como fuente
    // confiable (siempre formato US-ish: "Pesos 1234 con 56 centavos").
    const moneyAmount = (el.classList && el.classList.contains('andes-money-amount'))
      ? el
      : (typeof el.closest === 'function' ? el.closest('.andes-money-amount') : null);
    if (moneyAmount) {
      const aria = moneyAmount.getAttribute('aria-label') || '';
      // "Pesos 1234 con 56 centavos" → 1234.56
      const m = aria.match(/(\d[\d\.,]*)\s*(?:con\s+(\d{1,2})\s*centavos?)?/i);
      if (m) {
        const ent = m[1] ? m[1].replace(/[.,]/g, '') : '';
        const cents = m[2] || '';
        if (ent) {
          const composed = cents ? `${ent}.${cents.padStart(2, '0')}` : ent;
          const n = Number(composed);
          if (Number.isFinite(n) && n > 0) return n;
        }
      }
      // Sin aria-label: combinar fraction + cents si existen.
      const frac = moneyAmount.querySelector('.andes-money-amount__fraction');
      const cents = moneyAmount.querySelector('.andes-money-amount__cents');
      if (frac) {
        const ent = (frac.textContent || '').replace(/[^\d]/g, '');
        const c = cents ? (cents.textContent || '').replace(/[^\d]/g, '') : '';
        if (ent) {
          const composed = c ? `${ent}.${c.padStart(2, '0')}` : ent;
          const n = Number(composed);
          if (Number.isFinite(n) && n > 0) return n;
        }
      }
    }
    return null;
  }

  // Issue #2: parser por retailer devuelve {price, currency, retailer}.
  function extractPriceInfo(siteKey) {
    const retailer = siteKey || detectSite(location.hostname) || null;
    const siteSelectors = (retailer && PRICE_SELECTORS[retailer]) ? PRICE_SELECTORS[retailer] : [];
    const selectors = [...siteSelectors, ...GENERIC_PRICE_SELECTORS];

    for (const sel of selectors) {
      let nodes;
      try {
        nodes = document.querySelectorAll(sel);
      } catch (e) {
        continue;
      }
      for (const el of nodes) {
        // Saltar nodos ocultos (display:none / visibility:hidden / aria-hidden).
        // Excepto meta tags, que siempre son "ocultos" pero válidos.
        if (isHiddenNode(el)) continue;
        // Saltar precios visiblemente tachados (precio anterior, "antes").
        if (isStrikethroughPrice(el)) continue;
        // Saltar precios que en realidad son cuotas mensuales o promos
        // bancarias (el ancestro o el propio texto lo declara).
        if (isInstallmentPrice(el)) continue;
        // Saltar placeholders textuales tipo "Consultar precio" / "Sin stock".
        if (isPlaceholderPriceText(el)) continue;

        // Camino especializado para Mercado Libre: reconstruir desde el
        // contenedor `.andes-money-amount` para no perder los cents.
        if (retailer === 'mercadolibre') {
          const ml = readMlPrice(el);
          if (isPriceSane(ml)) {
            return { price: ml, currency: 'ARS', retailer };
          }
        }

        const { raw, fromAttribute } = readPriceFromElement(el);
        const n = normalizePrice(raw, { forceUSDecimal: fromAttribute });
        if (isPriceSane(n)) {
          return { price: n, currency: 'ARS', retailer };
        }
      }
    }

    const ld = tryLdJsonPrice();
    if (ld != null && isPriceSane(ld)) {
      return { price: ld, currency: 'ARS', retailer };
    }

    return null;
  }

  function canonicalUrl(href) {
    try {
      const u = new URL(href);
      return u.protocol + '//' + u.host.toLowerCase() + u.pathname;
    } catch (e) {
      return href;
    }
  }

  // productKey: identifica un producto + variante. La URL canónica solita no
  // alcanza porque retailers como Mercado Libre, Frávega, Falabella mantienen
  // la URL fija al cambiar talle/color y solo cambian un query param o el
  // estado del DOM. Combinamos canonicalUrl con SKU/variantId/color cuando el
  // DOM los expone (data-* o JSON-LD).
  function productKey(href) {
    const base = canonicalUrl(href || location.href);
    let variant = '';
    try {
      // 1) Variante en el query (ML usa ?variation=...)
      const u = new URL(href || location.href);
      const variationParams = ['variation', 'sku', 'pid', 'productId', 'variant'];
      for (const k of variationParams) {
        const v = u.searchParams.get(k);
        if (v) { variant += `|${k}=${v}`; }
      }
      // 2) DOM: el elemento [data-sku] / [data-product-id] suele actualizarse
      //    al cambiar variante.
      const skuEl = document.querySelector('[data-sku],[data-product-sku],[data-product-id],[data-variant-id]');
      if (skuEl) {
        const sku = skuEl.getAttribute('data-sku')
          || skuEl.getAttribute('data-product-sku')
          || skuEl.getAttribute('data-product-id')
          || skuEl.getAttribute('data-variant-id');
        if (sku) variant += `|sku=${sku}`;
      }
      // 3) Variante seleccionada en el atributo aria-pressed/selected.
      const selectedSwatch = document.querySelector(
        '[role="radio"][aria-checked="true"][data-value],' +
        '[aria-pressed="true"][data-value],' +
        '[aria-selected="true"][data-value],' +
        '.is-selected[data-value],' +
        '.selected[data-value]'
      );
      if (selectedSwatch) {
        const v = selectedSwatch.getAttribute('data-value');
        if (v) variant += `|swatch=${v}`;
      }
    } catch (_) { /* ignore */ }
    return base + variant;
  }

  function fallbackClassify(current, history) {
    const DAY = 86400;
    const now = Math.floor(Date.now() / 1000);
    if (!current || !Array.isArray(history) || history.length < 5) {
      return { kind: 'unknown', pct: 0, label: 'Precio Real: sin datos', sub: 'Histórico insuficiente' };
    }
    const last7 = history.filter(h => now - h.scraped_at <= 7 * DAY).map(h => h.price);
    const prev23 = history.filter(h => {
      const age = now - h.scraped_at;
      return age > 7 * DAY && age <= 30 * DAY;
    }).map(h => h.price);
    if (prev23.length === 0) {
      return { kind: 'unknown', pct: 0, label: 'Precio Real: sin baseline', sub: '' };
    }
    const sorted = [...prev23].sort((a, b) => a - b);
    const baseline = sorted[Math.floor(sorted.length / 2)];
    const max7 = last7.length ? Math.max(...last7) : current;
    if (max7 >= baseline * 1.10 && current >= baseline * 0.95) {
      const pct = Math.round(((max7 - baseline) / baseline) * 100);
      return { kind: 'inflated', pct, label: 'Precio Real: ✗ INFLADO', sub: `Subió ${pct}% la semana pasada` };
    }
    if (current <= baseline * 0.95) {
      const pct = Math.round(((baseline - current) / baseline) * 100);
      return { kind: 'real', pct, label: 'Precio Real: ✓ DESCUENTO REAL', sub: `-${pct}% vs. histórico` };
    }
    return { kind: 'neutral', pct: 0, label: 'Precio Real: sin descuento', sub: 'Estable vs. histórico' };
  }

  function formatDiscount(pct) {
    // pct is a number (e.g., 12.3) or null. Returns "+12.3%" / "-4.0%" / "—".
    if (pct === null || pct === undefined || Number.isNaN(pct)) return "—";
    const sign = pct > 0 ? "+" : "";  // negative numbers already have "-"
    return `${sign}${pct.toFixed(1)}%`;
  }

  // ── Detección "página de producto" reforzada ──────────────────────────────
  // isProductPageStrict() devuelve true solo cuando hay señales fuertes:
  // schema.org Product, og:type=product, JSON-LD con Product, o microdata con
  // itemtype Product. Se complementa con `urlLooksLikeListing()` que marca como
  // false hits típicos de categoría/listado.
  function urlLooksLikeListing(siteKey, pathname) {
    const p = (pathname || location.pathname || '').toLowerCase();
    // Patrones genéricos de listado/categoría/búsqueda.
    if (/^\/(categor[ií]a|categorias|seccion|secciones|listado|listing|search|busqueda|buscar|ofertas|outlet|hot[-_]?sale|cyber|black[-_]?friday|marca|marcas|departamento|colecci[oó]n|colecciones)(\/|$)/i.test(p)) {
      return true;
    }
    // ML: /listado, /listings, /jm/search
    if (siteKey === 'mercadolibre') {
      if (p.startsWith('/listado') || p.includes('/jm/search') || p.startsWith('/c/')) return true;
    }
    // VTEX (jumbo, disco, dia, easy, hendel): URLs de search típicamente terminan en `?map=...&_q=`.
    if (location.search && /[?&]map=/.test(location.search) && !/[?&]sku=/.test(location.search)) {
      return true;
    }
    return false;
  }

  function hasProductMicrodata() {
    try {
      if (document.querySelector('[itemtype*="schema.org/Product" i]')) return true;
      if (document.querySelector('[itemprop="price"]')) return true;
      const og = document.querySelector('meta[property="og:type"]');
      if (og && /product/i.test(og.getAttribute('content') || '')) return true;
      const ld = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of ld) {
        const txt = s.textContent || '';
        if (/"@type"\s*:\s*"?Product"?/i.test(txt) || txt.includes('"Product"')) return true;
      }
    } catch (_) { /* ignore */ }
    return false;
  }

  function isProductPageStrict(siteKey) {
    try {
      if (urlLooksLikeListing(siteKey)) return false;
      if (siteKey === 'mercadolibre') {
        if (location.hostname.startsWith('articulo.')) return true;
        if (/\/p\//.test(location.pathname)) return true;
        if (/MLA-?\d+/i.test(location.pathname)) return true;
        return false;
      }
      if (hasProductMicrodata()) return true;
      // Fallback: existe nodo de precio típico en el viewport.
      if (document.querySelector('.price, .product-price, [data-testid*="price" i], [data-test-id*="price" i]')) {
        // …pero también hay un contenedor "producto" (form add-to-cart, gallery, sku).
        const productSignals = document.querySelector(
          '[itemtype*="Product" i], [data-testid*="product" i], [data-test-id*="product" i], ' +
          'button[aria-label*="agregar" i], button[aria-label*="add to cart" i], ' +
          '[id*="addToCart" i], form[action*="cart" i]'
        );
        if (productSignals) return true;
      }
    } catch (_) { return true; /* ante duda, intentar */ }
    return false;
  }

  ns.SUPPORTED_SITES = SUPPORTED_SITES;
  ns.detectSite = detectSite;
  ns.normalizePrice = normalizePrice;
  ns.PRICE_SELECTORS = PRICE_SELECTORS;
  ns.extractPrice = extractPrice;
  ns.extractPriceInfo = extractPriceInfo;
  ns.canonicalUrl = canonicalUrl;
  ns.productKey = productKey;
  ns.fallbackClassify = fallbackClassify;
  ns.formatDiscount = formatDiscount;
  ns.urlLooksLikeListing = urlLooksLikeListing;
  ns.hasProductMicrodata = hasProductMicrodata;
  ns.isProductPageStrict = isProductPageStrict;
  ns.isStrikethroughPrice = isStrikethroughPrice;
  ns.isInstallmentPrice = isInstallmentPrice;
  ns.isHiddenNode = isHiddenNode;
  ns.isPriceSane = isPriceSane;
  ns.isPlaceholderPriceText = isPlaceholderPriceText;
  ns.detectDocumentCurrency = detectDocumentCurrency;
  ns.log = log;
  ns.DEBUG = DEBUG;
})();
