import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAuth } from './auth';
import { SESSION_MAX_AGE_SECONDS } from './auth';
import { TEST_ORIGIN, TEST_SECRETS, openWorld, type World } from '../testing/world';

/** U24: Google is the only provider; the callback is /api/auth/callback/google; the cookie is HttpOnly, Secure, SameSite=Lax, 30 days. */
let world: World;
beforeAll(async () => {
  world = await openWorld({ seed: false });
}, 120_000);
afterAll(async () => {
  await world?.dispose();
});

describe('Better Auth configuration', () => {
  it('has Google as the only provider and no password or email sign-in', async () => {
    const auth = createAuth(world.env, TEST_ORIGIN);
    expect(Object.keys(auth.options.socialProviders ?? {})).toEqual(['google']);
    expect(auth.options.emailAndPassword?.enabled).toBe(false);
    // the endpoints for the other ways in do not exist
    for (const path of ['/api/auth/sign-in/email', '/api/auth/sign-up/email', '/api/auth/sign-in/magic-link']) {
      const res = await world.request(path, { method: 'POST', headers: { 'content-type': 'application/json', origin: TEST_ORIGIN }, body: JSON.stringify({ email: 'a@b.co', password: 'password-123' }) });
      expect([400, 404], path).toContain(res.status);
    }
  });

  it('sends the person to Google with the app callback, without contacting Google', async () => {
    const res = await world.request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
    });
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    const target = new URL(url);
    expect(target.origin).toBe('https://accounts.google.com');
    expect(target.searchParams.get('client_id')).toBe(TEST_SECRETS.GOOGLE_CLIENT_ID);
    expect(target.searchParams.get('redirect_uri')).toBe(`${TEST_ORIGIN}/api/auth/callback/google`);
    expect(target.searchParams.get('scope')).toMatch(/email/);
    expect(target.searchParams.get('scope')).not.toMatch(/calendar|drive|gmail|contacts/);
  });

  it('refuses a provider that is not configured', async () => {
    const res = await world.request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      body: JSON.stringify({ provider: 'github', callbackURL: '/' }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('keeps a session for 30 days from last use, renewed daily', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
    const auth = createAuth(world.env, TEST_ORIGIN);
    expect(auth.options.session).toMatchObject({ expiresIn: SESSION_MAX_AGE_SECONDS, updateAge: 24 * 60 * 60 });
    expect(auth.options.advanced?.useSecureCookies).toBe(true);
    expect(auth.options.advanced?.defaultCookieAttributes).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' });
  });

  it('answers get-session with no person when there is no cookie', async () => {
    const res = await world.request('/api/auth/get-session');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
