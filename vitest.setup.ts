import { beforeEach, afterAll, vi } from 'vitest';

/**
 * The sample data is dated relative to today, so a test that names a month breaks when the calendar turns (U36: the pulse test
 * failed on 1 Nov 2026). Unit and Worker tests run on this fixed Asia/Manila day, which the sample data covers: the sample pulses
 * are April to September 2026, so October 2026 has none. Only Date is faked; timers still run. A test that needs another day sets
 * it with vi.setSystemTime (or the dev date) itself.
 */
export const TEST_NOW = '2026-10-28T10:00:00+08:00';

vi.useFakeTimers({ toFake: ['Date'], now: new Date(TEST_NOW) });
beforeEach(() => {
  vi.setSystemTime(new Date(TEST_NOW));
});
afterAll(() => {
  vi.useRealTimers();
});
