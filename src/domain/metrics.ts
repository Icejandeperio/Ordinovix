import type {
  VisitItem, Visit, Task, TaskLine, FollowUp, FollowUpAttempt, Pulse, Channel, StatusGroup, OutcomeCause,
  Client, DeadlineMove, Baseline, InsightsData, InsightsFilter, InsightsKpi,
} from './types';
import { daysFromToday, addDaysToDate } from '@/lib/dates';
import { statusGroup } from './rules';

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

// ====================================================================================================
// Insights (spec 13.3–13.4). Pure functions over records already scoped and filtered by the caller.
// Months are 'YYYY-MM' keys; dates are 'YYYY-MM-DD'; timestamps are ISO strings with +08:00.
// ====================================================================================================

export interface MonthValue {
  month: string;
  value: number | null;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = (dateOrStamp: string): string => dateOrStamp.slice(0, 7);
const dayOf = (stamp: string): string => stamp.slice(0, 10);
const pct = (part: number, whole: number): number => Math.round((part / whole) * 100);
const round1 = (n: number): number => Math.round(n * 10) / 10;

const REPEAT_OUTCOMES = ['more_documents_requested', 'correction_required', 'not_accepted', 'follow_up_required'];
const isClosedTask = (t: Pick<Task, 'status'>): boolean => t.status === 'completed' || t.status === 'archived';
/** Past the operator's hands: nothing left to file, so it is never overdue. */
const isFinishedTask = (t: Pick<Task, 'status'>): boolean =>
  isClosedTask(t) || t.status === 'submitted' || t.status === 'awaiting_follow_up';

export function monthLabel(month: string): string {
  return SHORT_MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

export function monthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const last = monthOf(to);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (key > last) break;
    out.push(key);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export type RangePreset = 'last_6_months' | 'last_quarter' | 'ytd';

export function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (preset === 'ytd') return { from: `${y}-01-01`, to: today };
  if (preset === 'last_6_months') {
    const idx = y * 12 + (m - 1) - 5;
    const fy = Math.floor(idx / 12);
    return { from: `${fy}-${String((idx % 12) + 1).padStart(2, '0')}-01`, to: today };
  }
  // The calendar quarter before the one today falls in
  const q = Math.floor((m - 1) / 3); // 0..3 for the current quarter
  const qy = q === 0 ? y - 1 : y;
  const startMonth = (q === 0 ? 3 : q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = new Date(Date.UTC(qy, endMonth, 0)).getUTCDate();
  const mm = (n: number) => String(n).padStart(2, '0');
  return { from: `${qy}-${mm(startMonth)}-01`, to: `${qy}-${mm(endMonth)}-${endDay}` };
}

export function inRange(date: string | undefined, from?: string, to?: string): boolean {
  if (!date) return false;
  const d = dayOf(date);
  return (!from || d >= from) && (!to || d <= to);
}

/** The Monday on or before a date. */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysToDate(date, -((dow + 6) % 7));
}

function isoWeekNumber(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

// ---- Trips ----------------------------------------------------------------------------------------------

export function firstPassByMonth(items: VisitItem[], months: string[]) {
  return months.map((month) => {
    const firsts = items.filter((i) => i.isFirstVisitForTask && i.outcome && i.outcomeAt && monthOf(i.outcomeAt) === month);
    const ok = firsts.filter((i) => i.outcome === 'completed' || i.outcome === 'submitted_pending' || i.outcome === 'paid_proof_pending');
    return { month, rate: firsts.length ? pct(ok.length, firsts.length) : null, firstVisits: firsts.length };
  });
}

export function tripsNeedingReturnByMonth(items: VisitItem[], months: string[]) {
  return months.map((month) => {
    const repeats = items.filter((i) => i.outcome && REPEAT_OUTCOMES.includes(i.outcome) && i.outcomeAt && monthOf(i.outcomeAt) === month);
    const avoidable = repeats.filter((i) => i.avoidable === true).length;
    return { month, avoidable, notAvoidable: repeats.length - avoidable };
  });
}

const hasStarted = (v: Pick<Visit, 'status'>): boolean => v.status === 'in_progress' || v.status === 'done';

export function visitsPerMonth(visits: Visit[], months: string[]) {
  return months.map((month) => ({ month, count: visits.filter((v) => hasStarted(v) && monthOf(v.plannedDate) === month).length }));
}

export function itemsPerVisitByMonth(visits: Visit[], items: VisitItem[], months: string[]): MonthValue[] {
  return months.map((month) => {
    const ids = new Set(visits.filter((v) => hasStarted(v) && monthOf(v.plannedDate) === month).map((v) => v.id));
    if (ids.size === 0) return { month, value: null };
    return { month, value: round1(items.filter((i) => ids.has(i.visitId)).length / ids.size) };
  });
}

export function outcomesByMonth(items: VisitItem[], months: string[]) {
  return months.map((month) => {
    const here = items.filter((i) => i.outcome && i.outcomeAt && monthOf(i.outcomeAt) === month);
    const count = (...o: string[]) => here.filter((i) => o.includes(i.outcome!)).length;
    return {
      month,
      completed: count('completed'),
      submittedPaid: count('submitted_pending', 'paid_proof_pending'),
      moreDocs: count('more_documents_requested', 'correction_required', 'follow_up_required'),
      notAccepted: count('not_accepted'),
    };
  });
}

export function returnCauses(items: VisitItem[]) {
  const byCause = new Map<string, { count: number; avoidable: number }>();
  for (const i of items) {
    if (!i.outcome || !REPEAT_OUTCOMES.includes(i.outcome) || !i.outcomeCause) continue;
    const row = byCause.get(i.outcomeCause) ?? { count: 0, avoidable: 0 };
    row.count += 1;
    if (i.avoidable) row.avoidable += 1;
    byCause.set(i.outcomeCause, row);
  }
  return [...byCause.entries()]
    .map(([cause, r]) => ({ cause: cause as OutcomeCause, count: r.count, avoidable: r.avoidable * 2 > r.count }))
    .sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause));
}

export function visitCostsByMonth(visits: Visit[], months: string[]) {
  return months.map((month) => {
    const centavos = visits
      .filter((v) => hasStarted(v) && monthOf(v.plannedDate) === month)
      .reduce((sum, v) => sum + (v.costs?.transport ?? 0) + (v.costs?.parking ?? 0) + (v.costs?.other ?? 0), 0);
    return { month, pesos: centavos / 100 };
  });
}

export function officePerformance(visits: Visit[], items: VisitItem[]) {
  const byOffice = new Map<string, Visit[]>();
  for (const v of visits.filter(hasStarted)) byOffice.set(v.officeName, [...(byOffice.get(v.officeName) ?? []), v]);
  return [...byOffice.entries()]
    .map(([officeName, vs]) => {
      const ids = new Set(vs.map((v) => v.id));
      const minutes = vs
        .filter((v) => v.startedAt && v.finishedAt)
        .map((v) => Math.round((new Date(v.finishedAt!).getTime() - new Date(v.startedAt!).getTime()) / 60_000));
      return {
        officeName,
        visits: vs.length,
        firstPassRate: calculateFirstPassRate(items.filter((i) => ids.has(i.visitId))),
        medianMinutes: minutes.length ? Math.round(median(minutes)) : null,
        lastVisited: vs.map((v) => v.plannedDate).sort().at(-1)!,
      };
    })
    .sort((a, b) => b.visits - a.visits || a.officeName.localeCompare(b.officeName));
}

export function visitsLeftNotReady(visits: Visit[]) {
  return visits
    .filter((v) => hasStarted(v) && v.departureOverrideReason)
    .map((v) => ({ visitId: v.id, date: v.plannedDate, officeName: v.officeName, reason: v.departureOverrideReason! }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---- Chasing --------------------------------------------------------------------------------------------

export function followUpsPerWeek(attempts: FollowUpAttempt[], fromWeekStart: string, toDate: string) {
  const rows: Array<{ weekStart: string; label: string; count: number }> = [];
  for (let w = weekStart(fromWeekStart); w <= toDate; w = addDaysToDate(w, 7)) {
    const end = addDaysToDate(w, 6);
    rows.push({ weekStart: w, label: `W${isoWeekNumber(w)}`, count: attempts.filter((a) => inRange(a.sentAt, w, end)).length });
  }
  return rows;
}

export function followUpsPerCompletedTask(tasks: Task[], followUps: FollowUp[]) {
  const chases = new Map<string, number>();
  for (const f of followUps) if (f.taskId) chases.set(f.taskId, (chases.get(f.taskId) ?? 0) + f.attemptCount);
  const done = tasks.filter((t) => t.status === 'completed');
  const bucket = (n: number) => done.filter((t) => Math.min(chases.get(t.id) ?? 0, 3) === n).length;
  return [
    { bucket: '0', tasks: bucket(0) },
    { bucket: '1', tasks: bucket(1) },
    { bucket: '2', tasks: bucket(2) },
    { bucket: '3+', tasks: bucket(3) },
  ];
}

export function followUpSuccessRate(followUps: FollowUp[]): number {
  if (followUps.length === 0) return 0;
  return pct(followUps.filter((f) => f.status === 'answered' || f.status === 'resolved').length, followUps.length);
}

export function channelEffectiveness(followUps: FollowUp[], attempts: FollowUpAttempt[]) {
  const rows = new Map<Channel, { attempts: number; responses: number }>();
  const row = (c: Channel) => rows.get(c) ?? { attempts: 0, responses: 0 };
  for (const a of attempts) rows.set(a.channel, { ...row(a.channel), attempts: row(a.channel).attempts + 1 });
  for (const f of followUps) {
    if (f.status === 'answered' || f.status === 'resolved') rows.set(f.channel, { ...row(f.channel), responses: row(f.channel).responses + 1 });
  }
  return [...rows.entries()]
    .filter(([, r]) => r.attempts > 0)
    .map(([channel, r]) => ({ channel, ...r }))
    .sort((a, b) => b.attempts - a.attempts || a.channel.localeCompare(b.channel));
}

export function clientResponseDaysByMonth(lines: TaskLine[], months: string[]): MonthValue[] {
  return months.map((month) => {
    const days = lines
      .filter((l) => l.requestedAt && l.receivedAt && monthOf(l.receivedAt) === month)
      .map((l) => Math.max(0, daysFromToday(dayOf(l.receivedAt!), dayOf(l.requestedAt!))));
    return { month, value: days.length ? median(days) : null };
  });
}

export function lateBlockersByMonth(lines: TaskLine[], months: string[]) {
  return months.map((month) => ({ month, count: lines.filter((l) => l.lateDiscovered && monthOf(l.createdAt) === month).length }));
}

export function itemsMostOftenMissing(lines: TaskLine[], followUps: FollowUp[], limit = 10) {
  const stillMissing = lines.filter((l) => l.lateDiscovered || ['requested', 'incomplete', 'needs_correction'].includes(l.status));
  const byLabel = new Map<string, TaskLine[]>();
  for (const l of stillMissing) byLabel.set(l.label, [...(byLabel.get(l.label) ?? []), l]);
  return [...byLabel.entries()]
    .map(([label, ls]) => {
      const attempts = ls.map((l) => followUps.filter((f) => f.lineIds.includes(l.id)).reduce((sum, f) => sum + f.attemptCount, 0));
      return { label, times: ls.length, avgAttempts: round1(attempts.reduce((a, b) => a + b, 0) / ls.length) };
    })
    .sort((a, b) => b.times - a.times || a.label.localeCompare(b.label))
    .slice(0, limit);
}

// ---- Deadlines ------------------------------------------------------------------------------------------

/** Tasks already due by today (or finished), split by whether they were filed on or before the due date. */
export function onTimeCounts(tasks: Task[], today: string): { onTime: number; late: number } {
  const counted = tasks.filter((t) => t.dueDate <= today || t.submittedAt || t.completedAt);
  const onTime = counted.filter((t) => {
    const finished = (t.submittedAt ?? t.completedAt)?.slice(0, 10);
    return finished ? finished <= t.dueDate : t.dueDate >= today;
  }).length;
  return { onTime, late: counted.length - onTime };
}

/** On-time rate (%) of tasks already due by today, or finished; null when there are none. */
export function onTimeRateAsOf(tasks: Task[], today: string): number | null {
  const { onTime, late } = onTimeCounts(tasks, today);
  return onTime + late === 0 ? null : pct(onTime, onTime + late);
}

export function onTimeByMonth(tasks: Task[], months: string[], today: string) {
  return months.map((month) => ({ month, rate: onTimeRateAsOf(tasks.filter((t) => monthOf(t.dueDate) === month), today) }));
}

export function overdueByAge(tasks: Task[], today: string) {
  const ages = tasks.filter((t) => !isFinishedTask(t) && t.dueDate < today).map((t) => daysFromToday(today, t.dueDate));
  const within = (lo: number, hi: number) => ages.filter((a) => a >= lo && a <= hi).length;
  return [
    { label: '1–3 Days', value: within(1, 3) },
    { label: '4–7 Days', value: within(4, 7) },
    { label: '8–14 Days', value: within(8, 14) },
    { label: '15+ Days', value: within(15, Infinity) },
  ];
}

export function dueHeat(tasks: Task[], today: string, weeks = 8) {
  const last = addDaysToDate(today, weeks * 7 - 1);
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (isFinishedTask(t) || t.dueDate < today || t.dueDate > last) continue;
    counts.set(t.dueDate, (counts.get(t.dueDate) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Workload and clients -------------------------------------------------------------------------------

export function openTasksByPerson(tasks: Task[], names: Record<string, string>) {
  const counts = new Map<string, number>();
  for (const t of tasks.filter((x) => !isClosedTask(x))) counts.set(t.ownerUserId, (counts.get(t.ownerUserId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([userId, value]) => ({ userId, label: names[userId] ?? userId, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export function statusGroupCounts(tasks: Task[]): Record<StatusGroup, number> {
  const out: Record<StatusGroup, number> = { blocked: 0, in_progress: 0, ready: 0, submitted: 0, done: 0 };
  for (const t of tasks) out[statusGroup(t.status)] += 1;
  return out;
}

export function completedPerMonthByPerson(tasks: Task[], months: string[]) {
  return months.map((month) => {
    const byUser: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status === 'completed' && t.completedAt && monthOf(t.completedAt) === month) byUser[t.ownerUserId] = (byUser[t.ownerUserId] ?? 0) + 1;
    }
    return { month, byUser };
  });
}

export function daysToCollectByTemplate(tasks: Task[], templates: Array<{ id: string; code: string; name: string }>) {
  return templates
    .filter((tpl) => tasks.some((t) => t.templateId === tpl.id && t.readyAt))
    .map((tpl) => ({ templateId: tpl.id, label: `${tpl.code} — ${tpl.name}`, days: calculateDaysToCollect(tasks.filter((t) => t.templateId === tpl.id)) }))
    .sort((a, b) => b.days - a.days || a.label.localeCompare(b.label));
}

export function tasksMissingNextAction(tasks: Task[]): Task[] {
  return tasks.filter((t) => !isClosedTask(t) && !(t.nextAction && t.nextAction.text.trim().length > 0));
}

export function clientProfile(
  clients: Array<{ id: string; code: string; displayName: string }>,
  tasks: Task[],
  lines: TaskLine[],
  followUps: FollowUp[],
  items: VisitItem[],
) {
  return clients.map((c) => {
    const mine = tasks.filter((t) => t.clientId === c.id);
    const completed = mine.map((t) => t.completedAt && dayOf(t.completedAt)).filter((d): d is string => Boolean(d)).sort();
    return {
      clientId: c.id,
      code: c.code,
      name: c.displayName,
      openTasks: mine.filter((t) => !isClosedTask(t)).length,
      avgResponseDays: calculateClientResponseDays(lines.filter((l) => l.clientId === c.id)),
      followUps: followUps.filter((f) => f.clientId === c.id).reduce((sum, f) => sum + f.attemptCount, 0),
      repeatTrips: items.filter((i) => i.clientId === c.id && i.outcome && REPEAT_OUTCOMES.includes(i.outcome)).length,
      lastCompleted: completed.at(-1) ?? null,
    };
  });
}

// ---- Comparisons, pulses, takeaways ---------------------------------------------------------------------

export function monthChange(series: MonthValue[]) {
  const cur = series.at(-1);
  const prev = series.length > 1 ? series.at(-2) : undefined;
  const current = cur?.value ?? null;
  const previous = prev?.value ?? null;
  return {
    current,
    previous,
    delta: current !== null && previous !== null ? round1(current - previous) : null,
    previousMonth: prev?.month ?? null,
  };
}

export function describeTrend(label: string, series: MonthValue[], unit: string, prefix = ''): string {
  const cur = series.at(-1);
  if (!cur || cur.value === null) return 'Not enough data yet.';
  const head = `${label} in ${monthLabel(cur.month)}: ${prefix}${cur.value}${unit}`;
  const { previous, delta, previousMonth } = monthChange(series);
  if (previous === null || delta === null || previousMonth === null) return `${head}.`;
  const move = delta === 0 ? 'unchanged' : `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}`;
  return `${head}, ${move} from ${prefix}${previous}${unit} in ${monthLabel(previousMonth)}.`;
}

export function pulseSeries(pulses: Pulse[], months: string[], field: 'confidence' | 'hoursFindingLastWeek'): MonthValue[] {
  return months.map((month) => {
    const latest = pulses.filter((p) => p.month === month && p[field] !== undefined).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { month, value: latest ? (latest[field] as number) : null };
  });
}

// ---- Two monthly series behind the KPI tiles ------------------------------------------------------------

export function leftReadyByMonth(visits: Visit[], months: string[]): MonthValue[] {
  return months.map((month) => {
    const started = visits.filter((v) => hasStarted(v) && monthOf(v.plannedDate) === month);
    if (started.length === 0) return { month, value: null };
    return { month, value: pct(started.filter((v) => !v.departureOverrideReason).length, started.length) };
  });
}

/** Median number of follow-up messages per task, among tasks completed in each month. */
export function chasesPerTaskByMonth(tasks: Task[], followUps: FollowUp[], months: string[]): MonthValue[] {
  const chases = new Map<string, number>();
  for (const f of followUps) if (f.taskId) chases.set(f.taskId, (chases.get(f.taskId) ?? 0) + f.attemptCount);
  return months.map((month) => {
    const done = tasks.filter((t) => t.status === 'completed' && t.completedAt && monthOf(t.completedAt) === month);
    return { month, value: done.length ? median(done.map((t) => chases.get(t.id) ?? 0)) : null };
  });
}

// ---- Assembly: everything the Insights screen shows, for one set of filters ----------------------------

export interface InsightsInput {
  tasks: Task[];
  taskLines: TaskLine[];
  visits: Visit[];
  visitItems: VisitItem[];
  followUps: FollowUp[];
  attempts: FollowUpAttempt[];
  clients: Client[];
  templates: Array<{ id: string; code: string; name: string }>;
  deadlineMoves: DeadlineMove[];
  pulses: Pulse[];
  baseline: Baseline | null;
  userNames: Record<string, string>;
  userRoles: Record<string, 'owner' | 'helper'>;
}

const NOT_ENOUGH = 'Not enough data yet.';
const words = (code: string): string => code.replace(/_/g, ' ');
const points = <K extends string>(rows: Array<{ month: string } & Record<K, number | null>>, key: K): MonthValue[] =>
  rows.map((r) => ({ month: r.month, value: r[key] }));

function kpi(
  key: InsightsKpi['key'],
  title: string,
  value: number | null,
  unit: string,
  series: MonthValue[],
  higherIsBetter: boolean,
  note: string,
  pts = '',
): InsightsKpi {
  const { delta, previousMonth } = monthChange(series);
  const shown = value === null ? '—' : `${value}${unit}`;
  if (delta === null || previousMonth === null) return { key, title, value: shown, comparison: 'no earlier month to compare', trend: 'none', improved: null, note };
  if (delta === 0) return { key, title, value: shown, comparison: `unchanged vs ${monthLabel(previousMonth)}`, trend: 'flat', improved: null, note };
  const up = delta > 0;
  return {
    key,
    title,
    value: shown,
    comparison: `${up ? 'up' : 'down'} ${Math.abs(delta)}${pts} vs ${monthLabel(previousMonth)}`,
    trend: up ? 'up' : 'down',
    improved: up === higherIsBetter,
    note,
  };
}

export function computeInsights(input: InsightsInput, f: InsightsFilter, today: string): InsightsData {
  const preset = presetRange('last_6_months', today);
  const from = f.from ?? preset.from;
  const to = f.to ?? preset.to;
  const months = monthsInRange(from, to);
  const lastMonth = months.at(-1) ?? monthOf(today);

  // Client, assignee and template narrow the work; the date range narrows each measure by its own date.
  const byTask = Boolean(f.assignedUserId || f.templateId);
  const narrowed = byTask || Boolean(f.clientId);
  const tasks = input.tasks.filter(
    (t) => (!f.clientId || t.clientId === f.clientId) && (!f.assignedUserId || t.ownerUserId === f.assignedUserId) && (!f.templateId || t.templateId === f.templateId),
  );
  const taskIds = new Set(tasks.map((t) => t.id));
  const lines = input.taskLines.filter((l) => (!f.clientId || l.clientId === f.clientId) && (!byTask || taskIds.has(l.taskId)));
  const allItems = input.visitItems.filter((i) => (!f.clientId || i.clientId === f.clientId) && (!byTask || taskIds.has(i.taskId)));
  const followUps = input.followUps.filter((u) => (!f.clientId || u.clientId === f.clientId) && (!byTask || (u.taskId !== undefined && taskIds.has(u.taskId))));
  const followUpIds = new Set(followUps.map((u) => u.id));
  const attempts = input.attempts.filter((a) => followUpIds.has(a.followUpId));
  const visitIdsWithItems = new Set(allItems.map((i) => i.visitId));
  const visits = input.visits.filter((v) => !narrowed || visitIdsWithItems.has(v.id));

  const items = allItems.filter((i) => inRange(i.outcomeAt, from, to));
  const rVisits = visits.filter((v) => inRange(v.plannedDate, from, to));
  const dueTasks = tasks.filter((t) => inRange(t.dueDate, from, to));
  const completedTasks = tasks.filter((t) => t.status === 'completed' && inRange(t.completedAt, from, to));
  const rLines = lines.filter((l) => inRange(l.receivedAt, from, to));
  const rFollowUps = followUps.filter((u) => inRange(u.createdAt, from, to));
  const rAttempts = attempts.filter((a) => inRange(a.sentAt, from, to));

  const b = input.baseline;
  const firstPassBaseline = b?.tripsPerMonth && b.repeatTripsPerMonth !== undefined ? Math.max(0, pct(b.tripsPerMonth - b.repeatTripsPerMonth, b.tripsPerMonth)) : null;

  // ---- Overview
  const firstPass = firstPassByMonth(items, months);
  const tripsByMonth = tripsNeedingReturnByMonth(items, months);
  const avoidableSeries: MonthValue[] = tripsByMonth.map((r) => ({ month: r.month, value: r.avoidable }));
  const leftReady = leftReadyByMonth(rVisits, months);
  const chasesSeries = chasesPerTaskByMonth(completedTasks, followUps, months);
  const onTime = onTimeByMonth(tasks, months, today);
  const confidence = pulseSeries(input.pulses, months, 'confidence');
  const hoursFinding = pulseSeries(input.pulses, months, 'hoursFindingLastWeek');
  const firstVisits = items.filter((i) => i.isFirstVisitForTask && i.outcome);
  const started = rVisits.filter(hasStarted);
  const chaseCounts = new Map<string, number>();
  for (const u of followUps) if (u.taskId) chaseCounts.set(u.taskId, (chaseCounts.get(u.taskId) ?? 0) + u.attemptCount);
  const onTimeNow = onTimeRateAsOf(dueTasks, today);
  const active = tasks.filter((t) => !isClosedTask(t));
  const { avoidable, total: repeatTotal } = countTripsNeedingReturn(items);

  const kpis: InsightsKpi[] = [
    kpi('firstPass', 'First-Pass Completion', firstVisits.length ? calculateFirstPassRate(items) : null, '%', points(firstPass, 'rate'), true,
      firstPassBaseline !== null ? `self-reported before Ordinovix ~${firstPassBaseline}%` : '', ' pts'),
    kpi('repeatTrips', `Avoidable Repeat Trips (${monthLabel(lastMonth)})`, avoidableSeries.at(-1)?.value ?? null, '', avoidableSeries, false,
      b?.repeatTripsPerMonth !== undefined ? `self-reported before Ordinovix ${b.repeatTripsPerMonth}/month` : ''),
    kpi('leftReady', 'Visits That Left Ready', started.length ? calculateVisitsLeftReadyRate(rVisits) : null, '%', leftReady, true,
      started.length ? `${started.filter((v) => v.departureOverrideReason).length} departure overrides` : '', ' pts'),
    kpi('followUps', 'Follow-ups Per Task (Median)', completedTasks.length ? median(completedTasks.map((t) => chaseCounts.get(t.id) ?? 0)) : null, '', chasesSeries, false,
      b?.followUpsPerWeek !== undefined ? `self-reported before Ordinovix ${b.followUpsPerWeek} follow-ups/week` : ''),
    kpi('onTime', 'On-Time Filing Rate', onTimeNow, '%', points(onTime, 'rate'), true,
      b?.lateFilingsPerQuarter !== undefined ? `self-reported before Ordinovix ${b.lateFilingsPerQuarter} late filings/quarter` : '', ' pts'),
    {
      ...kpi('ownership', 'Tasks With Owner & Next Action', active.length ? calculateOwnershipCoverage(tasks) : null, '%', [], true, 'target 100%'),
      comparison: 'right now',
    },
  ];

  const baselineSentence = firstPassBaseline !== null ? ` Self-reported before Ordinovix: ~${firstPassBaseline}%.` : '';
  const filingsByMonth = (m: string) => tasks.filter((t) => (t.submittedAt ?? t.completedAt)?.startsWith(m)).length;

  const overview: InsightsData['overview'] = {
    firstPassRate: calculateFirstPassRate(items),
    repeatTripRate: repeatTotal > 0 ? pct(avoidable, repeatTotal) : 0,
    onTimeFilingRate: onTimeNow ?? 0,
    averageDaysToCollect: calculateDaysToCollect(tasks.filter((t) => inRange(t.readyAt, from, to))),
    baselineComparison: firstPassBaseline !== null && b?.repeatTripsPerMonth !== undefined ? { firstPassBaseline, repeatTripsBaseline: b.repeatTripsPerMonth } : undefined,
    monthlyTrends: months.map((m, idx) => ({ month: monthLabel(m), firstPassRate: firstPass[idx].rate ?? 0, repeatTrips: tripsByMonth[idx].avoidable, filings: filingsByMonth(m) })),
    months,
    isEmpty: items.length === 0 && rVisits.length === 0 && dueTasks.length === 0,
    kpis,
    firstPassByMonth: points(firstPass, 'rate'),
    firstPassBaseline,
    tripsByMonth,
    confidenceByMonth: confidence,
    hoursFindingByMonth: hoursFinding,
    takeaways: {
      firstPass: describeTrend('First-pass completion', points(firstPass, 'rate'), '%') + (firstPass.at(-1)?.rate != null ? baselineSentence : ''),
      trips: describeTrend('Avoidable repeat trips', avoidableSeries, ''),
      confidence: describeTrend('Confidence in compliance status', confidence, '/5'),
      hours: describeTrend('Hours spent finding records last week', hoursFinding, ' h'),
    },
  };

  // ---- Trips
  const offices = officePerformance(rVisits, items);
  const costs = visitCostsByMonth(rVisits, months);
  const causes = returnCauses(items);
  const outcomeRows = outcomesByMonth(items, months);
  const goodOutcomes = outcomeRows.reduce((s, r) => s + r.completed + r.submittedPaid, 0);
  const allOutcomes = outcomeRows.reduce((s, r) => s + r.completed + r.submittedPaid + r.moreDocs + r.notAccepted, 0);
  const visitsSeries = visitsPerMonth(rVisits, months);
  const itemsPerVisit = itemsPerVisitByMonth(rVisits, items, months);
  const causeTotal = causes.reduce((s, c) => s + c.count, 0);
  const trips: InsightsData['trips'] = {
    totalTrips: started.length,
    completedTrips: rVisits.filter((v) => v.status === 'done').length,
    avoidableRejectionCount: avoidable,
    topRejectionCauses: causes,
    officePerformance: offices.map((o) => ({ officeName: o.officeName, visits: o.visits, firstPassRate: o.firstPassRate })),
    months,
    isEmpty: rVisits.length === 0 && items.length === 0,
    visitsByMonth: visitsSeries,
    itemsPerVisitByMonth: itemsPerVisit,
    outcomesByMonth: outcomeRows,
    costsByMonth: costs,
    offices,
    leftNotReady: visitsLeftNotReady(rVisits),
    takeaways: {
      visits: describeTrend('Office visits', visitsSeries.map((r) => ({ month: r.month, value: r.count })), ''),
      itemsPerVisit: describeTrend('Errand items per visit', itemsPerVisit, ''),
      outcomes: allOutcomes ? `${pct(goodOutcomes, allOutcomes)}% of counter outcomes were completed, submitted or paid.` : NOT_ENOUGH,
      causes: causes.length ? `${words(causes[0].cause)} caused ${causes[0].count} of ${causeTotal} repeat trips.` : 'No trips needed a return in this period.',
      costs: describeTrend('Visit spending', costs.map((r) => ({ month: r.month, value: r.pesos })), '', '₱'),
    },
  };

  // ---- Chasing
  const weekEnd = to < today ? to : today;
  const weekFrom = [weekStart(from), addDaysToDate(weekStart(weekEnd), -35)].sort().at(-1)!;
  const perWeek = followUpsPerWeek(rAttempts, weekFrom, weekEnd);
  const buckets = followUpsPerCompletedTask(completedTasks, followUps);
  const responseDays = clientResponseDaysByMonth(lines, months);
  const lateBlockers = lateBlockersByMonth(lines, months);
  const withChases = tasks.filter((t) => chaseCounts.has(t.id));
  const doneTotal = buckets.reduce((s, r) => s + r.tasks, 0);
  const latestWeeks = perWeek.slice(-2);
  const chasing: InsightsData['chasing'] = {
    averageResponseDays: calculateClientResponseDays(rLines),
    followUpSuccessRate: followUpSuccessRate(rFollowUps),
    chasesPerTask: withChases.length ? round1(withChases.reduce((s, t) => s + (chaseCounts.get(t.id) ?? 0), 0) / withChases.length) : 0,
    lateDiscoveredBlockersCount: lateBlockers.reduce((s, r) => s + r.count, 0),
    channelEffectiveness: channelEffectiveness(rFollowUps, rAttempts),
    months,
    isEmpty: lines.length === 0 && followUps.length === 0,
    followUpsPerWeek: perWeek,
    chasesPerCompletedTask: buckets as InsightsData['chasing']['chasesPerCompletedTask'],
    responseDaysByMonth: responseDays,
    lateBlockersByMonth: lateBlockers,
    itemsMissing: itemsMostOftenMissing(lines, followUps),
    takeaways: {
      followUps: latestWeeks.length === 2
        ? `${latestWeeks[1].count} follow-up messages were sent in ${latestWeeks[1].label}, against ${latestWeeks[0].count} in ${latestWeeks[0].label}.`
        : NOT_ENOUGH,
      chases: doneTotal ? `${pct(buckets[0].tasks + buckets[1].tasks, doneTotal)}% of completed tasks needed one follow-up or none.` : NOT_ENOUGH,
      responseDays: describeTrend('Median days for clients to send documents', responseDays, ' days'),
      lateBlockers: describeTrend('Late-discovered blockers', lateBlockers.map((r) => ({ month: r.month, value: r.count })), ''),
    },
  };

  // ---- Deadlines
  const overdue = overdueByAge(tasks, today);
  const overdueTotal = overdue.reduce((s, r) => s + r.value, 0);
  const heat = dueHeat(tasks, today, 8);
  const templateName = new Map(input.templates.map((t) => [t.id, `${t.code} — ${t.name}`]));
  const counts = onTimeCounts(dueTasks, today);
  const deadlines: InsightsData['deadlines'] = {
    filingsOnTime: counts.onTime,
    filingsLate: counts.late,
    heatCalendar: heat.map((h) => ({ date: h.date, taskCount: h.count })),
    months,
    isEmpty: tasks.length === 0,
    heatStart: weekStart(today),
    onTimeByMonth: onTime,
    overdueByAge: overdue,
    deadlineMoves: input.deadlineMoves
      .filter((m) => !f.templateId || !m.templateId || m.templateId === f.templateId)
      .map((m) => ({ id: m.id, template: m.templateId ? templateName.get(m.templateId) ?? m.templateId : 'All templates', period: m.period, newDueDate: m.newDueDate, sourceRef: m.sourceRef, sourceUrl: m.sourceUrl }))
      .sort((a, c) => c.newDueDate.localeCompare(a.newDueDate)),
    takeaways: {
      onTime: describeTrend('On-time filing rate', points(onTime, 'rate'), '%'),
      overdue: overdueTotal ? `${overdueTotal} open ${overdueTotal === 1 ? 'task is' : 'tasks are'} past due.` : 'Nothing is overdue.',
    },
  };

  // ---- Workload
  const names = input.userNames;
  const openByPerson = openTasksByPerson(tasks, names);
  const groups = statusGroupCounts(tasks);
  const openTotal = groups.blocked + groups.in_progress + groups.ready + groups.submitted;
  const collect = daysToCollectByTemplate(tasks.filter((t) => inRange(t.readyAt, from, to)), input.templates);
  const clientCode = new Map(input.clients.map((c) => [c.id, c.code]));
  const taskTitle = (t: Task) => (t.title ?? (t.templateId ? templateName.get(t.templateId)?.split(' — ')[1] : undefined) ?? t.kind) + (t.period ? ` (${t.period})` : '');
  const people = [...new Set(tasks.map((t) => t.ownerUserId))].map((userId) => ({ userId, label: names[userId] ?? userId }));
  const roleOf = (id: string) => input.userRoles[id];
  const workload: InsightsData['workload'] = {
    operatorTasks: active.filter((t) => roleOf(t.ownerUserId) === 'owner').length,
    helperTasks: active.filter((t) => roleOf(t.ownerUserId) === 'helper').length,
    tasksByStatusGroup: groups,
    months,
    isEmpty: tasks.length === 0,
    openByPerson,
    completedByMonth: completedPerMonthByPerson(tasks, months),
    people,
    daysToCollectByTemplate: collect,
    missingNextAction: tasksMissingNextAction(tasks).map((t) => ({
      taskId: t.id, clientCode: clientCode.get(t.clientId) ?? '', title: taskTitle(t), dueDate: t.dueDate, ownerName: names[t.ownerUserId] ?? t.ownerUserId,
    })),
    takeaways: {
      people: openByPerson.length ? `${openByPerson[0].label} holds the most open tasks (${openByPerson[0].value}).` : 'No open tasks.',
      status: openTotal ? `${pct(groups.ready, openTotal)}% of open tasks are ready for the next step; ${pct(groups.blocked, openTotal)}% are blocked.` : 'No open tasks.',
      collect: collect.length ? `${collect[0].label} takes the longest to collect (${collect[0].days} days).` : NOT_ENOUGH,
    },
  };

  // ---- Clients
  const visibleClients = input.clients.filter((c) => !f.clientId || c.id === f.clientId);
  const rows = clientProfile(visibleClients, tasks, rLines, rFollowUps, items).sort((a, c) => a.code.localeCompare(c.code));
  const clientById = new Map(input.clients.map((c) => [c.id, c]));
  const measured = rows.filter((r) => r.avgResponseDays > 0);
  const unread = (id: string) => lines.filter((l) => l.clientId === id && l.status === 'received').length;
  const clients: InsightsData['clients'] = {
    fastestClients: [...measured].sort((a, c) => a.avgResponseDays - c.avgResponseDays).slice(0, 3).map((r) => ({ client: clientById.get(r.clientId)!, avgDays: r.avgResponseDays })),
    slowestClients: [...measured].sort((a, c) => c.avgResponseDays - a.avgResponseDays).slice(0, 3).map((r) => ({ client: clientById.get(r.clientId)!, avgDays: r.avgResponseDays, unreadReviewsCount: unread(r.clientId) })),
    isEmpty: rows.length === 0,
    rows,
  };

  return { overview, trips, chasing, deadlines, workload, clients };
}
