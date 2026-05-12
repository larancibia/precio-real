#!/usr/bin/env node
// Tests de compatibilidad de manifiestos por browser.
// Verifica que Chrome, Firefox y Edge tengan manifiestos válidos y consistentes.
//
// Uso:
//   node extension/tests/manifest-compat.js
// Sale con código 0 si todo pasa, 1 si falla algún assert.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const EXT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
  }
}

function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

function loadManifest(filename) {
  const p = path.join(EXT, filename);
  assert(fs.existsSync(p), `manifest file exists: ${filename}`);
  if (!fs.existsSync(p)) return null;
  try {
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert(true, `${filename} is valid JSON`);
    return m;
  } catch (e) {
    failed++;
    failures.push(`${filename} is valid JSON\n  parse error: ${e.message}`);
    return null;
  }
}

// ── Load manifests ───────────────────────────────────────────────────────────
const chrome = loadManifest('manifest.json');
const firefox = loadManifest('manifest.firefox.json');

// ── Chrome / Edge manifest ───────────────────────────────────────────────────
if (chrome) {
  assertEq(chrome.manifest_version, 3, 'chrome: manifest_version is 3');
  assert(!!chrome.version, 'chrome: has version');
  assert(!!chrome.background?.service_worker, 'chrome: background.service_worker defined');
  assert(!chrome.browser_specific_settings, 'chrome: no browser_specific_settings (Edge uses same manifest)');
  assert(Array.isArray(chrome.host_permissions) && chrome.host_permissions.length > 0, 'chrome: has host_permissions');
  assert(Array.isArray(chrome.content_scripts) && chrome.content_scripts.length > 0, 'chrome: has content_scripts');
  assert(Array.isArray(chrome.content_scripts?.[0]?.js), 'chrome: content_scripts[0].js is array');
}

// ── Firefox manifest ─────────────────────────────────────────────────────────
if (firefox) {
  assertEq(firefox.manifest_version, 3, 'firefox: manifest_version is 3');
  assert(!!firefox.version, 'firefox: has version');
  assert(!!firefox.background?.service_worker, 'firefox: background.service_worker defined');

  // Firefox requires gecko id for AMO submission
  const gecko = firefox.browser_specific_settings?.gecko;
  assert(!!gecko, 'firefox: has browser_specific_settings.gecko');
  assert(typeof gecko?.id === 'string' && gecko.id.length > 0, 'firefox: gecko.id is non-empty string');
  assert(gecko?.id.includes('@') || gecko?.id.startsWith('{'), 'firefox: gecko.id is email-style or UUID-style');

  // strict_min_version >= 128.0 for MV3 service worker support
  assert(typeof gecko?.strict_min_version === 'string', 'firefox: gecko.strict_min_version is string');
  const minMajor = parseInt((gecko?.strict_min_version || '0').split('.')[0], 10);
  assert(minMajor >= 128, `firefox: gecko.strict_min_version major >= 128 (got ${gecko?.strict_min_version})`);

  // Consistency with Chrome manifest
  if (chrome) {
    assertEq(firefox.version, chrome.version, 'firefox: version matches chrome');
    assertEq(firefox.host_permissions, chrome.host_permissions, 'firefox: host_permissions match chrome');
    assertEq(firefox.content_scripts, chrome.content_scripts, 'firefox: content_scripts match chrome');
    assertEq(firefox.background?.service_worker, chrome.background?.service_worker, 'firefox: same background service_worker as chrome');
    assertEq(firefox.permissions, chrome.permissions, 'firefox: permissions match chrome');
    assertEq(firefox.icons, chrome.icons, 'firefox: icons match chrome');
  }
}

// ── Edge: same manifest as Chrome ────────────────────────────────────────────
// Edge is Chromium-based; it uses manifest.json unchanged.
assert(
  !fs.existsSync(path.join(EXT, 'manifest.edge.json')),
  'edge: no separate manifest needed (Chromium-based, uses manifest.json)'
);

// ── Chrome-only API check ────────────────────────────────────────────────────
// popup.js and background.js should use `api.*` (browser/chrome shim), not
// bare `chrome.*` calls. content.js doesn't use extension APIs so it's fine.
{
  const filesToCheck = ['popup/popup.js', 'background/background.js'];
  for (const file of filesToCheck) {
    const fp = path.join(EXT, file);
    if (!fs.existsSync(fp)) continue;
    const src = fs.readFileSync(fp, 'utf8');
    // Match bare `chrome.tabs`, `chrome.runtime`, etc. but not inside comments
    // or the shim declaration itself (which references `chrome` to build `api`).
    const lines = src.split('\n');
    let bareChromeCalls = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and the shim line that references chrome to build api.
      if (trimmed.startsWith('//')) continue;
      if (trimmed.includes('typeof browser') || trimmed.includes('? browser : chrome')) continue;
      // Check for bare chrome.tabs, chrome.runtime, chrome.storage etc.
      if (/\bchrome\.(tabs|runtime|storage|action|scripting)\b/.test(trimmed)) {
        bareChromeCalls++;
      }
    }
    assert(
      bareChromeCalls === 0,
      `${file}: no bare chrome.* API calls (found ${bareChromeCalls}, should use api.* shim)`
    );
  }
}

// ── Package script ────────────────────────────────────────────────────────────
assert(
  fs.existsSync(path.join(ROOT, 'scripts/package-extension.mjs')),
  'package-extension.mjs script exists'
);

// ── Resultado ────────────────────────────────────────────────────────────────
console.log(`[manifest-compat] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error('  - ' + f + '\n');
  process.exit(1);
}
process.exit(0);
