// extension/utils/affiliates.js
// Issue #13: Affiliate links: ML + retailers.
//
// Cuando el badge marca DESCUENTO REAL, ofrecemos un CTA que linkea al producto
// con tags de afiliado (UTM por ahora; cuando demos de alta MercadoLibre
// Afiliados u otros programas, reemplazamos `wrap()` por el deeplink real).
//
// Este archivo es content-script-friendly: cuelga todo de window.PrecioReal.
(function () {
  'use strict';

  const ns = (window.PrecioReal = window.PrecioReal || {});

  // Tags por retailer. Hoy son UTM placeholders que reportan tráfico vía GA del
  // sitio destino sin necesidad de credencial; cuando tengamos affiliate ID,
  // sumamos `template` para reescribir la URL completa.
  //
  // template: function(originalUrl, params) -> string  (opcional)
  //   Si está presente, reemplaza la URL entera. Sirve para programas que
  //   usan deeplinks (ej. ML Afiliados: https://www.mercadolibre.com.ar/social/<ID>?...).
  //
  // utm: { source, medium, campaign, content? }
  //   Siempre se aplica como query params si la URL destino es http(s) y el
  //   programa lo permite. ML lo permite (no rompe el routing).
  const AFFILIATES = {
    mercadolibre: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
      // Cuando demos de alta ML Afiliados, exportar acá:
      // template: (url, p) => `https://www.mercadolibre.com.ar/social/<AFF_ID>?word=${...}&forceInApp=false`
    },
    fravega: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    garbarino: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    falabella: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    carrefour: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    coto: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    sodimac: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    easy: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    hendel: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
  };

  function applyUtm(rawUrl, utm) {
    if (!utm) return rawUrl;
    try {
      const u = new URL(rawUrl);
      // No pisar UTMs que el sitio ya trae (campañas propias).
      if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', utm.source);
      if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', utm.medium);
      if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', utm.campaign);
      if (utm.content && !u.searchParams.has('utm_content')) {
        u.searchParams.set('utm_content', utm.content);
      }
      return u.toString();
    } catch (e) {
      return rawUrl;
    }
  }

  // wrap(rawUrl, retailerKey) -> { url, isAffiliate }
  // - url: URL final a abrir.
  // - isAffiliate: true si efectivamente le pegamos algún tag.
  function wrap(rawUrl, retailerKey) {
    if (!rawUrl) return { url: rawUrl, isAffiliate: false };
    const cfg = AFFILIATES[retailerKey];
    if (!cfg || !cfg.enabled) return { url: rawUrl, isAffiliate: false };
    if (typeof cfg.template === 'function') {
      try {
        const url = cfg.template(rawUrl, cfg);
        return { url, isAffiliate: true };
      } catch (e) {
        // Si el template explota, caemos a UTM.
      }
    }
    const url = applyUtm(rawUrl, cfg.utm);
    return { url, isAffiliate: url !== rawUrl };
  }

  ns.AFFILIATES = AFFILIATES;
  ns.affiliateWrap = wrap;
})();
