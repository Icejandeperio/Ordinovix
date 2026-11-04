import { describe, it, expect, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { todayInManila, nowInManila, twentiethOfNextMonth, addDaysToDate } from './dates';

// 2026-11-03 18:00 UTC is 2026-11-04 02:00 in Manila: the UTC date and the Manila date differ.
const LATE_UTC = '2026-11-03T18:00:00Z';

describe('U43 client date defaults at 18:00 UTC (already tomorrow in Manila)', () => {
  afterEach(() => vi.setSystemTime(new Date('2026-10-28T10:00:00+08:00')));

  it('every default reads the Manila day, 2026-11-04', () => {
    vi.setSystemTime(new Date(LATE_UTC));
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-03'); // the trap
    expect(todayInManila()).toBe('2026-11-04');
    expect(nowInManila()).toBe('2026-11-04T02:00:00+08:00');
    expect(nowInManila().slice(11, 16)).toBe('02:00'); // the Finish Visit default time
    expect(twentiethOfNextMonth()).toBe('2026-12-20'); // the Open Period default due date
    expect(addDaysToDate(todayInManila(), 3)).toBe('2026-11-07'); // the outcome next-action default
  });

  it('the next-month default rolls the year in December', () => {
    expect(twentiethOfNextMonth('2026-12-31')).toBe('2027-01-20');
  });
});

// A calendar date made from toISOString() is the UTC date: a day early for a Manila midnight and a day late after 16:00 UTC.
// Timestamps are fine; a date built from one is not. A line that shifts by +8 h first (the Worker's own Manila arithmetic) is allowed.
describe('U43 no calendar date is derived from toISOString()', () => {
  const root = join(__dirname, '..', '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== 'node_modules') walk(p);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk(join(root, 'src'));
  walk(join(root, 'worker'));

  it('finds none outside the allowed Manila-shifted lines', () => {
    const bad: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // look at this line and the next two, so a chained call split over lines is caught
        const window = [line, lines[i + 1] ?? '', lines[i + 2] ?? ''].join(' ');
        if (!line.includes('toISOString()')) return;
        const tail = window.slice(window.indexOf('toISOString()'));
        const makesDate = /toISOString\(\)\s*\.(slice\(\s*0\s*,\s*10\s*\)|split\(\s*['"]T['"]\s*\)|substring\(\s*0\s*,\s*10\s*\))/.test(tail);
        const shifted = /8 \* 3600_000/.test(line);
        if (makesDate && !shifted) bad.push(`${f.slice(root.length)}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('would catch the pattern it guards against', () => {
    const sample = "const d = new Date(y, m, 20)\n  .toISOString()\n  .slice(0, 10);";
    const lines = sample.split('\n');
    const window = lines.join(' ');
    expect(/toISOString\(\)\s*\.(slice\(\s*0\s*,\s*10\s*\))/.test(window.slice(window.indexOf('toISOString()')))).toBe(true);
  });
});
