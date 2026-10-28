import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { createQueries } from '@/data/queries';
import { addDaysToDate, setDevToday } from '@/lib/dates';
import { loadQueryData } from '../db/load';
import { isFirstWorkingDay, runNotifications, sendDuePushes } from './notify';
import { sendPush, inQuietHours, vapidJwk, isPushEndpoint, realPushDeps } from '../push/send';
import { stubPush } from '../push/stub';
import { TEST_SEED_DAY, openWorld, type World } from '../testing/world';

/**
 * U29: the cron jobs write notification rows that link to records that exist, collapse repeats, and push only what a person has
 * switched on, outside quiet hours, with codes and no names. The push services are stubs: no network.
 */
// a job loads the whole organization and runs the shared read side per person: give it room when the machine is busy
vi.setConfig({ testTimeout: 60_000 });

let world: World;
const MORNING = new Date('2026-10-26T23:00:00Z'); // 07:00 on 2026-10-27 in Manila
const EVENING = new Date('2026-10-27T09:00:00Z'); // 17:00 on 2026-10-27
const QUIET = new Date('2026-10-27T14:00:00Z'); // 22:00 in Manila

beforeAll(async () => {
  world = await openWorld();
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});
afterEach(() => setDevToday(TEST_SEED_DAY));

const db = () => world.env.DB;
const rows = async (sql: string, ...bind: unknown[]) => (await db().prepare(sql).bind(...bind).all<any>()).results;
const count = async (sql: string, ...bind: unknown[]) => (await db().prepare(sql).bind(...bind).first<{ n: number }>())!.n;
const clearNotifications = () => db().prepare("DELETE FROM notifications WHERE created_by = 'system'").run();

const subscribe = (userId: string, endpoint: string) =>
  db()
    .prepare("INSERT OR REPLACE INTO push_subscriptions (id, org_id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, 'org-demo-01', ?, ?, 'p256dh-key-0123456789', 'auth-key-0123456789', 't')")
    .bind(crypto.randomUUID(), userId, endpoint)
    .run();

describe('morning job', () => {
  it('writes a digest for every active member, with counts that match what that person sees on Today', async () => {
    await clearNotifications();
    const result = await runNotifications(world.env, 'morning', stubPush().deps, MORNING);
    expect(result.created).toBeGreaterThan(0);
    const digests = await rows("SELECT user_id, body, link FROM notifications WHERE type = 'daily_digest' AND created_by = 'system'");
    expect(digests.map((d) => d.user_id).sort()).toEqual(['user-ana', 'user-ben']);
    for (const d of digests) expect(d.body).toMatch(/^Today: /);

    // a helper's digest is counted over his clients only: the same shared code, run as him
    const store = await loadQueryData(db(), 'org-demo-01');
    const ben = store.memberships.find((m) => m.id === 'mem-ben')!;
    const benQueue = await createQueries({ store, user: store.users.find((u) => u.id === 'user-ben')!, membership: ben }).today.queue('mine');
    const body = digests.find((d) => d.user_id === 'user-ben').body as string;
    if (benQueue.counts.overdue > 0) expect(body).toContain(`${benQueue.counts.overdue} overdue`);
    else expect(body).not.toContain('overdue');
  });

  it('every notification links to a record or screen that exists', async () => {
    const all = await rows("SELECT type, link, entity, entity_id, client_id FROM notifications WHERE created_by = 'system'");
    expect(all.length).toBeGreaterThan(0);
    const screens = new Set(['/', '/follow-ups', '/insights', '/settings/practice']);
    for (const n of all) {
      if (screens.has(n.link)) continue;
      const [, kind, id] = n.link.split('/');
      const table = { tasks: 'tasks', visits: 'visits', clients: 'clients' }[kind as 'tasks'];
      expect(table, `${n.type} links to ${n.link}`).toBeDefined();
      expect(await count(`SELECT COUNT(*) AS n FROM ${table} WHERE id = ?`, id), `${n.link} exists`).toBe(1);
    }
  });

  it('collapses repeats: one notification per type, record, person and day', async () => {
    const before = await count("SELECT COUNT(*) AS n FROM notifications WHERE created_by = 'system'");
    const again = await runNotifications(world.env, 'morning', stubPush().deps, MORNING);
    expect(again.created).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM notifications WHERE created_by = 'system'")).toBe(before);
  });

  it('warns the owner of an authorization that expires in 7 days, and of an accreditation that expires in 30', async () => {
    await clearNotifications();
    const today = TEST_SEED_DAY;
    const authId = (await rows("SELECT id FROM authorizations WHERE client_id = 'client-rsp' AND replaced_by_id IS NULL AND deleted_at IS NULL LIMIT 1"))[0].id;
    await db().prepare('UPDATE authorizations SET valid_until = ? WHERE id = ?').bind(addDaysToDate(today, 7), authId).run();
    await db().prepare("UPDATE org_settings SET accreditation_number = 'ACC-1', accreditation_valid_until = ? WHERE org_id = 'org-demo-01'").bind(addDaysToDate(today, 30)).run();
    await runNotifications(world.env, 'morning', stubPush().deps, MORNING);
    const auth = await rows("SELECT user_id, body, link FROM notifications WHERE type = 'authorization_expiring' AND entity_id = ?", authId);
    expect(auth.map((a) => a.user_id)).toEqual(['user-ana']);
    expect(auth[0].body).toMatch(/^RSP's .* expires in 7 days\.$/);
    expect(auth[0].link).toBe('/clients/client-rsp');
    const acc = await rows("SELECT user_id, body FROM notifications WHERE type = 'accreditation_expiring'");
    expect(acc).toEqual([{ user_id: 'user-ana', body: expect.stringMatching(/^Your tax agent accreditation expires on [A-Z][a-z]{2} \d{1,2}\.$/) }]);
  });

  it('tells the task owner and the owner that a task became overdue yesterday', async () => {
    await clearNotifications();
    await db().prepare("UPDATE tasks SET due_date = ?, status = 'in_preparation' WHERE id = 'task-cruz-1601c'").bind(addDaysToDate(TEST_SEED_DAY, -1)).run();
    await runNotifications(world.env, 'morning', stubPush().deps, MORNING);
    const overdue = await rows("SELECT user_id, body FROM notifications WHERE type = 'overdue' AND entity_id = 'task-cruz-1601c'");
    expect(overdue.length).toBeGreaterThan(0);
    expect(overdue.map((o) => o.user_id)).toContain('user-ana');
    for (const o of overdue) expect(o.body).toMatch(/^CSL .* is overdue\.$/);
  });

  it('says a task is due soon and still waiting on items, to its owner', async () => {
    await clearNotifications();
    await db().prepare("UPDATE tasks SET due_date = ? WHERE id = 'task-rsp-0619e'").bind(addDaysToDate(TEST_SEED_DAY, 3)).run();
    await runNotifications(world.env, 'morning', stubPush().deps, MORNING);
    const owner = (await rows("SELECT owner_user_id FROM tasks WHERE id = 'task-rsp-0619e'"))[0].owner_user_id;
    const n = await rows("SELECT body FROM notifications WHERE type = 'due_soon_blocked' AND entity_id = 'task-rsp-0619e' AND user_id = ? AND created_by = 'system'", owner);
    expect(n).toHaveLength(1);
    expect(n[0].body).toMatch(/^RSP .* is due in 3 days and still waiting on \d+ items?\.$/);
  });

  it('sends the monthly check-in on the first working day only', async () => {
    expect(isFirstWorkingDay('2026-11-02', ['2026-11-01'])).toBe(true); // Nov 1 is a Sunday
    expect(isFirstWorkingDay('2026-11-03', [])).toBe(false);
    expect(isFirstWorkingDay('2026-12-02', ['2026-12-01'])).toBe(true); // the 1st is a holiday
    expect(isFirstWorkingDay('2026-12-01', ['2026-12-01'])).toBe(false);
    expect(isFirstWorkingDay('2027-05-03', [])).toBe(true); // May 1 and 2 are a weekend
    // the seeded holidays include Nov 1 and Nov 2, so Tuesday Nov 3 is the first working day of November 2026
    const system = "SELECT user_id FROM notifications WHERE type = 'monthly_check_in' AND created_by = 'system'";
    await clearNotifications();
    setDevToday('2026-11-02');
    await runNotifications(world.env, 'morning', stubPush().deps, new Date('2026-11-01T23:00:00Z'));
    expect(await rows(system)).toEqual([]);
    setDevToday('2026-11-03');
    await runNotifications(world.env, 'morning', stubPush().deps, new Date('2026-11-02T23:00:00Z'));
    expect((await rows(system)).map((r) => r.user_id)).toEqual(['user-ana']);
    await clearNotifications();
    setDevToday('2026-11-04');
    await runNotifications(world.env, 'morning', stubPush().deps, new Date('2026-11-03T23:00:00Z'));
    expect(await rows(system)).toEqual([]);
  });
});

describe('evening job', () => {
  it('tells the assignee and the owner that tomorrow\'s visit is not ready, with the number of items', async () => {
    await clearNotifications();
    const visit = (await rows("SELECT id, planned_date FROM visits WHERE id = 'visit-v1'"))[0];
    setDevToday(addDaysToDate(visit.planned_date, -1));
    const result = await runNotifications(world.env, 'evening', stubPush().deps, EVENING);
    expect(result.created).toBeGreaterThan(0);
    const n = await rows("SELECT user_id, body, link FROM notifications WHERE type = 'visit_not_ready_tomorrow' AND entity_id = 'visit-v1'");
    expect(n.map((x) => x.user_id)).toEqual(['user-ana']); // she is the assignee and the owner: one notification, not two
    expect(n[0].body).toMatch(/^Tomorrow's RDO visit is not ready: \d+ items?\.$/);
    expect(n[0].link).toBe('/visits/visit-v1');
  });
});

describe('push', () => {
  const ENDPOINT = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;

  it('sends the pushes a person has switched on, to each device, and marks them pushed', async () => {
    await clearNotifications();
    await db().prepare("DELETE FROM push_subscriptions").run();
    await db().prepare("UPDATE user_prefs SET push_types = ? WHERE user_id = 'user-ana'").bind(JSON.stringify(['daily_digest', 'overdue'])).run();
    await subscribe('user-ana', ENDPOINT('ana-phone'));
    await subscribe('user-ana', ENDPOINT('ana-laptop'));
    const stub = stubPush();
    const result = await runNotifications(world.env, 'morning', stub.deps, MORNING);
    expect(result.pushed).toBeGreaterThan(0);
    // only her enabled types, once per device
    const types = new Set((await rows("SELECT type FROM notifications WHERE pushed_at IS NOT NULL AND user_id = 'user-ana'")).map((r) => r.type));
    for (const t of types) expect(['daily_digest', 'overdue']).toContain(t);
    expect(stub.posted.filter((p) => p.url.endsWith('ana-phone')).length).toBe(stub.posted.filter((p) => p.url.endsWith('ana-laptop')).length);
    expect(stub.built.every((b) => b.adminContact.startsWith('mailto:'))).toBe(true);
    // a type she did not switch on is in the app but not on the phone
    expect(await count("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'user-ana' AND type = 'follow_ups_due' AND pushed_at IS NOT NULL")).toBe(0);
  });

  it('puts only codes in the push text: no client or contact names, TINs or amounts', async () => {
    await clearNotifications();
    await db().prepare("DELETE FROM push_subscriptions").run();
    await db().prepare("UPDATE user_prefs SET push_types = ? WHERE user_id IN ('user-ana', 'user-ben')").bind(JSON.stringify(['daily_digest', 'due_soon_blocked', 'overdue', 'follow_ups_due', 'visit_not_ready_tomorrow', 'authorization_expiring'])).run();
    await subscribe('user-ana', ENDPOINT('ana-phone'));
    await subscribe('user-ben', ENDPOINT('ben-phone'));
    await db().prepare("UPDATE tasks SET due_date = ? WHERE id = 'task-rsp-0619e'").bind(addDaysToDate(TEST_SEED_DAY, 2)).run();
    const stub = stubPush();
    await runNotifications(world.env, 'morning', stub.deps, MORNING);
    expect(stub.built.length).toBeGreaterThan(0);
    const names = [
      ...(await rows('SELECT display_name, registered_name FROM clients')).flatMap((c) => [c.display_name, c.registered_name]),
      ...(await rows('SELECT name FROM contacts')).map((c) => c.name),
      ...(await rows('SELECT name FROM users')).map((u) => u.name),
    ].filter((n): n is string => typeof n === 'string' && n.length > 3);
    for (const b of stub.built) {
      expect(Object.keys(b.payload).sort()).toEqual(['body', 'tag', 'title', 'url']);
      const text = `${b.payload.title} ${b.payload.body}`;
      for (const name of names) expect(text, `"${name}" in a push`).not.toContain(name);
      expect(text).not.toMatch(/\d{3}-\d{3}-\d{3}/);
      expect(text).not.toMatch(/₱|PHP|\bP\s?\d[\d,]+\.\d{2}/);
      expect(String(b.payload.body).length).toBeLessThanOrEqual(120);
    }
  });

  it('holds a push during quiet hours and sends it when they end', async () => {
    await clearNotifications();
    await db().prepare("DELETE FROM push_subscriptions").run();
    await db().prepare("UPDATE user_prefs SET push_types = ? WHERE user_id = 'user-ana'").bind(JSON.stringify(['daily_digest'])).run();
    await subscribe('user-ana', ENDPOINT('ana-phone'));
    const quiet = stubPush();
    // the rows are made, nothing is pushed at 22:00 (quiet hours 20:00 to 07:00)
    await runNotifications(world.env, 'morning', quiet.deps, QUIET);
    expect(quiet.posted).toHaveLength(0);
    expect(await count("SELECT COUNT(*) AS n FROM notifications WHERE type = 'daily_digest' AND created_by = 'system' AND pushed_at IS NULL")).toBeGreaterThan(0);
    // at 07:00 the same pending notification goes out
    const morning = stubPush();
    const sent = await sendDuePushes(world.env, morning.deps, MORNING);
    expect(sent.pushed).toBeGreaterThan(0);
    expect(morning.posted.length).toBeGreaterThan(0);
  });

  it('a person who never chose gets the spec defaults: the digest pushes, the monthly check-in does not', async () => {
    await clearNotifications();
    await db().prepare('DELETE FROM push_subscriptions').run();
    await db().prepare("DELETE FROM user_prefs WHERE user_id = 'user-ana'").run();
    await subscribe('user-ana', ENDPOINT('ana-phone'));
    setDevToday('2026-11-03');
    const stub = stubPush();
    await runNotifications(world.env, 'morning', stub.deps, new Date('2026-11-02T23:00:00Z'));
    const pushed = new Set((await rows("SELECT type FROM notifications WHERE user_id = 'user-ana' AND created_by = 'system' AND pushed_at IS NOT NULL")).map((r) => r.type));
    expect(pushed.has('daily_digest')).toBe(true);
    expect(pushed.has('monthly_check_in')).toBe(false);
    expect(await count("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'user-ana' AND type = 'monthly_check_in' AND created_by = 'system'")).toBe(1); // in the app, not on the phone
  });

  it('knows the quiet-hours window across midnight, and that the end minute is not quiet', () => {
    expect(inQuietHours('22:00', '20:00', '07:00')).toBe(true);
    expect(inQuietHours('03:30', '20:00', '07:00')).toBe(true);
    expect(inQuietHours('07:00', '20:00', '07:00')).toBe(false);
    expect(inQuietHours('12:00', '20:00', '07:00')).toBe(false);
    expect(inQuietHours('12:00', '13:00', '14:00')).toBe(false);
    expect(inQuietHours('13:30', '13:00', '14:00')).toBe(true);
  });

  it('removes a subscription the push service says is gone (404 or 410) and keeps one that failed with a server error', async () => {
    await clearNotifications();
    await db().prepare("DELETE FROM push_subscriptions").run();
    await db().prepare("UPDATE user_prefs SET push_types = ? WHERE user_id = 'user-ana'").bind(JSON.stringify(['daily_digest'])).run();
    for (const name of ['gone-410', 'gone-404', 'flaky-500', 'good-201']) await subscribe('user-ana', ENDPOINT(name));
    const stub = stubPush((url) => (url.endsWith('gone-410') ? 410 : url.endsWith('gone-404') ? 404 : url.endsWith('flaky-500') ? 500 : 201));
    const result = await runNotifications(world.env, 'morning', stub.deps, MORNING);
    expect(result.removedSubscriptions).toBe(2);
    const left = (await rows('SELECT endpoint FROM push_subscriptions')).map((r) => r.endpoint.split('/').pop());
    expect(left.sort()).toEqual(['flaky-500', 'good-201']);
    expect(await count("SELECT COUNT(*) AS n FROM notifications WHERE type = 'daily_digest' AND user_id = 'user-ana' AND pushed_at IS NOT NULL")).toBe(1);
  });

  it('keeps a notification pending when every device failed, and sends it next time', async () => {
    await clearNotifications();
    await db().prepare("DELETE FROM push_subscriptions").run();
    await subscribe('user-ana', ENDPOINT('only-device'));
    const failing = stubPush(() => 503);
    await runNotifications(world.env, 'morning', failing.deps, MORNING);
    expect(await count("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'user-ana' AND created_by = 'system' AND pushed_at IS NOT NULL")).toBe(0);
    const ok = stubPush();
    const again = await sendDuePushes(world.env, ok.deps, MORNING);
    expect(again.pushed).toBeGreaterThan(0);
  });

  it('does not push what was already read, or what is older than a day', async () => {
    await clearNotifications();
    await db().prepare("DELETE FROM push_subscriptions").run();
    await db().prepare("UPDATE user_prefs SET push_types = ? WHERE user_id = 'user-ana'").bind(JSON.stringify(['daily_digest'])).run();
    await subscribe('user-ana', ENDPOINT('ana-phone'));
    await runNotifications(world.env, 'morning', stubPush(() => 503).deps, MORNING);
    await db().prepare("UPDATE notifications SET read_at = 't' WHERE user_id = 'user-ana' AND created_by = 'system'").run();
    const stub = stubPush();
    expect((await sendDuePushes(world.env, stub.deps, MORNING)).pushed).toBe(0);
    await db().prepare("UPDATE notifications SET read_at = NULL, created_at = '2026-10-01T07:00:00+08:00' WHERE user_id = 'user-ana' AND created_by = 'system'").run();
    expect((await sendDuePushes(world.env, stub.deps, MORNING)).pushed).toBe(0);
  });

  it('builds a real VAPID-signed, encrypted request for a real subscription (the post is stubbed)', async () => {
    const vapid = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const pub = new Uint8Array((await crypto.subtle.exportKey('raw', vapid.publicKey)) as ArrayBuffer);
    const jwk = (await crypto.subtle.exportKey('jwk', vapid.privateKey)) as JsonWebKey;
    const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const env = { ...world.env, VAPID_PUBLIC_KEY: b64url(pub), VAPID_PRIVATE_KEY: jwk.d! };
    expect(vapidJwk(env)).toMatchObject({ kty: 'EC', crv: 'P-256', d: jwk.d });

    const browser = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const p256dh = b64url(new Uint8Array((await crypto.subtle.exportKey('raw', browser.publicKey)) as ArrayBuffer));
    const auth = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const posted: Array<{ url: string; init: RequestInit }> = [];
    const deps = { ...realPushDeps(), fetch: async (url: string, init: RequestInit) => (posted.push({ url, init }), { status: 201 }) };
    const result = await sendPush(deps, env, { id: 's1', endpoint: ENDPOINT('real-shape'), p256dh, auth }, { title: 'Hello', body: 'RSP 1601-EQ is overdue.', url: '/tasks/x', tag: 'overdue' }, 'mailto:owner@example.org');
    expect(result).toBe('sent');
    expect(posted).toHaveLength(1);
    const headers = new Headers(posted[0].init.headers);
    expect(headers.get('authorization')).toMatch(/^vapid t=.+, k=.+$/);
    expect(headers.get('content-encoding')).toMatch(/^aes(128)?gcm$/);
    // the body is encrypted: the text is not in it
    expect(new TextDecoder().decode(posted[0].init.body as ArrayBuffer)).not.toContain('overdue');
  });

  it('only accepts the addresses of real push services', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.example.com/x', 'https://localhost/x', 'https://169.254.169.254/x', 'https://fcm.googleapis.com.evil.com/x', 'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'not a url']) {
      expect(isPushEndpoint(bad), bad).toBe(false);
    }
  });
});
