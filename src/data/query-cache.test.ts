import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { CACHE_BUSTER, CACHE_MAX_AGE_MS, createQueryCache, isPersistableKey, memoryStorage, scrub, snapshot } from './query-cache';

/**
 * U40: the saved query cache belongs to one person, never outlives 24 hours, and never holds a TIN reveal or a document link.
 * Storage is in memory here; the real one is idb-keyval over IndexedDB.
 */
const T0 = Date.parse('2026-10-28T10:00:00+08:00');
const HOUR = 60 * 60 * 1000;
const ANA = { user: { id: 'user-ana' }, org: { id: 'org-main' } };
const BEN = { user: { id: 'user-ben' }, org: { id: 'org-main' } };

function setup(session: typeof ANA | null = ANA, opts: { now?: () => number; offline?: boolean; storage?: ReturnType<typeof memoryStorage> } = {}) {
  const client = new QueryClient();
  const storage = opts.storage ?? memoryStorage();
  let clock = T0;
  const now = opts.now ?? (() => clock);
  const cache = createQueryCache({ client, storage, now, isOffline: () => opts.offline ?? false, throttleMs: 5 });
  if (session) client.setQueryData(['session'], session, { updatedAt: now() });
  return { client, storage, cache, tick: (ms: number) => (clock += ms) };
}

const put = (client: QueryClient, key: unknown[], data: unknown, updatedAt = T0) => client.setQueryData(key, data, { updatedAt });
const todayData = { items: [{ id: 'task-1', title: 'BIR 0619-E' }] };

describe('U40 what is saved', () => {
  it('keeps only the allowlisted roots, never the session, notifications or a search-keyed query', () => {
    const { client } = setup();
    put(client, ['today', 'everyone'], todayData);
    put(client, ['tasks', { status: 'open' }], { items: [] });
    put(client, ['visits', undefined], { items: [] });
    put(client, ['clients', { status: 'active' }], { items: [{ client: { id: 'client-rsp' } }] });
    put(client, ['client', 'client-rsp'], { id: 'client-rsp' });
    put(client, ['calendar', '2026-10-01', '2026-10-31'], []);
    put(client, ['notifications'], [{ title: 'secret' }]);
    put(client, ['documents', {}], []);
    put(client, ['clients', { search: 'rivera' }], { items: [] });
    put(client, ['tasks', { q: 'rivera' }], { items: [] });
    const kept = snapshot(client, T0).queries.map((q) => q.queryKey[0]);
    expect(kept.sort()).toEqual(['calendar', 'client', 'clients', 'tasks', 'today', 'visits']);
    expect(isPersistableKey(['session'])).toBe(false);
    expect(isPersistableKey(['clients', { search: 'x' }])).toBe(false);
  });

  it('holds no mutation, and nothing older than 24 hours', () => {
    const { client } = setup();
    put(client, ['today', 'everyone'], todayData, T0 - 25 * HOUR);
    put(client, ['tasks', {}], { items: [] }, T0 - 23 * HOUR);
    const state = snapshot(client, T0);
    expect(state.mutations).toEqual([]);
    expect(state.queries.map((q) => q.queryKey[0])).toEqual(['tasks']);
  });

  it('cuts a revealed TIN and a signed document link out of a kept query, wherever they sit', () => {
    const { client } = setup();
    put(client, ['client', 'client-rsp'], {
      id: 'client-rsp',
      tinMasked: '•••-•••-789-00000',
      tinFull: '123-456-789-00000',
      documents: [
        { id: 'd1', displayName: 'ID', url: 'https://files.example/d1?X-Amz-Signature=abc&X-Amz-Expires=300', signedUrl: 'x' },
        { id: 'd2', downloadUrl: 'https://files.example/d2', thumbUrl: 'blob:https://app/1', mapLink: 'https://maps.example/rdo39' },
      ],
    });
    const json = JSON.stringify(snapshot(client, T0));
    expect(json).not.toContain('123-456-789-00000');
    expect(json).not.toContain('tinFull');
    expect(json).not.toMatch(/X-Amz|signedUrl|downloadUrl|thumbUrl|blob:/);
    expect(json).toContain('•••-•••-789-00000'); // the masked form is the one that is kept
    expect(json).toContain('https://maps.example/rdo39'); // an ordinary link is not a signed one
    expect(scrub({ a: { tinFull: 'x', b: 1 } })).toEqual({ a: { b: 1 } });
  });
});

describe('U40 whose it is, and for how long', () => {
  it('saves for the signed-in person and restores it into a fresh client', async () => {
    const a = setup();
    put(a.client, ['today', 'everyone'], todayData);
    await a.cache.flush();
    expect(await a.storage.keys()).toEqual(expect.arrayContaining(['cache:user-ana:org-main', 'identity']));

    const b = setup(ANA, { storage: a.storage });
    expect(await b.cache.restore({ userId: 'user-ana', orgId: 'org-main' })).toBe(1);
    expect(b.client.getQueryData(['today', 'everyone'])).toEqual(todayData);
  });

  it('another account on the same device restores nothing, and the first account\'s copy is deleted', async () => {
    const a = setup();
    put(a.client, ['today', 'everyone'], todayData);
    await a.cache.flush();

    const ben = setup(null, { storage: a.storage });
    await ben.cache.start();
    ben.client.setQueryData(['session'], BEN); // Ben's session loads: the cache learns who is signed in
    await new Promise((r) => setTimeout(r, 30));
    expect(ben.client.getQueryData(['today', 'everyone'])).toBeUndefined();
    expect(await a.storage.keys()).toEqual([]); // her copy and the marker that names her
    expect(await ben.cache.restore({ userId: 'user-ben', orgId: 'org-main' })).toBe(0);
    ben.cache.stop();
  });

  it('a copy saved more than 24 hours ago is not restored and is deleted', async () => {
    const a = setup();
    put(a.client, ['today', 'everyone'], todayData);
    await a.cache.flush();
    const later = setup(ANA, { storage: a.storage, now: () => T0 + CACHE_MAX_AGE_MS + 1 });
    expect(await later.cache.restore({ userId: 'user-ana', orgId: 'org-main' })).toBe(0);
    expect(await a.storage.keys()).not.toContain('cache:user-ana:org-main');
  });

  it('inside a fresh copy, a query fetched more than 24 hours ago is still left out', async () => {
    const a = setup();
    put(a.client, ['today', 'everyone'], todayData, T0 - 2 * HOUR);
    put(a.client, ['tasks', {}], { items: [] }, T0 - 1 * HOUR);
    await a.cache.flush();
    const later = setup(ANA, { storage: a.storage, now: () => T0 + 23 * HOUR }); // today is now 25 h old, tasks 24 h
    expect(await later.cache.restore({ userId: 'user-ana', orgId: 'org-main' })).toBe(1);
    expect(later.client.getQueryData(['today', 'everyone'])).toBeUndefined();
    expect(later.client.getQueryData(['tasks', {}])).toEqual({ items: [] });
  });

  it('a copy from another build (buster) or another owner is dropped', async () => {
    const storage = memoryStorage();
    await storage.set('cache:user-ana:org-main', { buster: 'old', savedAt: T0, identity: { userId: 'user-ana', orgId: 'org-main' }, state: { mutations: [], queries: [] } });
    const a = setup(ANA, { storage });
    expect(await a.cache.restore({ userId: 'user-ana', orgId: 'org-main' })).toBe(0);
    expect(await storage.keys()).toEqual([]);

    await storage.set('cache:user-ana:org-main', { buster: CACHE_BUSTER, savedAt: T0, identity: { userId: 'user-ben', orgId: 'org-main' }, state: { mutations: [], queries: [] } });
    expect(await a.cache.restore({ userId: 'user-ana', orgId: 'org-main' })).toBe(0);
  });

  it('offline at start-up, the last person\'s copy is restored without waiting for a session', async () => {
    const a = setup();
    put(a.client, ['today', 'everyone'], todayData);
    await a.cache.flush();
    const offline = setup(null, { storage: a.storage, offline: true });
    await offline.cache.start();
    expect(offline.client.getQueryData(['today', 'everyone'])).toEqual(todayData);
    offline.cache.stop();
  });

  it('online at start-up, nothing is restored until a session says who it is', async () => {
    const a = setup();
    put(a.client, ['today', 'everyone'], todayData);
    await a.cache.flush();
    const online = setup(null, { storage: a.storage, offline: false });
    await online.cache.start();
    expect(online.client.getQueryData(['today', 'everyone'])).toBeUndefined();
    online.cache.stop();
  });
});

describe('U40 other things that are never kept', () => {
  it('a push subscription, an idempotency key, notifications, documents and the session are not query roots that are kept', () => {
    for (const root of ['push', 'push-subscription', 'idempotency-keys', 'notifications', 'notifications-unread-count', 'documents', 'session', 'audit-log', 'activity']) {
      expect(isPersistableKey([root, 'x']), root).toBe(false);
    }
  });
});

describe('U40 sign-out', () => {
  it('a save that was already writing when the person signed out cannot leave a copy behind', async () => {
    const a = setup();
    put(a.client, ['today', 'everyone'], todayData);
    // a slow storage: the write of the copy is still going when clear() is called
    const slow = { ...a.storage, set: async (k: string, v: unknown) => (await new Promise((r) => setTimeout(r, 30)), a.storage.set(k, v)) };
    const cache = createQueryCache({ client: a.client, storage: slow, now: () => T0, throttleMs: 5 });
    const saving = cache.flush();
    await new Promise((r) => setTimeout(r, 10)); // the write has started
    const clearing = cache.clear();
    await Promise.all([saving, clearing]);
    expect(await a.storage.keys()).toEqual([]);
  });

  it('clear() empties the store, and nothing is saved again until a session has loaded', async () => {
    const a = setup();
    put(a.client, ['today', 'everyone'], todayData);
    await a.cache.flush();
    await a.cache.clear();
    expect(await a.storage.keys()).toEqual([]);
    await a.cache.flush(); // the session is still in memory, but the person signed out
    expect(await a.storage.keys()).toEqual([]);
  });
});
