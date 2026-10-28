import { describe, it, expect, afterEach } from 'vitest';
import { openWorld, type World } from '../testing/world';

/** U24: dev sign-in as a seed persona exists only for APP_ENV=local with DEV_AUTH=1; everywhere else it is a 404. */
let world: World | undefined;
afterEach(async () => {
  await world?.dispose();
  world = undefined;
});

const signIn = (w: World, persona: unknown, env: Parameters<World['request']>[1] = {}) =>
  w.request('/api/v1/dev/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ persona }), ...env });

describe('dev sign-in (APP_ENV=local, DEV_AUTH=1)', () => {
  it('signs in as the owner Ana, and the cookie it sets opens /session/me as her', { timeout: 120_000 }, async () => {
    world = await openWorld({ devAuth: true });
    const res = await signIn(world, 'owner');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, persona: 'owner', userId: 'user-ana' });
    const setCookie = res.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Max-Age=2592000/);
    const me = await world.request('/api/v1/session/me', { cookie: setCookie.split(';')[0] });
    expect(me.status).toBe(200);
    expect(((await me.json()) as any).membership).toMatchObject({ id: 'mem-ana', role: 'owner' });
  });

  it('signs in as the helper Ben with his two clients', { timeout: 120_000 }, async () => {
    world = await openWorld({ devAuth: true });
    const res = await signIn(world, 'helper');
    expect(res.status).toBe(200);
    const me = await world.request('/api/v1/session/me', { cookie: res.headers.get('set-cookie')!.split(';')[0] });
    const body = (await me.json()) as any;
    expect(body.membership).toMatchObject({ id: 'mem-ben', role: 'helper' });
    expect([...body.membership.clientIds].sort()).toEqual(['client-cruz', 'client-rsp']);
  });

  it('refuses a persona that does not exist', { timeout: 120_000 }, async () => {
    world = await openWorld({ devAuth: true });
    expect((await signIn(world, 'admin')).status).toBe(422);
    expect((await signIn(world, undefined)).status).toBe(422);
  });
});

describe('dev sign-in is a 404 everywhere else', () => {
  const cases: Array<[string, { appEnv: 'local' | 'preview' | 'production'; devAuth: boolean }]> = [
    ['preview with DEV_AUTH=1', { appEnv: 'preview', devAuth: true }],
    ['production with DEV_AUTH=1', { appEnv: 'production', devAuth: true }],
    ['preview configuration', { appEnv: 'preview', devAuth: false }],
    ['production configuration', { appEnv: 'production', devAuth: false }],
    ['local without DEV_AUTH', { appEnv: 'local', devAuth: false }],
  ];
  for (const [label, options] of cases) {
    it(`${label}`, { timeout: 120_000 }, async () => {
      world = await openWorld(options);
      const res = await signIn(world, 'owner');
      expect(res.status).toBe(404);
      expect(res.headers.get('set-cookie')).toBeNull();
      expect(((await res.json()) as any).error.code).toBe('NOT_FOUND');
      // no session was created
      expect((await world.env.DB.prepare('SELECT COUNT(*) AS n FROM session').first<any>()).n).toBe(0);
    });
  }

  it('also holds when the deployed wrangler configuration is read: preview and production never set DEV_AUTH', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8')).not.toMatch(/DEV_AUTH/);
  });
});
