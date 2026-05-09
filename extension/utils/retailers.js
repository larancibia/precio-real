// extension/utils/retailers.js
// Per-retailer parser config (issue #6). Loaded as a content script before
// helpers.js — exposes window.PrecioReal.RETAILERS for consumers.
(function () {
  'use strict';

  const ns = (window.PrecioReal = window.PrecioReal || {});

  // hostname → retailer key. detectSite() in helpers.js uses these suffixes.
  // Notas:
  //  • Los selectores se prueban en orden. Los más específicos primero.
  //  • Los retailers VTEX (dia, jumbo, disco, easy, hendel, fravega-pdp viejo)
  //    suelen exponer `meta[itemprop="price"]` con `content="1234.56"` en formato
  //    US, parseable directo. Lo dejamos primero como camino feliz.
  //  • Evitamos selectores tipo `[class*="price" i]` muy laxos que matchean
  //    elementos de "precio anterior tachado" — para eso helpers.isStrikethroughPrice
  //    filtra, pero si podemos ser precisos, mejor.
  const RETAILERS = {
    mercadolibre: {
      label: 'Mercado Libre',
      hostnameSuffix: 'mercadolibre.com.ar',
      currency: 'ARS',
      selectors: [
        // Precio principal (oferta) en PDP:
        '.ui-pdp-price__second-line .andes-money-amount[data-testid="price-part"] .andes-money-amount__fraction',
        '.ui-pdp-price__second-line .andes-money-amount__fraction',
        '.ui-pdp-price__main-container .andes-money-amount__fraction',
        // Meta tags como último recurso (suelen estar en formato US):
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '.andes-money-amount__fraction',
      ],
    },
    fravega: {
      label: 'Frávega',
      hostnameSuffix: 'fravega.com',
      currency: 'ARS',
      selectors: [
        '[data-test-id="product-price"]',
        '[data-test-id="product-price-current"]',
        'span[class*="sale-price" i]',
        'span[class*="OfferPrice" i]',
        'span[class*="Price-sc" i]',
        'meta[itemprop="price"]',
      ],
    },
    garbarino: {
      label: 'Garbarino',
      hostnameSuffix: 'garbarino.com',
      currency: 'ARS',
      selectors: [
        '[data-testid="price"]',
        '[data-test-id="price"]',
        '.price-label',
        '.product-price',
        'meta[itemprop="price"]',
      ],
    },
    falabella: {
      label: 'Falabella',
      hostnameSuffix: 'falabella.com.ar',
      currency: 'ARS',
      selectors: [
        // Falabella usa data-internet-price / data-event-price / data-cmr-price
        // dependiendo del medio de pago. Internet price es el "neto" para todos.
        '[data-internet-price]',
        '[data-testid="prices-0"] .copy10',
        '[data-testid="prices-0"]',
        'li[data-cmr-price]',
        'li[data-internet-price]',
        '.copy10',
        'meta[itemprop="price"]',
      ],
    },
    carrefour: {
      label: 'Carrefour',
      hostnameSuffix: 'carrefour.com.ar',
      currency: 'ARS',
      selectors: [
        '[data-test-id="price"]',
        '[data-fs-product-price]',
        'span[class*="currencyContainer" i]',
        'meta[itemprop="price"]',
      ],
    },
    coto: {
      label: 'Coto',
      hostnameSuffix: 'cotodigital3.com.ar',
      currency: 'ARS',
      selectors: [
        '.atg_store_newPrice',
        '.product_price',
        'span[class*="newPrice" i]',
        'meta[itemprop="price"]',
      ],
    },
    naldo: {
      label: 'Naldo',
      hostnameSuffix: 'naldo.com.ar',
      currency: 'ARS',
      selectors: [
        '[data-testid="product-price"]',
        '[data-test-id="product-price"]',
        '.product-price',
        'span[class*="Price-sc" i]',
        'meta[itemprop="price"]',
      ],
    },
    musimundo: {
      label: 'Musimundo',
      hostnameSuffix: 'musimundo.com',
      currency: 'ARS',
      selectors: [
        '[data-testid="price-value"]',
        '.price-value',
        '.product-price',
        'span[class*="price" i]',
        'meta[itemprop="price"]',
      ],
    },
    cetrogar: {
      label: 'Cetrogar',
      hostnameSuffix: 'cetrogar.com.ar',
      currency: 'ARS',
      selectors: [
        '.product-info-price .price-final_price .price',
        '.product-price-container .price',
        '.price-best-price',
        '[data-price-amount]',
        'meta[itemprop="price"]',
      ],
    },
    megatone: {
      label: 'Megatone',
      hostnameSuffix: 'megatone.net',
      currency: 'ARS',
      selectors: [
        '#lblPrecioVenta',
        '.precio',
        'span[class*="precio" i]',
        'meta[itemprop="price"]',
      ],
    },
    dia: {
      label: 'Día',
      hostnameSuffix: 'diaonline.supermercadosdia.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
      ],
    },
    jumbo: {
      label: 'Jumbo',
      hostnameSuffix: 'jumbo.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.jumboargentinaio-store-theme-1ydiUYi5RQt9V_LCJ7I36W',
        '.vtex-product-price-1-x-sellingPrice',
        '.product-price__price',
        '[class*="sellingPrice" i]',
        '[class*="Price" i]',
      ],
    },
    disco: {
      label: 'Disco',
      hostnameSuffix: 'disco.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.vtex-product-price-1-x-sellingPrice',
        '.product-price__price',
        '[class*="sellingPrice" i]',
        '[class*="Price" i]',
      ],
    },
    sodimac: {
      label: 'Sodimac',
      hostnameSuffix: 'sodimac.com.ar',
      currency: 'ARS',
      selectors: [
        '[data-testid="product-detail-price"]',
        '[data-automation-id="product-price"]',
        '[data-cmr-price]',
        '[data-internet-price]',
        '.copy10',
        'span[class*="price" i]',
        'meta[itemprop="price"]',
      ],
    },
    easy: {
      label: 'Easy',
      hostnameSuffix: 'easy.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        'span[class*="price" i]',
      ],
    },
    hendel: {
      label: 'Hendel',
      hostnameSuffix: 'hendel.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPrice" i]',
        '.product-price',
        'span[class*="price" i]',
      ],
    },
    rodo: {
      label: 'Rodo',
      hostnameSuffix: 'rodo.com.ar',
      currency: 'ARS',
      selectors: [
        // Rodo (Magento 2 + temas custom) expone el precio en data-price-amount
        // ("amount" es US-formatted) y un span .price con AR-formatted.
        '[data-price-amount]',
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.price-box .price',
        'meta[itemprop="price"]',
        'span[class*="price" i]',
      ],
    },
  };

  const GENERIC_PRICE_SELECTORS = [
    'meta[itemprop="price"]',
    '[itemprop="price"]',
    '.price',
    '.product-price',
    '[data-testid*="price" i]',
  ];

  ns.RETAILERS = RETAILERS;
  ns.GENERIC_PRICE_SELECTORS = GENERIC_PRICE_SELECTORS;
})();
