// Bundles src/main.js into a javascript: bookmarklet and writes the install page.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as esbuild from 'esbuild';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

// Import .css files as minified strings.
const cssText = {
  name: 'css-text',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const { code } = await esbuild.transform(await readFile(args.path, 'utf8'), { loader: 'css', minify: true });
      return { contents: `export default ${JSON.stringify(code.trim())};`, loader: 'js' };
    });
  },
};

const result = await esbuild.build({
  entryPoints: [new URL('src/main.js', root).pathname],
  bundle: true,
  format: 'iife',
  target: ['chrome100', 'firefox100', 'safari15'],
  minify: true,
  legalComments: 'none',
  write: false,
  plugins: [cssText],
});

// Minified output only has raw newlines inside template literals (HTML snippets), where they're just whitespace.
const code = result.outputFiles[0].text.replace(/\n\s*/g, ' ').trim();

// Percent-encode only what a URL would mangle (%, line breaks, non-ASCII), to keep the bookmark short.
const bookmarklet = 'javascript:' + code.replace(/[%\t\n\r]|[^\x20-\x7e]/gu, encodeURIComponent);

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const body = (await read('src/install.html'))
  .replace('{{BOOKMARKLET}}', () => escapeHtml(bookmarklet))
  .replace('{{BOOKMARKLET_TEXT}}', () => escapeHtml(bookmarklet));

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

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/quad.min.js', root), code + '\n');
await writeFile(new URL('dist/bookmarklet.txt', root), bookmarklet + '\n');
await writeFile(new URL('dist/install-body.html', root), body);
await writeFile(new URL('index.html', root), page);

console.log(`Built bookmarklet: ${code.length} bytes of JS, ${bookmarklet.length} characters as a bookmark.`);
