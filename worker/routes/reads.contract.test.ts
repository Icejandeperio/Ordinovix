import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mockRepositories as R, mockDevControls } from '@/data/mock';
import { setDevToday } from '@/lib/dates';
import { PERSONAS, TEST_SEED_DAY, openWorld, type World } from '../testing/world';

/**
 * U25 contract test: for the Demo organization, every read route returns what the mock returns, for the owner and for the
 * helper. Both run the same read side (src/data/queries.ts); this proves the D1 records load into the same entities
 * (nothing lost in the rows, joins or flattening) and that the routes pass the filters through.
 */
let world: World;
const cookies: Record<'owner' | 'helper', string> = { owner: '', helper: '' };

beforeAll(async () => {
  world = await openWorld(); // seeds the Demo organization for TEST_SEED_DAY and sets the dev "today" to that day
  setDevToday(TEST_SEED_DAY);
  mockDevControls.reset(); // the mock now starts from the same day, so both hold the same records
  cookies.owner = await world.cookieFor(PERSONAS.owner);
  cookies.helper = await world.cookieFor(PERSONAS.helper);
}, 180_000);
afterAll(async () => {
  await world?.dispose();
  setDevToday(null);
});

/**
 * The comparison form: a JSON round trip (undefined fields dropped), keys in sorted order, and the differences that are
 * deliberate: the mock keeps a full TIN inside its client records for revealTin (the API never returns one), a few mock
 * records omit orgId, and a seeded document's storage key carries '#<id>' so keys stay unique in D1.
 */
function canon(value: unknown): unknown {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as object)
          .filter((k) => k !== 'tinFull' && k !== 'orgId')
          .sort()
          .map((k) => {
            const x = (v as Record<string, unknown>)[k];
            return [k, (k === 'storageKey' || k === 'thumbnailKey') && typeof x === 'string' ? x.replace(/#[\w-]+$/, '') : walk(x)];
          }),
      );
    }
    return v;
  };
  return walk(JSON.parse(JSON.stringify(value ?? null)));
}

async function get(path: string, persona: 'owner' | 'helper') {
  const res = await world.request(path, { cookie: cookies[persona] });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

/** Follows nextCursor until the list is complete. */
async function getAll(path: string, persona: 'owner' | 'helper') {
  const items: unknown[] = [];
  let cursor: string | undefined;
  let last: any;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const { status, body } = await get(`${path}${sep}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, persona);
    expect(status, path).toBe(200);
    items.push(...body.items);
    last = body;
    cursor = body.nextCursor;
  } while (cursor);
  return { ...last, items };
}

const sample = async () => {
  mockDevControls.setPersona('owner');
  const tasks = (await R.tasks.list()).items;
  const visits = (await R.visits.list()).items;
  return {
    taskId: 'task-rsp-0619e',
    lineId: (await R.tasks.get('task-rsp-0619e')).lines[0].id,
    visitId: 'visit-today',
    followUpId: 'fu-rsp-2307',
    templateId: 'tmpl-0619e',
    officeId: 'off-rdo39',
    docs: (await R.documents.list({ clientId: 'client-rsp' })).items,
    anyTask: tasks[0].task.id,
    anyVisit: visits[0].visit.id,
  };
};

type Case = { name: string; path: string; call: () => Promise<unknown>; paged?: boolean };

async function cases(): Promise<Case[]> {
  const x = await sample();
  return [
    { name: 'memberships.list', path: '/api/v1/memberships', call: () => R.memberships.list() },
    { name: 'today.queue', path: '/api/v1/today', call: () => R.today.queue('everyone') },
    { name: 'today.queue mine', path: '/api/v1/today?scope=mine', call: () => R.today.queue('mine') },
    { name: 'clients.list', path: '/api/v1/clients', call: () => R.clients.list(), paged: true },
    { name: 'clients.list search', path: '/api/v1/clients?search=rivera', call: () => R.clients.list({ search: 'rivera' }), paged: true },
    { name: 'clients.get', path: '/api/v1/clients/client-rsp', call: () => R.clients.get('client-rsp') },
    { name: 'contacts.listByClient', path: '/api/v1/clients/client-rsp/contacts', call: () => R.contacts.listByClient('client-rsp') },
    { name: 'authorizations.listByClient', path: '/api/v1/clients/client-rsp/authorizations', call: () => R.authorizations.listByClient('client-rsp') },
    { name: 'templates.list', path: '/api/v1/templates', call: () => R.templates.list() },
    { name: 'templates.get', path: `/api/v1/templates/${x.templateId}`, call: () => R.templates.get(x.templateId) },
    { name: 'deadlineMoves.list', path: '/api/v1/deadline-moves', call: () => R.deadlineMoves.list() },
    { name: 'holidays.list', path: '/api/v1/holidays?year=2026', call: () => R.holidays.list(2026) },
    { name: 'messages.list', path: '/api/v1/messages', call: () => R.messages.list() },
    { name: 'tasks.list', path: '/api/v1/tasks', call: () => R.tasks.list(), paged: true },
    { name: 'tasks.list filtered', path: '/api/v1/tasks?clientId=client-rsp', call: () => R.tasks.list({ clientId: 'client-rsp' }), paged: true },
    { name: 'tasks.board', path: '/api/v1/tasks/board', call: () => R.tasks.board() },
    { name: 'tasks.get', path: `/api/v1/tasks/${x.taskId}`, call: () => R.tasks.get(x.taskId) },
    { name: 'lines.history', path: `/api/v1/lines/${x.lineId}/history`, call: () => R.lines.history(x.lineId) },
    { name: 'documents.list', path: '/api/v1/documents', call: () => R.documents.list(), paged: true },
    { name: 'documents.findBySha', path: `/api/v1/documents/by-sha?sha256=${x.docs[0].sha256}&clientId=client-rsp`, call: () => R.documents.findBySha(x.docs[0].sha256, 'client-rsp') },
    { name: 'followUps.list', path: '/api/v1/follow-ups', call: () => R.followUps.list(), paged: true },
    { name: 'followUps.get', path: `/api/v1/follow-ups/${x.followUpId}`, call: () => R.followUps.get(x.followUpId) },
    { name: 'offices.list', path: '/api/v1/offices', call: () => R.offices.list() },
    { name: 'offices.get', path: `/api/v1/offices/${x.officeId}`, call: () => R.offices.get(x.officeId) },
    { name: 'visits.list', path: '/api/v1/visits', call: () => R.visits.list(), paged: true },
    { name: 'visits.get', path: `/api/v1/visits/${x.visitId}`, call: () => R.visits.get(x.visitId) },
    { name: 'visits.suggestTasks', path: `/api/v1/visits/${x.visitId}/suggestions`, call: () => R.visits.suggestTasks(x.visitId) },
    { name: 'visitKit.list', path: '/api/v1/visit-kit', call: () => R.visitKit.list() },
    { name: 'payments.list', path: '/api/v1/payments', call: () => R.payments.list(), paged: true },
    { name: 'notes.list', path: '/api/v1/notes?entity=client&entityId=client-rsp', call: () => R.notes.list('client', 'client-rsp') },
    { name: 'savedViews.list', path: '/api/v1/saved-views?page=tasks', call: () => R.savedViews.list('tasks') },
    { name: 'notifications.list', path: '/api/v1/notifications', call: () => R.notifications.list(), paged: true },
    { name: 'notifications.unreadCount', path: '/api/v1/notifications/unread-count', call: () => R.notifications.unreadCount() },
    { name: 'calendar.range', path: '/api/v1/calendar?from=2026-10-01&to=2026-11-30', call: () => R.calendar.range('2026-10-01', '2026-11-30') },
    { name: 'insights overview', path: '/api/v1/insights/overview', call: () => R.insights.get('overview') },
    { name: 'insights trips', path: '/api/v1/insights/trips', call: () => R.insights.get('trips') },
    { name: 'insights chasing', path: '/api/v1/insights/chasing', call: () => R.insights.get('chasing') },
    { name: 'insights deadlines', path: '/api/v1/insights/deadlines', call: () => R.insights.get('deadlines') },
    { name: 'insights workload', path: '/api/v1/insights/workload', call: () => R.insights.get('workload') },
    { name: 'insights clients', path: '/api/v1/insights/clients', call: () => R.insights.get('clients') },
    { name: 'baseline.get', path: '/api/v1/baseline', call: () => R.baseline.get() },
    { name: 'pulses.list', path: '/api/v1/pulses', call: () => R.pulses.list() },
    { name: 'reports.clientChecklist', path: '/api/v1/reports/client-checklist/client-rsp', call: () => R.reports.clientChecklist('client-rsp') },
    { name: 'reports.clientHistory', path: '/api/v1/reports/client-history/client-rsp?year=2026', call: () => R.reports.clientHistory('client-rsp', 2026) },
    { name: 'activity.list', path: '/api/v1/activity', call: () => R.activity.list(), paged: true },
    { name: 'search.query', path: '/api/v1/search?q=rivera', call: () => R.search.query('rivera') },
  ];
}

for (const persona of ['owner', 'helper'] as const) {
  describe(`read routes match the mock, as the ${persona}`, () => {
    it('returns the same records for every route', { timeout: 300_000 }, async () => {
      const list = await cases();
      const mismatches: string[] = [];
      for (const c of list) {
        mockDevControls.setPersona(persona);
        const expected: { ok: true; value: unknown } | { ok: false; code: string } = await c.call().then(
          (v) => ({ ok: true as const, value: v }),
          (e) => ({ ok: false as const, code: (e as { code?: string }).code ?? 'ERROR' }),
        );
        const actual = c.paged && expected.ok ? { status: 200, body: await getAll(c.path, persona) } : await get(c.path, persona);
        if (!expected.ok) {
          if (actual.status < 400) mismatches.push(`${c.name}: mock refuses (${expected.code}) but the Worker answers ${actual.status}`);
          continue;
        }
        if (actual.status !== 200) {
          mismatches.push(`${c.name}: Worker ${actual.status} ${JSON.stringify(actual.body)?.slice(0, 160)}`);
          continue;
        }
        const want = canon(expected.value) as any;
        const got = canon(actual.body) as any;
        if (c.paged) {
          // pages carry items; compare the items (and the total) of the mock
          expect(Array.isArray(got.items), c.name).toBe(true);
          if (JSON.stringify(got.items) !== JSON.stringify(want.items)) {
            const i = got.items.findIndex((it: unknown, n: number) => JSON.stringify(it) !== JSON.stringify(want.items[n]));
            mismatches.push(`${c.name}: item ${i} differs (mock ${want.items.length}, Worker ${got.items.length}): mock ${JSON.stringify(want.items[i])?.slice(0, 200)} / Worker ${JSON.stringify(got.items[i])?.slice(0, 200)}`);
          }
          continue;
        }
        if (JSON.stringify(got) !== JSON.stringify(want)) {
          const a = JSON.stringify(want);
          const b = JSON.stringify(got);
          let i = 0;
          while (i < a.length && a[i] === b[i]) i++;
          mismatches.push(`${c.name}: differs near "${a.slice(Math.max(0, i - 50), i + 90)}" vs "${b.slice(Math.max(0, i - 50), i + 90)}"`);
        }
      }
      expect(mismatches).toEqual([]);
    });
  });
}
