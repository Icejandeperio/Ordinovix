import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAuthFailureHandler } from '../auth-events';
import { clearPendingSignOut, hasPendingSignOut, setPendingSignOut } from '@/lib/pending-sign-out';
import { flushPendingSignOut, request } from './http';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('window', {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setAuthFailureHandler(undefined);
});

describe('U41 a pending sign-out', () => {
  it('sends no other request while it is pending and the server cannot be reached', async () => {
    setPendingSignOut();
    const fetchMock = vi.fn(async () => {
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', fetchMock);
    const failures: string[] = [];
    setAuthFailureHandler((f) => failures.push(f));

    await expect(request('GET', '/api/v1/today')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual(['/api/auth/sign-out']); // only the sign-out was tried
    expect(hasPendingSignOut()).toBe(true);
    expect(failures).toEqual(['unauthenticated']);
  });

  it('sends the server sign-out first, removes the marker, and then lets requests go', async () => {
    setPendingSignOut();
    const fetchMock = vi.fn(async (path: string) => (path === '/api/auth/sign-out' ? json(200, {}) : json(401, { error: { code: 'UNAUTHENTICATED', message: 'no' } })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('GET', '/api/v1/today')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual(['/api/auth/sign-out', '/api/v1/today']);
    expect(hasPendingSignOut()).toBe(false);
  });

  it('counts a session that is already gone (401) as signed out', async () => {
    setPendingSignOut();
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { error: { code: 'UNAUTHENTICATED', message: 'no' } })));
    await flushPendingSignOut();
    expect(hasPendingSignOut()).toBe(false);
  });

  it('keeps the marker when the server answers an error', async () => {
    setPendingSignOut();
    vi.stubGlobal('fetch', vi.fn(async () => json(500, { error: { code: 'INTERNAL', message: 'x' } })));
    await flushPendingSignOut();
    expect(hasPendingSignOut()).toBe(true);
  });

  it('does nothing when no sign-out is owed', async () => {
    clearPendingSignOut();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await flushPendingSignOut();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('holds back a sign-in too until the earlier sign-out has reached the server', async () => {
    setPendingSignOut();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(request('POST', '/api/auth/sign-in/social', { body: {}, bootstrap: true })).rejects.toThrow(/sign-out has not reached/);
  });
});
