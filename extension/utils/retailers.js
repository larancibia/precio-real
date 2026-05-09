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
      // Coto tiene dos dominios activos: el legacy cotodigital3.com.ar y
      // el actual coto.com.ar. detectSite() en helpers.js los mapea ambos
      // a este mismo key; el manifest y host_permissions cubren los dos.
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
        '[data-testid="selling-price"]',
        '.vtex-product-price-1-x-sellingPriceValue',
        '[class*="sellingPrice"]',
        '[class*="SellingPrice"]',
        '[class*="ProductPrice"] [class*="price"]',
        '[itemprop="price"]',
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
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        '[class*="SellingPrice"]',
        '[data-testid="price-value"]',
        '[data-testid="product-price"]',
        '[class*="Price"][class*="sell"]',
        '[class*="bestPrice"]',
        '.price-best',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
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
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '.product-price',
        'span[class*="price" i]',
        '.vtex-store-components-3-x-sellingPrice',
        '[class*="ProductPrice"]',
        '[class*="productPrice"]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[class*="bestPrice"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
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
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[class*="price"][class*="active"]',
        '[itemprop="price"]',
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
    // Ciclo 1584: Amazon AR y HiperTehno.
    amazon: {
      label: 'Amazon Argentina',
      hostnameSuffix: 'amazon.com.ar',
      currency: 'ARS',
      selectors: [
        // Amazon usa #corePrice_feature_div como contenedor del precio principal.
        // .a-price-whole contiene la parte entera; .a-offscreen el precio full
        // formateado (ej "$ 1.234,56") que es el más fácil de parsear.
        '#corePrice_feature_div .a-price .a-offscreen',
        '#corePrice_feature_div .a-price-whole',
        // Ciclo 1587: rediseño 2025/2026 — el buybox usa corePriceDisplay en lugar
        // de corePrice para artículos con suscripción, renovados o con promo.
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price-whole',
        // Buy-box calificado (qualified buybox) con múltiples offers:
        '#apex_desktop_qualifiedBuyBox .a-price .a-offscreen',
        '#apex_desktop_qualifiedBuyBox .a-price-whole',
        // Buy-box en accordion (productos con opciones de financiación/warranty):
        '#buyBoxAccordion .a-price .a-offscreen',
        // Precio con descuento ("deal price"):
        '#priceblock_dealprice',
        '#priceblock_ourprice',
        // Variante de precio en el buy-box cuando hay multiple sellers:
        '#apex_offerDisplay_desktop .a-price .a-offscreen',
        '#apex_offerDisplay_desktop .a-price-whole',
        // Precio en la sección de envíos/variantes (fallback).
        '.a-price.a-text-price .a-offscreen',
        '.a-color-price',
        // JSON-LD / meta como último recurso (Amazon suele emitirlos).
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    hipertehno: {
      label: 'HiperTehno',
      hostnameSuffix: 'hipertehno.com.ar',
      currency: 'ARS',
      selectors: [
        // HiperTehno usa WooCommerce / PrestaShop según la categoría.
        // WooCommerce: .woocommerce-Price-amount con precio final en <ins> si hay descuento.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        // PrestaShop (si aplica): .current-price-value es el precio activo.
        '.current-price-value',
        '.current-price .product-price',
        // Fallbacks genéricos con data-testid que algunos temas custom usan.
        '[data-testid="product-price"]',
        '[data-test-id="product-price"]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1599: Xiaomi Store AR, Philco AR y Venex (gaming).
    xiaomi: {
      label: 'Xiaomi Store',
      hostnameSuffix: 'tienda.mi.com',
      currency: 'ARS',
      selectors: [
        // Xiaomi AR usa una SPA Next.js propia. El precio de venta activo
        // normalmente vive en un elemento con data-testid="product-price" o
        // class "product-price__current". El precio de lista (tachado) está
        // en "product-price__original" que filtra isStrikethroughPrice.
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-testid="final-price"]',
        '.product-price__current',
        '.product-price__sale',
        '[class*="SalePrice" i]',
        '[class*="CurrentPrice" i]',
        '[class*="FinalPrice" i]',
        // Fallback schema.org (Xiaomi emite JSON-LD de Product en todas sus PDPs).
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    philco: {
      label: 'Philco',
      hostnameSuffix: 'philco.com.ar',
      currency: 'ARS',
      selectors: [
        // Philco AR usa VTEX-classic (misma plataforma que BGH/Electrolux).
        // El precio de venda principal vive en sellingPriceValue; también
        // expone meta itemprop="price" con formato US (schema.org).
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
    venex: {
      label: 'Venex',
      hostnameSuffix: 'venex.com.ar',
      currency: 'ARS',
      selectors: [
        // Venex usa Magento 2 con tema custom (similar a Cetrogar/Rodo/Noblex).
        // Precio final en .price-final_price [data-price-amount] (US-formatted).
        // El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '.product-price',
        '.price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1594: nuevos retailers Hot Sale AR 2026.
    bgood: {
      label: 'Bgood',
      hostnameSuffix: 'bgood.com.ar',
      currency: 'ARS',
      selectors: [
        // Bgood usa Magento 2 con tema custom. El precio activo vive en
        // .product-info-price .price-final_price o en [data-price-amount].
        // El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-price-amount]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    hptienda: {
      label: 'HP Tienda',
      hostnameSuffix: 'hptienda.com.ar',
      currency: 'ARS',
      selectors: [
        // HP Tienda AR usa Magento 2 / plataforma propia con exposición de
        // data-price-amount (US-formatted). El precio con descuento activo
        // vive en .special-price o en .price-final_price.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.price-current',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    lenovo: {
      label: 'Lenovo Store',
      hostnameSuffix: 'lenovo.com',
      currency: 'ARS',
      selectors: [
        // Lenovo AR (lenovo.com/ar/) usa un stack Next.js/React propio. El precio
        // con descuento aparece en .pricePDP__current o [data-testid="pdp-price"].
        // El precio de lista (tachado) está en .pricePDP__original.
        '[data-testid="pdp-price"]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.pricePDP__current',
        '.pricePDP__sale',
        '.product-price__current',
        '[class*="pricePDP" i][class*="current" i]',
        '[class*="pricePDP" i][class*="sale" i]',
        '[class*="CurrentPrice" i]',
        '[class*="SalePrice" i]',
        '[class*="FinalPrice" i]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    alphatec: {
      label: 'Alphatec',
      hostnameSuffix: 'alphatec.com.ar',
      currency: 'ARS',
      selectors: [
        // Alphatec AR usa PrestaShop. El precio de venta activo vive en
        // .current-price-value; el precio tachado está en .regular-price
        // (filtrado por isStrikethroughPrice). Fallback VTEX para algunos
        // partners que revenden con el mismo dominio.
        '.current-price-value',
        '.current-price .product-price',
        '[itemprop="price"]',
        '[data-testid="product-price"]',
        'span[class*="current-price" i]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    exo: {
      label: 'EXO',
      hostnameSuffix: 'exo.com.ar',
      currency: 'ARS',
      selectors: [
        // EXO AR (notebooks/PCs) usa WooCommerce o plataforma custom. El precio
        // con descuento vive en .woocommerce-Price-amount dentro de <ins>, sin
        // descuento en .woocommerce-Price-amount directamente.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1596: Hisense AR (VTEX), TCL AR (Shopify), Pycca (Magento 2).
    hisense: {
      label: 'Hisense Argentina',
      hostnameSuffix: 'hisense.com.ar',
      currency: 'ARS',
      selectors: [
        // Hisense AR usa VTEX IO con tema custom. Mismos selectores VTEX estándar
        // que otros appliance brands (Electrolux, Philco, BGH).
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.vtex-product-price-1-x-currencyContainer',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-testid="pdp-price"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    tcl: {
      label: 'TCL Argentina',
      hostnameSuffix: 'tcl.com.ar',
      currency: 'ARS',
      selectors: [
        // TCL AR usa Shopify con tema custom. El precio de venta activo vive en
        // .price-item--sale cuando hay descuento; sin descuento, en .price-item--regular.
        // El precio de lista tachado (dentro de .price--on-sale) lo filtra
        // isStrikethroughPrice por la clase del contenedor.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        'span[class*="price" i]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    pycca: {
      label: 'Pycca',
      hostnameSuffix: 'pycca.com.ar',
      currency: 'ARS',
      selectors: [
        // Pycca (retailer de electrónica, Tucumán/nationwide) usa Magento 2
        // con tema custom. Precio final en .price-final_price [data-price-amount]
        // (US-formatted). El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '.product-price',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1603: Full (WooCommerce/custom), Micro Center AR (Magento 2), iPoint AR (Shopify/custom).
    full: {
      label: 'Full',
      hostnameSuffix: 'full.com.ar',
      currency: 'ARS',
      selectors: [
        // Full AR usa WooCommerce con tema custom. El precio con descuento vive en
        // .price ins .woocommerce-Price-amount; sin descuento directamente.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    microcenter: {
      label: 'Micro Center',
      hostnameSuffix: 'microcenter.com.ar',
      currency: 'ARS',
      selectors: [
        // Micro Center AR usa Magento 2. Precio final en .price-final_price [data-price-amount]
        // (US-formatted). El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    ipoint: {
      label: 'iPoint',
      hostnameSuffix: 'ipoint.com.ar',
      currency: 'ARS',
      selectors: [
        // iPoint AR (Apple Authorized Reseller) usa Shopify con tema custom.
        // El precio de venta activo vive en .price-item--sale cuando hay descuento;
        // sin descuento, en .price-item--regular. Patrón idéntico al de TCL AR.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1606: Acer Store AR (Magento 2), Coolbox AR (Shopify gaming), Olimpo (WooCommerce).
    acer: {
      label: 'Acer Store',
      hostnameSuffix: 'acer.com',
      currency: 'ARS',
      selectors: [
        // Acer Store AR (store.acer.com/es-ar/) usa Magento 2 con tema custom.
        // El precio de venta final vive en .price-final_price [data-price-amount]
        // (US-formatted). El precio de lista tachado (.old-price) lo filtra
        // isStrikethroughPrice. También expone [data-testid="product-price"] en
        // su SPA overlay cuando el usuario configura specs (Aspire/Predator).
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.price-current',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    coolbox: {
      label: 'Coolbox',
      hostnameSuffix: 'coolbox.com.ar',
      currency: 'ARS',
      selectors: [
        // Coolbox AR (periféricos y gaming) usa Shopify con tema custom próximo
        // al Debut/Dawn. El precio de venta activo vive en .price-item--sale
        // cuando hay descuento; sin descuento, en .price-item--regular. El
        // precio de lista tachado (dentro de .price--on-sale) lo filtra
        // isStrikethroughPrice. También expone [data-product-variant-id] en el
        // selector de variantes al cambiar color/memoria.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '.product-price',
        '.product__price',
        '.price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    olimpo: {
      label: 'Olimpo',
      hostnameSuffix: 'olimpo.com.ar',
      currency: 'ARS',
      selectors: [
        // Olimpo AR (electrónica/electrodomésticos) usa WooCommerce con tema
        // custom. El precio con descuento vive en .price ins .woocommerce-Price-amount;
        // sin descuento en .woocommerce-Price-amount directamente.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '[data-test-id="product-price"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1607: Dexter (Shopify deportes), TGC (Magento 2 gaming), Maxiconsumo (VTEX supermercado).
    dexter: {
      label: 'Dexter',
      hostnameSuffix: 'dexter.com.ar',
      currency: 'ARS',
      selectors: [
        // Dexter AR (indumentaria/calzado deportivo) usa Shopify con tema custom.
        // El precio de venta activo vive en .price-item--sale cuando hay descuento;
        // sin descuento, en .price-item--regular. El precio de lista tachado
        // (dentro de .price--on-sale) lo filtra isStrikethroughPrice.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product-price',
        '.product__price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    tgc: {
      label: 'TGC',
      hostnameSuffix: 'tgc.com.ar',
      currency: 'ARS',
      selectors: [
        // TGC AR (gaming/hardware) usa Magento 2 con tema custom. El precio final
        // vive en .price-final_price [data-price-amount] (US-formatted). El precio
        // tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    maxiconsumo: {
      label: 'Maxiconsumo',
      hostnameSuffix: 'maxiconsumo.com',
      currency: 'ARS',
      selectors: [
        // Maxiconsumo AR (supermercado mayorista) usa VTEX IO. El precio de venta
        // principal vive en sellingPriceValue. También expone meta itemprop="price"
        // (formato US) como fallback universal. JSON-LD Product presente en todas las PDPs.
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
    // Ciclo 1613: Newsan (VTEX, appliances), Asus Store AR (Next.js), Mac Center (WooCommerce).
    newsan: {
      label: 'Newsan',
      hostnameSuffix: 'newsan.com.ar',
      currency: 'ARS',
      selectors: [
        // Newsan AR usa VTEX IO. Mismos selectores estándar VTEX que otros appliance brands
        // (Electrolux, Philco, BGH). JSON-LD Product siempre presente en todas las PDPs.
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.vtex-product-price-1-x-currencyContainer',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-testid="pdp-price"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    asus: {
      label: 'Asus Store',
      hostnameSuffix: 'store.asus.com',
      currency: 'ARS',
      selectors: [
        // Asus Store AR (store.asus.com/ar/) usa Next.js/React con plataforma propia.
        // El precio principal vive en [data-testid="product-price"] o en elementos con
        // clase que contiene "Price". JSON-LD Product siempre presente en todas las PDPs.
        '[data-testid="product-price"]',
        '[data-testid="selling-price"]',
        '[data-testid="price-value"]',
        '[data-testid="pdp-price"]',
        '.product-price__current',
        '.product-price__sale',
        'span[class*="ProductPrice" i]',
        'span[class*="sellingPrice" i]',
        'span[class*="CurrentPrice" i]',
        'span[class*="SalePrice" i]',
        '.price-wrapper .price',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    maccenter: {
      label: 'Mac Center',
      hostnameSuffix: 'maccenter.com.ar',
      currency: 'ARS',
      selectors: [
        // Mac Center AR usa WooCommerce con tema custom. Precio con descuento en
        // .price ins .woocommerce-Price-amount; sin descuento en .woocommerce-Price-amount.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1608: FullH4rd AR (Shopify gaming/periféricos), StartTech AR (Magento 2
    // gaming/PC), PC House AR (WooCommerce hardware).
    fullh4rd: {
      label: 'FullH4rd',
      hostnameSuffix: 'fullh4rd.com.ar',
      currency: 'ARS',
      selectors: [
        // Shopify con tema custom gaming. El precio principal en PDPs Shopify suele
        // estar en .product__price o .price__current; el data-product-price expone
        // el valor en centavos como integer. data-price-value cubre temas modernos.
        '[data-price-value]',
        '.product__price .price__current',
        '.product__price .price--on-sale .price__regular',
        '.product-single__price',
        '.product__price',
        '.price__current',
        '.price--sale',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.price-item--sale',
        '.price-item--regular',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    starttech: {
      label: 'StartTech',
      hostnameSuffix: 'startechpc.com.ar',
      currency: 'ARS',
      selectors: [
        // StartTech AR usa Magento 2. Mismos selectores estándar Magento 2 que
        // otros retailers de gaming/hardware (Venex, TGC, Microcenter AR).
        '[data-price-amount]',
        '.price-box .price',
        '.price-box .special-price .price',
        '.price-box .price-wrapper .price',
        '.price-wrapper[data-price-type="finalPrice"] .price',
        '.price-wrapper[data-price-type="minPrice"] .price',
        '[data-price-type="finalPrice"] .price',
        '[data-price-type="minPrice"] .price',
        '.product-info-price .price',
        '.special-price .price',
        '.regular-price .price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    pchouse: {
      label: 'PC House',
      hostnameSuffix: 'phouse.com.ar',
      currency: 'ARS',
      selectors: [
        // PC House AR usa WooCommerce. Mismo patrón que Mac Center, Full AR,
        // Olimpo AR: precio con descuento en .price ins, sin descuento directo.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1610: Zetta AR (WooCommerce electrónica/computing), Geek Store AR
    // (Shopify gaming/periféricos), Computodo AR (Magento 2 hardware/PC).
    zetta: {
      label: 'Zetta',
      hostnameSuffix: 'zetta.net.ar',
      currency: 'ARS',
      selectors: [
        // Zetta AR usa WooCommerce con tema custom. Precio con descuento en
        // .price ins .woocommerce-Price-amount; sin descuento directamente.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    geekstore: {
      label: 'Geek Store',
      hostnameSuffix: 'geekstore.com.ar',
      currency: 'ARS',
      selectors: [
        // Geek Store AR (gaming/periféricos) usa Shopify con tema custom.
        // El precio de venta activo vive en .price-item--sale cuando hay descuento;
        // sin descuento, en .price-item--regular. El precio tachado (inside
        // .price--on-sale) lo filtra isStrikethroughPrice.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '.price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    computodo: {
      label: 'Computodo',
      hostnameSuffix: 'computodo.com.ar',
      currency: 'ARS',
      selectors: [
        // Computodo AR (hardware/PC building) usa Magento 2 con tema custom.
        // Precio final en .price-final_price [data-price-amount] (US-formatted).
        // El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1609: nuevos retailers gaming/PC y electrónica AR.
    // Plataformas: MaxiHogar (VTEX), DigitalTech (Magento 2), Goldenshop (Shopify),
    // Red UNO (WooCommerce), Cetrogar Córdoba (Magento 2, filial regional).
    maxihogar: {
      label: 'MaxiHogar',
      hostnameSuffix: 'maxihogar.com.ar',
      currency: 'ARS',
      selectors: [
        // MaxiHogar AR (electrodomésticos) usa VTEX IO. Mismos selectores que
        // otros appliance retailers (Electrolux, Philco, Hisense, Newsan).
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.vtex-product-price-1-x-currencyContainer',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-testid="pdp-price"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    pcfactory: {
      label: 'PC Factory',
      hostnameSuffix: 'pcfactory.com.ar',
      currency: 'ARS',
      selectors: [
        // PC Factory AR (hardware/gaming) usa Magento 2 con tema custom.
        // Precio final en .price-final_price [data-price-amount] (US-formatted).
        // El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    compragamer: {
      label: 'CompraGamer',
      hostnameSuffix: 'compragamer.com',
      currency: 'ARS',
      selectors: [
        // CompraGamer AR (hardware/gaming) usa plataforma propia (Next.js/React).
        // El precio de venta activo vive en [data-testid="product-price"] o en
        // elementos con clase que contiene "price". JSON-LD Product presente.
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-testid="selling-price"]',
        '[data-testid="final-price"]',
        '.product-price__current',
        '.product-price__sale',
        '[class*="CurrentPrice" i]',
        '[class*="SalePrice" i]',
        '[class*="FinalPrice" i]',
        '[class*="ProductPrice" i]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    goldenshop: {
      label: 'Golden Shop',
      hostnameSuffix: 'goldenshop.com.ar',
      currency: 'ARS',
      selectors: [
        // Golden Shop AR (accesorios/electrónica) usa Shopify con tema custom.
        // El precio de venta activo en .price-item--sale; sin descuento en --regular.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    soluciones: {
      label: 'Soluciones',
      hostnameSuffix: 'soluciones.com.ar',
      currency: 'ARS',
      selectors: [
        // Soluciones AR (informática/gaming) usa WooCommerce con tema custom.
        // Precio con descuento en .price ins .woocommerce-Price-amount;
        // sin descuento en .woocommerce-Price-amount directamente.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1614: Bit (Shopify gaming/hardware), Digital Haus (WooCommerce electrónica),
    // InStore (Magento 2 audio/video hifi), Staples AR (WooCommerce oficina),
    // Gotta (WooCommerce gaming/periféricos).
    bit: {
      label: 'Bit',
      hostnameSuffix: 'bit.ar',
      currency: 'ARS',
      selectors: [
        // Bit AR (gaming/hardware) usa Shopify con tema custom. El precio de venta
        // activo en .price-item--sale cuando hay descuento; sin descuento en --regular.
        // El precio de lista tachado (inside .price--on-sale) lo filtra isStrikethroughPrice.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '.price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    digitalhaus: {
      label: 'Digital Haus',
      hostnameSuffix: 'digitalhaus.com.ar',
      currency: 'ARS',
      selectors: [
        // Digital Haus AR (electrónica) usa WooCommerce con tema custom.
        // El precio con descuento vive en .price ins .woocommerce-Price-amount;
        // sin descuento en .woocommerce-Price-amount directamente.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    instore: {
      label: 'InStore',
      hostnameSuffix: 'instore.com.ar',
      currency: 'ARS',
      selectors: [
        // InStore AR (audio/video hifi) usa Magento 2 con tema custom. El precio
        // final vive en .price-final_price [data-price-amount] (US-formatted).
        // El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.price-current',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    staples: {
      label: 'Staples',
      hostnameSuffix: 'staples.com.ar',
      currency: 'ARS',
      selectors: [
        // Staples AR (oficina/tecnología) usa WooCommerce o plataforma custom.
        // Patrones WooCommerce estándar con fallback a meta tags schema.org.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-testid="selling-price"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    gotta: {
      label: 'Gotta',
      hostnameSuffix: 'gotta.com.ar',
      currency: 'ARS',
      selectors: [
        // Gotta AR (gaming/periféricos) usa WooCommerce con tema custom gaming.
        // Precio con descuento en .price ins .woocommerce-Price-amount;
        // sin descuento en .woocommerce-Price-amount directamente.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1615: Powerplanet (WooCommerce gaming/periféricos), I-Gaming Store (Shopify
    // gaming/hardware), Netizar (Magento 2 hardware/networking), Megastore AR
    // (WooCommerce electrónica), Centurytech (Magento 2 hardware/PC).
    powerplanet: {
      label: 'Powerplanet',
      hostnameSuffix: 'powerplanet.com.ar',
      currency: 'ARS',
      selectors: [
        // Powerplanet AR (gaming/periféricos) usa WooCommerce con tema custom gaming.
        // Precio con descuento en .price ins .woocommerce-Price-amount; sin descuento directo.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    igaming: {
      label: 'I-Gaming Store',
      hostnameSuffix: 'igamingstore.com.ar',
      currency: 'ARS',
      selectors: [
        // I-Gaming Store AR (gaming/hardware) usa Shopify con tema custom.
        // El precio de venta activo en .price-item--sale cuando hay descuento;
        // sin descuento en .price-item--regular. Tachado filtrado por isStrikethroughPrice.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '.price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    netizar: {
      label: 'Netizar',
      hostnameSuffix: 'netizar.com.ar',
      currency: 'ARS',
      selectors: [
        // Netizar AR (hardware/networking) usa Magento 2 con tema custom.
        // Precio final en .price-final_price [data-price-amount] (US-formatted).
        // El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    megastore: {
      label: 'Megastore',
      hostnameSuffix: 'megastore.com.ar',
      currency: 'ARS',
      selectors: [
        // Megastore AR (electrónica/electrodomésticos) usa WooCommerce con tema custom.
        // El precio con descuento vive en .price ins .woocommerce-Price-amount;
        // sin descuento en .woocommerce-Price-amount directamente.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    centurytech: {
      label: 'Centurytech',
      hostnameSuffix: 'centurytech.com.ar',
      currency: 'ARS',
      selectors: [
        // Centurytech AR (hardware/PC building) usa Magento 2 con tema custom.
        // Mismo patrón que Computodo, Nexstore, TGC, Netizar.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1612: Arredondo (PrestaShop electrónica), iThink (Shopify Apple reseller),
    // Nexstore (Magento 2 gaming/PC), Cable Hogar (WooCommerce electrónica).
    arredondo: {
      label: 'Arredondo',
      hostnameSuffix: 'arredondo.com.ar',
      currency: 'ARS',
      selectors: [
        // Arredondo usa PrestaShop con tema custom. El precio de venta activo vive en
        // .current-price-value; el precio tachado está en .regular-price
        // (filtrado por isStrikethroughPrice). Fallback genérico para rediseños.
        '.current-price-value',
        '.current-price .product-price',
        '[itemprop="price"]',
        '[data-testid="product-price"]',
        'span[class*="current-price" i]',
        '.product-price',
        '.precio-actual',
        '.precio-final',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    ithink: {
      label: 'iThink',
      hostnameSuffix: 'ithink.com.ar',
      currency: 'ARS',
      selectors: [
        // iThink AR (Apple Premium Reseller) usa Shopify con tema custom.
        // El precio de venta activo vive en .price-item--sale cuando hay descuento;
        // sin descuento, en .price-item--regular. El precio de lista tachado
        // (dentro de .price--on-sale) lo filtra isStrikethroughPrice.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    nexstore: {
      label: 'Nexstore',
      hostnameSuffix: 'nexstore.com.ar',
      currency: 'ARS',
      selectors: [
        // Nexstore AR (gaming/PC hardware) usa Magento 2 con tema custom.
        // Precio final en .price-final_price [data-price-amount] (US-formatted).
        // El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    cablehogar: {
      label: 'Cable Hogar',
      hostnameSuffix: 'cablehogar.com.ar',
      currency: 'ARS',
      selectors: [
        // Cable Hogar AR (electrónica/electrodomésticos) usa WooCommerce con tema custom.
        // El precio con descuento vive en .price ins .woocommerce-Price-amount;
        // sin descuento en .woocommerce-Price-amount directamente.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // ── Ciclo 1616 ──────────────────────────────────────────────────────────
    klibr: {
      label: 'Klibr',
      hostnameSuffix: 'klibr.com.ar',
      currency: 'ARS',
      selectors: [
        // Klibr AR (gaming periféricos: headsets, teclados, mouses) usa Shopify con
        // tema custom. El precio de venta activo vive en .price__sale .price-item--sale;
        // sin descuento en .price-item--regular. El tachado lo filtra isStrikethroughPrice.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-sku-id]',
        '[data-product-form-id]',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    lazer: {
      label: 'Lazer',
      hostnameSuffix: 'lazer.com.ar',
      currency: 'ARS',
      selectors: [
        // Lazer AR (gaming sillas, periféricos, accesorios) usa Shopify con tema custom.
        // Mismo patrón de precios que Klibr (Shopify Markets 2025): .price-item--sale
        // es el precio con descuento; .price-item--regular sin descuento.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-sku-id]',
        '[data-bundle-id]',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    pcarg: {
      label: 'PC Arg',
      hostnameSuffix: 'pcarg.com.ar',
      currency: 'ARS',
      selectors: [
        // PcArg AR (componentes PC, hardware, gaming) usa WooCommerce con tema custom.
        // El precio con descuento vive en .price ins .woocommerce-Price-amount;
        // sin descuento directamente en .woocommerce-Price-amount.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-selected-sku]',
        '[data-testid="product-price"]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // ── Ciclo 1630 ──────────────────────────────────────────────────────────
    // Nuevos retailers: Carsa (WooCommerce electrodomésticos AR regional),
    // Falabella Travel (se detecta en falabella.com.ar — ya cubierto),
    // GrupoDIN (Magento 2 electrónica AR), Antel AR (Shopify accesorios AR),
    // Coppel AR (VTEX línea blanca/electrónica), Megatronics (Magento 2 gaming/IT).
    carsa: {
      label: 'Carsa',
      hostnameSuffix: 'carsa.com.ar',
      currency: 'ARS',
      selectors: [
        // Carsa AR (electrodomésticos/electrónica regional NOA/NEA) usa WooCommerce
        // con tema custom. El precio con descuento vive en .price ins .woocommerce-Price-amount;
        // sin descuento en .woocommerce-Price-amount directamente. También expone
        // [itemprop="price"] en su schema.org Product y meta tags estándar.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    grupodin: {
      label: 'GrupoDIN',
      hostnameSuffix: 'grupodin.com',
      currency: 'ARS',
      selectors: [
        // GrupoDIN AR (electrónica/electrodomésticos, presencia nacional) usa
        // Magento 2 con tema custom. El precio de venta final vive en
        // .price-final_price [data-price-amount] (US-formatted). El precio
        // tachado (.old-price) lo filtra isStrikethroughPrice.
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.price-current',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    coppel: {
      label: 'Coppel',
      hostnameSuffix: 'coppel.com',
      currency: 'ARS',
      selectors: [
        // Coppel AR usa VTEX IO con tema custom. El precio de venta principal
        // vive en sellingPriceValue. También expone meta itemprop="price" (formato US)
        // y JSON-LD Product en todas las PDPs. El precio de contado (efectivo/débito)
        // es el que se muestra primero en el PDP; el precio en cuotas está en
        // otro bloque y lo filtra isStrikethroughPrice por context.
        '.vtex-product-price-1-x-sellingPriceValue',
        '.vtex-product-price-1-x-sellingPrice',
        '.vtex-product-price-1-x-currencyContainer',
        '[class*="sellingPriceValue" i]',
        '[class*="sellingPrice" i]',
        '[class*="currentPrice" i]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-testid="pdp-price"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    megatronics: {
      label: 'Megatronics',
      hostnameSuffix: 'megatronics.com.ar',
      currency: 'ARS',
      selectors: [
        // Megatronics AR (gaming/IT/componentes PC) usa Magento 2 con tema custom.
        // Precio final en .price-final_price [data-price-amount] (US-formatted).
        // El precio tachado (.old-price) lo filtra isStrikethroughPrice.
        // También expone [data-testid="product-price"] en su SPA overlay
        // de configuración (PCs armadas con specs variables).
        '.product-info-price .price-final_price [data-price-amount]',
        '.product-info-price .price-final_price .price',
        '.special-price [data-price-amount]',
        '.special-price .price',
        '.price-box .price-final_price [data-price-amount]',
        '.price-box .price',
        '[data-price-amount]',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    macstation: {
      label: 'Mac Station',
      hostnameSuffix: 'macstation.com.ar',
      currency: 'ARS',
      selectors: [
        // Mac Station AR (Apple Premium Reseller) usa Shopify con tema custom
        // similar a Mac Center e iPoint. El precio de venta activo vive en
        // .price-item--sale cuando hay descuento; sin descuento en .price-item--regular.
        // El precio de lista tachado (inside .price--on-sale) lo filtra
        // isStrikethroughPrice. JSON-LD Product siempre presente.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    winpy: {
      label: 'Winpy',
      hostnameSuffix: 'winpy.com.ar',
      currency: 'ARS',
      selectors: [
        // Winpy AR (electrónica/gaming/periféricos) usa una plataforma propia
        // basada en Next.js/React. El precio de venta activo vive en
        // [data-testid="product-price"] o en el elemento con clase que contiene
        // "Price". También expone meta itemprop="price" con formato US.
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '[data-testid="selling-price"]',
        '[data-testid="final-price"]',
        '.product-price__current',
        '.product-price__sale',
        '[class*="CurrentPrice" i]',
        '[class*="SalePrice" i]',
        '[class*="FinalPrice" i]',
        '[class*="ProductPrice" i]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1617: GearZone AR (Shopify gaming bundles/periféricos).
    // Referenciado en data-bundle-id comentarios desde ciclo 1616 junto a Klibr/Lazer.
    gearzone: {
      label: 'GearZone',
      hostnameSuffix: 'gearzone.com.ar',
      currency: 'ARS',
      selectors: [
        // GearZone usa Shopify con tema custom gaming. El precio de venta activo vive en
        // .price__sale .price-item--sale; sin descuento en .price-item--regular.
        // Los bundles tienen data-bundle-id en el picker; el precio del bundle
        // se actualiza en el contenedor .price__sale al seleccionar una configuración.
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-bundle-id]',
        '[data-sku-id]',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '.price--large',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1617: Binario AR (WooCommerce gaming/componentes PC).
    binario: {
      label: 'Binario',
      hostnameSuffix: 'binario.com.ar',
      currency: 'ARS',
      selectors: [
        // Binario usa WooCommerce con tema custom. El precio con descuento
        // vive en .price ins .woocommerce-Price-amount (mismo patrón que PcArg).
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1617: CompuPC AR (WooCommerce hardware/PC armado). Ciclo 1618 ver abajo.
    compupc: {
      label: 'CompuPC',
      hostnameSuffix: 'compupc.com.ar',
      currency: 'ARS',
      selectors: [
        // CompuPC usa WooCommerce con tema Storefront/Flatsome custom.
        // El precio de oferta vive en .price ins; sin oferta directamente en .price.
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '.product-price',
        '.summary .price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1618: Autronic AR (WooCommerce electrónica/electrodomésticos regional —
    // cadena con presencia en NOA, NEA, Cuyo y Centro). El precio de oferta vive en
    // .price ins .woocommerce-Price-amount; sin oferta directamente en .woocommerce-Price-amount.
    autronic: {
      label: 'Autronic',
      hostnameSuffix: 'autronic.com.ar',
      currency: 'ARS',
      selectors: [
        '.price ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount',
        '.price .amount',
        'ins .woocommerce-Price-amount.amount bdi',
        'ins .woocommerce-Price-amount.amount',
        '.woocommerce-Price-amount.amount bdi',
        '[data-testid="product-price"]',
        '[data-testid="price-value"]',
        '.product-price',
        '.precio-actual',
        '.precio-web',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1618: Megatrix AR (Shopify gaming/periféricos — headsets, teclados, mouse
    // gaming, sillas, monitores). El precio de venta activo en .price-item--sale cuando
    // hay descuento; sin descuento en .price-item--regular. También emite JSON-LD Product.
    megatrix: {
      label: 'Megatrix',
      hostnameSuffix: 'megatrix.com.ar',
      currency: 'ARS',
      selectors: [
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
      ],
    },
    // Ciclo 1618: Pixelstore AR (Shopify Apple Premium Reseller — MacBooks, iPhones,
    // iPads, accesorios Apple). Mismo patrón de tema Shopify que Mac Center e iPoint:
    // precio de venta en .price-item--sale; precio regular en .price-item--regular.
    pixelstore: {
      label: 'Pixelstore',
      hostnameSuffix: 'pixelstore.com.ar',
      currency: 'ARS',
      selectors: [
        '.price__sale .price-item--sale',
        '.price-item--sale',
        '.price__regular .price-item--regular',
        '.price-item--regular',
        '[data-testid="product-price"]',
        '[data-testid="price"]',
        'span[class*="price-item" i]',
        '[data-price-value]',
        '.product__price',
        '.product-price',
        '.precio-actual',
        '[itemprop="price"]',
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
