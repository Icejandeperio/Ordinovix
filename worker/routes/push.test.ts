import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { stubPush } from '../push/stub';
import { PERSONAS, TEST_SECRETS, addMembership, openWorld, type World } from '../testing/world';

/** U29: a person saves, removes and tests the push subscriptions of their own devices; only real push services are accepted. */
let world: World;
const stub = stubPush((url) => (url.endsWith('gone') ? 410 : 201));
const cookie: Record<string, string> = {};
let n = 0;

beforeAll(async () => {
  world = await openWorld({ push: stub.deps });
  cookie.owner = await world.cookieFor(PERSONAS.owner);
  cookie.helper = await world.cookieFor(PERSONAS.helper);
  await addMembership(world, { id: 'mem-rev', email: 'rev@example.com', role: 'helper', userId: 'user-rev', active: false, revoked: true, clientIds: ['client-rsp'] });
  cookie.revoked = await world.cookieFor({ id: 'user-rev', name: 'Rev Oked', email: 'rev@example.com' });
  cookie.none = await world.cookieFor({ id: 'ba-none', name: 'No Member', email: 'none@example.com' });
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const sub = (name: string, extra: Record<string, unknown> = {}) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, keys: KEYS, ...extra });

async function call(who: keyof typeof cookie | 'nobody', method: string, path: string, body?: unknown, key = true) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) headers['Idempotency-Key'] = `push-key-${++n}-${crypto.randomUUID()}`;
  const res = await world.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cookie: who === 'nobody' ? undefined : cookie[who] });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const subs = async (userId?: string) => (await world.env.DB.prepare(userId ? 'SELECT * FROM push_subscriptions WHERE user_id = ?' : 'SELECT * FROM push_subscriptions').bind(...(userId ? [userId] : [])).all<any>()).results;

describe('GET /push/vapid-key', () => {
  it('returns the public key, which is not a secret', async () => {
    const r = await call('helper', 'GET', '/api/v1/push/vapid-key', undefined, false);
    expect(r.status).toBe(200);
    expect(r.body.publicKey).toBe(TEST_SECRETS.VAPID_PUBLIC_KEY);
    expect(JSON.stringify(r.body)).not.toContain(TEST_SECRETS.VAPID_PRIVATE_KEY);
  });
});

describe('POST /push/subscriptions', () => {
  it('saves the device for the signed-in person, and subscribing again from the same device replaces it', async () => {
    const first = await call('helper', 'POST', '/api/v1/push/subscriptions', sub('ben-phone'));
    expect(first.status).toBe(201);
    expect(await subs('user-ben')).toHaveLength(1);
    const again = await call('helper', 'POST', '/api/v1/push/subscriptions', sub('ben-phone', { keys: { ...KEYS, auth: 'a-new-auth-secret-123456' } }));
    expect(again.status).toBe(201);
    const rows = await subs('user-ben');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ org_id: 'org-demo-01', auth: 'a-new-auth-secret-123456' });
  });

  it('needs an Idempotency-Key, and a repeated key saves nothing twice', async () => {
    expect((await call('helper', 'POST', '/api/v1/push/subscriptions', sub('no-key'), false)).status).toBe(422);
    const headers = { 'content-type': 'application/json', 'Idempotency-Key': 'push-idem-key-1' };
    const post = () => world.request('/api/v1/push/subscriptions', { method: 'POST', headers, body: JSON.stringify(sub('idem-device')), cookie: cookie.helper });
    expect((await post()).status).toBe(201);
    const replay = await post();
    expect(replay.status).toBe(201);
    expect(replay.headers.get('Idempotent-Replay')).toBe('true');
    expect((await subs('user-ben')).filter((r) => r.endpoint.endsWith('idem-device'))).toHaveLength(1);
  });

  it('refuses an address that is not a push service, so the Worker never posts to one of someone\'s choosing', async () => {
    const before = (await subs()).length;
    for (const endpoint of ['http://fcm.googleapis.com/x', 'https://evil.example.com/hook', 'https://localhost/x', 'https://169.254.169.254/latest', 'https://fcm.googleapis.com.evil.com/x', 'https://user:pw@fcm.googleapis.com/x', 'ftp://fcm.googleapis.com/x', '']) {
      const r = await call('helper', 'POST', '/api/v1/push/subscriptions', { endpoint, keys: KEYS });
      expect(r.status, endpoint).toBe(422);
      expect(Object.keys(r.body.error.fields)).toContain('endpoint');
    }
    expect((await subs()).length).toBe(before);
  });

  it('refuses missing or malformed keys and unknown fields', async () => {
    expect((await call('helper', 'POST', '/api/v1/push/subscriptions', { endpoint: sub('x').endpoint })).status).toBe(422);
    expect((await call('helper', 'POST', '/api/v1/push/subscriptions', { endpoint: sub('x').endpoint, keys: { p256dh: 'short', auth: 'short' } })).status).toBe(422);
    expect((await call('helper', 'POST', '/api/v1/push/subscriptions', { ...sub('x'), userId: 'user-ana' })).status).toBe(422);
  });

  it('a device already registered to someone else moves to the person who subscribes from it now (it is one browser)', async () => {
    await call('owner', 'POST', '/api/v1/push/subscriptions', sub('shared-tablet'));
    await call('helper', 'POST', '/api/v1/push/subscriptions', sub('shared-tablet'));
    const rows = (await subs()).filter((r) => r.endpoint.endsWith('shared-tablet'));
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe('user-ben');
  });
});

describe('DELETE /push/subscriptions', () => {
  it('removes the person\'s own device, and cannot remove another person\'s', async () => {
    await call('owner', 'POST', '/api/v1/push/subscriptions', sub('ana-phone'));
    const refused = await call('helper', 'DELETE', `/api/v1/push/subscriptions?endpoint=${encodeURIComponent(sub('ana-phone').endpoint)}`);
    expect(refused.status).toBe(200); // nothing of his to remove
    expect((await subs('user-ana')).some((r) => r.endpoint.endsWith('ana-phone'))).toBe(true);
    const own = await call('owner', 'DELETE', `/api/v1/push/subscriptions?endpoint=${encodeURIComponent(sub('ana-phone').endpoint)}`);
    expect(own.status).toBe(200);
    expect((await subs('user-ana')).some((r) => r.endpoint.endsWith('ana-phone'))).toBe(false);
  });

  it('needs an endpoint', async () => {
    expect((await call('owner', 'DELETE', '/api/v1/push/subscriptions')).status).toBe(422);
  });
});

describe('POST /push/test', () => {
  it('sends a short test to each of the person\'s devices, and drops one the service says is gone', async () => {
    await call('owner', 'POST', '/api/v1/push/subscriptions', sub('ana-test-1'));
    await call('owner', 'POST', '/api/v1/push/subscriptions', sub('gone'));
    stub.posted.length = 0;
    stub.built.length = 0;
    const r = await call('owner', 'POST', '/api/v1/push/test', {});
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ devices: 2, sent: 1, removed: 1 });
    expect(stub.built.every((b) => b.payload.tag === 'test' && !JSON.stringify(b.payload).match(/Ana|Santos/))).toBe(true);
    expect((await subs('user-ana')).some((s) => s.endpoint.endsWith('/gone'))).toBe(false);
  });

  it('sends nothing for a person with no devices, and never to another person\'s', async () => {
    await world.env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = 'user-ben'").run();
    stub.posted.length = 0;
    expect((await call('helper', 'POST', '/api/v1/push/test', {})).body).toEqual({ devices: 0, sent: 0, removed: 0 });
    expect(stub.posted).toHaveLength(0);
  });
});

describe('who may use the push routes', () => {
  const routes: Array<[string, string, unknown]> = [
    ['GET', '/api/v1/push/vapid-key', undefined],
    ['POST', '/api/v1/push/subscriptions', sub('perm-device')],
    ['DELETE', `/api/v1/push/subscriptions?endpoint=${encodeURIComponent(sub('perm-device').endpoint)}`, undefined],
    ['POST', '/api/v1/push/test', {}],
  ];
  for (const [method, path, body] of routes) {
    it(`${method} ${path.split('?')[0]}: owner and helper yes; revoked, no membership and no session no`, async () => {
      const send = (who: keyof typeof cookie | 'nobody') => call(who, method, path, body, method !== 'GET');
      expect((await send('owner')).status).toBeLessThan(300);
      expect((await send('helper')).status).toBeLessThan(300);
      const revoked = await send('revoked');
      expect(revoked.status).toBe(403);
      expect(revoked.body.error.code).toBe('FORBIDDEN');
      const none = await send('none');
      expect(none.status).toBe(403);
      expect(none.body.error.code).toBe('ACCESS_PENDING');
      expect((await send('nobody')).status).toBe(401);
    });
  }
});
