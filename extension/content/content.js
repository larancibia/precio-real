(function () {
  'use strict';

  const PR = window.PrecioReal;
  if (!PR) { console.warn('[Precio Real] helpers not loaded'); return; }

  // Usar config compartido para que el switch dev↔prod sea un solo archivo.
  const BACKEND = (window.PrecioRealConfig && window.PrecioRealConfig.API_BASE) || 'http://localhost:8787';

  function isProductPage() {
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
    if (document.querySelector('script[type="application/ld+json"]')) {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const txt = s.textContent || '';
        if (txt.includes('"Product"') || txt.includes('"@type":"Product"')) return true;
      }
    }
    if (document.querySelector('.price, .product-price, [data-testid*="price" i]')) return true;
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
    close.addEventListener('click', () => wrap.remove());

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
      const { url, isAffiliate } = PR.affiliateWrap(ctx.href, ctx.retailer);
      if (url) {
        const cta = document.createElement('a');
        cta.className = 'precio-real-badge__cta';
        cta.href = url;
        cta.target = '_blank';
        cta.rel = 'noopener noreferrer';
        cta.textContent = 'Ir al producto →';
        if (isAffiliate) {
          cta.setAttribute('data-precio-real-affiliate', '1');
        }
        wrap.appendChild(cta);
      }
    }

    return wrap;
  }

  function mountBadge(verdict, ctx) {
    let root = document.getElementById('precio-real-badge-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'precio-real-badge-root';
      document.body.appendChild(root);
    }
    root.innerHTML = '';
    root.appendChild(makeBadge(verdict, ctx));
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
  let runToken = 0;

  async function tryMount(siteKey, myToken) {
    if (myToken !== runToken) return false;
    if (PR.detectSite(location.hostname) !== siteKey) return false;
    const current = PR.extractPrice(siteKey);
    if (!current) return false;
    const url = PR.canonicalUrl(location.href);
    if (mounted && url === lastUrl && current === lastPrice) return true;
    let history = [];
    try {
      const res = await fetch(BACKEND + '/api/price?url=' + encodeURIComponent(url), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        history = Array.isArray(data.history) ? data.history : [];
      } else if (res.status !== 404) {
        console.warn('[Precio Real] backend error', res.status);
      }
    } catch (e) {
      console.warn('[Precio Real] fetch failed', e.message);
    }
    if (myToken !== runToken) return false;
    const verdict = classify(current, history);
    mountBadge(verdict, { retailer: siteKey, href: location.href });
    mounted = true;
    lastUrl = url;
    lastPrice = current;
    return true;
  }

  async function run() {
    runToken++;
    const myToken = runToken;
    if (observer) { observer.disconnect(); observer = null; }
    if (observerTimeout) { clearTimeout(observerTimeout); observerTimeout = null; }
    if (!isProductPage()) return;
    const siteKey = PR.detectSite(location.hostname);
    if (!siteKey) return;

    const delays = [0, 500, 1500, 3000];
    for (const d of delays) {
      if (myToken !== runToken) return;
      if (d) await new Promise((r) => setTimeout(r, d));
      if (await tryMount(siteKey, myToken)) return;
    }

    let pending = false;
    observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      Promise.resolve().then(async () => {
        pending = false;
        if (myToken !== runToken) { if (observer) observer.disconnect(); return; }
        if (await tryMount(siteKey, myToken)) {
          if (observer) { observer.disconnect(); observer = null; }
          if (observerTimeout) { clearTimeout(observerTimeout); observerTimeout = null; }
        }
      });
    });
    try {
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      observer = null;
    }
    observerTimeout = setTimeout(() => {
      if (observer) { observer.disconnect(); observer = null; }
      if (myToken === runToken && !mounted) {
        console.info('[Precio Real] no price after retries+observer', siteKey, location.href);
      }
    }, 15000);
  }

  function hookHistory() {
    const wrap = (fn) => function () {
      const r = fn.apply(this, arguments);
      window.dispatchEvent(new Event('precio-real:locationchange'));
      return r;
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('precio-real:locationchange')));
    window.addEventListener('precio-real:locationchange', () => {
      const newUrl = PR.canonicalUrl(location.href);
      if (newUrl !== lastUrl) {
        mounted = false;
        run();
      }
    });
  }
  hookHistory();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
