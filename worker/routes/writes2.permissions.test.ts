import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONAS, addMembership, openWorld, type World } from '../testing/world';

/**
 * U27 permission table for the remaining write routes (.claude/rules/backend.md): the owner, a helper on an assigned client,
 * a helper on an unassigned client, a revoked membership, no membership and no session. Ben (helper) is assigned to
 * client-rsp and client-cruz. As in part 1 the owner works on client-maria's records and the helper on client-rsp's.
 */
let world: World;
const cookie: Record<string, string> = {};
let n = 0;

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

type Who = 'owner' | 'helper' | 'revoked' | 'none' | 'nobody';
async function send(who: Who, method: string, path: string, body?: unknown, version?: [string, string]) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'Idempotency-Key': `perm2-key-${++n}-${crypto.randomUUID()}` };
  if (version) {
    // org settings are keyed by organization, not by id
    const row = version[0] === 'org_settings_by_org'
      ? await world.env.DB.prepare('SELECT version FROM org_settings WHERE org_id = ?').bind(version[1]).first<{ version: number }>()
      : await world.env.DB.prepare(`SELECT version FROM ${version[0]} WHERE id = ?`).bind(version[1]).first<{ version: number }>();
    headers['If-Match'] = `"${row?.version ?? 1}"`;
  }
  const res = await world.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cookie: who === 'nobody' ? undefined : cookie[who] });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, text };
}

const ids: Record<string, string> = {};
const one = async (sql: string, ...bind: unknown[]) => (await world.env.DB.prepare(sql).bind(...bind).first<any>())!;

describe('fixtures', () => {
  it('creates the records the table works on, through the API', async () => {
    const mk = async (who: 'owner' | 'helper', path: string, body: unknown, key: string) => {
      const r = await send(who, 'POST', path, body);
      expect(r.status, `${path} ${r.text}`).toBe(201);
      ids[key] = r.body.id;
    };
    const visit = (assignee: string, taskId: string) => ({ officeId: 'off-rdo39', plannedDate: '2026-11-03', arriveBy: '09:00', assigneeUserId: assignee, purpose: 'Filing at the counter', items: [{ taskId, action: 'submit' }] });
    await mk('owner', '/api/v1/visits', visit('user-ana', 'task-maria-2550q'), 'visitT');
    await mk('helper', '/api/v1/visits', visit('user-ben', 'task-rsp-0619e'), 'visitM');
    ids.itemT = (await one('SELECT id FROM visit_items WHERE visit_id = ?', ids.visitT)).id;
    ids.itemM = (await one('SELECT id FROM visit_items WHERE visit_id = ?', ids.visitM)).id;
    const fu = (clientId: string) => ({ clientId, channel: 'viber', language: 'en', expectedBy: '2026-11-05' });
    await mk('owner', '/api/v1/follow-ups', fu('client-maria'), 'fuT');
    await mk('helper', '/api/v1/follow-ups', fu('client-rsp'), 'fuM');
    const pay = (clientId: string, taskId: string) => ({ clientId, taskId, amount: 150000, paidOn: '2026-10-20', channel: 'aab_otc', paidBy: 'client' });
    await mk('owner', '/api/v1/payments', pay('client-maria', 'task-maria-2550q'), 'payT');
    await mk('helper', '/api/v1/payments', pay('client-rsp', 'task-rsp-0619e'), 'payM');
    await mk('owner', '/api/v1/payments', pay('client-maria', 'task-maria-2550q'), 'payT2');
    await mk('helper', '/api/v1/payments', pay('client-rsp', 'task-rsp-0619e'), 'payM2');
    await mk('owner', '/api/v1/notes', { entity: 'client', entityId: 'client-maria', body: 'Prefers Viber' }, 'noteT');
    await mk('helper', '/api/v1/notes', { entity: 'client', entityId: 'client-rsp', body: 'Prefers Viber' }, 'noteM');
    await mk('owner', '/api/v1/offices', { type: 'bank', name: 'Test Bank Branch' }, 'office');
    await mk('owner', '/api/v1/visit-kit', { label: 'Black pen', sortOrder: 20 }, 'kit');
    await mk('owner', '/api/v1/saved-views', { page: 'tasks', name: 'Mine', query: 'owner=me' }, 'viewOwner');
    await mk('helper', '/api/v1/saved-views', { page: 'tasks', name: 'Mine', query: 'owner=me' }, 'viewHelper');
    await mk('owner', '/api/v1/memberships', { email: 'extra.helper@example.org', role: 'helper', clientIds: ['client-rsp'], name: 'Extra Helper' }, 'membership');
  }, 180_000);
});

interface Call {
  method: string;
  path: string;
  body?: unknown;
  version?: [string, string];
}
interface Case {
  name: string;
  theirs: () => Call;
  mine?: () => Call;
  helperMine?: 'ok' | 'rule' | 'forbidden';
  ownerOk?: number[];
  /** Own data (preferences, saved views, notifications): every active member reaches it; there is no "unassigned client". */
  own?: boolean;
}

const OK = [200, 201];
const RULE = [200, 201, 404, 409, 422];

const cases: Case[] = [
  // ---- owner only
  { name: 'POST /offices', theirs: () => ({ method: 'POST', path: '/api/v1/offices', body: { type: 'lgu', name: 'City Hall Treasury' } }) },
  { name: 'PUT /offices/:id', theirs: () => ({ method: 'PUT', path: `/api/v1/offices/${ids.office}`, body: { name: 'Test Bank Main Branch' }, version: ['offices', ids.office] }) },
  { name: 'POST /visit-kit', theirs: () => ({ method: 'POST', path: '/api/v1/visit-kit', body: { label: 'Stapler', sortOrder: 21 } }) },
  { name: 'PUT /visit-kit/:id', theirs: () => ({ method: 'PUT', path: `/api/v1/visit-kit/${ids.kit}`, body: { label: 'Blue pen' }, version: ['visit_kit_items', ids.kit] }) },
  { name: 'PUT /baseline', theirs: () => ({ method: 'PUT', path: '/api/v1/baseline', body: { periodStart: '2026-01-01', periodEnd: '2026-06-30', tripsPerMonth: 12, confidence: 3 } , version: ['baselines', 'baseline-demo'] }) },
  { name: 'POST /pulses', theirs: () => ({ method: 'POST', path: '/api/v1/pulses', body: { month: '2026-10', hoursFindingLastWeek: 4, confidence: 4 } }) },
  { name: 'PUT /settings', theirs: () => ({ method: 'PUT', path: '/api/v1/settings', body: { dueSoonDays: 5 }, version: ['org_settings_by_org', 'org-demo-01'] }) },
  { name: 'POST /memberships', theirs: () => ({ method: 'POST', path: '/api/v1/memberships', body: { email: 'another@example.org', role: 'helper', clientIds: [] } }) },
  { name: 'PATCH /memberships/:id', theirs: () => ({ method: 'PATCH', path: `/api/v1/memberships/${ids.membership}`, body: { clientIds: ['client-rsp', 'client-cruz'] }, version: ['memberships', ids.membership] }) },
  { name: 'POST /memberships/:id/revoke', theirs: () => ({ method: 'POST', path: `/api/v1/memberships/${ids.membership}/revoke` }) },
  { name: 'POST /clients/import/preview', theirs: () => ({ method: 'POST', path: '/api/v1/clients/import/preview', body: { rows: [{ Name: 'Imported Co', Code: 'IMP9' }], mapping: { displayName: 'Name', code: 'Code' } } }) },
  { name: 'POST /clients/import/commit', theirs: () => ({ method: 'POST', path: '/api/v1/clients/import/commit', body: { preview: { batchId: `batch-${++n}-perm`, totalRows: 1, validRows: [{ code: 'IMP8', displayName: 'Imported Eight', entityType: 'solo', rdoCode: '039' }], errors: [] } } }) },
  { name: 'POST /clients/import/:batchId/undo', theirs: () => ({ method: 'POST', path: '/api/v1/clients/import/no-such-batch/undo' }), ownerOk: [404] },

  // ---- a client's own records
  {
    name: 'POST /follow-ups',
    theirs: () => ({ method: 'POST', path: '/api/v1/follow-ups', body: { clientId: 'client-maria', channel: 'sms', language: 'en', expectedBy: '2026-11-06' } }),
    mine: () => ({ method: 'POST', path: '/api/v1/follow-ups', body: { clientId: 'client-rsp', channel: 'sms', language: 'en', expectedBy: '2026-11-06' } }),
    helperMine: 'ok',
  },
  {
    name: 'POST /follow-ups/:id/sent',
    theirs: () => ({ method: 'POST', path: `/api/v1/follow-ups/${ids.fuT}/sent`, body: { channel: 'viber', sentAt: '2026-10-27T09:00:00+08:00', expectedBy: '2026-11-02', message: 'Good day, kindly send the documents' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/follow-ups/${ids.fuM}/sent`, body: { channel: 'viber', sentAt: '2026-10-27T09:00:00+08:00', expectedBy: '2026-11-02', message: 'Good day, kindly send the documents' } }),
    helperMine: 'ok',
  },
  {
    name: 'POST /follow-ups/:id/response',
    theirs: () => ({ method: 'POST', path: `/api/v1/follow-ups/${ids.fuT}/response`, body: { text: 'Client replied on Viber', receivedLineIds: [] } }),
    mine: () => ({ method: 'POST', path: `/api/v1/follow-ups/${ids.fuM}/response`, body: { text: 'Client replied on Viber', receivedLineIds: [] } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /follow-ups/:id/escalate',
    theirs: () => ({ method: 'POST', path: `/api/v1/follow-ups/${ids.fuT}/escalate`, body: { reason: 'No answer after three attempts' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/follow-ups/${ids.fuM}/escalate`, body: { reason: 'No answer after three attempts' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /follow-ups/:id/resolve',
    theirs: () => ({ method: 'POST', path: `/api/v1/follow-ups/${ids.fuT}/resolve`, body: { reason: 'Documents received in full' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/follow-ups/${ids.fuM}/resolve`, body: { reason: 'Documents received in full' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /visits',
    theirs: () => ({ method: 'POST', path: '/api/v1/visits', body: { officeId: 'off-rdo39', plannedDate: '2026-11-10', arriveBy: '09:00', assigneeUserId: 'user-ana', purpose: 'Another trip', items: [{ taskId: 'task-maria-2550q', action: 'submit' }] } }),
    mine: () => ({ method: 'POST', path: '/api/v1/visits', body: { officeId: 'off-rdo39', plannedDate: '2026-11-10', arriveBy: '09:00', assigneeUserId: 'user-ben', purpose: 'Another trip', items: [{ taskId: 'task-rsp-0619e', action: 'submit' }] } }),
    helperMine: 'ok',
  },
  {
    name: 'PATCH /visits/:id',
    theirs: () => ({ method: 'PATCH', path: `/api/v1/visits/${ids.visitT}`, body: { plannedDate: '2026-11-04' }, version: ['visits', ids.visitT] }),
    mine: () => ({ method: 'PATCH', path: `/api/v1/visits/${ids.visitM}`, body: { plannedDate: '2026-11-04' }, version: ['visits', ids.visitM] }),
    helperMine: 'ok',
  },
  {
    name: 'POST /visits/:id/items',
    theirs: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitT}/items`, body: { taskId: 'task-maria-2550q', action: 'pay' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitM}/items`, body: { taskId: 'task-rsp-1601eq', action: 'submit' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'PATCH /visits/:id/items/:itemId',
    theirs: () => ({ method: 'PATCH', path: `/api/v1/visits/${ids.visitT}/items/${ids.itemT}`, body: { questions: 'Ask about the stamp' }, version: ['visit_items', ids.itemT] }),
    mine: () => ({ method: 'PATCH', path: `/api/v1/visits/${ids.visitM}/items/${ids.itemM}`, body: { questions: 'Ask about the stamp' }, version: ['visit_items', ids.itemM] }),
    helperMine: 'ok',
  },
  {
    name: 'PUT /visits/:id/packed',
    theirs: () => ({ method: 'PUT', path: `/api/v1/visits/${ids.visitT}/packed`, body: { kitItemId: 'kit-stapler', packed: true } }),
    mine: () => ({ method: 'PUT', path: `/api/v1/visits/${ids.visitM}/packed`, body: { kitItemId: 'kit-stapler', packed: true } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /visits/:id/start',
    theirs: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitT}/start`, body: { leaveAnywayReason: 'Client needs it filed today' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitM}/start`, body: { leaveAnywayReason: 'Client needs it filed today' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /visits/:id/items/:itemId/outcome',
    theirs: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitT}/items/${ids.itemT}/outcome`, body: { outcome: 'completed', evidenceDocumentIds: [] } }),
    mine: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitM}/items/${ids.itemM}/outcome`, body: { outcome: 'completed', evidenceDocumentIds: [] } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /visits/:id/finish',
    theirs: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitT}/finish`, body: { finishedAt: '2026-11-04T15:00:00+08:00' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitM}/finish`, body: { finishedAt: '2026-11-04T15:00:00+08:00' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /visits/:id/cancel',
    theirs: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitT}/cancel`, body: { reason: 'Office closed for the day' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/visits/${ids.visitM}/cancel`, body: { reason: 'Office closed for the day' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'DELETE /visits/:id/items/:itemId',
    theirs: () => ({ method: 'DELETE', path: `/api/v1/visits/${ids.visitT}/items/${ids.itemT}` }),
    mine: () => ({ method: 'DELETE', path: `/api/v1/visits/${ids.visitM}/items/${ids.itemM}` }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /payments',
    theirs: () => ({ method: 'POST', path: '/api/v1/payments', body: { clientId: 'client-maria', taskId: 'task-maria-2550q', amount: 250000, paidOn: '2026-10-21', channel: 'online', paidBy: 'client' } }),
    mine: () => ({ method: 'POST', path: '/api/v1/payments', body: { clientId: 'client-rsp', taskId: 'task-rsp-0619e', amount: 250000, paidOn: '2026-10-21', channel: 'online', paidBy: 'client' } }),
    helperMine: 'ok',
  },
  {
    name: 'PATCH /payments/:id',
    theirs: () => ({ method: 'PATCH', path: `/api/v1/payments/${ids.payT}`, body: { note: 'Receipt to follow' }, version: ['payments', ids.payT] }),
    mine: () => ({ method: 'PATCH', path: `/api/v1/payments/${ids.payM}`, body: { note: 'Receipt to follow' }, version: ['payments', ids.payM] }),
    helperMine: 'ok',
  },
  {
    name: 'DELETE /payments/:id',
    theirs: () => ({ method: 'DELETE', path: `/api/v1/payments/${ids.payT2}`, body: { reason: 'Recorded twice by mistake' } }),
    mine: () => ({ method: 'DELETE', path: `/api/v1/payments/${ids.payM2}`, body: { reason: 'Recorded twice by mistake' } }),
    helperMine: 'ok',
  },
  {
    name: 'POST /notes',
    theirs: () => ({ method: 'POST', path: '/api/v1/notes', body: { entity: 'client', entityId: 'client-maria', body: 'Call after lunch' } }),
    mine: () => ({ method: 'POST', path: '/api/v1/notes', body: { entity: 'client', entityId: 'client-rsp', body: 'Call after lunch' } }),
    helperMine: 'ok',
  },
  {
    name: 'PATCH /notes/:id',
    theirs: () => ({ method: 'PATCH', path: `/api/v1/notes/${ids.noteT}`, body: { entity: 'client', entityId: 'client-maria', body: 'Prefers Viber, after lunch' }, version: ['notes', ids.noteT] }),
    mine: () => ({ method: 'PATCH', path: `/api/v1/notes/${ids.noteM}`, body: { entity: 'client', entityId: 'client-rsp', body: 'Prefers Viber, after lunch' }, version: ['notes', ids.noteM] }),
    helperMine: 'ok',
  },

  // ---- own data: every active member
  { name: 'POST /saved-views', own: true, theirs: () => ({ method: 'POST', path: '/api/v1/saved-views', body: { page: 'clients', name: 'Active', query: 'status=active' } }) },
  { name: 'PUT /saved-views/:id', own: true, theirs: () => ({ method: 'PUT', path: `/api/v1/saved-views/${ids.viewOwner}`, body: { name: 'Mine, renamed' }, version: ['saved_views', ids.viewOwner] }), mine: () => ({ method: 'PUT', path: `/api/v1/saved-views/${ids.viewHelper}`, body: { name: 'Mine, renamed' }, version: ['saved_views', ids.viewHelper] }) },
  { name: 'DELETE /saved-views/:id', own: true, theirs: () => ({ method: 'DELETE', path: `/api/v1/saved-views/${ids.viewOwner}` }), mine: () => ({ method: 'DELETE', path: `/api/v1/saved-views/${ids.viewHelper}` }) },
  { name: 'POST /notifications/read', own: true, theirs: () => ({ method: 'POST', path: '/api/v1/notifications/read', body: { all: true } }) },
  { name: 'PUT /prefs', own: true, theirs: () => ({ method: 'PUT', path: '/api/v1/prefs', body: { theme: 'dark' } }) },
];

const ownerOnly = (c: Case) => !c.mine && !c.own;

describe('no membership, a revoked membership and no session reach no write route', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const call = c.theirs();
      const none = await send('none', call.method, call.path, call.body, call.version);
      expect(none.status, 'no membership').toBe(403);
      expect(none.body.error.code).toBe('ACCESS_PENDING');
      const revoked = await send('revoked', call.method, call.path, call.body, call.version);
      expect(revoked.status, 'revoked membership').toBe(403);
      expect(revoked.body.error.code).toBe('FORBIDDEN');
      expect((await send('nobody', call.method, call.path, call.body, call.version)).status, 'no session').toBe(401);
    });
  }
});

describe('a helper: his own clients as the route allows, never an unassigned client, never an owner-only route', () => {
  for (const c of cases) {
    it(c.name, async () => {
      if (c.own) {
        const mine = (c.mine ?? c.theirs)();
        const res = await send('helper', mine.method, mine.path, mine.body, mine.version);
        expect(OK, `${res.status} ${res.text.slice(0, 200)}`).toContain(res.status);
        return;
      }
      const theirs = c.theirs();
      const refused = await send('helper', theirs.method, theirs.path, theirs.body, theirs.version);
      expect(refused.status, `helper on ${theirs.path}: ${refused.text.slice(0, 160)}`).toBe(403);
      if (ownerOnly(c)) return;
      const mine = c.mine!();
      const res = await send('helper', mine.method, mine.path, mine.body, mine.version);
      if (c.helperMine === 'forbidden') expect(res.status, res.text.slice(0, 160)).toBe(403);
      else if (c.helperMine === 'ok') expect(OK, `${res.status} ${res.text.slice(0, 200)}`).toContain(res.status);
      else expect(RULE, `${res.status} ${res.text.slice(0, 200)}`).toContain(res.status);
    });
  }
});

describe('the owner reaches every write route (last: the helper refusals above need the records untouched)', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const call = c.theirs();
      const res = await send('owner', call.method, call.path, call.body, call.version);
      expect(c.ownerOk ?? OK, `${res.status} ${res.text.slice(0, 200)}`).toContain(res.status);
    });
  }
});
