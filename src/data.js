import { api, getAll } from './api.js';
import { S, save } from './settings.js';
import { state, changed, hooks } from './store.js';
import { DAY, fmtDayLabel } from './util.js';

// ---------- loading ----------

const loadCourses = async () => {
  const list = await getAll(
    '/api/v1/courses?enrollment_state=active&include[]=total_scores' +
      '&include[]=current_grading_period_scores&include[]=favorites&per_page=100'
  );
  state.courses = list
    .map((c) => {
      if (!c || !c.name || c.access_restricted_by_date) return null;
      const e = (c.enrollments || []).find((x) => x.type === 'student') || null;
      const usePeriod = e && e.multiple_grading_periods_enabled && e.current_period_computed_current_score != null;
      const score = e ? (usePeriod ? e.current_period_computed_current_score : e.computed_current_score) : null;
      const letter = e ? (usePeriod ? e.current_period_computed_current_grade : e.computed_current_grade) : null;
      return {
        id: String(c.id),
        name: c.name,
        originalName: c.original_name || c.name,
        code: c.course_code || '',
        score: score == null ? null : score,
        letter: letter || null,
        hidden: !!c.hide_final_grades,
        student: !!e,
        favorite: c.is_favorite !== false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
};

const loadItems = async () => {
  const start = new Date(Date.now() - 14 * DAY).toISOString();
  const end = new Date(Date.now() + Number(S.days) * DAY).toISOString();
  const list = await getAll(
    `/api/v1/planner/items?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&per_page=100`
  );
  state.items = list.filter((it) => it && it.plannable_type !== 'announcement');
  state.itemIndex = new Map(state.items.map((it) => [itemKey(it), it]));
};

const loadColors = async () => {
  state.colors = (await api('/api/v1/users/self/colors')).data.custom_colors || {};
};

export const loadAll = async ({ quiet } = {}) => {
  if (state.loading) return;
  state.loading = true;
  if (!quiet) changed();
  const results = await Promise.allSettled([loadCourses(), loadItems(), loadColors()]);
  const failed = results.find((r) => r.status === 'rejected');
  state.error = failed ? failed.reason.message || String(failed.reason) : null;
  state.loading = false;
  state.loadedAt = Date.now();
  if (state.courses && !S.seen) {
    S.seen = snapshotScores();
    save();
  }
  changed();
};

export const reloadItems = async () => {
  try {
    await loadItems();
    state.error = null;
  } catch (e) {
    state.error = e.message;
  }
  changed();
};

// ---------- planner items ----------

export const itemKey = (it) => `${it.plannable_type}:${it.plannable_id}`;
export const dueOf = (it) => new Date(it.plannable_date || (it.plannable && (it.plannable.due_at || it.plannable.todo_date)) || 0);
export const titleOf = (it) => (it.plannable && (it.plannable.title || it.plannable.name)) || 'Untitled';
export const submitted = (it) => !!(it.submissions && (it.submissions.submitted || it.submissions.excused || it.submissions.graded));
export const markedDone = (it) => !!(it.planner_override && it.planner_override.marked_complete);
export const isDone = (it) => submitted(it) || markedDone(it);
export const isNote = (it) => it.plannable_type === 'planner_note';
// Things you are expected to turn in or finish, as opposed to calendar events.
const isTask = (it) => !!it.submissions || isNote(it) || it.plannable_type === 'assessment_request';

export const courseColor = (courseId) => state.colors[`course_${courseId}`] || '';

export const courseName = (courseId) => {
  const c = state.courses && state.courses.find((x) => x.id === String(courseId));
  return c ? c.name : '';
};

export const todoGroups = ({ course = 'all', now = Date.now() } = {}) => {
  const overdue = [];
  const days = new Map();
  let pending = 0;
  (state.items || []).forEach((it) => {
    if (course !== 'all' && String(it.course_id) !== course) return;
    const d = dueOf(it);
    const done = isDone(it);
    if (d.getTime() < now) {
      if (!done && isTask(it) && S.showOverdue) {
        overdue.push(it);
        pending++;
      }
      return;
    }
    if (!done) pending++;
    if (done && S.hideDone) return;
    const key = fmtDayLabel(d);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(it);
  });
  const byDue = (a, b) => dueOf(a) - dueOf(b);
  overdue.sort(byDue);
  days.forEach((list) => list.sort(byDue));
  return { overdue, days, pending };
};

export const courseUpcoming = (courseId, limit, now = Date.now()) =>
  (state.items || [])
    .filter((it) => String(it.course_id) === String(courseId) && !isDone(it) && isTask(it))
    .filter((it) => dueOf(it).getTime() >= now || S.showOverdue)
    .sort((a, b) => dueOf(a) - dueOf(b))
    .slice(0, limit);

export const dueSoon = (hours, now = Date.now()) =>
  (state.items || []).filter((it) => {
    const t = dueOf(it).getTime();
    return !isDone(it) && isTask(it) && t >= now && t - now <= hours * 36e5;
  });

export const setDone = async (it, done) => {
  const o = it.planner_override;
  const res =
    o && o.id
      ? await api(`/api/v1/planner/overrides/${o.id}`, { method: 'PUT', body: { marked_complete: done } })
      : await api('/api/v1/planner/overrides', {
          method: 'POST',
          body: { plannable_type: it.plannable_type, plannable_id: it.plannable_id, marked_complete: done },
        });
  it.planner_override = res.data;
  changed();
};

export const addTodo = async ({ title, date, courseId }) => {
  const day = date ? new Date(`${date}T23:59:00`) : new Date();
  const body = { title, todo_date: day.toISOString() };
  if (courseId) body.course_id = courseId;
  await api('/api/v1/planner_notes', { method: 'POST', body });
  await reloadItems();
};

export const deleteTodo = async (it) => {
  await api(`/api/v1/planner_notes/${it.plannable_id}`, { method: 'DELETE' });
  await reloadItems();
};

// ---------- courses ----------

export const studentCourses = () => (state.courses || []).filter((c) => c.student);

export const snapshotScores = () => {
  const out = {};
  studentCourses().forEach((c) => {
    if (c.score != null && !c.hidden) out[c.id] = c.score;
  });
  return out;
};

export const gradeChange = (c) => {
  if (!S.seen || c.score == null || c.hidden) return 0;
  const before = S.seen[c.id];
  if (before == null) return 0;
  const d = Math.round((c.score - before) * 100) / 100;
  return Math.abs(d) >= 0.01 ? d : 0;
};

export const markGradesSeen = () => {
  S.seen = snapshotScores();
  save();
  changed();
};

const paintCardColor = (courseId, hex) => {
  hooks.cardColor && hooks.cardColor(courseId, hex);
};

export const setCourseColor = async (courseId, hex) => {
  await api(`/api/v1/users/self/colors/course_${courseId}`, { method: 'PUT', body: { hexcode: hex.replace('#', '') } });
  state.colors[`course_${courseId}`] = hex;
  paintCardColor(courseId, hex);
  changed();
};

export const applyPalette = async (colors) => {
  const list = state.courses || [];
  for (let i = 0; i < list.length; i++) {
    await setCourseColor(list[i].id, colors[i % colors.length]);
  }
};

export const setNickname = async (courseId, nickname) => {
  const c = state.courses.find((x) => x.id === courseId);
  const nick = nickname.trim();
  if (nick && nick !== c.originalName) {
    await api(`/api/v1/users/self/course_nicknames/${courseId}`, { method: 'PUT', body: { nickname: nick } });
    c.name = nick;
  } else {
    await api(`/api/v1/users/self/course_nicknames/${courseId}`, { method: 'DELETE' }).catch(() => null);
    c.name = c.originalName;
  }
  hooks.cardTitle && hooks.cardTitle(courseId, c.name);
  changed();
};

// ---------- calendar export ----------

const icsDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export const buildIcs = (items, origin = location.origin, now = new Date()) => {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Quad//Canvas due dates//EN', 'CALSCALE:GREGORIAN'];
  items.forEach((it) => {
    const due = dueOf(it);
    const url = it.html_url ? origin + it.html_url : origin;
    lines.push(
      'BEGIN:VEVENT',
      `UID:quad-${it.plannable_type}-${it.plannable_id}@${location.host}`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(new Date(due.getTime() - 30 * 6e4))}`,
      `DTEND:${icsDate(due)}`,
      `SUMMARY:${icsText(titleOf(it) + (it.context_name ? ` (${it.context_name})` : ''))}`,
      `URL:${url}`,
      `DESCRIPTION:${icsText(`Due ${due.toLocaleString()}\n${url}`)}`,
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
};
