import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url));

function pngSize(file: string): { type: string; w: number; h: number } {
  const b = read(file);
  return { type: b.subarray(1, 4).toString(), w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('installable app (spec 19.3, B17)', () => {
  it('has PNG icons at 192, 512 (any and maskable) and an apple-touch-icon at 180', () => {
    expect(pngSize('../../public/icon-192.png')).toEqual({ type: 'PNG', w: 192, h: 192 });
    expect(pngSize('../../public/icon-512.png')).toEqual({ type: 'PNG', w: 512, h: 512 });
    expect(pngSize('../../public/icon-maskable-512.png')).toEqual({ type: 'PNG', w: 512, h: 512 });
    expect(pngSize('../../public/apple-touch-icon-180.png')).toEqual({ type: 'PNG', w: 180, h: 180 });
  });

  it('lists the PNG icons in the manifest next to the SVGs', () => {
    const manifest = JSON.parse(read('../../public/manifest.webmanifest').toString()) as {
      display: string;
      start_url: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    const srcs = manifest.icons.map((i) => i.src);
    expect(srcs).toEqual(expect.arrayContaining(['/icon-192.svg', '/icon-512.svg', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']));
    expect(manifest.icons.find((i) => i.src === '/icon-maskable-512.png')?.purpose).toBe('maskable');
  });

  it('links the 180 px apple-touch-icon from the page', () => {
    expect(read('../../index.html').toString()).toContain('href="/apple-touch-icon-180.png"');
  });

  it('builds a service worker with vite-plugin-pwa that waits for the user before updating', () => {
    const config = read('../../vite.config.ts').toString();
    expect(config).toContain("from 'vite-plugin-pwa'");
    expect(config).toMatch(/registerType:\s*'prompt'/);
    expect(config).toMatch(/manifest:\s*false/); // the manifest is the hand-written one in public/
  });
});
