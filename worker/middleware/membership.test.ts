import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONAS, addMembership, openWorld, type World } from '../testing/world';

/**
 * U24: the membership middleware loads organization, role, assigned clients and active on every /api/v1 request.
 * The five cases of .claude/rules/backend.md: owner, helper, (a helper on an unassigned client is a route-level case from U25),
 * revoked membership and no membership.
 */
let world: World;
beforeAll(async () => {
  world = await openWorld();
}, 120_000);
afterAll(async () => {
  await world?.dispose();
});

const body = async (res: Response) => (await res.json()) as any;

describe('GET /api/v1/session/me', () => {
  it('is 401 without a session cookie, and says nothing else', async () => {
    const res = await world.request('/api/v1/session/me');
    expect(res.status).toBe(401);
    expect((await body(res)).error.code).toBe('UNAUTHENTICATED');
  });

  it('is 401 for a cookie that is not a session (forged signature, unknown token)', async () => {
    const forged = await world.request('/api/v1/session/me', { cookie: '__Secure-better-auth.session_token=abc.def' });
    expect(forged.status).toBe(401);
    const real = await world.cookieFor(PERSONAS.owner);
    const tampered = real.replace(/(session_token=)(.)/, '$1x');
    expect((await world.request('/api/v1/session/me', { cookie: tampered })).status).toBe(401);
  });

  it('owner: returns the user, membership, organization, settings and preferences the app needs', async () => {
    const res = await world.request('/api/v1/session/me', { cookie: await world.cookieFor(PERSONAS.owner) });
    expect(res.status).toBe(200);
    const me = await body(res);
    expect(me.user).toMatchObject({ id: 'user-ana', email: 'ana@example.com' });
    expect(me.membership).toMatchObject({ id: 'mem-ana', role: 'owner', active: true, orgId: 'org-demo-01', clientIds: [] });
    expect(me.org).toMatchObject({ id: 'org-demo-01', isDemo: true });
    expect(me.settings).toMatchObject({ orgId: 'org-demo-01', helpersCanAccept: true });
    expect(me.settings.quietHours).toEqual({ start: expect.any(String), end: expect.any(String) });
    expect(typeof me.settings.version).toBe('number');
    expect(me.prefs.userId).toBe('user-ana');
    expect(me.prefs.theme).toBeDefined();
  });

  it('helper: carries the assigned clients and nothing else', async () => {
    const res = await world.request('/api/v1/session/me', { cookie: await world.cookieFor(PERSONAS.helper) });
    expect(res.status).toBe(200);
    const me = await body(res);
    expect(me.membership).toMatchObject({ id: 'mem-ben', role: 'helper', active: true });
    expect([...me.membership.clientIds].sort()).toEqual(['client-cruz', 'client-rsp']);
  });

  it('no membership: 403 ACCESS_PENDING', async () => {
    const stranger = { id: 'ba-stranger', name: 'Sam Stranger', email: 'stranger@example.com' };
    const res = await world.request('/api/v1/session/me', { cookie: await world.cookieFor(stranger) });
    expect(res.status).toBe(403);
    expect((await body(res)).error.code).toBe('ACCESS_PENDING');
  });

  it('revoked membership: 403 FORBIDDEN, no data', async () => {
    await addMembership(world, { id: 'mem-carl', email: 'carl@example.com', role: 'helper', userId: 'user-carl', active: false, revoked: true, clientIds: ['client-rsp'] });
    const res = await world.request('/api/v1/session/me', { cookie: await world.cookieFor({ id: 'user-carl', name: 'Carl', email: 'carl@example.com' }) });
    expect(res.status).toBe(403);
    const error = (await body(res)).error;
    expect(error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(error)).not.toContain('client-rsp');
  });

  it('a membership that is soft-deleted is no membership', async () => {
    await addMembership(world, { id: 'mem-dina', email: 'dina@example.com', role: 'helper', userId: 'user-dina' });
    await world.env.DB.prepare("UPDATE memberships SET deleted_at = 't', deleted_reason = 'left' WHERE id = 'mem-dina'").run();
    const res = await world.request('/api/v1/session/me', { cookie: await world.cookieFor({ id: 'user-dina', name: 'Dina', email: 'dina@example.com' }) });
    expect((await body(res)).error.code).toBe('ACCESS_PENDING');
  });
});

describe('first sign-in links the allowlisted email to the person', () => {
  it('links user_id, accepted_at and the app profile on the first request, and the person then has access', async () => {
    await addMembership(world, { id: 'mem-new', email: 'New.Owner@Example.org', role: 'owner', userId: null });
    const person = { id: 'ba-new-owner', name: 'New Owner', email: 'new.owner@example.org' };
    const res = await world.request('/api/v1/session/me', { cookie: await world.cookieFor(person) });
    expect(res.status).toBe(200);
    const row = await world.env.DB.prepare("SELECT user_id, accepted_at, version FROM memberships WHERE id = 'mem-new'").first<any>();
    expect(row.user_id).toBe('ba-new-owner');
    expect(row.accepted_at).toBeTruthy();
    expect(row.version).toBe(2);
    const profile = await world.env.DB.prepare("SELECT email, initials FROM users WHERE id = 'ba-new-owner'").first<any>();
    expect(profile).toMatchObject({ email: 'new.owner@example.org', initials: 'NO' });
    // a second request does not link again
    await world.request('/api/v1/session/me', { cookie: await world.cookieFor(person) });
    expect((await world.env.DB.prepare("SELECT version FROM memberships WHERE id = 'mem-new'").first<any>()).version).toBe(2);
  });

  it('does not link on an unverified email', async () => {
    await addMembership(world, { id: 'mem-unv', email: 'unverified@example.org', role: 'owner', userId: null });
    const res = await world.request('/api/v1/session/me', {
      cookie: await world.cookieFor({ id: 'ba-unv', name: 'Un Verified', email: 'unverified@example.org', emailVerified: false }),
    });
    expect((await body(res)).error.code).toBe('ACCESS_PENDING');
    expect((await world.env.DB.prepare("SELECT user_id FROM memberships WHERE id = 'mem-unv'").first<any>()).user_id).toBeNull();
  });

  it('never takes over an entry that is already linked to somebody else', async () => {
    await addMembership(world, { id: 'mem-taken', email: 'taken@example.org', role: 'owner', userId: 'user-first' });
    const res = await world.request('/api/v1/session/me', { cookie: await world.cookieFor({ id: 'ba-second', name: 'Second Person', email: 'taken@example.org' }) });
    expect((await body(res)).error.code).toBe('ACCESS_PENDING');
    expect((await world.env.DB.prepare("SELECT user_id FROM memberships WHERE id = 'mem-taken'").first<any>()).user_id).toBe('user-first');
  });
});

describe('every /api/v1 route is behind the session and the membership', () => {
  it('an unknown path is 401 when signed out and a JSON 404 when signed in', async () => {
    expect((await world.request('/api/v1/nope')).status).toBe(401);
    const res = await world.request('/api/v1/nope', { cookie: await world.cookieFor(PERSONAS.owner) });
    expect(res.status).toBe(404);
  });

  it('the health route stays open', async () => {
    expect((await world.request('/api/v1/health')).status).toBe(200);
  });
});
