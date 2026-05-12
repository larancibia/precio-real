// Helpers replicados acá: el popup es contexto separado del content script.
// Usar el config compartido (config.js cargado antes en popup.html).
const BACKEND = (typeof window !== 'undefined' && window.PrecioRealConfig && window.PrecioRealConfig.API_BASE) || 'https://precio-real.firemandeveloper.com';

const SITE_LABELS = {
  mercadolibre: 'Mercado Libre',
  fravega: 'Frávega',
  garbarino: 'Garbarino',
  falabella: 'Falabella',
  carrefour: 'Carrefour',
  coto: 'Coto',
  naldo: 'Naldo',
  musimundo: 'Musimundo',
  cetrogar: 'Cetrogar',
  megatone: 'Megatone',
  dia: 'Día',
  jumbo: 'Jumbo',
  disco: 'Disco',
  sodimac: 'Sodimac',
  easy: 'Easy',
  hendel: 'Hendel',
  rodo: 'Rodo'
};

function detectSite(hostname) {
  if (!hostname) return null;
  const h = hostname.toLowerCase();
  if (h.endsWith('mercadolibre.com.ar')) return 'mercadolibre';
  if (h.endsWith('fravega.com')) return 'fravega';
  if (h.endsWith('garbarino.com')) return 'garbarino';
  if (h.endsWith('falabella.com.ar')) return 'falabella';
  if (h.endsWith('carrefour.com.ar')) return 'carrefour';
  if (h.endsWith('cotodigital3.com.ar')) return 'coto';
  if (h.endsWith('naldo.com.ar')) return 'naldo';
  if (h.endsWith('musimundo.com')) return 'musimundo';
  if (h.endsWith('cetrogar.com.ar')) return 'cetrogar';
  if (h.endsWith('megatone.net')) return 'megatone';
  if (h.endsWith('diaonline.supermercadosdia.com.ar')) return 'dia';
  if (h.endsWith('jumbo.com.ar')) return 'jumbo';
  if (h.endsWith('disco.com.ar')) return 'disco';
  if (h.endsWith('sodimac.com.ar')) return 'sodimac';
  if (h.endsWith('easy.com.ar')) return 'easy';
  if (h.endsWith('hendel.com.ar')) return 'hendel';
  if (h.endsWith('rodo.com.ar')) return 'rodo';
  return null;
}

function canonicalUrl(href) {
  try {
    const u = new URL(href);
    return u.protocol + '//' + u.host.toLowerCase() + u.pathname;
  } catch {
    return href;
  }
}

function classifyPrice(current, history) {
  const DAY = 86400;
  const now = Math.floor(Date.now() / 1000);
  if (!current || !Array.isArray(history) || history.length < 5) return { kind: 'unknown', pct: 0, label: 'Sin datos históricos', sub: '' };
  const last7 = history.filter(h => now - h.scraped_at <= 7 * DAY).map(h => h.price);
  const prev23 = history.filter(h => { const age = now - h.scraped_at; return age > 7 * DAY && age <= 30 * DAY; }).map(h => h.price);
  if (prev23.length === 0) return { kind: 'unknown', pct: 0, label: 'Sin baseline', sub: '' };
  const sorted = [...prev23].sort((a, b) => a - b);
  const baseline = sorted[Math.floor(sorted.length / 2)];
  const max7 = last7.length ? Math.max(...last7) : current;
  if (max7 >= baseline * 1.10 && current >= baseline * 0.95) {
    const pct = Math.round(((max7 - baseline) / baseline) * 100);
    return { kind: 'inflated', pct, label: '✗ INFLADO', sub: `Subió ${pct}% la semana pasada` };
  }
  if (current <= baseline * 0.95) {
    const pct = Math.round(((baseline - current) / baseline) * 100);
    return { kind: 'real', pct, label: '✓ DESCUENTO REAL', sub: `-${pct}% vs. histórico` };
  }
  return { kind: 'neutral', pct: 0, label: 'Sin descuento', sub: 'Precio estable' };
}

function drawChart(canvas, points) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const padX = 28, padY = 18;
  ctx.clearRect(0, 0, w, h);
  if (points.length < 2) {
    ctx.fillStyle = '#888'; ctx.font = '12px system-ui';
    ctx.fillText('Datos insuficientes', padX, h / 2);
    return;
  }
  const ts = points.map(p => p.scraped_at);
  const ps = points.map(p => p.price);
  const tMin = Math.min(...ts), tMax = Math.max(...ts);
  const pMin = Math.min(...ps), pMax = Math.max(...ps);
  const xRange = w - padX * 2, yRange = h - padY * 2;
  const x = t => padX + ((t - tMin) / (tMax - tMin || 1)) * xRange;
  const y = p => h - padY - ((p - pMin) / (pMax - pMin || 1)) * yRange;
  // axes
  ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padX, h - padY); ctx.lineTo(w - padX, h - padY); ctx.stroke();
  // line
  ctx.strokeStyle = '#2bb673'; ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const xx = x(p.scraped_at), yy = y(p.price);
    if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  });
  ctx.stroke();
  // last dot
  const last = points[points.length - 1];
  ctx.fillStyle = '#2bb673';
  ctx.beginPath(); ctx.arc(x(last.scraped_at), y(last.price), 3, 0, Math.PI * 2); ctx.fill();
  // labels
  ctx.fillStyle = '#9ca3af'; ctx.font = '10px system-ui';
  const fmtDate = t => { const d = new Date(t * 1000); return `${d.getDate()}/${d.getMonth() + 1}`; };
  ctx.textAlign = 'left';
  ctx.fillText(fmtDate(tMin), padX, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText(fmtDate(tMax), w - padX, h - 4);
  ctx.textAlign = 'left';
  ctx.fillText('$' + Math.round(pMax).toLocaleString('es-AR'), 2, padY);
  ctx.fillText('$' + Math.round(pMin).toLocaleString('es-AR'), 2, h - padY);
}

function setVerdict(el, verdict) {
  el.classList.remove('pr-verdict--inflated', 'pr-verdict--real', 'pr-verdict--neutral');
  const kind = verdict.kind === 'unknown' ? 'neutral' : verdict.kind;
  el.classList.add('pr-verdict--' + kind);
  el.textContent = verdict.sub ? `${verdict.label} — ${verdict.sub}` : verdict.label;
}

document.addEventListener('DOMContentLoaded', () => {
  const siteEl = document.getElementById('pr-site');
  const productEl = document.getElementById('pr-product');
  const verdictEl = document.getElementById('pr-verdict');
  const chartEl = document.getElementById('pr-chart');
  const skeletonEl = document.getElementById('pr-skeleton');
  const rowSiteEl = document.getElementById('pr-row-site');
  const rowProductEl = document.getElementById('pr-row-product');
  const chartWrapEl = document.getElementById('pr-chart-wrap');

  function hideSkeleton() {
    skeletonEl.style.display = 'none';
  }

  function showContent() {
    hideSkeleton();
    rowSiteEl.style.display = '';
    rowProductEl.style.display = '';
    verdictEl.style.display = '';
    chartWrapEl.style.display = '';
  }

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.url) {
      hideSkeleton();
      siteEl.textContent = 'Sitio no soportado';
      rowSiteEl.style.display = '';
      return;
    }
    let hostname = '';
    try {
      hostname = new URL(tab.url).hostname;
    } catch (_) {}

    const site = detectSite(hostname);
    if (!site) {
      hideSkeleton();
      rowSiteEl.style.display = '';
      rowProductEl.style.display = '';
      verdictEl.style.display = '';
      siteEl.textContent = 'Sitio no soportado';
      productEl.textContent = '—';
      setVerdict(verdictEl, { kind: 'neutral', label: 'Sitio no soportado', sub: '' });
      return;
    }
    siteEl.textContent = SITE_LABELS[site] || site;
    productEl.textContent = tab.title || '—';

    try {
      const url = canonicalUrl(tab.url);
      const res = await fetch(BACKEND + '/api/price?url=' + encodeURIComponent(url), { cache: 'no-store' });
      if (res.status === 404) {
        showContent();
        setVerdict(verdictEl, { kind: 'neutral', label: 'Sin historial para este producto', sub: '' });
        return;
      }
      if (!res.ok) {
        console.warn('precio-real popup: backend error', res.status);
        showContent();
        setVerdict(verdictEl, { kind: 'neutral', label: 'Sin historial para este producto', sub: '' });
        return;
      }
      const data = await res.json();
      const history = Array.isArray(data?.history) ? data.history : [];
      // history sorted DESC by scraped_at; current = history[0].price
      const current = history[0]?.price;
      const verdict = classifyPrice(current, history);
      showContent();
      setVerdict(verdictEl, verdict);

      // Chart: last 30 days, ASC by time
      const now = Math.floor(Date.now() / 1000);
      const last30 = history.filter(p => now - p.scraped_at <= 30 * 86400).slice().reverse();
      drawChart(chartEl, last30);
    } catch (err) {
      console.warn('precio-real popup: fetch failed', err);
      showContent();
      setVerdict(verdictEl, { kind: 'neutral', label: 'Sin historial para este producto', sub: '' });
    }
  });
});
