// Homeroom as a bookmark. Click it on any Canvas page to swap Canvas for Homeroom in this tab;
// click it again to go back to regular Canvas.
import { startApp } from './content/app.js';
import { match, homeroomFor } from './content/router.js';

const NS = '__homeroom';

const onCanvas = () => !!(window.ENV && document.getElementById('application'));

const start = () => {
  window[NS] = true;

  // Start on the Homeroom version of this page, or the closest one (a quiz page opens its class).
  const url = new URL(location.href);
  url.searchParams.delete('hr');
  if (!match(url)) {
    url.pathname = homeroomFor(location.pathname);
    url.search = '';
    url.hash = '';
  }
  history.replaceState(null, '', url.pathname + url.search + url.hash);

  // Quiet Canvas's own page: stop its timers, then replace the document,
  // which also drops every listener Canvas put on it.
  const last = setTimeout(() => {}, 0);
  for (let id = 0; id <= last; id++) {
    clearTimeout(id);
    clearInterval(id);
  }
  document.open();
  document.write('<!doctype html><html><head></head><body></body></html>');
  document.close();
  startApp({ bookmarklet: true });
};

if (window[NS]) {
  // Second click: back to regular Canvas on the same page.
  location.reload();
} else if (!onCanvas()) {
  alert('Homeroom works on Canvas. Open your school’s Canvas site, then click the bookmark again.');
} else {
  start();
}
