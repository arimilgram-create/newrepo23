import { course, modules, assignments, assignmentGroups, statusOf } from '../data.js';
import { esc, I, typeIcon, shortDate, postedText } from '../ui.js';
import { plainText } from '../sanitize.js';
import { hrefFor, framed, assignmentHref } from '../router.js';

const ASSIGNABLE = new Set(['Assignment', 'Quiz', 'Discussion']);

const itemRow = (c, it, a) => {
  const isWork = ASSIGNABLE.has(it.type) || !!a;
  const due = (a && a.due_at) || (it.content_details && it.content_details.due_at);
  const href = a ? assignmentHref(c.id, a) : hrefFor(c.id, it.type, it);
  const native = !a;
  const status = a ? statusOf(a) : null;
  const locked = it.content_details && it.content_details.locked_for_user;
  const right = due ? `Due ${shortDate(new Date(due))}` : a && a.created_at ? `Posted ${postedText(a.created_at)}` : '';
  return `
    <li class="cw-item ${isWork ? 'work' : 'material'}">
      <button class="cw-row" data-act="expand" aria-expanded="false">
        <span class="type-dot ${isWork ? '' : 'grey'}">${locked ? I.lock() : typeIcon(it.type)()}</span>
        <span class="cw-title">${esc(it.title)}</span>
        <span class="cw-due">${esc(right)}</span>
      </button>
      <div class="cw-detail" hidden>
        <div class="cw-meta">
          ${a && a.created_at ? `<span>Posted ${esc(postedText(a.created_at))}</span>` : ''}
          ${status ? `<span class="status ${status.cls}">${esc(status.label)}</span>` : ''}
          ${a && a.points_possible ? `<span>${esc(a.points_possible)} points</span>` : ''}
        </div>
        ${a && a.description ? `<p class="cw-desc">${esc(plainText(a.description))}</p>` : ''}
        <a class="text-btn" href="${esc(href)}" ${native && it.type === 'ExternalUrl' ? 'target="_blank" rel="noopener"' : ''}>
          ${a ? 'View instructions' : it.type === 'ExternalUrl' ? 'Open link' : 'View material'}
        </a>
      </div>
    </li>`;
};

const topicBlock = (c, id, title, items, byId, note = '') => `
  <section class="topic" id="topic-${esc(id)}">
    <h2 class="topic-title">${esc(title)}</h2>
    ${note ? `<p class="muted topic-note">${I.lock()} ${esc(note)}</p>` : ''}
    <ul class="cw-list">
      ${items
        .map((it) => {
          if (it.type === 'SubHeader') return `<li class="cw-sub">${esc(it.title)}</li>`;
          const a = it.type === 'Assignment' || it.type === 'Quiz' || it.type === 'Discussion'
            ? byId.get(String(it.content_id)) || [...byId.values()].find((x) => x.quiz_id === it.content_id || (x.discussion_topic && x.discussion_topic.id === it.content_id))
            : null;
          return itemRow(c, it, a);
        })
        .join('') || '<li class="muted cw-empty">Nothing here yet</li>'}
    </ul>
  </section>`;

export const classworkView = async ({ courseId }) => {
  const [c, mods, work] = await Promise.all([course(courseId), modules(courseId), assignments(courseId)]);
  const byId = new Map(work.map((a) => [String(a.id), a]));
  let topics = [];

  if (mods.length) {
    topics = mods.map((m) => ({
      id: m.id,
      title: m.name,
      items: (m.items || []).filter((it) => it.published !== false),
      note: m.state === 'locked' ? 'Locked until your teacher opens it' : '',
    }));
  } else {
    const groups = await assignmentGroups(courseId);
    topics = groups.map((g) => ({
      id: g.id,
      title: g.name,
      items: (g.assignments || []).map((a) => {
        byId.set(String(a.id), byId.get(String(a.id)) || a);
        return { type: 'Assignment', title: a.name, content_id: a.id };
      }),
    }));
  }

  return `
    <div class="classwork" style="--c:${esc(c.color)}">
      <div class="cw-actions">
        <a class="pill-btn" href="/courses/${esc(c.id)}/grades">${I.grades()} View your work</a>
        <a class="pill-btn" href="/calendar?course=${esc(c.id)}">${I.calendar()} Calendar</a>
        <a class="pill-btn" href="${esc(framed(`/courses/${c.id}/files`))}">${I.folder()} Class files</a>
      </div>
      <div class="cw-layout">
        ${topics.length > 1 ? `
        <nav class="topic-nav" aria-label="Topics">
          <a class="topic-link on" href="#" data-act="topic" data-id="all">All topics</a>
          ${topics.map((t) => `<a class="topic-link" href="#topic-${esc(t.id)}" data-act="topic" data-id="${esc(t.id)}">${esc(t.title)}</a>`).join('')}
        </nav>` : ''}
        <div class="topics">
          ${topics.length
            ? topics.map((t) => topicBlock(c, t.id, t.title, t.items, byId, t.note)).join('')
            : `<div class="empty-state small"><div class="empty-art">${I.assignment()}</div><h2>No classwork yet</h2><p>Your teacher hasn’t posted anything.</p></div>`}
        </div>
      </div>
    </div>`;
};
