// Bookmark test: clicks the built bookmark on a mock Canvas page (whose own scripts are running)
// and checks Homeroom takes over the tab, quiets Canvas, and keeps working as you move around.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { ORIGIN, calls, route } from './mock-canvas.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const code = await readFile(new URL('../dist/homeroom.min.js', import.meta.url), 'utf8');
const bookmarklet = (await readFile(new URL('../dist/bookmarklet.txt', import.meta.url), 'utf8')).trim();

let passed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await ctx.addCookies([{ name: '_csrf_token', value: encodeURIComponent('tok+en/='), domain: 'school.instructure.com', path: '/', secure: true }]);
await ctx.route(`${ORIGIN}/**`, route);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));
const click = () => page.evaluate(code);

await check('the bookmark is a single valid javascript: URL', async () => {
  assert.ok(bookmarklet.startsWith('javascript:'));
  assert.doesNotMatch(bookmarklet, /[\n\r\t]/);
  // What the browser will run is the decoded URL; it must match the built script.
  assert.equal(decodeURIComponent(bookmarklet.slice('javascript:'.length)), code.trim());
});

await check('clicking it on a Canvas-only page opens that class in Homeroom', async () => {
  await page.goto(`${ORIGIN}/courses/1/quizzes/5`);
  await page.waitForFunction(() => window.ticks > 2);
  await click();
  await page.locator('.hero h1').waitFor();
  assert.equal(new URL(page.url()).pathname, '/courses/1');
  assert.equal(await page.locator('.hero h1').textContent(), 'AP Calculus BC');
  assert.equal(await page.title(), 'AP Calculus BC – Homeroom');
});

await check('Canvas’s own scripts are quieted', async () => {
  const t1 = await page.evaluate(() => window.ticks);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.ticks), t1, 'Canvas timers stopped');
  await page.locator('.tab', { hasText: 'Classwork' }).click();
  await page.locator('.topic-title').first().waitFor();
  assert.equal(await page.evaluate(() => window.canvasClicks), undefined, 'Canvas click handlers removed');
  await page.goBack({ waitUntil: 'commit' });
  await page.locator('.hero h1').waitFor();
  assert.equal(await page.evaluate(() => window.canvasPopstate), undefined, 'Canvas history handlers bypassed');
});

await check('moving around stays in the same tab without reloading', async () => {
  await page.evaluate(() => (window.__sameDoc = 1));
  await page.locator('[data-act=drawer]').click();
  await page.locator('.drawer .dr-item', { hasText: 'To-do' }).click();
  await page.locator('.todo-group').first().waitFor();
  await page.locator('[data-act=drawer]').click();
  await page.locator('.drawer .dr-item', { hasText: 'Calendar' }).click();
  await page.locator('.day').first().waitFor();
  await page.locator('[data-act=drawer]').click();
  await page.locator('.drawer .dr-item.class', { hasText: 'Honors Chemistry' }).click();
  await page.locator('.hero h1', { hasText: 'Honors Chemistry' }).waitFor();
  assert.equal(await page.evaluate(() => window.__sameDoc), 1);
});

await check('turning in work uses your Canvas login', async () => {
  await page.locator('.post-mini', { hasText: 'Lab report' }).click();
  await page.locator('.work-card').waitFor();
  await page.locator('[data-act=add-menu]').click();
  await page.locator('.menu button', { hasText: 'Link' }).click();
  await page.locator('#hr-url').fill('https://docs.example.com/lab');
  await page.locator('[data-act=turn-in]').click();
  await page.locator('.toast', { hasText: 'Turned in' }).waitFor();
  const done = calls.at(-1);
  assert.equal(done.path, '/api/v1/courses/2/assignments/201/submissions');
  assert.equal(done.csrf, 'tok+en/=');
});

await check('Canvas-only pages open in a new tab and Homeroom stays put', async () => {
  await page.goto(`${ORIGIN}/courses/1`, { waitUntil: 'commit' }).catch(() => {});
  await page.waitForFunction(() => window.ENV);
  await click();
  await page.locator('.post').first().waitFor();
  const [tab] = await Promise.all([ctx.waitForEvent('page'), page.locator('.comments-link').first().click()]);
  await tab.waitForLoadState();
  assert.match(tab.url(), /\/courses\/1\/discussion_topics\/900/);
  assert.equal(await tab.evaluate(() => window.canvasRan), true);
  await tab.close();
  assert.equal(await page.locator('.hero h1').count(), 1, 'Homeroom tab unchanged');
});

await check('clicking the bookmark again goes back to regular Canvas', async () => {
  await page.locator('[data-act=account]').first().click();
  assert.match(await page.locator('[data-act=turn-off]').textContent(), /Back to regular Canvas/);
  await page.keyboard.press('Escape');
  await Promise.all([page.waitForEvent('load'), click()]);
  assert.equal(await page.evaluate(() => window.canvasRan), true);
  assert.equal(await page.locator('#hr-main').count(), 0);
  assert.equal(new URL(page.url()).pathname, '/courses/1');
});

await check('refuses to run off Canvas', async () => {
  const other = await ctx.newPage();
  const dialogs = [];
  other.on('dialog', (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });
  await other.setContent('<p>not canvas</p>');
  await other.evaluate(code);
  assert.match(dialogs[0] || '', /works on Canvas/);
});

await check('install page has the real bookmark and fits a phone', async () => {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(new URL('../index.html', import.meta.url).href);
  assert.equal(await p.locator('#bookmarklet').getAttribute('href'), bookmarklet);
  assert.equal(await p.locator('#code').inputValue(), bookmarklet);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await p.evaluate(() => [...document.images].every((i) => i.naturalWidth > 0)), true, 'screenshots load');
});

assert.deepEqual(errors, []);
await browser.close();
console.log(`All ${passed} bookmark checks passed.`);
