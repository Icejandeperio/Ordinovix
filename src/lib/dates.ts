import { format, parseISO, differenceInCalendarDays, addDays, isSameYear } from 'date-fns';

let devTodayOverride: string | null = null;

export function setDevToday(date: string | null): void {
  devTodayOverride = date;
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

/**
 * Formats an ISO datetime string with offset to '3:12 PM'.
 */
export function formatTime(isoDateTime?: string | null): string {
  if (!isoDateTime) return '—';
  try {
    const date = parseISO(isoDateTime);
    return format(date, 'h:mm a');
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
    return format(date, 'MMM d, h:mm a');
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

