// One event handler for every Quad surface (the panel and the dashboard embeds).
import { S, save, resetAll, importSettings } from './settings.js';
import { state, changed, hooks, go } from './store.js';
import {
  setDone, addTodo, deleteTodo, markGradesSeen, setCourseColor, setNickname,
  applyPalette, buildIcs, reloadItems, loadAll, dueOf,
} from './data.js';
import { THEMES, PALETTES } from './themes.js';
import { timerAction } from './timer.js';
import { isHex } from './util.js';

const NUMERIC = new Set(['days', 'cardAssignmentCount', 'remindHours']);

let notesTimer = 0;

const busy = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    hooks.toast(`${label} didn’t work: ${e.message}`, { kind: 'error' });
  }
};

const download = (name, text, type) => {
  const doc = document;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = doc.createElement('a');
  a.href = url;
  a.download = name;
  doc.documentElement.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
};

const applyTheme = async (id) => {
  const t = THEMES.find((x) => x.id === id);
  if (!t) return;
  S.theme = t.id;
  S.navColor = t.nav;
  S.accent = t.accent;
  S.font = t.font;
  if (t.dark) S.darkMode = 'on';
  else if (t.id === 'default' && S.darkMode === 'on') S.darkMode = 'off';
  save();
  changed();
  if (S.themeRecolor && t.palette) {
    await busy('Recoloring cards', async () => {
      await applyPalette(PALETTES[t.palette].colors);
      hooks.toast(`Applied ${t.name} and recolored your cards.`);
    });
  } else {
    hooks.toast(`Applied the ${t.name} theme.`);
  }
};

const onClick = async (e) => {
  const t = e.target.closest('[data-act], [data-tab], [data-settab], a[href]');
  if (!t) return;

  if (t.matches('a[href]') && !t.dataset.act) {
    // Keep Quad alive in stay-on mode by steering the inner frame instead of the whole tab.
    if (state.frame && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0 && !t.target) {
      e.preventDefault();
      go(t.getAttribute('href'));
    }
    return;
  }
  if (t.dataset.settab) {
    S.setTab = t.dataset.settab;
    save();
    changed();
    return;
  }
  if (t.dataset.tab && !t.dataset.act) {
    S.tab = t.dataset.tab;
    save();
    changed();
    return;
  }

  const act = t.dataset.act;
  switch (act) {
    case 'close':
      hooks.hidePanel();
      break;
    case 'refresh':
      state.courses = state.items = null;
      loadAll();
      break;
    case 'palette':
      hooks.palette();
      break;
    case 'open-panel':
      hooks.openPanel(t.dataset.tab || 'todo');
      break;
    case 'add-open-panel':
      state.ui.adding = true;
      hooks.openPanel('todo');
      break;
    case 'add-open':
      state.ui.adding = true;
      changed();
      {
        const root = t.getRootNode();
        setTimeout(() => {
          const input = root.getElementById && root.getElementById('add-title');
          if (input) input.focus();
        }, 30);
      }
      break;
    case 'add-cancel':
      state.ui.adding = false;
      changed();
      break;
    case 'del-note': {
      const it = state.itemIndex.get(t.dataset.item);
      if (it) await busy('Deleting', () => deleteTodo(it));
      break;
    }
    case 'mark-seen':
      markGradesSeen();
      break;
    case 'theme':
      await applyTheme(t.dataset.id);
      break;
    case 'palette-apply': {
      const p = PALETTES[t.dataset.id];
      hooks.toast(`Recoloring your courses with ${p.name}…`);
      await busy('Recoloring cards', async () => {
        await applyPalette(p.colors);
        hooks.toast(`Done. Your cards now use ${p.name}.`);
      });
      break;
    }
    case 'clear':
      S[t.dataset.key] = '';
      S.theme = 'custom';
      save();
      changed();
      break;
    case 'timer-start':
    case 'timer-pause':
    case 'timer-reset':
    case 'timer-skip':
      timerAction(act.slice(6));
      break;
    case 'export-ics': {
      const items = (state.items || []).filter((it) => dueOf(it).getTime() >= Date.now());
      download('canvas-due-dates.ics', buildIcs(items), 'text/calendar');
      hooks.toast(`Downloaded ${items.length} due date${items.length === 1 ? '' : 's'}. Open the file to add them to your calendar.`);
      break;
    }
    case 'export-settings': {
      const ok = await copy(JSON.stringify(S));
      hooks.toast(ok ? 'Settings copied. Paste them into Quad on your other browser.' : 'Couldn’t reach the clipboard. Try again after clicking the page.');
      break;
    }
    case 'import-open':
      state.ui.importing = true;
      changed();
      break;
    case 'import-cancel':
      state.ui.importing = false;
      changed();
      break;
    case 'import-apply': {
      const box = t.getRootNode().getElementById('import-box');
      try {
        importSettings(box.value);
        state.ui.importing = false;
        hooks.toast('Settings imported.');
        changed();
      } catch (err) {
        hooks.toast('That text isn’t a Quad settings backup. Copy it again and paste the whole thing.', { kind: 'error' });
      }
      break;
    }
    case 'reset-ask':
      state.ui.confirmReset = true;
      changed();
      break;
    case 'reset-cancel':
      state.ui.confirmReset = false;
      changed();
      break;
    case 'reset-all':
      resetAll();
      state.ui.confirmReset = false;
      hooks.toast('Quad is back to its defaults.');
      changed();
      break;
    case 'dismiss':
      hooks.dismissToast(t);
      break;
    default:
      break;
  }
};

const onChange = async (e) => {
  const t = e.composedPath()[0];
  const d = t.dataset || {};

  if (d.setting) {
    const key = d.setting;
    let value = t.type === 'checkbox' ? t.checked : t.value;
    if (d.num !== undefined || NUMERIC.has(key)) value = Number(value);
    if (key === 'cardRadius' && value !== '') value = Number(value);
    if ((key === 'navColor' || key === 'accent') && !isHex(value)) return;
    S[key] = value;
    if (key === 'navColor' || key === 'accent' || key === 'font') S.theme = 'custom';
    save();
    if (key === 'days') {
      state.items = null;
      changed();
      await reloadItems();
    } else if (key === 'stayOn') {
      hooks.stayOn(value);
    } else if (key === 'desktopNotify' && value) {
      hooks.askNotify();
    }
    changed();
    return;
  }

  if (d.item !== undefined && t.type === 'checkbox') {
    const it = state.itemIndex.get(d.item);
    if (!it) return;
    t.disabled = true;
    await busy('Updating Canvas', () => setDone(it, t.checked));
    changed();
    return;
  }

  if (d.gpa) {
    const id = d.course;
    const cfg = Object.assign({ credits: 1, weight: 0, skip: false, whatIf: '' }, S.gpa[id]);
    if (d.gpa === 'skip') cfg.skip = !t.checked;
    if (d.gpa === 'credits') cfg.credits = Math.max(0, Number(t.value) || 0);
    if (d.gpa === 'weight') cfg.weight = Number(t.value);
    if (d.gpa === 'whatIf') cfg.whatIf = t.value;
    S.gpa[id] = cfg;
    save();
    changed();
    return;
  }

  if (d.final) {
    const f = state.ui.final;
    f[d.final] = t.value;
    if (d.final === 'course' && t.value) {
      const c = state.courses.find((x) => x.id === t.value);
      if (c && c.score != null) f.current = String(Math.round(c.score * 100) / 100);
    }
    changed();
    return;
  }

  if (d.courseColor) {
    if (!isHex(t.value)) return;
    await busy('Saving the color', () => setCourseColor(d.courseColor, t.value));
    return;
  }
  if (d.courseNick) {
    await busy('Saving the nickname', () => setNickname(d.courseNick, t.value));
    return;
  }
  if (d.courseImg !== undefined && d.courseImg) {
    const url = t.value.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      hooks.toast('Use a link that starts with https://', { kind: 'error' });
      return;
    }
    S.cards[d.courseImg] = Object.assign({}, S.cards[d.courseImg], { image: url });
    save();
    changed();
    return;
  }
  if (d.timerPreset !== undefined) {
    timerAction('preset', t.value);
  }
};

const onInput = (e) => {
  const t = e.composedPath()[0];
  if (t.dataset && t.dataset.notes !== undefined) {
    S.notes = t.value;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(save, 300);
  }
};

const onSubmit = async (e) => {
  const form = e.composedPath()[0];
  if (!form.dataset || form.dataset.form !== 'add-todo') return;
  e.preventDefault();
  const title = form.elements.title.value.trim();
  if (!title) return;
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  await busy('Adding the to-do', async () => {
    await addTodo({ title, date: form.elements.date.value, courseId: form.elements.course.value });
    state.ui.adding = false;
    hooks.toast('Added to your to-do list.');
  });
  btn.disabled = false;
  changed();
};

export const bindUI = (root) => {
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  root.addEventListener('submit', onSubmit);
};
