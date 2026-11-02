// Homeroom content script. Runs at document_start on Canvas pages.
// Pages Homeroom redoes: stop Canvas loading and draw Homeroom instead.
// Everything else: leave Canvas alone and add a small "Back to Homeroom" button.
import { match, homeroomFor } from './router.js';
import { startApp, OFF_KEY } from './app.js';
import { LOGO, I } from './ui.js';

const isOff = () => {
  try {
    return localStorage.getItem(OFF_KEY) === '1';
  } catch (e) {
    return false;
  }
};

const takeOver = () => {
  // Replacing the document aborts Canvas's own page before any of its scripts run.
  // (window.stop() would do that too, but then Chrome never paints the tab.)
  document.open();
  document.write('<!doctype html><html><head></head><body></body></html>');
  document.close();
  startApp();
};

const PILL_CSS = `
  :host { all: initial; position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; font: 500 14px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .pill { display: flex; align-items: center; gap: 4px; background: #fff; color: #202124; border-radius: 999px;
    box-shadow: 0 1px 3px rgba(60,64,67,.3), 0 4px 10px rgba(60,64,67,.18); padding: 4px; }
  a { display: flex; align-items: center; gap: 8px; color: inherit; text-decoration: none; padding: 6px 12px 6px 6px; border-radius: 999px; }
  a:hover { background: #f1f3f4; }
  a:focus-visible, button:focus-visible { outline: 2px solid #0b8043; outline-offset: 2px; }
  button { all: unset; cursor: pointer; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; color: #5f6368; }
  button:hover { background: #f1f3f4; }
  .i { width: 16px; height: 16px; }
  .logo { --brand: #0b8043; --brand-2: #fbbc04; display: block; }
`;

const addPill = () => {
  if (window.top !== window || /^\/(login|api)\b/.test(location.pathname)) return;
  try {
    if (sessionStorage.getItem('homeroom:pill-hidden') === '1') return;
  } catch (e) {
    /* ignore */
  }
  const off = isOff();
  const url = new URL(location.href);
  const here = match(Object.assign(new URL(location.href), { search: '' }));
  url.searchParams.delete('hr');
  const href = here ? url.pathname + url.search + url.hash : homeroomFor(location.pathname);
  const label = off ? 'Turn Homeroom back on' : here ? 'Switch to Homeroom' : 'Back to Homeroom';

  const host = document.createElement('div');
  host.id = 'homeroom-pill';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${PILL_CSS}</style>
    <div class="pill"><a href="${href}">${LOGO(26)}<span>${label}</span></a>
    <button aria-label="Hide this button">${I.close()}</button></div>`;
  shadow.querySelector('a').addEventListener('click', () => {
    try {
      localStorage.removeItem(OFF_KEY);
    } catch (e) {
      /* ignore */
    }
  });
  shadow.querySelector('button').addEventListener('click', () => {
    host.remove();
    try {
      sessionStorage.setItem('homeroom:pill-hidden', '1');
    } catch (e) {
      /* ignore */
    }
  });
  document.documentElement.appendChild(host);
};

const route = match(location);
if (!location.pathname.startsWith('/api/')) {
  if (route && !isOff() && window.top === window) {
    takeOver();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addPill);
  } else {
    addPill();
  }
}
