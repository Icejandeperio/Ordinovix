import type { VisitItem, Visit, Task, TaskLine, FollowUpAttempt } from './types';
import { daysFromToday } from '@/lib/dates';

/**
 * Calculates First-pass completion rate (0-100%):
 * Of tasks whose first office visit happened in the period,
 * share whose first visit outcome was Completed, Submitted (pending), or Paid (proof to follow).
 */
export function calculateFirstPassRate(items: VisitItem[]): number {
  const firstVisits = items.filter((i) => i.isFirstVisitForTask && i.outcome);
  if (firstVisits.length === 0) return 0;

  const successful = firstVisits.filter(
    (i) =>
      i.outcome === 'completed' ||
      i.outcome === 'submitted_pending' ||
      i.outcome === 'paid_proof_pending'
  );

  return Math.round((successful.length / firstVisits.length) * 100);
}

/**
 * Calculates trips needing a return (repeat trips count):
 * Visit items with outcome: more_documents_requested, correction_required, not_accepted, follow_up_required.
 */
export function countTripsNeedingReturn(items: VisitItem[]): { total: number; avoidable: number; notAvoidable: number } {
  const repeatOutcomes = ['more_documents_requested', 'correction_required', 'not_accepted', 'follow_up_required'];
  const repeats = items.filter((i) => i.outcome && repeatOutcomes.includes(i.outcome));

  const avoidable = repeats.filter((i) => i.avoidable === true).length;
  const notAvoidable = repeats.length - avoidable;

  return {
    total: repeats.length,
    avoidable,
    notAvoidable,
  };
}

/**
 * Calculates Visits that left ready (%):
 * Visits started without departureOverrideReason ÷ total visits started.
 */
export function calculateVisitsLeftReadyRate(visits: Visit[]): number {
  const started = visits.filter((v) => v.startedAt || v.status === 'in_progress' || v.status === 'done');
  if (started.length === 0) return 100;

  const leftReady = started.filter((v) => !v.departureOverrideReason);
  return Math.round((leftReady.length / started.length) * 100);
}

/**
 * Calculates On-time rate (%):
 * Of tasks due in the period, share submitted or completed on or before due date.
 */
export function calculateOnTimeRate(tasks: Task[]): number {
  if (tasks.length === 0) return 100;

  const onTime = tasks.filter((t) => {
    const finishDate = t.submittedAt?.slice(0, 10) || t.completedAt?.slice(0, 10);
    if (!finishDate) {
      // Still open: if past due, it is late
      return daysFromToday(t.dueDate) >= 0;
    }
    return finishDate <= t.dueDate;
  });

  return Math.round((onTime.length / tasks.length) * 100);
}

/**
 * Ownership coverage (%):
 * Active tasks with an owner and a next action ÷ active tasks.
 */
export function calculateOwnershipCoverage(tasks: Task[]): number {
  const active = tasks.filter((t) => t.status !== 'completed' && t.status !== 'archived');
  if (active.length === 0) return 100;

  const covered = active.filter((t) => t.ownerUserId && t.nextAction && t.nextAction.text.trim().length > 0);
  return Math.round((covered.length / active.length) * 100);
}

/**
 * Median helper for arrays of numbers
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  }
  return sorted[mid];
}

/**
 * Average days to collect:
 * Days from task createdAt to readyAt.
 */
export function calculateDaysToCollect(tasks: Task[]): number {
  const readyTasks = tasks.filter((t) => t.readyAt);
  if (readyTasks.length === 0) return 0;

  const diffs = readyTasks.map((t) => {
    const created = t.createdAt.slice(0, 10);
    const ready = t.readyAt!.slice(0, 10);
    return Math.max(0, daysFromToday(ready, created));
  });

  return median(diffs);
}

/**
 * Late-discovered blockers count:
 * Lines flagged or created after task was ready, or within 3 days of due date.
 */
export function countLateDiscoveredBlockers(lines: TaskLine[]): number {
  return lines.filter((l) => l.lateDiscovered).length;
}

/**
 * Client response time (days from request to received):
 */
export function calculateClientResponseDays(lines: TaskLine[]): number {
  const requestedAndReceived = lines.filter((l) => l.requestedAt && l.receivedAt);
  if (requestedAndReceived.length === 0) return 0;

  const diffs = requestedAndReceived.map((l) => {
    const req = l.requestedAt!.slice(0, 10);
    const rec = l.receivedAt!.slice(0, 10);
    return Math.max(0, daysFromToday(rec, req));
  });

  return median(diffs);
}
