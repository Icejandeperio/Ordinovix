import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories as R, mockDevControls, HELPER_FIELDS } from './index';

/**
 * B11, table driven. Ben (helper) is assigned to client-rsp and client-cruz only. Every method of the
 * repositories object must be classified here: either it is in FORBIDDEN_FOR_HELPER (called against an unassigned
 * client's records, or an owner-only action, it must return FORBIDDEN) or in NOT_CLIENT_SCOPED (reads, lists and
 * per-user settings that filter or do not touch client data). A new repository method that is in neither
 * fails the coverage test, so nobody can add a write without deciding its policy.
 */
const MARIA = 'client-maria';
const MARIA_TASK = 'task-maria-2550q';
const blob = () => new Blob(['x'], { type: 'image/png' });
const info = { originalName: 'x.png', originalSizeBytes: 1, sha256: 'x' } as never;

interface Ids {
  marialine: string;
  mariaDoc: string;
  mariaFollowUp: string;
}
let ids: Ids;

const NOT_CLIENT_SCOPED = new Set([
  'session.me', 'session.signOut', 'prefs.save', 'today.queue', 'clients.list', 'templates.list', 'templates.get',
  'deadlineMoves.list', 'holidays.list', 'tasks.list', 'tasks.board', 'documents.list', 'followUps.list',
  'messages.list', 'offices.list', 'offices.get', 'offices.save', 'visits.list', 'visitKit.list', 'payments.list',
  'savedViews.list', 'savedViews.save', 'savedViews.remove', 'notifications.list', 'notifications.markRead',
  'notifications.unreadCount', 'push.subscribe', 'push.unsubscribe', 'push.test', 'calendar.range', 'insights.get',
  'baseline.get', 'pulses.list', 'search.query',
]);

function forbiddenCalls(): Record<string, () => Promise<unknown>> {
  const { marialine, mariaDoc, mariaFollowUp } = ids;
  return {
    'memberships.list': () => R.memberships.list(),
    'memberships.invite': () => R.memberships.invite({ email: 'x@example.com', role: 'helper', clientIds: [] }),
    'memberships.update': () => R.memberships.update('mem-ben', { role: 'owner' }),
    'memberships.revoke': () => R.memberships.revoke('mem-ana'),
    'settings.save': () => R.settings.save({ practiceName: 'x' }),
    'clients.get': () => R.clients.get(MARIA),
    'clients.upsert': () => R.clients.upsert({ id: MARIA, displayName: 'x' }),
    'clients.archive': () => R.clients.archive(MARIA, 'helper test reason'),
    'clients.restore': () => R.clients.restore(MARIA, 'helper test reason'),
    'clients.revealTin': () => R.clients.revealTin(MARIA),
    'clients.findDuplicates': () => R.clients.findDuplicates({ name: 'x' }),
    'clients.importPreview': () => R.clients.importPreview([], {}),
    'clients.importCommit': () => R.clients.importCommit({} as never),
    'clients.importUndo': () => R.clients.importUndo('batch-1'),
    'contacts.listByClient': () => R.contacts.listByClient(MARIA),
    'contacts.upsert': () => R.contacts.upsert({ clientId: MARIA, name: 'x' }),
    'contacts.remove': () => R.contacts.remove('con-vtl-1', 'helper test reason'),
    'authorizations.listByClient': () => R.authorizations.listByClient(MARIA),
    'authorizations.upsert': () => R.authorizations.upsert({ clientId: MARIA, type: 'spa' }),
    'authorizations.replace': () => R.authorizations.replace('auth-vtl-spa', { clientId: 'client-vtl' }),
    'templates.save': () => R.templates.save({ id: 'tmpl-0619e', name: 'x' }, []),
    'templates.markVerified': () => R.templates.markVerified('tmpl-0619e', { sourceRef: 'RR 1', verifiedOn: '2026-10-27' }),
    'deadlineMoves.save': () => R.deadlineMoves.save({ period: '2026-Q3', newDueDate: '2026-12-31', sourceRef: 'x' }, false),
    'deadlineMoves.remove': () => R.deadlineMoves.remove('dm-demo-1702ex', 'helper test reason'),
    'holidays.save': () => R.holidays.save({ date: '2026-12-31', name: 'x', type: 'regular' }),
    'holidays.remove': () => R.holidays.remove('hol-1'),
    'tasks.get': () => R.tasks.get(MARIA_TASK),
    'tasks.create': () => R.tasks.create({ clientId: MARIA, kind: 'other', title: 'x', dueDate: '2026-12-31' }, []),
    'tasks.update': () => R.tasks.update(MARIA_TASK, { notes: 'x' }),
    'tasks.setStatus': () => R.tasks.setStatus(MARIA_TASK, 'in_preparation'),
    'tasks.markSubmitted': () => R.tasks.markSubmitted(MARIA_TASK, { on: '2026-10-27', via: 'office' }),
    'tasks.markCompleted': () => R.tasks.markCompleted(MARIA_TASK, { on: '2026-10-27', noEvidenceReason: 'helper test reason' }),
    'tasks.override': () => R.tasks.override('task-rsp-0619e', 'ready_next_step', 'helper test reason'),
    'tasks.clearOverride': () => R.tasks.clearOverride('task-rsp-0619e', 'helper test reason'),
    'tasks.changeDue': () => R.tasks.changeDue('task-rsp-0619e', '2026-12-31', 'RMC X', 'helper test reason'),
    'tasks.setNextAction': () => R.tasks.setNextAction(MARIA_TASK, { text: 'x', owner: 'operator' }),
    'tasks.archive': () => R.tasks.archive(MARIA_TASK, 'helper test reason'),
    'tasks.restore': () => R.tasks.restore(MARIA_TASK, 'helper test reason'),
    'tasks.duplicateForNextPeriod': () => R.tasks.duplicateForNextPeriod(MARIA_TASK),
    'tasks.previewOpenPeriod': () => R.tasks.previewOpenPeriod('2026-Q3', []),
    'tasks.openPeriod': () => R.tasks.openPeriod({} as never),
    'lines.setStatus': () => R.lines.setStatus(marialine, 'requested'),
    'lines.addAdHoc': () => R.lines.addAdHoc(MARIA_TASK, { label: 'x' }),
    'lines.update': () => R.lines.update(marialine, { label: 'x' }),
    'lines.reorder': () => R.lines.reorder(MARIA_TASK, [marialine]),
    'lines.history': () => R.lines.history(marialine),
    'documents.upload': () => R.documents.upload({ clientId: MARIA, kind: 'other', source: 'upload' } as never, blob(), undefined, info),
    'documents.replace': () => R.documents.replace(mariaDoc, blob(), undefined, info),
    'documents.update': () => R.documents.update(mariaDoc, { kind: 'other' }),
    'documents.remove': () => R.documents.remove(mariaDoc, 'helper test reason'),
    'documents.getUrl': () => R.documents.getUrl(mariaDoc, 'view'),
    'documents.findBySha': () => R.documents.findBySha('x', MARIA),
    'followUps.get': () => R.followUps.get(mariaFollowUp),
    'followUps.create': () => R.followUps.create({ clientId: MARIA, channel: 'viber', language: 'en' } as never),
    'followUps.markSent': () => R.followUps.markSent(mariaFollowUp, { channel: 'viber', sentAt: '2026-10-27T09:00:00+08:00', expectedBy: '2026-10-30', message: 'x' }),
    'followUps.logResponse': () => R.followUps.logResponse(mariaFollowUp, { text: 'x', receivedLineIds: [] }),
    'followUps.escalate': () => R.followUps.escalate(mariaFollowUp, 'helper test reason'),
    'followUps.resolve': () => R.followUps.resolve(mariaFollowUp, 'helper test reason'),
    'messages.save': () => R.messages.save({ name: 'x', body: 'x' } as never),
    'visits.get': () => R.visits.get('visit-v3'),
    'visits.create': () => R.visits.create({ officeId: 'off-rdo39', plannedDate: '2026-11-03' } as never, [{ taskId: MARIA_TASK, action: 'submit' }] as never),
    'visits.update': () => R.visits.update('visit-v3', { plannedDate: '2026-11-03' }),
    'visits.suggestTasks': () => R.visits.suggestTasks('visit-v3'),
    'visits.addItem': () => R.visits.addItem('visit-today', MARIA_TASK, 'submit'),
    'visits.updateItem': () => R.visits.updateItem('vitem-v3-1', { questions: 'x' }),
    'visits.removeItem': () => R.visits.removeItem('vitem-v3-1'),
    'visits.setPacked': () => R.visits.setPacked('visit-v3', { lineId: marialine }, true),
    'visits.start': () => R.visits.start('visit-v3'),
    'visits.recordOutcome': () => R.visits.recordOutcome('vitem-v3-1', { outcome: 'completed' } as never),
    'visits.finish': () => R.visits.finish('visit-v3', { finishedAt: '2026-10-27T11:00:00+08:00' }),
    'visits.cancel': () => R.visits.cancel('visit-v3', 'helper test reason'),
    'visitKit.save': () => R.visitKit.save({ label: 'x' } as never),
    'payments.save': () => R.payments.save({ clientId: MARIA, taskId: MARIA_TASK, amount: 100, paidOn: '2026-10-20', channel: 'online', paidBy: 'client' } as never),
    'payments.remove': () => R.payments.remove('pay-demo-2', 'helper test reason'),
    'notes.list': () => R.notes.list('client', MARIA),
    'notes.save': () => R.notes.save({ entity: 'client', entityId: MARIA, body: 'x' }),
    'baseline.save': () => R.baseline.save({ periodStart: '2026-01-01', periodEnd: '2026-06-30' } as never),
    'pulses.save': () => R.pulses.save({ month: '2026-10' } as never),
    'reports.clientChecklist': () => R.reports.clientChecklist(MARIA),
    'reports.clientHistory': () => R.reports.clientHistory(MARIA, 2026),
    'reports.monthlySummary': () => R.reports.monthlySummary('2026-09'),
    'reports.exportCsv': () => R.reports.exportCsv('tasks'),
    'reports.fullBackup': () => R.reports.fullBackup(),
    'activity.list': () => R.activity.list({}),
  };
}

async function failures(calls: Record<string, () => Promise<unknown>>): Promise<string[]> {
  const entries = Object.entries(calls);
  const results = await Promise.allSettled(entries.map(([, call]) => call()));
  return entries.flatMap(([name], i) => {
    const r = results[i];
    if (r.status === 'fulfilled') return [`${name}: was ALLOWED`];
    const code = (r.reason as { code?: string })?.code;
    return code === 'FORBIDDEN' ? [] : [`${name}: ${code ?? 'no code'} (${(r.reason as Error)?.message})`];
  });
}

describe('B11 table: every repository method is classified', () => {
  it('has a policy decision for every method of the repositories object', () => {
    const all = Object.entries(R).flatMap(([group, methods]) => Object.keys(methods as object).map((m) => `${group}.${m}`));
    const classified = new Set([...Object.keys(forbiddenCallsShape()), ...NOT_CLIENT_SCOPED]);
    const missing = all.filter((name) => !classified.has(name));
    expect(missing, 'methods with no entry in the permission table').toEqual([]);
  });
});

/** The table keys without needing ids (used for the coverage check). */
function forbiddenCallsShape() {
  ids = { marialine: 'x', mariaDoc: 'x', mariaFollowUp: 'x' };
  return forbiddenCalls();
}

describe('B11 table: helper against an unassigned client or an owner-only action', () => {
  beforeEach(async () => {
    mockDevControls.reset();
    mockDevControls.setPersona('owner');
    const t = await R.tasks.get(MARIA_TASK);
    ids = {
      marialine: t.lines[0].id,
      mariaDoc: (await R.documents.list({ clientId: MARIA })).items[0].id,
      mariaFollowUp: (await R.followUps.list({ clientId: MARIA })).items[0].followUp.id,
    };
    mockDevControls.setPersona('helper');
  });

  it('returns FORBIDDEN for every classified method', { timeout: 120_000 }, async () => {
    expect(await failures(forbiddenCalls())).toEqual([]);
  });

  it('a revoked membership reaches nothing', { timeout: 60_000 }, async () => {
    mockDevControls.setPersona('owner');
    await R.memberships.revoke('mem-ben');
    mockDevControls.setPersona('helper');
    expect((await R.tasks.list()).items).toHaveLength(0);
    expect((await R.clients.list({})).items).toHaveLength(0);
    expect((await R.documents.list()).items).toHaveLength(0);
    expect((await R.visits.list()).items).toHaveLength(0);
    await expect(R.clients.get('client-rsp')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(R.tasks.get('task-rsp-0619e')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

/**
 * Generic updates and upserts: on an ASSIGNED client's record, every field that is not in the helper allowlist
 * must return FORBIDDEN. The keys tried are every key of a stored record plus a set of sensitive fields.
 */
const SENSITIVE_FIELDS = [
  'status', 'statusOverride', 'dueDate', 'dueSource', 'readyAt', 'submittedAt', 'completedAt', 'archivedReason',
  'reviewedBy', 'reviewedAt', 'reviewNote', 'flagNote', 'naReason', 'receivedAt', 'documentIds', 'deletedAt',
  'deletedReason', 'version', 'orgId', 'createdBy', 'updatedBy', 'tinFull', 'assignedUserIds', 'tags', 'outcome',
  'outcomeCause', 'avoidable', 'evidenceDocumentIds', 'packedLineIds', 'packedKitItemIds', 'startedAt', 'finishedAt',
  'costs', 'cancelledReason', 'departureOverrideReason', 'resolvedAt', 'escalatedReason', 'proofDocumentIds',
  'replacedById', 'storageKey', 'sha256', 'versionNo', 'replacesId', 'unknownReferenceId',
];

interface GenericCase {
  method: string;
  record: () => Promise<object>;
  call: (field: string, value: unknown) => Promise<unknown>;
}

function genericCases(): GenericCase[] {
  return [
    { method: 'tasks.update', record: async () => (await R.tasks.get('task-rsp-0619e')).task, call: (f, v) => R.tasks.update('task-rsp-0619e', { [f]: v } as never) },
    { method: 'lines.update', record: async () => (await R.tasks.get('task-rsp-0619e')).lines[0], call: (f, v) => R.lines.update('line-rsp-1', { [f]: v } as never) },
    { method: 'documents.update', record: async () => (await R.documents.list({ clientId: 'client-rsp' })).items[0], call: (f, v) => R.documents.update('doc-rsp-1', { [f]: v } as never) },
    { method: 'visits.update', record: async () => (await R.visits.get('visit-v1')).visit, call: (f, v) => R.visits.update('visit-v1', { [f]: v } as never) },
    { method: 'visits.updateItem', record: async () => (await R.visits.get('visit-v1')).items.find((i) => i.item.id === 'vitem-v1-3')!.item, call: (f, v) => R.visits.updateItem('vitem-v1-3', { [f]: v } as never) },
    { method: 'payments.save', record: async () => (await R.payments.list({ clientId: 'client-rsp' })).items[0], call: (f, v) => R.payments.save({ id: 'pay-rsp-advance', clientId: 'client-rsp', [f]: v } as never) },
    { method: 'contacts.upsert', record: async () => (await R.contacts.listByClient('client-rsp'))[0], call: (f, v) => R.contacts.upsert({ id: 'con-rsp-1', clientId: 'client-rsp', [f]: v } as never) },
    { method: 'authorizations.upsert', record: async () => (await R.authorizations.listByClient('client-rsp'))[0], call: (f, v) => R.authorizations.upsert({ id: 'auth-rsp-spa', clientId: 'client-rsp', [f]: v } as never) },
    { method: 'clients.upsert', record: async () => (await R.clients.get('client-rsp')).client, call: (f, v) => R.clients.upsert({ id: 'client-rsp', [f]: v } as never) },
    { method: 'tasks.create', record: async () => ({}), call: (f, v) => R.tasks.create({ clientId: 'client-rsp', kind: 'other', title: 'x', dueDate: '2026-12-31', [f]: v } as never, []) },
    { method: 'lines.addAdHoc', record: async () => ({}), call: (f, v) => R.lines.addAdHoc('task-rsp-0619e', { label: 'x', [f]: v } as never) },
    { method: 'documents.upload', record: async () => ({}), call: (f, v) => R.documents.upload({ clientId: 'client-rsp', kind: 'other', source: 'upload', [f]: v } as never, blob(), undefined, info) },
    { method: 'visits.create', record: async () => ({}), call: (f, v) => R.visits.create({ officeId: 'off-rdo39', plannedDate: '2026-11-03', [f]: v } as never, []) },
    { method: 'followUps.create', record: async () => ({}), call: (f, v) => R.followUps.create({ clientId: 'client-rsp', channel: 'viber', language: 'en', [f]: v } as never) },
    { method: 'notes.save', record: async () => ({}), call: (f, v) => R.notes.save({ entity: 'client', entityId: 'client-rsp', body: 'x', [f]: v } as never) },
  ];
}

describe('B11 table: helper allowlists on generic updates and upserts', () => {
  beforeEach(() => {
    mockDevControls.reset();
    mockDevControls.setPersona('helper');
  });

  for (const c of genericCases()) {
    it(`${c.method}: every non-allowlisted field is FORBIDDEN for a helper on an assigned client`, { timeout: 120_000 }, async () => {
      mockDevControls.setPersona('owner');
      const stored = (await c.record()) as Record<string, unknown>;
      mockDevControls.setPersona('helper');
      const allowed = HELPER_FIELDS[c.method];
      expect(allowed, `${c.method} has a helper allowlist`).toBeDefined();
      const fields = [...new Set([...Object.keys(stored), ...SENSITIVE_FIELDS])].filter((f) => !allowed.includes(f));
      const calls = Object.fromEntries(fields.map((f) => [`${c.method}.${f}`, () => c.call(f, stored[f] ?? 'x')]));
      expect(await failures(calls)).toEqual([]);
    });
  }

  it('the allowlisted fields still work for a helper on an assigned client', { timeout: 60_000 }, async () => {
    const t = await R.tasks.update('task-rsp-0619e', { ownerUserId: 'user-ben' });
    expect(t.ownerUserId).toBe('user-ben');
    const v = await R.visits.update('visit-v1', { plannedDate: '2026-11-04' });
    expect(v.plannedDate).toBe('2026-11-04');
    const item = await R.visits.updateItem('vitem-v1-3', { questions: 'Ask about the 2307s' });
    expect(item.questions).toBe('Ask about the 2307s');
    const note = await R.notes.save({ entity: 'client', entityId: 'client-rsp', body: 'Helper note', pinned: false });
    expect(note.body).toBe('Helper note');
  });

  it('the owner is not restricted by the helper allowlists', { timeout: 60_000 }, async () => {
    mockDevControls.setPersona('owner');
    const t = await R.tasks.update('task-rsp-0619e', { notes: 'Owner note', tags: ['x'] });
    expect(t.notes).toBe('Owner note');
  });
});

describe('B11 table: shared reference check (helper, own client id, foreign reference key)', () => {
  beforeEach(() => {
    mockDevControls.reset();
    mockDevControls.setPersona('helper');
  });

  it('refuses every Id or Ids key that points at an unassigned client\'s record', { timeout: 60_000 }, async () => {
    mockDevControls.setPersona('owner');
    const t = await R.tasks.get(MARIA_TASK);
    const line = t.lines[0].id;
    const doc = (await R.documents.list({ clientId: MARIA })).items[0].id;
    mockDevControls.setPersona('helper');
    const calls: Record<string, () => Promise<unknown>> = {
      'documents.upload taskId': () => R.documents.upload({ clientId: 'client-rsp', kind: 'other', source: 'upload', taskId: MARIA_TASK } as never, blob(), undefined, info),
      'documents.upload lineId': () => R.documents.upload({ clientId: 'client-rsp', kind: 'other', source: 'upload', lineId: line } as never, blob(), undefined, info),
      'documents.upload paymentId': () => R.documents.upload({ clientId: 'client-rsp', kind: 'other', source: 'upload', paymentId: 'pay-demo-2' } as never, blob(), undefined, info),
      'followUps.create taskId': () => R.followUps.create({ clientId: 'client-rsp', taskId: MARIA_TASK, channel: 'viber', language: 'en' } as never),
      'followUps.create lineIds': () => R.followUps.create({ clientId: 'client-rsp', lineIds: [line], channel: 'viber', language: 'en' } as never),
      'payments.save taskId': () => R.payments.save({ clientId: 'client-rsp', taskId: MARIA_TASK, amount: 1, paidOn: '2026-10-20', channel: 'online', paidBy: 'client' } as never),
      'payments.save proofDocumentIds': () => R.payments.save({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', amount: 1, paidOn: '2026-10-20', channel: 'online', paidBy: 'client', proofDocumentIds: [doc] } as never),
      'contacts.upsert documentIds-style key': () => R.contacts.upsert({ clientId: 'client-rsp', name: 'x', followUpId: 'fu-maria-resolved' } as never),
      'tasks.create (own client) with foreign line payload': () => R.tasks.create({ clientId: 'client-rsp', kind: 'other', title: 'x', dueDate: '2026-12-31' }, [{ label: 'x', documentIds: [doc] }] as never),
    };
    expect(await failures(calls)).toEqual([]);
  });
});
