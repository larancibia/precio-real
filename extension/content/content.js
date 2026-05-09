(function () {
  'use strict';

  // Guard contra doble-inyección: algunos retailers (SPAs agresivos) pueden
  // hacer que el content script se evalúe más de una vez en la misma página,
  // lo que duplicaba listeners de history y wrappers de pushState/replaceState.
  if (window.__precioRealLoaded) return;
  window.__precioRealLoaded = true;

  // Ciclo 1623: versión del content script para facilitar debugging en consola.
  const CONTENT_VERSION = '1623';

  const PR = window.PrecioReal;
  if (!PR) { console.warn('[Precio Real] helpers not loaded'); return; }

  // Usar config compartido para que el switch dev↔prod sea un solo archivo.
  const BACKEND = (window.PrecioRealConfig && window.PrecioRealConfig.API_BASE) || 'https://precio-real-api.arancibialuisalejandro.workers.dev';

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
  // Ciclo 1608: 60→120 para SPAs pesados (Next.js App Router, VTEX IO) que
  // necesitan más tiempo para hidratar el precio en conexiones lentas o con CDN
  // throttling. 15s→25s por la misma razón (hot sale: tráfico alto + servidores lentos).
  const OBS_MAX_FIRES = 120;
  const OBS_TIMEOUT_MS = 25000;
  // Retries iniciales antes de armar el MutationObserver: cubre el caso típico
  // donde el precio aparece tras un XHR <3s después de DOMContentLoaded.
  // Ciclo 1601: +8000ms para VTEX Classic en conexiones lentas.
  const INITIAL_DELAYS_MS = [0, 400, 1000, 2000, 3500, 5500, 8000];
  // Fetch del backend: timeout corto + dos reintentos suaves. Sin esto, una
  // red flakey deja el badge en "sin datos" para siempre.
  const FETCH_TIMEOUT_MS = 6000;
  const FETCH_RETRIES = 2;
  const FETCH_RETRY_BASE_MS = 600;
  // Circuit breaker: si el backend falla N veces seguidas (timeout/red/5xx),
  // dejamos de pegarle por COOLDOWN_MS para no consumir batería del usuario
  // ni inundar la consola con warnings. El reset es automático al expirar el
  // cooldown o ante el primer 200 después de eso.
  const CIRCUIT_FAIL_THRESHOLD = 3;
  // Ciclo 1608: 60s→30s. Durante Hot Sale los backends tienen picos de tráfico
  // que generan 503s transitorios de <30s. Con 60s de cooldown el badge queda
  // en "sin datos" mucho más de lo necesario.
  const CIRCUIT_COOLDOWN_MS = 30_000;
  // Cap defensivo del variant observer: algunos sitios re-renderean atributos
  // ARIA cada segundo sin que la variante cambie de verdad. Sin cap, el observer
  // se mantiene activo toda la sesión disparando schedule() en bucle.
  const VARIANT_OBS_MAX_FIRES = 200;
  // Badge health watch: frecuencia y cantidad máxima de chequeos de "badge sigue
  // en el DOM". Algunos SPAs con virtual-DOM (VTEX IO, Next.js App Router) borran
  // nuestro root silenciosamente entre renders sin cambiar URL ni precio, lo que
  // el variant observer no detecta porque no hay mutación de atributos.
  const BADGE_HEALTH_CHECK_MS = 30_000;
  // Ciclo 1608: 10→20 checks (5 min→10 min). Usuarios que comparan precios
  // durante Hot Sale pasan >5 min en la misma PDP; el badge desaparecía en
  // SPAs con virtual-DOM sin que nadie lo note.
  const BADGE_HEALTH_MAX_CHECKS = 20;

  // Ciclo 1616: CSS inlineado para Shadow DOM. Espeja badge.css pero sin las
  // reglas de #precio-real-badge-root (esas se aplican en el DOM normal via
  // content script CSS). El shadow root aísla completamente el badge de la CSS
  // de la página: sin z-index fights, sin position:fixed hijacked por transform.
  const BADGE_CSS_INLINE = `.precio-real-badge{pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;line-height:1.3;color:#fff;padding:12px 32px 12px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.18);min-width:220px;max-width:320px;position:relative;background:#333;animation:precio-real-fade-in 180ms ease-out}@keyframes precio-real-fade-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}.precio-real-badge--real{background:linear-gradient(135deg,#1f8a4c,#2bb673)}.precio-real-badge--fake{background:linear-gradient(135deg,#b91c1c,#ef4444)}.precio-real-badge--neutral{background:linear-gradient(135deg,#6b7280,#9ca3af);color:#fff}.precio-real-badge__title{font-weight:700;letter-spacing:.2px}.precio-real-badge__sub{font-weight:400;opacity:.9;margin-top:2px;font-size:11.5px}.precio-real-badge__close{position:absolute;top:4px;right:6px;background:transparent;border:none;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:4px;opacity:.85}.precio-real-badge__close:hover{opacity:1;background:rgba(255,255,255,.15)}.precio-real-badge__cta{display:inline-block;margin-top:8px;padding:6px 10px;background:rgba(255,255,255,.18);color:#fff;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;letter-spacing:.2px;transition:background 120ms ease}.precio-real-badge__cta:hover,.precio-real-badge__cta:focus{background:rgba(255,255,255,.28);color:#fff;text-decoration:none;outline:none}`;

  // Retorna true si el badge está montado (en shadow root o en light DOM).
  // Reemplaza los checks root.hasChildNodes() que no funcionan cuando el badge
  // vive dentro de un shadow root (los hijos del shadow no cuentan en la API
  // de nodos del host element).
  function badgeIsInDOM(root) {
    if (!root || !root.isConnected) return false;
    const target = (root.shadowRoot) || root;
    return !!target.querySelector('.precio-real-badge');
  }

  function isProductPage() {
    // Si helpers expone la versión strict (incluye filtro de URLs de listado),
    // la preferimos. Caemos al detector legacy si no.
    if (typeof PR.isProductPageStrict === 'function') {
      try {
        const site = PR.detectSite ? PR.detectSite(location.hostname) : null;
        // Ciclo 1602: bail-out temprano si el sitio no está soportado. Evita
        // DOM queries costosas en retailers no cubiertos.
        if (site === null) return false;
        return PR.isProductPageStrict(site);
      } catch (_) { /* caer al legacy */ }
    }
    try {
      const site = PR.detectSite ? PR.detectSite(location.hostname) : null;
      // Ciclo 1602: bail-out temprano para sitios no soportados en el camino legacy.
      if (site === null) return false;
      if (site === 'mercadolibre') {
        if (location.hostname.startsWith('articulo.')) return true;
        if (/\/p\//.test(location.pathname)) return true;
        if (/MLA-?\d+/i.test(location.pathname)) return true;
        return false;
      }
      // Descarta listados/categorías antes de los DOM queries: evita falsos
      // positivos en páginas que muestran precios pero no son una PDP.
      if (typeof PR.urlLooksLikeListing === 'function') {
        try {
          if (PR.urlLooksLikeListing(site, location.pathname)) return false;
        } catch (_) { /* ignorar */ }
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
        // Ciclo 1617: algunos retailers (CompuPC, Binario, tiendas WooCommerce genéricas)
        // emiten Offer directamente sin envolverlo en un Product, o bien emiten
        // ItemPage con un mainEntity Offer. Si el ld+json contiene "@type":"Offer"
        // con un precio numérico, es prácticamente seguro que es una PDP.
        if ((txt.includes('"Offer"') || txt.includes('"@type":"Offer"')) && txt.includes('"price"')) return true;
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
    // Ciclo 1602: data-version para facilitar debugging ("¿qué versión del
    // content script está corriendo?") sin abrir el panel de extensiones.
    wrap.setAttribute('data-pr-version', CONTENT_VERSION);
    // Tooltip: repite el subtítulo para usuarios que hacen hover y quieren
    // copiar el texto, y para lectores de pantalla que no leen el badge abierto.
    if (verdict.label || verdict.sub) {
      wrap.setAttribute('title', [verdict.label, verdict.sub].filter(Boolean).join(' — '));
    }

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
      // Propagar retailer como atributo para CSS/debug (ej. [data-site="fravega"]).
      if (ctx && ctx.retailer) root.setAttribute('data-site', ctx.retailer);
      // aria-live para lectores de pantalla: el badge es una notificación no crítica.
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-atomic', 'true');
      try {
        body.appendChild(root);
      } catch (e) {
        // Algunos retailers (SPAs con virtual DOM o CSP restrictiva) pueden
        // bloquear appendChild en body. Intentar con documentElement como fallback.
        try { (document.documentElement || document.body).appendChild(root); }
        catch (_) { return false; }
      }
    } else if (!root.isConnected) {
      // Body fue reemplazado (SPA hard-swap), root quedó huérfano.
      if (ctx && ctx.retailer) root.setAttribute('data-site', ctx.retailer);
      try {
        body.appendChild(root);
      } catch (_) {
        try { (document.documentElement || document.body).appendChild(root); }
        catch (__) { return false; }
      }
    } else if (ctx && ctx.retailer && !root.getAttribute('data-site')) {
      root.setAttribute('data-site', ctx.retailer);
    }
    // Ciclo 1616: montar el badge en un Shadow Root si el browser lo soporta.
    // El shadow DOM aísla completamente el badge de la CSS de la página:
    // position:fixed no se ve afectado por transform/filter de ancestros porque
    // el shadow root crea su propio stacking context, y los selectores del sitio
    // no pueden alcanzar nuestros elementos internos. Fallback a light DOM si el
    // browser no soporta attachShadow (Edge Legacy, algunos entornos de kiosk).
    let mountTarget = root;
    try {
      if (!root.shadowRoot && typeof root.attachShadow === 'function') {
        const shadow = root.attachShadow({ mode: 'open' });
        const styleEl = document.createElement('style');
        styleEl.textContent = BADGE_CSS_INLINE;
        shadow.appendChild(styleEl);
      }
      if (root.shadowRoot) mountTarget = root.shadowRoot;
    } catch (_) { mountTarget = root; }

    // Limpiar badge anterior preservando el <style> en el shadow root.
    try {
      const badge = makeBadge(verdict, ctx);
      if (mountTarget !== root) {
        // Shadow root: reemplazar solo el badge, dejar el <style> intacto.
        const old = mountTarget.querySelector('.precio-real-badge');
        if (old) old.remove();
        mountTarget.appendChild(badge);
      } else if (typeof root.replaceChildren === 'function') {
        root.replaceChildren(badge);
      } else {
        root.innerHTML = '';
        root.appendChild(badge);
      }
    } catch (e) {
      log.warn('mountBadge DOM write failed', e && e.message);
      return false;
    }
    // Chequeo sincrónico de stacking context: si inmediatamente después de
    // appendear el badge root NO está en el cuadrante top-right del viewport,
    // algún ancestro tiene transform/filter/contain/backdrop-filter que convierte
    // nuestro position:fixed en relativo a ese ancestro. Hoistamos a <html> ahora
    // mismo en lugar de esperar el schedulePostMountCheck diferido.
    try {
      const win = body.ownerDocument && body.ownerDocument.defaultView;
      if (win) {
        const vw = win.innerWidth || 0;
        if (vw > 400) {
          const rect = root.getBoundingClientRect();
          if (rect.right < vw / 2) {
            const docEl = body.ownerDocument.documentElement;
            if (docEl && root.parentElement !== docEl) {
              docEl.appendChild(root);
            }
          }
        }
      }
    } catch (_) {}
    return true;
  }

  // classify() acepta opcionalmente stats pre-computados del backend. Si vienen,
  // los usa directamente (más preciso que el cómputo local). Si no, usa
  // fallbackClassify() que opera sobre el array history completo.
  function classify(current, history, stats) {
    // Camino feliz: stats del backend disponibles (ciclo 1599+).
    if (stats && typeof stats.real_discount_pct === 'number' && stats.price_7d_ago != null) {
      return classifyFromStats(current, stats);
    }
    if (typeof PR.classifyPrice === 'function') return PR.classifyPrice(current, history);
    if (typeof PR.fallbackClassify === 'function') return PR.fallbackClassify(current, history);
    return { kind: 'neutral', pct: 0, label: 'Precio Real', sub: '' };
  }

  // Convierte los stats pre-computados del backend a un verdict de badge.
  // Usa la misma lógica que computeStats() del worker (7-day point comparison).
  //
  // Convención del backend (analytics.ts):
  //   real_discount_pct = (price_7d_ago - current_price) / price_7d_ago * 100
  //   → positivo: precio bajó respecto a hace 7 días (descuento real)
  //   → negativo: precio subió (inflado)
  //   inflated = current_price > price_7d_ago * 1.05
  //
  // Ciclo 1592: si price_7d_ago es null pero price_30d_ago está disponible,
  // se usa como baseline secundario con umbrales levemente más amplios
  // (±10% para "real"/"inflado") para compensar la mayor volatilidad en 30d.
  function classifyFromStats(current, stats) {
    const pct = stats.real_discount_pct;  // positivo = bajó, negativo = subió
    const inflated = stats.inflated;
    const baseline7d = stats.price_7d_ago;
    const baseline30d = stats.price_30d_ago ?? null;
    const ageDays = stats.baseline_age_days;
    const ageSuffix = (ageDays != null && ageDays > 0) ? ` (hace ${ageDays}d)` : '';

    // ── Camino 7-day baseline (primario) ──────────────────────────────────────
    if (baseline7d != null) {
      if (inflated) {
        // Subió >5% respecto al precio de hace 7 días.
        const risePct = pct != null ? Math.abs(Math.round(pct)) : 5;
        return {
          kind: 'inflated',
          pct: risePct,
          label: 'Precio Real: ✗ INFLADO',
          sub: `Subió ${risePct}% vs. 7 días atrás${ageSuffix}`,
        };
      }
      if (pct != null && pct >= 5) {
        // Bajó al menos 5% respecto a hace 7 días.
        return {
          kind: 'real',
          pct: Math.round(pct),
          label: 'Precio Real: ✓ DESCUENTO REAL',
          sub: `-${Math.round(pct)}% vs. 7 días atrás${ageSuffix}`,
        };
      }
      // Tenemos baseline pero el movimiento es pequeño (|pct| < 5%).
      const absPct = pct != null ? Math.round(Math.abs(pct)) : 0;
      const direction = (pct != null && pct < 0) ? `+${absPct}%` : (pct != null && pct > 0) ? `-${absPct}%` : '≈';
      // Mostrar cuántos días de historial tiene para que el usuario sepa si es
      // un baseline sólido (7d exactos) o una aproximación (baseline_age_days > 8).
      const ageNote = (ageDays != null && ageDays > 8) ? ` (ref. ${ageDays}d)` : ageSuffix;
      return {
        kind: 'neutral',
        pct: 0,
        label: 'Precio Real: sin descuento',
        sub: `${direction} vs. 7 días atrás${ageNote}`,
      };
    }

    // ── Camino 30-day baseline (fallback cuando price_7d_ago es null) ─────────
    // Aplica cuando hay historial de más de 7 días pero no hay un punto de
    // precio a ~7 días exactos. Usamos umbrales de ±10% para compensar la mayor
    // variabilidad natural a 30 días vs. 7 días.
    if (baseline30d != null && current != null) {
      const pct30 = ((baseline30d - current) / baseline30d) * 100; // positivo = bajó
      if (current > baseline30d * 1.10) {
        // Subió >10% en el mes: precio inflado.
        const risePct = Math.round(Math.abs(pct30));
        return {
          kind: 'inflated',
          pct: risePct,
          label: 'Precio Real: ✗ INFLADO',
          sub: `Subió ${risePct}% vs. 30 días atrás`,
        };
      }
      if (pct30 >= 10) {
        // Bajó al menos 10% respecto al mes pasado.
        return {
          kind: 'real',
          pct: Math.round(pct30),
          label: 'Precio Real: ✓ DESCUENTO REAL',
          sub: `-${Math.round(pct30)}% vs. 30 días atrás`,
        };
      }
      // Movimiento pequeño en el mes.
      const absPct30 = Math.round(Math.abs(pct30));
      const direction30 = pct30 < 0 ? `+${absPct30}%` : pct30 > 0 ? `-${absPct30}%` : '≈';
      return {
        kind: 'neutral',
        pct: 0,
        label: 'Precio Real: sin descuento',
        sub: `${direction30} vs. 30 días atrás`,
      };
    }

    return { kind: 'neutral', pct: 0, label: 'Precio Real: sin datos', sub: 'Histórico insuficiente' };
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

  // Circuit breaker state. Compartido entre todos los tryMount de la sesión.
  let circuitFails = 0;
  let circuitOpenUntil = 0;

  function circuitIsOpen() {
    return circuitOpenUntil > 0 && Date.now() < circuitOpenUntil;
  }

  function circuitRecordFail() {
    circuitFails++;
    if (circuitFails >= CIRCUIT_FAIL_THRESHOLD) {
      circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
      log.warn('backend circuit open (cooldown ' + (CIRCUIT_COOLDOWN_MS / 1000) + 's)');
    }
  }

  function circuitRecordSuccess() {
    circuitFails = 0;
    circuitOpenUntil = 0;
  }

  // fetch con timeout + retry + circuit breaker.
  // Devuelve {ok:true, history, stats} o {ok:false, history:[], stats:null}.
  // stats es el objeto pre-computado del backend: { current_price, price_7d_ago,
  // real_discount_pct, inflated, baseline_age_days } — si está presente se usa
  // directamente en classify() para evitar doble cómputo con otra ventana temporal.
  async function fetchHistory(url) {
    if (circuitIsOpen()) {
      // Backend está marcado caído: no insistir hasta que pase cooldown.
      log.debug(null, 'circuit open, skipping fetch', url);
      return { ok: false, history: [], stats: null };
    }
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
          // Extraer stats pre-computados del backend (ciclo 1599+). Si no vienen
          // (backend viejo o sin datos), stats queda null y classify() usa fallback.
          // Ciclo 1592: también capturamos price_30d_ago como baseline secundario:
          // cuando el producto tiene menos de 7 días de historial pero sí tiene 30 días,
          // classifyFromStats puede usarlo para mostrar "sin datos" con más contexto
          // en lugar de mostrar nada.
          const stats = (data && typeof data.real_discount_pct !== 'undefined') ? {
            current_price: data.current_price ?? null,
            price_7d_ago: data.price_7d_ago ?? null,
            real_discount_pct: data.real_discount_pct ?? null,
            inflated: !!data.inflated,
            baseline_age_days: data.baseline_age_days ?? null,
            price_30d_ago: data.price_30d_ago ?? null,
          } : null;
          circuitRecordSuccess();
          return { ok: true, history, stats };
        }
        if (res.status === 404) {
          // No existe historial para esta URL: respuesta válida, sin retry.
          // Cuenta como éxito a fines del breaker (el backend respondió).
          circuitRecordSuccess();
          return { ok: true, history: [], stats: null };
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
    circuitRecordFail();
    return { ok: false, history: [], stats: null };
  }

  // Ciclo 1596: chequeo post-mount diferido para dos problemas conocidos:
  //
  // 1) CSS visibility reset: algunos retailers inyectan reglas globales que
  //    pueden ocultar nuestro root (display:none, visibility:hidden). Detectamos
  //    y restauramos con inline style !important.
  //
  // 2) CSS transform/filter stacking context: position:fixed es relativo al
  //    viewport SALVO que un ancestro tenga transform/perspective/will-change/
  //    filter/contain. Si detectamos que el badge no está en el cuadrante
  //    top-right del viewport, intentamos hoistarlo a <html>.
  //
  // Ciclo 1597: multi-shot (300ms, 1500ms, 5000ms) para capturar CSS que carga
  // tarde en VTEX IO, Next.js app-router, SAP Commerce/Hybris, y Shopify.
  function schedulePostMountCheck(siteKey) {
    function runCheck() {
      const root = document.getElementById('precio-real-badge-root');
      if (!root || !root.isConnected) return;
      try {
        const win = root.ownerDocument && root.ownerDocument.defaultView;
        if (!win) return;
        // 1) Visibility self-heal.
        const cs = win.getComputedStyle(root);
        if (cs.display === 'none' || cs.visibility === 'hidden') {
          root.style.setProperty('display', 'block', 'important');
          root.style.setProperty('visibility', 'visible', 'important');
          log.debug(siteKey, 'badge CSS self-heal: visibility restored');
        }
        // opacity:0 + pointer-events:none es otro patrón de "oculto" que usan
        // algunos retailers (Falabella, Jumbo) en nodos fuera del viewport.
        if (cs.opacity === '0' && cs.pointerEvents === 'none') {
          root.style.setProperty('opacity', '1', 'important');
          root.style.setProperty('pointer-events', 'auto', 'important');
          log.debug(siteKey, 'badge CSS self-heal: opacity/pointer-events restored');
        }
        // z-index negativo o cero: algunos themes (Asus Store AR, Next.js con
        // CSS-in-JS) asignan z-index:0 al body o a un wrapper que aplana el
        // stacking context y entierra nuestro position:fixed bajo capas SVG/canvas.
        const zIdx = parseInt(cs.zIndex, 10);
        if (!isNaN(zIdx) && zIdx < 1) {
          root.style.setProperty('z-index', '2147483647', 'important');
          log.debug(siteKey, 'badge CSS self-heal: z-index restored');
        }
        // Ciclo 1602: position self-heal. Algunos themes globales (Magento 2 con
        // normalize.css custom, Jumbo rebranding) aplican `position: relative !important`
        // a todos los div[id] o al body, lo que convierte nuestro position:fixed
        // en relative y colapsa el badge al final del DOM (fuera del viewport).
        // Si el position computado no es "fixed", lo restauramos.
        if (cs.position && cs.position !== 'fixed') {
          root.style.setProperty('position', 'fixed', 'important');
          log.debug(siteKey, 'badge CSS self-heal: position restored from ' + cs.position + ' to fixed');
        }
        // 2) Stacking context fix: si rect.right < vw/2, un ancestro tiene
        //    un nuevo stacking context (transform, filter, perspective, will-change,
        //    backdrop-filter, contain:layout/paint/strict).
        const vw = win.innerWidth || root.ownerDocument.documentElement.clientWidth || 0;
        if (vw > 400) {
          const rect = root.getBoundingClientRect();
          if (rect.right < vw / 2) {
            const docEl = root.ownerDocument.documentElement;
            if (docEl && root.parentElement !== docEl) {
              docEl.appendChild(root);
              log.debug(siteKey, 'badge hoisted to <html> (CSS stacking context)');
              return;
            }
          }
          // Badge completamente fuera del viewport (top/bottom): will-change:transform
          // en un ancestro puede desplazar el stacking context sin mover rect.right.
          const vh = win.innerHeight || root.ownerDocument.documentElement.clientHeight || 0;
          if (vh > 0 && (rect.bottom < -50 || rect.top > vh + 50)) {
            const docEl = root.ownerDocument.documentElement;
            if (docEl && root.parentElement !== docEl) {
              docEl.appendChild(root);
              log.debug(siteKey, 'badge hoisted to <html> (out-of-viewport stacking context)');
            }
          }
          // Chequeo proactivo: recorrer ancestros buscando propiedades que crean
          // stacking context para position:fixed (backdrop-filter es el más común
          // en themes Shopify modernos; contain:layout/paint en VTEX IO reciente).
          if (root.isConnected && root.parentElement && root.parentElement !== root.ownerDocument.documentElement) {
            let ancestor = root.parentElement;
            let needsHoist = false;
            for (let i = 0; i < 12 && ancestor && ancestor.tagName; i++) {
              try {
                const acs = win.getComputedStyle(ancestor);
                const backdropFilter = acs.backdropFilter || acs.webkitBackdropFilter || '';
                const contain = acs.contain || '';
                // Ciclo 1601: isolation:isolate (React portals, CSS-in-JS) y
                // will-change:transform/opacity/filter también crean stacking context
                // para position:fixed, enterrando el badge bajo otros elementos.
                const isolation = acs.isolation || '';
                const willChange = acs.willChange || '';
                // Ciclo 1604: clip-path distinto de none también crea stacking context
                // para position:fixed. Usado en temas Shopify modernos (Musimundo,
                // Compumundo) y algunos temas Next.js con clipping decorativo.
                const clipPath = acs.clipPath || '';
                // Ciclo 1605: transform distinto de none crea stacking context para
                // position:fixed incluso cuando will-change no lo refleja. Muy común
                // en VTEX IO (transform: translateZ(0) para GPU acceleration), Shopify
                // themes con animaciones de entrada, y Next.js con framer-motion.
                // perspective distinto de none hace lo mismo (WebGL overlays, 3D carousels).
                // mix-blend-mode distinto de normal también lo crea (efectos de overlay
                // en temas premium de Garbarino, Frávega, y retailers Samsung/LG).
                // Ciclo 1614: filter distinto de none también crea stacking context
                // (drop-shadow en imágenes de producto, brightness en banners Hot Sale).
                const filter = acs.filter || '';
                const transform = acs.transform || '';
                const perspective = acs.perspective || '';
                const mixBlendMode = acs.mixBlendMode || '';
                // Ciclo 1616: content-visibility:auto crea un nuevo stacking context
                // en Chrome 85+ y se usa en PDPs con lazy rendering (Carrefour AR nueva
                // arquitectura, algunos temas Next.js con @vercel/og). También capturamos
                // view-transition-name que en Chrome 111+ crea stacking context al activar
                // la View Transitions API (retailers que migraron a SPA con animaciones nativas).
                const contentVisibility = acs.contentVisibility || '';
                const viewTransitionName = acs.viewTransitionName || '';
                // Ciclo 1606: overflow:hidden en un ancestro puede clipear position:fixed
                // cuando ese ancestro también crea un stacking context (lo cual sucede
                // frecuentemente junto con transform/will-change). En Shopify Debut/Dawn
                // (TCL AR, Coolbox AR, iPoint AR) el wrapper #shopify-section-header tiene
                // overflow:hidden + position:sticky, lo que clipea nuestro badge en mobile.
                // Detectamos overflow:clip y overflow:hidden como señal adicional para hoist.
                const overflowX = acs.overflowX || '';
                const overflowY = acs.overflowY || '';
                const overflowHidden = (overflowX === 'hidden' || overflowX === 'clip' ||
                                        overflowY === 'hidden' || overflowY === 'clip');
                if ((backdropFilter && backdropFilter !== 'none') ||
                    /strict|layout|paint/.test(contain) ||
                    isolation === 'isolate' ||
                    /transform|opacity|filter/.test(willChange) ||
                    (clipPath && clipPath !== 'none') ||
                    (filter && filter !== 'none') ||
                    (transform && transform !== 'none') ||
                    (perspective && perspective !== 'none') ||
                    (mixBlendMode && mixBlendMode !== 'normal') ||
                    (contentVisibility === 'auto' || contentVisibility === 'hidden') ||
                    (viewTransitionName && viewTransitionName !== 'none') ||
                    // Solo hoist por overflow si también hay un stacking context implícito
                    // (position:sticky/fixed en el ancestor, o z-index distinto de auto):
                    (overflowHidden && (acs.position === 'sticky' || acs.position === 'fixed' ||
                                        (acs.zIndex && acs.zIndex !== 'auto')))) {
                  needsHoist = true;
                  break;
                }
              } catch (_) {}
              ancestor = ancestor.parentElement;
            }
            if (needsHoist) {
              const docEl = root.ownerDocument.documentElement;
              if (docEl && root.parentElement !== docEl) {
                docEl.appendChild(root);
                log.debug(siteKey, 'badge hoisted to <html> (backdrop-filter/contain stacking context)');
              }
            }
          }
        }
      } catch (_) {}
    }
    // Cinco disparos: 300ms (CSS crítico), 1500ms (post-hidratación VTEX/Next.js),
    // 5000ms (SAP Commerce/Shopify scripts tardíos), 10000ms (analytics/tracking
    // scripts que reescriben z-index o visibility en el body tardíamente),
    // 20000ms (Ciclo 1605: GTM/pixel scripts que inyectan CSS extra muy tarde en
    // retailers con muchos third-party tags como Garbarino, Naldo, Megatone).
    // Ciclo 1619: array-driven para facilitar añadir/quitar disparos sin contar
    // setTimeout llamadas sueltas.
    const POST_MOUNT_DELAYS_MS = [300, 1500, 5000, 10000, 20000];
    for (const d of POST_MOUNT_DELAYS_MS) {
      setTimeout(runCheck, d);
    }
  }

  async function tryMount(siteKey, myToken) {
    if (myToken !== runToken) return false;
    let current, url, key;
    try {
      if (PR.detectSite(location.hostname) !== siteKey) return false;
      current = PR.extractPrice(siteKey);
      if (!current) {
        // Log extra info para debug: cuántos selectores del retailer hay definidos,
        // por si el problema es que ninguno matchea en esta PDP.
        if (typeof PR.RETAILERS === 'object' && PR.RETAILERS[siteKey]) {
          const selCount = (PR.RETAILERS[siteKey].selectors || []).length;
          log.debug(siteKey, 'extractPrice → null (' + selCount + ' selectors tried)');
        } else {
          log.debug(siteKey, 'extractPrice → null');
        }
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
    // Si nada cambió, verificar que el badge siga en el DOM antes de devolver true.
    // Algunos SPAs con virtual DOM (VTEX IO, Next.js con reconciler agresivo) pueden
    // remover nuestro root silenciosamente entre renders sin cambiar la URL ni el precio.
    if (mounted && key === lastKey && current === lastPrice) {
      const root = document.getElementById('precio-real-badge-root');
      if (root && badgeIsInDOM(root)) return true;
      // Badge fue removido del DOM → forzar re-mount.
      mounted = false;
    }

    log.debug(siteKey, 'tryMount', { url, key, current });
    const { history, stats } = await fetchHistory(url);
    // Ciclo 1619: re-verificar siteKey post-fetch. El usuario pudo navegar a otra
    // URL mientras el fetch estaba en vuelo (especialmente en conexiones lentas
    // durante Hot Sale). Si el sitio cambió, el runToken ya habrá rotado pero si
    // la navegación fue dentro del mismo dominio (SPA), myToken puede seguir siendo
    // válido aunque estemos en un producto distinto. El check de URL es la red de
    // seguridad correcta en ese caso.
    if (myToken !== runToken) return false;
    if (PR.detectSite(location.hostname) !== siteKey) return false;

    let verdict;
    try {
      verdict = classify(current, history, stats);
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
    schedulePostMountCheck(siteKey);
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
  let variantFires = 0;
  const VARIANT_CHECK_MS = 1000;

  function teardownVariantObserver() {
    if (variantObserver) { try { variantObserver.disconnect(); } catch (_) {} variantObserver = null; }
    if (variantTimer) { clearTimeout(variantTimer); variantTimer = null; }
    variantFires = 0;
  }

  function startVariantObserver(siteKey, myToken) {
    teardownVariantObserver();
    if (!document.body || typeof MutationObserver !== 'function') return;
    const schedule = () => {
      if (variantTimer) return;
      // Cap defensivo: si el sitio dispara mutaciones en bucle indefinidamente
      // (ej. carrusel que togglea aria-selected), cortamos el observer en vez
      // de seguir gastando ciclos. La cobertura de variantes se pierde, pero
      // la URL nav sigue cubierta por el listener de history.
      if (++variantFires > VARIANT_OBS_MAX_FIRES) {
        log.debug(siteKey, 'variant observer hit cap, tearing down');
        teardownVariantObserver();
        return;
      }
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
      // Ciclo 1622: characterData:true captura actualizaciones in-place del texto
      // del precio (skeleton loaders, hidratación diferida en VTEX Faststore v3,
      // Shopify headless) que no generan mutaciones childList/attributes.
      variantObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeFilter: [
          // Variantes: SKU/product-id/variant-id se actualizan al cambiar swatch.
          'data-sku', 'data-product-sku', 'data-product-id', 'data-variant-id',
          'data-value', 'data-fs-product-id',
          // Atributos ARIA del swatch seleccionado.
          'aria-checked', 'aria-pressed', 'aria-selected',
          // VTEX/Magento exponen el precio mismo como atributo (data-price-amount,
          // data-internet-price). Si cambia, el precio cambió.
          'data-price-amount', 'data-internet-price', 'data-cmr-price',
          'data-fs-price-variant',
          // Ciclo 12: Samsung Hybris (data-pricetype), retailers SAP Commerce
          // (data-product-code), Next.js con styled-components que cambian
          // el className del wrapper de precio al re-render (lo capturamos como
          // un "cambio de variante" defensivo si todo lo otro falla).
          'data-pricetype', 'data-price-type', 'data-product-code',
          'aria-busy',
          // Ciclo 1585: Amazon AR — ASIN cambia al seleccionar variante de color
          // o tamaño. data-dp-url y data-selected-size-name son el selector de
          // variante del carrusel de swatches. data-defaultasin es el fallback.
          'data-asin', 'data-dp-url', 'data-selected-size-name', 'data-defaultasin',
          // WooCommerce (Drean, HiperTehno) — el formulario de variante actualiza
          // data-product_id y data-variation_id al elegir atributo.
          'data-product_id', 'data-variation_id',
          // PrestaShop (Todomodo y otros temas PS) — id de atributo y combination id.
          'data-id-product-attribute', 'data-id-product', 'data-combination-id',
          // VTEX IO (Garbarino, Jumbo, Disco, Easy, Carrefour): specification-value
          // se actualiza cuando el usuario elige un swatch de color/talle. skuid
          // es el selector legacy de VTEX classic.
          'data-specification-value', 'data-skuid',
          // Shopify / temas custom (Musimundo, Compumundo): option-value cambia
          // al seleccionar una variante de color o talle.
          'data-option-value', 'data-option',
          // Ciclo 1601: VTEX Faststore (Garbarino nuevo, Jumbo) usa data-fs-sku y
          // data-loading en el contenedor de precio al cambiar variante. WooCommerce
          // con bulk pricing puede cambiar precio con data-quantity.
          'data-fs-sku', 'data-loading', 'data-quantity',
          // Ciclo 1606: data-fs-variant-id es el selector de variante en VTEX
          // Faststore v2+ (Carrefour AR, Changomás). data-product-variant-id
          // aparece en algunos temas Shopify custom (Coolbox AR, Full AR).
          // data-selected-variant es del Debut/Dawn theme de Shopify.
          'data-fs-variant-id', 'data-product-variant-id', 'data-selected-variant',
          // Ciclo 1607: data-price-value (Shopify centavos, Dexter AR y otros themes
          // Shopify custom); data-fs-price-value (VTEX Faststore v2+, precio en el
          // contenedor de precio que cambia al seleccionar variante).
          'data-price-value', 'data-fs-price-value',
          // Ciclo 1614: VTEX Faststore v3 — data-fs-selling-price y data-fs-offer-price
          // reemplazan data-fs-price-variant en las PDPs nuevas de Carrefour AR,
          // Changomás y Garbarino migrados al nuevo stack Faststore.
          'data-fs-selling-price', 'data-fs-offer-price',
          // Ciclo 1615: data-fs-delivery-price cubre el precio con envío incluido
          // en VTEX Faststore v3+ (Jumbo AR, Disco AR con campañas de envío gratis).
          // data-wc-variation-id es el identificador de variante en WooCommerce blocks
          // (Gutenberg blocks en PHP 8.1+ con WooCommerce Blocks 11+, usado en
          // Powerplanet AR, Megastore AR y otros WooCommerce modernos).
          'data-fs-delivery-price', 'data-wc-variation-id',
          // Ciclo 1616: data-sku-id (Shopify Markets: klibr, lazer, pcarg y otros que
          // migraron a Shopify Markets 2025 donde el SKU se expone como data-sku-id en
          // el picker de variantes). data-product-form-id es el ID del formulario de
          // producto en temas Shopify custom con múltiples secciones de producto.
          // data-selected-sku (CompraGamer custom engine: cambia al seleccionar
          // un kit o configuración de PC). data-bundle-id (retailers de gaming que
          // venden bundles — GearZone, Lazer, Klibr — donde el ID del bundle
          // identifica la configuración elegida y determina el precio final).
          'data-sku-id', 'data-product-form-id', 'data-selected-sku', 'data-bundle-id',
          // Ciclo 1618: data-variant (Shopify temas minimal que omiten el sufijo -id),
          // data-option-index (temas Shopify custom con picker multi-opción),
          // data-selected-option (algunos temas WooCommerce custom con AJAX variation).
          'data-variant', 'data-option-index', 'data-selected-option',
          // Ciclo 1622: data-final-price (Falabella AR, WooCommerce con precios de
          // oferta), data-sale-price (Shopify themes que exponen el precio de venta
          // directamente en el swatch), data-offer-price (temas Shopify custom como
          // Olimpo AR, Maxiconsumo), data-list-price (precio de lista visible en
          // badges de descuento, indicador de que el precio "real" cambió).
          'data-final-price', 'data-sale-price', 'data-offer-price', 'data-list-price',
        ],
      });
    } catch (_) { variantObserver = null; }
  }

  // Periódicamente verifica que el badge siga visible para el token activo.
  // Rescata casos donde un SPA borra nuestro root silenciosamente sin disparar
  // el variant observer (sin cambios de atributo ni childList en el wrapper).
  function startBadgeHealthWatch(siteKey, myToken) {
    let checks = 0;
    function tick() {
      if (myToken !== runToken) return;
      if (!mounted) return;
      if (++checks > BADGE_HEALTH_MAX_CHECKS) return;
      const root = document.getElementById('precio-real-badge-root');
      if (!root || !badgeIsInDOM(root)) {
        mounted = false;
        tryMount(siteKey, myToken).then((didMount) => {
          if (didMount) schedulePostMountCheck(siteKey);
        }).catch(() => {});
      }
      setTimeout(tick, BADGE_HEALTH_CHECK_MS);
    }
    setTimeout(tick, BADGE_HEALTH_CHECK_MS);

    // Ciclo 1602: observar el <html> element para detectar swap del <body>.
    // Algunos SPAs (Next.js App Router con React Server Components, Nuxt 3)
    // reemplazan el body entero como childList mutation en documentElement.
    // El variant observer solo mira document.body, que queda desconectado tras
    // el swap, y el health-watch de arriba lo rescata en BADGE_HEALTH_CHECK_MS
    // (30s) — demasiado tarde. Con este observer lo detectamos inmediatamente.
    // Cap conservador (10 fires): si el sitio swappea el body en bucle, algo
    // está muy mal; cortamos para no gastar ciclos en un loop infinito.
    let bodySwapFires = 0;
    const BODY_SWAP_MAX_FIRES = 10;
    if (typeof MutationObserver === 'function' && document.documentElement) {
      try {
        const bodySwapObs = new MutationObserver(() => {
          if (myToken !== runToken) { bodySwapObs.disconnect(); return; }
          if (++bodySwapFires > BODY_SWAP_MAX_FIRES) { bodySwapObs.disconnect(); return; }
          if (!mounted) return;
          const root = document.getElementById('precio-real-badge-root');
          if (!root || !badgeIsInDOM(root)) {
            mounted = false;
            log.debug(siteKey, 'body swap detected, re-mounting badge');
            tryMount(siteKey, myToken).then((didMount) => {
              if (didMount) schedulePostMountCheck(siteKey);
            }).catch(() => {});
          }
        });
        bodySwapObs.observe(document.documentElement, { childList: true });
      } catch (_) { /* entorno sin MutationObserver: health tick lo cubre */ }
    }
  }

  // Ciclo 1618: detección de cambios de variante basada en eventos DOM nativos.
  // Complementa el MutationObserver para plataformas que despachan eventos
  // en lugar de (o además de) mutar atributos:
  //
  //  • WooCommerce variable products: evento `change` en .variations_form cuando
  //    el usuario elige un atributo (talle, color, capacidad). El framework
  //    actualiza el precio vía XHR y cambia el DOM ~300ms después del change.
  //
  //  • Shopify themes (Dawn, Debut, themes custom): evento `variant:change`
  //    CustomEvent despachado en document cuando el picker de variantes confirma
  //    la selección. También capturamos `variantChange` (snake-camelCase variant).
  //
  //  • VTEX IO / Faststore: evento `vtex:productView` que el runtime despacha
  //    cuando el PDP recarga datos de producto al cambiar variante (colorId,
  //    skuId) en un SPA sin cambiar la URL.
  //
  // En todos los casos debounceamos 500ms para esperar que el DOM estabilice
  // el nuevo precio antes de llamar tryMount.
  function startEventBasedVariantDetection(siteKey, myToken) {
    let evTimer = null;
    function scheduleCheck() {
      if (evTimer) return;
      evTimer = setTimeout(() => {
        evTimer = null;
        if (myToken !== runToken) return;
        if (!mounted) return;
        let current = null, key = null;
        try {
          current = PR.extractPrice(siteKey);
          key = getProductKey(location.href);
        } catch (_) { return; }
        if (!current) return;
        if (key === lastKey && current === lastPrice) return;
        if (key !== lastKey) userClosedForKey = null;
        log.debug(siteKey, 'event-based variant change', { key, current });
        tryMount(siteKey, myToken).catch((e) => {
          log.warn('event variant tryMount threw', e && e.message);
        });
      }, 500);
    }
    try {
      // WooCommerce: `change` en el formulario de variantes.
      document.addEventListener('change', (e) => {
        const t = e.target;
        if (t && typeof t.closest === 'function') {
          if (t.closest('.variations_form, form.cart[data-product_id], .woocommerce-variation-add-to-cart')) {
            scheduleCheck();
          }
        }
      }, { passive: true, capture: false });
      // Shopify: variant:change y variantChange CustomEvents.
      document.addEventListener('variant:change', scheduleCheck, { passive: true });
      document.addEventListener('variantChange', scheduleCheck, { passive: true });
      // VTEX IO / Faststore: productView se despacha al cambiar SKU en SPA.
      document.addEventListener('vtex:productView', scheduleCheck, { passive: true });
      // Ciclo 1622: PrestaShop (Todomodo, iPoint, retailers PS 1.7+): updatedProduct
      // se despacha cuando cambia la combination seleccionada y el precio se actualizó.
      document.addEventListener('updatedProduct', scheduleCheck, { passive: true });
      // Ciclo 1622: eventos genéricos usados por varios retailers custom y headless.
      // price:updated: retailers con frontend propio (Newsan, BGH tienda oficial) que
      // emiten este evento al cargar el precio vía API. product:update: algunos temas
      // WooCommerce custom (AEG, Electrolux AR, Drean outlet) y Magento 2 con módulos
      // de personalización que despachan product:update al cambiar configuración.
      document.addEventListener('price:updated', scheduleCheck, { passive: true });
      document.addEventListener('product:update', scheduleCheck, { passive: true });
    } catch (_) { /* entorno sin addEventListener: el variant observer MutationObserver lo cubre */ }
  }

  // Ciclo 1620: PerformanceObserver para detectar llamadas a APIs de precio.
  // Muchas PDPs modernas (VTEX Faststore v3, Shopify headless, WooCommerce AJAX)
  // cargan el precio vía fetch/XHR después del DOMContentLoaded. El MutationObserver
  // captura el cambio DOM resultante, pero en retailers con skeleton loaders o
  // hidratación diferida el texto del precio se reemplaza in-place (characterData)
  // sin generar mutaciones childList/attributes que watched en el observer de montaje.
  // Con PerformanceObserver detectamos cuando la llamada API completó y agendamos
  // un tryMount inmediato, sin esperar al próximo debounce del MutationObserver.
  function startPerfApiWatch(siteKey, myToken) {
    if (typeof PerformanceObserver !== 'function') return;
    const PRICE_API_FRAGS = [
      '/_v/api/', '/api/io/', '/_v/public/',   // VTEX IO / Faststore
      '/products.json', '/cart.js',             // Shopify product/cart
      '?wc-ajax=', '/wp-json/wc/',              // WooCommerce AJAX
      '/rest/v1/products', '/rest/v2/',         // Magento 2 REST
      '/api/price', '/api/product', '/graphql', // Genérico + GraphQL headless
      // Ciclo 1623: patrones adicionales para retailers nuevos.
      '/api/prices', '/api/catalog/price',      // SAP Commerce (Ripley, Ribeiro), farmacity custom
      '/api/pdp', '/pdp/pricing',               // SAP Hybris PDP pricing endpoints
      '/pages/product.json',                    // Shopify legacy product page data
      '/api/fulfillment', '/api/availability',  // Garmin / retailers con stock+precio combinado
    ];
    let schedTimer = null;
    try {
      const obs = new PerformanceObserver((list) => {
        if (myToken !== runToken || mounted) { obs.disconnect(); return; }
        for (const entry of list.getEntries()) {
          const url = (entry.name || '').toLowerCase();
          for (let i = 0; i < PRICE_API_FRAGS.length; i++) {
            if (url.includes(PRICE_API_FRAGS[i])) {
              if (!schedTimer) {
                schedTimer = setTimeout(() => {
                  schedTimer = null;
                  if (myToken !== runToken || mounted) return;
                  tryMount(siteKey, myToken).then((didMount) => {
                    if (!didMount) return;
                    obs.disconnect();
                    startVariantObserver(siteKey, myToken);
                    startEventBasedVariantDetection(siteKey, myToken);
                    startBadgeHealthWatch(siteKey, myToken);
                  }).catch(() => {});
                }, 250);
              }
              break;
            }
          }
        }
      });
      obs.observe({ type: 'resource', buffered: false });
    } catch (_) {}
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
    // Anotar el retailer en el root para CSS retailer-específico y debugging.
    // Se hace aquí (antes de montar el badge) para que esté disponible en cuanto
    // el root se crea en mountBadge.
    try {
      let root = document.getElementById('precio-real-badge-root');
      if (!root && document.body) {
        root = document.createElement('div');
        root.id = 'precio-real-badge-root';
        document.body.appendChild(root);
      }
      if (root) {
        root.setAttribute('data-site', siteKey);
        // aria-live para que lectores de pantalla anuncien el badge cuando aparece.
        if (!root.getAttribute('aria-live')) root.setAttribute('aria-live', 'polite');
        if (!root.getAttribute('aria-atomic')) root.setAttribute('aria-atomic', 'true');
      }
    } catch (_) { /* ignore: mountBadge lo creará igual */ }
    log.debug(siteKey, 'run start', location.href);

    for (const d of INITIAL_DELAYS_MS) {
      if (myToken !== runToken) return;
      if (d) await new Promise((r) => setTimeout(r, d));
      // Re-verificar que seguimos en el mismo sitio tras el delay (SPA edge-case).
      if (PR.detectSite(location.hostname) !== siteKey) {
        log.debug(siteKey, 'site changed mid-retry, abort');
        return;
      }
      try {
        if (await tryMount(siteKey, myToken)) {
          startVariantObserver(siteKey, myToken);
          startEventBasedVariantDetection(siteKey, myToken);
          startBadgeHealthWatch(siteKey, myToken);
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
          startEventBasedVariantDetection(siteKey, myToken);
          startBadgeHealthWatch(siteKey, myToken);
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
      // Incluimos atributos de precio/variante para capturar retailers (VTEX, Magento 2,
      // Next.js) que renderizan el precio inicial vía data-* sin añadir nodos al DOM.
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            'data-price', 'data-price-amount', 'data-internet-price', 'data-cmr-price',
            'data-event-price', 'data-value', 'data-sku', 'data-product-id',
            'data-variant-id', 'data-pricetype', 'data-price-type', 'aria-busy',
            // Ciclo 1601: Next.js App Router señaliza transiciones con data-pending;
            // VTEX Faststore usa data-fs-sku; data-loading marca carga de variante.
            'data-pending', 'data-fs-sku', 'data-loading',
            // Ciclo 1605: data-fs-product-id (VTEX Faststore PDPs, ej. Garbarino nuevo)
            // estaba en el variant observer pero no en el observer de montaje inicial.
            'data-fs-product-id',
            // Ciclo 1606: data-fs-variant-id (VTEX Faststore v2+, Carrefour/Changomás);
            // data-product-variant-id (Shopify custom: Coolbox AR, Full AR);
            // data-selected-variant (Shopify Dawn/Debut themes).
            'data-fs-variant-id', 'data-product-variant-id', 'data-selected-variant',
            // Ciclo 1607: data-price-value (Shopify centavos: Dexter AR, otros themes Shopify
            // custom que exponen el precio como integer en centavos en el elemento de variante);
            // data-fs-price-value (VTEX Faststore v2+ precio en el contenedor de precio).
            'data-price-value', 'data-fs-price-value',
            // Ciclo 1614: VTEX Faststore v3 selectors para Carrefour AR, Changomás y
            // Garbarino migrados al nuevo stack. Cubren el caso de montaje inicial
            // donde el precio no está en el DOM al cargar pero aparece al hidratarse.
            'data-fs-selling-price', 'data-fs-offer-price',
            // Ciclo 1615: data-fs-delivery-price (VTEX Faststore v3+ envío incluido),
            // data-wc-variation-id (WooCommerce Blocks 11+ Gutenberg en WooCommerce
            // modernos como Powerplanet AR, Megastore AR).
            'data-fs-delivery-price', 'data-wc-variation-id',
            // Ciclo 1616: data-sku-id (Shopify Markets 2025), data-product-form-id
            // (Shopify custom multi-section), data-selected-sku (CompraGamer engine),
            // data-bundle-id (gaming bundles: klibr, lazer, pcarg).
            'data-sku-id', 'data-product-form-id', 'data-selected-sku', 'data-bundle-id',
            // Ciclo 1618: data-variant (Shopify minimal), data-option-index (picker
            // multi-opción Shopify custom), data-selected-option (WooCommerce AJAX).
            'data-variant', 'data-option-index', 'data-selected-option',
            // Ciclo 1622: precio de oferta/venta/lista expuesto como data-* en el
            // elemento del swatch o en el contenedor de precio. Mismos atributos que
            // el variant observer para consistencia de cobertura en carga inicial.
            'data-final-price', 'data-sale-price', 'data-offer-price', 'data-list-price',
          ],
        });
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
    // Ciclo 1620: arrancar en paralelo al MutationObserver para capturar retailers
    // que cargan precio vía API (VTEX Faststore v3 GraphQL, Shopify AJAX, WooCommerce REST).
    startPerfApiWatch(siteKey, myToken);
  }

  function maybeRunOnLocationChange() {
    let newUrl = null;
    try { newUrl = PR.canonicalUrl(location.href); } catch (_) { return; }
    if (newUrl !== lastUrl) {
      // URL cambió → resetear estado de "cerrado manualmente" y re-correr.
      // Ciclo 1602: también reseteamos si el productKey cambió (variante
      // diferente con misma URL canónica pero query param distinto, como
      // ML ?variation=... que canonicalUrl descarta pero es un producto distinto).
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
    // Ciclo 1619: también re-chequear badge health al volver a foco. Algunos SPAs
    // (VTEX IO, Next.js App Router) actualizan el virtual DOM mientras el tab está
    // en background, borrando el badge root sin disparar el variant observer ni el
    // bodySwapObs (porque Chrome suspende/throttlea MutationObservers en tabs ocultos).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      maybeRunOnLocationChange();
      // Re-verificar badge incluso cuando la URL no cambió.
      if (mounted) {
        const root = document.getElementById('precio-real-badge-root');
        if (!root || !badgeIsInDOM(root)) {
          mounted = false;
          const sk = PR.detectSite && PR.detectSite(location.hostname);
          if (sk) {
            tryMount(sk, runToken).then((didMount) => {
              if (didMount) schedulePostMountCheck(sk);
            }).catch(() => {});
          }
        }
      }
    });
    // Ciclo 12: poll de URL como red de seguridad final. Algunos SPAs (sobre
    // todo Next.js con app-router custom) reasignan history.pushState DESPUÉS
    // del content script (antes de que nuestro wrap exista en su closure), o
    // navegan vía Symbol/Proxy que evade nuestro wrapper. Un poll cada 1500ms
    // los primeros 60s + cada 5s después es barato (un querySelector + string
    // compare por tick) y rescata esos casos. Si vemos cambio, disparamos el
    // mismo evento que dispara hookHistory.
    let pollTicks = 0;
    let lastPolledHref = location.href;
    const pollOnce = () => {
      try {
        if (location.href !== lastPolledHref) {
          lastPolledHref = location.href;
          window.dispatchEvent(new Event('precio-real:locationchange'));
        }
      } catch (_) { /* ignore */ }
      pollTicks++;
      // Slow down después de 60s (40 ticks a 1500ms ≈ 60s).
      const delay = pollTicks < 40 ? 1500 : 5000;
      setTimeout(pollOnce, delay);
    };
    setTimeout(pollOnce, 1500);
  }
  hookHistory();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // Test-only export: expone classifyFromStats para el harness de tests.
  // Solo activo cuando la página inyecta window.__precioRealTest = true antes
  // de cargar content.js. En producción esta rama nunca se toca.
  if (window.__precioRealTest && window.PrecioReal) {
    window.PrecioReal._classifyFromStats = classifyFromStats;
  }
})();
