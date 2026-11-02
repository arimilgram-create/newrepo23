// Assignment page: instructions on the left, "Your work" and private comments on the right.
import { course, assignment, submission, statusOf, turnIn, comment, markDone, plannerOverride, fmtNum } from '../data.js';
import { esc, I, avatar, dueText, postedText, typeIcon } from '../ui.js';
import { clean } from '../sanitize.js';

const SUBMITTABLE = ['online_upload', 'online_url', 'online_text_entry'];
const LABEL = { online_upload: 'File', online_url: 'Link', online_text_entry: 'Text' };
const ICON = { online_upload: I.upload, online_url: I.link, online_text_entry: I.text };

// What the student has added but not turned in yet. Lives across re-renders of the same page.
const drafts = new Map();
const draftFor = (id) => {
  if (!drafts.has(id)) drafts.set(id, { type: null, files: [], url: '', text: '', menu: false, busy: false, error: '' });
  return drafts.get(id);
};

let current = null; // { course, assignment, submission, done }

const attachmentList = (sub) => {
  const out = [];
  (sub.attachments || []).forEach((f) =>
    out.push(`<a class="attach" href="${esc(f.url || f.preview_url || '#')}" target="_blank" rel="noopener">
      <span class="attach-icon">${I.file()}</span><span class="attach-name">${esc(f.display_name || f.filename)}</span></a>`)
  );
  if (sub.url) out.push(`<a class="attach" href="${esc(sub.url)}" target="_blank" rel="noopener"><span class="attach-icon">${I.link()}</span><span class="attach-name">${esc(sub.url)}</span></a>`);
  if (sub.body) out.push(`<div class="attach text-attach"><span class="attach-icon">${I.text()}</span><span class="attach-name">Text entry</span></div>`);
  return out.join('');
};

const workCard = () => {
  const { course: c, assignment: a, submission: sub, done } = current;
  const d = draftFor(a.id);
  const s = statusOf({ ...a, submission: sub });
  const types = (a.submission_types || []).filter((t) => SUBMITTABLE.includes(t));
  const external = !types.length && (a.submission_types || []).some((t) => !['none', 'on_paper', 'not_graded'].includes(t));
  const turnedIn = !!sub.submitted_at;
  const attemptsLeft = a.allowed_attempts == null || a.allowed_attempts < 0 || (sub.attempt || 0) < a.allowed_attempts;
  const lockedOut = a.locked_for_user;

  let body = '';
  if (turnedIn) body += `<div class="attachments">${attachmentList(sub)}</div>`;

  if (lockedOut) {
    body += `<p class="muted">${esc(a.lock_explanation ? a.lock_explanation.replace(/<[^>]+>/g, '') : 'This assignment is locked.')}</p>`;
  } else if (external) {
    body += `<a class="btn filled block" href="${esc(a.html_url)}?hr=off">Open in Canvas</a>
      <p class="muted small">This kind of work (${esc((a.submission_types || []).join(', ').replace(/_/g, ' '))}) is done in Canvas.</p>`;
  } else if (!types.length) {
    body += `<button class="btn ${done ? 'outlined' : 'filled'} block" data-act="mark-done" ${d.busy ? 'disabled' : ''}>${done ? 'Unmark as done' : 'Mark as done'}</button>`;
  } else if (!turnedIn || attemptsLeft) {
    const pending = [];
    if (d.type === 'online_upload') d.files.forEach((f, i) => pending.push(`<div class="attach pending"><span class="attach-icon">${I.file()}</span><span class="attach-name">${esc(f.name)}</span><button class="icon-btn sm" data-act="remove-file" data-i="${i}" aria-label="Remove ${esc(f.name)}">${I.close()}</button></div>`));
    if (d.type === 'online_url') pending.push(`<div class="field"><input id="hr-url" type="url" placeholder="https://" value="${esc(d.url)}" data-draft="url" aria-label="Link"><button class="icon-btn sm" data-act="clear-draft" aria-label="Remove link">${I.close()}</button></div>`);
    if (d.type === 'online_text_entry') pending.push(`<textarea id="hr-text" rows="6" placeholder="Type your answer" data-draft="text" aria-label="Your answer">${esc(d.text)}</textarea>`);
    const ready = (d.type === 'online_upload' && d.files.length) || (d.type === 'online_url' && /^https?:\/\/\S+/.test(d.url)) || (d.type === 'online_text_entry' && d.text.trim());
    body += `<div class="attachments">${pending.join('')}</div>
      <div class="add-wrap">
        <button class="btn outlined block" data-act="add-menu" aria-expanded="${d.menu}" ${d.busy ? 'disabled' : ''}>${I.plus()} ${turnedIn ? 'Add a new attempt' : 'Add or create'}</button>
        ${d.menu ? `<div class="menu" role="menu">${types.map((t) => `<button role="menuitem" data-act="add-type" data-type="${t}">${ICON[t]()} ${LABEL[t]}</button>`).join('')}</div>` : ''}
      </div>
      <input type="file" id="hr-file" multiple hidden>
      <button class="btn filled block" data-act="turn-in" ${ready && !d.busy ? '' : 'disabled'}>${d.busy ? 'Turning in…' : turnedIn ? 'Resubmit' : 'Turn in'}</button>`;
  }
  if (d.error) body += `<p class="error-text" role="alert">${esc(d.error)}</p>`;

  return `
    <div class="card work-card">
      <div class="wc-head">
        <h2>Your work</h2>
        <span class="status ${done && s.key === 'assigned' ? 'turned' : s.cls}">${esc(done && s.key === 'assigned' ? 'Done' : s.label)}</span>
      </div>
      ${body}
    </div>`;
};

const commentsCard = () => {
  const { submission: sub } = current;
  const list = sub.submission_comments || [];
  return `
    <div class="card comments-card">
      <h2 class="cc-h">${I.people()} Private comments</h2>
      ${list.map((cm) => `
        <div class="pc">
          ${avatar(cm.author_name, cm.author && cm.author.avatar_image_url, 32)}
          <div><div class="pc-head"><b>${esc(cm.author_name)}</b> <span class="muted">${esc(postedText(cm.created_at))}</span></div>
          <div class="pc-text">${esc(cm.comment)}</div></div>
        </div>`).join('')}
      <form class="pc-form" data-form="comment">
        <input id="hr-comment" name="comment" placeholder="Add comment to your teacher" autocomplete="off" aria-label="Private comment">
        <button class="icon-btn" type="submit" aria-label="Post comment">${I.send()}</button>
      </form>
    </div>`;
};

export const renderSide = (root) => {
  const side = root.querySelector('[data-side]');
  if (side && current) side.innerHTML = workCard() + commentsCard();
};

export const assignmentView = async ({ courseId, assignmentId }) => {
  const [c, a, sub] = await Promise.all([course(courseId), assignment(courseId, assignmentId), submission(courseId, assignmentId).catch(() => ({}))]);
  const needsNothing = !(a.submission_types || []).some((t) => !['none', 'on_paper', 'not_graded'].includes(t));
  const override = needsNothing ? await plannerOverride(courseId, a).catch(() => null) : null;
  current = { course: c, assignment: a, submission: sub || {}, done: !!(override && override.marked_complete) };
  const kind = a.is_quiz_assignment ? 'quiz' : a.discussion_topic ? 'discussion_topic' : 'assignment';
  const graded = sub && sub.score != null && sub.posted_at !== null;
  return `
    <div class="assignment" style="--c:${esc(c.color)}">
      <article class="as-main">
        <header class="as-head">
          <span class="type-dot big">${typeIcon(kind)()}</span>
          <div class="as-titles">
            <h1>${esc(a.name)}</h1>
            <p class="muted">${esc(c.teacher || c.name)}${a.created_at ? ` • ${esc(postedText(a.created_at))}` : ''}${a.updated_at && a.created_at && a.updated_at.slice(0, 10) !== a.created_at.slice(0, 10) ? ` (Edited ${esc(postedText(a.updated_at))})` : ''}</p>
            <div class="as-meta">
              <span>${a.points_possible ? `${graded ? `${fmtNum(sub.score)}/` : ''}${esc(a.points_possible)} points` : 'Ungraded'}</span>
              <span>${esc(dueText(a.due_at))}</span>
            </div>
          </div>
        </header>
        <div class="as-body rich">${a.description ? clean(a.description) : '<p class="muted">No instructions.</p>'}</div>
        <p class="fine"><a href="${esc(a.html_url)}?hr=off">${I.external()} Open this assignment in Canvas</a></p>
      </article>
      <aside class="as-side" data-side>${workCard()}${commentsCard()}</aside>
    </div>`;
};

// ---------- actions (called from app.js) ----------

export const assignmentAction = async (act, el, root, rerender) => {
  if (!current) return false;
  const a = current.assignment;
  const c = current.course;
  const d = draftFor(a.id);
  const refresh = () => renderSide(root);

  switch (act) {
    case 'close-menu':
      if (d.menu) {
        d.menu = false;
        refresh();
      }
      return true;
    case 'add-menu':
      d.menu = !d.menu;
      refresh();
      return true;
    case 'add-type':
      d.type = el.dataset.type;
      d.menu = false;
      d.error = '';
      if (d.type === 'online_upload') {
        root.querySelector('#hr-file').click();
      }
      refresh();
      if (d.type === 'online_url') root.querySelector('#hr-url').focus();
      if (d.type === 'online_text_entry') root.querySelector('#hr-text').focus();
      return true;
    case 'remove-file':
      d.files.splice(Number(el.dataset.i), 1);
      if (!d.files.length) d.type = null;
      refresh();
      return true;
    case 'clear-draft':
      d.type = null;
      d.url = '';
      refresh();
      return true;
    case 'turn-in':
      d.busy = true;
      d.error = '';
      refresh();
      try {
        await turnIn(c.id, a.id, { type: d.type, files: d.files, url: d.url, text: d.text });
        drafts.delete(a.id);
        await rerender({ toast: 'Turned in' });
      } catch (e) {
        d.busy = false;
        d.error = e.message;
        refresh();
      }
      return true;
    case 'mark-done':
      d.busy = true;
      refresh();
      try {
        await markDone(c.id, a, !current.done);
        current.done = !current.done;
        d.busy = false;
        refresh();
        return { toast: current.done ? 'Marked as done' : 'Unmarked' };
      } catch (e) {
        d.busy = false;
        d.error = e.message;
        refresh();
      }
      return true;
    default:
      return false;
  }
};

export const assignmentInput = (el, root) => {
  if (!current) return;
  const d = draftFor(current.assignment.id);
  if (el.id === 'hr-file') {
    d.files.push(...el.files);
    d.type = d.files.length ? 'online_upload' : null;
    d.menu = false;
    el.value = '';
    renderSide(root);
    return;
  }
  if (el.dataset.draft) {
    d[el.dataset.draft] = el.value;
    const btn = root.querySelector('[data-act="turn-in"]');
    const ready = (d.type === 'online_url' && /^https?:\/\/\S+/.test(d.url)) || (d.type === 'online_text_entry' && d.text.trim());
    if (btn) btn.disabled = !ready;
  }
};

export const assignmentSubmit = async (form, root) => {
  if (!current || form.dataset.form !== 'comment') return false;
  const input = form.elements.comment;
  const text = input.value.trim();
  if (!text) return true;
  input.disabled = true;
  try {
    await comment(current.course.id, current.assignment.id, text);
    current.submission.submission_comments = [
      ...(current.submission.submission_comments || []),
      { author_name: 'You', comment: text, created_at: new Date().toISOString() },
    ];
    renderSide(root);
  } catch (e) {
    input.disabled = false;
    draftFor(current.assignment.id).error = e.message;
    renderSide(root);
  }
  return true;
};
