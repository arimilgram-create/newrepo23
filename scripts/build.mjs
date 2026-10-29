// Minifies src/quad.js into a javascript: bookmarklet and writes the install page.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { minify } from 'terser';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const source = await read('src/quad.js');
const { code } = await minify(source, {
  ecma: 2020,
  compress: { passes: 2 },
  mangle: true,
  format: { comments: false },
});

const bookmarklet = 'javascript:' + encodeURIComponent(code);
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const body = (await read('src/install.html'))
  .replace('{{BOOKMARKLET}}', () => escapeHtml(bookmarklet))
  .replace('{{BOOKMARKLET_TEXT}}', () => escapeHtml(bookmarklet));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${body.slice(0, body.indexOf('<div class="wrap">'))}</head>
<body>
${body.slice(body.indexOf('<div class="wrap">'))}</body>
</html>
`;

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/quad.min.js', root), code + '\n');
await writeFile(new URL('dist/bookmarklet.txt', root), bookmarklet + '\n');
await writeFile(new URL('dist/install-body.html', root), body);
await writeFile(new URL('index.html', root), page);

console.log(`Built bookmarklet: ${code.length} bytes of JS, ${bookmarklet.length} chars as a URL.`);
