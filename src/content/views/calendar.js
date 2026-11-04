// Week calendar of everything due, color-coded by class.
import { courses, planner } from '../data.js';
import { esc, I, startOfWeek, DAY, dayDiff, time, typeIcon } from '../ui.js';
import { framed } from '../router.js';

const weekOf = (params) => {
  const w = params.get('week');
  const d = w ? new Date(`${w}T12:00:00`) : new Date();
  return startOfWeek(isNaN(d) ? new Date() : d);
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const calendarRange = (params) => {
  const start = weekOf(params);
  const end = new Date(start.getTime() + 7 * DAY);
  const sameMonth = start.getMonth() === new Date(end - DAY).getMonth();
  const fmt = (d, opts) => d.toLocaleDateString(undefined, opts);
  return sameMonth
    ? `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(new Date(end - DAY), { day: 'numeric' })}, ${start.getFullYear()}`
    : `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(new Date(end - DAY), { month: 'short', day: 'numeric' })}, ${new Date(end - DAY).getFullYear()}`;
};

export const calendarView = async ({ params }) => {
  const start = weekOf(params);
  const end = new Date(start.getTime() + 7 * DAY);
  const only = params.get('course') || '';
  const [classes, items] = await Promise.all([courses(), planner(start, end, only || null)]);
  const byId = new Map(classes.map((c) => [c.id, c]));
  const days = [...Array(7)].map((_, i) => new Date(start.getTime() + i * DAY));
  const buckets = days.map(() => []);
  items
    .filter((it) => it.plannable_type !== 'announcement')
    .filter((it) => !only || String(it.course_id) === only)
    .forEach((it) => {
      const d = new Date(it.plannable_date);
      const i = Math.floor((d - start) / DAY);
      if (i >= 0 && i < 7) buckets[i].push(it);
    });
  buckets.forEach((b) => b.sort((x, y) => new Date(x.plannable_date) - new Date(y.plannable_date)));

  const prev = ymd(new Date(start.getTime() - 7 * DAY));
  const next = ymd(end);
  const q = (week) => `?week=${week}${only ? `&course=${only}` : ''}`;

  return `
    <div class="calendar">
      <div class="cal-bar">
        <label class="select">
          <select data-act="filter-course" aria-label="Class">
            <option value="">All classes</option>
            ${classes.map((c) => `<option value="${esc(c.id)}" ${only === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
          ${I.down()}
        </label>
        <div class="cal-nav">
          <a class="icon-btn" href="/calendar${q(prev)}" aria-label="Previous week">${I.left()}</a>
          <h2>${esc(calendarRange(params))}</h2>
          <a class="icon-btn" href="/calendar${q(next)}" aria-label="Next week">${I.right()}</a>
          <a class="pill-btn" href="/calendar${only ? `?course=${only}` : ''}">Today</a>
        </div>
      </div>
      <div class="week" role="grid">
        ${days.map((d, i) => {
          const today = dayDiff(d) === 0;
          return `
          <div class="day ${today ? 'today' : ''}" role="gridcell">
            <div class="day-head"><span>${esc(d.toLocaleDateString(undefined, { weekday: 'short' }))}</span><b>${d.getDate()}</b></div>
            <div class="day-items">
              ${buckets[i].map((it) => {
                const c = byId.get(String(it.course_id));
                const color = c ? c.color : '#5f6368';
                const href = it.plannable_type === 'assignment' && it.course_id
                  ? `/courses/${it.course_id}/assignments/${it.plannable_id}`
                  : it.html_url || framed('/calendar');
                const done = (it.submissions && it.submissions.submitted) || (it.planner_override && it.planner_override.marked_complete);
                return `<a class="cal-item ${done ? 'done' : ''}" href="${esc(href)}" style="--c:${esc(color)}" title="${esc((it.plannable && it.plannable.title) || '')}">
                  ${typeIcon(it.plannable_type)()}<span class="ci-title">${esc((it.plannable && it.plannable.title) || 'Untitled')}</span>
                  <span class="ci-time">${esc(time(new Date(it.plannable_date)))}${c ? ` · ${esc(c.name)}` : ''}</span></a>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
};
