import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { stubPush } from '../push/stub';
import { manilaHHmm } from '../push/send';
import { setDevToday } from '@/lib/dates';
import { PERSONAS, openWorld, type World } from '../testing/world';

/**
 * U35: the notifications that actions cause (spec 14) are written in the same batch as the change, link to a record that exists,
 * collapse to one per type, record and day, and are pushed by each type's default and the person's settings, outside quiet hours,
 * with the lock-screen-safe text (codes only; the first name of whoever acted stays in the app). The push services are stubs.
 */
let world: World;
const stub = stubPush();
const cookie: Record<string, string> = {};
let n = 0;

beforeAll(async () => {
  world = await openWorld({ push: stub.deps });
  cookie.owner = await world.cookieFor(PERSONAS.owner);
  cookie.helper = await world.cookieFor(PERSONAS.helper);
  seededPrefs = (await db().prepare('SELECT * FROM user_prefs').all<Record<string, unknown>>()).results;
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

const db = () => world.env.DB;
const rows = async (sql: string, ...bind: unknown[]) => (await db().prepare(sql).bind(...bind).all<Record<string, any>>()).results;

async function send(who: 'owner' | 'helper', method: string, path: string, body?: unknown, key?: string, extra: Record<string, string> = {}) {
  const headers = { 'content-type': 'application/json', 'Idempotency-Key': key ?? `events-${++n}-${crypto.randomUUID()}`, ...extra };
  const res = await world.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cookie: cookie[who] });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
/** The owner gives the task to someone (If-Match: * is "any version", as a screen that holds none sends). */
const assignTask = (ownerUserId: string) => send('owner', 'PATCH', '/api/v1/tasks/task-rsp-0619e', { ownerUserId }, undefined, { 'If-Match': '*' });
const eventRows = (type: string) => rows("SELECT * FROM notifications WHERE type = ? AND created_by = 'system'", type);

const KEYS_FOR = (userId: string) => `https://fcm.googleapis.com/fcm/send/${userId}-phone`;
const subscribe = (userId: string) =>
  db()
    .prepare("INSERT OR REPLACE INTO push_subscriptions (id, org_id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, 'org-demo-01', ?, ?, 'p256dh-key-0123456789', 'auth-key-0123456789', 't')")
    .bind(`sub-${userId}`, userId, KEYS_FOR(userId))
    .run();
let seededPrefs: Array<Record<string, unknown>> = [];
const restorePrefs = async () => {
  for (const row of seededPrefs) {
    const keys = Object.keys(row);
    await db().prepare(`INSERT OR REPLACE INTO user_prefs (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).bind(...keys.map((k) => row[k])).run();
  }
};
/** null: the person never chose (no row, so the spec defaults apply); otherwise the types they switched on. */
const choose = async (userId: string, types: string[] | null) => {
  await restorePrefs();
  if (types === null) await db().prepare('DELETE FROM user_prefs WHERE user_id = ?').bind(userId).run();
  else await db().prepare('UPDATE user_prefs SET push_types = ? WHERE user_id = ?').bind(JSON.stringify(types), userId).run();
};

beforeEach(async () => {
  stub.built.length = 0;
  stub.posted.length = 0;
  await db().prepare("DELETE FROM notifications WHERE created_by = 'system'").run();
  await db().prepare('DELETE FROM push_subscriptions').run();
  await db().prepare("UPDATE task_lines SET status = 'requested' WHERE id = 'line-rsp-2'").run();
  // the records the tests change, back as seeded
  await db().prepare("UPDATE tasks SET owner_user_id = 'user-ana' WHERE id = 'task-rsp-0619e'").run();
  await db().prepare("UPDATE visits SET status = 'planned', started_at = NULL, departure_override_reason = NULL, assignee_user_id = 'user-ana' WHERE id = 'visit-today'").run();
  await db().prepare("UPDATE visit_items SET outcome = NULL WHERE id = 'vitem-1'").run();
  // the real day, as in production (the test world otherwise runs on its seed day, outside the 24 hours a push looks back)
  setDevToday(null);
  await restorePrefs();
  // no quiet hours unless a test asks for them, so the result does not depend on the hour the suite runs
  await db().prepare("UPDATE org_settings SET quiet_hours_start = '00:00', quiet_hours_end = '00:00'").run();
});

describe('U35 the notification is written with the change', () => {
  it('a helper marking a line received leaves one row for the task owner, linking to the task, and the line changed too', async () => {
    const r = await send('helper', 'POST', '/api/v1/lines/line-rsp-2/status', { to: 'received' });
    expect(r.status).toBe(200);
    expect((await rows("SELECT status FROM task_lines WHERE id = 'line-rsp-2'"))[0].status).toBe('received');
    const made = await eventRows('received_needs_review');
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ user_id: 'user-ana', link: '/tasks/task-rsp-0619e', entity: 'task', entity_id: 'task-rsp-0619e', client_id: 'client-rsp' });
    expect(made[0].body).toContain('Ben');
    expect(made[0].title).not.toContain('Ben');
    expect(await rows("SELECT id FROM tasks WHERE id = 'task-rsp-0619e'")).toHaveLength(1); // the link points at a record that exists
  });

  it('a refused change writes no notification', async () => {
    const r = await send('helper', 'POST', '/api/v1/lines/line-rsp-1/status', { to: 'received' }); // an accepted line cannot go back
    expect(r.status).toBe(409);
    expect(await eventRows('received_needs_review')).toHaveLength(0);
  });

  it('the same request sent twice (same Idempotency-Key) writes one row, and a different request the same day collapses to it', async () => {
    const key = `events-replay-${crypto.randomUUID()}`;
    await send('helper', 'POST', '/api/v1/lines/line-rsp-2/status', { to: 'received' }, key);
    await send('helper', 'POST', '/api/v1/lines/line-rsp-2/status', { to: 'received' }, key);
    expect(await eventRows('received_needs_review')).toHaveLength(1);
    await db().prepare("UPDATE task_lines SET status = 'requested' WHERE id = 'line-rsp-2'").run();
    await send('helper', 'POST', '/api/v1/lines/line-rsp-2/status', { to: 'received' });
    expect(await eventRows('received_needs_review')).toHaveLength(1);
  });

  it('visit started with a reason, outcome recorded and assignment each leave their row', async () => {
    await db().prepare("UPDATE visits SET assignee_user_id = 'user-ben' WHERE id = 'visit-today'").run();
    expect((await send('helper', 'POST', '/api/v1/visits/visit-today/start', { leaveAnywayReason: 'SPA expired' })).status).toBe(200);
    const left = await eventRows('left_not_ready');
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ user_id: 'user-ana', link: '/visits/visit-today' });
    expect(left[0].body).toContain('SPA expired');
    expect(left[0].title).not.toMatch(/Ben|SPA expired/);

    const outcome = await send('helper', 'POST', '/api/v1/visits/visit-today/items/vitem-1/outcome', { outcome: 'more_documents_requested', evidenceDocumentIds: [] });
    expect(outcome.status).toBe(200);
    expect(await eventRows('outcome_recorded')).toHaveLength(1);

    const assigned = await assignTask('user-ben');
    expect(assigned.status).toBe(200);
    expect((await eventRows('assigned')).map((r) => [r.user_id, r.link])).toEqual([['user-ben', '/tasks/task-rsp-0619e']]);
  });
});

describe('U35 pushes follow the type default, the person and the quiet hours', () => {
  const quietNow = () => {
    const now = new Date();
    const at = (shiftHours: number) => manilaHHmm(new Date(now.getTime() + shiftHours * 3600_000));
    return { start: at(-1), end: at(1) };
  };

  it('"Received, needs review" is off by default, and on once the person turns it on', async () => {
    await subscribe('user-ana');
    await choose('user-ana', null); // never chose: the spec defaults
    await send('helper', 'POST', '/api/v1/lines/line-rsp-2/status', { to: 'received' });
    expect(stub.built).toHaveLength(0);
    expect((await eventRows('received_needs_review'))[0].pushed_at).toBeNull(); // still in the app

    await db().prepare("DELETE FROM notifications WHERE created_by = 'system'").run();
    await db().prepare("UPDATE task_lines SET status = 'requested' WHERE id = 'line-rsp-2'").run();
    await choose('user-ana', ['received_needs_review']);
    await send('helper', 'POST', '/api/v1/lines/line-rsp-2/status', { to: 'received' });
    expect(stub.built).toHaveLength(1);
    expect(stub.built[0].endpoint).toBe(KEYS_FOR('user-ana'));
  });

  it('"Assigned to you" is on by default and its push carries codes only, with a link to the record', async () => {
    await subscribe('user-ben');
    await choose('user-ben', null);
    await assignTask('user-ben');
    expect(stub.built).toHaveLength(1);
    const payload = stub.built[0].payload as { title: string; body: string; url: string };
    expect(payload.url).toBe('/tasks/task-rsp-0619e');
    expect(payload.body).toMatch(/^You were assigned RSP /);
    expect(JSON.stringify(payload)).not.toMatch(/Ana|Santos/); // the name of whoever assigned stays in the app
    expect((await eventRows('assigned'))[0].pushed_at).not.toBeNull();
  });

  it('holds the push during the quiet hours but still writes the row', async () => {
    const { start, end } = quietNow();
    await db().prepare('UPDATE org_settings SET quiet_hours_start = ?, quiet_hours_end = ?').bind(start, end).run();
    await subscribe('user-ben');
    await choose('user-ben', null);
    await assignTask('user-ben');
    expect(stub.built).toHaveLength(0);
    const made = await eventRows('assigned');
    expect(made).toHaveLength(1);
    expect(made[0].pushed_at).toBeNull();
  });

  it('a person with no device gets the notification in the app and nothing else', async () => {
    await choose('user-ana', ['received_needs_review']);
    await send('helper', 'POST', '/api/v1/lines/line-rsp-2/status', { to: 'received' });
    expect(stub.built).toHaveLength(0);
    expect(await eventRows('received_needs_review')).toHaveLength(1);
  });
});
