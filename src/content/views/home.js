import { courses, planner } from '../data.js';
import { esc, I, avatar, banner, friendlyDay, DAY } from '../ui.js';

const upcomingByCourse = async () => {
  const now = new Date();
  const items = await planner(now, new Date(now.getTime() + 7 * DAY)).catch(() => []);
  const map = new Map();
  items
    .filter((it) => it.course_id && !(it.submissions && (it.submissions.submitted || it.submissions.excused)))
    .filter((it) => !(it.planner_override && it.planner_override.marked_complete))
    .filter((it) => it.plannable_type !== 'announcement' && it.plannable_type !== 'calendar_event')
    .forEach((it) => {
      const id = String(it.course_id);
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(it);
    });
  return map;
};

const card = (c, due) => {
  const list = (due || []).slice(0, 2);
  return `
  <li class="class-card" style="--c:${esc(c.color)}">
    <div class="cc-banner">
      ${banner(c, { compact: true })}
      <a class="cc-title" href="/courses/${esc(c.id)}">
        <span class="cc-name">${esc(c.name)}</span>
        ${c.section ? `<span class="cc-section">${esc(c.section)}</span>` : ''}
      </a>
      ${c.teacher ? `<span class="cc-teacher">${esc(c.teacher)}</span>` : ''}
      <button class="icon-btn cc-more" data-act="card-menu" data-id="${esc(c.id)}" aria-label="Options for ${esc(c.name)}">${I.more()}</button>
    </div>
    <div class="cc-avatar">${c.teacher ? avatar(c.teacher, c.teacherAvatar, 72, '#5f6368') : ''}</div>
    <div class="cc-body">
      ${list.length
        ? list
            .map((it) => {
              const d = new Date(it.plannable_date);
              return `<p class="cc-due">Due ${esc(friendlyDay(d))}</p>
                <a class="cc-work" href="${esc(it.html_url || `/courses/${c.id}`)}">${esc((it.plannable && it.plannable.title) || 'Untitled')}</a>`;
            })
            .join('')
        : ''}
    </div>
    <div class="cc-foot">
      <a class="icon-btn" href="/courses/${esc(c.id)}/grades" title="Your work for ${esc(c.name)}" aria-label="Your work for ${esc(c.name)}">${I.grades()}</a>
      <a class="icon-btn" href="/courses/${esc(c.id)}/files?hr=off" title="Class files" aria-label="Files for ${esc(c.name)}">${I.folder()}</a>
    </div>
  </li>`;
};

export const homeView = async () => {
  const [list, due] = await Promise.all([courses(), upcomingByCourse()]);
  const shown = list.filter((c) => c.onDashboard);
  if (!shown.length) {
    return `<div class="empty-state">
      <div class="empty-art">${I.material()}</div>
      <h2>No classes yet</h2>
      <p>When you’re enrolled in a Canvas course, it shows up here.</p>
    </div>`;
  }
  return `<ul class="class-grid" aria-label="Your classes">${shown.map((c) => card(c, due.get(c.id))).join('')}</ul>`;
};

export const homeTitle = 'Homeroom';
