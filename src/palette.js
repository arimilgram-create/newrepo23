// Ctrl/Cmd+K: jump to any course page, assignment or Quad action.
import { S, save } from './settings.js';
import { state, go, changed, hooks } from './store.js';
import { dueOf, titleOf, isDone } from './data.js';
import { esc, relTime } from './util.js';

const COURSE_PAGES = [
  ['Home', ''],
  ['Announcements', '/announcements'],
  ['Assignments', '/assignments'],
  ['Grades', '/grades'],
  ['Modules', '/modules'],
  ['Discussions', '/discussion_topics'],
  ['Quizzes', '/quizzes'],
  ['Files', '/files'],
  ['Pages', '/pages'],
  ['Syllabus', '/assignments/syllabus'],
  ['People', '/users'],
];

const CANVAS_PAGES = [
  ['Dashboard', '/'],
  ['Calendar', '/calendar'],
  ['Inbox', '/conversations'],
  ['All grades', '/grades'],
  ['My files', '/files'],
  ['Account settings', '/profile/settings'],
  ['Notification settings', '/profile/communication'],
];

const entries = () => {
  const out = [];
  const now = Date.now();
  (state.items || [])
    .filter((it) => !isDone(it) && it.html_url)
    .forEach((it) => {
      out.push({
        label: titleOf(it),
        hint: `${it.context_name || 'To-do'} · due ${relTime(dueOf(it), now)}`,
        group: 'Due soon',
        url: it.html_url,
      });
    });
  (state.courses || []).forEach((c) => {
    COURSE_PAGES.forEach(([page, path]) => {
      out.push({
        label: page === 'Home' ? c.name : `${c.name} › ${page}`,
        hint: c.code,
        group: 'Courses',
        url: `/courses/${c.id}${path}`,
      });
    });
  });
  CANVAS_PAGES.forEach(([label, url]) => out.push({ label, hint: 'Canvas', group: 'Canvas', url }));
  const quad = [
    ['Open to-do list', () => hooks.openPanel('todo')],
    ['Add a to-do', () => { state.ui.adding = true; hooks.openPanel('todo'); }],
    ['Open grades', () => hooks.openPanel('grades')],
    ['Open GPA calculator', () => hooks.openPanel('gpa')],
    ['Open study timer and tools', () => hooks.openPanel('tools')],
    ['Open Quad settings', () => hooks.openPanel('settings')],
    [S.darkMode === 'on' ? 'Turn dark mode off' : 'Turn dark mode on', () => { S.darkMode = S.darkMode === 'on' ? 'off' : 'on'; save(); changed(); }],
  ];
  quad.forEach(([label, run]) => out.push({ label, hint: 'Quad', group: 'Quad', run }));
  return out;
};

// Every word must appear; earlier and word-start matches rank higher.
export const search = (list, query, limit = 40) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return list.filter((e) => e.group === 'Due soon' || e.group === 'Quad' || (e.group === 'Courses' && !e.label.includes('›'))).slice(0, limit);
  }
  const scored = [];
  list.forEach((e) => {
    const hay = `${e.label} ${e.hint || ''}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      const i = hay.indexOf(w);
      if (i < 0) return;
      score += i + (i === 0 || /\W/.test(hay[i - 1]) ? 0 : 20);
    }
    score += e.label.length / 10;
    if (e.group === 'Due soon') score -= 5;
    scored.push([score, e]);
  });
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1]);
};

export const createPalette = (shadow) => {
  const box = shadow.querySelector('.palette');
  const input = box.querySelector('input');
  const list = box.querySelector('.results');
  let all = [];
  let results = [];
  let index = 0;

  const draw = () => {
    results = search(all, input.value);
    index = Math.min(index, Math.max(0, results.length - 1));
    let lastGroup = '';
    list.innerHTML = results.length
      ? results
          .map((r, i) => {
            const head = r.group !== lastGroup ? `<div class="pgroup">${esc(r.group)}</div>` : '';
            lastGroup = r.group;
            return `${head}<button class="result ${i === index ? 'on' : ''}" data-index="${i}" role="option" aria-selected="${i === index}">
              <span class="rl">${esc(r.label)}</span><span class="rh">${esc(r.hint || '')}</span></button>`;
          })
          .join('')
      : '<div class="empty">No matches. Try a course name or an assignment.</div>';
    const on = list.querySelector('.result.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  };

  const choose = (r, newTab) => {
    if (!r) return;
    close();
    if (r.run) r.run();
    else if (newTab) window.open(r.url, '_blank');
    else go(r.url);
  };

  const open = () => {
    all = entries();
    box.hidden = false;
    input.value = '';
    index = 0;
    draw();
    input.focus();
  };

  const close = () => {
    box.hidden = true;
  };

  input.addEventListener('input', () => {
    index = 0;
    draw();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      index = (index + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length);
      draw();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[index], e.metaKey || e.ctrlKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.result');
    if (b) choose(results[Number(b.dataset.index)], e.metaKey || e.ctrlKey);
  });
  box.addEventListener('mousedown', (e) => {
    if (e.target === box) close();
  });

  return { open, close, isOpen: () => !box.hidden };
};
