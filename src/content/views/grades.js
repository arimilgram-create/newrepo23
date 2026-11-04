// "Your work": every assignment in a class with its status and grade.
import { course, assignments, statusOf, self, fmtNum } from '../data.js';
import { esc, I, avatar, dueText, typeIcon } from '../ui.js';
import { assignmentHref, framed } from '../router.js';

const FILTERS = [
  ['all', 'All'],
  ['assigned', 'Assigned'],
  ['graded', 'Returned with grade'],
  ['missing', 'Missing'],
];

export const gradesView = async ({ courseId, params }) => {
  const [c, work, me] = await Promise.all([course(courseId), assignments(courseId), self()]);
  const filter = params.get('show') || 'all';
  const all = work.filter((a) => a.published !== false).map((a) => ({ a, s: statusOf(a) }));
  const keep = (k) => ({ s }) => k === 'all' || (k === 'graded' ? s.graded : s.key === k);
  const rows = all
    .filter(keep(filter))
    .sort((x, y) => new Date(y.a.due_at || y.a.created_at || 0) - new Date(x.a.due_at || x.a.created_at || 0));

  const overall = !c.hideGrades && c.score != null ? `${fmtNum(c.score)}%${c.grade ? ` · ${c.grade}` : ''}` : null;

  return `
    <div class="your-work" style="--c:${esc(c.color)}">
      <header class="yw-head">
        ${avatar(me.name, me.avatar_url, 56)}
        <div class="yw-who">
          <h1>${esc(me.name)}</h1>
          <p class="muted">${esc(c.name)}</p>
        </div>
        <div class="yw-overall">
          <span class="muted">Overall grade</span>
          <b>${esc(overall || '—')}</b>
        </div>
      </header>
      <div class="yw-layout">
      <nav class="yw-filters" aria-label="Show">
        ${FILTERS.map(([k, l]) => `<a class="yw-filter ${filter === k ? 'on' : ''}" ${filter === k ? 'aria-current="true"' : ''} href="?show=${k}"><span>${l}</span><span class="n">${all.filter(keep(k)).length}</span></a>`).join('')}
      </nav>
      <ul class="work-list">
        ${rows.length
          ? rows
              .map(({ a, s }) => `
            <li>
              <a class="work-row" href="${esc(assignmentHref(c.id, a))}">
                <span class="type-dot">${typeIcon(a.is_quiz_assignment ? 'quiz' : a.discussion_topic ? 'discussion_topic' : 'assignment')()}</span>
                <span class="wr-main">
                  <span class="wr-title">${esc(a.name)}</span>
                  <span class="wr-sub">${esc(dueText(a.due_at))}</span>
                </span>
                <span class="status ${s.cls}">${esc(s.label)}</span>
              </a>
            </li>`)
              .join('')
          : `<li class="muted pad">Nothing to show here.</li>`}
      </ul>
      </div>
      <p class="muted fine">Grades come straight from Canvas. <a href="${esc(framed(`/courses/${c.id}/grades`))}">See the full Canvas grade book</a> for weights and comments.</p>
    </div>`;
};

export const gradesIcon = I.grades;
