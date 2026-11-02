// Quad: Canvas power-ups that run from a bookmark, no browser extension needed.
// Click the bookmark on any Canvas page to start; click again to show or hide the panel.
import { S, save, isDark } from './settings.js';
import { subscribe, hooks } from './store.js';
import { attach, applyAll } from './page.js';
import { createPanel } from './panel.js';
import { loadAll } from './data.js';
import { startStayOn, stopStayOn } from './stayon.js';
import { showReminders, scheduleNotifications } from './reminders.js';

const NS = '__quad';

const boot = () => {
  const panel = createPanel();
  window[NS] = { toggle: panel.toggle, version: 2 };

  hooks.stayOn = (on) => {
    if (on) startStayOn();
    else stopStayOn();
  };

  subscribe(applyAll);
  subscribe(panel.render);

  if (S.stayOn) startStayOn();
  else attach(document);

  panel.show();
  loadAll().then(() => {
    showReminders();
    scheduleNotifications();
  });

  // Re-check scheduled and device-matched dark mode.
  let wasDark = isDark();
  const recheck = () => {
    const now = isDark();
    if (now !== wasDark) {
      wasDark = now;
      applyAll();
      panel.render();
    }
  };
  setInterval(recheck, 30000);
  if (window.matchMedia) {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', recheck);
  }
  save();
};

if (window[NS]) {
  window[NS].toggle();
} else if (!(window.ENV && document.getElementById('application'))) {
  alert("Quad works on Canvas. Open your school's Canvas site, then click the bookmark again.");
} else {
  boot();
}

