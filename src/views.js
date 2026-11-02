// HTML for every Quad view. Pure string builders; events live in actions.js.
import { S } from './settings.js';
import { state } from './store.js';
import {
  todoGroups, dueOf, titleOf, isDone, submitted, isNote, itemKey, courseColor,
  studentCourses, gradeChange,
} from './data.js';
import { SCALES, LEVELS, letterOf, pointsFor, computeGpa, neededOnFinal } from './gpa.js';
import { THEMES, PALETTES, FONTS } from './themes.js';
import { timerView } from './timer.js';
import { esc, fmtTime, relTime } from './util.js';

const svg = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const ICONS = {
  refresh: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
};

export const fmtScore = (c) => {
  if (c.hidden || c.score == null) return null;
  const pct = `${Math.round(c.score * 10) / 10}%`;
  const letter = letterOf(c, S.gpaScale);
  return letter ? `${pct} ${letter}` : pct;
};

const loadingBox = () => '<div class="empty"><span class="spin">' + ICONS.refresh + '</span> Loading from Canvas…</div>';
const errorBox = () => (state.error ? `<div class="error" role="alert">${esc(state.error)}</div>` : '');

export const todoCount = () => (state.items ? todoGroups().pending : null);
export const gradeChanges = () => studentCourses().filter((c) => gradeChange(c) !== 0).length;

// ---------- to-do ----------

const itemRow = (it, now) => {
  const p = it.plannable || {};
  const d = dueOf(it);
  const sub = it.submissions || {};
  const done = isDone(it);
  const late = !done && d.getTime() < now;
  const key = itemKey(it);
  const pills = [];
  if (sub.graded) pills.push('<span class="pill ok">Graded</span>');
  else if (sub.submitted) pills.push('<span class="pill ok">Submitted</span>');
  if (sub.excused) pills.push('<span class="pill">Excused</span>');
  if (sub.missing) pills.push('<span class="pill bad">Missing</span>');
  if (sub.late) pills.push('<span class="pill bad">Late</span>');
  if (sub.has_feedback) pills.push('<span class="pill">Feedback</span>');
  if (it.plannable_type === 'quiz') pills.push('<span class="pill">Quiz</span>');
  if (it.plannable_type === 'discussion_topic') pills.push('<span class="pill">Discussion</span>');
  if (it.plannable_type === 'calendar_event') pills.push('<span class="pill">Event</span>');
  const color = courseColor(it.course_id);
  const when = S.relativeDates ? `${relTime(d, now)} · ${fmtTime(d, S.clock24)}` : fmtTime(d, S.clock24);
  const title = titleOf(it);
  const context = it.context_name || (isNote(it) ? 'My to-do' : '');
  return `
    <div class="row ${done ? 'done' : ''} ${late ? 'late' : ''}">
      <input type="checkbox" class="check" id="i-${esc(key)}" data-item="${esc(key)}" ${done ? 'checked' : ''}
        ${submitted(it) ? 'disabled title="Already turned in"' : ''} aria-label="Mark ${esc(title)} done">
      <div class="body">
        <a class="title" href="${esc(it.html_url || '/calendar')}">${esc(title)}</a>
        <div class="meta">
          <span class="dot" ${color ? `style="background:${esc(color)}"` : ''}></span>
          ${context ? `<span class="ctx">${esc(context)}</span><span aria-hidden="true">·</span>` : ''}
          <span>${esc(when)}</span>
          ${p.points_possible ? `<span aria-hidden="true">·</span><span>${esc(p.points_possible)} pts</span>` : ''}
          ${pills.join('')}
        </div>
      </div>
      ${isNote(it) ? `<button class="icon sm" data-act="del-note" data-item="${esc(key)}" title="Delete to-do" aria-label="Delete ${esc(title)}">${ICONS.trash}</button>` : ''}
    </div>`;
};

const courseOptions = (selected, { all = false, none = false } = {}) =>
  (all ? `<option value="all" ${selected === 'all' ? 'selected' : ''}>All courses</option>` : '') +
  (none ? `<option value="" ${!selected ? 'selected' : ''}>No course</option>` : '') +
  (state.courses || [])
    .map((c) => `<option value="${esc(c.id)}" ${selected === c.id ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');

const addForm = () => {
  const today = new Date();
  const iso = new Date(today.getTime() - today.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  return `
    <form class="add" data-form="add-todo">
      <input id="add-title" name="title" required placeholder="What do you need to do?" autocomplete="off" aria-label="To-do title">
      <div class="add-row">
        <input id="add-date" name="date" type="date" value="${iso}" aria-label="Date">
        <select id="add-course" name="course" aria-label="Course">${courseOptions('', { none: true })}</select>
      </div>
      <div class="add-row end">
        <button type="button" class="btn ghost" data-act="add-cancel">Cancel</button>
        <button type="submit" class="btn">Add to-do</button>
      </div>
      <p class="hint">Saved to your Canvas planner, so it shows up in the Canvas app too.</p>
    </form>`;
};

const todoList = ({ course = 'all', limit = Infinity } = {}) => {
  const now = Date.now();
  const g = todoGroups({ course, now });
  let html = '';
  let shown = 0;
  const take = (list) => {
    const room = Math.max(0, limit - shown);
    const part = list.slice(0, room);
    shown += part.length;
    return part.map((it) => itemRow(it, now)).join('');
  };
  if (g.overdue.length && shown < limit) {
    html += `<div class="group overdue">Overdue · ${g.overdue.length}</div>${take(g.overdue)}`;
  }
  g.days.forEach((list, label) => {
    if (shown >= limit) return;
    html += `<div class="group">${esc(label)}</div>${take(list)}`;
  });
  if (!g.overdue.length && !g.days.size) {
    html += `<div class="empty">Nothing due in the next ${esc(S.days)} days. Enjoy it.</div>`;
  }
  return { html, more: g.overdue.length + [...g.days.values()].reduce((n, l) => n + l.length, 0) - shown };
};

export const renderTodo = () => {
  if (!state.items) return errorBox() + loadingBox();
  const { html } = todoList({ course: S.todoCourse });
  return `
    ${errorBox()}
    <div class="toolbar">
      <select id="todo-course" data-setting="todoCourse" aria-label="Filter by course">${courseOptions(S.todoCourse, { all: true })}</select>
      <button class="btn sm" data-act="add-open">${ICONS.plus} Add</button>
    </div>
    ${state.ui.adding ? addForm() : ''}
    ${html}`;
};

export const renderEmbed = () => {
  let html = '';
  if (S.betterTodo) {
    const n = todoCount();
    html += `<div class="embed-head"><b>To-do</b>${n ? `<span class="count">${n}</span>` : ''}<span class="grow"></span>
      <button class="btn sm ghost" data-act="add-open-panel">${ICONS.plus} Add</button></div>`;
    if (!state.items) html += loadingBox();
    else {
      const { html: list, more } = todoList({ limit: 8 });
      html += list;
      if (more > 0) html += `<button class="btn link block" data-act="open-panel" data-tab="todo">Show ${more} more in Quad</button>`;
    }
  }
  if (S.dashNotes) {
    html += `<div class="embed-head"><b>Notes</b></div>
      <textarea class="notes small" data-notes aria-label="Notes" placeholder="Jot something down…">${esc(S.notes)}</textarea>`;
  }
  return html;
};

// ---------- grades ----------

export const renderGrades = () => {
  if (!state.courses) return errorBox() + loadingBox();
  const list = studentCourses();
  if (!list.length) return errorBox() + '<div class="empty">No active courses where you’re a student.</div>';
  const scored = list.filter((c) => c.score != null && !c.hidden);
  const avg = scored.length ? scored.reduce((n, c) => n + c.score, 0) / scored.length : null;
  const changes = gradeChanges();
  let html = errorBox();
  html += `<div class="summary">
    <div><b>${avg == null ? '—' : `${avg.toFixed(1)}%`}</b><span>Average of ${scored.length} class${scored.length === 1 ? '' : 'es'}</span></div>
    ${changes ? `<button class="btn sm" data-act="mark-seen">Mark ${changes} change${changes === 1 ? '' : 's'} seen</button>` : ''}
  </div>`;
  html += list
    .map((c) => {
      const s = fmtScore(c);
      const pct = s ? Math.max(0, Math.min(100, c.score)) : 0;
      const color = courseColor(c.id);
      const d = gradeChange(c);
      return `
      <a class="course" href="/courses/${esc(c.id)}/grades">
        <div class="body">
          <div class="name">${esc(c.name)}</div>
          <div class="bar"><i style="width:${pct}%;${color ? `background:${esc(color)}` : ''}"></i></div>
        </div>
        ${d ? `<span class="delta ${d > 0 ? 'up' : 'down'}" title="Since you last checked">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}</span>` : ''}
        <div class="score">${s ? esc(`${Math.round(c.score * 10) / 10}%`) : '—'}<small>${s ? esc(letterOf(c, S.gpaScale) || '') : c.hidden ? 'Hidden' : 'No grade'}</small></div>
      </a>`;
    })
    .join('');
  return html;
};

// ---------- gpa ----------

const gpaCfg = (id) => Object.assign({ credits: 1, weight: 0, skip: false, whatIf: '' }, S.gpa[id]);

export const renderGpa = () => {
  if (!state.courses) return errorBox() + loadingBox();
  const list = studentCourses();
  const gpa = computeGpa(list, S.gpa, S.gpaScale, { gpa: S.pastGpa, credits: S.pastCredits, weighted: S.cumWeighted });
  const f = (n) => (n == null ? '—' : n.toFixed(2));
  const letters = SCALES[S.gpaScale] ? SCALES[S.gpaScale].rows.map((r) => r[1]) : [];
  let html = errorBox();
  html += `
    <div class="stats">
      <div class="stat"><b>${f(gpa && gpa.unweighted)}</b><span>Unweighted</span></div>
      <div class="stat"><b>${f(gpa && gpa.weighted)}</b><span>Weighted</span></div>
      <div class="stat"><b>${f(gpa && gpa.cumulative)}</b><span>Cumulative</span></div>
    </div>
    <div class="toolbar">
      <select id="gpa-scale" data-setting="gpaScale" aria-label="Grading scale">
        ${Object.entries(SCALES).map(([k, v]) => `<option value="${k}" ${S.gpaScale === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}
      </select>
    </div>
    <div class="gpa-cols"><span></span><span>Course</span><span>Credits</span><span>Level</span><span>What if</span></div>`;
  html += list
    .map((c) => {
      const g = gpaCfg(c.id);
      const pts = c.hidden && !g.whatIf ? null : pointsFor(c, S.gpaScale, g.whatIf);
      const graded = pts != null;
      return `
      <div class="gpa-row ${g.skip || !graded ? 'skip' : ''}">
        <input type="checkbox" id="g-skip-${esc(c.id)}" data-gpa="skip" data-course="${esc(c.id)}" ${g.skip ? '' : 'checked'} aria-label="Count ${esc(c.name)}">
        <div class="cell">
          <div class="name">${esc(c.name)}</div>
          <div class="sub">${graded ? `${esc(g.whatIf || letterOf(c, S.gpaScale))} · ${pts.toFixed(1)} pts${g.whatIf ? ' (what-if)' : ''}` : 'No grade yet'}</div>
        </div>
        <input type="number" id="g-cr-${esc(c.id)}" min="0" max="20" step="0.5" value="${esc(g.credits)}" data-gpa="credits" data-course="${esc(c.id)}" aria-label="Credits for ${esc(c.name)}">
        <select id="g-lv-${esc(c.id)}" data-gpa="weight" data-course="${esc(c.id)}" aria-label="Level for ${esc(c.name)}">
          ${LEVELS.map(([v, l]) => `<option value="${v}" ${g.weight === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <select id="g-wi-${esc(c.id)}" data-gpa="whatIf" data-course="${esc(c.id)}" aria-label="What-if grade for ${esc(c.name)}">
          <option value="">Live</option>
          ${letters.map((l) => `<option ${g.whatIf === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>`;
    })
    .join('');
  html += `
    <div class="sect">Past semesters</div>
    <div class="past">
      <label>GPA so far<input id="past-gpa" type="number" min="0" max="5" step="0.01" data-setting="pastGpa" value="${esc(S.pastGpa)}" placeholder="3.60"></label>
      <label>Credits so far<input id="past-cr" type="number" min="0" step="0.5" data-setting="pastCredits" value="${esc(S.pastCredits)}" placeholder="30"></label>
      <label class="inline"><input id="cum-w" type="checkbox" data-setting="cumWeighted" ${S.cumWeighted ? 'checked' : ''}> Combine with weighted GPA</label>
    </div>
    <p class="note">Uses each course’s current Canvas grade. Honors adds 0.5 and AP/IB adds 1.0 to the weighted GPA. Use “What if” to try out grades. This is an estimate, not your official transcript.</p>`;
  return html;
};

// ---------- tools ----------

const finalCalc = () => {
  const f = state.ui.final;
  const need = neededOnFinal(Number(f.current), Number(f.weight), Number(f.target));
  let msg = 'Enter your current grade, how much the final counts and the grade you want.';
  let cls = '';
  if (f.current !== '' && need != null && isFinite(need)) {
    if (need > 100) {
      msg = `You’d need ${need.toFixed(1)}% on the final. That’s above 100%, so aim for extra credit too.`;
      cls = 'bad';
    } else if (need <= 0) {
      msg = 'You’re safe: even a 0 on the final keeps that grade.';
      cls = 'ok';
    } else {
      msg = `You need <b>${need.toFixed(1)}%</b> on the final.`;
      cls = need > 90 ? 'warn' : 'ok';
    }
  }
  return `
    <div class="final">
      <label class="wide">Course
        <select id="final-course" data-final="course">${courseOptions(f.course, { none: true }).replace('No course', 'Type it in')}</select>
      </label>
      <label>Current grade %<input id="final-current" type="number" step="0.1" data-final="current" value="${esc(f.current)}" placeholder="86.5"></label>
      <label>Final is worth %<input id="final-weight" type="number" step="1" min="1" max="100" data-final="weight" value="${esc(f.weight)}"></label>
      <label>Grade I want %<input id="final-target" type="number" step="0.1" data-final="target" value="${esc(f.target)}"></label>
      <p class="result ${cls}" aria-live="polite">${msg}</p>
    </div>`;
};

export const renderTools = () => `
  <div class="sect">Study timer</div>
  ${timerView()}
  <div class="sect">Final exam calculator</div>
  ${finalCalc()}
  <div class="sect">Notes</div>
  <textarea class="notes" id="notes" data-notes aria-label="Notes" placeholder="Anything you want to remember. Saved in this browser.">${esc(S.notes)}</textarea>
  <div class="sect">Calendar</div>
  <div class="pad">
    <p class="hint">Download everything due in the next ${esc(S.days)} days as a calendar file for Google Calendar, Apple Calendar or Outlook.</p>
    <button class="btn" data-act="export-ics">Download .ics file</button>
  </div>`;

// ---------- settings ----------

const toggle = (key, title, sub = '') => `
  <label class="setting" for="s-${key}">
    <div class="body"><div>${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <input type="checkbox" class="switch" id="s-${key}" data-setting="${key}" ${S[key] ? 'checked' : ''}>
  </label>`;

const choose = (key, title, sub, options, num = false) => `
  <label class="setting" for="s-${key}">
    <div class="body"><div>${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
    <select id="s-${key}" data-setting="${key}" ${num ? 'data-num' : ''}>
      ${options.map(([v, l]) => `<option value="${esc(v)}" ${String(S[key]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}
    </select>
  </label>`;

const colorRow = (key, title, sub) => `
  <div class="setting">
    <div class="body"><div>${title}</div><div class="sub">${sub}</div></div>
    <input type="color" id="s-${key}" data-setting="${key}" value="${esc(S[key] || '#394b58')}" aria-label="${esc(title)}">
    ${S[key] ? `<button class="btn sm ghost" data-act="clear" data-key="${key}">Reset</button>` : ''}
  </div>`;

const SET_TABS = [
  ['look', 'Look'],
  ['dashboard', 'Dashboard'],
  ['courses', 'Courses'],
  ['todo', 'To-do'],
  ['more', 'More'],
];

const lookSettings = () => `
  <div class="sect">Themes</div>
  <div class="themes">
    ${THEMES.map((t) => {
      const pal = t.palette ? PALETTES[t.palette].colors.slice(0, 4) : ['#d0d5da', '#b6bec6', '#9aa5b0', '#7d8994'];
      return `<button class="theme ${S.theme === t.id ? 'on' : ''}" data-act="theme" data-id="${t.id}" aria-pressed="${S.theme === t.id}">
        <span class="swatch" style="--nav:${t.nav || '#394b58'};--acc:${t.accent || '#2b6cde'}">
          <i></i><span>${pal.map((c) => `<em style="background:${c}"></em>`).join('')}</span>
        </span>
        <span class="tname">${esc(t.name)}${t.dark ? ' · dark' : ''}</span>
      </button>`;
    }).join('')}
  </div>
  <label class="setting inline-check" for="s-themeRecolor">
    <input type="checkbox" id="s-themeRecolor" data-setting="themeRecolor" ${S.themeRecolor ? 'checked' : ''}>
    <div class="body"><div>Recolor my course cards with the theme</div><div class="sub">Saves the colors to your Canvas account.</div></div>
  </label>
  <div class="sect">Dark mode</div>
  ${choose('darkMode', 'Dark mode', '', [['off', 'Off'], ['on', 'On'], ['device', 'Match my device'], ['schedule', 'On a schedule']])}
  ${S.darkMode === 'schedule' ? `
  <div class="setting">
    <div class="body"><div>Schedule</div><div class="sub">Dark between these times.</div></div>
    <input type="time" id="s-darkFrom" data-setting="darkFrom" value="${esc(S.darkFrom)}" aria-label="Dark from">
    <input type="time" id="s-darkTo" data-setting="darkTo" value="${esc(S.darkTo)}" aria-label="Dark until">
  </div>` : ''}
  ${choose('darkLevel', 'Darkness', 'Dim is softer, Black is best for OLED screens.', [['dim', 'Dim'], ['dark', 'Dark'], ['black', 'Black']])}
  <div class="sect">Colors and font</div>
  ${choose('font', 'Font', 'Changes the text font across Canvas.', FONTS.map(([v, l]) => [v, l]))}
  ${colorRow('navColor', 'Sidebar color', 'The left navigation bar.')}
  ${colorRow('accent', 'Accent color', 'Buttons, links and Quad itself.')}
  <div class="sect">Course card palettes</div>
  <p class="hint pad">Colors every course in order. Saved to your Canvas account, so they show up in the Canvas app too.</p>
  <div class="palettes">
    ${Object.entries(PALETTES).map(([id, p]) => `
      <button class="palette-btn" data-act="palette-apply" data-id="${id}" title="Apply ${esc(p.name)}">
        <span class="chips">${p.colors.map((c) => `<em style="background:${c}"></em>`).join('')}</span>
        <span>${esc(p.name)}</span>
      </button>`).join('')}
  </div>`;

const dashboardSettings = () => `
  <div class="sect">Course cards</div>
  ${toggle('cardGrades', 'Show grades on cards', 'Your current score and letter on each card.')}
  ${toggle('cardAssignments', 'Show upcoming work on cards', 'What’s due next for each class, right on its card.')}
  ${S.cardAssignments ? choose('cardAssignmentCount', 'Items per card', '', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], true) : ''}
  ${choose('cardStyle', 'Card style', 'Course pictures, solid color or a gradient.', [['default', 'Pictures'], ['solid', 'Solid color'], ['gradient', 'Gradient']])}
  ${choose('cardRadius', 'Corners', '', [['', 'Canvas default'], [0, 'Square'], [12, 'Rounded'], [22, 'Extra round']])}
  ${toggle('condensedCards', 'Compact cards', 'Shorter cards so more fit on screen.')}
  <div class="sect">Page</div>
  ${toggle('betterTodo', 'Quad to-do in the sidebar', 'Replaces Canvas’s To Do list on the dashboard.')}
  ${toggle('dashNotes', 'Notes on the dashboard', 'Your Quad notes in the dashboard sidebar.')}
  ${toggle('hideFeedback', 'Hide “Recent Feedback”', '')}
  ${toggle('fullWidth', 'Full width', 'Use the whole screen on wide monitors.')}
  ${toggle('hideLogo', 'Hide school logo', 'Removes the logo at the top of the left bar.')}`;

const coursesSettings = () => {
  if (!state.courses) return loadingBox();
  return `
    <p class="hint pad">Nicknames and colors save to your Canvas account. Card pictures are stored in this browser only: paste a link to any image.</p>
    ${state.courses.map((c) => {
      const color = courseColor(c.id) || '#394b58';
      const img = (S.cards[c.id] && S.cards[c.id].image) || '';
      return `
      <div class="course-edit">
        <input type="color" id="c-color-${esc(c.id)}" value="${esc(color)}" data-course-color="${esc(c.id)}" aria-label="Color for ${esc(c.name)}">
        <div class="cell">
          <input id="c-nick-${esc(c.id)}" class="nick" value="${esc(c.name)}" data-course-nick="${esc(c.id)}" aria-label="Nickname for ${esc(c.originalName)}" title="${esc(c.originalName)}">
          <input id="c-img-${esc(c.id)}" class="img" value="${esc(img)}" data-course-img="${esc(c.id)}" placeholder="Card picture URL (optional)" aria-label="Card picture for ${esc(c.name)}">
        </div>
      </div>`;
    }).join('')}`;
};

const todoSettings = () => `
  <div class="sect">List</div>
  ${choose('days', 'Look ahead', 'How far into the future to show.', [[7, '1 week'], [14, '2 weeks'], [30, '1 month'], [60, '2 months']], true)}
  ${toggle('showOverdue', 'Show overdue work', 'Unfinished work from the last two weeks.')}
  ${toggle('hideDone', 'Hide finished items', 'Hide turned-in and checked-off work.')}
  ${toggle('relativeDates', 'Relative times', 'Show “in 3h” next to due times.')}
  ${toggle('clock24', '24-hour clock', '')}
  <div class="sect">Reminders</div>
  ${toggle('reminders', 'Due-soon reminders', 'A heads-up when you open Quad and something is due soon.')}
  ${S.reminders ? choose('remindHours', 'Remind me about work due within', '', [[3, '3 hours'], [6, '6 hours'], [12, '12 hours'], [24, '24 hours'], [48, '2 days']], true) : ''}
  ${toggle('desktopNotify', 'Desktop notifications', 'Pop-ups an hour before things are due, while Quad is running.')}`;

const moreSettings = () => `
  <div class="sect">Running Quad</div>
  ${toggle('stayOn', 'Stay on while I browse <span class="pill">Beta</span>', 'Keeps Quad running as you click around Canvas, so you don’t have to click the bookmark on every page.')}
  ${choose('side', 'Panel side', '', [['right', 'Right'], ['left', 'Left']])}
  ${toggle('wide', 'Wide panel', '')}
  <div class="sect">Keyboard shortcuts</div>
  <div class="keys">
    <div><kbd>Ctrl</kbd> <kbd>K</kbd><span>Jump to any course, page or assignment (<kbd>⌘</kbd> <kbd>K</kbd> on Mac)</span></div>
    <div><kbd>Alt</kbd> <kbd>Q</kbd><span>Show or hide Quad</span></div>
    <div><kbd>Esc</kbd><span>Close Quad or the search box</span></div>
  </div>
  <div class="sect">Backup</div>
  <div class="pad stack">
    <p class="hint">Move your Quad settings to another browser or computer.</p>
    <div class="btns">
      <button class="btn" data-act="export-settings">Copy settings</button>
      <button class="btn ghost" data-act="import-open">Paste settings</button>
    </div>
    ${state.ui.importing ? `<textarea id="import-box" class="notes small" placeholder="Paste copied Quad settings here"></textarea>
      <div class="btns"><button class="btn" data-act="import-apply">Import</button><button class="btn ghost" data-act="import-cancel">Cancel</button></div>` : ''}
  </div>
  <div class="sect">Reset</div>
  <div class="pad stack">
    ${state.ui.confirmReset
      ? `<p class="hint">This clears every Quad setting and your notes in this browser. Course colors and nicknames in Canvas stay.</p>
         <div class="btns"><button class="btn danger" data-act="reset-all">Yes, reset Quad</button><button class="btn ghost" data-act="reset-cancel">Keep my settings</button></div>`
      : '<button class="btn ghost" data-act="reset-ask">Reset all Quad settings</button>'}
  </div>
  <p class="note">Quad 2 · runs only in your Canvas tab and only talks to ${esc(location.host)}. Settings are saved in this browser.</p>`;

export const renderSettings = () => {
  const view = { look: lookSettings, dashboard: dashboardSettings, courses: coursesSettings, todo: todoSettings, more: moreSettings }[S.setTab] || lookSettings;
  return `
    <div class="subtabs" role="tablist" aria-label="Settings sections">
      ${SET_TABS.map(([k, l]) => `<button role="tab" class="subtab" data-settab="${k}" aria-selected="${S.setTab === k}">${l}</button>`).join('')}
    </div>
    ${view()}`;
};
