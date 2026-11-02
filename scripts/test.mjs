// Unit tests for the grade math and search, then an end-to-end run of the built bookmarklet
// against a mock Canvas site (normal mode and stay-on mode) in headless Chromium.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { computeGpa, neededOnFinal, pointsFor, letterFromScore } from '../src/gpa.js';
import { inSchedule } from '../src/settings.js';
import { search } from '../src/palette.js';
import { relTime, toHex, readableOn } from '../src/util.js';

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

// ---------- unit ----------

await check('grade points', () => {
  assert.equal(pointsFor({ score: 91.2 }, 'standard'), 3.7);
  assert.equal(pointsFor({ score: 98 }, 'plus'), 4.3);
  assert.equal(pointsFor({ score: 50, letter: 'B+' }, 'standard'), 3.3, 'Canvas letter wins');
  assert.equal(pointsFor({ score: 88, letter: 'B+' }, 'simple'), 3, '+/- dropped on simple scale');
  assert.equal(pointsFor({ score: 72, letter: 'Meets' }, 'standard'), 1.7, 'unknown letter falls back to %');
  assert.equal(pointsFor({ score: 72 }, 'standard', 'A'), 4, 'what-if');
  assert.equal(letterFromScore(null, 'standard'), null);
});

await check('gpa', () => {
  const courses = [
    { id: '1', score: 91 }, // A- 3.7
    { id: '2', score: 84 }, // B 3.0
    { id: '3', score: null },
  ];
  const g = computeGpa(courses, { 1: { credits: 3, weight: 1 } }, 'standard', { gpa: 3.5, credits: 30 });
  assert.equal(g.credits, 4);
  assert.equal(g.unweighted.toFixed(3), ((3.7 * 3 + 3) / 4).toFixed(3));
  assert.equal(g.weighted.toFixed(3), ((4.7 * 3 + 3) / 4).toFixed(3));
  assert.equal(g.cumulative.toFixed(3), ((3.5 * 30 + g.unweighted * 4) / 34).toFixed(3));
  assert.equal(computeGpa(courses, { 1: { skip: true }, 2: { skip: true } }, 'standard'), null);
});

await check('final exam', () => {
  assert.equal(neededOnFinal(85, 20, 90), 110);
  assert.equal(neededOnFinal(95, 20, 80).toFixed(1), '20.0');
  assert.equal(neededOnFinal(80, 0, 90), null);
});

await check('schedule + helpers', () => {
  const at = (h, m = 0) => new Date(2026, 0, 1, h, m);
  assert.equal(inSchedule('19:00', '07:00', at(23)), true);
  assert.equal(inSchedule('19:00', '07:00', at(6, 59)), true);
  assert.equal(inSchedule('19:00', '07:00', at(12)), false);
  assert.equal(inSchedule('08:00', '17:00', at(9)), true);
  assert.equal(relTime(new Date(3 * 36e5), 0), 'in 3h');
  assert.equal(relTime(new Date(0), 2 * 864e5), '2d ago');
  assert.equal(toHex('rgb(142, 91, 214)'), '#8e5bd6');
  assert.equal(readableOn('#ffffff'), '#14171a');
  assert.equal(readableOn('#0f172a'), '#ffffff');
});

await check('search', () => {
  const list = [
    { label: 'Calculus II', hint: 'MATH 152', group: 'Courses' },
    { label: 'Calculus II › Grades', hint: 'MATH 152', group: 'Courses' },
    { label: 'General Chemistry › Grades', hint: 'CHEM 101', group: 'Courses' },
    { label: 'Problem set 6', hint: 'MATH 152', group: 'Due soon' },
  ];
  assert.equal(search(list, 'calc grades')[0].label, 'Calculus II › Grades');
  assert.equal(search(list, 'chem')[0].label, 'General Chemistry › Grades');
  assert.equal(search(list, 'math 152 problem')[0].label, 'Problem set 6');
  assert.equal(search(list, 'zzz').length, 0);
});

// ---------- end to end ----------

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const code = await readFile(new URL('../dist/quad.min.js', import.meta.url), 'utf8');
const ORIGIN = 'https://school.instructure.test';
const hours = (h) => new Date(Date.now() + h * 36e5).toISOString();

const card = (id, name, rgb) => `
  <div class="ic-DashboardCard">
    <div class="ic-DashboardCard__header">
      <div class="ic-DashboardCard__header_image" style="background-image: url(&quot;data:image/gif;base64,R0lGODlhAQABAAAAACw=&quot;);">
        <div class="ic-DashboardCard__header_hero" style="background-color: ${rgb}; opacity: 0.6;"></div>
      </div>
      <a class="ic-DashboardCard__link" href="/courses/${id}">
        <div class="ic-DashboardCard__header_content"><h3 class="ic-DashboardCard__header-title" style="color: ${rgb}"><span>${name}</span></h3></div>
      </a>
    </div>
    <nav class="ic-DashboardCard__action-container"><a href="/courses/${id}/assignments">Assignments</a></nav>
  </div>`;

const canvasPage = (path) => `<!doctype html><html><head><title>${path === '/' ? 'Dashboard' : 'Course ' + path}</title></head><body>
  <div id="application" class="ic-app">
    <header class="ic-app-header"><div class="ic-app-header__logomark-container">LOGO</div>
      <ul><li class="ic-app-header__menu-list-item ic-app-header__menu-list-item--active"><a class="ic-app-header__menu-list-link"><div class="menu-item__text">Dashboard</div></a></li></ul>
    </header>
    <div id="wrapper" class="ic-Layout-wrapper"><div id="main">
      <div id="content"><h1>${path}</h1><div id="DashboardCard_Container"></div></div>
      <aside id="right-side"><div class="Sidebar__TodoListContainer">Canvas To Do</div><div class="Sidebar__RecentFeedbackContainer">Feedback</div></aside>
    </div></div>
  </div>
  <script>
    window.ENV = { current_user_id: '9' };
    document.cookie = '_csrf_token=' + encodeURIComponent('tok+en/=');
    // Canvas renders dashboard cards late with React; mimic that.
    setTimeout(() => {
      document.getElementById('DashboardCard_Container').innerHTML = ${JSON.stringify(
        card(1, 'Calculus II', 'rgb(142, 91, 214)') + card(2, 'General Chemistry', 'rgb(217, 83, 79)') + card(4, 'Intro to Literature', 'rgb(43, 154, 107)')
      )};
    }, 80);
  </script>
</body></html>`;

const enrollment = (score, grade) => [{ type: 'student', computed_current_score: score, computed_current_grade: grade }];
const courses = [
  { id: 1, name: 'Calculus II', course_code: 'MATH 152', enrollments: enrollment(91.24, null) },
  { id: 2, name: 'General Chemistry', course_code: 'CHEM 101', enrollments: enrollment(84.6, 'B') },
  { id: 3, name: 'Teaching Assistant Lab', enrollments: [{ type: 'ta' }] },
  { id: 4, name: 'Intro to Literature', course_code: 'ENGL 120', enrollments: enrollment(96, 'A') },
];
const planner = [
  { plannable_id: 11, plannable_type: 'assignment', course_id: 2, context_name: 'CHEM 101', html_url: '/courses/2/assignments/11',
    plannable_date: hours(-26), plannable: { title: 'Lab 4 report', points_possible: 20 }, submissions: { submitted: false, missing: true }, planner_override: null },
  { plannable_id: 12, plannable_type: 'quiz', course_id: 1, context_name: 'MATH 152', html_url: '/courses/1/quizzes/12',
    plannable_date: hours(2), plannable: { title: 'Quiz <b>7</b>', points_possible: 10 }, submissions: { submitted: true }, planner_override: null },
  { plannable_id: 13, plannable_type: 'assignment', course_id: 1, context_name: 'MATH 152', html_url: '/courses/1/assignments/13',
    plannable_date: hours(5), plannable: { title: 'Problem set 6', points_possible: 25 }, submissions: { submitted: false }, planner_override: null },
  { plannable_id: 16, plannable_type: 'discussion_topic', course_id: 4, context_name: 'ENGL 120', html_url: '/courses/4/discussion_topics/16',
    plannable_date: hours(50), plannable: { title: 'Response to Baldwin' }, submissions: { submitted: false }, planner_override: null },
  { plannable_id: 14, plannable_type: 'announcement', course_id: 1, plannable_date: hours(3), plannable: { title: 'Ignore me' } },
  { plannable_id: 15, plannable_type: 'assignment', course_id: 1, plannable_date: hours(-72), plannable: { title: 'Old done' }, submissions: { submitted: true } },
];

const calls = [];
const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => {
  errors.push('dialog: ' + d.message());
  d.dismiss();
});

let noteId = 500;
await context.route(`${ORIGIN}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  const json = (data, headers = {}) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers, body: 'while(1);' + JSON.stringify(data) });
  if (!url.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'text/html', body: canvasPage(url.pathname) });
  if (method !== 'GET') calls.push({ method, path: url.pathname, body: req.postDataJSON(), csrf: req.headers()['x-csrf-token'] });
  if (url.pathname === '/api/v1/courses') {
    if (url.searchParams.get('page') === '2') return json(courses.slice(2));
    return json(courses.slice(0, 2), { Link: `<${ORIGIN}/api/v1/courses?page=2>; rel="next"` });
  }
  if (url.pathname === '/api/v1/planner/items') return json(planner);
  if (url.pathname === '/api/v1/users/self/colors') return json({ custom_colors: { course_1: '#8e5bd6', course_2: '#d9534f' } });
  if (url.pathname === '/api/v1/planner/overrides') return json({ id: 99, marked_complete: true });
  if (url.pathname === '/api/v1/planner/overrides/99') return json({ id: 99, marked_complete: false });
  if (url.pathname === '/api/v1/planner_notes' && method === 'POST') {
    const b = req.postDataJSON();
    planner.push({ plannable_id: ++noteId, plannable_type: 'planner_note', course_id: b.course_id, plannable_date: b.todo_date,
      plannable: { title: b.title, todo_date: b.todo_date }, planner_override: null });
    return json({ id: noteId });
  }
  if (url.pathname.startsWith('/api/v1/planner_notes/') && method === 'DELETE') {
    const id = Number(url.pathname.split('/').pop());
    planner.splice(planner.findIndex((p) => p.plannable_id === id), 1);
    return json({});
  }
  if (url.pathname.startsWith('/api/v1/users/self/colors/')) return json({ hexcode: req.postDataJSON().hexcode });
  if (url.pathname.startsWith('/api/v1/users/self/course_nicknames/')) return json({ nickname: (req.postDataJSON() || {}).nickname });
  return route.fulfill({ status: 404, body: 'nope' });
});

const q = (sel) => page.locator('#quad-host').locator(sel);
const html = () => page.evaluate(() => document.documentElement.className);
const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 5000 });

await page.goto(ORIGIN + '/');
await page.evaluate(code);

await check('to-do list', async () => {
  await q('.row').first().waitFor();
  const groups = await q('main .group').allTextContents();
  assert.equal(groups[0], 'Overdue · 1');
  const titles = await q('main .row .title').allTextContents();
  assert.deepEqual(titles, ['Lab 4 report', 'Quiz <b>7</b>', 'Problem set 6', 'Response to Baldwin']);
  assert.equal(await q('main .row .check').nth(1).isDisabled(), true, 'turned-in work is locked');
  assert.equal((await q('nav .tab[data-tab=todo] .count').textContent()).trim(), '3');
});

await check('due-soon reminders', async () => {
  const toasts = await q('.toast.reminder').allTextContents();
  assert.equal(toasts.length, 1, 'only unfinished work inside 24h');
  assert.match(toasts[0], /Problem set 6/);
  await q('.toast.reminder [data-act=dismiss]').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quad:v2')).dismissed);
  assert.ok(saved['assignment:13']);
});

await check('dashboard cards', async () => {
  await until(() => document.querySelectorAll('.quad-grade').length === 3);
  assert.deepEqual(await page.locator('.quad-grade').allTextContents(), ['91.2% A-', '84.6% B', '96% A']);
  await until(() => document.querySelectorAll('.quad-card-list').length === 3);
  const lists = await page.locator('.quad-card-list').allTextContents();
  assert.match(lists[0], /Problem set 6/);
  assert.doesNotMatch(lists[0], /Quiz/, 'submitted work left off cards');
  assert.match(lists[1], /Lab 4 report\s*Late/);
  // Sits between the header and the action links.
  assert.equal(await page.evaluate(() => document.querySelector('.quad-card-list').nextElementSibling.tagName), 'NAV');
});

await check('sidebar to-do replaces Canvas’s', async () => {
  await until(() => document.querySelector('.quad-embed'));
  const embedRows = await page.locator('.quad-embed').locator('.row .title').allTextContents();
  assert.equal(embedRows.length, 4);
  assert.equal(await page.locator('.Sidebar__TodoListContainer').isHidden(), true);
});

await check('check off and add to-dos', async () => {
  await q('main .row .check').nth(2).check();
  await until(() => document.querySelector('#quad-host').shadowRoot.querySelectorAll('main .row.done').length === 2);
  assert.deepEqual(calls.at(-1), {
    method: 'POST', path: '/api/v1/planner/overrides', csrf: 'tok+en/=',
    body: { plannable_type: 'assignment', plannable_id: 13, marked_complete: true },
  });
  await q('[data-act=add-open]').click();
  await q('#add-title').fill('Buy lab goggles');
  await q('#add-course').selectOption('2');
  await q('form.add [type=submit]').click();
  await q('main .row .title', { hasText: 'Buy lab goggles' }).first().waitFor();
  const add = calls.find((c) => c.path === '/api/v1/planner_notes');
  assert.equal(add.body.title, 'Buy lab goggles');
  assert.equal(add.body.course_id, '2');
  const row = q('main .row', { hasText: 'Buy lab goggles' });
  await row.locator('[data-act=del-note]').click();
  await until(() => ![...document.querySelector('#quad-host').shadowRoot.querySelectorAll('main .title')].some((a) => a.textContent === 'Buy lab goggles'));
  assert.equal(calls.at(-1).method, 'DELETE');
});

await check('course filter', async () => {
  await q('#todo-course').selectOption('4');
  assert.deepEqual(await q('main .row .title').allTextContents(), ['Response to Baldwin']);
  await q('#todo-course').selectOption('all');
});

await check('grades', async () => {
  await q('nav [data-tab=grades]').click();
  assert.equal(await q('a.course').count(), 3, 'TA course left out');
  assert.match(await q('.summary').textContent(), /90\.6%/);
});

await check('gpa with what-if and past semesters', async () => {
  await q('nav [data-tab=gpa]').click();
  const stats = () => q('.stat b').allTextContents();
  // A- 3.7, B 3.0, A 4.0 → 3.567
  assert.deepEqual(await stats(), ['3.57', '3.57', '—']);
  await q('#g-lv-1').selectOption('1');
  assert.deepEqual((await stats()).slice(0, 2), ['3.57', '3.90']);
  await q('#g-wi-2').selectOption('A');
  assert.equal((await stats())[0], '3.90');
  await q('#past-gpa').fill('3.2');
  await q('#past-gpa').dispatchEvent('change');
  await q('#past-cr').fill('30');
  await q('#past-cr').dispatchEvent('change');
  assert.equal((await stats())[2], ((3.2 * 30 + 3.9 * 3) / 33).toFixed(2));
});

await check('tools', async () => {
  await q('nav [data-tab=tools]').click();
  await q('#final-course').selectOption('2');
  assert.equal(await q('#final-current').inputValue(), '84.6');
  await q('#final-target').fill('90');
  await q('#final-target').dispatchEvent('change');
  assert.match(await q('.result').textContent(), /111\.6%.*above 100%/);
  await q('#final-target').fill('80');
  await q('#final-target').dispatchEvent('change');
  assert.match(await q('.result').textContent(), /You need 61\.6% on the final/);

  await q('[data-act=timer-start]').click();
  await until(() => /Focus \d\d:\d\d/.test(document.querySelector('#quad-host').shadowRoot.querySelector('[data-timer-chip]').textContent));

  await q('#notes').fill('Study for chem quiz');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('quad:v2')).notes), 'Study for chem quiz');

  const [download] = await Promise.all([page.waitForEvent('download'), q('[data-act=export-ics]').click()]);
  const ics = await readFile(await download.path(), 'utf8');
  assert.equal(download.suggestedFilename(), 'canvas-due-dates.ics');
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /SUMMARY:Response to Baldwin \(ENGL 120\)/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
});

await check('themes and palettes', async () => {
  await q('nav [data-tab=settings]').click();
  await q('[data-settab=look]').click();
  await q('#s-themeRecolor').check();
  const before = calls.length;
  await q('[data-act=theme][data-id=midnight]').click();
  await until(() => document.documentElement.classList.contains('quad-dark'));
  const cls = await html();
  ['quad-dark', 'quad-nav', 'quad-accent', 'quad-font'].forEach((c) => assert.ok(cls.includes(c), c));
  assert.match(await page.locator('#quad-font-link').getAttribute('href'), /family=Inter/);
  await page.waitForTimeout(300);
  const recolors = calls.slice(before).filter((c) => c.path.startsWith('/api/v1/users/self/colors/'));
  assert.equal(recolors.length, 4, 'every course recolored');
  assert.deepEqual(recolors[0].body, { hexcode: '03045e' });
  // Card text and hero pick up the new color right away.
  assert.equal(await page.locator('.ic-DashboardCard__header-title').first().evaluate((el) => el.style.color), 'rgb(3, 4, 94)');
  // Media is flipped back so pictures look normal in dark mode.
  assert.match(await page.locator('.ic-DashboardCard__header_image').first().evaluate((el) => getComputedStyle(el).filter), /invert\(1\)/);
  assert.equal(await page.locator('.ic-DashboardCard__header_hero').first().evaluate((el) => getComputedStyle(el).filter), 'none');
});

await check('dashboard settings', async () => {
  await q('[data-settab=dashboard]').click();
  await q('#s-cardStyle').selectOption('gradient');
  await until(() => /linear-gradient/.test(document.querySelector('.ic-DashboardCard__header_hero').getAttribute('style')));
  await q('#s-hideFeedback').check();
  await q('#s-fullWidth').check();
  await q('#s-hideLogo').check();
  assert.equal(await page.locator('.Sidebar__RecentFeedbackContainer').isHidden(), true);
  assert.equal(await page.locator('.ic-app-header__logomark-container').isHidden(), true);
  await q('#s-cardGrades').uncheck();
  await until(() => !document.querySelector('.quad-grade'));
  await q('#s-cardGrades').check();
});

await check('course nicknames and pictures', async () => {
  await q('[data-settab=courses]').click();
  await q('#c-nick-1').fill('Calc');
  await q('#c-nick-1').dispatchEvent('change');
  await until(() => document.querySelector('.ic-DashboardCard__header-title span').textContent === 'Calc');
  assert.deepEqual(calls.at(-1), { method: 'PUT', path: '/api/v1/users/self/course_nicknames/1', body: { nickname: 'Calc' }, csrf: 'tok+en/=' });
  await q('#c-img-2').fill('https://example.com/chem.jpg');
  await q('#c-img-2').dispatchEvent('change');
  await until(() => /chem\.jpg/.test(document.querySelectorAll('.ic-DashboardCard__header_hero')[1].getAttribute('style')));
});

await check('command palette', async () => {
  await page.keyboard.press('Control+k');
  await q('.palette input').waitFor();
  await page.keyboard.type('chem grades');
  assert.match(await q('.result.on .rl').textContent(), /General Chemistry › Grades/);
  await Promise.all([page.waitForURL(`${ORIGIN}/courses/2/grades`), page.keyboard.press('Enter')]);
});

await check('settings survive a page load', async () => {
  await page.evaluate(code);
  await q('.panel').waitFor();
  assert.ok((await html()).includes('quad-dark'));
  await page.keyboard.press('Alt+q');
  assert.equal(await q('.panel').isHidden(), true);
  await page.evaluate(code);
  assert.equal(await q('.panel').isVisible(), true);
});

await check('stay-on mode keeps Quad running across pages', async () => {
  await page.goto(ORIGIN + '/');
  await page.evaluate(code);
  await q('nav [data-tab=settings]').click();
  await q('[data-settab=more]').click();
  await q('#s-stayOn').check();
  const frame = page.frameLocator('#quad-frame');
  await frame.locator('.quad-grade').first().waitFor();
  assert.ok(await frame.locator('html').evaluate((el) => el.classList.contains('quad-dark')));
  // Click a link inside Canvas: the frame navigates, Quad stays and re-applies itself.
  await frame.locator('a[href="/courses/4"]').first().click();
  await page.waitForURL(`${ORIGIN}/courses/4`);
  await frame.locator('html.quad-dark').waitFor();
  assert.equal(await page.title(), 'Course /courses/4');
  assert.equal(await page.evaluate(() => window.__quad.version), 2);
  // The palette navigates the frame, not the tab.
  await page.keyboard.press('Control+k');
  await page.keyboard.type('calendar');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${ORIGIN}/calendar`);
  assert.equal(await page.evaluate(() => !!window.__quad), true, 'still the same page');
  await page.screenshot({ path: process.env.SHOT || 'dist/test-stayon.png' });
});

await check('refuses to run off Canvas', async () => {
  const other = await context.newPage();
  const dialogs = [];
  other.on('dialog', (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });
  await other.setContent('<p>not canvas</p>');
  await other.evaluate(code);
  assert.match(dialogs[0] || '', /works on Canvas/);
});

assert.deepEqual(errors, []);
await browser.close();
console.log(`All ${passed} checks passed.`);
