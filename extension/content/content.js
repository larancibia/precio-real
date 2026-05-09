(function () {
  'use strict';

  // Guard contra doble-inyección: algunos retailers (SPAs agresivos) pueden
  // hacer que el content script se evalúe más de una vez en la misma página,
  // lo que duplicaba listeners de history y wrappers de pushState/replaceState.
  if (window.__precioRealLoaded) return;
  window.__precioRealLoaded = true;

  const PR = window.PrecioReal;
  if (!PR) { console.warn('[Precio Real] helpers not loaded'); return; }

  // Usar config compartido para que el switch dev↔prod sea un solo archivo.
  const BACKEND = (window.PrecioRealConfig && window.PrecioRealConfig.API_BASE) || 'http://localhost:8787';

  // Logger condicional. Si falta (helpers viejo), fallback a console.
  const log = (PR && PR.log) || {
    debug() {}, info: console.info.bind(console, '[Precio Real]'),
    warn: console.warn.bind(console, '[Precio Real]'),
  };

  // ── Tunables ──────────────────────────────────────────────────────────────
  // Mutation observer debounce: muchos retailers re-renderizan partes del DOM
  // continuamente (carruseles, ads, lazy-loaded sections) y eso disparaba la
  // callback en bucle, que pegaba a tryMount() en cada microtask. Con 250ms
  // dejamos que el burst termine antes de re-evaluar.
  const OBS_DEBOUNCE_MS = 250;
  // Cap defensivo: si el sitio jamás estabiliza el DOM, no nos quedamos
  // observando indefinidamente disparando tryMount.
  const OBS_MAX_FIRES = 60;
  const OBS_TIMEOUT_MS = 15000;
  // Retries iniciales antes de armar el MutationObserver: cubre el caso típico
  // donde el precio aparece tras un XHR <3s después de DOMContentLoaded.
  const INITIAL_DELAYS_MS = [0, 400, 1000, 2000, 3500];
  // Fetch del backend: timeout corto + dos reintentos suaves. Sin esto, una
  // red flakey deja el badge en "sin datos" para siempre.
  const FETCH_TIMEOUT_MS = 6000;
  const FETCH_RETRIES = 2;
  const FETCH_RETRY_BASE_MS = 600;

  function isProductPage() {
    // Si helpers expone la versión strict (incluye filtro de URLs de listado),
    // la preferimos. Caemos al detector legacy si no.
    if (typeof PR.isProductPageStrict === 'function') {
      try {
        const site = PR.detectSite ? PR.detectSite(location.hostname) : null;
        return PR.isProductPageStrict(site);
      } catch (_) { /* caer al legacy */ }
    }
    try {
      const site = PR.detectSite ? PR.detectSite(location.hostname) : null;
      if (site === 'mercadolibre') {
        if (location.hostname.startsWith('articulo.')) return true;
        if (/\/p\//.test(location.pathname)) return true;
        if (/MLA-?\d+/i.test(location.pathname)) return true;
        return false;
      }
      if (document.querySelector('[itemtype*="schema.org/Product"]')) return true;
      if (document.querySelector('[itemprop="price"]')) return true;
      if (document.querySelector('meta[property="og:type"][content="product"]')) return true;
      const tw = document.querySelector('meta[name="twitter:card"]');
      if (tw && /product/i.test(tw.getAttribute('content') || '')) return true;
      const ldNodes = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of ldNodes) {
        const txt = s.textContent || '';
        if (txt.includes('"Product"') || txt.includes('"@type":"Product"')) return true;
      }
      if (document.querySelector('.price, .product-price, [data-testid*="price" i]')) return true;
    } catch (e) {
      // Si querySelector tira (muy raro), no podemos asumir nada: devolver false
      // y dejar que el observer reintente cuando el DOM esté en mejor estado.
      // Si extractPrice eventualmente encuentra precio + history, mostrará el
      // badge. Si no, mejor no mostrar nada que mostrar info incorrecta en una
      // categoría/listado.
      return false;
    }
    return false;
  }

  function makeBadge(verdict, ctx) {
    const wrap = document.createElement('div');
    wrap.className = 'precio-real-badge ' +
      (verdict.kind === 'real' ? 'precio-real-badge--real' :
       verdict.kind === 'inflated' ? 'precio-real-badge--fake' :
       'precio-real-badge--neutral');
    wrap.setAttribute('role', 'status');

    const close = document.createElement('button');
    close.className = 'precio-real-badge__close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Cerrar');
    close.addEventListener('click', () => {
      // Marcamos que el usuario cerró el badge para este producto+variante. El
      // observer sigue corriendo pero tryMount va a respetar la decisión hasta
      // que navegue a otra URL o cambie de variante (productKey distinto).
      userClosedForKey = lastKey;
      try { wrap.remove(); } catch (_) {}
      const root = document.getElementById('precio-real-badge-root');
      if (root) try { root.remove(); } catch (_) {}
      mounted = false;
    });

    const title = document.createElement('div');
    title.className = 'precio-real-badge__title';
    title.textContent = verdict.label;

    const sub = document.createElement('div');
    sub.className = 'precio-real-badge__sub';
    sub.textContent = verdict.sub || '';

    wrap.appendChild(close);
    wrap.appendChild(title);
    wrap.appendChild(sub);

    if (verdict.kind === 'real' && ctx && ctx.retailer && PR.affiliateWrap) {
      try {
        const { url, isAffiliate } = PR.affiliateWrap(ctx.href, ctx.retailer);
        if (url) {
          const cta = document.createElement('a');
          cta.className = 'precio-real-badge__cta';
          cta.href = url;
          cta.target = '_blank';
          cta.rel = 'noopener noreferrer';
          cta.textContent = 'Ir al producto →';
          if (isAffiliate) cta.setAttribute('data-precio-real-affiliate', '1');
          wrap.appendChild(cta);
        }
      } catch (e) {
        // Si affiliateWrap explota por una URL rara, mejor mostrar el badge sin CTA.
        log.warn('affiliateWrap failed', e && e.message);
      }
    }

    return wrap;
  }

  function mountBadge(verdict, ctx) {
    // Defensivo: en algún SPA exótico el body podría haberse swapeado entre el
    // arranque del script y este punto. Si todavía no hay body, abortamos —
    // el observer disparará otra vez cuando aparezca.
    const body = document.body;
    if (!body) return false;
    let root = document.getElementById('precio-real-badge-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'precio-real-badge-root';
      try { body.appendChild(root); } catch (e) { return false; }
    } else if (!root.isConnected) {
      // Body fue reemplazado, root quedó huérfano.
      try { body.appendChild(root); } catch (e) { return false; }
    }
    root.innerHTML = '';
    root.appendChild(makeBadge(verdict, ctx));
    return true;
  }

  function classify(current, history) {
    if (typeof PR.classifyPrice === 'function') return PR.classifyPrice(current, history);
    if (typeof PR.fallbackClassify === 'function') return PR.fallbackClassify(current, history);
    return { kind: 'neutral', pct: 0, label: 'Precio Real', sub: '' };
  }

  let lastUrl = null;        // canonicalUrl
  let lastKey = null;        // productKey (incluye variante)
  let lastPrice = null;
  let mounted = false;
  let observer = null;
  let observerTimeout = null;
  let observerFires = 0;
  let runToken = 0;
  // productKey para el que el usuario apretó la X. Mientras no cambie de
  // producto/variante, no re-montamos el badge aunque el observer se dispare.
  let userClosedForKey = null;

  function getProductKey(href) {
    if (typeof PR.productKey === 'function') {
      try { return PR.productKey(href); } catch (_) {}
    }
    return PR.canonicalUrl(href || location.href);
  }

  function unmountBadge() {
    const root = document.getElementById('precio-real-badge-root');
    if (root) try { root.remove(); } catch (_) {}
    mounted = false;
    lastUrl = null;
    lastKey = null;
    lastPrice = null;
    teardownVariantObserver();
  }

  // fetch con timeout + retry. Devuelve {ok:true, history} o {ok:false}.
  async function fetchHistory(url) {
    let lastErr = null;
    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => {
        try { ctrl.abort(); } catch (_) {}
      }, FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(BACKEND + '/api/price?url=' + encodeURIComponent(url), {
          cache: 'no-store',
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const history = Array.isArray(data && data.history) ? data.history : [];
          return { ok: true, history };
        }
        if (res.status === 404) {
          // No existe historial para esta URL: respuesta válida, sin retry.
          return { ok: true, history: [] };
        }
        // 5xx u otros: reintentar con backoff.
        lastErr = new Error('backend ' + res.status);
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
      }
      if (attempt < FETCH_RETRIES) {
        const wait = FETCH_RETRY_BASE_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    if (lastErr) log.warn('fetch failed', lastErr.message || lastErr);
    return { ok: false, history: [] };
  }

  async function tryMount(siteKey, myToken) {
    if (myToken !== runToken) return false;
    let current, url, key;
    try {
      if (PR.detectSite(location.hostname) !== siteKey) return false;
      current = PR.extractPrice(siteKey);
      if (!current) {
        log.debug(siteKey, 'extractPrice → null');
        return false;
      }
      url = PR.canonicalUrl(location.href);
      key = getProductKey(location.href);
    } catch (e) {
      log.warn('tryMount DOM read failed', e && e.message);
      return false;
    }
    // Respetar cierre manual mientras estemos en el mismo producto+variante.
    if (userClosedForKey && userClosedForKey === key) return true;
    // Si nada cambió, devolver true (badge ya válido).
    if (mounted && key === lastKey && current === lastPrice) return true;

    log.debug(siteKey, 'tryMount', { url, key, current });
    const { history } = await fetchHistory(url);
    if (myToken !== runToken) return false;

    let verdict;
    try {
      verdict = classify(current, history);
    } catch (e) {
      log.warn('classify failed', e && e.message);
      return false;
    }
    const ok = mountBadge(verdict, { retailer: siteKey, href: location.href });
    if (!ok) return false;
    mounted = true;
    lastUrl = url;
    lastKey = key;
    lastPrice = current;
    log.debug(siteKey, 'mounted', verdict);
    return true;
  }

  function teardownObserver() {
    if (observer) { try { observer.disconnect(); } catch (_) {} observer = null; }
    if (observerTimeout) { clearTimeout(observerTimeout); observerTimeout = null; }
    observerFires = 0;
  }

  // Observador "ligero" que sigue activo después de montar el badge para
  // detectar cambios de variante (talle/color → cambia el precio sin cambiar
  // la URL). Throttle más agresivo (1s) porque solo nos importa cambios reales
  // de precio/variante, no re-renders cosméticos.
  let variantObserver = null;
  let variantTimer = null;
  const VARIANT_CHECK_MS = 1000;

  function teardownVariantObserver() {
    if (variantObserver) { try { variantObserver.disconnect(); } catch (_) {} variantObserver = null; }
    if (variantTimer) { clearTimeout(variantTimer); variantTimer = null; }
  }

  function startVariantObserver(siteKey, myToken) {
    teardownVariantObserver();
    if (!document.body || typeof MutationObserver !== 'function') return;
    const schedule = () => {
      if (variantTimer) return;
      variantTimer = setTimeout(() => {
        variantTimer = null;
        if (myToken !== runToken) { teardownVariantObserver(); return; }
        if (!mounted) return;
        // Solo nos interesa: el precio o productKey cambiaron sin nav.
        let current = null, key = null;
        try {
          current = PR.extractPrice(siteKey);
          key = getProductKey(location.href);
        } catch (_) { return; }
        if (!current) return;
        if (key === lastKey && current === lastPrice) return;
        // Algo cambió → si el usuario había cerrado el badge para la variante
        // anterior, reseteamos su decisión solo si la variante (key) cambió.
        if (key !== lastKey) userClosedForKey = null;
        log.debug(siteKey, 'variant change detected', {
          oldKey: lastKey, newKey: key, oldPrice: lastPrice, newPrice: current,
        });
        tryMount(siteKey, myToken).catch((e) => {
          log.warn('variant tryMount threw', e && e.message);
        });
      }, VARIANT_CHECK_MS);
    };
    try {
      variantObserver = new MutationObserver(schedule);
      // Watch for variant-relevant attribute changes only (no `class` — too
      // noisy, casi todos los retailers togglan clases por hover/focus). Si una
      // variante cambia también suele cambiar SKU o aria-checked.
      variantObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'data-sku', 'data-product-id', 'data-variant-id', 'data-value',
          'aria-checked', 'aria-pressed', 'aria-selected',
        ],
      });
    } catch (_) { variantObserver = null; }
  }

  async function run() {
    runToken++;
    const myToken = runToken;
    teardownObserver();
    teardownVariantObserver();
    // Si dejamos de estar en una página de producto (nav SPA a categoría/home),
    // tenemos que sacar el badge viejo para no mostrar info stale.
    if (!isProductPage()) {
      log.debug(null, 'not a product page, unmount', location.href);
      unmountBadge();
      return;
    }
    const siteKey = PR.detectSite(location.hostname);
    if (!siteKey) { unmountBadge(); return; }
    log.debug(siteKey, 'run start', location.href);

    for (const d of INITIAL_DELAYS_MS) {
      if (myToken !== runToken) return;
      if (d) await new Promise((r) => setTimeout(r, d));
      try {
        if (await tryMount(siteKey, myToken)) {
          startVariantObserver(siteKey, myToken);
          return;
        }
      } catch (e) {
        log.warn('tryMount threw', e && e.message);
      }
    }

    // MutationObserver con debounce para evitar storms.
    let pending = false;
    let debounceTimer = null;
    const fire = () => {
      if (myToken !== runToken) { teardownObserver(); return; }
      if (++observerFires > OBS_MAX_FIRES) { teardownObserver(); return; }
      tryMount(siteKey, myToken).then((didMount) => {
        if (didMount) {
          teardownObserver();
          startVariantObserver(siteKey, myToken);
        }
      }).catch((e) => {
        log.warn('observer tryMount threw', e && e.message);
      });
    };
    const schedule = () => {
      if (pending) return;
      pending = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        pending = false;
        debounceTimer = null;
        fire();
      }, OBS_DEBOUNCE_MS);
    };
    try {
      observer = new MutationObserver(schedule);
      // Observar body con subtree puede ser ruidoso; lo compensamos con el debounce.
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        observer = null;
      }
    } catch (e) {
      observer = null;
    }
    observerTimeout = setTimeout(() => {
      teardownObserver();
      if (myToken === runToken && !mounted) {
        log.info('no price after retries+observer', siteKey, location.href);
      }
    }, OBS_TIMEOUT_MS);
  }

  function maybeRunOnLocationChange() {
    let newUrl = null;
    try { newUrl = PR.canonicalUrl(location.href); } catch (_) { return; }
    if (newUrl !== lastUrl) {
      // URL cambió → resetear estado de "cerrado manualmente" y re-correr.
      userClosedForKey = null;
      mounted = false;
      run();
    }
  }

  function hookHistory() {
    const wrap = (fn) => function () {
      const r = fn.apply(this, arguments);
      try { window.dispatchEvent(new Event('precio-real:locationchange')); } catch (_) {}
      return r;
    };
    try {
      history.pushState = wrap(history.pushState);
      history.replaceState = wrap(history.replaceState);
    } catch (_) { /* CSP raro o ya wrapeado */ }
    window.addEventListener('popstate', () => {
      try { window.dispatchEvent(new Event('precio-real:locationchange')); } catch (_) {}
    });
    // Algunos retailers usan hash routing.
    window.addEventListener('hashchange', () => {
      try { window.dispatchEvent(new Event('precio-real:locationchange')); } catch (_) {}
    });
    window.addEventListener('precio-real:locationchange', maybeRunOnLocationChange);
    // Defensa extra: cuando la página vuelve a foco, verificar si la URL cambió.
    // Algunos SPAs swallowean pushState en service workers o navegan vía
    // window.location sin disparar popstate.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') maybeRunOnLocationChange();
    });
  }
  hookHistory();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
