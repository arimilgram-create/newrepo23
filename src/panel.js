// The floating Quad panel, toasts and the search box, all inside one shadow root.
import PANEL_CSS from './styles/panel.css';
import { S, save, isDark } from './settings.js';
import { state, hooks } from './store.js';
import { bindUI } from './actions.js';
import { createPalette } from './palette.js';
import { timerChip, startTicker } from './timer.js';
import { ICONS, renderTodo, renderGrades, renderGpa, renderTools, renderSettings, todoCount, gradeChanges } from './views.js';
import { esc, isTyping } from './util.js';

const TABS = [
  ['todo', 'To-do'],
  ['grades', 'Grades'],
  ['gpa', 'GPA'],
  ['tools', 'Tools'],
  ['settings', 'Settings'],
];

export const createPanel = () => {
  const host = document.createElement('div');
  host.id = 'quad-host';
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;display:block;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${PANEL_CSS}</style>
    <section class="panel" role="dialog" aria-label="Quad" hidden>
      <header>
        <div class="brand"><span class="logo" aria-hidden="true"></span>Quad</div>
        <button class="chip" data-tab="tools" data-timer-chip hidden></button>
        <button class="icon" data-act="palette" title="Search Canvas (Ctrl+K)" aria-label="Search Canvas">${ICONS.search}</button>
        <button class="icon" data-act="refresh" title="Refresh from Canvas" aria-label="Refresh">${ICONS.refresh}</button>
        <button class="icon" data-act="close" title="Close (Esc)" aria-label="Close">${ICONS.close}</button>
      </header>
      <nav role="tablist" aria-label="Quad sections"></nav>
      <main tabindex="-1"></main>
    </section>
    <div class="toasts" aria-live="polite"></div>
    <div class="palette" hidden>
      <div class="pbox" role="combobox" aria-expanded="true" aria-haspopup="listbox">
        <div class="pinput">${ICONS.search}<input type="text" placeholder="Jump to a course, page or assignment…" aria-label="Search Canvas" autocomplete="off" spellcheck="false"></div>
        <div class="results" role="listbox"></div>
        <div class="pfoot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> new tab</span><span><kbd>Esc</kbd> close</span></div>
      </div>
    </div>`;
  document.documentElement.appendChild(host);
  bindUI(shadow);

  const panel = shadow.querySelector('.panel');
  const nav = shadow.querySelector('nav');
  const main = shadow.querySelector('main');
  const toasts = shadow.querySelector('.toasts');
  const chip = shadow.querySelector('[data-timer-chip]');
  const palette = createPalette(shadow);
  const lastScroll = {};

  const render = () => {
    // Inside stay-on mode the panel isn't under the page's dark filter, so it themes itself.
    host.classList.toggle('dark', !!state.frame && isDark());
    host.classList.toggle('left', S.side === 'left');
    host.classList.toggle('wide', !!S.wide);
    host.style.setProperty('--accent', S.accent || '#2b6cde');
    const t = timerChip();
    chip.hidden = !t;
    chip.textContent = t;
    if (panel.hidden) return;

    const count = todoCount();
    const changes = gradeChanges();
    nav.innerHTML = TABS.map(([k, label]) => {
      let badge = '';
      if (k === 'todo' && count) badge = `<span class="count">${count}</span>`;
      if (k === 'grades' && changes) badge = '<span class="new" title="Grades changed"></span>';
      return `<button class="tab" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${label}${badge}</button>`;
    }).join('');

    const view = { todo: renderTodo, grades: renderGrades, gpa: renderGpa, tools: renderTools, settings: renderSettings }[S.tab] || renderTodo;
    const focusId = shadow.activeElement && shadow.activeElement.id;
    const key = S.tab + (S.tab === 'settings' ? S.setTab : '');
    const prevKey = main.dataset.view;
    if (prevKey) lastScroll[prevKey] = main.scrollTop;
    const html = view();
    if (main.dataset.sig !== html || prevKey !== key) {
      main.innerHTML = html;
      main.dataset.sig = html;
    }
    main.dataset.view = key;
    main.scrollTop = lastScroll[key] || 0;
    if (focusId) {
      const el = shadow.getElementById(focusId);
      if (el) el.focus();
    }
  };

  const show = (tab) => {
    if (tab) {
      S.tab = tab;
      save();
    }
    panel.hidden = false;
    render();
  };
  const hide = () => {
    panel.hidden = true;
  };

  // ---------- toasts ----------

  const toast = (html, { kind = 'info', ms = 6000, actions = '' } = {}) => {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<div class="tbody">${kind === 'error' ? esc(html) : html}</div>${actions}
      <button class="icon sm" data-act="dismiss" aria-label="Dismiss">${ICONS.close}</button>`;
    toasts.appendChild(el);
    while (toasts.children.length > 4) toasts.firstChild.remove();
    if (ms) setTimeout(() => el.remove(), ms);
    return el;
  };

  hooks.toast = toast;
  hooks.dismissToast = (btn) => {
    const el = btn.closest('.toast');
    if (el) {
      if (el.dataset.key) hooks.onDismiss && hooks.onDismiss(el.dataset.key);
      el.remove();
    }
  };
  hooks.openPanel = (tab) => show(tab);
  hooks.hidePanel = hide;
  hooks.palette = () => palette.open();

  hooks.onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      if (palette.isOpen()) palette.close();
      else palette.open();
    } else if (e.altKey && !mod && e.code === 'KeyQ') {
      e.preventDefault();
      if (panel.hidden) show();
      else hide();
    } else if (e.key === 'Escape' && !isTyping(e)) {
      if (palette.isOpen()) palette.close();
      else if (!panel.hidden) hide();
    }
  };
  // In normal mode page.js listens on the Canvas document; in stay-on mode the outer page needs its own listener.
  document.addEventListener('keydown', (e) => state.frame && hooks.onKey(e), true);
  shadow.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !palette.isOpen() && !panel.hidden) {
      e.stopPropagation();
      hide();
    }
  });

  startTicker(() => [shadow]);

  return {
    host,
    render,
    show,
    hide,
    toggle: () => (panel.hidden ? show() : hide()),
    isOpen: () => !panel.hidden,
  };
};
