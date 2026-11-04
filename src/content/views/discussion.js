// Announcements and discussions, with the class comment thread underneath.
import { course, discussion, assignment, statusOf } from '../data.js';
import { esc, I, avatar, postedText, dueText } from '../ui.js';
import { clean } from '../sanitize.js';
import { detailHead, byline } from './detail.js';

export const discussionView = async ({ courseId, itemId }) => {
  const [c, t] = await Promise.all([course(courseId), discussion(courseId, itemId)]);
  const author = (t.author && t.author.display_name) || t.user_name || c.teacher || '';
  const canReply = !t.locked && !t.locked_for_user && !(t.permissions && t.permissions.reply === false);
  const threadBox = (label) =>
    `<section class="thread open" data-thread="${esc(c.id)}:${esc(t.id)}" data-label="${label}" data-can-reply="${canReply}" data-autoload>
      <div class="thread-head">${I.people()} <span>Loading comments…</span></div>
    </section>`;

  if (t.is_announcement) {
    return `
      <div class="announcement" style="--c:${esc(c.color)}">
        <article class="card post">
          <header class="post-head">
            ${avatar(author, t.author && t.author.avatar_image_url, 40)}
            <div><div class="post-author">${esc(author)}</div><div class="post-date">${esc(postedText(t.posted_at || t.created_at))}</div></div>
          </header>
          ${t.title ? `<h1 class="post-title big">${esc(t.title)}</h1>` : ''}
          <div class="post-body rich">${clean(t.message)}</div>
          <footer class="post-foot thread-foot">${threadBox('class comment')}</footer>
        </article>
      </div>`;
  }

  const graded = t.assignment_id ? await assignment(courseId, t.assignment_id).catch(() => null) : null;
  const s = graded ? statusOf(graded) : null;
  const points = graded && graded.points_possible ? `${graded.points_possible} points` : '';
  return `
    <div class="assignment" style="--c:${esc(c.color)}">
      <article class="as-main">
        ${detailHead({
          icon: I.discussion(),
          title: t.title,
          byline: byline(author, t.posted_at || t.created_at, t.last_reply_at && null),
          left: esc(points),
          right: graded ? esc(dueText(graded.due_at)) : '',
        })}
        <div class="as-body rich">${t.message ? clean(t.message) : '<p class="muted">No instructions.</p>'}</div>
        ${t.locked_for_user && t.lock_explanation ? `<p class="as-body muted">${I.lock()} ${esc(t.lock_explanation.replace(/<[^>]+>/g, ''))}</p>` : ''}
        <div class="as-body">${threadBox(graded ? 'reply' : 'class comment')}</div>
      </article>
      <aside class="as-side">
        <div class="card work-card">
          <div class="wc-head"><h2>Your work</h2>${s ? `<span class="status ${s.cls}">${esc(s.label)}</span>` : ''}</div>
          <p class="muted">${graded ? 'Post a reply below to turn this in.' : 'Join the conversation below.'}</p>
        </div>
      </aside>
    </div>`;
};
