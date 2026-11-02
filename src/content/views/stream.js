import { course, announcements, assignments, statusOf } from '../data.js';
import { esc, I, avatar, banner, friendlyDay, postedText, DAY } from '../ui.js';
import { clean } from '../sanitize.js';

const upcomingCard = (c, list) => {
  const now = Date.now();
  const soon = list
    .filter((a) => a.due_at && new Date(a.due_at).getTime() >= now && new Date(a.due_at).getTime() - now < 7 * DAY)
    .filter((a) => statusOf(a).key === 'assigned')
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .slice(0, 3);
  return `
    <aside class="card upcoming">
      <h2>Upcoming</h2>
      ${soon.length
        ? soon.map((a) => `<p class="up-due">Due ${esc(friendlyDay(new Date(a.due_at)))}</p>
            <a class="up-link" href="/courses/${esc(c.id)}/assignments/${esc(a.id)}">${esc(a.name)}</a>`).join('')
        : '<p class="muted">Woohoo, no work due soon!</p>'}
      <a class="text-btn" href="/courses/${esc(c.id)}/modules">View all</a>
    </aside>`;
};

const announcementPost = (p) => {
  const author = (p.author && p.author.display_name) || p.user_name || 'Teacher';
  const replies = p.discussion_subentry_count || 0;
  return `
    <article class="card post">
      <header class="post-head">
        ${avatar(author, p.author && p.author.avatar_image_url, 40)}
        <div>
          <div class="post-author">${esc(author)}</div>
          <div class="post-date">${esc(postedText(p.posted_at || p.created_at))}</div>
        </div>
      </header>
      ${p.title ? `<h3 class="post-title">${esc(p.title)}</h3>` : ''}
      <div class="post-body rich clamp" data-clamp>${clean(p.message)}</div>
      <button class="text-btn more-btn" data-act="unclamp" hidden>Read more</button>
      <footer class="post-foot">
        <a class="comments-link" href="${esc(p.html_url)}?hr=off">${I.people()} ${replies ? `${replies} class comment${replies === 1 ? '' : 's'}` : 'Add class comment'}</a>
      </footer>
    </article>`;
};

const assignmentPost = (c, a) => `
  <a class="card post-mini" href="/courses/${esc(c.id)}/assignments/${esc(a.id)}">
    <span class="type-dot">${I.assignment()}</span>
    <span class="pm-text">${esc(c.teacher || 'Your teacher')} posted a new assignment: <b>${esc(a.name)}</b></span>
    <span class="pm-date">${esc(postedText(a.unlock_at || a.created_at))}</span>
  </a>`;

export const streamView = async ({ courseId }) => {
  const [c, posts, work] = await Promise.all([course(courseId), announcements(courseId), assignments(courseId)]);
  const now = Date.now();
  const feed = [
    ...posts.map((p) => ({ at: new Date(p.posted_at || p.created_at).getTime(), html: announcementPost(p) })),
    ...work
      .filter((a) => a.published !== false && new Date(a.unlock_at || a.created_at).getTime() <= now)
      .map((a) => ({ at: new Date(a.unlock_at || a.created_at).getTime(), html: assignmentPost(c, a) })),
  ].sort((x, y) => y.at - x.at);

  return `
    <div class="stream" style="--c:${esc(c.color)}">
      <section class="hero">
        ${banner(c)}
        <div class="hero-text">
          <h1>${esc(c.name)}</h1>
          ${c.section ? `<p>${esc(c.section)}</p>` : ''}
        </div>
      </section>
      <div class="stream-cols">
        ${upcomingCard(c, work)}
        <div class="feed">
          ${feed.length
            ? feed.slice(0, 60).map((f) => f.html).join('')
            : `<div class="card empty-feed"><h3>This is where you’ll see updates for this class</h3>
                <p class="muted">Announcements and new work from your teacher show up here.</p></div>`}
        </div>
      </div>
    </div>`;
};

// Shows "Read more" only on posts that are actually cut off.
export const mountStream = (root) => {
  root.querySelectorAll('[data-clamp]').forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 4) el.nextElementSibling.hidden = false;
    else el.classList.remove('clamp');
  });
};
