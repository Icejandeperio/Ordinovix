import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { pwaWorkbox } from '../../vite.config';

describe('service worker and the API (U22)', () => {
  it('never answers /api/* from the app shell: the navigation fallback denies it', () => {
    const deny = pwaWorkbox.navigateFallbackDenylist ?? [];
    expect(deny.some((re) => re.test('/api/v1/health'))).toBe(true);
    expect(deny.some((re) => re.test('/api/auth/callback/google'))).toBe(true);
    expect(deny.some((re) => re.test('/tasks'))).toBe(false);
  });

  it('precaches only static app files, with no runtime caching rule that could cache the API', () => {
    expect(pwaWorkbox.runtimeCaching ?? []).toEqual([]);
    expect(pwaWorkbox.globPatterns?.join(' ')).not.toMatch(/api/);
  });
});

describe('push in the service worker (U34)', () => {
  it('keeps the generated service worker and adds the push handler as an imported script, a file that is served from the app root', () => {
    expect(pwaWorkbox.importScripts).toEqual(['push-sw.js']);
    expect(existsSync(new URL('../../public/push-sw.js', import.meta.url))).toBe(true);
    expect(pwaWorkbox).not.toHaveProperty('swSrc');
  });
});
