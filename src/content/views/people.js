import { course, people } from '../data.js';
import { esc, avatar } from '../ui.js';

const list = (users) =>
  `<ul class="people-list">${users
    .map((u) => `<li>${avatar(u.name, u.avatar_url, 36)}<span>${esc(u.name)}</span></li>`)
    .join('')}</ul>`;

export const peopleView = async ({ courseId }) => {
  const [c, { teachers, students }] = await Promise.all([course(courseId), people(courseId)]);
  const n = students ? students.length : 0;
  return `
    <div class="people" style="--c:${esc(c.color)}">
      <section>
        <h2 class="people-head">Teachers</h2>
        ${teachers && teachers.length ? list(teachers) : `<p class="muted pad">${teachers ? 'No teachers listed.' : 'Your school hides the teacher list.'}</p>`}
      </section>
      <section>
        <h2 class="people-head"><span>Classmates</span>${students ? `<span class="count">${n} student${n === 1 ? '' : 's'}</span>` : ''}</h2>
        ${students && students.length ? list(students) : `<p class="muted pad">${students ? 'No classmates yet.' : 'Your teacher has hidden the class list.'}</p>`}
      </section>
    </div>`;
};
