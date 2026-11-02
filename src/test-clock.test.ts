import { describe, it, expect } from 'vitest';
import { todayInManila } from '@/lib/dates';

// Guard for vitest.setup.ts: if the clock pin is removed, "today" is the real day and this fails.
describe('tests run on the pinned clock', () => {
  it('today is the fixed Asia/Manila day the sample data covers', () => {
    expect(todayInManila()).toBe('2026-10-28');
    expect(new Date().toISOString()).toBe('2026-10-28T02:00:00.000Z');
  });

  it('a test can set another day for itself', async () => {
    const { vi } = await import('vitest');
    vi.setSystemTime(new Date('2027-01-15T09:00:00+08:00'));
    expect(todayInManila()).toBe('2027-01-15');
  });

  it('the next test is back on the pinned day', () => {
    expect(todayInManila()).toBe('2026-10-28');
  });
});
