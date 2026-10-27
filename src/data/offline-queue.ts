import { createStore, get, set, type UseStore } from 'idb-keyval';

/**
 * Spec 19.3: writes made without a connection wait in IndexedDB with their idempotency keys, replay in order
 * when the connection is back, and show in the sync indicator. A write the server rejects stays in the queue
 * as "failed" with Retry and Discard.
 *
 * Only the writes that spec 19.3 says work offline are queued; anything else needs a connection.
 */
export const QUEUEABLE: Record<string, { arity: number; label: string }> = {
  // arity = the number of arguments the method takes, so the idempotency key lands in the contract's `opts` position
  'lines.setStatus': { arity: 3, label: 'Checklist line status' },
  'notes.save': { arity: 1, label: 'Note' },
  'visits.setPacked': { arity: 3, label: 'Packing' },
  'visits.recordOutcome': { arity: 2, label: 'Counter outcome' },
};

export interface QueuedWrite {
  id: string;
  key: string; // the idempotency key sent with every attempt
  method: string; // 'notes.save'
  label: string;
  args: unknown[];
  createdAt: string;
  status: 'pending' | 'failed';
  attempts: number;
  error?: string;
}

export interface QueueSnapshot {
  items: QueuedWrite[];
  pending: number;
  failed: number;
  syncing: boolean;
}

export interface QueueDeps {
  /** Calls the repository; throws on failure. */
  call: (ns: string, method: string, args: unknown[]) => Promise<unknown>;
  newKey: () => string;
  now: () => string;
  dbName?: string;
}

const isNetworkError = (err: unknown): boolean => /network|failed to fetch|offline|timed? ?out/i.test((err as Error)?.message ?? '');

export function createOfflineQueue(deps: QueueDeps) {
  let store: UseStore | null = null;
  const db = () => (store ??= createStore(deps.dbName ?? 'ordinovix-offline-queue', 'items'));
  const hasIndexedDb = typeof indexedDB !== 'undefined';

  let items: QueuedWrite[] = [];
  let syncing = false;
  const listeners = new Set<() => void>();
  let snapshot: QueueSnapshot = { items: [], pending: 0, failed: 0, syncing: false };

  const emit = () => {
    snapshot = {
      items: [...items],
      pending: items.filter((i) => i.status === 'pending').length,
      failed: items.filter((i) => i.status === 'failed').length,
      syncing,
    };
    listeners.forEach((l) => l());
  };

  // The saved queue is read once; every operation waits for it
  const ready: Promise<void> = (async () => {
    if (!hasIndexedDb) return;
    try {
      items = (await get<QueuedWrite[]>('queue', db())) ?? [];
      if (items.length) emit();
    } catch {
      items = [];
    }
  })();

  const persist = async () => {
    if (hasIndexedDb) await set('queue', items, db());
  };

  const argsWithKey = (item: QueuedWrite): unknown[] => {
    const arity = QUEUEABLE[item.method]?.arity ?? item.args.length;
    const args = item.args.slice(0, arity);
    while (args.length < arity) args.push(undefined);
    return [...args, { idempotencyKey: item.key }];
  };

  async function attempt(item: QueuedWrite): Promise<'done' | 'failed' | 'offline'> {
    item.attempts += 1;
    const [ns, method] = item.method.split('.');
    try {
      await deps.call(ns, method, argsWithKey(item));
      items = items.filter((i) => i.id !== item.id);
      await persist();
      emit();
      return 'done';
    } catch (err) {
      if (isNetworkError(err)) return 'offline';
      item.status = 'failed';
      item.error = (err as Error).message || 'The server rejected this change';
      await persist();
      emit();
      return 'failed';
    }
  }

  let running: Promise<void> | null = null;
  async function run(): Promise<void> {
    await ready;
    syncing = true;
    emit();
    try {
      for (const item of items.filter((i) => i.status === 'pending')) {
        // A network error means the connection is still down: stop here so nothing later jumps ahead
        if ((await attempt(item)) === 'offline') break;
      }
    } finally {
      syncing = false;
      emit();
    }
  }

  return {
    isQueueable: (name: string): boolean => name in QUEUEABLE,
    hasPending: (): boolean => items.some((i) => i.status === 'pending'),

    async enqueue(method: string, args: unknown[]): Promise<QueuedWrite> {
      await ready;
      const key = deps.newKey();
      const item: QueuedWrite = {
        id: key,
        key,
        method,
        label: QUEUEABLE[method]?.label ?? method,
        args,
        createdAt: deps.now(),
        status: 'pending',
        attempts: 0,
      };
      items = [...items, item];
      await persist();
      emit();
      return item;
    },

    async list(): Promise<QueuedWrite[]> {
      await ready;
      return [...items];
    },

    /** Replays the pending writes in the order they were made. Runs once at a time. */
    replay(): Promise<void> {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },

    async retry(id: string): Promise<void> {
      await ready;
      const item = items.find((i) => i.id === id);
      if (!item) return;
      item.status = 'pending';
      item.error = undefined;
      await persist();
      emit();
      await this.replay();
    },

    async discard(id: string): Promise<void> {
      await ready;
      items = items.filter((i) => i.id !== id);
      await persist();
      emit();
    },

    /** Tells subscribers to look again, for example after the connection state changed. */
    refresh: (): void => emit(),

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: (): QueueSnapshot => snapshot,
    load: (): Promise<void> => ready,
  };
}

export type OfflineQueue = ReturnType<typeof createOfflineQueue>;
