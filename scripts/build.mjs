// Builds the unpacked extension into extension/ and a zip for sharing.
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import * as esbuild from 'esbuild';

const root = new URL('../', import.meta.url).pathname;
const out = `${root}extension/`;

const cssText = {
  name: 'css-text',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const { code } = await esbuild.transform(await readFile(args.path, 'utf8'), { loader: 'css', minify: true });
      return { contents: `export default ${JSON.stringify(code.trim())};`, loader: 'js' };
    });
  },
};

await rm(out, { recursive: true, force: true });
await mkdir(`${out}icons`, { recursive: true });

await esbuild.build({
  entryPoints: [`${root}src/content/main.js`],
  outfile: `${out}content.js`,
  bundle: true,
  format: 'iife',
  target: ['chrome111'],
  minify: true,
  legalComments: 'none',
  plugins: [cssText],
});

await cp(`${root}src/manifest.json`, `${out}manifest.json`);
for (const f of ['popup.html', 'popup.css', 'popup.js']) await cp(`${root}src/popup/${f}`, `${out}${f}`);
await cp(`${root}src/icons`, `${out}icons`, { recursive: true });

await rm(`${root}homeroom.zip`, { force: true });
execFileSync('zip', ['-qr', `${root}homeroom.zip`, '.'], { cwd: out });

const size = (await readFile(`${out}content.js`)).length;
console.log(`Built extension/ (content.js ${Math.round(size / 1024)} KB) and homeroom.zip`);

// ---------- bookmark version ----------

const bm = await esbuild.build({
  entryPoints: [`${root}src/bookmarklet.js`],
  bundle: true,
  format: 'iife',
  target: ['chrome100', 'firefox100', 'safari15'],
  minify: true,
  legalComments: 'none',
  write: false,
  plugins: [cssText],
});
// Minified output only has raw newlines inside template literals (HTML snippets), where they're just whitespace.
const code = bm.outputFiles[0].text.replace(/\n\s*/g, ' ').trim();
// Percent-encode only what a URL would mangle (%, line breaks, non-ASCII), to keep the bookmark short.
const bookmarklet = 'javascript:' + code.replace(/[%\t\n\r]|[^\x20-\x7e]/gu, encodeURIComponent);

const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const img = async (name) => {
  try {
    return `data:image/png;base64,${(await readFile(`${root}screenshots/${name}.png`)).toString('base64')}`;
  } catch (e) {
    return '';
  }
};
const body = (await readFile(`${root}src/install.html`, 'utf8'))
  .replace('{{BOOKMARKLET}}', () => escapeHtml(bookmarklet))
  .replace('{{BOOKMARKLET_TEXT}}', () => escapeHtml(bookmarklet))
  .replace('{{IMG_HOME}}', await img('3b-stream-comments'))
  .replace('{{IMG_CLASSWORK}}', await img('4-classwork'))
  .replace('{{IMG_ASSIGNMENT}}', await img('7-assignment'));
const split = body.indexOf('<div class="wrap">');
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${body.slice(0, split)}</head>
<body>
${body.slice(split)}</body>
</html>
`;

await mkdir(`${root}dist`, { recursive: true });
await writeFile(`${root}dist/homeroom.min.js`, code + '\n');
await writeFile(`${root}dist/bookmarklet.txt`, bookmarklet + '\n');
await writeFile(`${root}dist/install-body.html`, body);
await writeFile(`${root}index.html`, page);
console.log(`Built the bookmark: ${bookmarklet.length} characters (dist/bookmarklet.txt, install page index.html)`);
