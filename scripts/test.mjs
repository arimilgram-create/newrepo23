// Runs the built bookmarklet against a fake Canvas dashboard with mocked API responses.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const code = await readFile(new URL('../dist/quad.min.js', import.meta.url), 'utf8');
const ORIGIN = 'https://school.instructure.test';
const day = (n, h = 23) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(h, 59, 0, 0);
  return d.toISOString();
};

const card = (id, name) => `
  <div class="ic-DashboardCard"><div class="ic-DashboardCard__header">
    <a class="ic-DashboardCard__link" href="/courses/${id}"><div class="ic-DashboardCard__header_hero"></div>${name}</a>
  </div></div>`;

const html = `<!doctype html><html><head><title>Dashboard</title></head><body>
  <div id="application"><div id="DashboardCard_Container">${card(1, 'Calc')}${card(2, 'Chem')}</div></div>
  <script>window.ENV = { current_user_id: '9' }; document.cookie = '_csrf_token=' + encodeURIComponent('tok+en/=');</script>
</body></html>`;

const courses = [
  { id: 1, name: 'Calculus II', course_code: 'MATH 152', enrollments: [{ type: 'student', computed_current_score: 91.24, computed_current_grade: null }] },
  { id: 2, name: 'General Chemistry', course_code: 'CHEM 101', enrollments: [{ type: 'student', computed_current_score: 84.6, computed_current_grade: 'B' }] },
  { id: 3, name: 'Teaching Assistant Lab', enrollments: [{ type: 'ta' }] },
];
const planner = [
  { plannable_id: 11, plannable_type: 'assignment', course_id: 2, context_name: 'CHEM 101', html_url: '/courses/2/assignments/11',
    plannable_date: day(-1), plannable: { title: 'Lab 4 report', points_possible: 20 }, submissions: { submitted: false, missing: true }, planner_override: null },
  { plannable_id: 12, plannable_type: 'quiz', course_id: 1, context_name: 'MATH 152', html_url: '/courses/1/quizzes/12',
    plannable_date: day(0), plannable: { title: 'Quiz <b>7</b>', points_possible: 10 }, submissions: { submitted: true }, planner_override: null },
  { plannable_id: 13, plannable_type: 'assignment', course_id: 1, context_name: 'MATH 152', html_url: '/courses/1/assignments/13',
    plannable_date: day(1), plannable: { title: 'Problem set 6', points_possible: 25 }, submissions: { submitted: false }, planner_override: null },
  { plannable_id: 14, plannable_type: 'announcement', course_id: 1, plannable_date: day(1), plannable: { title: 'Ignore me' } },
  { plannable_id: 15, plannable_type: 'assignment', course_id: 1, plannable_date: day(-3), plannable: { title: 'Old done' }, submissions: { submitted: true } },
];

const browser = await chromium.launch();
const page = await browser.newPage();
const posts = [];
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });

await page.route(`${ORIGIN}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const json = (data, headers = {}) => route.fulfill({ status: 200, contentType: 'application/json', headers, body: 'while(1);' + JSON.stringify(data) });
  if (url.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: html });
  if (url.pathname === '/api/v1/courses') {
    // Split across two pages to exercise Link-header pagination.
    if (url.searchParams.get('page') === '2') return json(courses.slice(2));
    return json(courses.slice(0, 2), { Link: `<${ORIGIN}/api/v1/courses?page=2>; rel="next"` });
  }
  if (url.pathname === '/api/v1/planner/items') return json(planner);
  if (url.pathname === '/api/v1/users/self/colors') return json({ custom_colors: { course_1: '#8e5bd6', course_2: '#d9534f' } });
  if (url.pathname === '/api/v1/planner/overrides' && req.method() === 'POST') {
    posts.push({ body: req.postDataJSON(), csrf: req.headers()['x-csrf-token'] });
    return json({ id: 99, marked_complete: true });
  }
  if (url.pathname === '/api/v1/planner/overrides/99' && req.method() === 'PUT') {
    posts.push({ put: req.postDataJSON() });
    return json({ id: 99, marked_complete: false });
  }
  return route.fulfill({ status: 404, body: 'nope' });
});

await page.goto(ORIGIN + '/');
await page.evaluate(code);

const shadow = (sel) => page.locator('#quad-host').locator(sel);
await shadow('.row').first().waitFor();

// To-do: overdue first, announcements and old finished work dropped, HTML escaped.
const groups = await shadow('.group').allTextContents();
assert.equal(groups[0], 'Overdue · 1');
assert.ok(groups.includes('Today') && groups.includes('Tomorrow'), `groups: ${groups}`);
const titles = await shadow('.row a').allTextContents();
assert.deepEqual(titles, ['Lab 4 report', 'Quiz <b>7</b>', 'Problem set 6']);
assert.equal(await shadow('.row input').nth(1).isDisabled(), true, 'submitted item is locked');

// Checking an item marks it complete in Canvas with the CSRF token, unchecking uses PUT.
await shadow('.row input').nth(2).check();
await page.waitForFunction(() => document.querySelector('#quad-host').shadowRoot.querySelectorAll('.row.done').length === 2);
assert.deepEqual(posts[0], { body: { plannable_type: 'assignment', plannable_id: 13, marked_complete: true }, csrf: 'tok+en/=' });
await shadow('.row input').nth(2).uncheck();
await page.waitForFunction(() => document.querySelector('#quad-host').shadowRoot.querySelectorAll('.row.done').length === 1);
assert.deepEqual(posts[1], { put: { marked_complete: false } });

// Dashboard cards get grade badges; TA course is excluded.
assert.deepEqual(await page.locator('.quad-grade').allTextContents(), ['91.2% A-', '84.6% B']);

// Grades tab.
await shadow('[data-tab="grades"]').click();
assert.equal(await shadow('.course').count(), 2);

// GPA: A- (3.7) and B (3.0) → 3.35; mark Calc as AP → weighted 3.85.
await shadow('[data-tab="gpa"]').click();
const stats = () => shadow('.stat b').allTextContents();
assert.deepEqual(await stats(), ['3.35', '3.35']);
await shadow('[data-gpa-weight="1"]').selectOption('1');
assert.deepEqual(await stats(), ['3.35', '3.85']);
await shadow('[data-gpa-credits="1"]').fill('3');
await shadow('[data-gpa-credits="1"]').dispatchEvent('change');
assert.deepEqual(await stats(), ['3.53', '4.28']); // (3.7*3 + 3)/4 and (4.7*3 + 3)/4

// Settings: dark mode toggles the page class and persists.
await shadow('[data-tab="settings"]').click();
await shadow('[data-setting="dark"]').check();
assert.equal(await page.evaluate(() => document.documentElement.classList.contains('quad-dark')), true);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quad:v1')));
assert.equal(saved.dark, true);
assert.equal(saved.gpa['1'].weight, 1);

// Second click hides the panel, third shows it again, without loading twice.
await page.evaluate(code);
assert.equal(await shadow('.panel').isHidden(), true);
await page.evaluate(code);
assert.equal(await shadow('.panel').isVisible(), true);
assert.equal(await page.locator('#quad-host').count(), 1);

// Reload: settings come back on the next click.
await page.reload();
await page.evaluate(code);
await shadow('.panel').waitFor();
assert.equal(await page.evaluate(() => document.documentElement.classList.contains('quad-dark')), true);
await page.screenshot({ path: process.env.SHOT || 'dist/test-dark.png' });

// Off Canvas it refuses politely.
const other = await browser.newPage();
const dialogs = [];
other.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
await other.setContent('<p>not canvas</p>');
await other.evaluate(code);
assert.match(dialogs[0] || '', /works on Canvas/);

assert.deepEqual(errors, []);
await browser.close();
console.log('All bookmarklet checks passed.');
