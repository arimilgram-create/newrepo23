// Any Canvas page Homeroom doesn't redraw, shown inside Homeroom: the real page in a frame,
// with Canvas's own menus hidden, so you never leave Homeroom.
import { esc } from '../ui.js';
import { match } from '../router.js';
import { framedSrc } from './material.js';

// Hides Canvas's header, course menu, breadcrumbs and footer inside the frame.
const FRAME_CSS = `
  #header, .ic-app-header, #left-side, .ic-app-course-menu, #courseMenuToggle, .ic-app-nav-toggle-and-crumbs,
  #breadcrumbs, .ic-app-crumbs, #footer, .ic-app-footer, .mobile-header, #mobile-header, #nav-tray-portal,
  .ic-app-header__secondary-navigation, #skip_navigation_link { display: none !important; }
  .ic-Layout-wrapper, #wrapper { margin-left: 0 !important; max-width: none !important; }
  .ic-Layout-columns, #main, .ic-Layout-contentWrapper, .ic-app-main-content { margin-left: 0 !important; padding-left: 0 !important; }
  .ic-Layout-contentMain, #content { padding: 24px max(24px, 3vw) !important; }
  body { min-width: 0 !important; }
`;

const DARK_CSS = `
  html { filter: invert(.92) hue-rotate(180deg) !important; background: #fff !important; }
  img, video, picture, canvas, iframe, embed, object, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }
`;

export const frameView = async () => {
  const path = location.pathname + location.search + location.hash;
  return `<div class="frame-view"><iframe class="canvas-frame" src="${esc(framedSrc(path))}" title="Canvas page"
    allow="fullscreen; clipboard-read; clipboard-write; autoplay; camera; microphone; display-capture; geolocation" allowfullscreen></iframe></div>`;
};

const clearUrl = (href) => {
  const url = new URL(href);
  url.searchParams.delete('display');
  url.searchParams.delete('hr');
  return url;
};

/**
 * Watches the frame: styles each Canvas page it loads, keeps the address bar in sync,
 * and hands links to pages Homeroom redraws back to Homeroom.
 */
export const mountFrame = (main, { navigate, setTitle, dark }) => {
  const frame = main.querySelector('.canvas-frame');
  if (!frame) return;
  let current = null;
  // The page this frame was opened for. It may be one Homeroom also redraws (for example
  // "Start quiz" opens the Canvas quiz page on purpose), so only pages reached after it count.
  const start = clearUrl(new URL(frame.getAttribute('src'), location.origin).href);
  const startPath = start.pathname + start.search;

  const styleDoc = (doc) => {
    if (doc.getElementById('homeroom-frame-style')) return;
    const style = doc.createElement('style');
    style.id = 'homeroom-frame-style';
    style.textContent = FRAME_CSS + (dark() ? DARK_CSS : '');
    (doc.head || doc.documentElement).appendChild(style);
    doc.addEventListener(
      'click',
      (e) => {
        const a = e.target.closest && e.target.closest('a[href]');
        if (!a || a.target || a.hasAttribute('download') || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || a.dataset.method) return;
        const url = new URL(a.href, doc.baseURI);
        if (url.origin !== location.origin || /^javascript:/i.test(a.getAttribute('href'))) return;
        const r = match(clearUrl(url.href));
        if (r && r.name !== 'frame') {
          e.preventDefault();
          e.stopPropagation();
          navigate(clearUrl(url.href).href);
        }
      },
      true
    );
  };

  const sync = () => {
    if (!frame.isConnected) {
      clearInterval(timer);
      return;
    }
    let doc = null;
    try {
      doc = frame.contentDocument;
    } catch (e) {
      return;
    }
    if (!doc || !doc.documentElement || doc.location.href === 'about:blank') return;
    if (doc !== current) {
      current = doc;
      styleDoc(doc);
    }
    if (doc.readyState === 'loading') return;
    const url = clearUrl(doc.location.href);
    const here = url.pathname + url.search + url.hash;
    const r = match(url);
    // Canvas sent the frame somewhere Homeroom redraws (for example back to Modules after an action).
    if (r && r.name !== 'frame' && url.pathname + url.search !== startPath) {
      clearInterval(timer);
      navigate(url.href, { replace: true });
      return;
    }
    const shown = new URL(location.href);
    shown.searchParams.delete('hr');
    if (here !== shown.pathname + shown.search + shown.hash && !(r && r.name !== 'frame')) {
      const next = new URL(here, location.origin);
      next.searchParams.set('hr', 'frame');
      history.replaceState(null, '', next);
    }
    setTitle((doc.title || '').replace(/^\s*|\s*$/g, ''));
  };

  const timer = setInterval(sync, 60);
  frame.addEventListener('load', sync);
};
