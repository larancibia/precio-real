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
    naldo: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    musimundo: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    cetrogar: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    megatone: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    dia: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    jumbo: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    disco: {
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
    rodo: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    ribeiro: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    compumundo: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    samsung: {
      enabled: true,
      utm: {
        source: 'precio-real',
        medium: 'extension',
        campaign: 'descuento-real',
      },
    },
    // Ciclo 14: marcas oficiales AR.
    lg: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    sony: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    philips: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    bgh: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    noblex: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    whirlpool: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1582: nuevos retailers Hot Sale AR.
    changomas: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    electrolux: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    drean: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    motorola: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    todomodo: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1584: Amazon AR + HiperTehno.
    amazon: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    hipertehno: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1599: Xiaomi Store AR, Philco AR, Venex.
    xiaomi: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    philco: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    venex: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1594: Bgood, HP Tienda AR, Lenovo Store AR, Alphatec, EXO AR.
    bgood: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    hptienda: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    lenovo: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    alphatec: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    exo: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1596: Hisense AR, TCL AR, Pycca.
    hisense: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    tcl: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    pycca: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1613: Newsan (VTEX appliances), Asus Store AR, Mac Center (WooCommerce).
    newsan: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    asus: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    maccenter: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1603: Full (WooCommerce), Micro Center AR (Magento 2), iPoint AR (Shopify).
    full: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    microcenter: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    ipoint: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1606: Acer Store AR (Magento 2), Coolbox AR (Shopify gaming), Olimpo AR (WooCommerce).
    acer: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    coolbox: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    olimpo: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1607: Dexter AR (Shopify deportes), TGC AR (Magento 2 gaming),
    // Maxiconsumo AR (VTEX supermercado mayorista).
    dexter: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    tgc: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    maxiconsumo: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1608: FullH4rd AR (Shopify gaming), StartTech AR (Magento 2), PC House AR (WooCommerce).
    fullh4rd: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    starttech: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    pchouse: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1609: MaxiHogar (VTEX), PC Factory (Magento 2), CompraGamer (custom),
    // Golden Shop (Shopify), Soluciones (WooCommerce).
    maxihogar: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    pcfactory: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    compragamer: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    goldenshop: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    soluciones: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1610: Zetta AR (WooCommerce), Geek Store AR (Shopify gaming),
    // Computodo AR (Magento 2 hardware/PC).
    zetta: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    geekstore: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    computodo: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1612: Arredondo (PrestaShop electrónica), iThink (Shopify Apple reseller),
    // Nexstore (Magento 2 gaming/PC), Cable Hogar (WooCommerce electrónica).
    arredondo: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    ithink: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    nexstore: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    cablehogar: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1614: Bit (Shopify gaming/hardware), Digital Haus (WooCommerce electrónica),
    // InStore (Magento 2 audio/video hifi), Staples AR (WooCommerce oficina),
    // Gotta (WooCommerce gaming/periféricos).
    bit: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    digitalhaus: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    instore: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    staples: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    gotta: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1615: Powerplanet (WooCommerce gaming/periféricos), I-Gaming Store (Shopify
    // gaming/hardware), Netizar (Magento 2 hardware/networking), Megastore AR
    // (WooCommerce electrónica), Centurytech (Magento 2 hardware/PC).
    powerplanet: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    igaming: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    netizar: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    megastore: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    centurytech: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1616: Klibr (Shopify gaming/periféricos), Lazer (Shopify gaming sillas/periféricos),
    // PcArg (WooCommerce componentes/hardware/gaming AR).
    klibr: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    lazer: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    pcarg: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1617: GearZone AR (Shopify gaming bundles/periféricos), Binario AR
    // (WooCommerce componentes/hardware gaming), CompuPC AR (WooCommerce hardware/PC).
    gearzone: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    binario: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    compupc: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1618: retailers que faltaban en affiliates.js (ya estaban en retailers/manifest).
    carsa: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    grupodin: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    coppel: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    megatronics: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    macstation: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    winpy: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    // Ciclo 1618: nuevos retailers.
    autronic: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    megatrix: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
    },
    pixelstore: {
      enabled: true,
      utm: { source: 'precio-real', medium: 'extension', campaign: 'descuento-real' },
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
