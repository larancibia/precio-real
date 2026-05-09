// Content scripts no son módulos ES; exponemos en namespace global para evitar colisiones.
(function () {
  'use strict';

  const ns = (window.PrecioReal = window.PrecioReal || {});

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
    'hendel'
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
        const found = walkLdJson(parsed);
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
        const first = offers[0];
        if (first && (first.price != null || first.lowPrice != null)) {
          return first.price != null ? first.price : first.lowPrice;
        }
      } else if (typeof offers === 'object') {
        if (offers.price != null) return offers.price;
        if (offers.lowPrice != null) return offers.lowPrice;
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
  // Mira el elemento y hasta 3 ancestros: si el style computado o cualquier
  // clase contiene line-through / "old"/"previous"/"antes"/"strike" lo skip.
  function isStrikethroughPrice(el) {
    if (!el || typeof el.closest !== 'function') return false;
    let node = el;
    for (let i = 0; i < 4 && node; i++) {
      const cls = ((node.className && node.className.baseVal) || node.className || '') + '';
      if (/line-through|strike|crossed|old[-_]?price|previous[-_]?price|prev[-_]?price|antes|tachad/i.test(cls)) {
        return true;
      }
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

  function extractPrice(siteKey) {
    const info = extractPriceInfo(siteKey);
    return info ? info.price : null;
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
        // Saltar precios visiblemente tachados (precio anterior, "antes").
        if (isStrikethroughPrice(el)) continue;
        const { raw, fromAttribute } = readPriceFromElement(el);
        const n = normalizePrice(raw, { forceUSDecimal: fromAttribute });
        if (Number.isFinite(n) && n > 0) {
          return { price: n, currency: 'ARS', retailer };
        }
      }
    }

    const ld = tryLdJsonPrice();
    if (ld != null && Number.isFinite(ld) && ld > 0) {
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

  ns.SUPPORTED_SITES = SUPPORTED_SITES;
  ns.detectSite = detectSite;
  ns.normalizePrice = normalizePrice;
  ns.PRICE_SELECTORS = PRICE_SELECTORS;
  ns.extractPrice = extractPrice;
  ns.extractPriceInfo = extractPriceInfo;
  ns.canonicalUrl = canonicalUrl;
  ns.fallbackClassify = fallbackClassify;
  ns.formatDiscount = formatDiscount;
})();
