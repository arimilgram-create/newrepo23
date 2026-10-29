/*
 * Quad: a Canvas LMS power-up that runs as a bookmarklet, no extension needed.
 * Click the bookmark on any Canvas page to open the panel; click again to hide it.
 */
(() => {
  'use strict';

  const NS = '__quad';
  if (window[NS]) {
    window[NS].toggle();
    return;
  }

  const onCanvas = !!(window.ENV && document.getElementById('application'));
  if (!onCanvas) {
    alert("Quad works on Canvas. Open your school's Canvas site, then click the bookmark again.");
    return;
  }

  // ---------- settings (stored per Canvas site, in this browser) ----------

  const KEY = 'quad:v1';
  const DEFAULTS = {
    dark: false,
    cardGrades: true,
    hideCardImages: false,
    hideDone: false,
    days: 14,
    tab: 'todo',
    gpa: {}, // courseId -> { credits, weight, skip }
  };

  const S = (() => {
    try {
      return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  })();

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {
      /* private mode or storage blocked: settings just won't stick */
    }
  };

  // ---------- Canvas API ----------

  const csrf = () => {
    const m = document.cookie.match(/(?:^|;\s*)_csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  };

  const nextLink = (header) => {
    const m = header && header.match(/<([^>]+)>;\s*rel="next"/);
    return m ? m[1] : null;
  };

  const api = async (path, opts = {}) => {
    const headers = { Accept: 'application/json' };
    if (opts.body) {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = csrf();
    }
    const res = await fetch(path, {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) throw new Error(`Canvas said ${res.status} for ${path.split('?')[0]}`);
    const text = await res.text();
    return { data: JSON.parse(text.replace(/^while\(1\);/, '')), next: nextLink(res.headers.get('Link')) };
  };

  const getAll = async (path, maxPages = 10) => {
    let out = [];
    let url = path;
    for (let i = 0; url && i < maxPages; i++) {
      const page = await api(url);
      out = out.concat(page.data);
      url = page.next;
    }
    return out;
  };

  // ---------- data ----------

  const SCALE = [
    [97, 'A+', 4.0], [93, 'A', 4.0], [90, 'A-', 3.7],
    [87, 'B+', 3.3], [83, 'B', 3.0], [80, 'B-', 2.7],
    [77, 'C+', 2.3], [73, 'C', 2.0], [70, 'C-', 1.7],
    [67, 'D+', 1.3], [63, 'D', 1.0], [60, 'D-', 0.7],
    [0, 'F', 0.0],
  ];

  const letterFor = (c) => {
    if (c.letter) return c.letter;
    if (c.score == null) return null;
    return SCALE.find((r) => c.score >= r[0])[1];
  };

  const pointsFor = (c) => {
    const letter = letterFor(c);
    if (!letter) return null;
    const row = SCALE.find((r) => r[1] === letter.trim().toUpperCase());
    if (row) return row[2];
    // Custom grading scheme with non-standard letters: fall back to the percentage.
    return c.score == null ? null : SCALE.find((r) => c.score >= r[0])[2];
  };

  let courses = null; // [{ id, name, code, score, letter, hidden }]
  let items = null; // planner items
  let colors = {};
  let loadError = null;

  const loadCourses = async () => {
    const list = await getAll(
      '/api/v1/courses?enrollment_state=active&include[]=total_scores' +
        '&include[]=current_grading_period_scores&per_page=100'
    );
    courses = list
      .map((c) => {
        if (!c || !c.name) return null;
        const e = (c.enrollments || []).find((x) => x.type === 'student');
        if (!e) return null;
        const usePeriod = e.multiple_grading_periods_enabled && e.current_period_computed_current_score != null;
        const score = usePeriod ? e.current_period_computed_current_score : e.computed_current_score;
        const letter = usePeriod ? e.current_period_computed_current_grade : e.computed_current_grade;
        return {
          id: String(c.id),
          name: c.name,
          code: c.course_code || '',
          score: score == null ? null : score,
          letter: letter || null,
          hidden: !!c.hide_final_grades,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const loadTodo = async () => {
    const start = new Date(Date.now() - 14 * 864e5).toISOString();
    const end = new Date(Date.now() + S.days * 864e5).toISOString();
    const list = await getAll(
      `/api/v1/planner/items?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&per_page=100`
    );
    items = list.filter((it) => it.plannable_type !== 'announcement' && it.plannable_type !== 'assessment_request');
  };

  const loadColors = async () => {
    try {
      colors = (await api('/api/v1/users/self/colors')).data.custom_colors || {};
    } catch (e) {
      colors = {};
    }
  };

  const loadAll = async () => {
    loadError = null;
    render();
    try {
      await Promise.all([loadCourses(), loadTodo(), loadColors()]);
    } catch (e) {
      loadError = e.message || String(e);
    }
    render();
    decorateCards();
  };

  // ---------- to-do helpers ----------

  const submitted = (it) => !!(it.submissions && (it.submissions.submitted || it.submissions.excused));
  const markedDone = (it) => !!(it.planner_override && it.planner_override.marked_complete);
  const isDone = (it) => submitted(it) || markedDone(it);
  const dueDate = (it) => new Date(it.plannable_date || (it.plannable && it.plannable.due_at) || 0);

  const setDone = async (it, done) => {
    const o = it.planner_override;
    const res = o && o.id
      ? await api(`/api/v1/planner/overrides/${o.id}`, { method: 'PUT', body: { marked_complete: done } })
      : await api('/api/v1/planner/overrides', {
          method: 'POST',
          body: { plannable_type: it.plannable_type, plannable_id: it.plannable_id, marked_complete: done },
        });
    it.planner_override = res.data;
  };

  // ---------- page-level styles (dark mode, dashboard cards) ----------

  const pageStyle = document.createElement('style');
  pageStyle.id = 'quad-page-style';
  pageStyle.textContent = `
    html.quad-dark { filter: invert(1) hue-rotate(180deg); background: #fff !important; }
    html.quad-dark img, html.quad-dark video, html.quad-dark picture, html.quad-dark iframe,
    html.quad-dark canvas, html.quad-dark embed, html.quad-dark object,
    html.quad-dark [style*="background-image"], html.quad-dark #quad-host {
      filter: invert(1) hue-rotate(180deg);
    }
    html.quad-dark picture img, html.quad-dark [style*="background-image"] img { filter: none; }
    html.quad-noimg .ic-DashboardCard__header_image { background-image: none !important; }
    html.quad-noimg .ic-DashboardCard__header_hero { opacity: 1 !important; }
    .quad-rel { position: relative; }
    .quad-grade {
      position: absolute; top: 8px; left: 8px; z-index: 2; pointer-events: none;
      background: rgba(255,255,255,.95); color: #1f2328; border-radius: 999px;
      font: 600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 5px 9px;
      box-shadow: 0 1px 3px rgba(0,0,0,.25);
    }
  `;
  document.head.appendChild(pageStyle);

  const applyPage = () => {
    const root = document.documentElement;
    root.classList.toggle('quad-dark', !!S.dark);
    root.classList.toggle('quad-noimg', !!S.hideCardImages);
    host.classList.toggle('dark', !!S.dark);
    decorateCards();
  };

  const fmtScore = (c) => {
    if (c.hidden || c.score == null) return null;
    const pct = `${Math.round(c.score * 10) / 10}%`;
    const letter = letterFor(c);
    return letter ? `${pct} ${letter}` : pct;
  };

  const decorateCards = () => {
    const cards = document.querySelectorAll('.ic-DashboardCard');
    if (!S.cardGrades || !courses) {
      document.querySelectorAll('.quad-grade').forEach((b) => b.remove());
      return;
    }
    const byId = new Map(courses.map((c) => [c.id, c]));
    cards.forEach((card) => {
      const link = card.querySelector('a[href*="/courses/"]');
      const m = link && link.getAttribute('href').match(/\/courses\/(\d+)/);
      if (!m) return;
      const header = card.querySelector('.ic-DashboardCard__header') || card;
      let badge = header.querySelector(':scope > .quad-grade');
      const c = byId.get(m[1]);
      const text = c && fmtScore(c);
      if (!text) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'quad-grade';
        header.classList.add('quad-rel');
        header.appendChild(badge);
      }
      if (badge.textContent !== text) badge.textContent = text;
    });
  };

  // Dashboard cards are rendered late by Canvas, so watch for them.
  let decorateTimer = 0;
  new MutationObserver(() => {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorateCards, 150);
  }).observe(document.body, { childList: true, subtree: true });

  // ---------- panel ----------

  const host = document.createElement('div');
  host.id = 'quad-host';
  host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483646;';
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  const CSS = `
    :host { all: initial; }
    :host {
      --bg: #ffffff; --bg2: #f5f6f8; --line: #e3e5e8; --fg: #1f2328; --muted: #646b75;
      --accent: #2557d6; --accent-fg: #ffffff; --danger: #c4321b; --ok: #1a7f37;
    }
    :host(.dark) {
      --bg: #17191c; --bg2: #212429; --line: #30343a; --fg: #e8eaed; --muted: #9aa1ab;
      --accent: #7aa2ff; --accent-fg: #0d1117; --danger: #ff7b66; --ok: #56d364;
    }
    * { box-sizing: border-box; }
    .panel {
      width: min(380px, calc(100vw - 32px)); height: min(640px, calc(100vh - 32px));
      display: flex; flex-direction: column; overflow: hidden;
      background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,.22);
      font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .panel[hidden] { display: none; }
    header { display: flex; align-items: center; gap: 8px; padding: 12px 12px 0 16px; }
    .brand { font-weight: 700; font-size: 16px; letter-spacing: -.01em; flex: 1; }
    .icon {
      all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 8px;
      display: grid; place-items: center; color: var(--muted); font-size: 16px;
    }
    .icon:hover { background: var(--bg2); color: var(--fg); }
    .icon:focus-visible, .tab:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
      outline: 2px solid var(--accent); outline-offset: 2px;
    }
    nav { display: flex; gap: 4px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
    .tab {
      all: unset; cursor: pointer; padding: 6px 10px; border-radius: 8px; color: var(--muted); font-weight: 600; font-size: 13px;
    }
    .tab:hover { color: var(--fg); background: var(--bg2); }
    .tab[aria-selected="true"] { color: var(--accent-fg); background: var(--accent); }
    main { flex: 1; overflow: auto; padding: 4px 0 12px; }
    .group { padding: 12px 16px 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
    .group.overdue { color: var(--danger); }
    .row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 16px; }
    .row:hover { background: var(--bg2); }
    .row input[type=checkbox] { margin: 3px 0 0; width: 16px; height: 16px; accent-color: var(--accent); flex: none; cursor: pointer; }
    .row .body { flex: 1; min-width: 0; }
    .row a { color: var(--fg); text-decoration: none; font-weight: 600; }
    .row a:hover { text-decoration: underline; }
    .row.done a { color: var(--muted); text-decoration: line-through; font-weight: 500; }
    .meta { color: var(--muted); font-size: 12px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--muted); }
    .pill { font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: var(--bg2); color: var(--muted); }
    .pill.ok { color: var(--ok); }
    .pill.bad { color: var(--danger); }
    .course { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--line); }
    .course .body { flex: 1; min-width: 0; }
    .course .name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .course .name a { color: var(--fg); text-decoration: none; }
    .course .name a:hover { text-decoration: underline; }
    .score { font-variant-numeric: tabular-nums; font-weight: 700; text-align: right; white-space: nowrap; }
    .score small { display: block; color: var(--muted); font-weight: 500; font-size: 12px; }
    .bar { height: 4px; border-radius: 2px; background: var(--bg2); margin-top: 6px; overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--accent); border-radius: 2px; }
    .gpa-head { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px 16px; }
    .stat { background: var(--bg2); border-radius: 10px; padding: 10px 12px; }
    .stat b { display: block; font-size: 26px; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
    .stat span { color: var(--muted); font-size: 12px; }
    .gpa-row { display: grid; grid-template-columns: 18px 1fr 52px 76px; gap: 8px; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--line); }
    .gpa-row.skip .name, .gpa-row.skip .sub { opacity: .45; }
    .gpa-row .name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gpa-row .sub { color: var(--muted); font-size: 12px; }
    .gpa-row input[type=number], .gpa-row select, .setting select {
      width: 100%; font: inherit; font-size: 12px; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 4px 6px;
    }
    .gpa-cols { display: grid; grid-template-columns: 18px 1fr 52px 76px; gap: 8px; padding: 6px 16px; color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--line); }
    .setting { display: flex; gap: 12px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--line); cursor: pointer; }
    .setting .body { flex: 1; }
    .setting .sub { color: var(--muted); font-size: 12px; }
    .setting select { width: auto; }
    .switch { appearance: none; -webkit-appearance: none; width: 36px; height: 20px; border-radius: 999px; background: var(--line); position: relative; cursor: pointer; flex: none; margin: 0; transition: background .15s; }
    .switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
    .switch:checked { background: var(--accent); }
    .switch:checked::after { transform: translateX(16px); }
    .empty, .note { padding: 24px 16px; color: var(--muted); text-align: center; }
    .note { text-align: left; font-size: 12px; padding: 12px 16px; }
    .error { margin: 12px 16px; padding: 10px 12px; border-radius: 10px; background: var(--bg2); color: var(--danger); font-size: 13px; }
    .btn { all: unset; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--accent); }
    .btn:hover { text-decoration: underline; }
    .spin { display: inline-block; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation: none; } .switch, .switch::after { transition: none; } }
  `;

  shadow.innerHTML = `
    <style>${CSS}</style>
    <section class="panel" role="dialog" aria-label="Quad">
      <header>
        <div class="brand">Quad</div>
        <button class="icon" data-act="refresh" title="Refresh" aria-label="Refresh">&#x21bb;</button>
        <button class="icon" data-act="close" title="Close (Esc)" aria-label="Close">&#x2715;</button>
      </header>
      <nav role="tablist">
        <button class="tab" role="tab" data-tab="todo">To-do</button>
        <button class="tab" role="tab" data-tab="grades">Grades</button>
        <button class="tab" role="tab" data-tab="gpa">GPA</button>
        <button class="tab" role="tab" data-tab="settings">Settings</button>
      </nav>
      <main></main>
    </section>
  `;

  const panel = shadow.querySelector('.panel');
  const main = shadow.querySelector('main');

  const loading = () => `<div class="empty"><span class="spin">&#x21bb;</span> Loading from Canvas…</div>`;
  const errorBox = () => (loadError ? `<div class="error">Couldn't load everything: ${esc(loadError)}</div>` : '');

  const courseColor = (it) => colors[`course_${it.course_id}`] || '';

  const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const fmtDay = (d) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((day - today) / 864e5);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const itemRow = (it, idx) => {
    const p = it.plannable || {};
    const d = dueDate(it);
    const sub = it.submissions || {};
    const done = isDone(it);
    const pills = [];
    if (sub.graded) pills.push('<span class="pill ok">Graded</span>');
    else if (sub.submitted) pills.push('<span class="pill ok">Submitted</span>');
    if (sub.missing) pills.push('<span class="pill bad">Missing</span>');
    if (sub.late) pills.push('<span class="pill bad">Late</span>');
    const color = courseColor(it);
    const href = it.html_url || '#';
    return `
      <div class="row ${done ? 'done' : ''}">
        <input type="checkbox" data-item="${idx}" ${done ? 'checked' : ''} ${submitted(it) ? 'disabled title="Already submitted"' : ''}
          aria-label="Mark ${esc(p.title || 'item')} complete">
        <div class="body">
          <a href="${esc(href)}">${esc(p.title || p.name || 'Untitled')}</a>
          <div class="meta">
            <span class="dot" ${color ? `style="background:${esc(color)}"` : ''}></span>
            <span>${esc(it.context_name || (it.plannable_type === 'planner_note' ? 'Note' : ''))}</span>
            <span>· ${esc(fmtTime(d))}</span>
            ${p.points_possible ? `<span>· ${esc(p.points_possible)} pts</span>` : ''}
            ${pills.join('')}
          </div>
        </div>
      </div>`;
  };

  const renderTodo = () => {
    if (!items) return loading();
    const now = Date.now();
    const gradable = (it) => !!it.submissions || it.plannable_type === 'planner_note';
    const overdue = [];
    const days = new Map();
    items.forEach((it, idx) => {
      const d = dueDate(it);
      const done = isDone(it);
      if (d.getTime() < now) {
        if (!done && gradable(it)) overdue.push([it, idx]);
        return;
      }
      if (done && S.hideDone) return;
      const key = fmtDay(d);
      if (!days.has(key)) days.set(key, []);
      days.get(key).push([it, idx]);
    });
    let html = errorBox();
    if (overdue.length) {
      html += `<div class="group overdue">Overdue · ${overdue.length}</div>`;
      html += overdue.map(([it, idx]) => itemRow(it, idx)).join('');
    }
    days.forEach((list, key) => {
      html += `<div class="group">${esc(key)}</div>`;
      html += list.map(([it, idx]) => itemRow(it, idx)).join('');
    });
    if (!overdue.length && !days.size) {
      html += `<div class="empty">Nothing due in the next ${S.days} days. 🎉</div>`;
    }
    return html;
  };

  const renderGrades = () => {
    if (!courses) return loading();
    if (!courses.length) return errorBox() + '<div class="empty">No active courses where you are a student.</div>';
    return (
      errorBox() +
      courses
        .map((c) => {
          const s = fmtScore(c);
          const pct = c.score == null || c.hidden ? 0 : Math.max(0, Math.min(100, c.score));
          const color = colors[`course_${c.id}`];
          return `
          <div class="course">
            <div class="body">
              <div class="name"><a href="/courses/${esc(c.id)}/grades">${esc(c.name)}</a></div>
              <div class="bar"><i style="width:${pct}%;${color ? `background:${esc(color)}` : ''}"></i></div>
            </div>
            <div class="score">${s ? esc(s.split(' ')[0]) : '—'}<small>${s ? esc(letterFor(c) || '') : c.hidden ? 'Hidden' : 'No grade'}</small></div>
          </div>`;
        })
        .join('')
    );
  };

  const gpaOf = (c) => Object.assign({ credits: 1, weight: 0, skip: false }, S.gpa[c.id]);

  const computeGpa = () => {
    let credits = 0;
    let unweighted = 0;
    let weighted = 0;
    courses.forEach((c) => {
      const g = gpaOf(c);
      const pts = pointsFor(c);
      if (g.skip || pts == null || c.hidden || !(g.credits > 0)) return;
      credits += g.credits;
      unweighted += pts * g.credits;
      weighted += (pts > 0 ? pts + g.weight : 0) * g.credits;
    });
    if (!credits) return null;
    return { unweighted: unweighted / credits, weighted: weighted / credits, credits };
  };

  const renderGpa = () => {
    if (!courses) return loading();
    const gpa = computeGpa();
    const f = (n) => (gpa ? n.toFixed(2) : '—');
    let html = errorBox();
    html += `
      <div class="gpa-head">
        <div class="stat"><b>${f(gpa && gpa.unweighted)}</b><span>Unweighted GPA</span></div>
        <div class="stat"><b>${f(gpa && gpa.weighted)}</b><span>Weighted GPA</span></div>
      </div>
      <div class="gpa-cols"><span></span><span>Course</span><span>Credits</span><span>Level</span></div>`;
    html += courses
      .map((c) => {
        const g = gpaOf(c);
        const pts = pointsFor(c);
        const graded = pts != null && !c.hidden;
        return `
        <div class="gpa-row ${g.skip || !graded ? 'skip' : ''}">
          <input type="checkbox" data-gpa-skip="${esc(c.id)}" ${g.skip ? '' : 'checked'} ${graded ? '' : 'disabled'} aria-label="Include ${esc(c.name)}">
          <div style="min-width:0">
            <div class="name">${esc(c.name)}</div>
            <div class="sub">${graded ? `${esc(letterFor(c))} · ${pts.toFixed(1)} pts` : 'No grade yet'}</div>
          </div>
          <input type="number" min="0" max="20" step="0.5" value="${esc(g.credits)}" data-gpa-credits="${esc(c.id)}" aria-label="Credits for ${esc(c.name)}">
          <select data-gpa-weight="${esc(c.id)}" aria-label="Level for ${esc(c.name)}">
            <option value="0" ${g.weight === 0 ? 'selected' : ''}>Regular</option>
            <option value="0.5" ${g.weight === 0.5 ? 'selected' : ''}>Honors</option>
            <option value="1" ${g.weight === 1 ? 'selected' : ''}>AP / IB</option>
          </select>
        </div>`;
      })
      .join('');
    html += `<div class="note">Uses each course's current Canvas grade on a 4.0 scale (A 93+, A- 90+, B+ 87+…). Honors adds 0.5 and AP/IB adds 1.0 to the weighted GPA. This is an estimate, not your official transcript.</div>`;
    return html;
  };

  const toggleRow = (key, title, sub) => `
    <label class="setting">
      <div class="body"><div>${title}</div><div class="sub">${sub}</div></div>
      <input type="checkbox" class="switch" data-setting="${key}" ${S[key] ? 'checked' : ''}>
    </label>`;

  const renderSettings = () => `
    ${toggleRow('dark', 'Dark mode', 'Darkens all of Canvas while Quad is running.')}
    ${toggleRow('cardGrades', 'Grades on dashboard cards', 'Shows your current score on each course card.')}
    ${toggleRow('hideCardImages', 'Hide card images', 'Solid course colors instead of pictures.')}
    ${toggleRow('hideDone', 'Hide finished to-dos', 'Hide submitted and checked-off items.')}
    <label class="setting">
      <div class="body"><div>To-do range</div><div class="sub">How far ahead to look.</div></div>
      <select data-days>
        ${[7, 14, 30].map((n) => `<option value="${n}" ${S.days === n ? 'selected' : ''}>${n} days</option>`).join('')}
      </select>
    </label>
    <div class="note">
      Settings are saved in this browser for ${esc(location.host)}. Because Quad is a bookmark, not an extension,
      click it once after a page loads to turn dark mode and card grades back on.
      <br><br><button class="btn" data-act="reset-gpa">Reset GPA credits and levels</button>
    </div>`;

  const render = () => {
    shadow.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === S.tab)));
    const view = { todo: renderTodo, grades: renderGrades, gpa: renderGpa, settings: renderSettings }[S.tab] || renderTodo;
    const scroll = main.scrollTop;
    main.innerHTML = view();
    main.scrollTop = scroll;
  };

  // ---------- events ----------

  shadow.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab], [data-act]');
    if (!t) return;
    if (t.dataset.tab) {
      S.tab = t.dataset.tab;
      save();
      main.scrollTop = 0;
      render();
    } else if (t.dataset.act === 'close') {
      hide();
    } else if (t.dataset.act === 'refresh') {
      courses = items = null;
      loadAll();
    } else if (t.dataset.act === 'reset-gpa') {
      S.gpa = {};
      save();
      render();
    }
  });

  shadow.addEventListener('change', async (e) => {
    const t = e.target;
    const d = t.dataset;
    if (d.setting) {
      S[d.setting] = t.checked;
      save();
      applyPage();
    } else if (d.days !== undefined) {
      S.days = Number(t.value);
      save();
      items = null;
      try {
        await loadTodo();
      } catch (err) {
        loadError = err.message;
      }
    } else if (d.item !== undefined) {
      const it = items[Number(d.item)];
      t.disabled = true;
      try {
        await setDone(it, t.checked);
      } catch (err) {
        t.checked = !t.checked;
        alert(`Quad couldn't update Canvas: ${err.message}`);
      }
      render();
      return;
    } else if (d.gpaSkip) {
      S.gpa[d.gpaSkip] = Object.assign(gpaOf({ id: d.gpaSkip }), { skip: !t.checked });
    } else if (d.gpaCredits) {
      S.gpa[d.gpaCredits] = Object.assign(gpaOf({ id: d.gpaCredits }), { credits: Math.max(0, Number(t.value) || 0) });
    } else if (d.gpaWeight) {
      S.gpa[d.gpaWeight] = Object.assign(gpaOf({ id: d.gpaWeight }), { weight: Number(t.value) });
    } else {
      return;
    }
    save();
    if (S.tab !== 'settings') render();
  });

  const onKey = (e) => {
    if (e.key === 'Escape' && !panel.hidden) hide();
  };
  document.addEventListener('keydown', onKey);

  const show = () => {
    panel.hidden = false;
    render();
  };
  const hide = () => {
    panel.hidden = true;
  };

  window[NS] = {
    toggle: () => (panel.hidden ? show() : hide()),
  };

  applyPage();
  show();
  loadAll();
})();
