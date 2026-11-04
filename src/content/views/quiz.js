// Classic Canvas quizzes: details and your attempts here, the quiz itself in Homeroom's frame view.
import { course, quiz, quizAttempts, fmtNum } from '../data.js';
import { esc, I, dueText, shortDate } from '../ui.js';
import { clean } from '../sanitize.js';
import { framed } from '../router.js';
import { detailHead, byline } from './detail.js';

const statusFor = (q, attempts) => {
  const done = attempts.filter((a) => a.finished_at);
  const going = attempts.find((a) => a.workflow_state === 'untaken' && !a.finished_at);
  if (going) return { label: 'In progress', cls: 'assigned' };
  if (done.length) {
    const best = done.reduce((m, a) => Math.max(m, a.kept_score != null ? a.kept_score : a.score || 0), 0);
    return q.points_possible ? { label: `${fmtNum(best)}/${fmtNum(q.points_possible)}`, cls: 'graded' } : { label: 'Turned in', cls: 'turned' };
  }
  if (q.due_at && new Date(q.due_at) < new Date()) return { label: 'Missing', cls: 'missing' };
  return { label: 'Assigned', cls: 'assigned' };
};

export const quizView = async ({ courseId, itemId }) => {
  const [c, q, attempts] = await Promise.all([course(courseId), quiz(courseId, itemId), quizAttempts(courseId, itemId)]);
  const s = statusFor(q, attempts);
  const finished = attempts.filter((a) => a.finished_at);
  const left = q.allowed_attempts < 0 ? Infinity : (q.allowed_attempts || 1) - finished.length;
  const going = attempts.find((a) => a.workflow_state === 'untaken' && !a.finished_at);
  const facts = [
    q.question_count ? `${q.question_count} question${q.question_count === 1 ? '' : 's'}` : '',
    q.time_limit ? `${q.time_limit} minute time limit` : 'No time limit',
    q.allowed_attempts < 0 ? 'Unlimited attempts' : `${q.allowed_attempts || 1} attempt${(q.allowed_attempts || 1) === 1 ? '' : 's'} allowed`,
  ].filter(Boolean);
  const open = framed(`/courses/${c.id}/quizzes/${q.id}`);
  let action = '';
  if (q.locked_for_user) action = `<p class="muted">${I.lock()} ${esc((q.lock_explanation || 'This quiz is locked.').replace(/<[^>]+>/g, ''))}</p>`;
  else if (going) action = `<a class="btn filled block" href="${esc(open)}">Resume quiz</a>`;
  else if (left > 0) action = `<a class="btn filled block" href="${esc(open)}">${finished.length ? 'Take again' : 'Start quiz'}</a>`;
  if (finished.length) action += `<a class="btn outlined block" href="${esc(open)}">View results</a>`;

  return `
    <div class="assignment" style="--c:${esc(c.color)}">
      <article class="as-main">
        ${detailHead({
          icon: I.quiz(),
          title: q.title,
          byline: byline(c.teacher, q.created_at || null, null),
          left: q.points_possible ? `${esc(fmtNum(q.points_possible))} points` : 'Ungraded',
          right: esc(dueText(q.due_at)),
        })}
        <ul class="facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <div class="as-body rich">${q.description ? clean(q.description) : '<p class="muted">No instructions.</p>'}</div>
      </article>
      <aside class="as-side">
        <div class="card work-card">
          <div class="wc-head"><h2>Your work</h2><span class="status ${s.cls}">${esc(s.label)}</span></div>
          ${finished.length ? `<ul class="attempts">${finished.map((a) => `<li><span>Attempt ${esc(a.attempt)}</span><span>${a.score != null ? esc(fmtNum(a.score)) : '—'}${q.points_possible ? ` / ${esc(fmtNum(q.points_possible))}` : ''}</span><span class="muted">${esc(shortDate(new Date(a.finished_at)))}</span></li>`).join('')}</ul>` : ''}
          ${action}
          ${Number.isFinite(left) && left > 0 && finished.length ? `<p class="muted small">${left} attempt${left === 1 ? '' : 's'} left</p>` : ''}
        </div>
      </aside>
    </div>`;
};
