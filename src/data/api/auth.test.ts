import { describe, expect, it, vi } from 'vitest';
import { setAuthFailureHandler } from '../auth-events';
import { request } from './http';
import { fetchSignedInEmail, requestGoogleSignIn } from './auth';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('U39 Google sign-in request', () => {
  it('posts the provider and the callback to Better Auth and returns the URL the server answers with', async () => {
    const fetchImpl = vi.fn(async () => json(200, { url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=abc', redirect: true }));
    const url = await requestGoogleSignIn('/tasks', fetchImpl as unknown as typeof fetch);
    expect(url).toBe('https://accounts.google.com/o/oauth2/v2/auth?client_id=abc');
    const [path, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/auth/sign-in/social');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ provider: 'google', callbackURL: '/tasks' });
  });

  it('fails when the server answers an error, no URL, or a URL that is not http(s)', async () => {
    const run = (res: () => Response) => requestGoogleSignIn('/', vi.fn(async () => res()) as unknown as typeof fetch);
    await expect(run(() => json(500, { message: 'boom' }))).rejects.toThrow();
    await expect(run(() => json(200, {}))).rejects.toThrow(/sign-in/i);
    await expect(run(() => json(200, { url: 'javascript:alert(1)' }))).rejects.toThrow(/sign-in/i);
  });
});

describe('U39 the signed-in address on the access-pending page', () => {
  it('reads the email from the Better Auth session', async () => {
    const fetchImpl = vi.fn(async () => json(200, { session: {}, user: { email: 'pat@example.org' } }));
    await expect(fetchSignedInEmail(fetchImpl as unknown as typeof fetch)).resolves.toBe('pat@example.org');
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('/api/auth/get-session');
  });

  it('is undefined when there is no session or the call fails', async () => {
    await expect(fetchSignedInEmail((async () => json(200, null)) as unknown as typeof fetch)).resolves.toBeUndefined();
    await expect(
      fetchSignedInEmail((async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch),
    ).resolves.toBeUndefined();
  });
});

describe('U39 a request that is refused for want of a session tells the app', () => {
  const answer = (status: number, code: string) => (async () => json(status, { error: { code, message: 'x' } })) as unknown as typeof fetch;

  it('401 UNAUTHENTICATED reports "unauthenticated" and still rejects', async () => {
    const seen: string[] = [];
    setAuthFailureHandler((k) => seen.push(k));
    await expect(request('GET', '/api/v1/tasks', { fetchImpl: answer(401, 'UNAUTHENTICATED') })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(seen).toEqual(['unauthenticated']);
    setAuthFailureHandler(undefined);
  });

  it('403 ACCESS_PENDING reports "access-pending"; an ordinary 403 reports nothing', async () => {
    const seen: string[] = [];
    setAuthFailureHandler((k) => seen.push(k));
    await expect(request('GET', '/api/v1/tasks', { fetchImpl: answer(403, 'ACCESS_PENDING') })).rejects.toMatchObject({ code: 'ACCESS_PENDING' });
    await expect(request('GET', '/api/v1/clients/x', { fetchImpl: answer(403, 'FORBIDDEN') })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(seen).toEqual(['access-pending']);
    setAuthFailureHandler(undefined);
  });
});
