#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const API_BASE = "https://precio-real.firemandeveloper.com";
const DEFAULT_QUERIES = [
  "notebook",
  "celular",
  "smart tv",
  "auriculares bluetooth",
  "heladera",
  "lavarropas",
  "aire acondicionado",
  "monitor",
  "cafetera",
  "consola",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();

function parseArgs(argv) {
  const args = {
    limit: 30,
    screenshots: 5,
    waitMs: 25000,
    viewportWidth: 1365,
    viewportHeight: 900,
    headless: false,
    keepProfile: false,
    pauseOnCaptcha: false,
    captchaWaitMs: 180000,
    source: "search-page",
    queries: DEFAULT_QUERIES,
    urlsFile: null,
    outDir: null,
    chromeBin: process.env.CHROME_BIN || null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--limit") args.limit = Number(next());
    else if (arg === "--screenshots") args.screenshots = Number(next());
    else if (arg === "--wait-ms") args.waitMs = Number(next());
    else if (arg === "--viewport") {
      const [w, h] = next().split("x").map(Number);
      if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("Viewport must be WIDTHxHEIGHT");
      args.viewportWidth = w;
      args.viewportHeight = h;
    } else if (arg === "--headless") args.headless = true;
    else if (arg === "--headed") args.headless = false;
    else if (arg === "--keep-profile") args.keepProfile = true;
    else if (arg === "--pause-on-captcha") args.pauseOnCaptcha = true;
    else if (arg === "--captcha-wait-ms") args.captchaWaitMs = Number(next());
    else if (arg === "--source") args.source = next();
    else if (arg === "--queries") args.queries = next().split(",").map((q) => q.trim()).filter(Boolean);
    else if (arg === "--urls") args.urlsFile = next();
    else if (arg === "--out") args.outDir = next();
    else if (arg === "--chrome") args.chromeBin = next();
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error("--limit must be a positive integer");
  if (!Number.isInteger(args.screenshots) || args.screenshots < 0) {
    throw new Error("--screenshots must be a non-negative integer");
  }
  if (args.source !== "search-page" && args.source !== "file") {
    throw new Error("--source must be search-page or file");
  }
  if (args.source === "file" && !args.urlsFile) throw new Error("--source file requires --urls");
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/capture-ml-evidence.mjs [options]

Options:
  --limit N              Number of Mercado Libre PDPs to open (default: 30)
  --screenshots N        Capture page + badge screenshots for first N PDPs (default: 5)
  --source search-page   Discover live PDP URLs from Mercado Libre search pages (default)
  --source file --urls F Read PDP URLs from a newline-delimited file
  --queries a,b,c        Search queries for --source search-page
  --out DIR              Evidence directory outside git
  --headless             Run Chrome headless=new
  --headed               Run visible Chrome (default)
  --chrome PATH          Chrome executable path
  --wait-ms N            Per-PDP wait for extension badge/price (default: 25000)
  --viewport WxH         Browser viewport (default: 1365x900)
  --keep-profile         Keep temporary Chrome profile for debugging
  --pause-on-captcha     In headed mode, wait for manual CAPTCHA solve
  --captcha-wait-ms N    Extra wait for manual CAPTCHA solve (default: 180000)
`);
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function defaultOutDir(root) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return path.resolve(root, "..", "portfolio-os-2-real-evidence-artifacts", stamp);
}

function findChrome(explicit) {
  const candidates = [
    explicit,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("Chrome/Chromium not found. Pass --chrome /path/to/browser or set CHROME_BIN.");
  }
  return found;
}

async function waitForDevToolsPort(profileDir, timeoutMs = 15000) {
  const activePort = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const text = await readFile(activePort, "utf8");
      const [port] = text.trim().split(/\s+/);
      if (port) return Number(port);
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Timed out waiting for Chrome DevToolsActivePort in ${profileDir}`);
}

async function fetchJson(url, init) {
  const capturedAt = nowIso();
  const response = await fetch(url, {
    ...init,
    headers: {
      "accept": "application/json",
      "user-agent": "PrecioRealEvidence/1.0",
      ...(init && init.headers ? init.headers : {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return {
    captured_at: capturedAt,
    url,
    status: response.status,
    ok: response.ok,
    body,
  };
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Chrome CDP")), 10000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.ws.addEventListener("error", (event) => {
        clearTimeout(timer);
        reject(new Error(`CDP WebSocket error: ${event.message || "unknown"}`));
      }, { once: true });
    });

    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message || "CDP error"} (${msg.error.code || "no code"})`));
        else resolve(msg.result || {});
        return;
      }
      if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) fn(msg.params || {});
      }
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(fn);
    return () => this.listeners.get(method).delete(fn);
  }

  call(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  waitFor(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const off = this.on(method, (params) => {
        clearTimeout(timer);
        off();
        resolve(params);
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // ignore close errors
    }
  }
}

async function launchChrome({ chromeBin, extensionDir, profileDir, headless, viewportWidth, viewportHeight }) {
  await mkdir(profileDir, { recursive: true });
  const args = [
    `--user-data-dir=${profileDir}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    `--window-size=${viewportWidth},${viewportHeight}`,
    "--lang=es-AR",
    "about:blank",
  ];
  if (headless) {
    args.unshift("--headless=new", "--disable-gpu");
  }

  const child = spawn(chromeBin, args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.setEncoding("utf8");
  child.stdout.setEncoding("utf8");
  const logs = [];
  const keepLog = (chunk) => {
    logs.push(chunk);
    if (logs.length > 50) logs.shift();
  };
  child.stderr.on("data", keepLog);
  child.stdout.on("data", keepLog);

  const port = await waitForDevToolsPort(profileDir);
  const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);

  return {
    child,
    port,
    version,
    logs,
    async close() {
      child.kill("SIGTERM");
      await sleep(1000);
      if (!child.killed) child.kill("SIGKILL");
    },
  };
}

async function createPage(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) throw new Error(`Unable to create Chrome tab: ${response.status}`);
  const target = await response.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.call("Page.enable");
  await client.call("Runtime.enable");
  await client.call("Network.enable");
  await client.call("Network.setCacheDisabled", { cacheDisabled: true });
  return client;
}

async function navigate(client, url, timeoutMs = 45000) {
  const load = client.waitFor("Page.loadEventFired", timeoutMs).catch(() => null);
  await client.call("Page.navigate", { url });
  await load;
}

async function evaluate(client, expression, timeout = 10000) {
  const result = await client.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout,
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.text || "Runtime evaluation failed";
    throw new Error(text);
  }
  return result.result ? result.result.value : null;
}

function normalizeMlUrl(raw) {
  try {
    const u = new URL(raw);
    if (!u.hostname.endsWith("mercadolibre.com.ar")) return null;
    if (u.pathname.includes("/jm/") || u.pathname.includes("/gz/")) return null;
    u.hash = "";
    const keep = new URLSearchParams();
    const variation = u.searchParams.get("variation");
    if (variation) keep.set("variation", variation);
    u.search = keep.toString();
    return u.toString();
  } catch {
    return null;
  }
}

async function readUrlsFromFile(file, limit) {
  const text = await readFile(file, "utf8");
  const urls = [];
  const seen = new Set();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = normalizeMlUrl(trimmed);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
    if (urls.length >= limit) break;
  }
  return urls;
}

async function discoverFromSearchPages(client, queries, limit, outDir) {
  const all = [];
  const seen = new Set();
  const records = [];

  for (const query of queries) {
    if (all.length >= limit) break;
    const listingUrl = `https://listado.mercadolibre.com.ar/${encodeURIComponent(query).replace(/%20/g, "-")}`;
    const startedAt = nowIso();
    let error = null;
    let page = null;
    let links = [];
    try {
      await navigate(client, listingUrl, 45000);
      await sleep(5000);
      page = await evaluate(client, `(() => {
        const hrefs = Array.from(document.querySelectorAll('a[href]')).map((a) => a.href);
        const productLinks = Array.from(new Set(hrefs.filter((href) => {
          try {
            const u = new URL(href);
            if (!u.hostname.endsWith('mercadolibre.com.ar')) return false;
            return /\\/p\\/MLA\\d+/i.test(u.pathname) || /\\/MLA-?\\d+/i.test(u.pathname);
          } catch (_) {
            return false;
          }
        })));
        return {
          href: location.href,
          title: document.title,
          anchor_count: hrefs.length,
          body_text_sample: document.body ? document.body.innerText.slice(0, 500) : "",
          links: productLinks
        };
      })()`);
      links = page.links || [];
    } catch (err) {
      error = err.message || String(err);
    }

    const accepted = [];
    for (const link of links || []) {
      const normalized = normalizeMlUrl(link);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      accepted.push(normalized);
      all.push(normalized);
      if (all.length >= limit) break;
    }
    records.push({
      query,
      listing_url: listingUrl,
      started_at: startedAt,
      finished_at: nowIso(),
      error,
      page,
      found: links.length,
      accepted,
    });
  }

  await writeFile(
    path.join(outDir, "source-search-pages.json"),
    JSON.stringify({ captured_at: nowIso(), limit, count: all.length, records }, null, 2),
  );
  return all;
}

async function pageState(client) {
  return evaluate(client, `(() => {
    const pr = window.PrecioReal || null;
    let site = null;
    let price = null;
    let canonical = location.href;
    let priceError = null;
    try { site = pr && pr.detectSite ? pr.detectSite(location.hostname) : null; } catch (e) { site = null; }
    try { canonical = pr && pr.canonicalUrl ? pr.canonicalUrl(location.href) : location.href.split('#')[0].split('?')[0]; } catch (_) {}
    try { price = pr && pr.extractPrice ? pr.extractPrice(site) : null; } catch (e) { priceError = e.message || String(e); }
    const root = document.getElementById('precio-real-badge-root');
    const badge = root ? ((root.shadowRoot && root.shadowRoot.querySelector('.precio-real-badge')) || root.querySelector('.precio-real-badge')) : null;
    const rootRect = root ? root.getBoundingClientRect() : null;
    const badgeRect = badge ? badge.getBoundingClientRect() : rootRect;
    return {
      captured_at: new Date().toISOString(),
      href: location.href,
      canonical,
      title: document.title,
      extension_loaded: !!pr,
      site,
      observed_price: price,
      price_error: priceError,
      badge: badge ? {
        text: badge.innerText,
        class_name: badge.className,
        version: badge.getAttribute('data-pr-version') || null,
        title: badge.getAttribute('title') || null
      } : null,
      rect: badgeRect ? {
        x: badgeRect.x,
        y: badgeRect.y,
        width: badgeRect.width,
        height: badgeRect.height
      } : null,
      blocked_by_captcha: /\\/captcha\\//i.test(location.pathname) || /captcha|seguridad|security/i.test(document.title || ""),
      body_text_sample: document.body ? document.body.innerText.slice(0, 500) : ""
    };
  })()`);
}

async function waitForEvidenceState(client, waitMs, { pauseOnCaptcha = false, captchaWaitMs = 0 } = {}) {
  let deadline = Date.now() + waitMs;
  let captchaNoticePrinted = false;
  let state = null;
  while (Date.now() < deadline) {
    state = await pageState(client);
    if (state.extension_loaded && state.site === "mercadolibre" && (state.badge || state.observed_price)) {
      return state;
    }
    if (state.blocked_by_captcha && pauseOnCaptcha) {
      if (!captchaNoticePrinted) {
        captchaNoticePrinted = true;
        deadline = Math.max(deadline, Date.now() + captchaWaitMs);
        console.error(`Mercado Libre CAPTCHA detected. Solve it in the Chrome window; waiting up to ${captchaWaitMs}ms.`);
      }
    }
    await sleep(1000);
  }
  return state || await pageState(client);
}

async function captureScreenshot(client, file, clip = null) {
  const params = { format: "png", fromSurface: true };
  if (clip) params.clip = clip;
  else params.captureBeyondViewport = false;
  const result = await client.call("Page.captureScreenshot", params);
  await writeFile(file, Buffer.from(result.data, "base64"));
}

function clipFromRect(rect, viewportWidth, viewportHeight) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const pad = 8;
  const x = Math.max(0, Math.floor(rect.x - pad));
  const y = Math.max(0, Math.floor(rect.y - pad));
  const width = Math.min(viewportWidth - x, Math.ceil(rect.width + pad * 2));
  const height = Math.min(viewportHeight - y, Math.ceil(rect.height + pad * 2));
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height, scale: 1 };
}

function interestingNetworkRecorder(client) {
  let enabled = true;
  const requests = new Map();
  const events = [];
  const offRequest = client.on("Network.requestWillBeSent", (params) => {
    if (!enabled) return;
    const url = params.request && params.request.url;
    if (!url || !url.includes(API_BASE)) return;
    requests.set(params.requestId, {
      request_id: params.requestId,
      url,
      method: params.request.method,
      requested_at_cdp: params.timestamp,
      wall_time: params.wallTime || null,
    });
  });
  const offResponse = client.on("Network.responseReceived", (params) => {
    if (!enabled || !requests.has(params.requestId)) return;
    const prev = requests.get(params.requestId);
    const event = {
      ...prev,
      response_received_at: nowIso(),
      status: params.response.status,
      mime_type: params.response.mimeType,
    };
    events.push(event);
    requests.set(params.requestId, event);
  });

  return {
    reset() {
      events.length = 0;
      requests.clear();
    },
    events() {
      return events.slice();
    },
    close() {
      enabled = false;
      offRequest();
      offResponse();
    },
  };
}

async function writeApiSnapshots(outDir) {
  const apiDir = path.join(outDir, "api");
  await mkdir(apiDir, { recursive: true });
  const health = await fetchJson(`${API_BASE}/api/health`);
  const stats = await fetchJson(`${API_BASE}/api/stats`);
  await writeFile(path.join(apiDir, "health.json"), JSON.stringify(health, null, 2));
  await writeFile(path.join(apiDir, "stats.json"), JSON.stringify(stats, null, 2));
  return { health, stats };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const extensionDir = path.join(root, "extension");
  const outDir = path.resolve(args.outDir || process.env.PRECIO_REAL_EVIDENCE_DIR || defaultOutDir(root));
  const screenshotsDir = path.join(outDir, "screenshots");
  const apiDir = path.join(outDir, "api");
  const profileDir = path.join(outDir, "chrome-profile");
  const chromeBin = findChrome(args.chromeBin);

  await mkdir(outDir, { recursive: true });
  await mkdir(screenshotsDir, { recursive: true });
  await mkdir(apiDir, { recursive: true });

  const run = {
    started_at: nowIso(),
    repo_root: root,
    out_dir: outDir,
    chrome_bin: chromeBin,
    extension_dir: extensionDir,
    args,
    api: null,
    browser: null,
    urls: [],
    summary: null,
  };

  await writeFile(path.join(outDir, "run-start.json"), JSON.stringify(run, null, 2));
  run.api = await writeApiSnapshots(outDir);

  let chrome = null;
  let client = null;
  const jsonlPath = path.join(outDir, "observations.jsonl");
  const jsonl = [];

  try {
    chrome = await launchChrome({
      chromeBin,
      extensionDir,
      profileDir,
      headless: args.headless,
      viewportWidth: args.viewportWidth,
      viewportHeight: args.viewportHeight,
    });
    run.browser = chrome.version.body;

    client = await createPage(chrome.port);
    await client.call("Emulation.setDeviceMetricsOverride", {
      width: args.viewportWidth,
      height: args.viewportHeight,
      deviceScaleFactor: 1,
      mobile: false,
    });

    let urls;
    if (args.source === "file") {
      urls = await readUrlsFromFile(args.urlsFile, args.limit);
    } else {
      urls = await discoverFromSearchPages(client, args.queries, args.limit, outDir);
    }
    run.urls = urls;
    await writeFile(path.join(outDir, "urls.txt"), `${urls.join("\n")}\n`);

    const network = interestingNetworkRecorder(client);
    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index];
      const ordinal = String(index + 1).padStart(2, "0");
      network.reset();
      const openedAt = nowIso();
      let state = null;
      let apiPrice = null;
      let error = null;
      let pageScreenshot = null;
      let badgeScreenshot = null;

      try {
        await navigate(client, url, 45000);
        state = await waitForEvidenceState(client, args.waitMs, {
          pauseOnCaptcha: args.pauseOnCaptcha,
          captchaWaitMs: args.captchaWaitMs,
        });
        if (index < args.screenshots) {
          pageScreenshot = `screenshots/page-${ordinal}.png`;
          await captureScreenshot(client, path.join(outDir, pageScreenshot));
          const clip = clipFromRect(state && state.rect, args.viewportWidth, args.viewportHeight);
          if (clip) {
            badgeScreenshot = `screenshots/badge-${ordinal}.png`;
            await captureScreenshot(client, path.join(outDir, badgeScreenshot), clip);
          }
        }

        const apiTarget = encodeURIComponent((state && state.canonical) || url);
        apiPrice = await fetchJson(`${API_BASE}/api/price?url=${apiTarget}`);
        await writeFile(path.join(apiDir, `price-${ordinal}.json`), JSON.stringify(apiPrice, null, 2));
      } catch (err) {
        error = err.message || String(err);
      }

      const record = {
        index: index + 1,
        opened_at: openedAt,
        finished_at: nowIso(),
        source_url: url,
        final_url: state ? state.href : null,
        canonical_url: state ? state.canonical : null,
        title: state ? state.title : null,
        extension_loaded: !!(state && state.extension_loaded),
        site: state ? state.site : null,
        observed_price: state ? state.observed_price : null,
        badge: state ? state.badge : null,
        blocked_by_captcha: !!(state && state.blocked_by_captcha),
        network_events: network.events(),
        api_price_status: apiPrice ? apiPrice.status : null,
        api_price_captured_at: apiPrice ? apiPrice.captured_at : null,
        api_last_scraped_at: apiPrice && apiPrice.body ? apiPrice.body.last_scraped_at ?? null : null,
        page_screenshot: pageScreenshot,
        badge_screenshot: badgeScreenshot,
        error,
      };
      jsonl.push(JSON.stringify(record));
      await writeFile(jsonlPath, `${jsonl.join("\n")}\n`);
      console.log(JSON.stringify({
        index: record.index,
        blocked_by_captcha: record.blocked_by_captcha,
        observed_price: record.observed_price,
        badge: record.badge ? record.badge.text : null,
        observe_posts: record.network_events.filter((event) => event.url.includes("/api/observe")).length,
        api_price_status: record.api_price_status,
        error: record.error,
      }));
    }
    network.close();

    const records = jsonl.map((line) => JSON.parse(line));
    run.summary = {
      finished_at: nowIso(),
      attempted: records.length,
      extension_loaded: records.filter((r) => r.extension_loaded).length,
      observed_price: records.filter((r) => typeof r.observed_price === "number").length,
      badge_present: records.filter((r) => !!r.badge).length,
      observe_post_seen: records.filter((r) => r.network_events.some((event) => event.url.includes("/api/observe"))).length,
      observe_post_ok: records.filter((r) => r.network_events.some((event) => event.url.includes("/api/observe") && event.status >= 200 && event.status < 300)).length,
      api_price_ok: records.filter((r) => r.api_price_status === 200).length,
      page_screenshots: records.filter((r) => !!r.page_screenshot).length,
      badge_screenshots: records.filter((r) => !!r.badge_screenshot).length,
      blocked_by_captcha: records.filter((r) => !!r.blocked_by_captcha).length,
      errors: records.filter((r) => !!r.error).length,
    };
    await writeFile(path.join(outDir, "summary.json"), JSON.stringify(run, null, 2));
  } finally {
    if (client) client.close();
    if (chrome) await chrome.close();
    if (!args.keepProfile) {
      await rm(profileDir, { recursive: true, force: true });
    }
  }

  console.log(`Evidence directory: ${outDir}`);
  if (run.summary) console.log(JSON.stringify(run.summary, null, 2));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
