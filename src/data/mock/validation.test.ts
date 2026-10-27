import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories as R, mockDevControls } from './index';

/**
 * B16: every write method parses its input with the zod schemas at the repository boundary and throws
 * VALIDATION with the messages per field. Each method of the repositories object is classified here: either it
 * has a bad-input call that must be refused (VALIDATED), or it is in NO_FREE_INPUT (reads, and writes whose
 * arguments are ids or enums the policy and rules already check). A new method in neither list fails the
 * coverage test, so nobody can add a write without deciding how its input is validated.
 */
const blob = () => new Blob(['x'], { type: 'image/png' });
const info = { originalName: 'x.png', originalSizeBytes: 1, sha256: 'x' } as never;
const SHORT = 'short';

const VALIDATED: Record<string, { field: string; call: () => Promise<unknown> }> = {
  'clients.upsert': { field: 'displayName', call: () => R.clients.upsert({ displayName: 'x' }) },
  'clients.archive': { field: 'reason', call: () => R.clients.archive('client-rsp', SHORT) },
  'clients.restore': { field: 'reason', call: () => R.clients.restore('client-rsp', SHORT) },
  'contacts.upsert': { field: 'name', call: () => R.contacts.upsert({ clientId: 'client-rsp', name: 'x' }) },
  'contacts.remove': { field: 'reason', call: () => R.contacts.remove('con-rsp-1', SHORT) },
  'authorizations.upsert': { field: 'scope', call: () => R.authorizations.upsert({ clientId: 'client-rsp', type: 'spa', granteeUserId: 'user-ana', issuedOn: '2026-10-01', scope: [] }) },
  'authorizations.replace': { field: 'scope', call: () => R.authorizations.replace('auth-rsp-spa', { clientId: 'client-rsp', scope: [] }) },
  'templates.save': { field: 'name', call: () => R.templates.save({ id: 'tmpl-0619e', name: 'x' }, []) },
  'templates.markVerified': { field: 'sourceRef', call: () => R.templates.markVerified('tmpl-0619e', { sourceRef: '', verifiedOn: '2026-10-27' }) },
  'deadlineMoves.save': { field: 'newDueDate', call: () => R.deadlineMoves.save({ period: '2026-Q3', newDueDate: 'bad', sourceRef: 'RMC 1' }, false) },
  'deadlineMoves.remove': { field: 'reason', call: () => R.deadlineMoves.remove('dm-demo-1702ex', SHORT) },
  'holidays.save': { field: 'date', call: () => R.holidays.save({ date: 'bad', name: 'Sample holiday', type: 'regular' }) },
  'settings.save': { field: 'practiceName', call: () => R.settings.save({ practiceName: 'x' }) },
  'memberships.invite': { field: 'email', call: () => R.memberships.invite({ email: 'nope', role: 'helper', clientIds: [] }) },
  'tasks.create': { field: 'clientId', call: () => R.tasks.create({ clientId: '', kind: 'other', title: 'x' }, []) },
  'tasks.update': { field: 'notes', call: () => R.tasks.update('task-rsp-0619e', { notes: 'x'.repeat(2001) }) },
  'tasks.setStatus': { field: 'reason', call: () => R.tasks.setStatus('task-rsp-0619e', 'in_preparation', SHORT) },
  'tasks.markSubmitted': { field: 'on', call: () => R.tasks.markSubmitted('task-rsp-0619e', { on: 'bad', via: 'office' }) },
  'tasks.markCompleted': { field: 'on', call: () => R.tasks.markCompleted('task-rsp-0619e', { on: 'bad' }) },
  'tasks.override': { field: 'reason', call: () => R.tasks.override('task-rsp-0619e', 'ready_next_step', SHORT) },
  'tasks.clearOverride': { field: 'reason', call: () => R.tasks.clearOverride('task-rsp-0619e', SHORT) },
  'tasks.changeDue': { field: 'dueDate', call: () => R.tasks.changeDue('task-rsp-0619e', 'bad', 'RMC 1', 'A long enough reason') },
  'tasks.setNextAction': { field: 'text', call: () => R.tasks.setNextAction('task-rsp-0619e', { text: '', owner: 'operator' }) },
  'tasks.archive': { field: 'reason', call: () => R.tasks.archive('task-rsp-0619e', SHORT) },
  'tasks.restore': { field: 'reason', call: () => R.tasks.restore('task-rsp-0619e', SHORT) },
  'lines.setStatus': { field: 'note', call: () => R.lines.setStatus('line-rsp-1', 'requested', { note: 'x'.repeat(201) }) },
  'lines.addAdHoc': { field: 'label', call: () => R.lines.addAdHoc('task-rsp-0619e', { label: 'x' }) },
  'lines.update': { field: 'label', call: () => R.lines.update('line-rsp-1', { label: 'x' }) },
  'documents.upload': { field: 'kind', call: () => R.documents.upload({ clientId: 'client-rsp', kind: 'bogus', source: 'upload' } as never, blob(), undefined, info) },
  'documents.update': { field: 'kind', call: () => R.documents.update('doc-rsp-1', { kind: 'bogus' } as never) },
  'documents.remove': { field: 'reason', call: () => R.documents.remove('doc-rsp-1', SHORT) },
  'followUps.create': { field: 'clientId', call: () => R.followUps.create({ clientId: '', channel: 'viber', language: 'en' } as never) },
  'followUps.markSent': { field: 'expectedBy', call: () => R.followUps.markSent('fu-rsp-2307', { channel: 'viber', sentAt: '2026-10-27T09:00:00+08:00', expectedBy: 'bad', message: 'Hello' }) },
  'followUps.logResponse': { field: 'text', call: () => R.followUps.logResponse('fu-rsp-2307', { text: '', receivedLineIds: [] }) },
  'followUps.escalate': { field: 'reason', call: () => R.followUps.escalate('fu-rsp-2307', SHORT) },
  'followUps.resolve': { field: 'reason', call: () => R.followUps.resolve('fu-rsp-2307', SHORT) },
  'messages.save': { field: 'body', call: () => R.messages.save({ name: 'Reminder', body: '' } as never) },
  'offices.save': { field: 'name', call: () => R.offices.save({ name: 'x', type: 'rdo' } as never) },
  'visits.create': { field: 'plannedDate', call: () => R.visits.create({ plannedDate: 'bad' } as never, []) },
  'visits.update': { field: 'plannedDate', call: () => R.visits.update('visit-v1', { plannedDate: 'bad' }) },
  'visits.updateItem': { field: 'questions', call: () => R.visits.updateItem('vitem-v1-3', { questions: 'x'.repeat(1001) }) },
  'visits.addItem': { field: 'action', call: () => R.visits.addItem('visit-v1', 'task-rsp-0619e', 'bogus' as never) },
  'visits.start': { field: 'reason', call: () => R.visits.start('visit-v1', SHORT) },
  'visits.recordOutcome': { field: 'outcome', call: () => R.visits.recordOutcome('vitem-v1-3', { outcome: 'bogus' } as never) },
  'visits.finish': { field: 'finishedAt', call: () => R.visits.finish('visit-v1', { finishedAt: 'bad' }) },
  'visits.cancel': { field: 'reason', call: () => R.visits.cancel('visit-v1', SHORT) },
  'visitKit.save': { field: 'label', call: () => R.visitKit.save({ label: 'x' } as never) },
  'payments.save': { field: 'amount', call: () => R.payments.save({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', amount: 1.5, paidOn: '2026-10-20', channel: 'online', paidBy: 'client' } as never) },
  'payments.remove': { field: 'reason', call: () => R.payments.remove('pay-rsp-advance', SHORT) },
  'notes.save': { field: 'body', call: () => R.notes.save({ entity: 'client', entityId: 'client-rsp', body: '' }) },
  'baseline.save': { field: 'periodStart', call: () => R.baseline.save({ periodStart: 'bad', periodEnd: '2026-06-30' } as never) },
  'pulses.save': { field: 'month', call: () => R.pulses.save({ month: 'bad' } as never) },
};

/** Reads, and writes whose arguments are ids or enums that the policy and rules already check. */
const NO_FREE_INPUT = new Set([
  'session.me', 'session.signOut', 'prefs.save', 'today.queue', 'memberships.list', 'memberships.update', 'memberships.revoke',
  'clients.list', 'clients.get', 'clients.revealTin', 'clients.findDuplicates', 'clients.importPreview', 'clients.importCommit', 'clients.importUndo',
  'contacts.listByClient', 'authorizations.listByClient', 'templates.list', 'templates.get', 'deadlineMoves.list', 'holidays.list', 'holidays.remove',
  'tasks.list', 'tasks.get', 'tasks.duplicateForNextPeriod', 'tasks.previewOpenPeriod', 'tasks.openPeriod', 'tasks.board',
  'lines.reorder', 'lines.history', 'documents.list', 'documents.replace', 'documents.getUrl', 'documents.findBySha',
  'followUps.list', 'followUps.get', 'messages.list', 'offices.list', 'offices.get',
  'visits.list', 'visits.get', 'visits.suggestTasks', 'visits.removeItem', 'visits.setPacked',
  'visitKit.list', 'payments.list', 'notes.list', 'savedViews.list', 'savedViews.save', 'savedViews.remove',
  'notifications.list', 'notifications.markRead', 'notifications.unreadCount', 'push.subscribe', 'push.unsubscribe', 'push.test',
  'calendar.range', 'insights.get', 'baseline.get', 'pulses.list',
  'reports.clientChecklist', 'reports.clientHistory', 'reports.monthlySummary', 'reports.exportCsv', 'reports.fullBackup',
  'activity.list', 'search.query',
]);

describe('B16 every repository method has a validation decision', () => {
  it('lists each method as validated or as having no free input', () => {
    const all = Object.entries(R).flatMap(([group, methods]) => Object.keys(methods as object).map((m) => `${group}.${m}`));
    const classified = new Set([...Object.keys(VALIDATED), ...NO_FREE_INPUT]);
    expect(all.filter((n) => !classified.has(n)), 'methods with no entry in the validation table').toEqual([]);
    expect([...classified].filter((n) => !all.includes(n)), 'table entries for methods that do not exist').toEqual([]);
  });
});

describe('B16 bad input is refused with VALIDATION and field errors', () => {
  beforeEach(() => {
    mockDevControls.reset();
    mockDevControls.setPersona('owner');
  });

  it('every validated write method throws VALIDATION naming the field', { timeout: 120_000 }, async () => {
    const entries = Object.entries(VALIDATED);
    const results = await Promise.allSettled(entries.map(([, v]) => v.call()));
    const problems = entries.flatMap(([name, v], i) => {
      const r = results[i];
      if (r.status === 'fulfilled') return [`${name}: was accepted`];
      const e = r.reason as { code?: string; fieldErrors?: Record<string, string[]>; message?: string };
      if (e.code !== 'VALIDATION') return [`${name}: ${e.code ?? 'no code'} (${e.message})`];
      return e.fieldErrors && v.field in e.fieldErrors ? [] : [`${name}: no error for "${v.field}" (got ${Object.keys(e.fieldErrors ?? {}).join(',')})`];
    });
    expect(problems).toEqual([]);
  });

  it('a refused write changes nothing', { timeout: 30_000 }, async () => {
    const before = (await R.payments.list({ clientId: 'client-rsp' })).items.length;
    await expect(
      R.payments.save({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', amount: 0, paidOn: '2026-10-20', channel: 'online', paidBy: 'client' } as never),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await R.payments.list({ clientId: 'client-rsp' })).items.length).toBe(before);
  });

  it('the policy is checked before the input: a helper on an unassigned client gets FORBIDDEN, not VALIDATION', { timeout: 30_000 }, async () => {
    mockDevControls.setPersona('helper');
    await expect(R.clients.archive('client-maria', SHORT)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('valid input still goes through', { timeout: 30_000 }, async () => {
    await expect(R.clients.archive('client-jra', 'Closed his practice in September')).resolves.toBeUndefined();
  });
});
