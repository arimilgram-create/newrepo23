// Maps real Canvas URLs to Homeroom views, so links, reloads and the back button all work.

const ROUTES = [
  { name: 'home', re: /^\/(?:courses\/?)?$/ },
  { name: 'calendar', re: /^\/calendar\/?$/ },
  { name: 'stream', re: /^\/courses\/(\d+)\/?$/ },
  { name: 'classwork', re: /^\/courses\/(\d+)\/(?:modules|assignments)\/?$/ },
  { name: 'people', re: /^\/courses\/(\d+)\/(?:users|people)\/?$/ },
  { name: 'grades', re: /^\/courses\/(\d+)\/grades\/?$/ },
  { name: 'assignment', re: /^\/courses\/(\d+)\/assignments\/(\d+)\/?$/ },
];

export const match = (loc = location) => {
  const params = new URLSearchParams(loc.search);
  if (params.get('hr') === 'off') return null;
  for (const r of ROUTES) {
    const m = loc.pathname.match(r.re);
    if (!m) continue;
    let name = r.name;
    // The to-do list has no Canvas page of its own, so it lives on the home URL's hash.
    if (name === 'home' && /^#todo/.test(loc.hash)) name = 'todo';
    return { name, courseId: m[1] || null, assignmentId: m[2] || null, params, hash: loc.hash.slice(1) };
  }
  return null;
};

export const isCourseRoute = (route) => !!(route && route.courseId);

// Where "Back to Homeroom" should take you from a Canvas page Homeroom doesn't redo.
export const homeroomFor = (pathname) => {
  const m = pathname.match(/^\/courses\/(\d+)/);
  return m ? `/courses/${m[1]}` : '/';
};

export const canvasUrl = (loc = location) => {
  const url = new URL(loc.href);
  if (url.hash.startsWith('#todo')) {
    url.hash = '';
    url.pathname = '/';
  }
  url.searchParams.set('hr', 'off');
  return url.pathname + url.search + url.hash;
};
