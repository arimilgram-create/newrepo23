// The Homeroom app shell: top bar, side menu, routing and every click.
import APP_CSS from './styles/app.css';
import { match, canvasUrl, framed, hrefFor } from './router.js';
import { setOnStale, CanvasError, invalidate } from './api.js';
import { courses, self, setCourseColor, moduleItemSequence } from './data.js';
import { esc, I, LOGO, avatar } from './ui.js';
import { homeView } from './views/home.js';
import { streamView, mountStream } from './views/stream.js';
import { classworkView } from './views/classwork.js';
import { peopleView } from './views/people.js';
import { gradesView } from './views/grades.js';
import { assignmentView, assignmentAction, assignmentInput, assignmentSubmit } from './views/assignment.js';
import { todoView, TODO_TABS, todoTab } from './views/todo.js';
import { calendarView } from './views/calendar.js';
import { discussionView } from './views/discussion.js';
import { pageView, fileView } from './views/material.js';
import { quizView } from './views/quiz.js';
import { frameView, mountFrame } from './views/frame.js';
import { loadThread, threadAction, threadSubmit } from './views/detail.js';

// Module item links (/courses/1/modules/items/9) point at whatever the item is; send them to its Homeroom page.
const moduleItemView = async ({ courseId, itemId }) => {
  try {
    const seq = await moduleItemSequence(courseId, itemId);
    const cur = seq.items && seq.items[0] && seq.items[0].current;
    if (cur) {
      const href = hrefFor(courseId, cur.type, cur);
      return { redirect: cur.type === 'ExternalUrl' ? framed(`/courses/${courseId}/modules/items/${itemId}`) : href };
    }
  } catch (e) {
    /* fall through to the Canvas page */
  }
  return { redirect: framed(`/courses/${courseId}/modules/items/${itemId}`) };
};

const VIEWS = {
  home: homeView,
  stream: streamView,
  classwork: classworkView,
  people: peopleView,
  grades: gradesView,
  assignment: assignmentView,
  todo: todoView,
  calendar: calendarView,
  discussion: discussionView,
  quiz: quizView,
  page: pageView,
  file: fileView,
  moduleItem: moduleItemView,
  frame: frameView,
};

// Item pages sit under the Classwork tab.
const TAB_FOR = { assignment: 'classwork', quiz: 'classwork', discussion: 'classwork', page: 'classwork', file: 'classwork', moduleItem: 'classwork' };

const COURSE_TABS = [
  ['stream', 'Stream', ''],
  ['classwork', 'Classwork', '/modules'],
  ['people', 'People', '/users'],
  ['grades', 'Grades', '/grades'],
];

const SWATCHES = ['#1e8e3e', '#1967d2', '#e37400', '#c5221f', '#7627bb', '#129eaf', '#d01884', '#5f6368', '#0b8043', '#b06000', '#3f51b5', '#00796b'];

export const THEME_KEY = 'homeroom:theme';
const RAIL_KEY = 'homeroom:rail';
const wide = matchMedia('(min-width: 1100px)');
const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0b8043"/><path d="M7 24V12.5L16 6l9 6.5V24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><rect x="12.2" y="15" width="7.6" height="9" rx="1.2" fill="#fff"/><circle cx="16" cy="11.4" r="1.6" fill="#fbbc04"/></svg>')}`;
export const OFF_KEY = 'homeroom:off';

const storage = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch (e) {
      /* ignore */
    }
  },
};

let els = {};
let renderToken = 0;
let route = null;
// As a bookmark, Homeroom lives in one tab: Canvas-only pages open in new tabs so it keeps running.
let bookmarklet = false;

// ---------- document ----------

const buildDocument = () => {
  const html = document.documentElement;
  [...html.attributes].forEach((a) => html.removeAttribute(a.name));
  html.setAttribute('lang', navigator.language || 'en');
  html.replaceChildren();
  const head = document.createElement('head');
  head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Homeroom</title>
    <link rel="icon" href="${FAVICON}">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap">`;
  const style = document.createElement('style');
  style.textContent = APP_CSS;
  head.appendChild(style);
  const body = document.createElement('body');
  body.innerHTML = `
    <header class="topbar">
      <button class="icon-btn" data-act="drawer" aria-label="Main menu">${I.menu()}</button>
      <div class="tb-title"></div>
      <nav class="tb-tabs" aria-label="Sections"></nav>
      <div class="tb-right">
        <a class="icon-btn" data-canvas-link href="/" title="Open this page in regular Canvas" aria-label="Open this page in regular Canvas">${I.external()}</a>
        <button class="avatar-btn" data-act="account" aria-label="Account and settings"></button>
      </div>
      <div class="progress" hidden><i></i></div>
    </header>
    <main id="hr-main" tabindex="-1"></main>
    <div class="scrim" data-act="close-overlays" hidden></div>
    <nav class="drawer" aria-label="Main menu" hidden></nav>
    <div class="popover" role="menu" hidden></div>
    <div class="toasts" aria-live="polite"></div>`;
  html.append(head, body);
  els = {
    title: body.querySelector('.tb-title'),
    tabs: body.querySelector('.tb-tabs'),
    canvasLink: body.querySelector('[data-canvas-link]'),
    accountBtn: body.querySelector('.avatar-btn'),
    progress: body.querySelector('.progress'),
    main: body.querySelector('#hr-main'),
    scrim: body.querySelector('.scrim'),
    drawer: body.querySelector('.drawer'),
    popover: body.querySelector('.popover'),
    toasts: body.querySelector('.toasts'),
  };
  applyTheme();
};

const applyTheme = () => {
  const t = storage.get(THEME_KEY) || 'light';
  const dark = t === 'dark' || (t === 'device' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};

// ---------- chrome around the page ----------

const tabLink = (href, label, on) => `<a class="tab ${on ? 'on' : ''}" href="${esc(href)}" ${on ? 'aria-current="page"' : ''}>${esc(label)}</a>`;

let frameTitle = '';

const brand = (extra = '') => `<a class="tb-brand" href="/">${LOGO(30)}<span class="tb-word">Homeroom</span></a>${extra}`;

const renderChrome = async () => {
  els.canvasLink.href = canvasUrl();
  if (bookmarklet) els.canvasLink.target = '_blank';
  document.body.classList.toggle('flush', route.name === 'frame');
  if (route.courseId) {
    let c = null;
    try {
      c = (await courses()).find((x) => x.id === route.courseId);
    } catch (e) {
      /* the view will show the error */
    }
    document.body.style.setProperty('--c', c ? c.color : 'var(--brand)');
    els.title.innerHTML = brand(`<span class="crumb" aria-hidden="true">${I.right()}</span>
      <a class="tb-class" href="/courses/${esc(route.courseId)}"><span class="tb-name">${esc(c ? c.name : 'Class')}</span>${c && c.section ? `<span class="tb-section">${esc(c.section)}</span>` : ''}</a>`);
    els.title.classList.add('in-class');
    const active = TAB_FOR[route.name] || route.name;
    els.tabs.innerHTML = COURSE_TABS.map(([k, label, path]) => tabLink(`/courses/${route.courseId}${path}`, label, k === active)).join('');
    document.title = `${route.name === 'frame' && frameTitle ? `${frameTitle} – ` : ''}${c ? c.name : 'Class'} – Homeroom`;
  } else {
    document.body.style.removeProperty('--c');
    els.title.classList.remove('in-class');
    const names = { home: '', todo: 'To-do', calendar: 'Calendar', frame: frameTitle };
    const label = names[route.name];
    els.title.innerHTML = brand(label ? `<span class="crumb" aria-hidden="true">${I.right()}</span><span class="tb-page">${esc(label)}</span>` : '');
    els.tabs.innerHTML = route.name === 'todo'
      ? TODO_TABS.map(([k, tabLabel]) => tabLink(`/#todo/${k}${route.params.get('course') ? `?course=${route.params.get('course')}` : ''}`, tabLabel, todoTab(route.hash) === k)).join('')
      : '';
    document.title = label ? `${label} – Homeroom` : 'Homeroom';
  }
  if (wide.matches) renderDrawer();
};

const renderAccount = async () => {
  try {
    const me = await self();
    els.accountBtn.innerHTML = avatar(me.name, me.avatar_url, 32);
    els.accountBtn.dataset.name = me.name;
  } catch (e) {
    els.accountBtn.innerHTML = avatar('?', '', 32);
  }
};

const renderDrawer = async () => {
  let list = [];
  try {
    list = await courses();
  } catch (e) {
    /* show the menu without classes */
  }
  const here = location.pathname;
  const item = (href, icon, label, on, extra = '') =>
    `<a class="dr-item ${on ? 'on' : ''}" href="${esc(href)}" title="${esc(label)}" ${extra}>${icon}<span>${esc(label)}</span></a>`;
  els.drawer.innerHTML = `
    <div class="dr-top">${LOGO(30)}<b>Homeroom</b></div>
    ${item('/', I.home(), 'Home', route.name === 'home')}
    ${item('/calendar', I.calendar(), 'Calendar', route.name === 'calendar')}
    <hr>
    <div class="dr-label">Enrolled</div>
    ${item('/#todo/assigned', I.todo(), 'To-do', route.name === 'todo')}
    ${list
      .map((c) => `<a class="dr-item class ${here.startsWith(`/courses/${c.id}`) ? 'on' : ''}" href="/courses/${esc(c.id)}" title="${esc(c.name)}">
        <span class="letter" style="background:${esc(c.color)}">${esc((c.name.match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase())}</span>
        <span class="dr-text"><span>${esc(c.name)}</span>${c.section ? `<small>${esc(c.section)}</small>` : ''}</span></a>`)
      .join('')}
    <hr>
    ${item(framed('/conversations'), I.inbox(), 'Inbox', location.pathname.startsWith('/conversations'))}
    ${item(framed('/profile/settings'), I.settings(), 'Canvas account', location.pathname.startsWith('/profile'))}
    <button class="dr-item" data-act="account" title="Homeroom settings">${I.sun()}<span>Homeroom settings</span></button>`;
};

// ---------- rendering ----------

const skeleton = (name) => {
  if (name === 'home') return `<ul class="class-grid">${'<li class="class-card skel"></li>'.repeat(6)}</ul>`;
  return `<div class="skel-page">${'<div class="skel-line"></div>'.repeat(5)}</div>`;
};

const errorView = (e) => {
  const signIn = e instanceof CanvasError && e.status === 401;
  return `<div class="empty-state">
    <div class="empty-art">${signIn ? I.lock() : I.close()}</div>
    <h2>${signIn ? 'Sign in to Canvas' : 'Couldn’t load this page'}</h2>
    <p>${esc(e.message || 'Something went wrong.')}</p>
    <div class="row-btns">
      ${signIn ? '<a class="btn filled" href="/login?hr=off">Sign in</a>' : '<button class="btn filled" data-act="retry">Try again</button>'}
      <a class="btn outlined" href="${esc(canvasUrl())}">Open in regular Canvas</a>
    </div>
  </div>`;
};

export const render = async ({ quiet = false, toast: message = '' } = {}) => {
  route = match(location);
  if (!route) {
    location.reload();
    return;
  }
  const token = ++renderToken;
  const first = !els.main.dataset.route;
  const sameRoute = els.main.dataset.route === location.href;
  if (!quiet) {
    els.progress.hidden = false;
    if (!sameRoute) els.main.classList.add('loading');
    if (first || !sameRoute) els.main.innerHTML = first ? skeleton(route.name) : els.main.innerHTML;
  }
  renderChrome();
  try {
    const html = await VIEWS[route.name](route);
    if (token !== renderToken) return;
    if (html && typeof html === 'object' && html.redirect) {
      navigate(html.redirect, { replace: true });
      return;
    }
    // A quiet refresh of the frame view would reload the Canvas page inside it; leave it alone.
    if (quiet && route.name === 'frame' && els.main.querySelector('.canvas-frame')) return;
    const scroll = sameRoute ? window.scrollY : 0;
    els.main.innerHTML = html;
    els.main.dataset.route = location.href;
    if (route.name === 'stream') mountStream(els.main);
    if (route.name === 'frame') {
      frameTitle = '';
      mountFrame(els.main, {
        navigate,
        dark: () => document.documentElement.dataset.theme === 'dark',
        setTitle: (t) => {
          if (t && t !== frameTitle) {
            frameTitle = t;
            renderChrome();
          }
        },
      });
    }
    els.main.querySelectorAll('[data-thread][data-autoload]').forEach((el) =>
      loadThread(el, { label: el.dataset.label }).catch((err) => {
        el.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
      })
    );
    if (!quiet) window.scrollTo(0, scroll);
  } catch (e) {
    if (token !== renderToken) return;
    console.error('[Homeroom]', e);
    els.main.innerHTML = errorView(e);
    els.main.dataset.route = location.href;
  } finally {
    if (token === renderToken) {
      els.progress.hidden = true;
      els.main.classList.remove('loading');
    }
  }
  if (message) toast(message);
};

export const navigate = (href, { replace = false } = {}) => {
  closeOverlays();
  const url = new URL(href, location.href);
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  render();
};

export const toast = (text) => {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  els.toasts.appendChild(el);
  setTimeout(() => el.remove(), 4000);
};

// ---------- overlays ----------

const closeOverlays = () => {
  if (!wide.matches) {
    els.drawer.hidden = true;
    els.drawer.classList.remove('open');
  }
  els.popover.hidden = true;
  els.scrim.hidden = true;
};

// Wide screens keep the menu docked on the left; the menu button shrinks it to icons and back.
const applyDock = () => {
  const docked = wide.matches;
  document.body.classList.toggle('docked', docked);
  document.body.classList.toggle('rail', docked && storage.get(RAIL_KEY) === '1');
  if (docked) {
    els.drawer.hidden = false;
    els.drawer.classList.add('open');
    renderDrawer();
  } else {
    els.drawer.hidden = true;
    els.drawer.classList.remove('open');
  }
};

const openDrawer = async () => {
  if (wide.matches) {
    storage.set(RAIL_KEY, storage.get(RAIL_KEY) === '1' ? null : '1');
    applyDock();
    return;
  }
  await renderDrawer();
  els.scrim.hidden = false;
  els.drawer.hidden = false;
  requestAnimationFrame(() => els.drawer.classList.add('open'));
  const on = els.drawer.querySelector('.dr-item.on') || els.drawer.querySelector('.dr-item');
  if (on) on.focus();
};

const openPopover = (anchor, html) => {
  els.popover.innerHTML = html;
  els.popover.hidden = false;
  els.scrim.hidden = false;
  els.scrim.classList.add('clear');
  const r = anchor.getBoundingClientRect();
  const w = els.popover.offsetWidth;
  els.popover.style.top = `${Math.min(r.bottom + 6, innerHeight - els.popover.offsetHeight - 8)}px`;
  els.popover.style.left = `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px`;
  const first = els.popover.querySelector('button, a');
  if (first) first.focus();
};

const accountMenu = () => {
  const t = storage.get(THEME_KEY) || 'light';
  const opt = (v, label) => `<button role="menuitemradio" aria-checked="${t === v}" data-act="theme" data-theme="${v}">${t === v ? I.check() : '<span class="i"></span>'} ${label}</button>`;
  return `
    <div class="pop-head">${els.accountBtn.innerHTML}<b>${esc(els.accountBtn.dataset.name || '')}</b></div>
    <div class="pop-label">Theme</div>
    ${opt('light', 'Light')}${opt('dark', 'Dark')}${opt('device', 'Match my device')}
    <hr>
    <a role="menuitem" href="${esc(canvasUrl())}" target="_blank" rel="noopener">${I.external()} Open this page in regular Canvas</a>
    <button role="menuitem" data-act="turn-off">${I.close()} ${bookmarklet ? 'Back to regular Canvas' : 'Turn off Homeroom'}</button>`;
};

const cardMenu = (id) => `
  <div class="pop-label">Class color</div>
  <div class="swatches">${SWATCHES.map((c) => `<button class="swatch" style="background:${c}" data-act="color" data-id="${esc(id)}" data-color="${c}" aria-label="Use color ${c}"></button>`).join('')}</div>
  <hr>
  <a role="menuitem" href="/courses/${esc(id)}?hr=off" target="_blank" rel="noopener">${I.external()} Open in regular Canvas</a>`;

// ---------- events ----------

const onClick = async (e) => {
  const act = e.target.closest('[data-act]');
  const link = e.target.closest('a[href]');
  if (!e.target.closest('.add-wrap') && els.main.querySelector('.add-wrap .menu')) {
    await assignmentAction('close-menu', null, els.main);
  }

  if (act && act.tagName !== 'SELECT') {
    const name = act.dataset.act;
    if (act.tagName === 'A') e.preventDefault();
    switch (name) {
      case 'drawer':
        openDrawer();
        return;
      case 'close-overlays':
        closeOverlays();
        els.scrim.classList.remove('clear');
        return;
      case 'account':
        closeOverlays();
        openPopover(els.accountBtn, accountMenu());
        return;
      case 'card-menu':
        openPopover(act, cardMenu(act.dataset.id));
        return;
      case 'theme':
        storage.set(THEME_KEY, act.dataset.theme);
        applyTheme();
        openPopover(els.accountBtn, accountMenu());
        return;
      case 'turn-off':
        if (!bookmarklet) storage.set(OFF_KEY, '1');
        {
          const u = new URL(canvasUrl(), location.href);
          u.searchParams.delete('hr');
          location.href = u.pathname + u.search + u.hash;
        }
        return;
      case 'color':
        closeOverlays();
        try {
          await setCourseColor(act.dataset.id, act.dataset.color);
          invalidate('/courses?');
          await render({ quiet: true, toast: 'Class color updated' });
        } catch (err) {
          toast(err.message);
        }
        return;
      case 'retry':
        render();
        return;
      case 'expand': {
        const item = act.closest('.cw-item');
        const detail = item.querySelector('.cw-detail');
        detail.hidden = !detail.hidden;
        act.setAttribute('aria-expanded', String(!detail.hidden));
        item.classList.toggle('open', !detail.hidden);
        return;
      }
      case 'topic': {
        els.main.querySelectorAll('.topic-link').forEach((l) => l.classList.toggle('on', l === act));
        const target = act.dataset.id === 'all' ? null : els.main.querySelector(`#topic-${CSS.escape(act.dataset.id)}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      case 'unclamp': {
        const body = act.previousElementSibling;
        body.classList.remove('clamp');
        act.hidden = true;
        return;
      }
      case 'toggle-group': {
        const g = act.closest('.todo-group');
        g.classList.toggle('open');
        act.setAttribute('aria-expanded', String(g.classList.contains('open')));
        return;
      }
      case 'thread-open':
      case 'reply-to':
        await threadAction(name, act);
        return;
      default: {
        const result = await assignmentAction(name, act, els.main, (opts) => render({ quiet: true, ...opts }));
        if (result && result.toast) toast(result.toast);
        return;
      }
    }
  }

  if (link && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    if (link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash && !url.hash.startsWith('#todo')) return;
    if (match(url)) {
      e.preventDefault();
      navigate(url.href);
    } else if (bookmarklet && url.searchParams.get('hr') === 'off') {
      // "Regular Canvas" links open beside Homeroom so this tab keeps it.
      e.preventDefault();
      window.open(url.href, '_blank', 'noopener');
    }
  }
};

const onChange = (e) => {
  const t = e.target;
  if (t.matches('select[data-act="filter-course"]')) {
    const url = new URL(location.href);
    if (t.value) url.searchParams.set('course', t.value);
    else url.searchParams.delete('course');
    navigate(url.href, { replace: true });
    return;
  }
  if (t.id === 'hr-file') assignmentInput(t, els.main);
};

const onInput = (e) => {
  if (e.target.dataset && e.target.dataset.draft) assignmentInput(e.target, els.main);
};

const onSubmit = async (e) => {
  e.preventDefault();
  const posted = await threadSubmit(e.target);
  if (posted) {
    if (posted.toast) toast(posted.toast);
    return;
  }
  await assignmentSubmit(e.target, els.main);
};

const busyTyping = () => {
  const a = document.activeElement;
  return !!a && els.main.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
};

export const startApp = (opts = {}) => {
  bookmarklet = !!opts.bookmarklet;
  buildDocument();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeOverlays();
      els.scrim.classList.remove('clear');
    }
  });
  // Capture and stop these so any of Canvas's own leftover listeners don't react to Homeroom's navigation.
  const onHistory = (e) => {
    e.stopImmediatePropagation();
    render();
  };
  window.addEventListener('popstate', onHistory, true);
  window.addEventListener('hashchange', onHistory, true);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  setOnStale(() => {
    if (!busyTyping() && els.popover.hidden) render({ quiet: true });
  });
  // The frame view fills the window under the top bar, which is taller on phones.
  const bar = document.querySelector('.topbar');
  new ResizeObserver(() => document.body.style.setProperty('--top-h', `${bar.offsetHeight}px`)).observe(bar);
  wide.addEventListener('change', applyDock);
  applyDock();
  renderAccount();
  render();
};
