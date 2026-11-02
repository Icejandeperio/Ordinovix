import { describe, it, expect } from 'vitest';
import { createOfflineQueue, type QueueDeps } from './offline-queue';

/**
 * U37 (owner decision, QUEUE.md Decided 2026-10-28): a replayed write the server rejects, for any reason (409 version conflict,
 * 422 validation, not found...), holds every later write until it is retried or discarded. Retry sends the same call: the same
 * arguments (so the same version) and the same idempotency key, and never a wildcard If-Match to get it through (U38).
 */
type Call = { name: string; args: unknown[] };

const rejection = (code: string, message: string) => Object.assign(new Error(message), { code });

function setup(rule: (args: unknown[]) => Error | null) {
  const calls: Call[] = [];
  let n = 0;
  const deps: QueueDeps = {
    dbName: `queue-hold-${Math.random().toString(36).slice(2)}`,
    call: async (ns, method, args) => {
      calls.push({ name: `${ns}.${method}`, args });
      const err = rule(args);
      if (err) throw err;
    },
    newKey: () => `key-${++n}`,
    now: () => '2026-10-28T09:00:00+08:00',
  };
  return { queue: createOfflineQueue(deps), calls };
}

describe('U37 a failed write holds the later ones', () => {
  it('a 409 version conflict stops the replay: the later writes are not sent and stay waiting', async () => {
    let conflict = true;
    const { queue, calls } = setup((args) => (conflict && args[0] === 'task-1' ? rejection('VERSION_CONFLICT', 'Someone else changed this') : null));
    await queue.enqueue('lines.setStatus', ['task-1', 'received']);
    await queue.enqueue('lines.setStatus', ['task-2', 'received']);
    await queue.enqueue('notes.save', [{ body: 'later' }]);
    await queue.replay();

    expect(calls.map((c) => c.args[0])).toEqual(['task-1']);
    expect(queue.getSnapshot()).toMatchObject({ pending: 2, failed: 1 });
    expect((await queue.list()).map((i) => i.status)).toEqual(['failed', 'pending', 'pending']);
    expect(queue.hasPending()).toBe(true);
    expect(queue.hasWaiting()).toBe(true);
    conflict = false;
  });

  it('a 422 validation error holds them the same way', async () => {
    const { queue, calls } = setup((args) => (args[0] === 'a' ? rejection('VALIDATION', 'Note is too long') : null));
    await queue.enqueue('lines.setStatus', ['a', 'received']);
    await queue.enqueue('lines.setStatus', ['b', 'received']);
    await queue.replay();
    expect(calls.map((c) => c.args[0])).toEqual(['a']);
    expect(await queue.list()).toMatchObject([{ status: 'failed', error: 'Note is too long' }, { status: 'pending' }]);
  });

  it('a rejection whose words sound like a lost connection is still a rejection', async () => {
    const { queue } = setup((args) => (args[0] === 'a' ? rejection('VALIDATION', 'The offline reason is required') : null));
    await queue.enqueue('lines.setStatus', ['a', 'received']);
    await queue.replay();
    expect(queue.getSnapshot()).toMatchObject({ pending: 0, failed: 1 });
  });

  it('a write queued later, while one is failed, waits behind it', async () => {
    const { queue, calls } = setup((args) => (args[0] === 'a' ? rejection('VERSION_CONFLICT', 'Changed') : null));
    await queue.enqueue('lines.setStatus', ['a', 'received']);
    await queue.replay();
    await queue.enqueue('lines.setStatus', ['b', 'received']);
    await queue.replay();
    expect(calls.map((c) => c.args[0])).toEqual(['a']);
    expect(queue.getSnapshot()).toMatchObject({ pending: 1, failed: 1 });
  });

  it('Retry sends the same call (same arguments, same key, no wildcard) and releases the later writes in order', async () => {
    let conflict = true;
    const { queue, calls } = setup((args) => (conflict && args[0] === 'a' ? rejection('VERSION_CONFLICT', 'Changed') : null));
    const withVersion = ['a', 'received', { version: 3 }];
    await queue.enqueue('lines.setStatus', withVersion);
    await queue.enqueue('lines.setStatus', ['b', 'received']);
    await queue.replay();
    const [failed] = await queue.list();

    conflict = false;
    await queue.retry(failed.id);

    expect(calls.map((c) => c.args[0])).toEqual(['a', 'a', 'b']);
    expect(calls[1].args).toEqual(calls[0].args);
    expect(calls[1].args[2]).toEqual({ version: 3 });
    expect((calls[1].args.at(-1) as { idempotencyKey: string }).idempotencyKey).toBe(failed.key);
    expect(JSON.stringify(calls)).not.toMatch(/If-Match|ifMatch|"\*"/i);
    expect(await queue.list()).toEqual([]);
  });

  it('Discard of the failed write releases the later ones', async () => {
    const { queue, calls } = setup((args) => (args[0] === 'a' ? rejection('VALIDATION', 'No') : null));
    await queue.enqueue('lines.setStatus', ['a', 'received']);
    await queue.enqueue('lines.setStatus', ['b', 'received']);
    await queue.replay();
    const [failed] = await queue.list();
    await queue.discard(failed.id);
    await queue.replay();
    expect(calls.map((c) => c.args[0])).toEqual(['a', 'b']);
    expect(await queue.list()).toEqual([]);
  });

  it('a retry that is rejected again keeps holding', async () => {
    const { queue, calls } = setup((args) => (args[0] === 'a' ? rejection('VERSION_CONFLICT', 'Still changed') : null));
    await queue.enqueue('lines.setStatus', ['a', 'received']);
    await queue.enqueue('lines.setStatus', ['b', 'received']);
    await queue.replay();
    const [failed] = await queue.list();
    await queue.retry(failed.id);
    expect(calls.map((c) => c.args[0])).toEqual(['a', 'a']);
    expect((await queue.list()).map((i) => i.status)).toEqual(['failed', 'pending']);
  });

  it('clear() empties the queue and its saved copy (sign-out)', async () => {
    const { queue } = setup(() => null);
    await queue.enqueue('lines.setStatus', ['a', 'received']);
    await queue.clear();
    expect(await queue.list()).toEqual([]);
    expect(queue.getSnapshot()).toMatchObject({ pending: 0, failed: 0 });
    expect(queue.hasWaiting()).toBe(false);
  });
});
