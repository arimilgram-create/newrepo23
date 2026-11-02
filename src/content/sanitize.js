// Teacher-written HTML (announcements, instructions) comes from Canvas, which already cleans it.
// We clean it again before inserting it, since Homeroom renders it outside Canvas's own page.

const DROP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'BASE', 'OBJECT', 'EMBED', 'FORM', 'NOSCRIPT', 'TEMPLATE']);
const SAFE_URL = /^(https?:|mailto:|tel:|\/|#|data:image\/)/i;

export const clean = (html) => {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  root.querySelectorAll('*').forEach((el) => {
    if (DROP.has(el.tagName)) {
      el.remove();
      return;
    }
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action') && !SAFE_URL.test(attr.value.trim())) {
        el.removeAttribute(attr.name);
      }
    });
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    }
    if (el.tagName === 'IFRAME') {
      el.setAttribute('loading', 'lazy');
      el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
    }
    if (el.tagName === 'IMG') el.setAttribute('loading', 'lazy');
  });
  return root.innerHTML;
};

export const plainText = (html, max = 220) => {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
