// Toolbar popup: turn Homeroom on or off for the current Canvas site, or add a school's own Canvas address.
const state = document.getElementById('state');
const OFF_KEY = 'homeroom:off';

const html = (s) => {
  state.innerHTML = s;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const run = (tabId, func, args = []) =>
  chrome.scripting.executeScript({ target: { tabId }, func, args }).then((r) => r[0] && r[0].result);

const scriptId = (host) => `site-${host}`;

const registered = async (host) => {
  const list = await chrome.scripting.getRegisteredContentScripts({ ids: [scriptId(host)] });
  return list.length > 0;
};

const isCanvas = (tabId) =>
  run(tabId, () => !!(window.ENV || document.querySelector('#application.ic-app, link[href*="instructure"], meta[name="csrf-token"]')) || !!document.getElementById('homeroom-pill') || document.title.includes('Homeroom')).catch(() => false);

const main = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let url;
  try {
    url = new URL(tab.url);
  } catch (e) {
    url = null;
  }
  if (!url || url.protocol !== 'https:') {
    html('<p>Open your school’s Canvas site, then click Homeroom again.</p>');
    return;
  }
  const host = url.host;
  const builtIn = host.endsWith('.instructure.com');
  const added = !builtIn && (await registered(host));

  if (builtIn || added) {
    const off = await run(tab.id, (k) => localStorage.getItem(k) === '1', [OFF_KEY]).catch(() => false);
    html(`
      <p class="site">${esc(host)}</p>
      <label class="row"><span>Use Homeroom on this site</span><input type="checkbox" class="switch" id="on" ${off ? '' : 'checked'}></label>
      ${added ? '<button class="secondary" id="remove">Remove this site</button>' : ''}`);
    document.getElementById('on').addEventListener('change', async (e) => {
      await run(tab.id, (k, on) => (on ? localStorage.removeItem(k) : localStorage.setItem(k, '1')), [OFF_KEY, e.target.checked]);
      chrome.tabs.reload(tab.id);
    });
    const rm = document.getElementById('remove');
    if (rm) {
      rm.addEventListener('click', async () => {
        await chrome.scripting.unregisterContentScripts({ ids: [scriptId(host)] });
        await chrome.permissions.remove({ origins: [`https://${host}/*`] });
        chrome.tabs.reload(tab.id);
        window.close();
      });
    }
    return;
  }

  const canvas = await isCanvas(tab.id);
  html(`
    <p class="site">${esc(host)}</p>
    <p class="muted">${canvas ? 'This looks like Canvas.' : 'This doesn’t look like a Canvas site.'} If it’s your school’s Canvas, Homeroom can run here.</p>
    <button class="primary" id="add">Use Homeroom on this site</button>`);
  document.getElementById('add').addEventListener('click', async () => {
    const origin = `https://${host}/*`;
    const ok = await chrome.permissions.request({ origins: [origin] });
    if (!ok) {
      html('<p>Homeroom needs permission to run on this site. Click it again if you change your mind.</p>');
      return;
    }
    await chrome.scripting.registerContentScripts([
      { id: scriptId(host), matches: [origin], js: ['content.js'], runAt: 'document_start', persistAcrossSessions: true },
    ]);
    chrome.tabs.reload(tab.id);
    window.close();
  });
};

main().catch((e) => html(`<p>Something went wrong: ${esc(e.message)}</p>`));
