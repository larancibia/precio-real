// extension/utils/retailers.js
// Per-retailer parser config (issue #6). Loaded as a content script before
// helpers.js — exposes window.PrecioReal.RETAILERS for consumers.
(function () {
  'use strict';

  const ns = (window.PrecioReal = window.PrecioReal || {});

  // hostname → retailer key. detectSite() in helpers.js uses these suffixes.
  const RETAILERS = {
    mercadolibre: {
      label: 'Mercado Libre',
      hostnameSuffix: 'mercadolibre.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.ui-pdp-price__second-line .andes-money-amount__fraction',
        '.andes-money-amount__fraction',
      ],
    },
    fravega: {
      label: 'Frávega',
      hostnameSuffix: 'fravega.com',
      currency: 'ARS',
      selectors: [
        '[data-test-id="product-price"]',
        'span[class*="sale-price"]',
        'span[class*="Price"]',
      ],
    },
    garbarino: {
      label: 'Garbarino',
      hostnameSuffix: 'garbarino.com',
      currency: 'ARS',
      selectors: ['[data-testid="price"]', '.price-label', '.product-price'],
    },
    falabella: {
      label: 'Falabella',
      hostnameSuffix: 'falabella.com.ar',
      currency: 'ARS',
      selectors: ['[data-testid="prices-0"]', '.copy10', 'span[class*="price"]'],
    },
    carrefour: {
      label: 'Carrefour',
      hostnameSuffix: 'carrefour.com.ar',
      currency: 'ARS',
      selectors: ['[data-test-id="price"]', 'span[class*="currencyContainer"]'],
    },
    coto: {
      label: 'Coto',
      hostnameSuffix: 'cotodigital3.com.ar',
      currency: 'ARS',
      selectors: ['.atg_store_newPrice', '.product_price'],
    },
    naldo: {
      label: 'Naldo',
      hostnameSuffix: 'naldo.com.ar',
      currency: 'ARS',
      selectors: [
        '[data-testid="product-price"]',
        '.product-price',
        'span[class*="Price"]',
      ],
    },
    musimundo: {
      label: 'Musimundo',
      hostnameSuffix: 'musimundo.com',
      currency: 'ARS',
      selectors: [
        '[data-testid="price-value"]',
        '.price-value',
        'span[class*="price"]',
      ],
    },
    cetrogar: {
      label: 'Cetrogar',
      hostnameSuffix: 'cetrogar.com.ar',
      currency: 'ARS',
      selectors: [
        '.product-price-container .price',
        '.price-best-price',
        'span[class*="price"]',
      ],
    },
    megatone: {
      label: 'Megatone',
      hostnameSuffix: 'megatone.net',
      currency: 'ARS',
      selectors: [
        '#lblPrecioVenta',
        '.precio',
        'span[class*="precio"]',
      ],
    },
    dia: {
      label: 'Día',
      hostnameSuffix: 'diaonline.supermercadosdia.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPrice"]',
      ],
    },
    jumbo: {
      label: 'Jumbo',
      hostnameSuffix: 'jumbo.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.product-price__price',
        '[class*="Price"]',
      ],
    },
    disco: {
      label: 'Disco',
      hostnameSuffix: 'disco.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.product-price__price',
        '[class*="Price"]',
      ],
    },
    sodimac: {
      label: 'Sodimac',
      hostnameSuffix: 'sodimac.com.ar',
      currency: 'ARS',
      selectors: [
        '[data-testid="product-detail-price"]',
        '[data-automation-id="product-price"]',
        '.copy10',
        'span[class*="price"]',
      ],
    },
    easy: {
      label: 'Easy',
      hostnameSuffix: 'easy.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPrice"]',
        'span[class*="price"]',
      ],
    },
    hendel: {
      label: 'Hendel',
      hostnameSuffix: 'hendel.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        '.product-price',
        'span[class*="price"]',
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
