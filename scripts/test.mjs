// Extension test: loads the built extension into Chromium and drives it against a mock Canvas site.
// Screenshots land in screenshots/ (light and dark, desktop and phone).
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { ORIGIN, at, calls, route } from './mock-canvas.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const EXT = new URL('../extension/', import.meta.url).pathname;
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
await mkdir(SHOTS, { recursive: true });

// ---------- run ----------

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

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 860 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
await ctx.addCookies([{ name: '_csrf_token', value: encodeURIComponent('tok+en/='), domain: 'school.instructure.com', path: '/', secure: true }]);
await ctx.route(`${ORIGIN}/**`, route);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));

const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: false });
const noErrorView = async () => assert.equal(await page.locator('.empty-state h2', { hasText: 'Couldn’t load' }).count(), 0);

await check('home: class cards replace Canvas', async () => {
  await page.goto(ORIGIN + '/', { waitUntil: 'commit' });
  await page.locator('.class-card .cc-name').first().waitFor();
  assert.deepEqual(await page.locator('.cc-name').allTextContents(), ['AP Calculus BC', 'Honors Chemistry', 'American Literature']);
  assert.equal(await page.evaluate(() => window.canvasRan), undefined, 'Canvas scripts never ran');
  assert.equal(await page.title(), 'Homeroom');
  assert.equal(await page.locator('.cc-teacher').first().textContent(), 'Dana Whitfield');
  assert.match(await page.locator('.class-card').first().locator('.cc-body').textContent(), /Read section 10\.3|Problem set 6/);
  await noErrorView();
  await shot('1-home');
});

await check('side menu stays docked on wide screens and folds to icons', async () => {
  assert.equal(await page.evaluate(() => document.body.classList.contains('docked')), true);
  await page.locator('.drawer .dr-item.class').first().waitFor();
  assert.equal(await page.locator('.drawer .dr-item.class').count(), 4);
  assert.equal(await page.locator('.drawer .dr-item', { hasText: 'To-do' }).count(), 1);
  await page.locator('[data-act=drawer]').click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('rail')), true);
  await page.waitForTimeout(250);
  await shot('2-rail');
  await page.locator('[data-act=drawer]').click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('rail')), false);
});

await check('stream', async () => {
  await page.locator('.cc-title', { hasText: 'AP Calculus BC' }).click();
  await page.waitForURL(`${ORIGIN}/courses/1`);
  await page.locator('.hero h1').waitFor();
  assert.equal(await page.locator('.hero h1').textContent(), 'AP Calculus BC');
  assert.equal(await page.locator('.tab.on').textContent(), 'Stream');
  assert.match(await page.locator('.upcoming').textContent(), /Read section 10\.3/);
  assert.match(await page.locator('.post').first().textContent(), /Chapter 10 test this Friday/);
  assert.equal(await page.evaluate(() => window.pwned), undefined, 'teacher HTML is sanitized');
  assert.equal(await page.locator('.post img[onerror]').count(), 0);
  assert.ok((await page.locator('.post-mini').count()) >= 3);
  assert.equal(await page.evaluate(() => window.canvasRan), undefined, 'moved without reloading');
  await shot('3-stream');
});

await check('class comments on the stream', async () => {
  await page.locator('.post .comments-link').click();
  await page.locator('.post .comment', { hasText: 'Is it open note?' }).waitFor();
  assert.match(await page.locator('.post .replies').textContent(), /One index card/);
  await page.locator('.post .comment-form input').last().fill('Thanks!');
  await page.locator('.post .comment-form input').last().press('Enter');
  await page.locator('.post .comment', { hasText: 'Thanks!' }).waitFor();
  assert.deepEqual(calls.at(-1), { method: 'POST', path: '/api/v1/courses/1/discussion_topics/900/entries', body: { message: '<p>Thanks!</p>' }, csrf: 'tok+en/=' });
  await shot('3b-stream-comments');
});

await check('classwork with topics', async () => {
  await page.locator('.tab', { hasText: 'Classwork' }).click();
  await page.waitForURL(`${ORIGIN}/courses/1/modules`);
  await page.locator('.topic-title').first().waitFor();
  assert.deepEqual(await page.locator('.topic-title').allTextContents(), ['Unit 10: Infinite series', 'Unit 9: Integration review']);
  const row = page.locator('.cw-item', { hasText: 'Problem set 5' });
  await row.locator('.cw-row').click();
  assert.match(await row.locator('.cw-detail').textContent(), /Missing/);
  assert.equal(await row.locator('.cw-detail a').getAttribute('href'), '/courses/1/assignments/103');
  await page.locator('.cw-item', { hasText: 'Problem set 6' }).locator('.cw-row').click();
  await shot('4-classwork');
});

await check('classwork falls back to assignment groups', async () => {
  await page.goto(ORIGIN + '/courses/2/modules', { waitUntil: 'commit' });
  await page.locator('.topic-title').first().waitFor();
  assert.deepEqual(await page.locator('.topic-title').allTextContents(), ['Labs', 'Reflections']);
});

await check('people', async () => {
  await page.goto(ORIGIN + '/courses/1/users', { waitUntil: 'commit' });
  await page.locator('.people-list li').first().waitFor();
  assert.match(await page.locator('.people-head').nth(1).textContent(), /5 students/);
  await shot('5-people');
  await page.locator('.tb-class').click();
  await page.goto(ORIGIN + '/courses/2/users', { waitUntil: 'commit' });
  await page.locator('.people-head').first().waitFor();
  assert.match(await page.locator('.people').textContent(), /hidden the class list/);
});

await check('grades / your work', async () => {
  await page.goto(ORIGIN + '/courses/1/grades', { waitUntil: 'commit' });
  await page.locator('.yw-overall b').waitFor();
  assert.equal(await page.locator('.yw-overall b').textContent(), '91.24% · A-');
  assert.match(await page.locator('.work-row', { hasText: 'Quiz 7' }).textContent(), /9\/10/);
  await shot('6-grades');
  assert.match(await page.locator('.yw-filter', { hasText: 'Missing' }).textContent(), /1/);
  await page.locator('.yw-filter', { hasText: 'Missing' }).click();
  await page.waitForURL(/show=missing/);
  await page.waitForFunction(() => document.querySelectorAll('.work-row').length === 1);
  assert.match(await page.locator('.work-row').textContent(), /Problem set 5/);
});

await check('turn in a file', async () => {
  await page.goto(ORIGIN + '/courses/1/assignments/101', { waitUntil: 'commit' });
  await page.locator('.work-card').waitFor();
  assert.equal(await page.locator('.wc-head .status').textContent(), 'Assigned');
  assert.match(await page.locator('.as-body').textContent(), /problems 1–20/);
  assert.equal(await page.locator('[data-act=turn-in]').isDisabled(), true);
  await page.locator('[data-act=add-menu]').click();
  assert.deepEqual(await page.locator('.menu button').allTextContents().then((t) => t.map((s) => s.trim())), ['File']);
  await shot('7-assignment');
  await page.locator('#hr-file').setInputFiles({ name: 'work.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await page.locator('.attach.pending', { hasText: 'work.pdf' }).waitFor();
  await page.locator('[data-act=turn-in]').click();
  await page.locator('.toast', { hasText: 'Turned in' }).waitFor();
  await page.locator('.wc-head .status', { hasText: 'Turned in' }).waitFor();
  const slot = calls.find((c) => c.path.endsWith('/assignments/101/submissions/self/files'));
  assert.deepEqual(slot.body, { name: 'work.pdf', size: 13, content_type: 'application/pdf' });
  assert.equal(slot.csrf, 'tok+en/=');
  const done = calls.find((c) => c.path === '/api/v1/courses/1/assignments/101/submissions');
  assert.deepEqual(done.body, { submission: { submission_type: 'online_upload', file_ids: [777] } });
});

await check('private comments', async () => {
  assert.match(await page.locator('.comments-card').textContent(), /Show your work on #14/);
  await page.locator('#hr-comment').fill('Will do, thanks!');
  await page.locator('#hr-comment').press('Enter');
  await page.locator('.pc-text', { hasText: 'Will do, thanks!' }).waitFor();
  assert.deepEqual(calls.at(-1).body, { comment: { text_comment: 'Will do, thanks!' } });
});

await check('mark as done', async () => {
  await page.goto(ORIGIN + '/courses/1/assignments/104', { waitUntil: 'commit' });
  await page.locator('[data-act=mark-done]').click();
  await page.locator('[data-act=mark-done]', { hasText: 'Unmark as done' }).waitFor();
  assert.deepEqual(calls.at(-1).body, { plannable_type: 'assignment', plannable_id: 104, marked_complete: true });
});

await check('turn in a link', async () => {
  await page.goto(ORIGIN + '/courses/2/assignments/201', { waitUntil: 'commit' });
  await page.locator('[data-act=add-menu]').click();
  await page.locator('.menu button', { hasText: 'Link' }).click();
  await page.locator('#hr-url').fill('https://docs.example.com/lab');
  await page.locator('[data-act=turn-in]').click();
  await page.locator('.toast', { hasText: 'Turned in' }).waitFor();
  assert.deepEqual(calls.at(-1).body, { submission: { submission_type: 'online_url', url: 'https://docs.example.com/lab' } });
});

await check('to-do', async () => {
  await page.goto(ORIGIN + '/#todo/assigned', { waitUntil: 'commit' });
  await page.locator('.todo-group').first().waitFor();
  assert.equal(await page.locator('.tab.on').textContent(), 'Assigned');
  const titles = await page.locator('.todo-group.open .tr-title').allTextContents();
  assert.ok(titles.includes('Reflection: Lab safety'));
  assert.ok(!titles.includes('Problem set 6: Series'), 'turned-in work moved to Done');
  await shot('8-todo');
  await page.locator('.tab', { hasText: 'Missing' }).click();
  await page.waitForURL(/#todo\/missing/);
  await page.waitForFunction(() => document.querySelector('.tab.on')?.textContent === 'Missing' && document.querySelector('.todo-group.open'));
  assert.deepEqual(await page.locator('.todo-group.open .tr-title').allTextContents(), ['Problem set 5: Integrals']);
  await page.locator('.tab', { hasText: 'Done' }).click();
  await page.waitForFunction(() => /Quiz 7/.test(document.querySelector('.todo')?.textContent || '') || document.querySelectorAll('.todo-group').length === 5);
  assert.match(await page.locator('.todo').textContent(), /Quiz 7/);
});

await check('calendar', async () => {
  await page.goto(ORIGIN + '/calendar', { waitUntil: 'commit' });
  await page.locator('.day').first().waitFor();
  assert.equal(await page.locator('.day').count(), 7);
  assert.equal(await page.locator('.day.today').count(), 1);
  await shot('9-calendar');
  const before = await page.locator('.cal-nav h2').textContent();
  await page.locator('[aria-label="Next week"]').click();
  await page.waitForFunction((b) => document.querySelector('.cal-nav h2').textContent !== b, before);
});

await check('class color', async () => {
  await page.goto(ORIGIN + '/', { waitUntil: 'commit' });
  await page.locator('[data-act=card-menu]').first().click();
  await page.locator('.swatch[data-color="#e37400"]').click();
  await page.locator('.toast', { hasText: 'Class color updated' }).waitFor();
  assert.deepEqual(calls.at(-1), { method: 'PUT', path: '/api/v1/users/self/colors/course_1', body: { hexcode: 'e37400' }, csrf: 'tok+en/=' });
});

await check('dark theme sticks', async () => {
  await page.locator('[data-act=account]').first().click();
  await page.locator('[data-theme=dark]').click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'commit' });
  await page.locator('.class-card .cc-name').first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await shot('10-home-dark');
  await page.goto(ORIGIN + '/courses/1', { waitUntil: 'commit' });
  await page.locator('.hero h1').waitFor();
  await shot('11-stream-dark');
  await page.goto(ORIGIN + '/courses/1/assignments/101', { waitUntil: 'commit' });
  await page.locator('.work-card').waitFor();
  await shot('12-assignment-dark');
  await page.evaluate(() => localStorage.setItem('homeroom:theme', 'light'));
});

await check('back button', async () => {
  await page.goto(ORIGIN + '/courses/1', { waitUntil: 'commit' });
  await page.locator('.hero h1').waitFor();
  await page.locator('.tab', { hasText: 'People' }).click();
  await page.locator('.people-list').first().waitFor();
  await page.goBack({ waitUntil: 'commit' });
  await page.locator('.hero h1').waitFor();
  assert.equal(new URL(page.url()).pathname, '/courses/1');
});

await check('announcement page with class comments', async () => {
  await page.goto(ORIGIN + '/courses/1/discussion_topics/900', { waitUntil: 'commit' });
  await page.locator('.post-title.big').waitFor();
  await page.locator('.comment', { hasText: 'Is it open note?' }).waitFor();
  await page.locator('.comment [data-act=reply-to]').first().click();
  await page.locator('.reply-slot input').fill('Same question');
  await page.locator('.reply-slot input').press('Enter');
  await page.locator('.replies .comment', { hasText: 'Same question' }).waitFor();
  assert.equal(calls.at(-1).path, '/api/v1/courses/1/discussion_topics/900/entries/701/replies');
  assert.equal(await page.locator('.tab.on').textContent(), 'Classwork');
  await shot('17-announcement');
});

await check('graded discussion: assignment link opens the discussion', async () => {
  await page.goto(ORIGIN + '/courses/1/assignments/105', { waitUntil: 'commit' });
  await page.waitForURL(`${ORIGIN}/courses/1/discussion_topics/950`);
  await page.locator('.as-titles h1', { hasText: 'Which convergence test' }).waitFor();
  assert.match(await page.locator('.work-card').textContent(), /Assigned[\s\S]*Post a reply/);
  await page.locator('.thread .comment-form input').fill('The ratio test, because of the factorial.');
  await page.locator('.thread .comment-form input').press('Enter');
  await page.locator('.comment', { hasText: 'ratio test' }).waitFor();
  assert.equal(calls.at(-1).path, '/api/v1/courses/1/discussion_topics/950/entries');
  await shot('18-discussion');
});

await check('quiz page, then the quiz itself inside Homeroom', async () => {
  await page.goto(ORIGIN + '/courses/1/grades', { waitUntil: 'commit' });
  await page.locator('.work-row', { hasText: 'Quiz 7' }).click();
  await page.waitForURL(`${ORIGIN}/courses/1/quizzes/5`);
  await page.locator('.facts').waitFor();
  assert.match(await page.locator('.facts').textContent(), /8 questions[\s\S]*20 minute[\s\S]*2 attempts/);
  assert.equal(await page.locator('.wc-head .status').textContent(), '9/10');
  assert.match(await page.locator('.attempts').textContent(), /Attempt 1/);
  await shot('19-quiz');
  await page.locator('.work-card a', { hasText: 'Take again' }).click();
  await page.waitForURL(/\/courses\/1\/quizzes\/5\?hr=frame/);
  const frame = page.frameLocator('.canvas-frame');
  await frame.locator('h1').waitFor();
  assert.match(await frame.locator('h1').textContent(), /Canvas \/courses\/1\/quizzes\/5/);
  // Canvas's own menus are hidden; Homeroom's top bar and class tabs stay.
  assert.equal(await frame.locator('#header').isHidden(), true);
  assert.equal(await frame.locator('#left-side').isHidden(), true);
  assert.equal(await frame.locator('#breadcrumbs').isHidden(), true);
  assert.equal(await page.locator('.tab', { hasText: 'Classwork' }).count(), 1);
  assert.equal(await page.evaluate(() => window.canvasRan), undefined, 'the tab itself is still Homeroom');
  await shot('20-frame');
  // A Canvas page Homeroom doesn't redraw stays in the frame, and the address bar follows it.
  await frame.locator('#to-history').click();
  await page.waitForURL(/\/courses\/1\/quizzes\/5\/history\?hr=frame/);
  // A link to a page Homeroom redraws comes back out to Homeroom.
  await page.frameLocator('.canvas-frame').locator('#to-modules').click();
  await page.waitForURL(`${ORIGIN}/courses/1/modules`);
  await page.locator('.topic-title').first().waitFor();
});

await check('pages, files and module links open as Homeroom pages', async () => {
  const row = page.locator('.cw-item', { hasText: 'Notes: Convergence tests' });
  await row.locator('.cw-row').click();
  await row.locator('.cw-detail a', { hasText: 'View material' }).click();
  await page.waitForURL(`${ORIGIN}/courses/1/pages/notes`);
  await page.locator('.as-body h2', { hasText: 'Ratio test' }).waitFor();
  await shot('21-page');
  await page.goto(ORIGIN + '/courses/1/modules/items/8', { waitUntil: 'commit' });
  await page.waitForURL(`${ORIGIN}/courses/1/files/77`);
  await page.locator('.file-image').waitFor();
  await page.waitForFunction(() => { const i = document.querySelector('.file-image'); return i && i.complete && i.naturalWidth > 0; });
  assert.match(await page.locator('.file-actions a', { hasText: 'Download' }).getAttribute('href'), /download_frd=1/);
  await page.goto(ORIGIN + '/courses/1/modules/items/10', { waitUntil: 'commit' });
  await page.locator('.canvas-frame').waitFor();
  assert.match(page.url(), /modules\/items\/10\?hr=frame/);
});

await check('Canvas pages Homeroom doesn’t redraw open inside it', async () => {
  await page.locator('.drawer .dr-item', { hasText: 'Inbox' }).click();
  await page.waitForURL(/\/conversations\?hr=frame/);
  await page.frameLocator('.canvas-frame').locator('h1', { hasText: '/conversations' }).waitFor();
  assert.match(await page.locator('.tb-title').textContent(), /Homeroom/);
});

await check('open in Canvas, then switch back', async () => {
  await page.goto(ORIGIN + '/courses/1', { waitUntil: 'commit' });
  await page.locator('.hero h1').waitFor();
  await page.locator('[data-canvas-link]').click();
  await page.waitForURL(/hr=off/);
  await page.locator('#homeroom-pill').waitFor();
  assert.match(await page.locator('#homeroom-pill a').textContent(), /Switch to Homeroom/);
  await page.locator('#homeroom-pill a').click();
  await page.locator('.hero h1').waitFor();
});

await check('turn Homeroom off and on', async () => {
  await page.locator('[data-act=account]').first().click();
  await page.locator('[data-act=turn-off]').click();
  await page.waitForURL(`${ORIGIN}/courses/1`);
  await page.locator('#homeroom-pill').waitFor();
  assert.equal(await page.evaluate(() => window.canvasRan), true);
  assert.match(await page.locator('#homeroom-pill a').textContent(), /Turn Homeroom back on/);
  await page.locator('#homeroom-pill a').click();
  await page.locator('.hero h1').waitFor();
});

await check('phone layout', async () => {
  const phone = await ctx.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  for (const [path, sel, name] of [['/', '.class-card .cc-name', '13-phone-home'], ['/courses/1', '.hero h1', '14-phone-stream'], ['/courses/2/assignments/202', '.work-card', '15-phone-assignment'], ['/calendar', '.day', '16-phone-calendar']]) {
    await phone.goto(ORIGIN + path, { waitUntil: 'commit' });
    await phone.locator(sel).first().waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path} fits the phone`);
    await phone.screenshot({ path: `${SHOTS}${name}.png` });
  }
  await phone.close();
});

assert.deepEqual(errors, []);
await ctx.close();
console.log(`All ${passed} checks passed. Screenshots are in screenshots/.`);
