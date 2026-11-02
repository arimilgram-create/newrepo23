const csrf = () => {
  const m = document.cookie.match(/(?:^|;\s*)_csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};

const nextLink = (header) => {
  const m = header && header.match(/<([^>]+)>;\s*rel="next"/);
  return m ? m[1] : null;
};

export const api = async (path, opts = {}) => {
  const headers = { Accept: 'application/json' };
  const method = opts.method || 'GET';
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = csrf();
  }
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) throw new Error('Canvas logged you out. Reload the page and sign in again.');
  if (!res.ok) throw new Error(`Canvas answered ${res.status} for ${path.split('?')[0]}`);
  const text = await res.text();
  return {
    data: text ? JSON.parse(text.replace(/^while\(1\);/, '')) : null,
    next: nextLink(res.headers.get('Link')),
  };
};

export const getAll = async (path, maxPages = 10) => {
  let out = [];
  let url = path;
  for (let i = 0; url && i < maxPages; i++) {
    const page = await api(url);
    out = out.concat(page.data || []);
    url = page.next;
  }
  return out;
};
