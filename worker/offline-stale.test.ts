import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApiRepositories } from '@/data/api/repositories';
import { createOfflineQueue } from '@/data/offline-queue';
import type { Repositories } from '@/data/repositories';
import { PERSONAS, TEST_ORIGIN, openWorld, type World } from './testing/world';

/**
 * U38: an edit that reaches the offline queue keeps the version it was made with. Replayed against the Worker after someone else
 * changed the record, it comes back 409, stays in the queue as a failed item that holds every later write, and is retried with the
 * same version (never `If-Match: *`) until the person discards it.
 */
let world: World;
let owner: Repositories;
const ifMatchSent: Array<string | null> = [];

beforeAll(async () => {
  world = await openWorld(); // APP_ENV=local without the dev sign-in: "*" is refused here too
  const cookie = await world.cookieFor(PERSONAS.owner);
  const viaWorker = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set('Cookie', cookie);
    if ((init?.method ?? 'GET') !== 'GET') ifMatchSent.push(headers.get('If-Match'));
    return world.app.request(`${TEST_ORIGIN}${String(input)}`, { ...init, headers }, world.env);
  }) as typeof fetch;
  owner = createApiRepositories(viaWorker);
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

const bodyOf = async (id: string) => (await world.env.DB.prepare('SELECT body FROM notes WHERE id = ?').bind(id).first<{ body: string }>())?.body;

describe('U38 a stale edit in the offline queue', () => {
  it('comes back 409, stays failed and holds the later write; Retry sends the same version; Discard releases the rest', async () => {
    const note = await owner.notes.save({ entity: 'client', entityId: 'client-rsp', body: 'First draft' });
    const staleVersion = note.version; // what this device loaded before it went offline
    const other = await owner.notes.save({ id: note.id, version: staleVersion, entity: 'client', entityId: 'client-rsp', body: "Someone else's edit" });
    expect(other.version).toBe(staleVersion + 1);

    const queue = createOfflineQueue({
      dbName: `u38-${crypto.randomUUID()}`,
      call: async (ns, method, args) => {
        await ((owner as never)[ns][method] as (...a: unknown[]) => Promise<unknown>)(...args);
      },
      newKey: () => crypto.randomUUID(),
      now: () => '2026-10-28T09:00:00+08:00',
    });
    await queue.enqueue('notes.save', [{ id: note.id, version: staleVersion, entity: 'client', entityId: 'client-rsp', body: 'Edit made offline' }]);
    await queue.enqueue('notes.save', [{ entity: 'client', entityId: 'client-rsp', body: 'U38 later note' }]);
    ifMatchSent.length = 0;
    await queue.replay();

    // 409: the stale edit failed, the later note was never sent, and the record is the other person's
    const [failed, later] = await queue.list();
    expect(failed).toMatchObject({ status: 'failed' });
    expect(failed.error).toBeTruthy();
    expect(later.status).toBe('pending');
    expect(await bodyOf(note.id)).toBe("Someone else's edit");
    expect(ifMatchSent).toEqual([`"${staleVersion}"`]);

    // Retry: the same call, the same version, no wildcard, still 409, still holding
    await queue.retry(failed.id);
    expect(ifMatchSent).toEqual([`"${staleVersion}"`, `"${staleVersion}"`]);
    expect((await queue.list()).map((i) => i.status)).toEqual(['failed', 'pending']);
    expect((await queue.list())[0].args).toEqual(failed.args);

    // Discard the stale edit: the held note goes through
    await queue.discard(failed.id);
    expect(await queue.list()).toEqual([]);
    const notes = await owner.notes.list('client', 'client-rsp');
    expect(notes.map((n) => n.body)).toContain('U38 later note');
    expect(await bodyOf(note.id)).toBe("Someone else's edit");
  });
});
