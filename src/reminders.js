// Due-soon toasts and desktop notifications.
import { S, save } from './settings.js';
import { state, hooks } from './store.js';
import { dueSoon, itemKey, dueOf, titleOf, isDone } from './data.js';
import { esc, relTime, fmtTime } from './util.js';

const scheduled = new Map(); // itemKey -> timeout id

const pruneDismissed = () => {
  const now = Date.now();
  Object.keys(S.dismissed).forEach((k) => {
    if (S.dismissed[k] < now) delete S.dismissed[k];
  });
};

hooks.onDismiss = (key) => {
  const it = state.itemIndex.get(key);
  S.dismissed[key] = it ? dueOf(it).getTime() : Date.now() + 864e5;
  save();
};

export const showReminders = () => {
  if (!S.reminders || !state.items) return;
  pruneDismissed();
  const now = Date.now();
  const list = dueSoon(Number(S.remindHours) || 24, now).filter((it) => !S.dismissed[itemKey(it)]);
  list.slice(0, 3).forEach((it) => {
    const due = dueOf(it);
    const el = hooks.toast(
      `<b>Due ${esc(relTime(due, now))}</b> · ${esc(fmtTime(due, S.clock24))}<br>
       <a href="${esc(it.html_url || '/calendar')}">${esc(titleOf(it))}</a><br><span class="muted">${esc(it.context_name || '')}</span>`,
      { kind: 'reminder', ms: 0 }
    );
    el.dataset.key = itemKey(it);
  });
  if (list.length > 3) {
    hooks.toast(`And ${list.length - 3} more due soon. <button class="btn link" data-act="open-panel" data-tab="todo">See all</button>`, { ms: 12000 });
  }
};

hooks.askNotify = async () => {
  if (!('Notification' in window)) {
    hooks.toast('This browser doesn’t support desktop notifications.', { kind: 'error' });
    S.desktopNotify = false;
    save();
    return;
  }
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    S.desktopNotify = false;
    save();
    hooks.toast('Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.', { kind: 'error' });
  } else {
    hooks.toast('Desktop notifications are on.');
    scheduleNotifications();
  }
};

hooks.notify = (title, body) => {
  if (!S.desktopNotify || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag: `quad-${title}` });
  } catch (e) {
    /* some browsers only allow notifications from service workers */
  }
};

// Notify an hour before each unfinished item, for as long as this tab keeps Quad running.
export const scheduleNotifications = () => {
  scheduled.forEach((id) => clearTimeout(id));
  scheduled.clear();
  if (!S.desktopNotify || !state.items) return;
  const now = Date.now();
  state.items.forEach((it) => {
    if (isDone(it)) return;
    const at = dueOf(it).getTime() - 36e5;
    const wait = at - now;
    if (wait < -36e5 || wait > 864e5) return;
    scheduled.set(
      itemKey(it),
      setTimeout(() => {
        if (!isDone(it)) hooks.notify(`Due in about an hour: ${titleOf(it)}`, it.context_name || 'Canvas');
      }, Math.max(0, wait))
    );
  });
};
