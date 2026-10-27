import type { Repositories } from './repositories';
import { FAILURE_RATE_KEY, OFFLINE_KEY, PERSONA_KEY } from './dev-state';
import { getDevToday, setDevToday } from '@/lib/dates';
import type { ISODate } from '@/domain/types';

type MockModule = typeof import('./mock');

let mockModule: Promise<MockModule> | undefined;
/**
 * The mock implementation (store, seed data, rules) loads on the first data call instead of with the app shell,
 * so it is not part of the first-load bundle and drops out of a build that talks to the API.
 */
const loadMock = (): Promise<MockModule> => (mockModule ??= import('./mock'));

type Namespace = Record<string, (...args: unknown[]) => Promise<unknown>>;

/** Every repository method is async, so a call can wait for the implementation to load and then forward. */
function lazyRepositories(): Repositories {
  const namespace = (ns: string) =>
    new Proxy({} as Namespace, {
      get: (_target, method) =>
        typeof method === 'string' && method !== 'then'
          ? async (...args: unknown[]) => {
              const mock = await loadMock();
              const target = (mock.mockRepositories as unknown as Record<string, Namespace>)[ns];
              return target[method](...args);
            }
          : undefined,
    });
  return new Proxy({} as Repositories, {
    get: (_target, ns) => (typeof ns === 'string' && ns !== 'then' ? namespace(ns) : undefined),
  });
}

export const repositories: Repositories = lazyRepositories();

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
    void loadMock().then((m) => m.mockDevControls.setOffline(offline));
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
