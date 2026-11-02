// Everything Quad changes on Canvas pages themselves: theme classes, dashboard cards and sidebar embeds.
import PAGE_CSS from './styles/page.css';
import PANEL_CSS from './styles/panel.css';
import { S, isDark } from './settings.js';
import { state, hooks } from './store.js';
import { courseUpcoming, courseColor, dueOf, titleOf } from './data.js';
import { fmtScore, renderEmbed } from './views.js';
import { bindUI } from './actions.js';
import { esc, toHex, rgba, gradientEnd, readableOn, relTime, fmtShortDate, cssUrl } from './util.js';
import { fontStack, fontHref } from './themes.js';

const docs = new Map(); // document -> { observer, onKey }

const DARK_FILTERS = {
  dim: 'invert(0.85) hue-rotate(180deg)',
  dark: 'invert(0.93) hue-rotate(180deg)',
  black: 'invert(1) hue-rotate(180deg)',
};

export const attach = (doc) => {
  if (docs.has(doc)) return;
  const entry = {};
  docs.set(doc, entry);
  applyDoc(doc);
  let timer = 0;
  entry.observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => decorate(doc), 120);
  });
  entry.observer.observe(doc.documentElement, { childList: true, subtree: true });
  entry.onKey = (e) => hooks.onKey(e);
  doc.addEventListener('keydown', entry.onKey, true);
};

export const detach = (doc) => {
  const entry = docs.get(doc);
  if (!entry) return;
  docs.delete(doc);
  entry.observer.disconnect();
  doc.removeEventListener('keydown', entry.onKey, true);
  doc.documentElement.className = doc.documentElement.className.replace(/\bquad-\S+/g, '').trim();
  doc.querySelectorAll('#quad-page-style, #quad-vars, #quad-font-link, .quad-grade, .quad-card-list, .quad-embed').forEach((el) => el.remove());
};

export const applyAll = () => {
  [...docs.keys()].forEach((doc) => {
    if (!doc.defaultView) {
      docs.delete(doc);
      return;
    }
    applyDoc(doc);
  });
};

const ensure = (doc, id, tag) => {
  let el = doc.getElementById(id);
  if (!el) {
    el = doc.createElement(tag);
    el.id = id;
    (doc.head || doc.documentElement).appendChild(el);
  }
  return el;
};

const applyDoc = (doc) => {
  const root = doc.documentElement;
  const style = ensure(doc, 'quad-page-style', 'style');
  if (style.textContent !== PAGE_CSS) style.textContent = PAGE_CSS;

  const accent = S.accent;
  const vars = [
    `--quad-dark-filter:${DARK_FILTERS[S.darkLevel] || DARK_FILTERS.dark}`,
    S.navColor ? `--quad-nav:${S.navColor};--quad-nav-fg:${readableOn(S.navColor)}` : '',
    accent ? `--quad-accent:${accent};--quad-accent-fg:${readableOn(accent)}` : '',
    S.font ? `--quad-font:${fontStack(S.font)}` : '',
    S.cardRadius !== '' ? `--quad-radius:${Number(S.cardRadius)}px` : '',
  ]
    .filter(Boolean)
    .join(';');
  const varEl = ensure(doc, 'quad-vars', 'style');
  const varCss = `:root{${vars}}`;
  if (varEl.textContent !== varCss) varEl.textContent = varCss;

  const href = fontHref(S.font);
  const link = doc.getElementById('quad-font-link');
  if (href && (!link || link.getAttribute('href') !== href)) {
    const l = link || doc.createElement('link');
    l.id = 'quad-font-link';
    l.rel = 'stylesheet';
    l.href = href;
    if (!link) (doc.head || root).appendChild(l);
  } else if (!href && link) {
    link.remove();
  }

  const flags = {
    'quad-dark': isDark(),
    'quad-nav': !!S.navColor,
    'quad-accent': !!accent,
    'quad-font': !!S.font,
    'quad-full': S.fullWidth,
    'quad-nologo': S.hideLogo,
    'quad-nofeedback': S.hideFeedback,
    'quad-bettertodo': S.betterTodo,
    'quad-solid': S.cardStyle !== 'default',
    'quad-condensed': S.condensedCards,
    'quad-radius': S.cardRadius !== '',
  };
  Object.entries(flags).forEach(([cls, on]) => root.classList.toggle(cls, !!on));
  decorate(doc);
};

// ---------- dashboard ----------

const cardCourseId = (card) => {
  const link = card.querySelector('a[href*="/courses/"]');
  const m = link && link.getAttribute('href').match(/\/courses\/(\d+)/);
  return m ? m[1] : null;
};

const decorate = (doc) => {
  if (!doc.body) return;
  doc.querySelectorAll('.ic-DashboardCard').forEach((card) => {
    const id = cardCourseId(card);
    if (!id) return;
    badge(card, id);
    hero(card, id);
    cardList(card, id);
  });
  embeds(doc);
};

const badge = (card, id) => {
  const header = card.querySelector('.ic-DashboardCard__header') || card;
  let el = header.querySelector(':scope > .quad-grade');
  const c = S.cardGrades && state.courses && state.courses.find((x) => x.id === id);
  const text = c && fmtScore(c);
  if (!text) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = card.ownerDocument.createElement('span');
    el.className = 'quad-grade';
    header.classList.add('quad-rel');
    header.appendChild(el);
  }
  if (el.textContent !== text) el.textContent = text;
};

const hero = (card, id) => {
  const el = card.querySelector('.ic-DashboardCard__header_hero');
  if (!el) return;
  if (el.dataset.quadOrig === undefined) el.dataset.quadOrig = el.getAttribute('style') || '';
  const orig = el.dataset.quadOrig;
  const color = courseColor(id) || toHex(el.style.backgroundColor) || '#394b58';
  const image = S.cards[id] && S.cards[id].image;
  let want = orig;
  if (courseColor(id)) want += `;background-color:${color}`;
  if (image) {
    want += `;background-image:linear-gradient(${rgba(color, 0.45)},${rgba(color, 0.45)}),url("${cssUrl(image)}")` +
      ';background-size:cover;background-position:center;opacity:1';
  } else if (S.cardStyle === 'gradient') {
    want += `;background-image:linear-gradient(135deg,${color} 0%,${gradientEnd(color)} 100%);opacity:1`;
  }
  if ((el.getAttribute('style') || '') !== want) el.setAttribute('style', want);
};

const cardList = (card, id) => {
  let el = card.querySelector(':scope > .quad-card-list');
  if (!S.cardAssignments || !state.items) {
    if (el) el.remove();
    return;
  }
  const now = Date.now();
  const list = courseUpcoming(id, Number(S.cardAssignmentCount) || 3, now);
  const html = list.length
    ? list
        .map((it) => {
          const due = dueOf(it);
          const late = due.getTime() < now;
          const when = S.relativeDates ? relTime(due, now) : fmtShortDate(due);
          return `<li class="${late ? 'quad-late' : ''}"><a href="${esc(it.html_url || '#')}" title="${esc(titleOf(it))}">${esc(titleOf(it))}</a><span class="quad-due">${esc(late ? 'Late' : when)}</span></li>`;
        })
        .join('')
    : '<li class="quad-none">Nothing due soon</li>';
  if (!el) {
    el = card.ownerDocument.createElement('ul');
    el.className = 'quad-card-list';
    const actions = card.querySelector(':scope > .ic-DashboardCard__action-container, :scope > nav');
    card.insertBefore(el, actions || null);
  }
  if (el.dataset.sig !== html) {
    el.dataset.sig = html;
    el.innerHTML = html;
  }
};

const embeds = (doc) => {
  const side = doc.querySelector('#right-side');
  const onDashboard = !!doc.querySelector('#DashboardCard_Container, .ic-dashboard-app, #dashboard');
  let host = doc.querySelector('.quad-embed');
  if (!side || !onDashboard || !(S.betterTodo || S.dashNotes)) {
    if (host) host.remove();
    return;
  }
  if (!host) {
    host = doc.createElement('div');
    host.className = 'quad-embed';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${PANEL_CSS}</style><div class="embed"></div>`;
    bindUI(shadow);
    side.insertBefore(host, side.firstChild);
  }
  const box = host.shadowRoot.querySelector('.embed');
  const html = renderEmbed();
  if (box.dataset.sig !== html) {
    const active = host.shadowRoot.activeElement;
    // Don't wipe the notes box while someone is typing in it.
    if (active && active.matches('textarea')) return;
    box.dataset.sig = html;
    box.innerHTML = html;
  }
  host.style.setProperty('--accent', S.accent || '#2b6cde');
};

// Called right after a color change so cards update without a reload.
hooks.cardColor = (courseId, hex) => {
  docs.forEach((_, doc) => {
    doc.querySelectorAll('.ic-DashboardCard').forEach((card) => {
      if (cardCourseId(card) !== String(courseId)) return;
      const title = card.querySelector('.ic-DashboardCard__header-title');
      if (title) title.style.color = hex;
      const h = card.querySelector('.ic-DashboardCard__header_hero');
      if (h && h.dataset.quadOrig !== undefined) {
        h.dataset.quadOrig = h.dataset.quadOrig.replace(/background-color:[^;]+;?/g, '');
      }
    });
    decorate(doc);
  });
};

hooks.cardTitle = (courseId, name) => {
  docs.forEach((_, doc) => {
    doc.querySelectorAll('.ic-DashboardCard').forEach((card) => {
      if (cardCourseId(card) !== String(courseId)) return;
      const t = card.querySelector('.ic-DashboardCard__header-title span') || card.querySelector('.ic-DashboardCard__header-title');
      if (t) t.textContent = name;
    });
  });
};

