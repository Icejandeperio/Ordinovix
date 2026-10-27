import { describe, it, expect } from 'vitest';
import {
  monthsInRange,
  monthLabel,
  presetRange,
  firstPassByMonth,
  tripsNeedingReturnByMonth,
  visitsPerMonth,
  itemsPerVisitByMonth,
  outcomesByMonth,
  returnCauses,
  visitCostsByMonth,
  officePerformance,
  visitsLeftNotReady,
  leftReadyByMonth,
  chasesPerTaskByMonth,
  followUpsPerWeek,
  followUpsPerCompletedTask,
  followUpSuccessRate,
  channelEffectiveness,
  clientResponseDaysByMonth,
  lateBlockersByMonth,
  itemsMostOftenMissing,
  onTimeByMonth,
  overdueByAge,
  dueHeat,
  openTasksByPerson,
  statusGroupCounts,
  completedPerMonthByPerson,
  daysToCollectByTemplate,
  tasksMissingNextAction,
  clientProfile,
  monthChange,
  describeTrend,
  pulseSeries,
} from './metrics';
import type { FollowUp, FollowUpAttempt, Task, TaskLine, Visit, VisitItem, Pulse } from './types';

const base = { orgId: 'o', createdAt: '2026-01-01T00:00:00+08:00', createdBy: 'u', updatedAt: '', updatedBy: 'u', version: 1 };

const item = (o: Partial<VisitItem>) =>
  ({ ...base, id: 'i', visitId: 'v1', taskId: 't1', clientId: 'c1', intendedAction: 'submit', isFirstVisitForTask: false, evidenceDocumentIds: [], ...o }) as VisitItem;
const visit = (o: Partial<Visit>) =>
  ({ ...base, id: 'v', officeType: 'rdo', officeName: 'BIR RDO 39', plannedDate: '2026-08-10', assigneeUserId: 'u1', status: 'done', packedLineIds: [], packedKitItemIds: [], ...o }) as Visit;
const task = (o: Partial<Task>) =>
  ({ ...base, id: 't', clientId: 'c1', kind: 'filing', dueDate: '2026-08-15', dueSource: { kind: 'template' }, ownerUserId: 'u1', officeAction: false, paymentExpected: false, status: 'in_preparation', tags: [], ...o }) as Task;
const line = (o: Partial<TaskLine>) =>
  ({ ...base, id: 'l', taskId: 't1', clientId: 'c1', label: 'SLSP', required: true, copyForm: 'digital', suppliedBy: 'client', printAndBring: false, status: 'accepted', sortOrder: 1, lateDiscovered: false, documentIds: [], ...o }) as TaskLine;
const followUp = (o: Partial<FollowUp>) =>
  ({ ...base, id: 'f', clientId: 'c1', lineIds: [], channel: 'viber', language: 'en', attemptCount: 1, status: 'sent', ...o }) as FollowUp;
const attempt = (o: Partial<FollowUpAttempt>) =>
  ({ ...base, id: 'a', followUpId: 'f1', attemptNo: 1, channel: 'viber', sentAt: '2026-10-05T09:00:00+08:00', sentBy: 'u1', messageSnapshot: '', expectedBy: '2026-10-08', ...o }) as FollowUpAttempt;

const MONTHS = ['2026-08', '2026-09', '2026-10'];
const TODAY = '2026-10-27'; // a Tuesday

// Fixed fixture: every expected number below is counted by hand from these rows.
const items: VisitItem[] = [
  item({ id: 'A1', visitId: 'v1', outcomeAt: '2026-08-10T10:00:00+08:00', outcome: 'completed', isFirstVisitForTask: true }),
  item({ id: 'A2', visitId: 'v1', outcomeAt: '2026-08-10T10:30:00+08:00', outcome: 'more_documents_requested', outcomeCause: 'missing_document', avoidable: true, isFirstVisitForTask: true }),
  item({ id: 'S1', visitId: 'v2', outcomeAt: '2026-09-03T10:00:00+08:00', outcome: 'submitted_pending', isFirstVisitForTask: true }),
  item({ id: 'S2', visitId: 'v2', outcomeAt: '2026-09-03T10:10:00+08:00', outcome: 'paid_proof_pending', isFirstVisitForTask: true }),
  item({ id: 'S3', visitId: 'v3', outcomeAt: '2026-09-20T10:00:00+08:00', outcome: 'correction_required', outcomeCause: 'document_error', avoidable: true, isFirstVisitForTask: true }),
  item({ id: 'S4', visitId: 'v3', outcomeAt: '2026-09-20T10:20:00+08:00', outcome: 'not_accepted', outcomeCause: 'office_system_down', avoidable: false }),
  item({ id: 'O1', visitId: 'v5', outcomeAt: '2026-10-02T10:00:00+08:00', outcome: 'completed', isFirstVisitForTask: true }),
];

const visits: Visit[] = [
  visit({ id: 'v1', officeName: 'Land Bank QC Circle', plannedDate: '2026-08-10', status: 'done', costs: { transport: 15000, parking: 5000 } }),
  visit({ id: 'v2', officeName: 'BIR RDO 39', plannedDate: '2026-09-03', status: 'done', startedAt: '2026-09-03T08:00:00+08:00', finishedAt: '2026-09-03T09:45:00+08:00' }),
  visit({ id: 'v3', officeName: 'BIR RDO 39', plannedDate: '2026-09-20', status: 'in_progress', departureOverrideReason: 'Client was waiting' }),
  visit({ id: 'v4', officeName: 'BIR RDO 39', plannedDate: '2026-09-22', status: 'cancelled' }),
  visit({ id: 'v5', officeName: 'BIR RDO 39', plannedDate: '2026-10-02', status: 'planned' }),
];

describe('insights metrics: ranges and labels', () => {
  it('lists the months a range touches, oldest first', () => {
    expect(monthsInRange('2026-05-01', '2026-10-27')).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(monthsInRange('2026-12-15', '2027-01-02')).toEqual(['2026-12', '2027-01']);
  });

  it('labels a month by its short name', () => {
    expect(monthLabel('2026-05')).toBe('May');
    expect(monthLabel('2026-10')).toBe('Oct');
  });

  it('builds the preset date ranges from today', () => {
    expect(presetRange('last_6_months', TODAY)).toEqual({ from: '2026-05-01', to: '2026-10-27' });
    expect(presetRange('last_quarter', TODAY)).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(presetRange('ytd', TODAY)).toEqual({ from: '2026-01-01', to: '2026-10-27' });
    expect(presetRange('last_quarter', '2026-02-10')).toEqual({ from: '2025-10-01', to: '2025-12-31' });
  });
});

describe('insights metrics: trips', () => {
  it('first-pass completion by month counts first visits that completed, submitted or were paid', () => {
    const rows = firstPassByMonth(items, ['2026-07', ...MONTHS]);
    expect(rows).toEqual([
      { month: '2026-07', rate: null, firstVisits: 0 },
      { month: '2026-08', rate: 50, firstVisits: 2 }, // A1 yes, A2 no
      { month: '2026-09', rate: 67, firstVisits: 3 }, // S1, S2 yes, S3 no (S4 is not a first visit)
      { month: '2026-10', rate: 100, firstVisits: 1 },
    ]);
  });

  it('trips needing a return by month splits avoidable from not avoidable', () => {
    expect(tripsNeedingReturnByMonth(items, MONTHS)).toEqual([
      { month: '2026-08', avoidable: 1, notAvoidable: 0 },
      { month: '2026-09', avoidable: 1, notAvoidable: 1 },
      { month: '2026-10', avoidable: 0, notAvoidable: 0 },
    ]);
  });

  it('counts visits that started, not planned or cancelled ones', () => {
    expect(visitsPerMonth(visits, MONTHS)).toEqual([
      { month: '2026-08', count: 1 },
      { month: '2026-09', count: 2 },
      { month: '2026-10', count: 0 },
    ]);
  });

  it('errand items per visit divides the items on started visits by those visits', () => {
    expect(itemsPerVisitByMonth(visits, items, MONTHS)).toEqual([
      { month: '2026-08', value: 2 }, // v1 holds A1, A2
      { month: '2026-09', value: 2 }, // v2 holds S1, S2 and v3 holds S3, S4: 4 items over 2 visits
      { month: '2026-10', value: null }, // v5 is only planned
    ]);
  });

  it('counter outcomes by month group the seven outcomes into four', () => {
    expect(outcomesByMonth(items, MONTHS)).toEqual([
      { month: '2026-08', completed: 1, submittedPaid: 0, moreDocs: 1, notAccepted: 0 },
      { month: '2026-09', completed: 0, submittedPaid: 2, moreDocs: 1, notAccepted: 1 },
      { month: '2026-10', completed: 1, submittedPaid: 0, moreDocs: 0, notAccepted: 0 },
    ]);
  });

  it('why trips needed a return counts causes, most frequent first, then by name', () => {
    expect(returnCauses(items)).toEqual([
      { cause: 'document_error', count: 1, avoidable: true },
      { cause: 'missing_document', count: 1, avoidable: true },
      { cause: 'office_system_down', count: 1, avoidable: false },
    ]);
  });

  it('visit costs by month add transport, parking and other, in pesos', () => {
    expect(visitCostsByMonth(visits, MONTHS)).toEqual([
      { month: '2026-08', pesos: 200 },
      { month: '2026-09', pesos: 0 },
      { month: '2026-10', pesos: 0 },
    ]);
  });

  it('office table has visits, first-pass rate, median duration and last visit', () => {
    expect(officePerformance(visits, items)).toEqual([
      { officeName: 'BIR RDO 39', visits: 2, firstPassRate: 67, medianMinutes: 105, lastVisited: '2026-09-20' },
      { officeName: 'Land Bank QC Circle', visits: 1, firstPassRate: 50, medianMinutes: null, lastVisited: '2026-08-10' },
    ]);
  });

  it('lists the visits that left without being ready, with the reason', () => {
    expect(visitsLeftNotReady(visits)).toEqual([
      { visitId: 'v3', date: '2026-09-20', officeName: 'BIR RDO 39', reason: 'Client was waiting' },
    ]);
  });
});

describe('insights metrics: monthly series behind the KPI tiles', () => {
  it('visits that left ready, by month, are started visits without a departure override', () => {
    expect(leftReadyByMonth(visits, MONTHS)).toEqual([
      { month: '2026-08', value: 100 },
      { month: '2026-09', value: 50 }, // v2 ready, v3 left with an override
      { month: '2026-10', value: null }, // v5 never started
    ]);
  });

  it('median follow-ups per task, by the month the task was completed', () => {
    const fus = [
      followUp({ id: 'f1', taskId: 't1', attemptCount: 3 }),
      followUp({ id: 'f2', taskId: 't2', attemptCount: 1 }),
      followUp({ id: 'f3', taskId: 't2', attemptCount: 2 }),
    ];
    const done = [
      task({ id: 't1', status: 'completed', completedAt: '2026-08-14T10:00:00+08:00' }),
      task({ id: 't2', status: 'completed', completedAt: '2026-08-20T10:00:00+08:00' }),
      task({ id: 't3', status: 'completed', completedAt: '2026-08-25T10:00:00+08:00' }),
    ];
    expect(chasesPerTaskByMonth(done, fus, MONTHS)).toEqual([
      { month: '2026-08', value: 3 }, // chases of 3, 3 and 0 -> median 3
      { month: '2026-09', value: null },
      { month: '2026-10', value: null },
    ]);
  });
});

describe('insights metrics: chasing', () => {
  const followUps = [
    followUp({ id: 'f1', taskId: 't1', channel: 'viber', attemptCount: 2, status: 'answered', lineIds: ['l3', 'l5'] }),
    followUp({ id: 'f2', taskId: 't2', channel: 'email', attemptCount: 1, status: 'sent', lineIds: ['l4'] }),
  ];
  const attempts = [
    attempt({ id: 'a1', followUpId: 'f1', channel: 'viber', sentAt: '2026-10-05T09:00:00+08:00' }),
    attempt({ id: 'a2', followUpId: 'f1', attemptNo: 2, channel: 'viber', sentAt: '2026-10-07T09:00:00+08:00' }),
    attempt({ id: 'a3', followUpId: 'f2', channel: 'email', sentAt: '2026-10-13T09:00:00+08:00' }),
  ];
  const lines = [
    line({ id: 'l1', label: 'SLSP', requestedAt: '2026-08-01T09:00:00+08:00', receivedAt: '2026-08-05T09:00:00+08:00' }),
    line({ id: 'l2', label: 'SLSP', requestedAt: '2026-09-01T09:00:00+08:00', receivedAt: '2026-09-03T09:00:00+08:00' }),
    line({ id: 'l3', label: 'SLSP', status: 'incomplete', requestedAt: '2026-09-10T09:00:00+08:00', receivedAt: '2026-09-20T09:00:00+08:00' }),
    line({ id: 'l4', label: '2307', status: 'needs_correction', lateDiscovered: true, createdAt: '2026-10-01T09:00:00+08:00', requestedAt: '2026-10-01T09:00:00+08:00', receivedAt: '2026-10-02T09:00:00+08:00' }),
    line({ id: 'l5', label: 'SLSP', status: 'requested', requestedAt: '2026-10-10T09:00:00+08:00' }),
  ];

  it('follow-ups per week counts attempts in each Monday-to-Sunday week', () => {
    const rows = followUpsPerWeek(attempts, '2026-10-05', '2026-10-19');
    expect(rows.map((r) => [r.weekStart, r.count])).toEqual([
      ['2026-10-05', 2],
      ['2026-10-12', 1],
      ['2026-10-19', 0],
    ]);
    expect(rows[0].label).toBe('W41');
  });

  it('follow-ups per completed task buckets 0, 1, 2 and 3 or more', () => {
    const tasks = [
      task({ id: 't1', status: 'completed', completedAt: '2026-10-09T00:00:00+08:00' }),
      task({ id: 't2', status: 'completed', completedAt: '2026-10-14T00:00:00+08:00' }),
      task({ id: 't3', status: 'completed', completedAt: '2026-10-15T00:00:00+08:00' }),
      task({ id: 't4', status: 'in_preparation' }),
    ];
    expect(followUpsPerCompletedTask(tasks, followUps)).toEqual([
      { bucket: '0', tasks: 1 },
      { bucket: '1', tasks: 1 },
      { bucket: '2', tasks: 1 },
      { bucket: '3+', tasks: 0 },
    ]);
  });

  it('follow-up success rate is answered or resolved over all follow-ups', () => {
    expect(followUpSuccessRate(followUps)).toBe(50);
    expect(followUpSuccessRate([])).toBe(0);
  });

  it('channel effectiveness has attempts per channel and answered follow-ups per channel', () => {
    expect(channelEffectiveness(followUps, attempts)).toEqual([
      { channel: 'viber', attempts: 2, responses: 1 },
      { channel: 'email', attempts: 1, responses: 0 },
    ]);
  });

  it('median days for clients to send documents, by the month they arrived', () => {
    expect(clientResponseDaysByMonth(lines, MONTHS)).toEqual([
      { month: '2026-08', value: 4 },
      { month: '2026-09', value: 6 }, // median of 2 and 10
      { month: '2026-10', value: 1 },
    ]);
  });

  it('late-discovered blockers by month use the month the line was created', () => {
    expect(lateBlockersByMonth(lines, MONTHS)).toEqual([
      { month: '2026-08', count: 0 },
      { month: '2026-09', count: 0 },
      { month: '2026-10', count: 1 },
    ]);
  });

  it('items most often missing counts still-open lines by label with the attempts that chased them', () => {
    expect(itemsMostOftenMissing(lines, followUps)).toEqual([
      { label: 'SLSP', times: 2, avgAttempts: 2 }, // l3 and l5, each chased by f1 (2 attempts)
      { label: '2307', times: 1, avgAttempts: 1 }, // l4 chased by f2 (1 attempt)
    ]);
  });
});

describe('insights metrics: deadlines', () => {
  const tasks = [
    task({ id: 't1', dueDate: '2026-08-15', submittedAt: '2026-08-14T10:00:00+08:00', status: 'completed' }),
    task({ id: 't2', dueDate: '2026-08-20', submittedAt: '2026-08-22T10:00:00+08:00', status: 'completed' }),
    task({ id: 't3', dueDate: '2026-09-10', completedAt: '2026-09-10T10:00:00+08:00', status: 'completed' }),
    task({ id: 't4', dueDate: '2026-10-20', status: 'waiting_on_client' }), // 7 days overdue
    task({ id: 't5', dueDate: '2026-10-30', status: 'in_preparation' }),
    task({ id: 't6', dueDate: '2026-10-26', status: 'ready_next_step' }), // 1 day overdue
    task({ id: 't7', dueDate: '2026-10-10', status: 'needs_correction' }), // 17 days overdue
    task({ id: 't8', dueDate: '2026-10-30', status: 'submitted', submittedAt: '2026-10-25T10:00:00+08:00' }),
    task({ id: 't9', dueDate: '2026-11-02', status: 'in_preparation' }),
  ];

  it('on-time rate by month counts tasks due by today, finished on or before the due date', () => {
    expect(onTimeByMonth(tasks, MONTHS, TODAY)).toEqual([
      { month: '2026-08', rate: 50 }, // t1 on time, t2 two days late
      { month: '2026-09', rate: 100 },
      { month: '2026-10', rate: 25 }, // t8 on time; t4, t6, t7 open and past due; t5 and t9 not due yet
    ]);
  });

  it('overdue filings by age buckets open tasks past their due date', () => {
    expect(overdueByAge(tasks, TODAY)).toEqual([
      { label: '1–3 Days', value: 1 },
      { label: '4–7 Days', value: 1 },
      { label: '8–14 Days', value: 0 },
      { label: '15+ Days', value: 1 },
    ]);
  });

  it('due-soon heat counts open tasks per day for the next eight weeks', () => {
    expect(dueHeat(tasks, TODAY, 8)).toEqual([
      { date: '2026-10-30', count: 1 }, // t5; t8 is already submitted
      { date: '2026-11-02', count: 1 },
    ]);
    expect(dueHeat([task({ id: 'far', dueDate: '2027-03-01' })], TODAY, 8)).toEqual([]);
  });
});

describe('insights metrics: workload and clients', () => {
  const tasks = [
    task({ id: 't1', status: 'completed', ownerUserId: 'u1', completedAt: '2026-08-14T10:00:00+08:00', createdAt: '2026-08-01T09:00:00+08:00', readyAt: '2026-08-04T09:00:00+08:00', templateId: 'tA' }),
    task({ id: 't2', status: 'completed', ownerUserId: 'u2', completedAt: '2026-08-22T10:00:00+08:00', createdAt: '2026-08-10T09:00:00+08:00', readyAt: '2026-08-17T09:00:00+08:00', templateId: 'tA' }),
    task({ id: 't3', status: 'completed', ownerUserId: 'u1', completedAt: '2026-09-10T10:00:00+08:00', createdAt: '2026-09-01T09:00:00+08:00', readyAt: '2026-09-02T09:00:00+08:00', templateId: 'tB' }),
    task({ id: 't4', status: 'waiting_on_client', ownerUserId: 'u1', nextAction: { text: 'Chase 2307', owner: 'operator' } }),
    task({ id: 't5', status: 'in_preparation', ownerUserId: 'u1', nextAction: { text: '   ', owner: 'operator' } }),
    task({ id: 't6', status: 'ready_next_step', ownerUserId: 'u2' }),
    task({ id: 't7', status: 'needs_correction', ownerUserId: 'u1', nextAction: { text: 'Fix', owner: 'client' } }),
    task({ id: 't8', status: 'submitted', ownerUserId: 'u2', nextAction: { text: 'Wait', owner: 'client' } }),
    task({ id: 't9', status: 'in_preparation', ownerUserId: 'u1', nextAction: { text: 'Prepare', owner: 'operator' } }),
  ];

  it('open tasks per person counts tasks that are not completed or archived', () => {
    expect(openTasksByPerson(tasks, { u1: 'Ana Santos', u2: 'Ben Morales' })).toEqual([
      { userId: 'u1', label: 'Ana Santos', value: 4 },
      { userId: 'u2', label: 'Ben Morales', value: 2 },
    ]);
  });

  it('status groups count open tasks, with finished ones under done', () => {
    expect(statusGroupCounts(tasks)).toEqual({ blocked: 2, in_progress: 2, ready: 1, submitted: 1, done: 3 });
  });

  it('completed per month per person', () => {
    expect(completedPerMonthByPerson(tasks, MONTHS)).toEqual([
      { month: '2026-08', byUser: { u1: 1, u2: 1 } },
      { month: '2026-09', byUser: { u1: 1 } },
      { month: '2026-10', byUser: {} },
    ]);
  });

  it('median days to collect by template, slowest first, from created to ready', () => {
    const templates = [
      { id: 'tA', code: '1601-C', name: 'Withholding' },
      { id: 'tB', code: '2550Q', name: 'Quarterly VAT' },
    ];
    expect(daysToCollectByTemplate(tasks, templates)).toEqual([
      { templateId: 'tA', label: '1601-C — Withholding', days: 5 }, // 3 and 7 days
      { templateId: 'tB', label: '2550Q — Quarterly VAT', days: 1 },
    ]);
  });

  it('lists open tasks without a next action', () => {
    expect(tasksMissingNextAction(tasks).map((t) => t.id)).toEqual(['t5', 't6']);
  });

  it('client profile has open tasks, median response days, follow-ups, repeat trips and last completion', () => {
    const lines = [
      line({ id: 'l1', clientId: 'c1', requestedAt: '2026-08-01T09:00:00+08:00', receivedAt: '2026-08-05T09:00:00+08:00' }),
      line({ id: 'l2', clientId: 'c1', requestedAt: '2026-09-01T09:00:00+08:00', receivedAt: '2026-09-03T09:00:00+08:00' }),
      line({ id: 'l3', clientId: 'c2', requestedAt: '2026-09-01T09:00:00+08:00', receivedAt: '2026-09-02T09:00:00+08:00' }),
    ];
    const clientTasks = [
      task({ id: 'x1', clientId: 'c1', status: 'in_preparation' }),
      task({ id: 'x2', clientId: 'c1', status: 'waiting_on_client' }),
      task({ id: 'x3', clientId: 'c1', status: 'completed', completedAt: '2026-09-10T10:00:00+08:00' }),
      task({ id: 'x4', clientId: 'c1', status: 'completed', completedAt: '2026-08-14T10:00:00+08:00' }),
      task({ id: 'y1', clientId: 'c2', status: 'in_preparation' }),
    ];
    const fus = [followUp({ id: 'g1', clientId: 'c1', attemptCount: 3 }), followUp({ id: 'g2', clientId: 'c2', attemptCount: 1 })];
    const returns = [item({ id: 'r1', clientId: 'c1', outcome: 'not_accepted' }), item({ id: 'r2', clientId: 'c1', outcome: 'completed' })];
    const rows = clientProfile(
      [
        { id: 'c1', code: 'RSP', displayName: 'RSP Law' },
        { id: 'c2', code: 'CRZ', displayName: 'Cruz' },
      ],
      clientTasks,
      lines,
      fus,
      returns,
    );
    expect(rows[0]).toEqual({ clientId: 'c1', code: 'RSP', name: 'RSP Law', openTasks: 2, avgResponseDays: 3, followUps: 3, repeatTrips: 1, lastCompleted: '2026-09-10' });
    expect(rows[1]).toEqual({ clientId: 'c2', code: 'CRZ', name: 'Cruz', openTasks: 1, avgResponseDays: 1, followUps: 1, repeatTrips: 0, lastCompleted: null });
  });
});

describe('insights metrics: comparisons, pulses and takeaways', () => {
  it('compares the latest month with the one before it', () => {
    expect(monthChange([{ month: '2026-09', value: 77 }, { month: '2026-10', value: 86 }])).toEqual({ current: 86, previous: 77, delta: 9, previousMonth: '2026-09' });
    expect(monthChange([{ month: '2026-09', value: null }, { month: '2026-10', value: 86 }])).toEqual({ current: 86, previous: null, delta: null, previousMonth: '2026-09' });
    expect(monthChange([])).toEqual({ current: null, previous: null, delta: null, previousMonth: null });
  });

  it('writes a one-sentence takeaway from the latest two months', () => {
    const pts = [{ month: '2026-08', value: 50 }, { month: '2026-09', value: 67 }, { month: '2026-10', value: 100 }];
    expect(describeTrend('First-pass completion', pts, '%')).toBe('First-pass completion in Oct: 100%, up 33 from 67% in Sep.');
    expect(describeTrend('Hours finding records', [{ month: '2026-09', value: 4 }, { month: '2026-10', value: 2.5 }], ' h')).toBe('Hours finding records in Oct: 2.5 h, down 1.5 from 4 h in Sep.');
    expect(describeTrend('Visits', [{ month: '2026-09', value: 3 }, { month: '2026-10', value: 3 }], '')).toBe('Visits in Oct: 3, unchanged from 3 in Sep.');
    expect(describeTrend('Visits', [{ month: '2026-10', value: 3 }], '')).toBe('Visits in Oct: 3.');
    expect(describeTrend('Visits', [{ month: '2026-10', value: null }], '')).toBe('Not enough data yet.');
  });

  it('pulse series reads confidence and hours by month and leaves gaps as null', () => {
    const pulses = [
      { ...base, id: 'p1', month: '2026-08', hoursFindingLastWeek: 6, confidence: 3 },
      { ...base, id: 'p2', month: '2026-10', hoursFindingLastWeek: 2, confidence: 5 },
    ] as Pulse[];
    expect(pulseSeries(pulses, MONTHS, 'confidence')).toEqual([
      { month: '2026-08', value: 3 },
      { month: '2026-09', value: null },
      { month: '2026-10', value: 5 },
    ]);
    expect(pulseSeries(pulses, MONTHS, 'hoursFindingLastWeek').map((p) => p.value)).toEqual([6, null, 2]);
  });
});
