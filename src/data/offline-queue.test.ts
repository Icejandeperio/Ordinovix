import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createOfflineQueue, QUEUEABLE, type QueueDeps } from './offline-queue';
import { withIdempotency } from './mock/idempotency';

type Call = { name: string; args: unknown[] };

function setup(overrides: Partial<QueueDeps> = {}) {
  const calls: Call[] = [];
  let n = 0;
  const deps: QueueDeps = {
    dbName: `queue-test-${Math.random().toString(36).slice(2)}`,
    call: async (ns, method, args) => {
      calls.push({ name: `${ns}.${method}`, args });
    },
    newKey: () => `key-${++n}`,
    now: () => '2026-10-28T09:00:00+08:00',
    ...overrides,
  };
  return { queue: createOfflineQueue(deps), calls, deps };
}

describe('offline write queue (spec 19.3, B17)', () => {
  it('knows which writes may be queued offline: line status, notes, packing and outcomes', () => {
    expect(Object.keys(QUEUEABLE).sort()).toEqual(['lines.setStatus', 'notes.save', 'visits.recordOutcome', 'visits.setPacked']);
  });

  it('keeps queued writes in IndexedDB, in order, with an idempotency key each', async () => {
    const { queue, deps } = setup();
    await queue.enqueue('lines.setStatus', ['line-1', 'accepted']);
    await queue.enqueue('notes.save', [{ entity: 'task', entityId: 't1', body: 'Called the client' }]);
    await queue.enqueue('visits.setPacked', ['visit-1', { lineId: 'line-2' }, true]);

    const items = await queue.list();
    expect(items.map((i) => i.method)).toEqual(['lines.setStatus', 'notes.save', 'visits.setPacked']);
    expect(items.map((i) => i.key)).toEqual(['key-1', 'key-2', 'key-3']);
    expect(queue.getSnapshot().pending).toBe(3);

    // A new queue over the same database (a page reload) sees the same items
    const reloaded = createOfflineQueue({ ...deps });
    expect((await reloaded.list()).map((i) => i.key)).toEqual(['key-1', 'key-2', 'key-3']);
  });

  it('replays in order with the idempotency key as the last argument, then empties the queue', async () => {
    const { queue, calls } = setup();
    await queue.enqueue('lines.setStatus', ['line-1', 'accepted']);
    await queue.enqueue('notes.save', [{ body: 'x' }]);
    await queue.replay();

    expect(calls.map((c) => c.name)).toEqual(['lines.setStatus', 'notes.save']);
    // setStatus takes (id, to, extra?, opts): the optional argument is padded so the key sits in the contract's position
    expect(calls[0].args).toEqual(['line-1', 'accepted', undefined, { idempotencyKey: 'key-1' }]);
    expect(calls[1].args).toEqual([{ body: 'x' }, { idempotencyKey: 'key-2' }]);
    expect(await queue.list()).toEqual([]);
    expect(queue.getSnapshot()).toMatchObject({ pending: 0, failed: 0, syncing: false });
  });

  it('stops at a network error and keeps the rest, so nothing is skipped or reordered', async () => {
    let online = false;
    const calls: Call[] = [];
    const { queue } = setup({
      call: async (ns, method, args) => {
        if (!online) throw new Error('Network error: Device is currently simulated as offline');
        calls.push({ name: `${ns}.${method}`, args });
      },
    });
    await queue.enqueue('lines.setStatus', ['a', 'accepted']);
    await queue.enqueue('lines.setStatus', ['b', 'accepted']);
    await queue.replay();
    expect((await queue.list()).map((i) => i.args[0])).toEqual(['a', 'b']);
    expect(queue.getSnapshot().pending).toBe(2);

    online = true;
    await queue.replay();
    expect(calls.map((c) => c.args[0])).toEqual(['a', 'b']);
    expect(await queue.list()).toEqual([]);
  });

  it('a write the server rejects stays in the queue as failed, with its reason, and the others still go', async () => {
    const calls: Call[] = [];
    const { queue } = setup({
      call: async (ns, method, args) => {
        if (args[0] === 'bad') throw new Error('Line not found');
        calls.push({ name: `${ns}.${method}`, args });
      },
    });
    await queue.enqueue('lines.setStatus', ['bad', 'accepted']);
    await queue.enqueue('lines.setStatus', ['good', 'accepted']);
    await queue.replay();

    expect(calls.map((c) => c.args[0])).toEqual(['good']);
    const left = await queue.list();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ status: 'failed', error: 'Line not found' });
    expect(queue.getSnapshot()).toMatchObject({ pending: 0, failed: 1 });
  });

  it('Retry replays a failed write with the same key; Discard removes it', async () => {
    let reject = true;
    const calls: Call[] = [];
    const { queue } = setup({
      call: async (ns, method, args) => {
        if (reject) throw new Error('Line not found');
        calls.push({ name: `${ns}.${method}`, args });
      },
    });
    await queue.enqueue('lines.setStatus', ['x', 'accepted']);
    await queue.enqueue('notes.save', [{ body: 'discard me' }]);
    await queue.replay();
    expect(queue.getSnapshot().failed).toBe(2);

    const [first, second] = await queue.list();
    await queue.discard(second.id);
    reject = false;
    await queue.retry(first.id);
    expect(calls).toHaveLength(1);
    expect((calls[0].args.at(-1) as { idempotencyKey: string }).idempotencyKey).toBe(first.key);
    expect(await queue.list()).toEqual([]);
  });

  it('sends a write that is queued while a replay is running', async () => {
    const calls: Call[] = [];
    let queue: ReturnType<typeof createOfflineQueue>;
    const made = setup({
      call: async (ns, method, args) => {
        calls.push({ name: `${ns}.${method}`, args });
        if (calls.length === 1) await queue.enqueue('notes.save', [{ body: 'late' }]);
      },
    });
    queue = made.queue;
    await queue.enqueue('notes.save', [{ body: 'early' }]);
    await queue.replay();
    expect(calls.map((c) => (c.args[0] as { body: string }).body)).toEqual(['early', 'late']);
    expect(await queue.list()).toEqual([]);
  });

  it('tells subscribers when the queue changes', async () => {
    const { queue } = setup();
    const seen: number[] = [];
    queue.subscribe(() => seen.push(queue.getSnapshot().pending));
    await queue.enqueue('notes.save', [{ body: 'a' }]);
    await queue.enqueue('notes.save', [{ body: 'b' }]);
    await queue.replay();
    expect(seen[0]).toBe(1);
    expect(seen).toContain(2);
    expect(seen.at(-1)).toBe(0);
  });
});

describe('mock idempotency: a replayed write is never applied twice', () => {
  const makeRepos = () => {
    const saved: unknown[] = [];
    return {
      saved,
      repos: {
        notes: {
          async save(n: unknown, _opts?: unknown) {
            saved.push(n);
            return n;
          },
        },
      },
    };
  };

  it('applies a keyed write once, even when it arrives twice', async () => {
    const { repos, saved } = makeRepos();
    const wrapped = withIdempotency(repos, new Map());
    await wrapped.notes.save({ body: 'once' }, { idempotencyKey: 'k1' });
    await wrapped.notes.save({ body: 'once' }, { idempotencyKey: 'k1' });
    expect(saved).toHaveLength(1);
    await wrapped.notes.save({ body: 'other' }, { idempotencyKey: 'k2' });
    expect(saved).toHaveLength(2);
  });

  it('does not remember a key whose write failed, so a retry still goes through', async () => {
    let fail = true;
    const wrapped = withIdempotency(
      {
        notes: {
          async save(_n: unknown, _opts?: unknown) {
            if (fail) throw new Error('boom');
            return 'ok';
          },
        },
      },
      new Map(),
    );
    await expect(wrapped.notes.save({ body: 'a' }, { idempotencyKey: 'k' })).rejects.toThrow('boom');
    fail = false;
    expect(await wrapped.notes.save({ body: 'a' }, { idempotencyKey: 'k' })).toBe('ok');
  });

  it('passes writes without a key straight through', async () => {
    const { repos, saved } = makeRepos();
    const wrapped = withIdempotency(repos, new Map());
    await wrapped.notes.save({ body: 'a' });
    await wrapped.notes.save({ body: 'a' });
    expect(saved).toHaveLength(2);
  });
});
