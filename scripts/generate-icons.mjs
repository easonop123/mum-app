// Renders the original app mark (a small dot above a steady line — "a little")
// to PNG icons using the locally installed Chromium. No text is baked in.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => join(root, 'public', p);
mkdirSync(out('icons'), { recursive: true });

const JADE = '#1b6158';
const CREAM = '#faf7f2';

/** Rounded tile (favicon / "any" icons). */
function tile(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${JADE}"/>
  <circle cx="20.5" cy="11" r="3.2" fill="${CREAM}"/>
  <rect x="7" y="18.5" width="18" height="3.6" rx="1.8" fill="${CREAM}"/>
</svg>`;
}

/** Full-bleed square with the mark inside the maskable safe zone (also used for iOS). */
function fullBleed(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${JADE}"/>
  <g transform="translate(16 16) scale(0.72) translate(-16 -16)">
    <circle cx="20.5" cy="11" r="3.2" fill="${CREAM}"/>
    <rect x="7" y="18.5" width="18" height="3.6" rx="1.8" fill="${CREAM}"/>
  </g>
</svg>`;
}

writeFileSync(out('favicon.svg'), tile(32));

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(svg, size, file, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: out(file), omitBackground: transparent });
  console.log('wrote', file);
}
await render(tile(192), 192, 'icons/icon-192.png', true);
await render(tile(512), 512, 'icons/icon-512.png', true);
await render(fullBleed(512), 512, 'icons/icon-maskable-512.png', false);
await render(fullBleed(180), 180, 'apple-touch-icon.png', false);
await browser.close();
