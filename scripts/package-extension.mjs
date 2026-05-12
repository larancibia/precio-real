#!/usr/bin/env node
// Empaqueta la extensión para Chrome, Firefox y Edge.
//
// Uso:
//   node scripts/package-extension.mjs [chrome|firefox|edge|all]
//
// Salida:
//   dist/precio-real-chrome-x.y.z.zip   → Chrome Web Store
//   dist/precio-real-firefox-x.y.z.zip  → Firefox Add-ons (AMO)
//   dist/precio-real-edge-x.y.z.zip     → Microsoft Edge Add-ons
//
// Firefox: usa manifest.firefox.json renombrado a manifest.json dentro del zip.
// Edge:    mismo contenido que Chrome (Chromium-based, misma API surface).

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'extension');
const DIST = path.join(ROOT, 'dist');

const target = process.argv[2] || 'all';

const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const VERSION = manifest.version;

const EXTENSION_FILES = [
  'config.js',
  'manifest.json',
  'background/background.js',
  'content/content.js',
  'content/badge.css',
  'utils/helpers.js',
  'utils/retailers.js',
  'utils/affiliates.js',
  'popup/popup.js',
  'popup/popup.html',
  'popup/popup.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

function ensureDist() {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
}

function buildTmp(browser) {
  const tmpDir = path.join(DIST, `_tmp_${browser}`);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const f of EXTENSION_FILES) {
    if (f === 'manifest.json' && browser === 'firefox') continue;
    const src = path.join(EXT, f);
    const dest = path.join(tmpDir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  if (browser === 'firefox') {
    fs.copyFileSync(
      path.join(EXT, 'manifest.firefox.json'),
      path.join(tmpDir, 'manifest.json')
    );
  }

  return tmpDir;
}

function zipDir(srcDir, outZip) {
  if (fs.existsSync(outZip)) fs.rmSync(outZip);
  // zip -r from inside the dir so paths inside the zip are relative
  execSync(`cd "${srcDir}" && zip -r "${outZip}" .`, { stdio: 'inherit' });
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true });
}

function build(browser) {
  console.log(`\n→ Building ${browser} package...`);
  ensureDist();
  const tmpDir = buildTmp(browser);
  const outZip = path.join(DIST, `precio-real-${browser}-${VERSION}.zip`);
  zipDir(tmpDir, outZip);
  cleanup(tmpDir);
  const size = Math.round(fs.statSync(outZip).size / 1024);
  console.log(`  ✓ ${path.relative(ROOT, outZip)} (${size} KB)`);
}

const browsers = target === 'all' ? ['chrome', 'firefox', 'edge'] : [target];

for (const b of browsers) {
  if (!['chrome', 'firefox', 'edge'].includes(b)) {
    console.error(`Unknown browser: ${b}. Use chrome, firefox, edge, or all.`);
    process.exit(1);
  }
  build(b);
}

console.log('\nDone.');
