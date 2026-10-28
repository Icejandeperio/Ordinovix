import { describe, it, expect } from 'vitest';
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
