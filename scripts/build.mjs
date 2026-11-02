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
