import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatTime, formatDateTime, formatDuration, nowInManila } from './dates';

describe('lib/dates Asia/Manila formatting (B25)', () => {
  it('formats a timestamp with a +08:00 offset as written', () => {
    expect(formatTime('2026-10-24T15:12:00+08:00')).toBe('3:12 PM');
    expect(formatDateTime('2026-10-24T15:12:00+08:00')).toBe('Oct 24, 3:12 PM');
  });

  it('shows Manila time for an instant given in UTC or another offset, whatever the device time zone is', () => {
    expect(formatTime('2026-10-24T07:12:00Z')).toBe('3:12 PM');
    expect(formatTime('2026-10-24T02:12:00-05:00')).toBe('3:12 PM');
    expect(formatDateTime('2026-10-24T20:30:00Z')).toBe('Oct 25, 4:30 AM'); // the date rolls over in Manila
  });

  it('keeps the placeholder for a missing value', () => {
    expect(formatTime(undefined)).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });

  it('nowInManila is a real timestamp with the Manila offset, not midnight', () => {
    const now = nowInManila();
    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
    expect(now.slice(11, 19)).not.toBe('00:00:00');
  });
});

describe('formatDuration (B23)', () => {
  it('computes the length between start and finish', () => {
    expect(formatDuration('2026-10-24T09:00:00+08:00', '2026-10-24T10:30:00+08:00')).toBe('1 h 30 min');
    expect(formatDuration('2026-10-24T09:00:00+08:00', '2026-10-24T09:45:00+08:00')).toBe('45 min');
    expect(formatDuration('2026-10-24T09:00:00+08:00', '2026-10-24T11:00:00+08:00')).toBe('2 h 0 min');
  });

  it('says Not recorded instead of inventing a duration', () => {
    expect(formatDuration(undefined, '2026-10-24T10:30:00+08:00')).toBe('Not recorded');
    expect(formatDuration('2026-10-24T09:00:00+08:00', undefined)).toBe('Not recorded');
    expect(formatDuration(undefined, undefined)).toBe('Not recorded');
  });
});

describe('dev "today" override survives a reload (B12)', () => {
  const KEY = 'ox-mock-today';
  const backing = new Map<string, string>();

  beforeEach(() => {
    backing.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, String(v)),
      removeItem: (k: string) => void backing.delete(k),
    });
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A page reload re-evaluates the module; localStorage is all that survives. */
  const reload = () => import('./dates');

  it('is stored when set and applied as soon as the module loads', async () => {
    const before = await reload();
    before.setDevToday('2026-11-03');
    expect(backing.get(KEY)).toBe('2026-11-03');

    vi.resetModules();
    const after = await reload();
    expect(after.getDevToday()).toBe('2026-11-03');
    expect(after.todayInManila()).toBe('2026-11-03');
  });

  it('can be cleared, and stays cleared after a reload', async () => {
    const first = await reload();
    first.setDevToday('2026-11-03');
    first.setDevToday(null);
    expect(backing.has(KEY)).toBe(false);

    vi.resetModules();
    const after = await reload();
    expect(after.getDevToday()).toBeNull();
    expect(after.todayInManila()).not.toBe('2026-11-03');
  });

  it('ignores a stored value that is not a calendar date', async () => {
    backing.set(KEY, 'not-a-date');
    const mod = await reload();
    expect(mod.getDevToday()).toBeNull();
  });
});
