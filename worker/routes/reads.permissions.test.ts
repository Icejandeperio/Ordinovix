import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONAS, addMembership, openWorld, type World } from '../testing/world';

/**
 * U25 permission table for every read route, as .claude/rules/backend.md asks: the owner, a helper on an assigned client,
 * a helper on an unassigned client, a revoked membership and no membership. Ben (helper) is assigned to client-rsp and
 * client-cruz only.
 */
let world: World;
const cookie: Record<string, string> = {};

const UNASSIGNED = ['client-maria', 'client-horizon', 'client-vtl', 'client-bol', 'client-amd', 'client-jra'];

beforeAll(async () => {
  world = await openWorld();
  cookie.owner = await world.cookieFor(PERSONAS.owner);
  cookie.helper = await world.cookieFor(PERSONAS.helper);
  await addMembership(world, { id: 'mem-rev', email: 'rev@example.com', role: 'helper', userId: 'user-rev', active: false, revoked: true, clientIds: ['client-rsp'] });
  cookie.revoked = await world.cookieFor({ id: 'user-rev', name: 'Rev Oked', email: 'rev@example.com' });
  cookie.none = await world.cookieFor({ id: 'ba-none', name: 'No Member', email: 'none@example.com' });
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

const call = async (path: string, who: keyof typeof cookie) => {
  const res = await world.request(path, { cookie: cookie[who] });
  const text = await res.text();
  return { status: res.status, text, code: (() => { try { return JSON.parse(text)?.error?.code as string | undefined; } catch { return undefined; } })() };
};

/** Routes any active member may call. The helper sees the same route but only assigned clients' records. */
const OPEN: string[] = [
  '/api/v1/today',
  '/api/v1/calendar?from=2026-10-01&to=2026-11-30',
  '/api/v1/search?q=a',
  '/api/v1/insights/overview',
  '/api/v1/insights/trips',
  '/api/v1/insights/chasing',
  '/api/v1/insights/deadlines',
  '/api/v1/insights/workload',
  '/api/v1/insights/clients',
  '/api/v1/baseline',
  '/api/v1/pulses',
  '/api/v1/clients',
  '/api/v1/templates',
  '/api/v1/templates/tmpl-0619e',
  '/api/v1/deadline-moves',
  '/api/v1/holidays?year=2026',
  '/api/v1/messages',
  '/api/v1/tasks',
  '/api/v1/tasks/board',
  '/api/v1/documents',
  '/api/v1/follow-ups',
  '/api/v1/offices',
  '/api/v1/offices/off-rdo39',
  '/api/v1/visits',
  '/api/v1/visit-kit',
  '/api/v1/payments',
  '/api/v1/saved-views?page=tasks',
  '/api/v1/notifications',
  '/api/v1/notifications/unread-count',
  '/api/v1/session/me',
];

/** Routes keyed on one client's record: fine for the assigned client, FORBIDDEN for the helper on another. */
const BY_CLIENT: Array<{ route: string; mine: string; theirs: string }> = [
  { route: 'clients.get', mine: '/api/v1/clients/client-rsp', theirs: '/api/v1/clients/client-maria' },
  { route: 'contacts.listByClient', mine: '/api/v1/clients/client-rsp/contacts', theirs: '/api/v1/clients/client-maria/contacts' },
  { route: 'authorizations.listByClient', mine: '/api/v1/clients/client-rsp/authorizations', theirs: '/api/v1/clients/client-maria/authorizations' },
  { route: 'tasks.get', mine: '/api/v1/tasks/task-rsp-0619e', theirs: '/api/v1/tasks/task-maria-2550q' },
  { route: 'lines.history', mine: '/api/v1/lines/line-rsp-1/history', theirs: '/api/v1/lines/line-maria-1/history' },
  { route: 'follow-ups.get', mine: '/api/v1/follow-ups/fu-rsp-2307', theirs: '/api/v1/follow-ups/fu-maria-resolved' },
  { route: 'notes.list', mine: '/api/v1/notes?entity=client&entityId=client-rsp', theirs: '/api/v1/notes?entity=client&entityId=client-maria' },
  { route: 'reports.clientChecklist', mine: '/api/v1/reports/client-checklist/client-rsp', theirs: '/api/v1/reports/client-checklist/client-maria' },
  { route: 'reports.clientHistory', mine: '/api/v1/reports/client-history/client-rsp?year=2026', theirs: '/api/v1/reports/client-history/client-maria?year=2026' },
  { route: 'documents.findBySha', mine: '/api/v1/documents/by-sha?sha256=abc&clientId=client-rsp', theirs: '/api/v1/documents/by-sha?sha256=abc&clientId=client-maria' },
  { route: 'activity.list', mine: '/api/v1/activity?clientId=client-rsp', theirs: '/api/v1/activity?clientId=client-maria' },
  { route: 'visits.get', mine: '/api/v1/visits/visit-today', theirs: '/api/v1/visits/visit-v3' },
  { route: 'visits.suggestTasks', mine: '/api/v1/visits/visit-today/suggestions', theirs: '/api/v1/visits/visit-v3/suggestions' },
];

// the practice-wide audit log (no client filter) is the owner's; a helper reads the events of an assigned client
const OWNER_ONLY = ['/api/v1/reports/monthly-summary?month=2026-10', '/api/v1/reports/export/clients.csv', '/api/v1/reports/backup', '/api/v1/activity', '/api/v1/memberships'];

describe('every read route: no membership and a revoked membership', () => {
  for (const path of [...OPEN, ...BY_CLIENT.map((r) => r.mine), ...OWNER_ONLY]) {
    it(`${path}`, async () => {
      const none = await call(path, 'none');
      expect(none.status, 'no membership').toBe(403);
      expect(none.code).toBe('ACCESS_PENDING');
      const revoked = await call(path, 'revoked');
      expect(revoked.status, 'revoked membership').toBe(403);
      expect(revoked.code).toBe('FORBIDDEN');
      // no data in either answer, not even an id the revoked helper used to be assigned
      expect(revoked.text).not.toContain('client-rsp');
      expect((await world.request(path)).status, 'no session').toBe(401);
    });
  }
});

describe('open routes: the owner gets them, the helper gets them without unassigned clients', () => {
  for (const path of OPEN) {
    it(`${path}`, async () => {
      const owner = await call(path, 'owner');
      expect(owner.status, `owner ${owner.text.slice(0, 120)}`).toBe(200);
      const helper = await call(path, 'helper');
      expect(helper.status, `helper ${helper.text.slice(0, 120)}`).toBe(200);
      for (const id of UNASSIGNED) {
        expect(helper.text, `${id} must not appear in the helper's answer`).not.toContain(`"${id}"`);
      }
    });
  }
});

describe('routes keyed on a client: assigned is fine, unassigned is FORBIDDEN, the owner reaches both', () => {
  for (const r of BY_CLIENT) {
    it(r.route, async () => {
      expect((await call(r.mine, 'owner')).status, 'owner mine').toBe(200);
      expect((await call(r.theirs, 'owner')).status, 'owner theirs').toBe(200);
      expect((await call(r.mine, 'helper')).status, 'helper on an assigned client').toBe(200);
      const theirs = await call(r.theirs, 'helper');
      expect(theirs.status, 'helper on an unassigned client').toBe(403);
      expect(theirs.code).toBe('FORBIDDEN');
    });
  }

  it('a list filtered to an unassigned client is empty or refused for the helper, never their records', async () => {
    for (const path of ['/api/v1/tasks?clientId=client-maria', '/api/v1/documents?clientId=client-maria', '/api/v1/payments?clientId=client-maria', '/api/v1/follow-ups?clientId=client-maria']) {
      const res = await call(path, 'helper');
      expect([200, 403], path).toContain(res.status);
      if (res.status === 200) expect((JSON.parse(res.text) as { items: unknown[] }).items, path).toEqual([]);
    }
  });
});

describe('owner-only reads', () => {
  for (const path of OWNER_ONLY) {
    it(path, async () => {
      expect((await call(path, 'owner')).status).toBe(200);
      const helper = await call(path, 'helper');
      expect(helper.status).toBe(403);
      expect(helper.code).toBe('FORBIDDEN');
    });
  }
});

describe('pagination (cursor, at most 100 per page)', () => {
  it('caps the page at 100 and follows nextCursor to the end without repeats', async () => {
    const first = JSON.parse((await call('/api/v1/tasks?limit=1000', 'owner')).text);
    expect(first.items.length).toBeLessThanOrEqual(100);
    expect(first.total).toBeGreaterThan(100);
    expect(first.nextCursor).toBeTruthy();
    const seen = new Set<string>(first.items.map((i: any) => i.task.id));
    let cursor: string | undefined = first.nextCursor;
    while (cursor) {
      const page = JSON.parse((await call(`/api/v1/tasks?limit=40&cursor=${encodeURIComponent(cursor)}`, 'owner')).text);
      for (const i of page.items) {
        expect(seen.has(i.task.id), `repeat ${i.task.id}`).toBe(false);
        seen.add(i.task.id);
      }
      cursor = page.nextCursor;
    }
    expect(seen.size).toBe(first.total);
  });

  it('refuses a cursor that is not one of ours', async () => {
    expect((await call('/api/v1/tasks?cursor=%25%25', 'owner')).status).toBeGreaterThanOrEqual(400);
  });
});

describe('no full TIN, ciphertext or hash leaves the API', () => {
  it('is absent from the backup, the client routes and the memberships', async () => {
    for (const path of ['/api/v1/reports/backup', '/api/v1/clients', '/api/v1/clients/client-rsp', '/api/v1/reports/client-checklist/client-rsp', '/api/v1/memberships', '/api/v1/session/me']) {
      const { status, text } = await call(path, 'owner');
      expect(status, path).toBe(200);
      expect(text, path).not.toMatch(/tinFull|tin_full|tinEncrypted|tin_encrypted|tinHash|tin_hash/);
      expect(text, path).not.toMatch(/(?<!\d)\d{3}-\d{3}-\d{3}-\d{3,5}(?!\d)/);
    }
  });
});
