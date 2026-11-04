// Everything Homeroom reads from or writes to Canvas, shaped for the views.
import { get, request, invalidate } from './api.js';
import { colorFor, DAY } from './ui.js';

const enc = encodeURIComponent;

export const self = () => get('/api/v1/users/self');

export const colors = async () => {
  try {
    return (await get('/api/v1/users/self/colors')).custom_colors || {};
  } catch (e) {
    return {};
  }
};

const dashboardOrder = async () => {
  try {
    return (await get('/api/v1/dashboard/dashboard_cards')).map((c) => String(c.id));
  } catch (e) {
    return null;
  }
};

export const courses = async () => {
  const [list, custom, order] = await Promise.all([
    get(
      '/api/v1/courses?enrollment_state=active&include[]=teachers&include[]=total_scores' +
        '&include[]=current_grading_period_scores&include[]=course_image&include[]=sections&include[]=term&per_page=100',
      { all: true }
    ),
    colors(),
    dashboardOrder(),
  ]);
  const shaped = list
    .filter((c) => c && c.name && !c.access_restricted_by_date)
    .map((c) => {
      const id = String(c.id);
      const enr = (c.enrollments || []).find((e) => e.type === 'student') || (c.enrollments || [])[0] || {};
      const usePeriod = enr.multiple_grading_periods_enabled && enr.current_period_computed_current_score != null;
      const teacher = (c.teachers || [])[0] || null;
      const section = (c.sections || []).map((s) => s.name).find((n) => n && n !== c.name) || c.course_code || '';
      return {
        id,
        name: c.name,
        section: section === c.name ? '' : section,
        code: c.course_code || '',
        teacher: teacher ? teacher.display_name : '',
        teacherAvatar: teacher ? teacher.avatar_image_url : '',
        image: c.image_download_url || '',
        color: colorFor(id, custom[`course_${id}`]),
        student: enr.type === 'student',
        score: usePeriod ? enr.current_period_computed_current_score : enr.computed_current_score,
        grade: usePeriod ? enr.current_period_computed_current_grade : enr.computed_current_grade,
        hideGrades: !!c.hide_final_grades,
      };
    });
  if (order && order.length) {
    const rank = new Map(order.map((id, i) => [id, i]));
    shaped.forEach((c) => (c.onDashboard = rank.has(c.id)));
    shaped.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e6) - (rank.has(b.id) ? rank.get(b.id) : 1e6) || a.name.localeCompare(b.name));
  } else {
    shaped.forEach((c) => (c.onDashboard = true));
  }
  return shaped;
};

export const course = async (id) => {
  const list = await courses();
  const c = list.find((x) => x.id === String(id));
  if (c) return c;
  const raw = await get(`/api/v1/courses/${id}?include[]=teachers`);
  return { id: String(id), name: raw.name, section: raw.course_code || '', teacher: '', color: colorFor(id), student: true };
};

// ---------- assignments ----------

export const assignments = (courseId) =>
  get(`/api/v1/courses/${courseId}/assignments?include[]=submission&order_by=due_at&per_page=100`, { all: true }).catch((e) => {
    if (e.status === 403 || e.status === 404) return [];
    throw e;
  });

export const allAssignments = async () => {
  const list = (await courses()).filter((c) => c.student);
  const per = await Promise.all(list.map((c) => assignments(c.id).then((as) => as.map((a) => ({ ...a, course: c })))));
  return per.flat().filter((a) => a.published !== false);
};

const NO_SUBMIT = new Set(['none', 'on_paper', 'not_graded', 'external_tool']);
export const needsSubmission = (a) => !(a.submission_types || []).every((t) => NO_SUBMIT.has(t));

// Classroom-style status for one assignment from the student's point of view.
export const statusOf = (a, now = Date.now()) => {
  const s = a.submission || {};
  const due = a.due_at ? new Date(a.due_at).getTime() : null;
  if (s.excused) return { key: 'done', label: 'Excused', cls: 'muted' };
  const graded = s.score != null && (s.workflow_state === 'graded' || s.posted_at);
  if (graded) {
    const pts = a.points_possible;
    return { key: 'done', label: pts ? `${fmtNum(s.score)}/${fmtNum(pts)}` : s.grade || 'Graded', cls: 'graded', graded: true };
  }
  if (s.submitted_at) return { key: 'done', label: s.late ? 'Done late' : 'Turned in', cls: 'turned' };
  if (s.missing || (due && due < now && needsSubmission(a) && s.workflow_state === 'unsubmitted' && s.missing !== false)) {
    return { key: 'missing', label: 'Missing', cls: 'missing' };
  }
  return { key: 'assigned', label: 'Assigned', cls: 'assigned' };
};

export const fmtNum = (n) => (Math.round(Number(n) * 100) / 100).toString();

export const assignment = (courseId, id) => get(`/api/v1/courses/${courseId}/assignments/${id}?include[]=submission`);

export const submission = (courseId, id) =>
  get(`/api/v1/courses/${courseId}/assignments/${id}/submissions/self?include[]=submission_comments`, { fresh: 5000 });

// ---------- stream, classwork, people ----------

export const announcements = (courseId) => {
  const end = new Date(Date.now() + DAY).toISOString().slice(0, 10);
  return get(`/api/v1/announcements?context_codes[]=course_${courseId}&start_date=2000-01-01&end_date=${end}&per_page=50`).catch(() => []);
};

export const modules = (courseId) =>
  get(`/api/v1/courses/${courseId}/modules?include[]=items&include[]=content_details&per_page=50`, { all: true }).catch((e) => {
    if (e.status === 403 || e.status === 404) return [];
    throw e;
  });

export const assignmentGroups = (courseId) =>
  get(`/api/v1/courses/${courseId}/assignment_groups?include[]=assignments&include[]=submission&per_page=50`, { all: true }).catch(() => []);

export const people = async (courseId) => {
  const fetchType = (types) =>
    get(`/api/v1/courses/${courseId}/users?${types.map((t) => `enrollment_type[]=${t}`).join('&')}&include[]=avatar_url&per_page=100`, { all: true });
  const [teachers, students] = await Promise.all([
    fetchType(['teacher', 'ta']).catch(() => null),
    fetchType(['student']).catch(() => null),
  ]);
  return { teachers, students };
};

export const planner = (start, end, courseId) =>
  get(
    `/api/v1/planner/items?start_date=${enc(start.toISOString())}&end_date=${enc(end.toISOString())}` +
      (courseId ? `&context_codes[]=course_${courseId}` : '') +
      '&per_page=100',
    { all: true }
  );

// ---------- writes ----------

export const setCourseColor = async (courseId, hex) => {
  await request(`/api/v1/users/self/colors/course_${courseId}`, { method: 'PUT', body: { hexcode: hex.replace('#', '') } });
  invalidate('/users/self/colors');
};

const afterSubmit = (courseId, id) => {
  invalidate(`/courses/${courseId}/assignments`);
  invalidate(`/courses/${courseId}/assignment_groups`);
};

export const comment = async (courseId, id, text) => {
  await request(`/api/v1/courses/${courseId}/assignments/${id}/submissions/self`, {
    method: 'PUT',
    body: { comment: { text_comment: text } },
  });
  invalidate(`/assignments/${id}/submissions/self`);
};

const uploadFile = async (courseId, id, file) => {
  const { data: slot } = await request(`/api/v1/courses/${courseId}/assignments/${id}/submissions/self/files`, {
    method: 'POST',
    body: { name: file.name, size: file.size, content_type: file.type || 'application/octet-stream' },
  });
  const form = new FormData();
  Object.entries(slot.upload_params || {}).forEach(([k, v]) => form.append(k, v));
  form.append('file', file, file.name);
  const sameOrigin = new URL(slot.upload_url, location.href).origin === location.origin;
  const res = await fetch(slot.upload_url, { method: 'POST', body: form, credentials: sameOrigin ? 'same-origin' : 'omit' });
  if (!res.ok) throw new Error(`Uploading ${file.name} failed (error ${res.status}).`);
  const text = await res.text();
  const json = text ? JSON.parse(text.replace(/^while\(1\);/, '')) : {};
  if (json.id) return json.id;
  if (json.location) return (await request(json.location)).data.id;
  throw new Error(`Canvas didn’t confirm the upload of ${file.name}.`);
};

export const turnIn = async (courseId, id, work) => {
  let body;
  if (work.type === 'online_upload') {
    const ids = [];
    for (const f of work.files) ids.push(await uploadFile(courseId, id, f));
    body = { submission_type: 'online_upload', file_ids: ids };
  } else if (work.type === 'online_url') {
    body = { submission_type: 'online_url', url: work.url };
  } else {
    body = { submission_type: 'online_text_entry', body: work.text };
  }
  await request(`/api/v1/courses/${courseId}/assignments/${id}/submissions`, { method: 'POST', body: { submission: body } });
  afterSubmit(courseId, id);
  invalidate(`/assignments/${id}`);
};

// "Mark as done" for work with nothing to hand in, via a Canvas planner override.
export const plannerOverride = async (courseId, a) => {
  const due = a.due_at ? new Date(a.due_at) : new Date();
  const items = await planner(new Date(due.getTime() - 2 * DAY), new Date(due.getTime() + 2 * DAY), courseId).catch(() => []);
  const it = items.find((x) => x.plannable_type === 'assignment' && String(x.plannable_id) === String(a.id));
  return it ? it.planner_override : null;
};

export const markDone = async (courseId, a, done) => {
  const o = await plannerOverride(courseId, a);
  if (o && o.id) {
    await request(`/api/v1/planner/overrides/${o.id}`, { method: 'PUT', body: { marked_complete: done } });
  } else {
    await request('/api/v1/planner/overrides', {
      method: 'POST',
      body: { plannable_type: 'assignment', plannable_id: a.id, marked_complete: done },
    });
  }
  invalidate('/planner/items');
};

// ---------- discussions and announcements ----------

export const discussion = (courseId, id) => get(`/api/v1/courses/${courseId}/discussion_topics/${id}`);

// The reply thread. Canvas hides replies until you post when the teacher asks for that.
export const discussionThread = async (courseId, id) => {
  try {
    return await get(`/api/v1/courses/${courseId}/discussion_topics/${id}/view?include_new_entries=1`, { fresh: 5000 });
  } catch (e) {
    if (e.status === 403) return { mustPost: true, view: [], participants: [] };
    throw e;
  }
};

const toHtml = (text) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]).replace(/\n/g, '<br>')}</p>`)
    .join('');

export const postReply = async (courseId, topicId, text, parentId) => {
  const path = parentId
    ? `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries/${parentId}/replies`
    : `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries`;
  const { data } = await request(path, { method: 'POST', body: { message: toHtml(text) } });
  invalidate(`/discussion_topics/${topicId}`);
  return data;
};

// Flattens Canvas's nested replies into top-level comments with one level of answers, like a class comment thread.
export const threadOf = (view) => {
  const people = new Map((view.participants || []).map((p) => [p.id, p]));
  const shape = (e) => {
    const who = people.get(e.user_id) || {};
    return {
      id: e.id,
      name: who.display_name || e.user_name || 'Someone',
      avatar: who.avatar_image_url || '',
      at: e.created_at,
      html: e.deleted ? '' : e.message || '',
      deleted: !!e.deleted,
    };
  };
  const flat = (list, out = []) => {
    (list || []).forEach((e) => {
      out.push(shape(e));
      flat(e.replies, out);
    });
    return out;
  };
  return (view.view || []).map((e) => ({ ...shape(e), replies: flat(e.replies) }));
};

// ---------- pages, quizzes, files, module items ----------

export const wikiPage = (courseId, slug) =>
  get(slug === 'front_page' ? `/api/v1/courses/${courseId}/front_page` : `/api/v1/courses/${courseId}/pages/${encodeURIComponent(slug)}`);

export const quiz = (courseId, id) => get(`/api/v1/courses/${courseId}/quizzes/${id}`);

export const quizAttempts = async (courseId, id) => {
  try {
    const data = await get(`/api/v1/courses/${courseId}/quizzes/${id}/submissions`, { fresh: 5000 });
    return (data && data.quiz_submissions) || [];
  } catch (e) {
    return [];
  }
};

export const file = (courseId, id) => get(`/api/v1/courses/${courseId}/files/${id}`);

export const moduleItemSequence = (courseId, id) =>
  get(`/api/v1/courses/${courseId}/module_item_sequence?asset_type=ModuleItem&asset_id=${id}`);
