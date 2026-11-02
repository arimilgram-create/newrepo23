// Renders the Homeroom logo into the PNG sizes Chrome wants. Run once; the PNGs are committed.
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dir = new URL('../src/icons/', import.meta.url).pathname;
await mkdir(dir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#0b8043"/>
  <path d="M7 24V12.5L16 6l9 6.5V24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>
  <rect x="12.2" y="15" width="7.6" height="9" rx="1.2" fill="#fff"/>
  <circle cx="16" cy="11.4" r="1.6" fill="#fbbc04"/></svg>`;

const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml,${encodeURIComponent(svg)}" width="${size}" height="${size}">`);
  await page.screenshot({ path: `${dir}${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
console.log('Wrote icons to src/icons/');
