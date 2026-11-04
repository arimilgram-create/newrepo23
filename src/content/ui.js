// Small shared helpers: escaping, dates, icons, avatars and the generated class banners.

export const esc = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );

export const DAY = 864e5;

// ---------- dates ----------

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const dayDiff = (d, now = new Date()) => Math.round((startOfDay(d) - startOfDay(now)) / DAY);

export const startOfWeek = (d) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
};

export const time = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const shortDate = (d, now = new Date()) =>
  d.toLocaleDateString(undefined, d.getFullYear() === now.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });

// "Today", "Tomorrow", "Friday" (this week), or "Nov 14".
export const friendlyDay = (d, now = new Date()) => {
  const diff = dayDiff(d, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return shortDate(d, now);
};

export const dueText = (iso, now = new Date()) => {
  if (!iso) return 'No due date';
  const d = new Date(iso);
  return `Due ${friendlyDay(d, now)}, ${time(d)}`;
};

export const postedText = (iso, now = new Date()) => {
  if (!iso) return '';
  const d = new Date(iso);
  return dayDiff(d, now) === 0 ? time(d) : shortDate(d, now);
};

// ---------- icons (original line icons, 24px grid) ----------

const icon = (body, filled = false) => (cls = '') =>
  `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

export const I = {
  menu: icon('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  home: icon('<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>'),
  calendar: icon('<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
  todo: icon('<path d="M9 7h11M9 12h11M9 17h11"/><path d="m3.5 7 1.2 1.2L7 5.8M3.5 12l1.2 1.2L7 10.8"/><circle cx="5" cy="17" r="1.1"/>'),
  assignment: icon('<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4"/>'),
  quiz: icon('<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="m9 12.5 2 2 4-4.5"/>'),
  material: icon('<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v3H7.5"/>'),
  page: icon('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 16.5h6"/>'),
  link: icon('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  file: icon('<path d="M17 11.5 11.2 17.3a3.8 3.8 0 0 1-5.4-5.4l6.4-6.4a2.5 2.5 0 0 1 3.6 3.6l-6.3 6.3a1.3 1.3 0 0 1-1.8-1.8l5.6-5.6"/>'),
  discussion: icon('<path d="M4 5h11v8H8l-4 3z"/><path d="M15 9h5v8l-3-2.5h-6V13"/>'),
  external: icon('<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5H5V6h5"/>'),
  people: icon('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.5 14.4A4.5 4.5 0 0 1 21 19"/>'),
  more: icon('<circle cx="12" cy="5.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="18.5" r="1.6"/>', true),
  left: icon('<path d="m14.5 6-6 6 6 6"/>'),
  right: icon('<path d="m9.5 6 6 6-6 6"/>'),
  down: icon('<path d="m6 9.5 6 6 6-6"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  close: icon('<path d="M6 6l12 12M18 6 6 18"/>'),
  send: icon('<path d="M4 12 20 4l-4 16-4-6.5z"/><path d="m12 13.5 8-9.5"/>'),
  folder: icon('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>'),
  grades: icon('<path d="M5 20V12M10 20V6M15 20v-9M20 20v-5"/>'),
  check: icon('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  settings: icon('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  lock: icon('<rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  inbox: icon('<path d="M4 13.5 6.5 5h11l2.5 8.5V19H4z"/><path d="M4 13.5h5l1 2h4l1-2h5"/>'),
  upload: icon('<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5"/><path d="M5 15v4h14v-4"/>'),
  text: icon('<path d="M5 6h14M5 10h14M5 14h9M5 18h6"/>'),
  event: icon('<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><circle cx="12" cy="14.5" r="1.6" fill="currentColor"/>'),
  note: icon('<path d="M6 4h12v16l-6-4-6 4z"/>'),
  yourWork: icon('<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="m7.5 15 3-3.5 2.5 2 3.5-4.5"/>'),
};

export const LOGO = (size = 28) => `
  <svg class="logo" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--brand)"/>
    <path d="M7 24V12.5L16 6l9 6.5V24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>
    <rect x="12.2" y="15" width="7.6" height="9" rx="1.2" fill="#fff"/>
    <circle cx="16" cy="11.4" r="1.6" fill="var(--brand-2)"/>
  </svg>`;

export const typeIcon = (type) =>
  ({
    Assignment: I.assignment,
    assignment: I.assignment,
    Quiz: I.quiz,
    quiz: I.quiz,
    Discussion: I.discussion,
    discussion_topic: I.discussion,
    Page: I.page,
    wiki_page: I.page,
    File: I.file,
    ExternalUrl: I.link,
    ExternalTool: I.external,
    calendar_event: I.event,
    planner_note: I.note,
  })[type] || I.material;

// ---------- colors ----------

const FALLBACK_COLORS = ['#1e8e3e', '#1967d2', '#e37400', '#c5221f', '#7627bb', '#129eaf', '#d01884', '#5f6368', '#188038', '#b06000'];

export const colorFor = (id, custom) => custom || FALLBACK_COLORS[Math.abs(hash(String(id))) % FALLBACK_COLORS.length];

export const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
};

// Mixes a hex color toward white (amount > 0) or black (amount < 0).
export const shade = (hex, amount) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('');
};

// ---------- avatars ----------

const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const realAvatar = (url) => url && !/avatar-50\.png|images\/messages\/avatar/.test(url);

export const avatar = (name, url, size = 32, color) => {
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px;background:${color || colorFor(name)}`;
  if (realAvatar(url)) return `<img class="avatar" src="${esc(url)}" alt="" style="${style}" loading="lazy">`;
  return `<span class="avatar" style="${style}" aria-hidden="true">${esc(initials(name))}</span>`;
};

// ---------- class banners (procedural, so every class gets its own) ----------

const SUBJECTS = [
  ['math', /math|calc|algebra|geometr|statist|trig|precalc|quant/i],
  ['science', /bio|chem|physic|science|anatom|environment|earth|astro|lab\b/i],
  ['code', /comput|coding|program|software|robot|engineer|\bcs\b|data|tech/i],
  ['english', /english|literat|writing|reading|composit|\bela\b|poetry|rhetoric/i],
  ['history', /histor|social|govern|civic|econ|geograph|psych|sociol|politic|law/i],
  ['language', /spanish|french|german|chinese|mandarin|japanese|latin|italian|korean|arabic|language|espa/i],
  ['art', /\bart|design|draw|paint|photo|ceramic|film|media/i],
  ['music', /music|band|choir|orchestra|chorus|jazz/i],
  ['health', /\bpe\b|physical ed|health|fitness|sport|athlet|wellness|nutrition/i],
];

export const subjectOf = (name) => (SUBJECTS.find(([, re]) => re.test(name || '')) || ['general'])[0];

const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const MOTIFS = {
  math: (r) => {
    let s = '<path d="M560 210 Q700 -40 840 210" stroke-width="6" fill="none"/>';
    s += '<path d="M620 60h60M650 30v60M760 150h50" stroke-width="8"/>';
    s += '<polygon points="880,40 960,180 800,180" stroke-width="6" fill="none"/>';
    for (let i = 0; i < 5; i++) s += `<circle cx="${520 + r() * 440}" cy="${20 + r() * 200}" r="${4 + r() * 6}" class="f"/>`;
    return s;
  },
  science: () =>
    '<g transform="translate(760 120)"><ellipse rx="110" ry="38" stroke-width="6" fill="none"/>' +
    '<ellipse rx="110" ry="38" transform="rotate(60)" stroke-width="6" fill="none"/>' +
    '<ellipse rx="110" ry="38" transform="rotate(-60)" stroke-width="6" fill="none"/><circle r="16" class="f"/></g>' +
    '<path d="M560 40h50M572 40v60l-40 90h106l-40-90V40" stroke-width="6" fill="none"/>' +
    '<circle cx="585" cy="170" r="8" class="f"/><circle cx="600" cy="150" r="5" class="f"/>',
  code: () =>
    '<path d="M600 70 540 120l60 50M760 70l60 50-60 50M700 50l-40 150" stroke-width="10" fill="none"/>' +
    '<rect x="860" y="40" width="110" height="74" rx="10" stroke-width="6" fill="none"/><path d="M880 140h70M915 114v26" stroke-width="6"/>',
  english: (r) => {
    let s = '';
    const colors = [0.5, 0.35, 0.6, 0.42, 0.55];
    for (let i = 0; i < 5; i++) {
      const h = 120 + r() * 70;
      s += `<rect x="${600 + i * 46}" y="${230 - h}" width="38" height="${h}" rx="4" class="f" opacity="${colors[i]}"/>`;
    }
    s += '<rect x="840" y="104" width="38" height="126" rx="4" class="f" opacity=".5" transform="rotate(14 860 230)"/>';
    s += '<path d="M560 40c-20 0-30 14-30 34h26v26h-26M600 40c-20 0-30 14-30 34h26v26h-26" stroke-width="6" fill="none"/>';
    return s;
  },
  history: () =>
    '<path d="M600 90 720 40l120 50z" stroke-width="6" fill="none"/>' +
    '<path d="M620 100v100M670 100v100M720 100v100M770 100v100M820 100v100M600 210h240" stroke-width="10"/>' +
    '<circle cx="920" cy="80" r="50" stroke-width="5" fill="none"/><path d="M870 80h100M920 30c-30 30-30 70 0 100M920 30c30 30 30 70 0 100" stroke-width="4" fill="none"/>',
  language: () =>
    '<path d="M560 50h170a16 16 0 0 1 16 16v70a16 16 0 0 1-16 16h-110l-40 34v-34h-20a16 16 0 0 1-16-16V66a16 16 0 0 1 16-16z" stroke-width="6" fill="none"/>' +
    '<path d="M780 100h150a16 16 0 0 1 16 16v60a16 16 0 0 1-16 16h-20v30l-36-30h-94a16 16 0 0 1-16-16v-60a16 16 0 0 1 16-16z" class="f" opacity=".5"/>' +
    '<path d="M600 95h110M600 120h70" stroke-width="7"/>',
  art: (r) => {
    let s = '<path d="M840 30c70 10 120 60 110 120-6 40-50 40-60 20-10-20-40-10-46 14-8 30-70 24-90-10-30-60 20-150 86-144z" stroke-width="6" fill="none"/>';
    for (let i = 0; i < 4; i++) s += `<circle cx="${810 + i * 30}" cy="${80 + (i % 2) * 30}" r="11" class="f"/>`;
    s += '<path d="M560 200 700 60" stroke-width="12"/><path d="M700 60l24-24 10 10-24 24z" class="f"/>';
    for (let i = 0; i < 3; i++) s += `<circle cx="${560 + r() * 120}" cy="${40 + r() * 80}" r="${10 + r() * 14}" class="f" opacity=".5"/>`;
    return s;
  },
  music: () =>
    '<path d="M600 180V60l120-24v120M780 190V90l100-20v100" stroke-width="7" fill="none"/>' +
    '<ellipse cx="585" cy="182" rx="22" ry="16" class="f"/><ellipse cx="705" cy="158" rx="22" ry="16" class="f"/>' +
    '<ellipse cx="765" cy="192" rx="20" ry="14" class="f"/><ellipse cx="865" cy="172" rx="20" ry="14" class="f"/>' +
    '<path d="M540 120h420M540 140h420" stroke-width="2" opacity=".5"/>',
  health: () =>
    '<path d="M640 200c-90-60-110-110-80-140 24-24 60-14 80 12 20-26 56-36 80-12 30 30 10 80-80 140z" class="f" opacity=".6"/>' +
    '<circle cx="860" cy="120" r="70" stroke-width="6" fill="none"/><path d="M790 120h140M860 50v140M812 70c30 30 30 70 0 100M908 70c-30 30-30 70 0 100" stroke-width="4" fill="none"/>',
  general: (r) => {
    let s = '';
    for (let i = 0; i < 7; i++) {
      const x = 540 + r() * 440;
      const y = r() * 240;
      const rad = 16 + r() * 60;
      s += r() > 0.5 ? `<circle cx="${x}" cy="${y}" r="${rad}" class="f" opacity="${0.25 + r() * 0.4}"/>` : `<circle cx="${x}" cy="${y}" r="${rad}" stroke-width="6" fill="none"/>`;
    }
    return s;
  },
};

// compact: the small home-page card, where the art shrinks to the right edge so the class name stays readable.
export const banner = ({ id, name, color, image }, { compact = false } = {}) => {
  const c = color || colorFor(id);
  if (image) {
    return `<div class="banner-art" style="background:${esc(c)} url('${esc(image)}') center/cover"></div>`;
  }
  const r = rng(hash(String(id)));
  const motif = MOTIFS[subjectOf(name)](r);
  const dark = shade(c, -0.25);
  return `<svg class="banner-art" viewBox="0 0 1000 240" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
    <rect width="1000" height="240" fill="${esc(c)}"/>
    <circle cx="${980 - r() * 80}" cy="${-40 + r() * 60}" r="190" fill="${dark}" opacity=".35"/>
    <g stroke="#fff" fill="#fff" stroke-linecap="round" stroke-linejoin="round" opacity="${compact ? '.5' : '.55'}"
      ${compact ? 'transform="translate(470 92) scale(.55)"' : ''}>${motif.replace(/class="f"/g, 'stroke="none"')}</g>
  </svg>`;
};
