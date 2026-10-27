import { format, parseISO, differenceInCalendarDays, addDays, isSameYear } from 'date-fns';
import { tz } from '@date-fns/tz';

/**
 * Dev-menu "today" override. It lives in localStorage so it survives the page reload the dev menu triggers,
 * and it is read when this module loads, before any store seeds itself from today's date.
 */
const DEV_TODAY_KEY = 'ox-mock-today';

function readStoredDevToday(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(DEV_TODAY_KEY);
    return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

let devTodayOverride: string | null = readStoredDevToday();

export function setDevToday(date: string | null): void {
  devTodayOverride = date;
  try {
    if (typeof localStorage === 'undefined') return;
    if (date) localStorage.setItem(DEV_TODAY_KEY, date);
    else localStorage.removeItem(DEV_TODAY_KEY);
  } catch {
    // storage unavailable: the override then lasts until the page reloads
  }
}

export function getDevToday(): string | null {
  return devTodayOverride;
}

/**
 * Returns today's date in Asia/Manila as 'YYYY-MM-DD'.
 * Respects dev menu override if set.
 */
export function todayInManila(): string {
  if (devTodayOverride) {
    return devTodayOverride;
  }
  // Formats current system time in Asia/Manila timezone
  const now = new Date();
  const manilaDateString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // en-CA gives YYYY-MM-DD
  return manilaDateString;
}

/**
 * Compares two 'YYYY-MM-DD' strings lexicographically.
 */
export function compareDates(d1: string, d2: string): number {
  return d1.localeCompare(d2);
}

/**
 * Adds N days to a 'YYYY-MM-DD' string without UTC conversion issues.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const newDate = addDays(date, days);
  return format(newDate, 'yyyy-MM-dd');
}

/**
 * Calculates calendar day difference between dateStr and todayStr (dateStr - todayStr).
 */
export function daysFromToday(dateStr: string, todayStr: string = todayInManila()): number {
  const [y1, m1, d1] = dateStr.split('-').map(Number);
  const [y2, m2, d2] = todayStr.split('-').map(Number);
  const date = new Date(y1, m1 - 1, d1);
  const today = new Date(y2, m2 - 1, d2);
  return differenceInCalendarDays(date, today);
}

/**
 * Formats a calendar date: 'Oct 28' if same year as today, 'Oct 28, 2025' if different year.
 */
export function formatDate(dateStr?: string | null, today: string = todayInManila()): string {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const todayParts = today.split('-').map(Number);
    const todayDate = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);

    if (isSameYear(date, todayDate)) {
      return format(date, 'MMM d');
    }
    return format(date, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

/**
 * Formats relative day description: 'Today', 'Tomorrow', 'Yesterday', or 'In 3 days', '2 days ago'.
 */
export function formatRelative(dateStr: string, today: string = todayInManila()): string {
  const diff = daysFromToday(dateStr, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} days ago`;
  return formatDate(dateStr, today);
}

/** Times are always shown in Asia/Manila, whatever the device time zone is. */
const MANILA = tz('Asia/Manila');

/**
 * The current moment as an ISO timestamp with the Manila offset: today's date (or the dev-menu date) plus the
 * real Manila clock time. Use it for event times; never write a calendar date with a midnight time.
 */
export function nowInManila(): string {
  return `${todayInManila()}T${format(new Date(), 'HH:mm:ss', { in: MANILA })}+08:00`;
}

/** Length of a visit as '1 h 30 min', or 'Not recorded' when the start or finish time is missing. */
export function formatDuration(startedAt?: string | null, finishedAt?: string | null): string {
  if (!startedAt || !finishedAt) return 'Not recorded';
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Not recorded';
  const diffMinutes = Math.max(1, Math.round((end - start) / (1000 * 60)));
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return hours === 0 ? `${mins} min` : `${hours} h ${mins} min`;
}

/**
 * Formats an ISO datetime string with offset to '3:12 PM'.
 */
export function formatTime(isoDateTime?: string | null): string {
  if (!isoDateTime) return '—';
  try {
    const date = parseISO(isoDateTime);
    return format(date, 'h:mm a', { in: MANILA });
  } catch {
    return isoDateTime;
  }
}

/**
 * Formats an ISO datetime string with offset to 'Oct 24, 3:12 PM'.
 */
export function formatDateTime(isoDateTime?: string | null): string {
  if (!isoDateTime) return '—';
  try {
    const date = parseISO(isoDateTime);
    return format(date, 'MMM d, h:mm a', { in: MANILA });
  } catch {
    return isoDateTime;
  }
}

/**
 * Formats a calendar date: 'Saturday, October 24'
 */
export function formatHeaderDate(dateStr: string = todayInManila()): string {
  try {
    const parts = dateStr.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return format(date, 'EEEE, MMMM d');
  } catch {
    return dateStr;
  }
}

