import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONAS, openWorld, type World } from '../testing/world';

/**
 * U38: every update carries the version it was made from. `If-Match: *` ("any version") is honoured only where the dev sign-in is
 * enabled (a local dev server); in preview and production an update without a real version is a 422 and a stale one a 409.
 */
let world: World;
let cookie: string;
let n = 0;

beforeAll(async () => {
  world = await openWorld({ devAuth: true });
  cookie = await world.cookieFor(PERSONAS.owner);
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

const ENVIRONMENTS = [
  ['preview', { APP_ENV: 'preview' }],
  ['production', { APP_ENV: 'production' }],
] as const;

async function patch(path: string, body: unknown, ifMatch: string | undefined, env: Record<string, unknown> = {}, method = 'PATCH') {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'Idempotency-Key': `u38-${++n}-${crypto.randomUUID()}` };
  if (ifMatch !== undefined) headers['If-Match'] = ifMatch;
  const res = await world.request(path, { method, headers, body: JSON.stringify(body), cookie, env: env as never });
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null };
}

describe('U38 If-Match: * is for a local dev server only', () => {
  for (const [name, env] of ENVIRONMENTS) {
    it(`in ${name}: "*" and a missing version are 422, a stale version is 409, the real version works`, async () => {
      const id = 'client-maria';
      const current = (await patch(`/api/v1/clients/${id}`, { notes: `${name} setup` }, '*')).json as { version: number };
      expect(current.version).toBeGreaterThan(0);

      const star = await patch(`/api/v1/clients/${id}`, { notes: 'with a star' }, '*', env);
      expect(star.status).toBe(422);
      expect(star.text).toContain('If-Match');
      const none = await patch(`/api/v1/clients/${id}`, { notes: 'with nothing' }, undefined, env);
      expect(none.status).toBe(422);

      const stale = await patch(`/api/v1/clients/${id}`, { notes: 'stale' }, `"${current.version - 1}"`, env);
      expect(stale.status).toBe(409);
      expect(stale.json.error).toMatchObject({ code: 'VERSION_CONFLICT', current: { id } });

      const ok = await patch(`/api/v1/clients/${id}`, { notes: `${name} real version` }, `"${current.version}"`, env);
      expect(ok.status).toBe(200);
      expect(ok.json.version).toBe(current.version + 1);
      const stored = await world.env.DB.prepare('SELECT notes FROM clients WHERE id = ?').bind(id).first<{ notes: string }>();
      expect(stored?.notes).toBe(`${name} real version`); // neither refused call wrote anything
    });
  }

  for (const [name, env] of ENVIRONMENTS) {
    it(`in ${name}: the next action needs the task's version (422 without one, 409 when stale), and a refused edit changes nothing`, async () => {
      const id = 'task-rsp-0619e';
      const url = `/api/v1/tasks/${id}/next-action`;
      const first = await patch(url, { next: { text: `${name} first`, owner: 'operator' } }, '*', {}, 'PUT'); // local, dev sign-in on
      expect(first.status).toBe(200);
      const version = (first.json as { version: number }).version;

      const star = await patch(url, { next: { text: 'with a star', owner: 'operator' } }, '*', env, 'PUT');
      expect(star.status).toBe(422);
      expect(star.text).toContain('If-Match');
      const none = await patch(url, { next: { text: 'with nothing', owner: 'operator' } }, undefined, env, 'PUT');
      expect(none.status).toBe(422);
      const stale = await patch(url, { next: { text: 'stale', owner: 'operator' } }, `"${version - 1}"`, env, 'PUT');
      expect(stale.status).toBe(409);
      expect(stale.json.error).toMatchObject({ code: 'VERSION_CONFLICT', current: { id } });

      const ok = await patch(url, { next: { text: `${name} real version`, owner: 'operator' } }, `"${version}"`, env, 'PUT');
      expect(ok.status).toBe(200);
      expect(ok.json.nextAction.text).toBe(`${name} real version`);
    });
  }

  it('locally with the dev sign-in on, "*" still works', async () => {
    const res = await patch('/api/v1/clients/client-maria', { notes: 'local star' }, '*');
    expect(res.status).toBe(200);
  });

  it('with APP_ENV=local but the dev sign-in off, "*" is refused too', async () => {
    const res = await patch('/api/v1/clients/client-maria', { notes: 'no dev auth' }, '*', { DEV_AUTH: undefined });
    expect(res.status).toBe(422);
  });

  it('every update route (PATCH and PUT) refuses "*" outside local, so none can be called without a version', { timeout: 120_000 }, async () => {
    const routes = world.app.routes.filter((r) => (r.method === 'PATCH' || r.method === 'PUT') && r.path.startsWith('/api/v1/'));
    expect(routes.length).toBeGreaterThan(10);
    const accepted: string[] = [];
    for (const r of routes) {
      const path = r.path.replace(/:[A-Za-z]+/g, 'x-none');
      const res = await patch(path, {}, '*', { APP_ENV: 'preview' }, r.method);
      if (!(res.status === 422 && res.text.includes('If-Match'))) accepted.push(`${r.method} ${r.path} -> ${res.status} ${res.text.slice(0, 90)}`);
    }
    // The only PUT routes that name no record version, by design: a position, a flag, or a person's own preferences
    expect(accepted.map((a) => a.split(' ->')[0]).sort()).toEqual(EXEMPT);
  });
});

const EXEMPT = ['PUT /api/v1/prefs', 'PUT /api/v1/tasks/:taskId/lines/order', 'PUT /api/v1/visits/:id/packed'];
