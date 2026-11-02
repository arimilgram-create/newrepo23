const KEY = 'quad:v2';

export const DEFAULTS = {
  // look
  darkMode: 'off', // off | on | device | schedule
  darkLevel: 'dark', // dim | dark | black
  darkFrom: '19:00',
  darkTo: '07:00',
  theme: 'default',
  navColor: '',
  accent: '',
  font: '',
  themeRecolor: false,
  // dashboard
  cardGrades: true,
  cardAssignments: true,
  cardAssignmentCount: 3,
  cardStyle: 'default', // default | solid | gradient
  condensedCards: false,
  cardRadius: '', // '' | 0 | 12 | 20
  fullWidth: false,
  hideLogo: false,
  hideFeedback: false,
  betterTodo: true,
  dashNotes: false,
  cards: {}, // courseId -> { image }
  // to-do
  days: 14,
  hideDone: false,
  relativeDates: true,
  clock24: false,
  showOverdue: true,
  todoCourse: 'all',
  // reminders
  reminders: true,
  remindHours: 24,
  desktopNotify: false,
  dismissed: {}, // itemKey -> due timestamp
  // grades + gpa
  seen: null, // courseId -> score last time you looked
  gpaScale: 'standard',
  gpa: {}, // courseId -> { credits, weight, skip, whatIf }
  pastGpa: '',
  pastCredits: '',
  cumWeighted: false,
  // tools
  notes: '',
  timer: { focus: 25, brk: 5, phase: 'focus', endsAt: 0, left: 0, done: 0, doneDay: '' },
  // panel
  stayOn: false,
  side: 'right',
  wide: false,
  tab: 'todo',
  setTab: 'look',
};

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (e) {
    return null;
  }
};

const load = () => {
  const saved = read(KEY);
  if (saved) return Object.assign({}, DEFAULTS, saved);
  // Carry over settings from Quad 1.
  const v1 = read('quad:v1') || {};
  const s = Object.assign({}, DEFAULTS);
  if (v1.dark) s.darkMode = 'on';
  ['cardGrades', 'hideDone', 'days', 'gpa'].forEach((k) => {
    if (v1[k] !== undefined) s[k] = v1[k];
  });
  if (v1.hideCardImages) s.cardStyle = 'solid';
  return s;
};

export const S = load();

export const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    /* storage blocked: settings last until the page closes */
  }
};

export const resetAll = () => {
  Object.keys(S).forEach((k) => delete S[k]);
  Object.assign(S, JSON.parse(JSON.stringify(DEFAULTS)));
  save();
};

export const importSettings = (json) => {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object') throw new Error('That isn’t Quad settings.');
  Object.keys(DEFAULTS).forEach((k) => {
    if (data[k] !== undefined) S[k] = data[k];
  });
  save();
};

const minutes = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const inSchedule = (from, to, now = new Date()) => {
  const t = now.getHours() * 60 + now.getMinutes();
  const a = minutes(from);
  const b = minutes(to);
  return a <= b ? t >= a && t < b : t >= a || t < b;
};

export const isDark = () => {
  switch (S.darkMode) {
    case 'on':
      return true;
    case 'device':
      return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    case 'schedule':
      return inSchedule(S.darkFrom, S.darkTo);
    default:
      return false;
  }
};
