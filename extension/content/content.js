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
      // Si querySelector tira (muy raro), preferimos asumir que sí es producto
      // y dejar que extractPrice resuelva (peor caso: no hay precio → no badge).
      return true;
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
      // Marcamos que el usuario cerró el badge para esta URL — el observer
      // sigue corriendo pero tryMount va a respetar la decisión hasta que
      // navegue a otra URL.
      userClosedForUrl = lastUrl;
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
        console.warn('[Precio Real] affiliateWrap failed', e && e.message);
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

  let lastUrl = null;
  let lastPrice = null;
  let mounted = false;
  let observer = null;
  let observerTimeout = null;
  let observerFires = 0;
  let runToken = 0;
  // URL para la que el usuario apretó la X. Mientras la URL no cambie, no
  // re-montamos el badge aunque el observer se dispare por un re-render.
  let userClosedForUrl = null;

  function unmountBadge() {
    const root = document.getElementById('precio-real-badge-root');
    if (root) try { root.remove(); } catch (_) {}
    mounted = false;
    lastUrl = null;
    lastPrice = null;
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
    if (lastErr) console.warn('[Precio Real] fetch failed', lastErr.message || lastErr);
    return { ok: false, history: [] };
  }

  async function tryMount(siteKey, myToken) {
    if (myToken !== runToken) return false;
    let current, url;
    try {
      if (PR.detectSite(location.hostname) !== siteKey) return false;
      current = PR.extractPrice(siteKey);
      if (!current) return false;
      url = PR.canonicalUrl(location.href);
    } catch (e) {
      console.warn('[Precio Real] tryMount DOM read failed', e && e.message);
      return false;
    }
    // Respetar cierre manual mientras la URL siga siendo la misma.
    if (userClosedForUrl && userClosedForUrl === url) return true;
    if (mounted && url === lastUrl && current === lastPrice) return true;

    const { history } = await fetchHistory(url);
    if (myToken !== runToken) return false;

    let verdict;
    try {
      verdict = classify(current, history);
    } catch (e) {
      console.warn('[Precio Real] classify failed', e && e.message);
      return false;
    }
    const ok = mountBadge(verdict, { retailer: siteKey, href: location.href });
    if (!ok) return false;
    mounted = true;
    lastUrl = url;
    lastPrice = current;
    return true;
  }

  function teardownObserver() {
    if (observer) { try { observer.disconnect(); } catch (_) {} observer = null; }
    if (observerTimeout) { clearTimeout(observerTimeout); observerTimeout = null; }
    observerFires = 0;
  }

  async function run() {
    runToken++;
    const myToken = runToken;
    teardownObserver();
    // Si dejamos de estar en una página de producto (nav SPA a categoría/home),
    // tenemos que sacar el badge viejo para no mostrar info stale.
    if (!isProductPage()) { unmountBadge(); return; }
    const siteKey = PR.detectSite(location.hostname);
    if (!siteKey) { unmountBadge(); return; }

    for (const d of INITIAL_DELAYS_MS) {
      if (myToken !== runToken) return;
      if (d) await new Promise((r) => setTimeout(r, d));
      try {
        if (await tryMount(siteKey, myToken)) return;
      } catch (e) {
        console.warn('[Precio Real] tryMount threw', e && e.message);
      }
    }

    // MutationObserver con debounce para evitar storms.
    let pending = false;
    let debounceTimer = null;
    const fire = () => {
      if (myToken !== runToken) { teardownObserver(); return; }
      if (++observerFires > OBS_MAX_FIRES) { teardownObserver(); return; }
      tryMount(siteKey, myToken).then((didMount) => {
        if (didMount) teardownObserver();
      }).catch((e) => {
        console.warn('[Precio Real] observer tryMount threw', e && e.message);
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
        console.info('[Precio Real] no price after retries+observer', siteKey, location.href);
      }
    }, OBS_TIMEOUT_MS);
  }

  function maybeRunOnLocationChange() {
    let newUrl = null;
    try { newUrl = PR.canonicalUrl(location.href); } catch (_) { return; }
    if (newUrl !== lastUrl) {
      // URL cambió → resetear estado de "cerrado manualmente" y re-correr.
      userClosedForUrl = null;
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
