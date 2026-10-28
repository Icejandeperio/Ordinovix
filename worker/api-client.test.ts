import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApiRepositories } from '@/data/api/repositories';
import type { Repositories } from '@/data/repositories';
import { AccessPendingError, ForbiddenError, NotFoundError, UnauthenticatedError, ValidationError, VersionConflictError, classifyError } from '@/domain/errors';
import { RuleViolationError } from '@/domain/rules';
import { PERSONAS, TEST_ORIGIN, openWorld, type World } from './testing/world';

/**
 * U30: the API data source against the real Worker app, in-process (no network). The client turns each Repositories call into one
 * request, follows pages, sends If-Match and the Idempotency-Key, and turns an error answer into the typed error the screens handle.
 */
let world: World;
let owner: Repositories;
let helper: Repositories;
let stranger: Repositories;
let nobody: Repositories;

/** A fetch that goes straight into the Worker app, with a person's cookie. */
const asPerson = (cookie?: string): typeof fetch =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (cookie) headers.set('Cookie', cookie);
    return world.app.request(`${TEST_ORIGIN}${String(input)}`, { ...init, headers }, world.env);
  }) as typeof fetch;

beforeAll(async () => {
  world = await openWorld();
  owner = createApiRepositories(asPerson(await world.cookieFor(PERSONAS.owner)));
  helper = createApiRepositories(asPerson(await world.cookieFor(PERSONAS.helper)));
  stranger = createApiRepositories(asPerson(await world.cookieFor({ id: 'ba-stranger', name: 'Sam Stranger', email: 'stranger@example.com' })));
  nobody = createApiRepositories(asPerson());
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

const rejection = async (p: Promise<unknown>) => p.then(() => undefined, (e) => e as Error);

describe('reads', () => {
  it('returns what the mock returns: the session, a list, one record', async () => {
    const me = await owner.session.me();
    expect(me.membership).toMatchObject({ role: 'owner', orgId: 'org-demo-01' });
    expect(me.settings.orgId).toBe('org-demo-01');
    const clients = await owner.clients.list();
    expect(clients.items.length).toBeGreaterThan(5);
    expect((await owner.clients.get('client-rsp')).client.code).toBe('RSP');
  });

  it('follows the pages to the end, so a screen gets the whole list', async () => {
    const tasks = await owner.tasks.list();
    expect(tasks.items.length).toBe(tasks.total);
    expect(tasks.total).toBeGreaterThan(100); // the API pages at 100
    expect(new Set(tasks.items.map((t) => t.task.id)).size).toBe(tasks.total);
  });

  it('turns filters into query parameters, arrays and booleans included', async () => {
    const rsp = await owner.tasks.list({ clientId: 'client-rsp' });
    expect(rsp.items.length).toBeGreaterThan(0);
    expect(rsp.items.every((t) => t.task.clientId === 'client-rsp')).toBe(true);
    const blocked = await owner.tasks.list({ statusGroup: 'blocked' });
    expect(blocked.items.every((t) => t.statusGroup === 'blocked')).toBe(true);
    const found = await owner.tasks.list({ search: 'horizon' });
    expect(found.items.length).toBeGreaterThan(0);
    expect(found.items.length).toBeLessThan((await owner.tasks.list()).items.length);
    expect(found.items.every((t) => t.client.displayName.toLowerCase().includes('horizon') || (t.task.title ?? '').toLowerCase().includes('horizon'))).toBe(true);
  });

  it('keeps the extra fields of a page (the payments total) and the other read shapes', async () => {
    const payments = await owner.payments.list();
    expect(typeof payments.totalAmount).toBe('number');
    expect(await owner.notifications.unreadCount()).toBeGreaterThanOrEqual(0);
    expect((await owner.search.query('horizon')).clients.length).toBeGreaterThan(0);
    expect((await owner.insights.get('overview')).firstPassRate).toBeTypeOf('number');
    expect(Array.isArray(await owner.calendar.range('2026-10-01', '2026-10-31'))).toBe(true);
    expect((await owner.today.queue('everyone')).focusDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('downloads exports as files', async () => {
    const csv = await owner.reports.exportCsv('clients');
    expect(csv).toBeInstanceOf(Blob);
    expect(await csv.text()).toContain('Entity');
    expect((await owner.reports.fullBackup()).type).toContain('json');
  });
});

describe('writes', () => {
  it('creates, then updates with the loaded version, and a stale version is a VersionConflictError carrying the current record', async () => {
    const created = await owner.clients.upsert({ code: 'APIC', displayName: 'Api Client Co', entityType: 'solo', rdoCode: '039' });
    expect(created.id).toBeTruthy();
    const updated = await owner.clients.upsert({ id: created.id, version: created.version, displayName: 'Api Client Renamed' });
    expect(updated.version).toBe(created.version + 1);
    const stale = await rejection(owner.clients.upsert({ id: created.id, version: created.version, displayName: 'Too late' }));
    expect(stale).toBeInstanceOf(VersionConflictError);
    expect((stale as VersionConflictError).current).toMatchObject({ id: created.id, displayName: 'Api Client Renamed' });
    expect(classifyError(stale)).toBe('conflict');
  });

  it('an update that names no version still goes through (If-Match: *), like the mock', async () => {
    const task = (await owner.tasks.list({ clientId: 'client-maria' })).items[0].task;
    const saved = await owner.tasks.update(task.id, { notes: 'Called the client' });
    expect(saved.notes).toBe('Called the client');
  });

  it('sends the offline queue\'s idempotency key as the Idempotency-Key, so a replay is applied once', async () => {
    const note = { entity: 'client' as const, entityId: 'client-rsp', body: 'Queued while offline' };
    const first = await (owner.notes.save as unknown as (n: unknown, o: unknown) => Promise<{ id: string }>)(note, { idempotencyKey: 'queue-key-0001' });
    const again = await (owner.notes.save as unknown as (n: unknown, o: unknown) => Promise<{ id: string }>)(note, { idempotencyKey: 'queue-key-0001' });
    expect(again.id).toBe(first.id);
    expect((await owner.notes.list('client', 'client-rsp')).filter((n) => n.body === note.body)).toHaveLength(1);
  });

  it('a write with a body the shapes do not allow never leaves the client carrying the record\'s own bookkeeping fields', async () => {
    const full = (await owner.clients.get('client-cruz')).client;
    // a whole record, as a screen may hold it: id, org, stamps and version are the server's, not part of the body
    const saved = await owner.clients.upsert({ ...full, displayName: 'Cruz Salon & Co' });
    expect(saved.displayName).toBe('Cruz Salon & Co');
  });

  it('visit items and outcomes, whose routes name the item, not the visit', async () => {
    const visit = await owner.visits.create({ officeId: 'off-rdo39', plannedDate: '2026-11-03', arriveBy: '09:00', assigneeUserId: 'user-ana', purpose: 'Counter' }, [{ taskId: 'task-maria-2550q', action: 'submit' }]);
    const detail = await owner.visits.get(visit.id);
    const item = detail.items[0].item;
    const updated = await owner.visits.updateItem(item.id, { version: item.version, questions: 'Ask about the stamp' });
    expect(updated.questions).toBe('Ask about the stamp');
    await owner.visits.start(visit.id, 'Client needs it filed today');
    const outcome = await owner.visits.recordOutcome(item.id, { outcome: 'completed', evidenceDocumentIds: [] });
    expect(outcome.outcome).toBe('completed');
  });

  it('uploads a file as multipart and opens it through the signed URL', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4\n% via the client\n%%EOF\n');
    const doc = await owner.documents.upload(
      { clientId: 'client-maria', kind: 'source', source: 'upload' },
      new Blob([bytes], { type: 'application/pdf' }),
      undefined,
      { originalName: 'scan.pdf', originalSizeBytes: bytes.length, sha256: 'ignored-by-the-server' },
    );
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(doc.sha256).not.toBe('ignored-by-the-server');
    const url = await owner.documents.getUrl(doc.id, 'view');
    const res = await asPerson()(url); // no cookie: the signature is the proof
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it('void methods resolve to nothing, and a revoke-style call needs no body', async () => {
    const created = await owner.holidays.save({ date: '2027-01-02', name: 'Test day', type: 'local' });
    expect(await owner.holidays.remove(created.id)).toBeUndefined();
  });
});

describe('errors become the typed errors the screens handle', () => {
  it('FORBIDDEN, NOT_FOUND, VALIDATION and RULE_VIOLATION', async () => {
    const forbidden = await rejection(helper.clients.get('client-maria'));
    expect(forbidden).toBeInstanceOf(ForbiddenError);
    expect(classifyError(forbidden)).toBe('forbidden');
    const missing = await rejection(owner.tasks.get('no-such-task'));
    expect(missing).toBeInstanceOf(NotFoundError);
    expect(classifyError(missing)).toBe('not_found');
    const invalid = await rejection(owner.clients.upsert({ code: 'x', displayName: 'a', entityType: 'solo', rdoCode: '039' }));
    expect(invalid).toBeInstanceOf(ValidationError);
    expect(Object.keys((invalid as ValidationError).fieldErrors)).toEqual(expect.arrayContaining(['displayName', 'code']));
    expect(classifyError(invalid)).toBe('validation');
    const rule = await rejection(owner.tasks.setStatus('task-rsp-0619e', 'completed'));
    expect(rule).toBeInstanceOf(RuleViolationError);
  });

  it('a helper is refused an owner-only call with the same error the mock gives', async () => {
    expect(await rejection(helper.memberships.list())).toBeInstanceOf(ForbiddenError);
    expect(await rejection(helper.settings.save({ dueSoonDays: 5 }))).toBeInstanceOf(ForbiddenError);
  });

  it('no session is UnauthenticatedError; signed in without a membership is AccessPendingError', async () => {
    expect(await rejection(nobody.session.me())).toBeInstanceOf(UnauthenticatedError);
    const pending = await rejection(stranger.session.me());
    expect(pending).toBeInstanceOf(AccessPendingError);
    expect((pending as AccessPendingError).code).toBe('ACCESS_PENDING');
  });

  it('an answer from the edge, not the Worker (an HTML 502/500), is sent again with the same Idempotency-Key; a JSON error is not', async () => {
    const seen: Array<string | null> = [];
    let calls = 0;
    const flaky = createApiRepositories((async (_url: string, init: RequestInit) => {
      calls++;
      seen.push(new Headers(init.headers).get('Idempotency-Key'));
      if (calls <= 2) return new Response('<html>Bad gateway</html>', { status: calls === 1 ? 502 : 500, headers: { 'content-type': 'text/html' } });
      return Response.json({ ok: true });
    }) as unknown as typeof fetch);
    await flaky.settings.save({ dueSoonDays: 5 } as never);
    expect(calls).toBe(3);
    expect(new Set(seen).size).toBe(1);

    let jsonCalls = 0;
    const refusing = createApiRepositories((async () => {
      jsonCalls++;
      return Response.json({ error: { code: 'RULE_VIOLATION', message: 'No' } }, { status: 500 });
    }) as unknown as typeof fetch);
    expect(await rejection(refusing.session.me())).toBeInstanceOf(RuleViolationError);
    expect(jsonCalls).toBe(1);

    let always = 0;
    const down = createApiRepositories((async () => {
      always++;
      return new Response('down', { status: 503 });
    }) as unknown as typeof fetch);
    expect(await rejection(down.session.me())).toBeInstanceOf(Error);
    expect(always).toBe(3); // the first try and two more, then the error
  });

  it('a network failure says so in words the offline queue recognizes', async () => {
    const broken = createApiRepositories((async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch);
    const error = await rejection(broken.session.me());
    expect(error?.message).toMatch(/network/i);
    expect(classifyError(error)).toBe('offline');
  });
});
