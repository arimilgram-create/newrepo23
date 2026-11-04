// Course pages and files, shown the way a classroom shows "materials".
import { course, wikiPage, file } from '../data.js';
import { esc, I, shortDate } from '../ui.js';
import { clean } from '../sanitize.js';
import { framed } from '../router.js';
import { detailHead, byline } from './detail.js';

export const pageView = async ({ courseId, itemId }) => {
  const [c, p] = await Promise.all([course(courseId), wikiPage(courseId, itemId)]);
  const who = (p.last_edited_by && p.last_edited_by.display_name) || c.teacher;
  return `
    <div class="assignment material-page" style="--c:${esc(c.color)}">
      <article class="as-main wide">
        ${detailHead({ icon: I.material(), title: p.title, byline: byline(who, p.created_at, p.updated_at) })}
        ${p.locked_for_user
          ? `<p class="as-body muted">${I.lock()} ${esc((p.lock_explanation || 'This page is locked.').replace(/<[^>]+>/g, ''))}</p>`
          : `<div class="as-body rich">${p.body ? clean(p.body) : '<p class="muted">This page is empty.</p>'}</div>`}
      </article>
    </div>`;
};

const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const fileView = async ({ courseId, itemId }) => {
  const [c, f] = await Promise.all([course(courseId), file(courseId, itemId)]);
  const type = f['content-type'] || f.content_type || '';
  const isImage = /^image\//.test(type);
  const download = f.url ? `${f.url}${f.url.includes('?') ? '&' : '?'}download_frd=1` : '';
  const preview = isImage
    ? `<img class="file-image" src="${esc(f.url)}" alt="${esc(f.display_name)}">`
    : `<iframe class="file-frame" src="${esc(framedSrc(`/courses/${c.id}/files/${f.id}`))}" title="Preview of ${esc(f.display_name)}"></iframe>`;
  return `
    <div class="assignment material-page" style="--c:${esc(c.color)}">
      <article class="as-main wide">
        ${detailHead({
          icon: I.file(),
          title: f.display_name,
          byline: byline(c.teacher, f.created_at, f.updated_at),
          left: esc(size(f.size || 0)),
          right: f.updated_at ? `Updated ${esc(shortDate(new Date(f.updated_at)))}` : '',
        })}
        <div class="as-body">
          ${f.locked_for_user ? `<p class="muted">${I.lock()} This file is locked.</p>` : `
          <div class="file-actions">
            ${download ? `<a class="btn filled" href="${esc(download)}" download>${I.upload('flip')} Download</a>` : ''}
            <a class="btn outlined" href="${esc(framed(`/courses/${c.id}/files`))}">${I.folder()} Class files</a>
          </div>
          ${preview}`}
        </div>
      </article>
    </div>`;
};

// A Canvas page inside an iframe, without Canvas's menus (the frame view adds the rest).
export const framedSrc = (path) => {
  const url = new URL(path, location.origin);
  url.searchParams.delete('hr');
  url.searchParams.set('display', 'borderless');
  return url.pathname + url.search + url.hash;
};
