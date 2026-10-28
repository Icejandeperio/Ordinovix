import type { Repositories } from './repositories';
import { FAILURE_RATE_KEY, OFFLINE_KEY, PERSONA_KEY } from './dev-state';
import { createOfflineQueue } from './offline-queue';
import { getDevToday, setDevToday } from '@/lib/dates';
import { generateId } from '@/lib/ids';
import type { ISODate } from '@/domain/types';

type MockModule = typeof import('./mock');

let mockModule: Promise<MockModule> | undefined;
/**
 * The mock implementation (store, seed data, rules) loads on the first data call instead of with the app shell,
 * so it is not part of the first-load bundle and drops out of a build that talks to the API.
 */
const loadMock = (): Promise<MockModule> => (mockModule ??= import('./mock'));

type Namespace = Record<string, (...args: unknown[]) => Promise<unknown>>;

let idempotentRepos: Promise<Record<string, Namespace>> | undefined;
/** The mock, with the API's idempotency rule applied: a write that carries the same key twice is applied once. */
const mockRepos = (): Promise<Record<string, Namespace>> =>
  (idempotentRepos ??= Promise.all([loadMock(), import('./mock/idempotency')]).then(
    ([mock, { withIdempotency }]) => withIdempotency(mock.mockRepositories) as unknown as Record<string, Namespace>,
  ));

async function callMock(ns: string, method: string, args: unknown[]): Promise<unknown> {
  return (await mockRepos())[ns][method](...args);
}

const read = (key: string): string | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: string): void => {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the setting then lasts until the page reloads
  }
};

const isOffline = (): boolean => (typeof navigator !== 'undefined' && navigator.onLine === false) || read(OFFLINE_KEY) === 'true';

/**
 * Spec 19.3 offline writes: line status, notes, packing and counter outcomes made without a connection wait in
 * IndexedDB and replay in order, with idempotency keys, when the connection is back.
 */
export const offlineQueue = createOfflineQueue({
  call: callMock,
  newKey: generateId,
  now: () => new Date().toISOString(),
});

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    offlineQueue.refresh();
    void offlineQueue.replay();
  });
  window.addEventListener('offline', () => offlineQueue.refresh());
  // A queue saved before a reload is replayed at start-up when the connection is up
  void offlineQueue.load().then(() => {
    if (offlineQueue.hasPending() && !isOffline()) void offlineQueue.replay();
  });
}

/** Every repository method is async, so a call can wait for the implementation to load and then forward. */
function lazyRepositories(): Repositories {
  const namespace = (ns: string) =>
    new Proxy({} as Namespace, {
      get: (_target, method) => {
        if (typeof method !== 'string' || method === 'then') return undefined;
        const name = `${ns}.${method}`;
        return async (...args: unknown[]) => {
          // Queueable writes wait their turn behind anything already queued, so they stay in order
          if (offlineQueue.isQueueable(name) && (isOffline() || offlineQueue.hasPending())) {
            await offlineQueue.enqueue(name, args);
            if (!isOffline()) void offlineQueue.replay();
            return undefined;
          }
          return callMock(ns, method, args);
        };
      },
    });
  return new Proxy({} as Repositories, {
    get: (_target, ns) => (typeof ns === 'string' && ns !== 'then' ? namespace(ns) : undefined),
  });
}

export const repositories: Repositories = lazyRepositories();

/**
 * Dev controls for the shell, dev menu and sign-in screen. Reads come from the saved settings; changes are
 * saved at once and handed to the mock implementation, which applies them (and reloads where it needs to).
 */
export const devControls = {
  reset() {
    void loadMock().then((m) => m.mockDevControls.reset());
  },
  setPersona(role: 'owner' | 'helper') {
    write(PERSONA_KEY, role);
    void loadMock().then((m) => m.mockDevControls.setPersona(role));
  },
  getPersona(): 'owner' | 'helper' {
    return read(PERSONA_KEY) === 'helper' ? 'helper' : 'owner';
  },
  setOffline(offline: boolean) {
    write(OFFLINE_KEY, String(offline));
    offlineQueue.refresh();
    void loadMock().then((m) => {
      m.mockDevControls.setOffline(offline);
      // Back online: send what was queued
      if (!offline) void offlineQueue.replay();
    });
  },
  getOffline(): boolean {
    return read(OFFLINE_KEY) === 'true';
  },
  setFailureRate(rate: number) {
    write(FAILURE_RATE_KEY, String(rate));
    void loadMock().then((m) => m.mockDevControls.setFailureRate(rate));
  },
  getFailureRate(): number {
    return parseFloat(read(FAILURE_RATE_KEY) || '0');
  },
  setToday(date: ISODate | null) {
    setDevToday(date);
    if (typeof window !== 'undefined' && window.location?.reload) window.location.reload();
  },
  getToday(): ISODate | null {
    return getDevToday();
  },
};
