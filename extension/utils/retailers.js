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
        // PDP nuevo (Next.js) usa data-test-id sobre el span.
        '[data-test-id="product-price"]',
        '[data-test-id="product-price-current"]',
        '[data-test-id="product-pdp-price"]',
        // Styled-components con hash variable: matchear prefijos.
        'span[class*="sc-" i][class*="Price" i]',
        'span[class*="sale-price" i]',
        'span[class*="OfferPrice" i]',
        'span[class*="Price-sc" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    garbarino: {
      label: 'Garbarino',
      hostnameSuffix: 'garbarino.com',
      currency: 'ARS',
      selectors: [
        // Garbarino migró parcial a VTEX/Next.js: ambos patrones presentes.
        '[data-testid="price"]',
        '[data-test-id="price"]',
        '[data-testid="product-price"]',
        '[data-test-id="product-price"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '[class*="sellingPrice" i]',
        '.price-label',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
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
        '[data-testid="testPointer-bigPrice"]',
        'li[data-cmr-price]',
        'li[data-internet-price]',
        '.copy10',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    carrefour: {
      label: 'Carrefour',
      hostnameSuffix: 'carrefour.com.ar',
      currency: 'ARS',
      selectors: [
        // Carrefour AR está en FastStore (FS = data-fs-* attrs). El selling
        // price tiene su propio data-fs-price-variant="selling".
        '[data-fs-price-variant="selling"]',
        '[data-fs-product-price]',
        '[data-test-id="price"]',
        '[data-testid="price-value"]',
        'span[class*="currencyContainer" i]',
        'span[class*="price__value" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    coto: {
      label: 'Coto',
      hostnameSuffix: 'cotodigital3.com.ar',
      currency: 'ARS',
      selectors: [
        // Coto Digital 3 (ATG legacy): atg_store_newPrice. Coto Digital 4
        // (rediseño 2024) usa data-testid="price-value" y .priceLabel.
        '[data-testid="price-value"]',
        '.priceLabel',
        '.atg_store_newPrice',
        '.product_price',
        'span[class*="newPrice" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    naldo: {
      label: 'Naldo',
      hostnameSuffix: 'naldo.com.ar',
      currency: 'ARS',
      selectors: [
        '[data-testid="product-price"]',
        '[data-test-id="product-price"]',
        '[data-testid="pdp-price-value"]',
        'span[class*="sc-" i][class*="Price" i]',
        '.product-price',
        'span[class*="Price-sc" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    musimundo: {
      label: 'Musimundo',
      hostnameSuffix: 'musimundo.com',
      currency: 'ARS',
      selectors: [
        // Musimundo (VTEX): el sellingPrice es el del producto seleccionado.
        '[data-testid="price-value"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '.price-value',
        '.product-price',
        'span[class*="price" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    cetrogar: {
      label: 'Cetrogar',
      hostnameSuffix: 'cetrogar.com.ar',
      currency: 'ARS',
      selectors: [
        // Cetrogar Magento 2: data-price-amount es el camino más confiable.
        // .price-final_price .price es donde Magento renderea el precio final.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.product-price-container .price',
        '.price-best-price',
        '[data-price-amount]',
        '.special-price [data-price-amount]',
        '.special-price .price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    megatone: {
      label: 'Megatone',
      hostnameSuffix: 'megatone.net',
      currency: 'ARS',
      selectors: [
        // Megatone es ASP.NET clásico: el precio venta vive en un span con id.
        // El "PrecioConFinanciacion" suele ser el precio con tarjeta y debe
        // evitarse — preferimos PrecioVenta (efectivo/transferencia).
        '#lblPrecioVenta',
        '#lblPrecio',
        '#PrecioVenta',
        '.precio-venta',
        '.precio',
        'span[class*="precio" i]:not([class*="financiacion" i]):not([class*="cuota" i])',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    dia: {
      label: 'Día',
      hostnameSuffix: 'diaonline.supermercadosdia.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPriceValue" i]',
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
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '.jumboargentinaio-store-theme-1ydiUYi5RQt9V_LCJ7I36W',
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.product-price__price',
        '[class*="sellingPriceValue" i]',
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
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.product-price__price',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="Price" i]',
      ],
    },
    sodimac: {
      label: 'Sodimac',
      hostnameSuffix: 'sodimac.com.ar',
      currency: 'ARS',
      selectors: [
        // Sodimac comparte plataforma con Falabella (Linio Group), por eso
        // los mismos data-attrs aparecen.
        '[data-testid="product-detail-price"]',
        '[data-testid="testPointer-bigPrice"]',
        '[data-automation-id="product-price"]',
        '[data-cmr-price]',
        '[data-internet-price]',
        '.copy10',
        'span[class*="price" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    easy: {
      label: 'Easy',
      hostnameSuffix: 'easy.com.ar',
      currency: 'ARS',
      selectors: [
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPriceValue" i]',
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
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPriceValue" i]',
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
        // Priorizar el .price-final_price (precio final) sobre .old-price
        // (precio anterior tachado, ya filtrado por isStrikethroughPrice pero
        // mejor evitarlo desde el selector).
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
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
