import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONAS, openWorld, type World } from '../testing/world';

/**
 * U27 verifier: "Memberships and settings routes are owner-only in middleware". The commands also check the role, so a valid
 * request from a helper is refused either way. The middleware is what refuses a helper BEFORE the body, the version header and
 * the command's own validation are looked at: an invalid request from a helper must answer 403, not 422. If `ownerOnly` is
 * removed from a route, that route answers 422 here and its case goes red.
 */
let world: World;
let helper: string;
let n = 0;

beforeAll(async () => {
  world = await openWorld();
  helper = await world.cookieFor(PERSONAS.helper);
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

const asHelper = async (method: string, path: string, body: unknown) => {
  const res = await world.request(path, {
    method,
    headers: { 'content-type': 'application/json', 'Idempotency-Key': `v27-owner-mw-${++n}-${crypto.randomUUID()}` },
    body: JSON.stringify(body),
    cookie: helper,
  });
  return { status: res.status, body: (await res.json()) as any };
};

const routes: Array<[string, string, unknown]> = [
  ['PUT', '/api/v1/settings', {}], // no If-Match: 422 if it reaches the handler
  ['POST', '/api/v1/memberships', {}], // no email or role: 422 if it reaches the command
  ['PATCH', '/api/v1/memberships/mem-anything', {}], // no If-Match
  ['POST', '/api/v1/clients/import/preview', {}], // no rows or mapping
  ['POST', '/api/v1/clients/import/commit', {}], // no preview
  ['POST', '/api/v1/offices', {}], // no type or name
  ['PUT', '/api/v1/offices/off-rdo39', {}], // no If-Match
  ['POST', '/api/v1/visit-kit', {}], // no label
  ['PUT', '/api/v1/visit-kit/kit-stapler', {}], // no If-Match
  ['PUT', '/api/v1/baseline', {}], // no fields
  ['POST', '/api/v1/pulses', {}], // no month
];

describe('U27 owner-only groups are refused in middleware, before the body is read', () => {
  for (const [method, path, body] of routes) {
    it(`${method} ${path}: a helper with an invalid request still gets 403 FORBIDDEN`, async () => {
      const res = await asHelper(method, path, body);
      expect(res.status, JSON.stringify(res.body)).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  }
});
