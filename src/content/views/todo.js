// To-do across every class: Assigned, Missing and Done, grouped by when things are due.
import { allAssignments, courses, statusOf } from '../data.js';
import { esc, I, dueText, startOfWeek, DAY, typeIcon, shortDate } from '../ui.js';

export const TODO_TABS = [
  ['assigned', 'Assigned'],
  ['missing', 'Missing'],
  ['done', 'Done'],
];

const weekBuckets = (now) => {
  const thisWeek = startOfWeek(now).getTime();
  return { thisWeek, nextWeek: thisWeek + 7 * DAY, after: thisWeek + 14 * DAY, lastWeek: thisWeek - 7 * DAY };
};

const group = (tab, a, now) => {
  const b = weekBuckets(now);
  const due = a.due_at ? new Date(a.due_at).getTime() : null;
  if (tab === 'assigned') {
    if (!due) return 'No due date';
    if (due < b.nextWeek) return 'This week';
    if (due < b.after) return 'Next week';
    return 'Later';
  }
  if (tab === 'missing') {
    if (due >= b.thisWeek) return 'This week';
    if (due >= b.lastWeek) return 'Last week';
    return 'Earlier';
  }
  const at = a.submission && a.submission.submitted_at ? new Date(a.submission.submitted_at).getTime() : due;
  if (!at) return 'No due date';
  if (due && a.submission && a.submission.submitted_at && at < due - DAY) return 'Done early';
  if (at >= b.thisWeek) return 'This week';
  if (at >= b.lastWeek) return 'Last week';
  return 'Earlier';
};

const ORDER = {
  assigned: ['No due date', 'This week', 'Next week', 'Later'],
  missing: ['This week', 'Last week', 'Earlier'],
  done: ['No due date', 'Done early', 'This week', 'Last week', 'Earlier'],
};

export const todoTab = (hash) => (hash.split('/')[1] || 'assigned');

export const todoView = async ({ hash, params }) => {
  const tab = todoTab(hash);
  const only = params.get('course') || '';
  const [list, classes] = await Promise.all([allAssignments(), courses()]);
  const now = new Date();
  const rows = list
    .filter((a) => !only || a.course.id === only)
    .filter((a) => {
      const s = statusOf(a, now.getTime());
      return tab === 'done' ? s.key === 'done' : s.key === tab;
    });

  const groups = new Map(ORDER[tab].map((k) => [k, []]));
  rows.forEach((a) => groups.get(group(tab, a, now)).push(a));
  groups.forEach((items) =>
    items.sort((x, y) => {
      const dx = x.due_at ? new Date(x.due_at) : null;
      const dy = y.due_at ? new Date(y.due_at) : null;
      if (!dx || !dy) return dx ? 1 : dy ? -1 : 0;
      return tab === 'assigned' ? dx - dy : dy - dx;
    })
  );

  const firstOpen = [...groups.entries()].find(([, v]) => v.length);
  return `
    <div class="todo">
      <div class="todo-filter">
        <label class="select">
          <select data-act="filter-course" aria-label="Class">
            <option value="">All classes</option>
            ${classes.filter((c) => c.student).map((c) => `<option value="${esc(c.id)}" ${only === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
          ${I.down()}
        </label>
      </div>
      ${[...groups.entries()]
        .map(([label, items]) => {
          const open = items.length && (tab !== 'done' || (firstOpen && firstOpen[0] === label));
          return `
        <section class="todo-group card ${open ? 'open' : ''}">
          <button class="tg-head" data-act="toggle-group" aria-expanded="${!!open}">
            <span>${esc(label)}</span><span class="tg-count">${items.length}</span>${I.down('chev')}
          </button>
          <ul class="tg-list">
            ${items.map((a) => {
              const s = statusOf(a, now.getTime());
              return `<li><a class="todo-row" href="/courses/${esc(a.course.id)}/assignments/${esc(a.id)}" style="--c:${esc(a.course.color)}">
                <span class="type-dot">${typeIcon(a.is_quiz_assignment ? 'quiz' : 'assignment')()}</span>
                <span class="tr-main"><span class="tr-title">${esc(a.name)}</span><span class="tr-class">${esc(a.course.name)}</span>
                  <span class="tr-due">${esc(tab === 'done' && a.submission && a.submission.submitted_at ? `Turned in ${shortDate(new Date(a.submission.submitted_at))}` : dueText(a.due_at))}</span></span>
                ${tab === 'done' ? `<span class="status ${s.cls}">${esc(s.label)}</span>` : ''}
              </a></li>`;
            }).join('') || '<li class="muted pad">Nothing here</li>'}
          </ul>
        </section>`;
        })
        .join('')}
      ${!rows.length ? `<div class="empty-state small"><div class="empty-art">${I.check()}</div><h2>${tab === 'missing' ? 'No missing work' : tab === 'done' ? 'Nothing turned in yet' : 'No work assigned'}</h2><p>${tab === 'assigned' ? 'You’re all caught up.' : ''}</p></div>` : ''}
    </div>`;
};
