// Canvas REST API with a stale-while-revalidate cache, so pages show instantly and refresh quietly.

const memo = new Map(); // key -> { data, at }
const inflight = new Map(); // key -> Promise
const PREFIX = 'homeroom:cache:';
let onStale = () => {};

export const setOnStale = (fn) => {
  onStale = fn;
};

export class CanvasError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const csrf = () => {
  const m = document.cookie.match(/(?:^|;\s*)_csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};

const nextLink = (header) => {
  const m = header && header.match(/<([^>]+)>;\s*rel="next"/);
  return m ? m[1] : null;
};

export const request = async (path, { method = 'GET', body } = {}) => {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = csrf();
  }
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new CanvasError(401, 'Your Canvas session ended. Sign in again to keep going.');
  if (res.status === 403) throw new CanvasError(403, 'Your school doesn’t let students see this.');
  if (res.status === 404) throw new CanvasError(404, 'That page doesn’t exist, or you don’t have access to it.');
  if (!res.ok) throw new CanvasError(res.status, `Canvas had a problem (error ${res.status}). Try again in a moment.`);
  const text = await res.text();
  return { data: text ? JSON.parse(text.replace(/^while\(1\);/, '')) : null, next: nextLink(res.headers.get('Link')) };
};

const fetchAll = async (path, maxPages = 10) => {
  let out = [];
  let url = path;
  for (let i = 0; url && i < maxPages; i++) {
    const page = await request(url);
    out = out.concat(page.data || []);
    url = page.next;
  }
  return out;
};

const readSession = (key) => {
  try {
    return JSON.parse(sessionStorage.getItem(PREFIX + key) || 'null');
  } catch (e) {
    return null;
  }
};

const store = (key, data) => {
  const entry = { data, at: Date.now() };
  memo.set(key, entry);
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    /* storage full: memory cache still works */
  }
};

const load = (key, all) => {
  if (!inflight.has(key)) {
    const p = (all ? fetchAll(key) : request(key).then((r) => r.data)).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return inflight.get(key);
};

const revalidate = (key, all) => {
  if (inflight.has(key)) return;
  load(key, all)
    .then((data) => {
      const old = memo.get(key);
      const changed = !old || JSON.stringify(old.data) !== JSON.stringify(data);
      store(key, data);
      if (changed) onStale();
    })
    .catch(() => {});
};

/**
 * Cached GET. Returns cached data right away when there is some, refreshing it in the background;
 * when the refresh brings something new, onStale() re-renders the page.
 */
export const get = async (path, { all = false, fresh = 20000 } = {}) => {
  const hit = memo.get(path) || readSession(path);
  if (hit) {
    memo.set(path, hit);
    if (Date.now() - hit.at > fresh) revalidate(path, all);
    return hit.data;
  }
  const data = await load(path, all);
  store(path, data);
  return data;
};

// Drops cached responses whose path contains `part`, after a change.
export const invalidate = (part) => {
  [...memo.keys()].forEach((k) => k.includes(part) && memo.delete(k));
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX) && k.includes(part))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch (e) {
    /* ignore */
  }
};
