import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories as R, mockDevControls } from './index';
import { todayInManila, addDaysToDate } from '@/lib/dates';

/**
 * U20 (B11): the helper permission gaps found in the U07 reviews. Ben (helper) is assigned to client-rsp and
 * client-cruz; client-maria and client-horizon are not his.
 */
const RSP = 'client-rsp';
const MARIA = 'client-maria';
const MARIA_TASK = 'task-maria-2550q';

const code = (e: unknown) => (e as { code?: string })?.code;
const rejects = async (p: Promise<unknown>) => p.then(() => 'ALLOWED', (e) => code(e) ?? (e as Error).message);

const owner = () => mockDevControls.setPersona('owner');
const helper = () => mockDevControls.setPersona('helper');

async function ids() {
  owner();
  const rspTask = await R.tasks.get('task-rsp-0619e');
  const mariaTask = await R.tasks.get(MARIA_TASK);
  const cruzTask = (await R.tasks.list()).items.find((s) => s.task.clientId === 'client-cruz')!.task;
  const cruzLines = (await R.tasks.get(cruzTask.id)).lines;
  return {
    rspLine: rspTask.lines[0].id,
    mariaLine: mariaTask.lines[0].id,
    cruzLine: cruzLines[0].id,
    rspDoc: (await R.documents.list({ clientId: RSP })).items[0].id,
    mariaDoc: (await R.documents.list({ clientId: MARIA })).items[0].id,
    rspFollowUp: (await R.followUps.list({ clientId: RSP })).items[0].followUp.id,
  };
}

beforeEach(() => {
  mockDevControls.reset();
  owner();
});

describe('followUps.logResponse only accepts lines of the follow-up\'s own client', () => {
  it('rejects a line of another client, for the helper and for the owner', { timeout: 60_000 }, async () => {
    const x = await ids();
    owner();
    expect(await rejects(R.followUps.logResponse(x.rspFollowUp, { text: 'Sent', receivedLineIds: [x.cruzLine] }))).toBe('RULE_VIOLATION');
    helper();
    expect(await rejects(R.followUps.logResponse(x.rspFollowUp, { text: 'Sent', receivedLineIds: [x.mariaLine] }))).toBe('FORBIDDEN');
    // nothing was marked received
    owner();
    const lines = [...(await R.tasks.get(MARIA_TASK)).lines, ...(await R.tasks.get('task-rsp-0619e')).lines];
    expect(lines.find((l) => l.id === x.mariaLine)!.status).not.toBe('received');
  });

  it('still accepts the follow-up\'s own lines', { timeout: 60_000 }, async () => {
    const x = await ids();
    const fu = (await R.followUps.get(x.rspFollowUp)).lines;
    const own = fu[0]?.id ?? x.rspLine;
    helper();
    const result = await R.followUps.logResponse(x.rspFollowUp, { text: 'Client sent the documents', receivedLineIds: [own] });
    expect(result.followUp.response).toBe('Client sent the documents');
  });
});

describe('visits.recordOutcome checks every line and document it names', () => {
  const item = 'vitem-v1-3'; // an RSP item on visit-v1, which Ben reaches through it

  it('rejects affected lines and evidence documents from another client', { timeout: 60_000 }, async () => {
    const x = await ids();
    helper();
    expect(await rejects(R.visits.recordOutcome(item, { outcome: 'correction_required', affectedLineIds: [x.mariaLine], evidenceDocumentIds: [] }))).toBe('FORBIDDEN');
    expect(await rejects(R.visits.recordOutcome(item, { outcome: 'completed', evidenceDocumentIds: [x.mariaDoc] }))).toBe('FORBIDDEN');
    owner();
    expect(await rejects(R.visits.recordOutcome(item, { outcome: 'correction_required', affectedLineIds: [x.cruzLine], evidenceDocumentIds: [] }))).toBe('RULE_VIOLATION');
    expect(await rejects(R.visits.recordOutcome(item, { outcome: 'completed', evidenceDocumentIds: [x.mariaDoc] }))).toBe('RULE_VIOLATION');
  });

  it('records nothing when one of the references is refused', { timeout: 60_000 }, async () => {
    const x = await ids();
    owner();
    const before = (await R.visits.get('visit-v1')).items.find((i) => i.item.id === item)!.item;
    await rejects(R.visits.recordOutcome(item, { outcome: 'correction_required', affectedLineIds: [x.rspLine, x.cruzLine], evidenceDocumentIds: [] }));
    const after = (await R.visits.get('visit-v1')).items.find((i) => i.item.id === item)!.item;
    expect(after.outcome).toBe(before.outcome);
    const lines = (await R.tasks.get('task-rsp-0619e')).lines;
    expect(lines.find((l) => l.id === x.rspLine)!.status).not.toBe('needs_correction');
  });

  it('a helper flags lines through an outcome only while the practice lets helpers review', { timeout: 60_000 }, async () => {
    const x = await ids();
    const task = (await R.visits.get('visit-v1')).items.find((i) => i.item.id === item)!.item.taskId;
    const line = (await R.tasks.get(task)).lines[0].id;
    await R.settings.save({ helpersCanAccept: false });
    helper();
    expect(await rejects(R.visits.recordOutcome(item, { outcome: 'correction_required', affectedLineIds: [line], evidenceDocumentIds: [] }))).toBe('FORBIDDEN');
    // an outcome that flags no line is not a review and still works
    const ok = await R.visits.recordOutcome(item, { outcome: 'completed', evidenceDocumentIds: [x.rspDoc] });
    expect(ok.outcome).toBe('completed');
    owner();
    await R.settings.save({ helpersCanAccept: true });
    helper();
    const flagged = await R.visits.recordOutcome(item, { outcome: 'correction_required', affectedLineIds: [line], evidenceDocumentIds: [] });
    expect(flagged.outcome).toBe('correction_required');
  });
});

describe('record writes cannot be re-pointed at another client', () => {
  it('payments.save: the client of a stored payment cannot change, and proof is checked against the stored client', { timeout: 60_000 }, async () => {
    const x = await ids();
    owner();
    const stored = (await R.payments.list({ clientId: RSP })).items[0];
    expect(await rejects(R.payments.save({ id: stored.id, clientId: MARIA, proofDocumentIds: [x.mariaDoc] } as never))).toBe('RULE_VIOLATION');
    expect(await rejects(R.payments.save({ id: stored.id, clientId: RSP, proofDocumentIds: [x.mariaDoc] } as never))).toBe('RULE_VIOLATION');
    helper();
    expect(await rejects(R.payments.save({ id: stored.id, clientId: MARIA, proofDocumentIds: [x.mariaDoc] } as never))).toBe('FORBIDDEN');
    owner();
    expect((await R.payments.list({ clientId: RSP })).items.find((p) => p.id === stored.id)!.proofDocumentIds).not.toContain(x.mariaDoc);
  });

  it('contacts.upsert and authorizations.upsert refuse to move a record to another client', { timeout: 60_000 }, async () => {
    owner();
    const contact = (await R.contacts.listByClient(RSP))[0];
    const auth = (await R.authorizations.listByClient(RSP))[0];
    expect(await rejects(R.contacts.upsert({ id: contact.id, clientId: 'client-cruz' } as never))).toBe('RULE_VIOLATION');
    expect(await rejects(R.authorizations.upsert({ id: auth.id, clientId: 'client-cruz' } as never))).toBe('RULE_VIOLATION');
    // same client id is fine
    expect((await R.contacts.upsert({ id: contact.id, clientId: RSP, name: contact.name } as never)).clientId).toBe(RSP);
  });
});

describe('reads use canAccessClient or canReachVisit', () => {
  const tomorrow = () => addDaysToDate(todayInManila(), 1);

  async function benVisitWithOnlyMariaItems(): Promise<string> {
    owner();
    const v = await R.visits.create({ officeId: 'off-rdo39', plannedDate: tomorrow(), assigneeUserId: 'user-ben' } as never, [{ taskId: MARIA_TASK, action: 'submit' }] as never);
    return v.id;
  }

  it('a helper\'s visit whose items all belong to unassigned clients is not shown on Today as an empty visit', { timeout: 60_000 }, async () => {
    const visitId = await benVisitWithOnlyMariaItems();
    helper();
    const queue = await R.today.queue();
    expect(queue.nextVisits.map((n) => n.visit.id)).not.toContain(visitId);
    expect(queue.nextVisits.every((n) => n.itemCount > 0)).toBe(true);
    const day = queue.next14Days.find((d) => d.date === tomorrow())!;
    const ownerOnly = (await R.calendar.range(tomorrow(), tomorrow())).filter((c) => c.type === 'visit').map((c) => c.id);
    expect(ownerOnly).not.toContain(visitId);
    expect(typeof day.hasVisits).toBe('boolean');
    owner();
    expect((await R.today.queue()).nextVisits.map((n) => n.visit.id)).toContain(visitId); // the owner still sees it
  });

  it('calendar.range shows a helper only the visits they can reach', { timeout: 60_000 }, async () => {
    owner();
    const range = [todayInManila(), addDaysToDate(todayInManila(), 60)] as const;
    const ownerVisits = (await R.calendar.range(...range)).filter((c) => c.type === 'visit').map((c) => c.id);
    const visits = (await R.visits.list()).items;
    helper();
    const reachable = new Set((await R.visits.list()).items.map((v) => v.visit.id));
    const helperVisits = (await R.calendar.range(...range)).filter((c) => c.type === 'visit').map((c) => c.id);
    expect(ownerVisits.length).toBeGreaterThan(helperVisits.length);
    expect(helperVisits.every((id) => reachable.has(id))).toBe(true);
    expect(visits.length).toBeGreaterThan(0);
  });

  it('today.queue statistics only count what a helper can reach', { timeout: 60_000 }, async () => {
    owner();
    const ownerStats = (await R.today.queue()).kpiStats;
    helper();
    const helperStats = (await R.today.queue()).kpiStats;
    expect(helperStats.openTasksCount).toBeLessThan(ownerStats.openTasksCount);
    const overview = await R.insights.get('overview', { from: '2000-01-01', to: '2099-12-31' });
    expect(helperStats.firstPassRate).toBe(overview.firstPassRate); // same scoped data as Insights
  });

  it('search.query shows a helper only reachable visits, and no office detail leaks from unreachable ones', { timeout: 60_000 }, async () => {
    owner();
    const all = await R.search.query('RDO 39');
    helper();
    const mine = await R.search.query('RDO 39');
    expect(all.visits.length).toBeGreaterThan(mine.visits.length);
    const reachable = new Set((await R.visits.list()).items.map((v) => v.visit.id));
    expect(mine.visits.every((v) => reachable.has(v.visit.id))).toBe(true);
  });

  it('activity.list shows a helper only events of assigned clients, never practice-wide ones', { timeout: 60_000 }, async () => {
    owner();
    const events = (await R.activity.list({})).items;
    expect(events.some((e) => !e.clientId)).toBe(true);
    expect(events.some((e) => e.clientId === MARIA)).toBe(true);
    helper();
    const mine = (await R.activity.list({ clientId: RSP })).items;
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((e) => e.clientId === RSP)).toBe(true);
    expect(await rejects(R.activity.list({ clientId: MARIA }))).toBe('FORBIDDEN');
    expect(await rejects(R.activity.list({}))).toBe('FORBIDDEN');
    const byEntity = (await R.activity.list({ entityId: 'task-rsp-0619e' } as never)).items;
    expect(byEntity.every((e) => e.clientId && ['client-rsp', 'client-cruz'].includes(e.clientId))).toBe(true);
  });

  it('offices.get counts only the visits a helper can reach; offices.save is owner-only', { timeout: 60_000 }, async () => {
    owner();
    const all = await R.offices.get('off-rdo39');
    helper();
    const mine = await R.offices.get('off-rdo39');
    expect(mine.stats.totalVisits).toBeLessThan(all.stats.totalVisits);
    expect(await rejects(R.offices.save({ id: 'off-rdo39', name: 'Renamed by a helper' }))).toBe('FORBIDDEN');
    owner();
    expect((await R.offices.get('off-rdo39')).office.name).not.toBe('Renamed by a helper');
    expect((await R.offices.save({ id: 'off-rdo39', name: all.office.name })).name).toBe(all.office.name);
  });
});

/**
 * A revoked membership reaches nothing. Every read method of the repositories object is listed here with what a
 * revoked helper gets: FORBIDDEN, EMPTY (a list or result with no records), or CONFIG (practice-wide configuration
 * or the person's own notifications, which hold no client records). A read method that is not listed fails the
 * coverage test, so nobody can add one without deciding its policy.
 */
describe('a revoked membership reaches nothing, on every read method', () => {
  type Outcome = 'FORBIDDEN' | 'EMPTY' | 'CONFIG';
  type Case = [Outcome, () => Promise<unknown>, ((value: never) => boolean)?];
  const READ_NAME = /^(list|get|listByClient|query|range|unreadCount|history|findBySha|findDuplicates|suggestTasks|previewOpenPeriod|board|getUrl|clientChecklist|clientHistory|monthlySummary|exportCsv|fullBackup|queue)$/;

  const noItems = (v: { items: unknown[] }) => v.items.length === 0;
  const allEmpty = (v: Record<string, unknown[]>) => Object.values(v).every((a) => a.length === 0);
  const noQueue = (v: {
    counts: Record<string, number>;
    nextVisits: unknown[];
    reviewRequiredLines: unknown[];
    recentActivity: unknown[];
    authorizationsExpiring: unknown[];
    overdueTasks: unknown[];
    followUpsDue: unknown[];
  }) =>
    Object.values(v.counts).every((n) => n === 0) &&
    [v.nextVisits, v.reviewRequiredLines, v.recentActivity, v.authorizationsExpiring, v.overdueTasks, v.followUpsDue].every((a) => a.length === 0);

  function reads(x: Awaited<ReturnType<typeof ids>>): Record<string, Case> {
    return {
      'memberships.list': ['FORBIDDEN', () => R.memberships.list()],
      'clients.list': ['EMPTY', () => R.clients.list({}), noItems],
      'clients.get': ['FORBIDDEN', () => R.clients.get(RSP)],
      'clients.findDuplicates': ['FORBIDDEN', () => R.clients.findDuplicates({ name: 'x' })],
      'contacts.listByClient': ['FORBIDDEN', () => R.contacts.listByClient(RSP)],
      'authorizations.listByClient': ['FORBIDDEN', () => R.authorizations.listByClient(RSP)],
      'templates.list': ['CONFIG', () => R.templates.list()],
      'templates.get': ['CONFIG', () => R.templates.get('tmpl-0619e')],
      'deadlineMoves.list': ['CONFIG', () => R.deadlineMoves.list()],
      'holidays.list': ['CONFIG', () => R.holidays.list(2026)],
      'tasks.list': ['EMPTY', () => R.tasks.list(), noItems],
      'tasks.get': ['FORBIDDEN', () => R.tasks.get('task-rsp-0619e')],
      'tasks.previewOpenPeriod': ['FORBIDDEN', () => R.tasks.previewOpenPeriod('2026-Q3', [])],
      'tasks.board': ['EMPTY', () => R.tasks.board(), allEmpty],
      'lines.history': ['FORBIDDEN', () => R.lines.history(x.rspLine)],
      'documents.list': ['EMPTY', () => R.documents.list(), noItems],
      'documents.getUrl': ['FORBIDDEN', () => R.documents.getUrl(x.rspDoc, 'view')],
      'documents.findBySha': ['FORBIDDEN', () => R.documents.findBySha('x', RSP)],
      'followUps.list': ['EMPTY', () => R.followUps.list(), noItems],
      'followUps.get': ['FORBIDDEN', () => R.followUps.get(x.rspFollowUp)],
      'messages.list': ['CONFIG', () => R.messages.list()],
      'offices.list': ['CONFIG', () => R.offices.list()],
      'offices.get': ['FORBIDDEN', () => R.offices.get('off-rdo39')],
      'visits.list': ['EMPTY', () => R.visits.list(), noItems],
      'visits.get': ['FORBIDDEN', () => R.visits.get('visit-v1')],
      'visits.suggestTasks': ['FORBIDDEN', () => R.visits.suggestTasks('visit-v1')],
      'visitKit.list': ['CONFIG', () => R.visitKit.list()],
      'payments.list': ['EMPTY', () => R.payments.list(), noItems],
      'notes.list': ['FORBIDDEN', () => R.notes.list('client', RSP)],
      'savedViews.list': ['CONFIG', () => R.savedViews.list('tasks' as never)],
      'notifications.list': ['CONFIG', () => R.notifications.list()],
      'notifications.unreadCount': ['CONFIG', () => R.notifications.unreadCount()],
      'calendar.range': ['EMPTY', () => R.calendar.range('2026-01-01', '2026-12-31'), (v: unknown[]) => v.length === 0],
      'insights.get': ['EMPTY', () => R.insights.get('overview'), (v: { isEmpty: boolean }) => v.isEmpty],
      'baseline.get': ['CONFIG', () => R.baseline.get()],
      'pulses.list': ['CONFIG', () => R.pulses.list()],
      'reports.clientChecklist': ['FORBIDDEN', () => R.reports.clientChecklist(RSP)],
      'reports.clientHistory': ['FORBIDDEN', () => R.reports.clientHistory(RSP, 2026)],
      'reports.monthlySummary': ['FORBIDDEN', () => R.reports.monthlySummary('2026-09')],
      'reports.exportCsv': ['FORBIDDEN', () => R.reports.exportCsv('tasks')],
      'reports.fullBackup': ['FORBIDDEN', () => R.reports.fullBackup()],
      'activity.list': ['FORBIDDEN', () => R.activity.list({})],
      'search.query': ['EMPTY', () => R.search.query('a'), allEmpty],
      'today.queue': ['EMPTY', () => R.today.queue(), noQueue],
    };
  }

  it('lists every read method of the repositories object', async () => {
    const x = await ids();
    const all = Object.entries(R).flatMap(([group, methods]) => Object.keys(methods as object).map((m) => `${group}.${m}`));
    const readMethods = all.filter((n) => READ_NAME.test(n.split('.')[1]) && n !== 'session.me');
    const listed = reads(x);
    expect(readMethods.filter((n) => !(n in listed)), 'read methods with no revoked-membership case').toEqual([]);
  });

  it('gives a revoked helper FORBIDDEN or nothing from every read method that touches client data', { timeout: 180_000 }, async () => {
    const x = await ids();
    owner();
    await R.memberships.revoke('mem-ben');
    helper();
    const problems: string[] = [];
    for (const [name, [expected, call, isEmpty]] of Object.entries(reads(x))) {
      if (expected === 'CONFIG') continue;
      const outcome = await call().then(
        (v) => ({ ok: true as const, v }),
        (e) => ({ ok: false as const, code: code(e) }),
      );
      if (expected === 'FORBIDDEN' && (outcome.ok || outcome.code !== 'FORBIDDEN')) problems.push(`${name}: expected FORBIDDEN`);
      if (expected === 'EMPTY') {
        if (!outcome.ok && outcome.code !== 'FORBIDDEN') problems.push(`${name}: ${outcome.code}`);
        if (outcome.ok && isEmpty && !(isEmpty as (v: unknown) => boolean)(outcome.v)) problems.push(`${name}: returned records`);
      }
    }
    expect(problems).toEqual([]);
  });
});
