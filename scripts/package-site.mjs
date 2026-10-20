import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const files = new Set();
const pending = ['index.html', '404.html', 'favicon.ico', 'apple-touch-icon.png', 'assets/hc-share-v3.png'];
const localPath = (file, reference) => {
  const clean = reference.split(/[?#]/)[0];
  if (!clean || clean==='/' || /^[a-z]+:/i.test(clean)) return null;
  return path.normalize(clean.startsWith('/') ? clean.slice(1) : path.join(path.dirname(file), clean));
};

// Follow public runtime dependencies, including linked case studies.
// Disconnected drafts, exports and QA images stay outside the deployment.
while (pending.length) {
  const file = pending.pop();
  if (files.has(file)) continue;
  if (file.startsWith('..') || path.isAbsolute(file)) throw new Error(`Unsafe dependency: ${file}`);
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) throw new Error(`Missing dependency: ${file}`);
  files.add(file);
  if (!/\.(html|css|js)$/.test(file) || file.includes('/vendor/')) continue;
  const source = fs.readFileSync(absolute, 'utf8');
  const patterns = [
    /(?:src|href)=["']([^"']+)["']/g,
    /url\(["']?([^)'"\s]+)["']?\)/g,
    /^import\s+.+?\s+from\s*["']([^"']+)["']/gm,
    /import\(["']([^"']+)["']/g,
    /new URL\(["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const dependency = localPath(file, match[1]);
      if (dependency) pending.push(dependency);
    }
  }
}
for (const file of ['hc-model-v2/vendor/BufferGeometryUtils.js', 'hc-model-v2/vendor/THREE-LICENSE.txt', 'hc-model-v2/FONT-LICENSE.txt']) files.add(file);
const base = process.env.PUBLIC_BASE_PATH || '/';
if (!/^\/(?:[a-zA-Z0-9_.-]+\/)*$/.test(base)) throw new Error('PUBLIC_BASE_PATH must be a slash-delimited local path');
// Recreate only the named, generated dist directory, never the source checkout.
fs.rmSync(output, { recursive: true, force: true });
for (const file of files) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}
const errorPage = path.join(output, '404.html');
fs.writeFileSync(errorPage, fs.readFileSync(errorPage, 'utf8').replace('<base href="/">', `<base href="${base}">`));
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log(`Packaged ${files.size} runtime files for ${base}; disconnected drafts and local review files excluded.`);
