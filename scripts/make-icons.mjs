// One-off: renders the PNG app icons from the SVG artwork in public/ with the Playwright Chromium already installed.
// Usage: node scripts/make-icons.mjs   (writes public/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon-180.png)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BG = '#EEF1F4';
const art = readFileSync('public/icon-512.svg', 'utf8');
// The artwork without its own rounded background, so the icons can be square (maskable and Apple icons are rounded by the OS)
const inner = art.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<rect width="512" height="512" rx="96" fill="#EEF1F4"\/>/, '');

const page = (size, scale, rounded) => `<!doctype html><body style="margin:0;background:transparent">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" ${rounded ? 'rx="96"' : ''} fill="${BG}"/>
  <g transform="translate(${256 - 256 * scale} ${256 - 256 * scale}) scale(${scale})">${inner}</g>
</svg></body>`;

const jobs = [
  { file: 'public/icon-192.png', size: 192, scale: 1, rounded: true },
  { file: 'public/icon-512.png', size: 512, scale: 1, rounded: true },
  // Maskable: artwork inside the central 80% safe zone on a full-bleed background
  { file: 'public/icon-maskable-512.png', size: 512, scale: 0.72, rounded: false },
  { file: 'public/apple-touch-icon-180.png', size: 180, scale: 0.86, rounded: false },
];

const browser = await chromium.launch();
for (const job of jobs) {
  const p = await browser.newPage({ viewport: { width: job.size, height: job.size } });
  await p.setContent(page(job.size, job.scale, job.rounded));
  await p.screenshot({ path: job.file, omitBackground: true, clip: { x: 0, y: 0, width: job.size, height: job.size } });
  await p.close();
  console.log('wrote', job.file);
}
await browser.close();
