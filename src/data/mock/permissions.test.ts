import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories as R, mockDevControls } from './index';

/**
 * B11: permissions are enforced in the data layer. Ben (helper) is assigned to client-rsp and client-cruz only;
 * client-maria (Atty. Lopez) is not his.
 */
const MARIA = 'client-maria';
const MARIA_TASK = 'task-maria-2550q';

const forbidden = (p: Promise<unknown>) => expect(p).rejects.toMatchObject({ code: 'FORBIDDEN' });

describe('B11 data-layer permissions', () => {
  let marialine: string;
  let mariaDoc: string;
  let mariaFollowUp: string;

  beforeEach(async () => {
    mockDevControls.reset();
    mockDevControls.setPersona('owner');
    const t = await R.tasks.get(MARIA_TASK);
    marialine = t.lines[0].id;
    mariaDoc = (await R.documents.list({ clientId: MARIA })).items[0].id;
    mariaFollowUp = (await R.followUps.list({ clientId: MARIA })).items[0].followUp.id;
    mockDevControls.setPersona('helper');
  });

  it('refuses reads of an unassigned client for a helper', { timeout: 30_000 }, async () => {
    await forbidden(R.clients.get(MARIA));
    await forbidden(R.contacts.listByClient(MARIA));
    await forbidden(R.authorizations.listByClient(MARIA));
    await forbidden(R.tasks.get(MARIA_TASK));
    await forbidden(R.lines.history(marialine));
    await forbidden(R.documents.getUrl(mariaDoc, 'view'));
    await forbidden(R.followUps.get(mariaFollowUp));
    await forbidden(R.notes.list('client', MARIA));
    await forbidden(R.reports.clientChecklist(MARIA));
    await forbidden(R.reports.clientHistory(MARIA, 2026));
    await forbidden(R.clients.revealTin(MARIA));
  });

  it('refuses writes on an unassigned client for a helper', { timeout: 30_000 }, async () => {
    await forbidden(R.clients.upsert({ id: MARIA, displayName: 'Changed' }));
    await forbidden(R.clients.archive(MARIA, 'helper test reason'));
    await forbidden(R.clients.restore(MARIA, 'helper test reason'));
    await forbidden(R.contacts.upsert({ clientId: MARIA, name: 'New Contact' }));
    await forbidden(R.authorizations.upsert({ clientId: MARIA, type: 'spa' }));
    await forbidden(R.tasks.update(MARIA_TASK, { notes: 'x' }));
    await forbidden(R.tasks.setNextAction(MARIA_TASK, { text: 'x', owner: 'operator' }));
    await forbidden(R.tasks.archive(MARIA_TASK, 'helper test reason'));
    await forbidden(R.tasks.duplicateForNextPeriod(MARIA_TASK));
    await forbidden(R.tasks.create({ clientId: MARIA, kind: 'other', title: 'x', dueDate: '2026-12-31' }, []));
    await forbidden(R.lines.setStatus(marialine, 'requested'));
    await forbidden(R.lines.update(marialine, { label: 'x' }));
    await forbidden(R.lines.addAdHoc(MARIA_TASK, { label: 'x' }));
    await forbidden(R.documents.update(mariaDoc, { kind: 'other' }));
    await forbidden(R.documents.remove(mariaDoc, 'helper test reason'));
    await forbidden(R.followUps.create({ clientId: MARIA, channel: 'viber', language: 'en' } as never));
    await forbidden(R.followUps.resolve(mariaFollowUp, 'helper test reason'));
    await forbidden(R.payments.save({ clientId: MARIA, taskId: MARIA_TASK, amount: 100, paidOn: '2026-10-20', channel: 'online', paidBy: 'client' } as never));
    await forbidden(R.notes.save({ entity: 'client', entityId: MARIA, body: 'x' }));
    await forbidden(R.visits.addItem('visit-today', MARIA_TASK, 'submit'));
  });

  it('checks the stored record and never lets a missing client id through', { timeout: 30_000 }, async () => {
    // Overwriting an unassigned client's payment, with or without a client id of the caller's choosing
    await forbidden(R.payments.save({ id: 'pay-demo-2', amount: 1 } as never));
    await forbidden(R.payments.save({ id: 'pay-demo-2', clientId: 'client-rsp', amount: 1 } as never));
    // Moving an unassigned client's authorization to a client the helper owns
    await forbidden(R.authorizations.upsert({ id: 'auth-maria-letter', clientId: 'client-rsp' }));
    await forbidden(R.authorizations.upsert({ id: 'auth-maria-letter', notes: 'x' }));
    // Planning a visit that carries an unassigned client's task
    await forbidden(R.visits.create({ officeId: 'off-rdo39', plannedDate: '2026-11-03' } as never, [{ taskId: MARIA_TASK, action: 'submit' }] as never));
    // Writes that name no client at all are refused for a helper
    await forbidden(R.documents.upload({ kind: 'other', displayName: 'x.pdf' } as never, new Blob(['x']), undefined, {} as never));
    await forbidden(R.followUps.create({ channel: 'viber', language: 'en' } as never));
    await forbidden(R.documents.findBySha('abc', undefined as never));
    // Re-pointing an assigned task at an unassigned client
    await forbidden(R.tasks.update('task-rsp-0619e', { clientId: MARIA } as never));
    // The audit trail of an unassigned client
    await forbidden(R.activity.list({ clientId: MARIA }));
  });

  it('refuses records that point at another client\'s parent, and updates that re-point a record', { timeout: 30_000 }, async () => {
    // A valid own client id with a foreign reference
    await forbidden(R.documents.upload({ kind: 'other', displayName: 'x.pdf', clientId: 'client-rsp', taskId: MARIA_TASK, lineId: marialine } as never, new Blob(['x']), undefined, {} as never));
    await forbidden(R.followUps.create({ clientId: 'client-rsp', taskId: MARIA_TASK, lineIds: [marialine], channel: 'viber', language: 'en' } as never));
    await forbidden(R.payments.save({ clientId: 'client-rsp', taskId: MARIA_TASK, amount: 100, paidOn: '2026-10-20', channel: 'online', paidBy: 'client' } as never));
    await forbidden(R.visits.setPacked('visit-v1', { lineId: marialine }, true));
    // Re-pointing an owned record at an unassigned client
    await forbidden(R.lines.update('line-rsp-1', { clientId: MARIA } as never));
    await forbidden(R.documents.update('doc-rsp-1', { clientId: MARIA } as never));
    await forbidden(R.visits.updateItem('vitem-v1-3', { clientId: MARIA } as never));
    // Changing identity fields is refused outright
    await forbidden(R.tasks.update('task-rsp-0619e', { id: MARIA_TASK } as never));
    await expect(R.lines.reorder('task-rsp-0619e', [marialine])).rejects.toMatchObject({ code: 'RULE_VIOLATION' });
    // Maria's records are unchanged
    mockDevControls.setPersona('owner');
    expect((await R.tasks.get(MARIA_TASK)).lines.find((l) => l.id === marialine)?.documentIds).toEqual([]);
    expect((await R.payments.list({ clientId: MARIA })).items.some((p) => p.amount === 100)).toBe(false);
  });

  it('refuses a visit whose items all belong to unassigned clients, and hides those items in shared visits', async () => {
    await forbidden(R.visits.get('visit-v3'));
    await forbidden(R.visits.recordOutcome('vitem-v3-1', { outcome: 'completed' } as never));
    const list = await R.visits.list();
    expect(list.items.some((s) => s.visit.id === 'visit-v3')).toBe(false);
    const v1 = await R.visits.get('visit-v1');
    expect(v1.items.every((i) => ['client-rsp', 'client-cruz'].includes(i.client.id))).toBe(true);
  });

  it('refuses owner-only actions for a helper, even on assigned clients', { timeout: 30_000 }, async () => {
    await forbidden(R.tasks.override('task-rsp-0619e', 'ready_next_step', 'helper test reason'));
    await forbidden(R.tasks.clearOverride('task-rsp-0619e', 'helper test reason'));
    await forbidden(R.tasks.changeDue('task-rsp-0619e', '2026-12-31', 'RMC X', 'helper test reason'));
    await forbidden(R.templates.save({ id: 'tmpl-0619e', name: 'x' }, []));
    await forbidden(R.templates.markVerified('tmpl-0619e', { sourceRef: 'RR 1', verifiedOn: '2026-10-27' }));
    await forbidden(R.deadlineMoves.save({ period: '2026-Q3', newDueDate: '2026-12-31', sourceRef: 'RMC X' }, false));
    await forbidden(R.deadlineMoves.remove('dm-demo-1702ex', 'helper test reason'));
    await forbidden(R.holidays.save({ date: '2026-12-31', name: 'x', type: 'regular' }));
    await forbidden(R.holidays.remove('hol-1'));
    await forbidden(R.settings.save({ practiceName: 'x' }));
    await forbidden(R.messages.save({ name: 'x', body: 'x' } as never));
    await forbidden(R.visitKit.save({ label: 'x' } as never));
    await forbidden(R.baseline.save({ periodStart: '2026-01-01', periodEnd: '2026-06-30' } as never));
    await forbidden(R.reports.fullBackup());
    await forbidden(R.reports.exportCsv('tasks'));
    await forbidden(R.reports.monthlySummary('2026-09'));
    await forbidden(R.activity.list({}));
    await forbidden(R.memberships.list());
  });

  it('still lets a helper work on assigned clients', async () => {
    const t = await R.tasks.get('task-rsp-0619e');
    expect(t.task.clientId).toBe('client-rsp');
    expect((await R.clients.get('client-cruz')).client.id).toBe('client-cruz');
    const updated = await R.tasks.setNextAction('task-rsp-0619e', { text: 'Helper follow-up', owner: 'operator' });
    expect(updated.nextAction?.text).toBe('Helper follow-up');
  });

  it('only returns assigned clients in lists, search, calendar and insights', { timeout: 30_000 }, async () => {
    const allowed = new Set(['client-rsp', 'client-cruz']);
    expect((await R.tasks.list()).items.every((s) => allowed.has(s.task.clientId))).toBe(true);
    expect((await R.clients.list({})).items.every((s) => allowed.has(s.client.id))).toBe(true);
    expect((await R.documents.list()).items.every((d) => allowed.has(d.clientId))).toBe(true);
    expect((await R.followUps.list()).items.every((f) => allowed.has(f.client.id))).toBe(true);
    expect((await R.payments.list()).items.every((p) => allowed.has(p.clientId))).toBe(true);
    const found = await R.search.query('Lopez');
    expect(found.clients.length).toBe(0);
    const helperTrips = (await R.insights.get('trips')) as { totalTrips?: number };
    mockDevControls.setPersona('owner');
    const ownerTrips = (await R.insights.get('trips')) as { totalTrips?: number };
    expect(helperTrips.totalTrips ?? 0).toBeLessThan(ownerTrips.totalTrips ?? 0);
  });

  it('lets a helper review lines only while the practice allows it', async () => {
    mockDevControls.setPersona('owner');
    const detail = await R.tasks.get('task-rsp-0619e');
    const received = detail.lines.find((l) => l.status === 'received')!;
    await R.settings.save({ helpersCanAccept: false });
    mockDevControls.setPersona('helper');
    await forbidden(R.lines.setStatus(received.id, 'accepted'));
    mockDevControls.setPersona('owner');
    await R.settings.save({ helpersCanAccept: true });
    mockDevControls.setPersona('helper');
    const ok = await R.lines.setStatus(received.id, 'accepted');
    expect(ok.status).toBe('accepted');
  });
});
