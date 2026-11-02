// "Stay on" mode: Canvas runs inside a full-window frame while Quad lives in the outer page,
// so Quad keeps working as you click from page to page.
import { state, changed } from './store.js';
import { attach, detach } from './page.js';
import { isDark } from './settings.js';
import { loadAll } from './data.js';

let current = null;

const sync = (doc) => {
  try {
    const href = doc.location.href;
    if (href !== location.href && href.startsWith(location.origin)) history.replaceState(null, '', href);
    if (doc.title && document.title !== doc.title) document.title = doc.title;
  } catch (e) {
    /* frame went cross-origin; leave the address bar alone */
  }
};

const poll = () => {
  let doc = null;
  try {
    doc = state.frame.contentDocument;
  } catch (e) {
    doc = null;
  }
  if (doc && doc !== current && doc.documentElement && doc.location.href !== 'about:blank') {
    current = doc;
    attach(doc);
    if (Date.now() - state.loadedAt > 3 * 6e4) loadAll({ quiet: true });
  }
  if (current) sync(current);
  state.frame.style.background = isDark() ? '#121212' : '#ffffff';
};

export const startStayOn = () => {
  if (state.frame) return;
  detach(document);
  const frame = document.createElement('iframe');
  frame.id = 'quad-frame';
  frame.title = 'Canvas';
  frame.setAttribute('allow', 'fullscreen; clipboard-read; clipboard-write; autoplay; camera; microphone; display-capture; geolocation');
  frame.setAttribute('allowfullscreen', '');
  frame.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;border:0;margin:0;padding:0;z-index:2147483646;display:block;';
  [...document.body.children].forEach((el) => el.setAttribute('inert', ''));
  document.documentElement.style.overflow = 'hidden';
  frame.src = location.href;
  document.body.appendChild(frame);
  state.frame = frame;
  setInterval(poll, 40);
  changed();
};

export const stopStayOn = () => {
  if (!state.frame) return;
  let href = location.href;
  try {
    href = state.frame.contentWindow.location.href;
  } catch (e) {
    /* use the last synced address */
  }
  location.replace(href);
};
