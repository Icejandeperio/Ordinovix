import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONAS, addMembership, openWorld, type World } from '../testing/world';

/**
 * U26 permission table for every write route (.claude/rules/backend.md): the owner, a helper on an assigned client, a helper
 * on an unassigned client, a revoked membership, no membership and no session. Ben (helper) is assigned to client-rsp and
 * client-cruz. The owner works on the unassigned client's records (client-maria), the helper on his own (client-rsp), so one
 * run cannot undo the other; a helper's attempt on client-maria records is always FORBIDDEN, whatever the owner did before.
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
  const headers: Record<string, string> = { 'content-type': 'application/json', 'Idempotency-Key': `perm-key-${++n}-${crypto.randomUUID()}` };
  if (version) {
    const row = await world.env.DB.prepare(`SELECT version FROM ${version[0]} WHERE id = ?`).bind(version[1]).first<{ version: number }>();
    headers['If-Match'] = `"${row?.version ?? 1}"`;
  }
  const res = await world.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cookie: who === 'nobody' ? undefined : cookie[who] });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, text };
}

// ids created through the API in beforeAll-style steps (the first tests of this file)
const ids: Record<string, string> = {};
const t = {
  // Maria (unassigned to Ben) and RSP (assigned): one of each, created by the owner
  clientMariaTask: 'task-maria-2550q',
  clientRspTask: 'task-rsp-0619e',
};

describe('fixtures', () => {
  it('creates the records the table works on', async () => {
    const mk = async (path: string, body: unknown, key: string) => {
      const r = await send('owner', 'POST', path, body);
      expect(r.status, `${path} ${r.text}`).toBe(201);
      ids[key] = r.body.id;
    };
    await mk('/api/v1/contacts', { clientId: 'client-maria', name: 'Maria Contact', phoneE164: '+639171112222' }, 'contactMaria');
    await mk('/api/v1/contacts', { clientId: 'client-rsp', name: 'Rsp Contact', phoneE164: '+639173334444' }, 'contactRsp');
    const auth = (clientId: string) => ({ clientId, type: 'spa', scope: ['filing'], granteeUserId: 'user-ben', issuedOn: '2026-10-01', notarized: false });
    await mk('/api/v1/authorizations', auth('client-maria'), 'authMaria');
    await mk('/api/v1/authorizations', auth('client-rsp'), 'authRsp');
    await mk('/api/v1/authorizations', auth('client-cruz'), 'authCruz');
    await mk('/api/v1/deadline-moves', { templateId: 'tmpl-0619e', period: '2026-12', newDueDate: '2027-01-12', sourceRef: 'RMC 99-2026' }, 'move');
    await mk('/api/v1/holidays', { date: '2026-12-31', name: 'Last day', type: 'special_non_working' }, 'holiday');
    await mk('/api/v1/messages', { name: 'Gentle reminder', language: 'en', purpose: 'reminder', body: 'Hello {{contact}}' }, 'message');
  }, 120_000);
});

interface Call {
  method: string;
  path: string;
  body?: unknown;
  version?: [string, string];
}
interface Case {
  name: string;
  /** The owner's call, on the unassigned client's records (or the practice-wide record). */
  theirs: () => Call;
  /** The helper's call on his own client's records; absent when the route is owner-only. */
  mine?: () => Call;
  /** What the helper gets on his own client: ok = a success, rule = success or a business-rule refusal, forbidden = 403. */
  helperMine?: 'ok' | 'rule' | 'forbidden';
  /** The owner's answers that count as reaching the route (default 200 or 201). */
  ownerOk?: number[];
}

const OK = [200, 201];
const RULE = [200, 201, 404, 409];

const cases: Case[] = [
  // ---- practice-wide, owner only
  { name: 'POST /clients', theirs: () => ({ method: 'POST', path: '/api/v1/clients', body: { code: 'NEWC', displayName: 'New Client Co', entityType: 'gpp', rdoCode: '039' } }) },
  { name: 'POST /clients/duplicates', theirs: () => ({ method: 'POST', path: '/api/v1/clients/duplicates', body: { code: 'RSP' } }) },
  { name: 'POST /templates', theirs: () => ({ method: 'POST', path: '/api/v1/templates', body: { code: 'CUSTOM-1', name: 'Custom filing', kind: 'filing', frequency: 'monthly' } }) },
  { name: 'PUT /templates/:id', theirs: () => ({ method: 'PUT', path: '/api/v1/templates/tmpl-0619e', body: { name: 'Renamed template' }, version: ['task_templates', 'tmpl-0619e'] }) },
  { name: 'POST /templates/:id/verify', theirs: () => ({ method: 'POST', path: '/api/v1/templates/tmpl-0619e/verify', body: { sourceRef: 'RR 1-2020', verifiedOn: '2026-10-27' } }) },
  { name: 'POST /deadline-moves', theirs: () => ({ method: 'POST', path: '/api/v1/deadline-moves', body: { templateId: 'tmpl-0619e', period: '2026-11', newDueDate: '2026-12-15', sourceRef: 'RMC 100-2026' } }) },
  { name: 'DELETE /deadline-moves/:id', theirs: () => ({ method: 'DELETE', path: `/api/v1/deadline-moves/${ids.move}`, body: { reason: 'Superseded by a newer memorandum' } }) },
  { name: 'POST /holidays', theirs: () => ({ method: 'POST', path: '/api/v1/holidays', body: { date: '2026-12-30', name: 'Rizal Day', type: 'regular' } }) },
  { name: 'PUT /holidays/:id', theirs: () => ({ method: 'PUT', path: `/api/v1/holidays/${ids.holiday}`, body: { name: 'New Year Eve' }, version: ['holidays', ids.holiday] }) },
  { name: 'DELETE /holidays/:id', theirs: () => ({ method: 'DELETE', path: `/api/v1/holidays/${ids.holiday}` }) },
  { name: 'POST /messages', theirs: () => ({ method: 'POST', path: '/api/v1/messages', body: { name: 'Second reminder', language: 'fil', purpose: 'reminder', body: 'Kumusta {{contact}}' } }) },
  { name: 'PUT /messages/:id', theirs: () => ({ method: 'PUT', path: `/api/v1/messages/${ids.message}`, body: { body: 'Hi {{contact}}, a gentle reminder' }, version: ['message_templates', ids.message] }) },
  { name: 'POST /tasks/open-period/preview', theirs: () => ({ method: 'POST', path: '/api/v1/tasks/open-period/preview', body: { period: '2026-10', clientIds: ['client-rsp'] } }) },
  { name: 'POST /tasks/open-period', theirs: () => ({ method: 'POST', path: '/api/v1/tasks/open-period', body: { period: '2026-11', selections: [] } }) },
  { name: 'POST /tasks/:id/override', theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/override`, body: { status: 'in_preparation', reason: 'Client confirmed the documents by phone' } }), ownerOk: RULE },
  { name: 'POST /tasks/:id/clear-override', theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/clear-override`, body: { reason: 'Documents arrived after all' } }), ownerOk: RULE },
  { name: 'POST /tasks/:id/due', theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/due`, body: { dueDate: '2026-11-25', ref: 'RMC 100-2026', reason: 'Deadline moved by memorandum' } }), ownerOk: RULE },

  // ---- a client's own records
  {
    name: 'PATCH /clients/:id',
    theirs: () => ({ method: 'PATCH', path: '/api/v1/clients/client-maria', body: { displayName: 'Maria Enterprises' }, version: ['clients', 'client-maria'] }),
    mine: () => ({ method: 'PATCH', path: '/api/v1/clients/client-cruz', body: { displayName: 'Cruz Salon' }, version: ['clients', 'client-cruz'] }),
    helperMine: 'ok',
  },
  {
    name: 'POST /clients/:id/archive',
    theirs: () => ({ method: 'POST', path: '/api/v1/clients/client-maria/archive', body: { reason: 'Engagement ended in October' } }),
    mine: () => ({ method: 'POST', path: '/api/v1/clients/client-cruz/archive', body: { reason: 'Engagement ended in October' } }),
    helperMine: 'ok',
  },
  {
    name: 'POST /clients/:id/restore',
    theirs: () => ({ method: 'POST', path: '/api/v1/clients/client-maria/restore', body: { reason: 'Engagement resumed in November' } }),
    mine: () => ({ method: 'POST', path: '/api/v1/clients/client-cruz/restore', body: { reason: 'Engagement resumed in November' } }),
    helperMine: 'ok',
  },
  {
    name: 'POST /clients/:id/reveal-tin',
    theirs: () => ({ method: 'POST', path: '/api/v1/clients/client-maria/reveal-tin' }),
    mine: () => ({ method: 'POST', path: '/api/v1/clients/client-rsp/reveal-tin' }),
    helperMine: 'rule',
    ownerOk: [200, 404],
  },
  {
    name: 'POST /contacts',
    theirs: () => ({ method: 'POST', path: '/api/v1/contacts', body: { clientId: 'client-maria', name: 'Another Contact', phoneE164: '+639175556666' } }),
    mine: () => ({ method: 'POST', path: '/api/v1/contacts', body: { clientId: 'client-rsp', name: 'Another Contact', phoneE164: '+639175556666' } }),
    helperMine: 'ok',
  },
  {
    name: 'PATCH /contacts/:id',
    theirs: () => ({ method: 'PATCH', path: `/api/v1/contacts/${ids.contactMaria}`, body: { name: 'Maria Contact Jr' }, version: ['contacts', ids.contactMaria] }),
    mine: () => ({ method: 'PATCH', path: `/api/v1/contacts/${ids.contactRsp}`, body: { name: 'Rsp Contact Jr' }, version: ['contacts', ids.contactRsp] }),
    helperMine: 'ok',
  },
  {
    name: 'DELETE /contacts/:id',
    theirs: () => ({ method: 'DELETE', path: `/api/v1/contacts/${ids.contactMaria}`, body: { reason: 'Left the company in October' } }),
    mine: () => ({ method: 'DELETE', path: `/api/v1/contacts/${ids.contactRsp}`, body: { reason: 'Left the company in October' } }),
    helperMine: 'ok',
  },
  {
    name: 'POST /authorizations',
    theirs: () => ({ method: 'POST', path: '/api/v1/authorizations', body: { clientId: 'client-maria', type: 'spa', scope: ['filing'], granteeUserId: 'user-ben', issuedOn: '2026-10-02', notarized: true } }),
    mine: () => ({ method: 'POST', path: '/api/v1/authorizations', body: { clientId: 'client-rsp', type: 'spa', scope: ['filing'], granteeUserId: 'user-ben', issuedOn: '2026-10-02', notarized: true } }),
    helperMine: 'ok',
  },
  {
    name: 'PATCH /authorizations/:id',
    theirs: () => ({ method: 'PATCH', path: `/api/v1/authorizations/${ids.authMaria}`, body: { notarized: true }, version: ['authorizations', ids.authMaria] }),
    mine: () => ({ method: 'PATCH', path: `/api/v1/authorizations/${ids.authRsp}`, body: { notarized: true }, version: ['authorizations', ids.authRsp] }),
    helperMine: 'ok',
  },
  {
    name: 'POST /authorizations/:id/replace',
    theirs: () => ({ method: 'POST', path: `/api/v1/authorizations/${ids.authMaria}/replace`, body: { clientId: 'client-maria', type: 'spa', scope: ['filing', 'payment'], granteeUserId: 'user-ben', issuedOn: '2026-10-20', notarized: true } }),
    mine: () => ({ method: 'POST', path: `/api/v1/authorizations/${ids.authCruz}/replace`, body: { clientId: 'client-cruz', type: 'spa', scope: ['filing', 'payment'], granteeUserId: 'user-ben', issuedOn: '2026-10-20', notarized: true } }),
    helperMine: 'ok',
  },
  {
    name: 'POST /tasks',
    theirs: () => ({ method: 'POST', path: '/api/v1/tasks', body: { clientId: 'client-maria', title: 'Registration update', kind: 'registration', dueDate: '2026-11-30' } }),
    mine: () => ({ method: 'POST', path: '/api/v1/tasks', body: { clientId: 'client-rsp', title: 'Registration update', kind: 'registration', dueDate: '2026-11-30' } }),
    helperMine: 'ok',
  },
  {
    // a helper may change the owner of a task and nothing else (rule A)
    name: 'PATCH /tasks/:id',
    theirs: () => ({ method: 'PATCH', path: `/api/v1/tasks/${t.clientMariaTask}`, body: { notes: 'Call before filing' }, version: ['tasks', t.clientMariaTask] }),
    mine: () => ({ method: 'PATCH', path: `/api/v1/tasks/${t.clientRspTask}`, body: { notes: 'Call before filing' }, version: ['tasks', t.clientRspTask] }),
    helperMine: 'forbidden',
  },
  {
    name: 'POST /tasks/:id/status',
    theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/status`, body: { to: 'in_preparation' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientRspTask}/status`, body: { to: 'in_preparation' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /tasks/:id/submit',
    theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/submit`, body: { on: '2026-10-27', via: 'efps' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientRspTask}/submit`, body: { on: '2026-10-27', via: 'efps' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /tasks/:id/complete',
    theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/complete`, body: { on: '2026-10-27', noEvidenceReason: 'Filed at the counter, stamp copy to follow' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientRspTask}/complete`, body: { on: '2026-10-27', noEvidenceReason: 'Filed at the counter, stamp copy to follow' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'PUT /tasks/:id/next-action',
    theirs: () => ({ method: 'PUT', path: `/api/v1/tasks/${t.clientMariaTask}/next-action`, body: { next: { text: 'Call the client', owner: 'operator' } } }),
    mine: () => ({ method: 'PUT', path: `/api/v1/tasks/${t.clientRspTask}/next-action`, body: { next: { text: 'Call the client', owner: 'operator' } } }),
    helperMine: 'ok',
  },
  {
    name: 'POST /tasks/:id/archive',
    theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/archive`, body: { reason: 'Filed on paper by the client' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/tasks/task-cruz-0619e/archive`, body: { reason: 'Filed on paper by the client' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /tasks/:id/restore',
    theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/restore`, body: { reason: 'Archived by mistake' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/tasks/task-cruz-0619e/restore`, body: { reason: 'Archived by mistake' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /tasks/:id/duplicate',
    theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/duplicate` }),
    mine: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientRspTask}/duplicate` }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
  {
    name: 'POST /tasks/:taskId/lines',
    theirs: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientMariaTask}/lines`, body: { label: 'Extra copy of the contract' } }),
    mine: () => ({ method: 'POST', path: `/api/v1/tasks/${t.clientRspTask}/lines`, body: { label: 'Extra copy of the contract' } }),
    helperMine: 'ok',
  },
  {
    name: 'PUT /tasks/:taskId/lines/order',
    theirs: () => ({ method: 'PUT', path: `/api/v1/tasks/${t.clientMariaTask}/lines/order`, body: { orderedIds: ['line-maria-1'] } }),
    mine: () => ({ method: 'PUT', path: `/api/v1/tasks/${t.clientRspTask}/lines/order`, body: { orderedIds: ['line-rsp-1', 'line-rsp-2'] } }),
    helperMine: 'ok',
  },
  {
    // a helper changes no field of a line (rule A: the allowlist is empty); review state moves through lines/:id/status
    name: 'PATCH /lines/:id',
    theirs: () => ({ method: 'PATCH', path: '/api/v1/lines/line-maria-1', body: { label: 'Renamed line' }, version: ['task_lines', 'line-maria-1'] }),
    mine: () => ({ method: 'PATCH', path: '/api/v1/lines/line-rsp-2', body: { label: 'Renamed line' }, version: ['task_lines', 'line-rsp-2'] }),
    helperMine: 'forbidden',
  },
  {
    name: 'POST /lines/:id/status',
    theirs: () => ({ method: 'POST', path: '/api/v1/lines/line-maria-1/status', body: { to: 'requested' } }),
    mine: () => ({ method: 'POST', path: '/api/v1/lines/line-rsp-2/status', body: { to: 'requested' } }),
    helperMine: 'rule',
    ownerOk: RULE,
  },
];

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

describe('the owner reaches every write route, on any client', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const call = c.theirs();
      const res = await send('owner', call.method, call.path, call.body, call.version);
      expect(c.ownerOk ?? OK, `${res.status} ${res.text.slice(0, 200)}`).toContain(res.status);
    });
  }
});

describe('a helper: his own clients as the route allows, never an unassigned client, never an owner-only route', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const theirs = c.theirs();
      const refused = await send('helper', theirs.method, theirs.path, theirs.body, theirs.version);
      expect(refused.status, `helper on ${theirs.path}: ${refused.text.slice(0, 160)}`).toBe(403);
      expect(refused.body.error.code).toBe('FORBIDDEN');
      if (!c.mine) return;
      const mine = c.mine();
      const res = await send('helper', mine.method, mine.path, mine.body, mine.version);
      if (c.helperMine === 'forbidden') {
        expect(res.status, res.text.slice(0, 160)).toBe(403);
      } else if (c.helperMine === 'ok') {
        expect(OK, `${res.status} ${res.text.slice(0, 200)}`).toContain(res.status);
      } else {
        expect(RULE, `${res.status} ${res.text.slice(0, 200)}`).toContain(res.status);
      }
    });
  }
});

describe('rule A and rule X reach the Worker the way they reach the mock', () => {
  it('a helper cannot set a field outside his allowlist on a client he is assigned to', async () => {
    const version: [string, string] = ['clients', 'client-rsp'];
    const res = await send('helper', 'PATCH', '/api/v1/clients/client-rsp', { assignedUserIds: ['user-ben'] }, version);
    expect(res.status).toBe(403);
  });

  it('a helper cannot create a task for an unassigned client', async () => {
    const res = await send('helper', 'POST', '/api/v1/tasks', { clientId: 'client-maria', title: 'Sneaky', kind: 'other', dueDate: '2026-11-30' });
    expect(res.status).toBe(403);
  });

  it('a reference to another client\'s record is refused (rule X), even for the owner', async () => {
    const mariaDoc = (await world.env.DB.prepare("SELECT id FROM documents WHERE client_id = 'client-maria' LIMIT 1").first<{ id: string }>())!.id;
    const res = await send('owner', 'POST', '/api/v1/authorizations', { clientId: 'client-rsp', type: 'spa', scope: ['filing'], granteeUserId: 'user-ben', issuedOn: '2026-10-02', notarized: false, documentId: mariaDoc });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RULE_VIOLATION');
  });

  it('an owner-only route is refused by the command before anything is read for a helper (no record is touched)', async () => {
    const before = (await world.env.DB.prepare('SELECT COUNT(*) AS n FROM activity').first<{ n: number }>())!.n;
    const res = await send('helper', 'POST', '/api/v1/holidays', { date: '2027-01-01', name: 'New Year', type: 'regular' });
    expect(res.status).toBe(403);
    expect((await world.env.DB.prepare('SELECT COUNT(*) AS n FROM activity').first<{ n: number }>())!.n).toBe(before);
  });
});
