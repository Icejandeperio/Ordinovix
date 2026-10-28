import { describe, it, expect, afterEach } from 'vitest';
import { setDevToday } from '@/lib/dates';
import { PERSONAS, openWorld, type World } from '../testing/world';

/**
 * U30: the dev controls the frontend uses in API mode: "set today" (X-Dev-Today), "reset demo data" (POST /dev/reset), and the
 * If-Match: * of an update that names no version. The first two exist only with the dev gate open (APP_ENV=local and DEV_AUTH=1).
 */
let world: World | undefined;
afterEach(async () => {
  setDevToday(null);
  await world?.dispose();
  world = undefined;
});

const json = { 'content-type': 'application/json' };
let n = 0;
const write = (w: World, cookie: string, method: string, path: string, body: unknown, extra: Record<string, string> = {}) =>
  w.request(path, { method, headers: { ...json, 'Idempotency-Key': `dev-controls-${++n}-${crypto.randomUUID()}`, ...extra }, body: JSON.stringify(body), cookie });

describe('X-Dev-Today', () => {
  it('moves the day the Worker works with, only when the dev gate is open', { timeout: 120_000 }, async () => {
    world = await openWorld({ devAuth: true });
    const cookie = await world.cookieFor(PERSONAS.owner);
    const focus = async (header?: string) => {
      const res = await world!.request('/api/v1/today?scope=everyone', { cookie, headers: header ? { 'X-Dev-Today': header } : {} });
      return ((await res.json()) as { focusDate: string }).focusDate;
    };
    const real = await focus();
    expect(await focus('2031-03-04')).toBe('2031-03-04');
    expect(await focus()).toBe(real); // the next request without the header has the real day again
    expect(await focus('not-a-date')).toBe(real);
  });

  it('is ignored when the gate is closed', { timeout: 120_000 }, async () => {
    world = await openWorld({ devAuth: false });
    const cookie = await world.cookieFor(PERSONAS.owner);
    const focus = async (header?: string) => {
      const res = await world!.request('/api/v1/today?scope=everyone', { cookie, headers: header ? { 'X-Dev-Today': header } : {} });
      return ((await res.json()) as { focusDate: string }).focusDate;
    };
    expect(await focus('2031-03-04')).toBe(await focus());
    expect(await focus('2031-03-04')).not.toBe('2031-03-04');
  });
});

describe('POST /dev/reset', () => {
  it('puts the sample data back as it was seeded', { timeout: 180_000 }, async () => {
    world = await openWorld({ devAuth: true });
    const cookie = await world.cookieFor(PERSONAS.owner);
    const created = await write(world, cookie, 'POST', '/api/v1/clients', { code: 'RESET', displayName: 'Reset Me Co', entityType: 'solo', rdoCode: '039' });
    expect(created.status).toBe(201);
    const count = async () => (await world!.env.DB.prepare("SELECT COUNT(*) AS n FROM clients WHERE code = 'RESET'").first<{ n: number }>())!.n;
    expect(await count()).toBe(1);
    const res = await write(world, cookie, 'POST', '/api/v1/dev/reset', {});
    expect(res.status).toBe(200);
    expect(await count()).toBe(0);
    expect((await world.env.DB.prepare("SELECT COUNT(*) AS n FROM clients WHERE id = 'client-rsp'").first<{ n: number }>())!.n).toBe(1);
    // the owner can still work afterwards
    expect((await world.request('/api/v1/session/me', { cookie })).status).toBe(200);
  });

  it('also removes the people a test invited, so the same address can be invited again, and gives the sample clients a TIN to reveal', { timeout: 180_000 }, async () => {
    world = await openWorld({ devAuth: true });
    const cookie = await world.cookieFor(PERSONAS.owner);
    const invite = () => write(world!, cookie, 'POST', '/api/v1/memberships', { email: 'again.helper@example.com', role: 'helper', clientIds: ['client-rsp'], name: 'Again Helper' });
    expect((await invite()).status).toBe(201);
    expect((await invite()).status).toBe(422); // already a member
    expect((await write(world, cookie, 'POST', '/api/v1/dev/reset', {})).status).toBe(200);
    expect((await invite()).status).toBe(201);
    const left = await world.env.DB.prepare("SELECT COUNT(*) AS n FROM memberships WHERE email = 'again.helper@example.com'").first<{ n: number }>();
    expect(left!.n).toBe(1);
    expect((await world.env.DB.prepare("SELECT COUNT(*) AS n FROM memberships WHERE org_id = 'org-demo-01'").first<{ n: number }>())!.n).toBe(3);
    await write(world, cookie, 'POST', '/api/v1/dev/reset', {});
    expect((await world.env.DB.prepare("SELECT COUNT(*) AS n FROM memberships WHERE org_id = 'org-demo-01'").first<{ n: number }>())!.n).toBe(2);

    const reveal = await write(world, cookie, 'POST', '/api/v1/clients/client-horizon/reveal-tin', {});
    expect(reveal.status).toBe(200);
    expect(((await reveal.json()) as { tin: string }).tin).toMatch(/^\d{3}-\d{3}-\d{3}-\d{5}$/);
  });

  it('is a 404 with the gate closed, and changes nothing',{ timeout: 120_000 }, async () => {
    world = await openWorld({ devAuth: false });
    const cookie = await world.cookieFor(PERSONAS.owner);
    await write(world, cookie, 'POST', '/api/v1/clients', { code: 'KEEP', displayName: 'Keep Me Co', entityType: 'solo', rdoCode: '039' });
    for (const where of [cookie, undefined]) {
      const res = await world.request('/api/v1/dev/reset', { method: 'POST', headers: json, body: '{}', cookie: where });
      expect(res.status).toBe(404);
    }
    expect((await world.env.DB.prepare("SELECT COUNT(*) AS n FROM clients WHERE code = 'KEEP'").first<{ n: number }>())!.n).toBe(1);
  });
});

describe('If-Match', () => {
  it('"*" accepts an update at any version, while a stale number is still a 409 with the current record', { timeout: 180_000 }, async () => {
    world = await openWorld();
    const cookie = await world.cookieFor(PERSONAS.owner);
    const id = 'client-maria';
    const one = await write(world, cookie, 'PATCH', `/api/v1/clients/${id}`, { notes: 'first' }, { 'If-Match': '*' });
    expect(one.status).toBe(200);
    const two = await write(world, cookie, 'PATCH', `/api/v1/clients/${id}`, { notes: 'second' }, { 'If-Match': '*' });
    expect(two.status).toBe(200);
    const version = ((await two.json()) as { version: number }).version;
    const stale = await write(world, cookie, 'PATCH', `/api/v1/clients/${id}`, { notes: 'third' }, { 'If-Match': `"${version - 1}"` });
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as any).error).toMatchObject({ code: 'VERSION_CONFLICT', current: { id, notes: 'second' } });
    const none = await write(world, cookie, 'PATCH', `/api/v1/clients/${id}`, { notes: 'fourth' });
    expect(none.status).toBe(422); // a missing If-Match is still refused; only an explicit "*" skips the check
  });
});
