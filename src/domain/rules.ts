import type {
  LineStatus,
  TaskStatus,
  StatusGroup,
  Role,
  DueState,
  AuthorizationState,
  FollowUpState,
  Outcome,
  OutcomeCause,
  Task,
  TaskLine,
  Authorization,
  FollowUp,
  Holiday,
  Visit,
  VisitItem,
  VisitKitItem,
  TaskTemplate,
  DeadlineMove,
  Client,
  ISODate,
  ID,
  TaskKind,
  Frequency,
  NextAction,
  PeriodKey,
  CopyForm,
} from './types';
import { todayInManila, daysFromToday, addDaysToDate } from '@/lib/dates';

/**
 * Typed error for a broken product rule. Repositories throw it; the API maps it to the same code.
 */
export class RuleViolationError extends Error {
  readonly code = 'RULE_VIOLATION' as const;
  constructor(message: string) {
    super(message);
    this.name = 'RuleViolationError';
  }
}

/**
 * A visit can be finished only when every item has a saved outcome (product rule 3).
 */
export function canFinishVisit(items: ReadonlyArray<Pick<VisitItem, 'outcome'>>): boolean {
  return items.every((i) => Boolean(i.outcome));
}

/**
 * 16.2 Line transitions
 */
export function canTransitionLine(from: LineStatus, to: LineStatus): boolean {
  if (from === to) return true;

  switch (from) {
    case 'not_requested':
      return to === 'requested' || to === 'received' || to === 'not_applicable';
    case 'requested':
      return to === 'received' || to === 'not_applicable';
    case 'received':
      return to === 'under_review' || to === 'accepted' || to === 'incomplete' || to === 'needs_correction';
    case 'under_review':
      return to === 'accepted' || to === 'incomplete' || to === 'needs_correction';
    case 'incomplete':
    case 'needs_correction':
      return to === 'requested' || to === 'received';
    case 'accepted':
      return to === 'under_review'; // reopen
    case 'not_applicable':
      return to === 'not_requested'; // reopen
    default:
      return false;
  }
}

/**
 * 16.3 Displayed task status (derivedStatus)
 * Evaluated in order; first match wins.
 */
export function derivedStatus(task: Task, lines: TaskLine[]): TaskStatus {
  // 1. Stored status is completed or archived
  if (task.status === 'completed' || task.status === 'archived') {
    return task.status;
  }

  // 2. Status override exists
  if (task.statusOverride) {
    return task.statusOverride.status;
  }

  // 3. Required lines
  const required = lines.filter((l) => l.required && l.status !== 'not_applicable');

  // 4. Any required line is incomplete or needs_correction -> needs_correction
  if (required.some((l) => l.status === 'incomplete' || l.status === 'needs_correction')) {
    return 'needs_correction';
  }

  // 5. Any required line is not_requested or requested
  const hasNotRequestedOrRequested = required.some((l) => l.status === 'not_requested' || l.status === 'requested');
  if (hasNotRequestedOrRequested) {
    const allAreNotRequested = required.every((l) => l.status === 'not_requested');
    return allAreNotRequested ? 'intake' : 'waiting_on_client';
  }

  // 6. Any required line is received or under_review -> review_required
  if (required.some((l) => l.status === 'received' || l.status === 'under_review')) {
    return 'review_required';
  }

  // 7. All accepted (or no required lines) -> operator-set status
  const allowedOperatorStatuses: TaskStatus[] = [
    'in_preparation',
    'ready_for_review',
    'ready_next_step',
    'submitted',
    'awaiting_follow_up',
  ];
  if (allowedOperatorStatuses.includes(task.status)) {
    return task.status;
  }

  return 'in_preparation';
}

/**
 * Checks if task is blocked according to derivedStatus steps 4-6
 */
export function isBlocked(task: Task, lines: TaskLine[]): boolean {
  const status = derivedStatus(task, lines);
  return (
    status === 'intake' ||
    status === 'waiting_on_client' ||
    status === 'review_required' ||
    status === 'needs_correction'
  );
}

/**
 * Returns required lines not accepted and not not_applicable
 */
export function blockingLines(lines: TaskLine[]): TaskLine[] {
  return lines.filter((l) => l.required && l.status !== 'accepted' && l.status !== 'not_applicable');
}

/**
 * Groups blocking lines by supplier and returns a readable sentence
 */
export function blockingReason(lines: TaskLine[]): string | undefined {
  const blockers = blockingLines(lines);
  if (blockers.length === 0) return undefined;

  // Group by status
  if (blockers.some((l) => l.status === 'incomplete' || l.status === 'needs_correction')) {
    const items = blockers
      .filter((l) => l.status === 'incomplete' || l.status === 'needs_correction')
      .map((l) => l.label);
    return `Needs correction: ${items.length} items — ${items.slice(0, 2).join(', ')}${items.length > 2 ? '...' : ''}`;
  }

  if (blockers.some((l) => l.status === 'received' || l.status === 'under_review')) {
    const items = blockers
      .filter((l) => l.status === 'received' || l.status === 'under_review')
      .map((l) => l.label);
    return `Needs your review: ${items.length} items — ${items.slice(0, 2).join(', ')}${items.length > 2 ? '...' : ''}`;
  }

  const items = blockers
    .filter((l) => l.status === 'requested' || l.status === 'not_requested')
    .map((l) => l.label);
  return `Waiting on client: ${items.length} items — ${items.slice(0, 2).join(', ')}${items.length > 2 ? '...' : ''}`;
}

/**
 * Status group mapping
 */
export function statusGroup(status: TaskStatus): StatusGroup {
  switch (status) {
    case 'intake':
    case 'waiting_on_client':
    case 'review_required':
    case 'needs_correction':
      return 'blocked';
    case 'in_preparation':
    case 'ready_for_review':
      return 'in_progress';
    case 'ready_next_step':
      return 'ready';
    case 'submitted':
    case 'awaiting_follow_up':
      return 'submitted';
    case 'completed':
    case 'archived':
      return 'done';
  }
}

/**
 * 16.4 Operator-set task transitions
 */
export function canSetStatus(task: Task, lines: TaskLine[], to: TaskStatus, role: Role): boolean {
  if (isBlocked(task, lines)) {
    // A blocked task accepts no manual status for any role; the only path is an owner override with a reason
    return false;
  }

  const current = derivedStatus(task, lines);
  if (current === to) return true;

  switch (current) {
    case 'in_preparation':
      return to === 'ready_for_review' || to === 'ready_next_step';
    case 'ready_for_review':
      return to === 'in_preparation' || to === 'ready_next_step';
    case 'ready_next_step':
      return to === 'in_preparation' || to === 'submitted' || to === 'completed';
    case 'submitted':
      return to === 'awaiting_follow_up' || to === 'completed';
    case 'awaiting_follow_up':
      return to === 'submitted' || to === 'completed';
    case 'completed':
      return to === 'in_preparation'; // reopen
    case 'archived':
      return role === 'owner'; // restore
    default:
      return false;
  }
}

/**
 * 12.7 Mark completed: needs filing evidence, or a reason of at least 10 characters when evidence is missing
 */
export function canCompleteWithEvidence(hasEvidence: boolean, noEvidenceReason?: string): boolean {
  return hasEvidence || (noEvidenceReason?.trim().length ?? 0) >= 10;
}

/**
 * 16.5 Dates and validity - dueState
 */
export function dueState(task: Task, today: ISODate = todayInManila(), dueSoonDays: number = 7): DueState {
  if (task.status === 'completed' || task.status === 'archived') {
    return 'closed';
  }
  const diff = daysFromToday(task.dueDate, today);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due_today';
  if (diff <= dueSoonDays) return 'due_soon';
  return 'ok';
}

/**
 * 16.5 Authorization state
 */
export function authorizationState(
  auth: Authorization,
  onDate: ISODate = todayInManila(),
  warnDays: number = 30
): AuthorizationState {
  if (!auth.validUntil) return 'valid';
  const diff = daysFromToday(auth.validUntil, onDate);
  if (diff < 0) return 'expired';
  if (diff <= warnDays) return 'expiring';
  return 'valid';
}

/**
 * 16.5 Valid authorization finder
 */
export function validAuthorization(
  auths: Authorization[],
  clientId: ID,
  kind: TaskKind,
  onDate: ISODate = todayInManila()
): Authorization | null {
  const match = auths.find((a) => {
    if (a.clientId !== clientId) return false;
    if (a.deletedAt) return false;
    if (a.replacedById) return false;
    if (!a.scope.includes(kind)) return false;
    if (a.validUntil && a.validUntil < onDate) return false;
    return true;
  });
  return match ?? null;
}

/**
 * 16.5 Follow-up state
 */
export function followUpState(fu: FollowUp, today: ISODate = todayInManila()): FollowUpState {
  if (fu.status === 'escalated') return 'escalated';
  if (fu.status === 'resolved' || fu.status === 'answered') return 'resolved';
  if (fu.status === 'open') return 'not_sent';

  if (!fu.expectedBy) return 'waiting';
  const diff = daysFromToday(fu.expectedBy, today);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due_today';
  return 'waiting';
}

/**
 * 16.5 isLateDiscovered
 */
export function isLateDiscovered(task: Task, today: ISODate = todayInManila(), dueSoonWindow: number = 3): boolean {
  if (task.readyAt) return true;
  const diff = daysFromToday(task.dueDate, today);
  return diff <= dueSoonWindow;
}

/**
 * 16.5 nonWorkingDayNote
 */
export function nonWorkingDayNote(date: ISODate, holidays: Holiday[]): string | null {
  const [y, m, d] = date.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay(); // 0 is Sunday, 6 is Saturday
  if (dayOfWeek === 6) return 'Falls on a Saturday';
  if (dayOfWeek === 0) return 'Falls on a Sunday';

  const holiday = holidays.find((h) => h.date === date);
  if (holiday) {
    return `Falls on ${holiday.name} (${holiday.type.replace(/_/g, ' ')})`;
  }
  return null;
}

/**
 * 16.7 Visit item readiness
 */
export function visitItemReadiness(
  item: VisitItem,
  task: Task,
  lines: TaskLine[],
  auths: Authorization[],
  visitDate: ISODate,
  clientName: string = 'Client'
): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // 1. Required line is not accepted
  for (const line of lines) {
    if (line.required && line.status !== 'accepted' && line.status !== 'not_applicable') {
      const copyFormText =
        line.copyForm === 'original' || line.copyForm === 'certified_true_copy'
          ? `${line.copyForm === 'original' ? 'Original' : 'Certified copy'} `
          : '';
      reasons.push(`${copyFormText}"${line.label}" not yet accepted — ${clientName}`);
    }
  }

  // 2. Authorization required for office tasks
  if (task.officeAction) {
    const auth = validAuthorization(auths, task.clientId, task.kind, visitDate);
    if (!auth) {
      reasons.push(`No valid authorization / SPA on ${visitDate} — ${clientName}`);
    }
  }

  return {
    ready: reasons.length === 0,
    reasons,
  };
}

/**
 * 16.7 Visit readiness
 */
export function visitReadiness(
  items: Array<{ ready: boolean; reasons: string[]; taskId: ID; clientName: string }>
): {
  ready: boolean;
  readyCount: number;
  total: number;
  blockingItems: Array<{ taskId: ID; clientName: string; reasons: string[] }>;
} {
  const total = items.length;
  const readyItems = items.filter((i) => i.ready);
  const blocking = items
    .filter((i) => !i.ready)
    .map((i) => ({ taskId: i.taskId, clientName: i.clientName, reasons: i.reasons }));

  return {
    ready: total > 0 && readyItems.length === total,
    readyCount: readyItems.length,
    total,
    blockingItems: blocking,
  };
}

/**
 * 16.7 Pack list generation
 */
export function packList(
  visit: Visit,
  items: VisitItem[],
  linesByTask: Record<ID, TaskLine[]>,
  kit: VisitKitItem[],
  clientMap: Record<ID, Client>
) {
  const packedLineSet = new Set(visit.packedLineIds);
  const packedKitSet = new Set(visit.packedKitItemIds);

  const clientGroups: Record<
    ID,
    { clientId: ID; clientName: string; items: Array<{ label: string; form: CopyForm; copies: number; packed: boolean; refId: ID }> }
  > = {};

  for (const item of items) {
    const taskLines = linesByTask[item.taskId] || [];
    const client = clientMap[item.clientId];
    const clientName = client?.displayName || 'Client';

    if (!clientGroups[item.clientId]) {
      clientGroups[item.clientId] = {
        clientId: item.clientId,
        clientName,
        items: [],
      };
    }

    for (const line of taskLines) {
      // Physical items to bring: original, certified, photocopy, or digital with printAndBring
      const isPhysical =
        line.copyForm === 'original' ||
        line.copyForm === 'certified_true_copy' ||
        line.copyForm === 'photocopy' ||
        (line.copyForm === 'digital' && line.printAndBring);

      if (isPhysical && line.status !== 'not_applicable') {
        clientGroups[item.clientId].items.push({
          label: line.label,
          form: line.copyForm,
          // Template value when the line has one, otherwise a single copy (Originals included)
          copies: line.copies && line.copies > 0 ? line.copies : 1,
          packed: packedLineSet.has(line.id),
          refId: line.id,
        });
      }
    }
  }

  const kitItems = kit
    .filter((k) => k.active)
    .map((k) => ({
      kitItem: k,
      packed: packedKitSet.has(k.id),
    }));

  return {
    clientPacks: Object.values(clientGroups),
    kitItems,
  };
}

/**
 * 16.8 Periods and default due dates
 */
export function periodKey(type: Frequency, year: number, index: number = 1): PeriodKey {
  if (type === 'annual') return `${year}`;
  if (type === 'quarterly') return `${year}-Q${index}`;
  const m = String(index).padStart(2, '0');
  return `${year}-${m}`;
}

export function periodLabel(key: PeriodKey): string {
  if (key.includes('-Q')) {
    const [year, q] = key.split('-');
    return `${q} ${year}`;
  }
  if (key.includes('-')) {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return key;
}

export function periodRange(key: PeriodKey): { start: ISODate; end: ISODate } {
  if (key.includes('-Q')) {
    const [yearStr, qStr] = key.split('-');
    const year = Number(yearStr);
    const q = Number(qStr.replace('Q', ''));
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    const lastDay = new Date(year, endMonth, 0).getDate();
    return {
      start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      end: `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  if (key.includes('-')) {
    const [year, month] = key.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: `${year}-${String(month).padStart(2, '0')}-01`,
      end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  const year = Number(key);
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

export function templateApplies(template: TaskTemplate, client: Client, periodType: Frequency): boolean {
  if (template.frequency !== periodType) return false;
  if (!template.active) return false;

  const { entityTypes, vatStatuses } = template.appliesTo;
  if (entityTypes && entityTypes.length > 0 && !entityTypes.includes(client.entityType)) {
    return false;
  }
  if (vatStatuses && vatStatuses.length > 0) {
    if (client.vatStatus === 'unknown') return false;
    if (!vatStatuses.includes(client.vatStatus)) return false;
  }
  return true;
}

export function defaultDue(
  template: TaskTemplate,
  period: PeriodKey,
  moves: DeadlineMove[] = []
): ISODate | undefined {
  // 1. Check matching deadline move
  const move = moves.find((m) => (!m.templateId || m.templateId === template.id) && m.period === period);
  if (move) return move.newDueDate;

  // 2. Check template default rule
  if (!template.defaultDue) return undefined;
  const { kind, value } = template.defaultDue;
  const range = periodRange(period);

  if (kind === 'day_of_next_month') {
    const [y, m] = range.end.split('-').map(Number);
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const maxDays = new Date(nextYear, nextMonth, 0).getDate();
    const clampedDay = Math.min(value, maxDays);
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  }

  if (kind === 'days_after_period_end') {
    return addDaysToDate(range.end, value);
  }

  return undefined;
}
