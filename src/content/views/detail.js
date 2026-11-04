// Shared pieces for item pages (assignments, quizzes, discussions, materials): the header and the comment thread.
import { esc, I, avatar, postedText } from '../ui.js';
import { clean } from '../sanitize.js';
import { discussionThread, threadOf, postReply, self } from '../data.js';

// Icon, colored title, "Teacher • date", and the points / due line over a class-colored divider.
export const detailHead = ({ icon, title, byline = '', left = '', right = '', grey = false }) => `
  <header class="as-head">
    <span class="type-dot big ${grey ? 'grey' : ''}">${icon}</span>
    <div class="as-titles">
      <h1>${esc(title)}</h1>
      ${byline ? `<p class="muted">${byline}</p>` : ''}
      <div class="as-meta ${left || right ? '' : 'bare'}"><span>${left}</span><span>${right}</span></div>
    </div>
  </header>`;

export const byline = (who, created, updated) => {
  const parts = [];
  if (who) parts.push(esc(who));
  if (created) parts.push(esc(postedText(created)));
  let s = parts.join(' • ');
  if (updated && created && updated.slice(0, 10) !== created.slice(0, 10)) s += ` (Edited ${esc(postedText(updated))})`;
  return s;
};

// ---------- class comment threads ----------

const comment = (c, { reply = true } = {}) => `
  <div class="comment" data-entry="${esc(c.id)}">
    ${avatar(c.name, c.avatar, 32)}
    <div class="cm-body">
      <div class="cm-head"><b>${esc(c.name)}</b> <span class="muted">${esc(postedText(c.at))}</span></div>
      <div class="cm-text rich">${c.deleted ? '<span class="muted">This comment was deleted.</span>' : clean(c.html)}</div>
      ${reply ? `<button class="text-btn small-btn" data-act="reply-to" data-entry="${esc(c.id)}">Reply</button>` : ''}
    </div>
  </div>`;

export const composer = (me, { parent = '', placeholder = 'Add class comment…' } = {}) => `
  <form class="comment-form" data-form="reply" ${parent ? `data-parent="${esc(parent)}"` : ''}>
    ${avatar(me.name, me.avatar_url, 32)}
    <input name="text" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="${esc(placeholder)}">
    <button class="icon-btn" type="submit" aria-label="Post">${I.send()}</button>
  </form>`;

export const threadHtml = (thread, me, { canReply = true, label = 'class comment', mustPost = false } = {}) => {
  const count = thread.reduce((n, t) => n + 1 + t.replies.length, 0);
  return `
    <div class="thread-head">${I.people()} <span>${count ? `${count} ${label}${count === 1 ? '' : 's'}` : `No ${label}s yet`}</span></div>
    ${mustPost ? '<p class="muted pad-s">Your teacher asks you to post before you can see what classmates wrote.</p>' : ''}
    <div class="comments">
      ${thread
        .map((t) => `
        <div class="comment-group">
          ${comment(t, { reply: canReply })}
          ${t.replies.length ? `<div class="replies">${t.replies.map((r) => comment(r, { reply: false })).join('')}</div>` : ''}
          <div class="reply-slot" data-slot="${esc(t.id)}"></div>
        </div>`)
        .join('')}
    </div>
    ${canReply ? composer(me) : '<p class="muted pad-s">Comments are turned off.</p>'}`;
};

// Loads and draws a thread into an element marked data-thread="courseId:topicId".
export const loadThread = async (el, opts = {}) => {
  const [courseId, topicId] = el.dataset.thread.split(':');
  const [view, me] = await Promise.all([discussionThread(courseId, topicId), self()]);
  el.innerHTML = threadHtml(threadOf(view), me, { ...opts, mustPost: view.mustPost, canReply: el.dataset.canReply !== 'false' });
  el.dataset.loaded = '1';
};

export const threadAction = async (act, el) => {
  const box = el.closest('[data-thread]');
  if (!box) return false;
  if (act === 'thread-open') {
    el.disabled = true;
    await loadThread(box, { label: box.dataset.label || 'class comment' });
    box.classList.add('open');
    return true;
  }
  if (act === 'reply-to') {
    const slot = box.querySelector(`[data-slot="${CSS.escape(el.dataset.entry)}"]`);
    if (!slot.innerHTML) {
      const me = await self();
      slot.innerHTML = composer(me, { parent: el.dataset.entry, placeholder: 'Reply…' });
    }
    slot.querySelector('input').focus();
    return true;
  }
  return false;
};

export const threadSubmit = async (form) => {
  const box = form.closest('[data-thread]');
  if (!box || form.dataset.form !== 'reply') return false;
  const input = form.elements.text;
  const text = input.value.trim();
  if (!text) return true;
  const [courseId, topicId] = box.dataset.thread.split(':');
  input.disabled = true;
  try {
    await postReply(courseId, topicId, text, form.dataset.parent || null);
    await loadThread(box, { label: box.dataset.label || 'class comment' });
    box.classList.add('open');
    return { toast: 'Posted' };
  } catch (e) {
    input.disabled = false;
    return { toast: e.message };
  }
};
