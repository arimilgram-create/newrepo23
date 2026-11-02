// Shared runtime state and a tiny change bus, so modules don't import each other in circles.

export const state = {
  courses: null, // [{ id, name, originalName, code, score, letter, hidden, student }]
  items: null, // Canvas planner items
  itemIndex: new Map(),
  colors: {}, // "course_123" -> "#hex"
  error: null,
  loading: false,
  loadedAt: 0,
  frame: null, // the <iframe> in stay-on mode
  ui: {
    adding: false,
    importing: false,
    confirmReset: false,
    final: { course: '', current: '', weight: 20, target: 90 },
    busy: '',
  },
};

const subs = new Set();
let queued = false;

export const subscribe = (fn) => subs.add(fn);

// Batches re-renders into one per frame.
export const changed = () => {
  if (queued) return;
  queued = true;
  Promise.resolve().then(() => {
    queued = false;
    subs.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('[Quad]', e);
      }
    });
  });
};

// Filled in by the panel: lets data and page code reach UI without import cycles.
export const hooks = {
  toast: () => {},
  openPanel: () => {},
  palette: () => {},
  onKey: () => {},
};

// Navigate Canvas. In stay-on mode this moves the inner frame so Quad keeps running.
export const go = (url) => {
  if (state.frame) {
    state.frame.contentWindow.location.href = url;
  } else {
    location.href = url;
  }
};

export const currentDoc = () => {
  if (state.frame) {
    try {
      return state.frame.contentDocument || document;
    } catch (e) {
      return document;
    }
  }
  return document;
};
