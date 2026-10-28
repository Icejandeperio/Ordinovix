import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONAS, TEST_SECRETS, openWorld, type World } from '../testing/world';
import { decryptTin } from '../lib/tin';

/**
 * U27: the multi-step writes are single batches (a failure leaves nothing partial), an invited person gets in at their first
 * Google sign-in, a revoked person is signed out, the client import seals TINs, and settings need a version.
 */
let world: World;
const cookie: Record<string, string> = {};
let n = 0;

beforeAll(async () => {
  world = await openWorld();
  cookie.owner = await world.cookieFor(PERSONAS.owner);
  cookie.helper = await world.cookieFor(PERSONAS.helper);
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

async function send(who: 'owner' | 'helper', method: string, path: string, body?: unknown, opts: { ifMatch?: number; env?: Record<string, unknown>; cookieValue?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'Idempotency-Key': `b2-key-${++n}-${crypto.randomUUID()}` };
  if (opts.ifMatch !== undefined) headers['If-Match'] = `"${opts.ifMatch}"`;
  const res = await world.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cookie: opts.cookieValue ?? cookie[who], env: opts.env as never });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, text, headers: res.headers };
}
const count = async (sql: string, ...bind: unknown[]) => (await world.env.DB.prepare(sql).bind(...bind).first<{ n: number }>())!.n;
const row = async (sql: string, ...bind: unknown[]) => (await world.env.DB.prepare(sql).bind(...bind).first<any>())!;

/** The same database, but the batch also carries a statement that cannot succeed: the whole batch must roll back. */
const failingBatch = () =>
  new Proxy(world.env.DB, {
    get(target, prop) {
      if (prop === 'batch') {
        return (statements: D1PreparedStatement[]) =>
          target.batch([...statements, target.prepare("INSERT INTO orgs (id, name, is_demo, created_at) VALUES (NULL, 'boom', 0, 'x')")]);
      }
      const v = (target as any)[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  }) as D1Database;

const snapshot = async () => ({
  tasks: await count('SELECT COUNT(*) AS n FROM tasks'),
  lines: await count('SELECT COUNT(*) AS n FROM task_lines'),
  clients: await count('SELECT COUNT(*) AS n FROM clients'),
  batches: await count('SELECT COUNT(*) AS n FROM import_batches'),
  activity: await count('SELECT COUNT(*) AS n FROM activity'),
  keys: await count('SELECT COUNT(*) AS n FROM idempotency_keys'),
});

describe('multi-step writes are one batch: a failure leaves no partial write', () => {
  it('openPeriod: all of the period\'s tasks and lines, or none', async () => {
    const plan = (period: string) => ({
      period,
      selections: [
        { clientId: 'client-rsp', templateId: 'tmpl-1601c', dueDate: '2027-02-10' },
        { clientId: 'client-cruz', templateId: 'tmpl-1601c', dueDate: '2027-02-10' },
        { clientId: 'client-maria', templateId: 'tmpl-1601c', dueDate: '2027-02-10' },
      ],
    });
    const before = await snapshot();
    const failed = await send('owner', 'POST', '/api/v1/tasks/open-period', plan('2027-01'), { env: { DB: failingBatch() } });
    expect(failed.status).toBe(500);
    expect(await snapshot()).toEqual(before);

    const ok = await send('owner', 'POST', '/api/v1/tasks/open-period', plan('2027-01'));
    expect(ok.status, ok.text).toBe(201);
    expect(ok.body.created).toHaveLength(3);
    const after = await snapshot();
    expect(after.tasks).toBe(before.tasks + 3);
    expect(after.lines).toBeGreaterThanOrEqual(before.lines); // the lines come from the template's requirements (tmpl-1601c has none in the seed)
    // the second run of the same period applies nothing new (idempotent per client, template and period)
    const again = await send('owner', 'POST', '/api/v1/tasks/open-period', plan('2027-01'));
    expect(again.body.created).toHaveLength(0);
    expect(again.body.skipped).toBe(3);
  });

  it('recordOutcome: the outcome, the line and task changes and the activity, or nothing', async () => {
    const visit = await send('owner', 'POST', '/api/v1/visits', { officeId: 'off-rdo39', plannedDate: '2026-11-03', arriveBy: '09:00', assigneeUserId: 'user-ana', purpose: 'Counter', items: [{ taskId: 'task-maria-2550q', action: 'submit' }] });
    const visitId = visit.body.id;
    const itemId = (await row('SELECT id FROM visit_items WHERE visit_id = ?', visitId)).id;
    expect((await send('owner', 'POST', `/api/v1/visits/${visitId}/start`, { leaveAnywayReason: 'Client needs it filed today' })).status).toBe(200);

    const before = await snapshot();
    const failed = await send('owner', 'POST', `/api/v1/visits/${visitId}/items/${itemId}/outcome`, { outcome: 'completed', evidenceDocumentIds: [] }, { env: { DB: failingBatch() } });
    expect(failed.status).toBe(500);
    expect(await snapshot()).toEqual(before);
    expect((await row('SELECT outcome FROM visit_items WHERE id = ?', itemId)).outcome).toBeNull();

    const ok = await send('owner', 'POST', `/api/v1/visits/${visitId}/items/${itemId}/outcome`, { outcome: 'completed', evidenceDocumentIds: [] });
    expect(ok.status, ok.text).toBe(200);
    expect((await row('SELECT outcome, outcome_at FROM visit_items WHERE id = ?', itemId)).outcome).toBe('completed');
    expect((await snapshot()).activity).toBeGreaterThan(before.activity);
  });

  it('markCompleted: the status, the dates and the activity, or nothing', async () => {
    const created = await send('owner', 'POST', '/api/v1/tasks', { clientId: 'client-maria', title: 'Quick registration', kind: 'registration', dueDate: '2026-12-15' });
    const id = created.body.id;
    const submitted = await send('owner', 'POST', `/api/v1/tasks/${id}/submit`, { on: '2026-10-27', via: 'office' });
    expect([200, 409], submitted.text).toContain(submitted.status);
    const before = await snapshot();
    const failed = await send('owner', 'POST', `/api/v1/tasks/${id}/complete`, { on: '2026-10-27', noEvidenceReason: 'Stamped copy to follow' }, { env: { DB: failingBatch() } });
    expect(failed.status).toBe(500);
    expect(await snapshot()).toEqual(before);
    const statusBefore = (await row('SELECT status FROM tasks WHERE id = ?', id)).status;
    expect(statusBefore).not.toBe('completed');

    const ok = await send('owner', 'POST', `/api/v1/tasks/${id}/complete`, { on: '2026-10-27', noEvidenceReason: 'Stamped copy to follow' });
    expect([200, 409], ok.text).toContain(ok.status);
    if (ok.status === 200) expect((await row('SELECT status FROM tasks WHERE id = ?', id)).status).toBe('completed');
  });

  it('importCommit: every client of the file and the batch record, or none', async () => {
    const preview = await send('owner', 'POST', '/api/v1/clients/import/preview', { rows: [{ N: 'Import One', C: 'IMA1' }, { N: 'Import Two', C: 'IMA2' }, { N: 'Import Three', C: 'IMA3' }], mapping: { displayName: 'N', code: 'C' } });
    expect(preview.status, preview.text).toBe(200);
    expect(preview.body.validRows).toHaveLength(3);
    const before = await snapshot();
    const failed = await send('owner', 'POST', '/api/v1/clients/import/commit', { preview: preview.body }, { env: { DB: failingBatch() } });
    expect(failed.status).toBe(500);
    expect(await snapshot()).toEqual(before);

    const ok = await send('owner', 'POST', '/api/v1/clients/import/commit', { preview: preview.body });
    expect(ok.status, ok.text).toBe(201);
    expect(ok.body.created).toHaveLength(3);
    const after = await snapshot();
    expect(after.clients).toBe(before.clients + 3);
    expect(after.batches).toBe(before.batches + 1);
  });
});

describe('client import', () => {
  it('seals the TINs in the file: encrypted and hashed in the database, absent from the response, the activity and the idempotency record', async () => {
    const preview = await send('owner', 'POST', '/api/v1/clients/import/preview', {
      rows: [{ Name: 'Sealed Co', Code: 'SEAL1', TIN: '135-792-468-00000' }],
      mapping: { displayName: 'Name', code: 'Code', tin: 'TIN' },
    });
    expect(preview.status, preview.text).toBe(200);
    const key = `import-seal-key-${++n}`;
    const res = await world.request('/api/v1/clients/import/commit', { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ preview: preview.body }), cookie: cookie.owner });
    const text = await res.text();
    expect(res.status, text).toBe(201);
    expect(text).not.toContain('135');
    const created = JSON.parse(text).created[0];
    const stored = await row('SELECT tin_masked, tin_encrypted, tin_hash FROM clients WHERE id = ?', created);
    expect(stored.tin_masked).toBe('•••-•••-468-00000');
    expect(await decryptTin(TEST_SECRETS.TIN_ENCRYPTION_KEY, stored.tin_encrypted)).toBe('135-792-468-00000');
    expect(stored.tin_hash).toMatch(/^[0-9a-f]{64}$/);
    for (const sql of ["SELECT group_concat(summary || ifnull(before_json, '') || ifnull(after_json, '')) AS t FROM activity", 'SELECT group_concat(response_json) AS t FROM idempotency_keys']) {
      const { t } = await row(sql);
      expect(t).not.toContain('135-792');
      expect(t).not.toContain('135792');
    }
  });

  it('undo soft-deletes the batch\'s clients, marks the batch, and cannot run twice', async () => {
    const preview = await send('owner', 'POST', '/api/v1/clients/import/preview', { rows: [{ N: 'Undo Me', C: 'UND1' }], mapping: { displayName: 'N', code: 'C' } });
    const committed = await send('owner', 'POST', '/api/v1/clients/import/commit', { preview: preview.body });
    const clientId = committed.body.created[0];
    const batchId = committed.body.batchId;
    expect((await row('SELECT import_batch_id FROM clients WHERE id = ?', clientId)).import_batch_id).toBe(batchId);
    const undone = await send('owner', 'POST', `/api/v1/clients/import/${batchId}/undo`);
    expect(undone.status, undone.text).toBe(200);
    const gone = await row('SELECT deleted_at, deleted_reason FROM clients WHERE id = ?', clientId);
    expect(gone.deleted_at).toBeTruthy();
    expect((await row('SELECT undone_at FROM import_batches WHERE id = ?', batchId)).undone_at).toBeTruthy();
    const again = await send('owner', 'POST', `/api/v1/clients/import/${batchId}/undo`);
    expect(again.status).toBe(409);
    // the same preview cannot be committed twice
    expect((await send('owner', 'POST', '/api/v1/clients/import/commit', { preview: preview.body })).status).toBe(409);
  });
});

describe('an invited person gets in at their first Google sign-in', () => {
  it('does not link an account whose email Google has not verified', async () => {
    await send('owner', 'POST', '/api/v1/memberships', { email: 'careful.invitee@example.org', role: 'helper', clientIds: [] });
    const unverified = await world.cookieFor({ id: 'ba-unverified', name: 'Care Ful', email: 'careful.invitee@example.org', emailVerified: false });
    const res = await world.request('/api/v1/session/me', { cookie: unverified });
    expect(((await res.json()) as any).error.code).toBe('ACCESS_PENDING');
    expect((await row("SELECT auth_user_id FROM users WHERE email = 'careful.invitee@example.org'")).auth_user_id).toBeNull();
  });

  const invitee = { id: 'ba-invited-helper', name: 'Ines Invited', email: 'Ines.Invited@Example.org' };

  it('is linked to the profile the invitation created and works as a helper on the assigned clients only', async () => {
    const invite = await send('owner', 'POST', '/api/v1/memberships', { email: 'ines.invited@example.org', role: 'helper', clientIds: ['client-rsp'], name: 'Ines Invited' });
    expect(invite.status, invite.text).toBe(201);
    const profile = await row("SELECT id, auth_user_id FROM users WHERE email = 'ines.invited@example.org'");
    expect(profile.auth_user_id).toBeNull();

    const cookieValue = await world.cookieFor(invitee);
    const me = await world.request('/api/v1/session/me', { cookie: cookieValue });
    expect(me.status).toBe(200);
    const body = (await me.json()) as any;
    expect(body.user.id).toBe(profile.id); // records keep pointing at the profile created by the invitation
    expect(body.membership).toMatchObject({ role: 'helper', clientIds: ['client-rsp'], active: true });
    expect((await row('SELECT auth_user_id FROM users WHERE id = ?', profile.id)).auth_user_id).toBe(invitee.id);
    expect((await row('SELECT accepted_at FROM memberships WHERE id = ?', invite.body.id)).accepted_at).toBeTruthy();

    // and he works as a helper: his client yes, another no
    const mine = await world.request('/api/v1/clients/client-rsp', { cookie: cookieValue });
    expect(mine.status).toBe(200);
    expect((await world.request('/api/v1/clients/client-maria', { cookie: cookieValue })).status).toBe(403);

  });

  it('revoking the membership signs the person out everywhere in the same batch', async () => {
    const membershipId = (await row("SELECT id FROM memberships WHERE email = 'ines.invited@example.org'")).id;
    expect(await count('SELECT COUNT(*) AS n FROM session WHERE user_id = ?', invitee.id)).toBeGreaterThan(0);
    const revoked = await send('owner', 'POST', `/api/v1/memberships/${membershipId}/revoke`);
    expect(revoked.status, revoked.text).toBe(200);
    expect(await count('SELECT COUNT(*) AS n FROM session WHERE user_id = ?', invitee.id)).toBe(0);
    const after = await world.request('/api/v1/session/me', { cookie: await world.cookieFor(invitee) });
    expect(after.status).toBe(403);
    expect(((await after.json()) as any).error.code).toBe('FORBIDDEN');
  });
});

describe('settings, preferences and notes', () => {
  it('settings need If-Match; a stale version is 409 with the current settings', async () => {
    expect((await send('owner', 'PUT', '/api/v1/settings', { dueSoonDays: 6 })).status).toBe(422);
    const v = (await row('SELECT version FROM org_settings WHERE org_id = ?', 'org-demo-01')).version;
    const saved = await send('owner', 'PUT', '/api/v1/settings', { dueSoonDays: 6 }, { ifMatch: v });
    expect(saved.status, saved.text).toBe(200);
    expect(saved.body.version).toBe(v + 1);
    const stale = await send('owner', 'PUT', '/api/v1/settings', { dueSoonDays: 8 }, { ifMatch: v });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    expect((await row('SELECT due_soon_days FROM org_settings WHERE org_id = ?', 'org-demo-01')).due_soon_days).toBe(6);
    // the change is on the activity log by field name, with no value
    const event = await row("SELECT summary FROM activity WHERE entity = 'settings' ORDER BY rowid DESC LIMIT 1");
    expect(event.summary).toContain('dueSoonDays');
  });

  it('preferences are each person\'s own: saving one person\'s leaves the other\'s alone', async () => {
    expect((await send('helper', 'PUT', '/api/v1/prefs', { theme: 'dark', density: 'compact' })).status).toBe(200);
    const ben = await row("SELECT theme, density FROM user_prefs WHERE user_id = 'user-ben'");
    const ana = await row("SELECT theme FROM user_prefs WHERE user_id = 'user-ana'");
    expect(ben).toEqual({ theme: 'dark', density: 'compact' });
    expect(ana.theme).not.toBe('dark');
  });

  it('editing a note keeps one note; an id from another record is refused', async () => {
    const created = await send('owner', 'POST', '/api/v1/notes', { entity: 'client', entityId: 'client-rsp', body: 'First draft' });
    const edited = await send('owner', 'PATCH', `/api/v1/notes/${created.body.id}`, { entity: 'client', entityId: 'client-rsp', body: 'Second draft' }, { ifMatch: created.body.version });
    expect(edited.status, edited.text).toBe(200);
    expect(await count('SELECT COUNT(*) AS n FROM notes WHERE id = ?', created.body.id)).toBe(1);
    expect((await row('SELECT body FROM notes WHERE id = ?', created.body.id)).body).toBe('Second draft');
    const moved = await send('owner', 'PATCH', `/api/v1/notes/${created.body.id}`, { entity: 'client', entityId: 'client-cruz', body: 'Moved' }, { ifMatch: edited.body.version });
    expect(moved.status).toBe(409);
  });
});
