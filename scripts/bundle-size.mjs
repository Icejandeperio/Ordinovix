// Prints the JavaScript a first visit to "/" downloads (the entry and every chunk it imports statically), gzipped.
// Usage: npm run build && node scripts/bundle-size.mjs [--max <KB>]   (exits 1 when over the budget)
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dist = 'dist';
const maxArg = process.argv.indexOf('--max');
const max = maxArg > -1 ? Number(process.argv[maxArg + 1]) : undefined;

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entries = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const sizes = new Map();
function visit(file) {
  if (sizes.has(file)) return;
  const buf = readFileSync(join(dist, file));
  sizes.set(file, gzipSync(buf).length);
  // Static imports only; dynamic import() chunks load later
  for (const m of buf.toString('utf8').matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) visit(`assets/${m[1]}`);
}
entries.forEach(visit);

let total = 0;
for (const [file, bytes] of [...sizes].sort((a, b) => b[1] - a[1])) {
  total += bytes;
  console.log(`${(bytes / 1024).toFixed(1).padStart(7)} KB gz  ${file.replace('assets/', '')}`);
}
const kb = total / 1024;
console.log(`Initial JS: ${kb.toFixed(1)} KB gzip in ${sizes.size} files${max ? ` (budget ${max} KB)` : ''}`);
if (max && kb > max) process.exit(1);
