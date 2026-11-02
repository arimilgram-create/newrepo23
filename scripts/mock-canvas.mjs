// A pretend Canvas site for the tests: Canvas-looking HTML pages plus the API responses Homeroom uses.
// Each test process gets fresh data; writes are recorded in `calls`.
export const ORIGIN = 'https://school.instructure.com';

export const DAY = 864e5;
export const at = (days, h = 23, m = 59) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

// ---------- mock Canvas data ----------

const teacher = (id, name) => ({ id, display_name: name, avatar_image_url: `${ORIGIN}/images/messages/avatar-50.png` });
const enr = (score, grade) => [{ type: 'student', computed_current_score: score, computed_current_grade: grade }];
const courses = [
  { id: 1, name: 'AP Calculus BC', course_code: 'MATH 252', sections: [{ name: 'Period 3' }], teachers: [teacher(70, 'Dana Whitfield')], enrollments: enr(91.24, 'A-') },
  { id: 2, name: 'Honors Chemistry', course_code: 'CHEM 210', sections: [{ name: 'Period 5' }], teachers: [teacher(71, 'Marcus Lee')], enrollments: enr(84.6, 'B') },
  { id: 4, name: 'American Literature', course_code: 'ENG 11', sections: [{ name: 'Period 1' }], teachers: [teacher(72, 'Priya Raman')], enrollments: enr(96, 'A') },
  { id: 3, name: 'Robotics Club', course_code: 'CLUB', teachers: [teacher(73, 'Sam Ortiz')], enrollments: [{ type: 'ta' }] },
];
const sub = (o = {}) => ({ workflow_state: 'unsubmitted', submitted_at: null, score: null, missing: false, late: false, attempt: null, ...o });
const assignments = {
  1: [
    { id: 101, name: 'Problem set 6: Series', due_at: at(2), points_possible: 25, submission_types: ['online_upload'], created_at: at(-3, 9), description: '<p>Complete problems <b>1–20</b> on page 412.</p>', submission: sub() },
    { id: 102, name: 'Quiz 7', due_at: at(-1, 9), points_possible: 10, submission_types: ['online_quiz'], is_quiz_assignment: true, created_at: at(-6, 9), submission: sub({ workflow_state: 'graded', submitted_at: at(-1, 8), score: 9, posted_at: at(-1, 12) }) },
    { id: 103, name: 'Problem set 5: Integrals', due_at: at(-3), points_possible: 25, submission_types: ['online_upload'], created_at: at(-9, 9), submission: sub({ missing: true }) },
    { id: 104, name: 'Read section 10.3', due_at: at(1), points_possible: 0, submission_types: ['none'], created_at: at(-1, 9), submission: sub() },
  ],
  2: [
    { id: 201, name: 'Lab report: Titration', due_at: at(5), points_possible: 50, submission_types: ['online_url', 'online_upload'], created_at: at(-2, 10), description: '<p>Share a link to your lab doc.</p>', submission: sub() },
    { id: 202, name: 'Reflection: Lab safety', due_at: at(9), points_possible: 10, submission_types: ['online_text_entry'], created_at: at(-2, 10), submission: sub() },
  ],
  4: [{ id: 401, name: 'Essay draft', due_at: null, points_possible: 100, submission_types: ['online_upload'], created_at: at(-4, 10), submission: sub() }],
};
for (const [cid, list] of Object.entries(assignments)) list.forEach((a) => Object.assign(a, { course_id: Number(cid), published: true, html_url: `${ORIGIN}/courses/${cid}/assignments/${a.id}` }));

const planner = () =>
  Object.values(assignments).flat().filter((a) => a.due_at).map((a) => ({
    plannable_id: a.id, plannable_type: 'assignment', course_id: a.course_id, plannable_date: a.due_at,
    html_url: `/courses/${a.course_id}/assignments/${a.id}`, plannable: { title: a.name },
    submissions: { submitted: !!a.submission.submitted_at }, planner_override: null,
  }));

const announcements = [
  { id: 900, title: 'Test on Friday', posted_at: at(-1, 8), author: { display_name: 'Dana Whitfield' }, discussion_subentry_count: 3,
    html_url: `${ORIGIN}/courses/1/discussion_topics/900`,
    message: '<p>Chapter 10 test this Friday. Bring a calculator.</p><script>window.pwned = 1</script><img src="x" onerror="window.pwned=2">' },
];
const modules = {
  1: [
    { id: 11, name: 'Unit 10: Infinite series', state: 'unlocked', items: [
      { id: 1, type: 'SubHeader', title: 'Week 1' },
      { id: 2, type: 'Page', title: 'Notes: Convergence tests', html_url: `${ORIGIN}/courses/1/pages/notes` },
      { id: 3, type: 'Assignment', title: 'Problem set 6: Series', content_id: 101 },
      { id: 4, type: 'Assignment', title: 'Read section 10.3', content_id: 104 },
      { id: 5, type: 'ExternalUrl', title: 'Desmos graphing', external_url: 'https://www.desmos.com', html_url: `${ORIGIN}/courses/1/modules/items/5` },
    ] },
    { id: 12, name: 'Unit 9: Integration review', state: 'unlocked', items: [
      { id: 6, type: 'Assignment', title: 'Problem set 5: Integrals', content_id: 103 },
      { id: 7, type: 'Quiz', title: 'Quiz 7', content_id: 102 },
    ] },
  ],
};

export const calls = [];

export const route = async (r) => {
  const req = r.request();
  const url = new URL(req.url());
  const p = url.pathname;
  const method = req.method();
  const json = (data, headers = {}) => r.fulfill({ status: 200, contentType: 'application/json', headers, body: 'while(1);' + JSON.stringify(data) });
  if (method !== 'GET') {
    let body = null;
    try {
      body = req.postDataJSON();
    } catch (e) {
      body = '(form data)';
    }
    calls.push({ method, path: p, body, csrf: req.headers()['x-csrf-token'] });
  }
  if (p === '/files_api/upload') return json({ id: 777, display_name: 'work.pdf' });
  if (!p.startsWith('/api/')) {
    return r.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html class="canvas"><head><title>Canvas page</title></head><body><div id="application" class="ic-app"><h1>Canvas ${p}</h1></div>
        <script>window.ENV = {}; window.canvasRan = true; window.ticks = 0;
          setInterval(() => { window.ticks++; }, 30);
          addEventListener('popstate', () => { window.canvasPopstate = (window.canvasPopstate || 0) + 1; });
          document.addEventListener('click', () => { window.canvasClicks = (window.canvasClicks || 0) + 1; });</script></body></html>`,
    });
  }
  let m;
  if (p === '/api/v1/users/self') return json({ id: 9, name: 'Ari Student', avatar_url: `${ORIGIN}/images/messages/avatar-50.png` });
  if (p === '/api/v1/users/self/colors') return json({ custom_colors: { course_1: '#1967d2', course_2: '#c5221f', course_4: '#7627bb' } });
  if ((m = p.match(/^\/api\/v1\/users\/self\/colors\/course_(\d+)$/))) return json({ hexcode: '#' + req.postDataJSON().hexcode });
  if (p === '/api/v1/dashboard/dashboard_cards') return json([{ id: 1 }, { id: 2 }, { id: 4 }]);
  if (p === '/api/v1/courses') return json(courses);
  if (p === '/api/v1/planner/items') {
    const cc = url.searchParams.get('context_codes[]');
    const s = new Date(url.searchParams.get('start_date'));
    const e = new Date(url.searchParams.get('end_date'));
    return json(planner().filter((it) => (!cc || cc === `course_${it.course_id}`) && new Date(it.plannable_date) >= s && new Date(it.plannable_date) < e));
  }
  if (p === '/api/v1/planner/overrides') return json({ id: 55, marked_complete: true });
  if (p === '/api/v1/announcements') return json(url.searchParams.get('context_codes[]') === 'course_1' ? announcements : []);
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments$/))) return json(assignments[m[1]] || []);
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments\/(\d+)/)) && !(assignments[m[1]] || []).some((a) => a.id === Number(m[2]))) {
    return r.fulfill({ status: 404, body: '{}' });
  }
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments\/(\d+)$/))) return json(assignments[m[1]].find((a) => a.id === Number(m[2])));
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments\/(\d+)\/submissions\/self\/files$/))) {
    return json({ upload_url: `${ORIGIN}/files_api/upload`, upload_params: { key: 'abc' } });
  }
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments\/(\d+)\/submissions\/self$/))) {
    const a = assignments[m[1]].find((x) => x.id === Number(m[2]));
    return json({ ...a.submission, submission_comments: [{ author_name: 'Dana Whitfield', comment: 'Show your work on #14.', created_at: at(-1, 15) }] });
  }
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignments\/(\d+)\/submissions$/))) {
    const a = assignments[m[1]].find((x) => x.id === Number(m[2]));
    a.submission = sub({ workflow_state: 'submitted', submitted_at: new Date().toISOString(), attempt: 1, attachments: [{ display_name: 'work.pdf', url: '#' }] });
    return json(a.submission);
  }
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/modules$/))) return json(modules[m[1]] || []);
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/assignment_groups$/))) {
    return json([{ id: 1, name: 'Labs', assignments: assignments[m[1]].filter((a) => /Lab/.test(a.name)) }, { id: 2, name: 'Reflections', assignments: assignments[m[1]].filter((a) => !/Lab/.test(a.name)) }]);
  }
  if ((m = p.match(/^\/api\/v1\/courses\/(\d+)\/users$/))) {
    const types = url.searchParams.getAll('enrollment_type[]');
    if (types.includes('student') && m[1] === '2') return r.fulfill({ status: 403, body: '{}' });
    if (types.includes('teacher')) return json([{ id: 70, name: courses.find((c) => String(c.id) === m[1]).teachers[0].display_name }]);
    return json(['Jordan Kim', 'Alex Rivera', 'Sam Patel', 'Taylor Brooks', 'Morgan Chen'].map((name, i) => ({ id: 100 + i, name })));
  }
  return r.fulfill({ status: 404, body: '{}' });
};

