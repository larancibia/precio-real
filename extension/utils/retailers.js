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
        // Ciclo 13: PDP de productos catálogo (/p/MLA…) tienen otra envoltura que
        // expone andes-money-amount con role="img" (lectores de pantalla). Como
        // primer pase también permite atrapar el precio cuando .ui-pdp-price__second-line
        // no apareció todavía (hidratación parcial). readMlPrice() reconstruye
        // desde aria-label, así que es seguro como ancestor selector.
        '.ui-pdp-price__second-line .andes-money-amount[role="img"]',
        '.ui-pdp-price__main-container .andes-money-amount[role="img"]',
        // Ciclo 1583: Hot Sale 2025 — ML puede envolverlo en ui-pdp-price__offer-price
        // (precio con descuento de campaña) o en ui-pdp-price__original-price (sin dcto).
        // El __offer-price tiene precedencia cuando está presente.
        '.ui-pdp-price__offer-price .andes-money-amount__fraction',
        '.ui-pdp-price__offer-price .andes-money-amount[role="img"]',
        // Variante "buy box" del listado oficial (catálogo) cuando el comprador
        // ya seleccionó un seller específico — el precio activo aparece en
        // .ui-pdp-buybox.
        '.ui-pdp-buybox .andes-money-amount[data-testid="price-part"] .andes-money-amount__fraction',
        '.ui-pdp-buybox .andes-money-amount__fraction',
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
        // Ciclo 13: variantes adicionales del PDP de Frávega, todas observadas
        // en la app router de Next 14 cuando hay descuento promocional. El
        // "current" es el precio efectivo final, "selling" es el SAP-style.
        '[data-test-id="product-current-price"]',
        '[data-test-id="product-selling-price"]',
        '[data-testid="product-price"]',
        '[data-testid="product-current-price"]',
        // Ciclo 1583: Frávega Hot Sale 2025 — el PDP tiene un componente de
        // precio con [data-test-id="pdp-price-value"] y un badge de descuento
        // separado. También detectado: [data-test-id="best-price"] cuando hay
        // promo de pago con tarjeta Frávega (el "best" es el precio con banco,
        // pero lo tratamos como precio final observado para el usuario logueado).
        '[data-test-id="pdp-price-value"]',
        '[data-test-id="best-price"]',
        '[data-testid="pdp-price-value"]',
        // Styled-components con hash variable: matchear prefijos.
        'span[class*="sc-" i][class*="Price" i]',
        'span[class*="sale-price" i]',
        'span[class*="OfferPrice" i]',
        'span[class*="Price-sc" i]',
        // Ciclo 13: PDP móvil de Frávega y página de checkout exponen el precio
        // dentro de un contenedor PriceWrapper / PriceContainer styled.
        'div[class*="PriceWrapper" i] span[class*="Price" i]',
        'div[class*="PriceContainer" i] span[class*="Price" i]',
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
        // Ciclo 13: Garbarino también expone "selling-price" y "best-price"
        // en su rediseño 2025 (post-migración VTEX). El "best" representa el
        // precio efectivo con cualquier promo de medio de pago automática
        // (sin filtros bancarios, son el "neto" que nos interesa).
        '[data-testid="product-selling-price"]',
        '[data-testid="product-best-price"]',
        '[data-test-id="product-selling-price"]',
        '[data-test-id="product-best-price"]',
        // Ciclo 1583: Garbarino Hot Sale 2025 — nuevo stack Next 14 + VTEX IO
        // expone precio en [data-testid="pdp-selling-price"] y en el componente
        // <PriceBadge> con clase sc-* + "amount". La variante mobile del PDP
        // tiene el mismo selector pero dentro de un drawer.
        '[data-testid="pdp-selling-price"]',
        '[data-testid="pdp-price"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-currencyContainer',
        '[class*="sellingPrice" i]',
        // Styled-components Next.js (Garbarino tiene un stack mixto Next+VTEX).
        'span[class*="sc-" i][class*="Price" i]',
        'span[class*="ProductPrice" i]',
        '[class*="PriceBadge" i]',
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
        // readPriceFromElement lee dataset.internetPrice / dataset.cmrPrice / dataset.eventPrice.
        '[data-internet-price]',
        'li[data-internet-price]',
        '[data-testid="prices-0"] .copy10',
        '[data-testid="prices-0"]',
        '[data-testid="testPointer-bigPrice"]',
        // Ciclo 1583: rediseño 2025 de Falabella — precio principal en .mkp-price
        // y en el contenedor [data-pod="price"] del PDP. El .copy10 es la clase
        // tipográfica "heading 10" del design system de Falabella.
        '[data-pod="price"] [class*="copy10" i]',
        '[data-pod="price"] .price',
        '[class*="mkp-price" i]',
        '[class*="pod-prices__price" i]',
        '.pod-prices__price-current',
        'li[data-cmr-price]',
        '.copy10',
        'span[class*="copy" i][data-testid]',
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
        // Ciclo 13: Naldo también usa "current-price" / "final-price" en el
        // PDP cuando hay precio promocional. Confirmado en Hot Sale 2025.
        '[data-testid="product-current-price"]',
        '[data-testid="product-final-price"]',
        '[data-test-id="product-current-price"]',
        '[data-test-id="product-final-price"]',
        '[data-testid="pdp-current-price"]',
        'span[class*="sc-" i][class*="Price" i]',
        '.product-price',
        '.precio-actual',
        '.precio-final',
        'span[class*="Price-sc" i]',
        'span[class*="CurrentPrice" i]',
        'span[class*="FinalPrice" i]',
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
        // Musimundo (VTEX IO): el sellingPrice es el del producto seleccionado.
        // Ciclo 1583: Musimundo 2025 rediseño expone precio en
        // [data-testid="pdp-price"] y [class*="ProductPrice" i] en su Casper 4.
        '[data-testid="pdp-price"]',
        '[data-testid="price-value"]',
        '[data-testid="product-price"]',
        '[data-test-id="product-price"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        // Ciclo 13: Musimundo expone también currencyContainer / sellingPrice
        // (sin "Value") en su Casper 2024. Y .product-pdp-price es legacy
        // pre-migración VTEX que aún aparece en algunos PDPs viejos.
        '.vtex-product-price-1-x-currencyContainer',
        '.vtex-product-price-1-x-sellingPrice',
        '.product-pdp-price',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        '[class*="ProductPrice" i]',
        '.price-value',
        '.price-best-price',
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
        // Easy AR es VTEX IO con tema propio (easyargentina.com.ar → easy.com.ar).
        // El precio principal vive en sellingPriceValue; también expone
        // "easyargentina-store-theme" con clases hasheadas (idem Jumbo) + meta tags.
        // Ciclo 1583: Easy expone precio en [data-testid="price-best-price"] en
        // su rediseño 2025 y en .easyargentina-store-theme-* con hash variable.
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.vtex-product-price-1-x-currencyContainer',
        '[data-testid="price-best-price"]',
        '[data-testid="price-value"]',
        '[data-testid="product-price"]',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        '[class*="bestPrice" i]',
        '.product-price__price',
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
    ribeiro: {
      label: 'Ribeiro',
      hostnameSuffix: 'ribeiro.com.ar',
      currency: 'ARS',
      selectors: [
        // Ribeiro usa SAP Commerce Cloud (Hybris) + tema custom. El precio
        // final vive en .product-detail__current o .price-now / .price-actual.
        // El "precio de lista" (tachado) vive en .price-was / .price-old.
        // Ciclo 1583: Ribeiro 2025 expone también [data-testid="selling-price"]
        // y .price__current en su rediseño SAP Hybris v22+. La meta itemprop
        // siempre usa formato US (schema.org).
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '[data-testid="selling-price"]',
        '[data-testid="product-price"]',
        '[data-test-id="product-price"]',
        '.product-detail__current',
        '.product-detail__price-current',
        '.price__current',
        '.price-now',
        '.price-actual',
        '.price-final',
        '.precio-actual',
        'span[class*="priceNow" i]',
        'span[class*="currentPrice" i]',
        // SAP Commerce genérico: el precio de venta final tiene class
        // "value" dentro de .price-container o del PDP.
        '.pdp-price .value',
        '.product-info .price .value',
        '[class*="price-container" i] .value',
      ],
    },
    compumundo: {
      label: 'Compumundo',
      hostnameSuffix: 'compumundo.com.ar',
      currency: 'ARS',
      selectors: [
        // Compumundo es hermana de Garbarino (mismo grupo): comparte buena
        // parte del stack VTEX/Next.js, así que los selectores son muy similares.
        '[data-testid="product-price"]',
        '[data-test-id="product-price"]',
        '[data-testid="price"]',
        '[data-test-id="price"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '[class*="sellingPrice" i]',
        '.product-price',
        '.price-label',
        'span[class*="sc-" i][class*="Price" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    samsung: {
      label: 'Samsung Store',
      hostnameSuffix: 'samsung.com.ar',
      currency: 'ARS',
      selectors: [
        // Samsung Argentina usa SAP Hybris: el precio principal vive en
        // .price-discount__current o .price-info__finalprice. El precio anterior
        // (tachado) está marcado con data-pricetype="WAS" — lo filtra
        // isStrikethroughPrice por la clase, pero por las dudas no lo selectamos.
        '.price-discount__current',
        '.price-info__finalprice',
        '.product-info-price__current-price',
        '[data-testid="product-price"]',
        '.pd-price__current-price',
        '[data-pricetype="finalPrice"]',
        'span[class*="finalPrice" i]',
        'span[class*="currentPrice" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 14: marcas con tienda oficial AR. Casi todas usan VTEX (LG, Philips,
    // BGH, Whirlpool, Electrolux) o Magento 2 (Noblex). Sony AR vive en su own
    // SPA con Adobe AEM. Varias listan precios USD con disclaimer "se cobra al
    // cambio del día" — la detección de currency en helpers.js debería frenar
    // eso, pero como red de seguridad isPriceTextUSD() valida también el texto
    // del nodo seleccionado.
    lg: {
      label: 'LG Argentina',
      hostnameSuffix: 'lg.com',
      currency: 'ARS',
      selectors: [
        // LG.com/ar usa stack mixto: Adobe AEM + componentes propios. El
        // precio promocional vive en .price-info__pricing__sale o .price__final.
        '.price-info__pricing__sale .price-info__pricing__price',
        '.price-info__pricing__price',
        '.price__final',
        '.product-price__final',
        '.product-price-current',
        '[data-testid="product-price"]',
        '[data-test-id="product-price"]',
        'span[class*="finalPrice" i]',
        'span[class*="currentPrice" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    sony: {
      label: 'Sony Store',
      hostnameSuffix: 'sony.com.ar',
      currency: 'ARS',
      selectors: [
        // Sony AR (Adobe AEM): la PDP tiene un componente .price-display con
        // currentPrice y wasPrice como hijos. El currentPrice es siempre el
        // precio activo final.
        '.price-display .currentPrice',
        '.price-current',
        '.product-price__current',
        '[data-testid="product-price"]',
        'span[class*="CurrentPrice" i]',
        'span[class*="ProductPrice" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    philips: {
      label: 'Philips Argentina',
      hostnameSuffix: 'philips.com.ar',
      currency: 'ARS',
      selectors: [
        // Philips AR usa VTEX-classic + un theme custom en algunos masters.
        // .pdp-price-current es el final-price; .pdp-price-list es el tachado.
        '.pdp-price-current',
        '.product-detail-price__current',
        '[data-testid="product-price"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    bgh: {
      label: 'BGH',
      hostnameSuffix: 'bgh.com.ar',
      currency: 'ARS',
      selectors: [
        // BGH usa VTEX. El precio principal vive en sellingPrice + container.
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.vtex-product-price-1-x-currencyContainer',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[data-testid="product-price"]',
        '.product-price__current',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    noblex: {
      label: 'Noblex',
      hostnameSuffix: 'noblex.com.ar',
      currency: 'ARS',
      selectors: [
        // Noblex está en Magento 2 (similar a Cetrogar/Rodo). Precio activo en
        // .price-final_price [data-price-amount].
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    whirlpool: {
      label: 'Whirlpool',
      hostnameSuffix: 'whirlpool.com.ar',
      currency: 'ARS',
      selectors: [
        // Whirlpool AR (VTEX): mismos selectores estándar, expone también
        // .product-pdp-price en algunos masters viejos.
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[data-testid="product-price"]',
        '.product-pdp-price',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1582: nuevos retailers Hot Sale AR.
    changomas: {
      label: 'Changomás',
      hostnameSuffix: 'changomas.com.ar',
      currency: 'ARS',
      selectors: [
        // Changomás (ex-Walmart AR) migró a VTEX: mismos patrones que Jumbo/Disco.
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.vtex-product-price-1-x-currencyContainer',
        '.product-price__price',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        '[data-testid="price-value"]',
        '[data-testid="product-price"]',
      ],
    },
    electrolux: {
      label: 'Electrolux',
      hostnameSuffix: 'electrolux.com.ar',
      currency: 'ARS',
      selectors: [
        // Electrolux AR usa VTEX-classic + Casper theme propio.
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.vtex-product-price-1-x-currencyContainer',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    drean: {
      label: 'Drean',
      hostnameSuffix: 'drean.com.ar',
      currency: 'ARS',
      selectors: [
        // Drean AR usa WooCommerce. El precio de venta con descuento vive
        // en .price ins .amount; sin descuento, en .woocommerce-Price-amount.
        '.price ins .amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        '.product-price',
        '[data-testid="product-price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    motorola: {
      label: 'Motorola Store',
      hostnameSuffix: 'motorola.com.ar',
      currency: 'ARS',
      selectors: [
        // Motorola AR usa plataforma Lenovo e-commerce (Next.js/custom).
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-test-id="product-price"]',
        '.product-price__current',
        '.product-price',
        'span[class*="currentPrice" i]',
        'span[class*="Price" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    todomodo: {
      label: 'Todomodo',
      hostnameSuffix: 'todomodo.com.ar',
      currency: 'ARS',
      selectors: [
        // Todomodo usa PrestaShop customizado. El precio de venta es
        // .current-price-value; .product-discount-price es el tachado.
        '.current-price-value',
        '.current-price .product-price',
        '.product-price',
        '[itemprop="price"]',
        '[data-testid="product-price"]',
        'span[class*="current-price" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
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
