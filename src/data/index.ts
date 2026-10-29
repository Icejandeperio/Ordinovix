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

/** VITE_DATA_SOURCE=api: the same repositories over fetch to the Worker. A build for the API has no use for the mock and drops it. */
const useApi = import.meta.env.VITE_DATA_SOURCE === 'api';
let apiRepos: Promise<Record<string, Namespace>> | undefined;
const loadApi = (): Promise<Record<string, Namespace>> =>
  (apiRepos ??= import('./api/repositories').then(async (m) => {
    // Development only: sign in as the chosen persona and start a fresh browser context from the seed
    if (import.meta.env.DEV) (await import('./api/dev')).installDevBootstrap();
    return m.createApiRepositories() as unknown as Record<string, Namespace>;
  }));
async function callApi(ns: string, method: string, args: unknown[]): Promise<unknown> {
  return (await loadApi())[ns][method](...args);
}
const callImpl = useApi ? callApi : callMock;

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

/** The simulated-offline switch exists in mock mode and on the dev server; a deployed API build ignores a saved value. */
const devSwitches = !useApi || import.meta.env.DEV;
const simulatedOffline = (): boolean => devSwitches && read(OFFLINE_KEY) === 'true';

const isOffline = (): boolean => (typeof navigator !== 'undefined' && navigator.onLine === false) || simulatedOffline();

/**
 * Spec 19.3 offline writes: line status, notes, packing and counter outcomes made without a connection wait in
 * IndexedDB and replay in order, with idempotency keys, when the connection is back.
 */
export const offlineQueue = createOfflineQueue({
  call: callImpl,
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
          return callImpl(ns, method, args);
        };
      },
    });
  return new Proxy({} as Repositories, {
    get: (_target, ns) => (typeof ns === 'string' && ns !== 'then' ? namespace(ns) : undefined),
  });
}

export const repositories: Repositories = lazyRepositories();

/** Real sign-in, for builds that talk to the API (the sign-in page and the access-pending page). */
export const authControls = {
  /** The Google URL to send the person to; the server brings them back to `next` once signed in. */
  async googleSignInUrl(next: string): Promise<string> {
    return (await import('./api/auth')).requestGoogleSignIn(next);
  },
  /** The address the person signed in with, when the server knows it. */
  async signedInEmail(): Promise<string | undefined> {
    return (await import('./api/auth')).fetchSignedInEmail();
  },
};

/** What the reminders button needs besides the repositories (the push key is not part of the contract). */
export const pushControls = {
  async vapidKey(): Promise<string> {
    return (await import('./api/push')).fetchVapidKey();
  },
};

/**
 * Dev controls for the shell, dev menu and sign-in screen. Reads come from the saved settings; changes are
 * saved at once and handed to the mock implementation, which applies them (and reloads where it needs to).
 */
export const devControls = {
  reset() {
    if (useApi) {
      void import('./api/dev').then(async (d) => {
        await d.devReset();
        if (typeof window !== 'undefined') window.location.reload();
      });
      return;
    }
    void loadMock().then((m) => m.mockDevControls.reset());
  },
  setPersona(role: 'owner' | 'helper') {
    write(PERSONA_KEY, role);
    if (useApi) {
      void import('./api/dev').then(async (d) => {
        await d.devSignIn(role);
        if (typeof window !== 'undefined') window.location.reload();
      });
      return;
    }
    void loadMock().then((m) => m.mockDevControls.setPersona(role));
  },
  getPersona(): 'owner' | 'helper' {
    return read(PERSONA_KEY) === 'helper' ? 'helper' : 'owner';
  },
  setOffline(offline: boolean) {
    write(OFFLINE_KEY, String(offline));
    offlineQueue.refresh();
    if (useApi) {
      // the API client reads the saved setting on every call
      if (!offline) void offlineQueue.replay();
      return;
    }
    void loadMock().then((m) => {
      m.mockDevControls.setOffline(offline);
      // Back online: send what was queued
      if (!offline) void offlineQueue.replay();
    });
  },
  getOffline(): boolean {
    return simulatedOffline();
  },
  setFailureRate(rate: number) {
    write(FAILURE_RATE_KEY, String(rate));
    if (!useApi) void loadMock().then((m) => m.mockDevControls.setFailureRate(rate));
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
