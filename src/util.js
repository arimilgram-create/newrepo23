export const DAY = 864e5;

export const esc = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const dayDiff = (d, now = new Date()) => Math.round((startOfDay(d) - startOfDay(now)) / DAY);

export const fmtTime = (d, h24) =>
  d.toLocaleTimeString(undefined, h24 ? { hour: '2-digit', minute: '2-digit', hour12: false } : { hour: 'numeric', minute: '2-digit' });

export const fmtDayLabel = (d, now = new Date()) => {
  const diff = dayDiff(d, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};

export const fmtShortDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const relTime = (d, now = Date.now()) => {
  const diff = d - now;
  const mins = Math.round(Math.abs(diff) / 6e4);
  let s;
  if (mins < 1) return 'now';
  if (mins < 60) s = `${mins}m`;
  else if (mins < 36 * 60) s = `${Math.round(mins / 60)}h`;
  else s = `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${s}` : `${s} ago`;
};

export const isTyping = (e) => {
  const t = e.composedPath ? e.composedPath()[0] : e.target;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''));
};

// ---------- colors ----------

export const isHex = (h) => /^#[0-9a-f]{6}$/i.test(h || '');

export const toHex = (css) => {
  if (!css) return '';
  if (isHex(css)) return css.toLowerCase();
  const short = css.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const m = css.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (!m) return '';
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
};

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgba = (hex, a) => (isHex(hex) ? `rgba(${rgb(hex).join(',')},${a})` : `rgba(0,0,0,${a})`);

export const readableOn = (hex) => {
  if (!isHex(hex)) return '#ffffff';
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#14171a' : '#ffffff';
};

// Rotates hue and lifts lightness a little: the far end of a card gradient.
export const gradientEnd = (hex) => {
  if (!isHex(hex)) return hex;
  let [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  h = (h + 40 / 360) % 1;
  l = Math.min(0.75, l + 0.12);
  s = Math.min(1, s + 0.05);
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
};

export const cssUrl = (u) => String(u).replace(/["\\\n\r]/g, (c) => encodeURIComponent(c));
