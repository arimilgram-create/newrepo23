// Maps real Canvas URLs to Homeroom views, so links, reloads and the back button all work.
// Pages Homeroom redraws get their own view; every other Canvas page opens inside Homeroom's frame view.

const ROUTES = [
  { name: 'home', re: /^\/(?:courses\/?)?$/ },
  { name: 'calendar', re: /^\/calendar\/?$/ },
  { name: 'stream', re: /^\/courses\/(\d+)\/?$/ },
  { name: 'classwork', re: /^\/courses\/(\d+)\/(?:modules|assignments)\/?$/ },
  { name: 'people', re: /^\/courses\/(\d+)\/(?:users|people)\/?$/ },
  { name: 'grades', re: /^\/courses\/(\d+)\/grades\/?$/ },
  { name: 'assignment', re: /^\/courses\/(\d+)\/assignments\/(\d+)\/?$/ },
  { name: 'discussion', re: /^\/courses\/(\d+)\/(?:discussion_topics|announcements)\/(\d+)\/?$/ },
  { name: 'quiz', re: /^\/courses\/(\d+)\/quizzes\/(\d+)\/?$/ },
  { name: 'page', re: /^\/courses\/(\d+)\/(?:pages|wiki)\/([^/]+)\/?$/ },
  { name: 'file', re: /^\/courses\/(\d+)\/files\/(\d+)\/?$/ },
  { name: 'moduleItem', re: /^\/courses\/(\d+)\/modules\/items\/(\d+)\/?$/ },
];

// Canvas pages that must load for real: sign-in, downloads and raw API responses.
const NEVER = /^\/(?:api|login|logout|oauth2?|saml|register|enroll|files\/\d+\/download)\b|\/download\/?$|\/preview\/?$|^\/courses\/\d+\/files\/\d+\/download/;

export const match = (loc = location) => {
  const params = new URLSearchParams(loc.search);
  const hr = params.get('hr');
  if (hr === 'off' || NEVER.test(loc.pathname)) return null;
  const course = loc.pathname.match(/^\/courses\/(\d+)/);
  if (hr !== 'frame') {
    for (const r of ROUTES) {
      const m = loc.pathname.match(r.re);
      if (!m) continue;
      let name = r.name;
      // The to-do list has no Canvas page of its own, so it lives on the home URL's hash.
      if (name === 'home' && /^#todo/.test(loc.hash)) name = 'todo';
      return { name, courseId: m[1] || null, itemId: m[2] ? decodeURIComponent(m[2]) : null, assignmentId: m[2] || null, params, hash: loc.hash.slice(1) };
    }
  }
  // Anything else on Canvas: show the real Canvas page, framed inside Homeroom.
  return { name: 'frame', courseId: course ? course[1] : null, itemId: null, params, hash: loc.hash.slice(1) };
};

export const isCourseRoute = (route) => !!(route && route.courseId);

// Where "Back to Homeroom" should take you from a Canvas page.
export const homeroomFor = (pathname) => {
  const m = pathname.match(/^\/courses\/(\d+)/);
  return m ? `/courses/${m[1]}` : '/';
};

// The same page in Canvas's own look (opens in a new tab from Homeroom).
export const canvasUrl = (loc = location) => {
  const url = new URL(loc.href);
  if (url.hash.startsWith('#todo')) {
    url.hash = '';
    url.pathname = '/';
  }
  url.searchParams.set('hr', 'off');
  return url.pathname + url.search + url.hash;
};

// A Canvas page shown inside Homeroom's frame view.
export const framed = (path) => {
  const url = new URL(path, location.origin);
  url.searchParams.set('hr', 'frame');
  return url.pathname + url.search + url.hash;
};

// Where a Canvas module item, planner item or link lives in Homeroom.
export const hrefFor = (courseId, type, item = {}) => {
  const c = `/courses/${courseId}`;
  switch (type) {
    case 'Assignment':
    case 'assignment':
      return `${c}/assignments/${item.content_id || item.id}`;
    case 'Quiz':
    case 'quiz':
      return `${c}/quizzes/${item.content_id || item.id}`;
    case 'Discussion':
    case 'discussion_topic':
    case 'announcement':
      return `${c}/discussion_topics/${item.content_id || item.id}`;
    case 'Page':
    case 'wiki_page':
      return item.page_url ? `${c}/pages/${encodeURIComponent(item.page_url)}` : item.html_url || c;
    case 'File':
      return `${c}/files/${item.content_id || item.id}`;
    case 'ExternalUrl':
      return item.external_url || item.html_url || c;
    default:
      return item.id ? framed(`${c}/modules/items/${item.id}`) : c;
  }
};

// Where an assignment opens: quizzes and graded discussions have their own pages.
export const assignmentHref = (courseId, a) => {
  if (a.is_quiz_assignment && a.quiz_id) return `/courses/${courseId}/quizzes/${a.quiz_id}`;
  if (a.discussion_topic && a.discussion_topic.id) return `/courses/${courseId}/discussion_topics/${a.discussion_topic.id}`;
  return `/courses/${courseId}/assignments/${a.id}`;
};
