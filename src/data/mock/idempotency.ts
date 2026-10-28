/**
 * Mock of the API's idempotency rule (spec 6.2, 19.3): a write that carries an `idempotencyKey` in its trailing
 * `opts` argument is applied once. If the same key arrives again (a replay after a lost reply) the mock returns
 * without applying it a second time. A write that failed is not remembered, so a retry still goes through.
 */
const STORAGE_KEY = 'ox-mock-idempotency-keys';
const KEEP = 500;

interface KeyStore {
  has(key: string): boolean;
  add(key: string): void;
}

/** Keys survive a reload (like the server would remember them), most recent 500. */
export function localStorageKeys(): KeyStore {
  const read = (): string[] => {
    try {
      return JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  };
  return {
    has: (key) => read().includes(key),
    add: (key) => {
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...read(), key].slice(-KEEP)));
      } catch {
        // storage unavailable: the key is forgotten on reload
      }
    },
  };
}

const keyOf = (args: unknown[]): string | undefined => {
  const last = args.at(-1);
  if (last && typeof last === 'object' && 'idempotencyKey' in last) {
    const key = (last as { idempotencyKey?: unknown }).idempotencyKey;
    return typeof key === 'string' && key ? key : undefined;
  }
  return undefined;
};

/** Wraps every method of every namespace; reads and keyless writes pass straight through. */
export function withIdempotency<T extends object>(repos: T, keys: KeyStore | Map<string, true> = localStorageKeys()): T {
  const store: KeyStore =
    keys instanceof Map ? { has: (k) => keys.has(k), add: (k) => void keys.set(k, true) } : keys;
  return new Proxy(repos, {
    get(target, ns) {
      const namespace = Reflect.get(target, ns) as Record<string, unknown> | undefined;
      if (!namespace || typeof namespace !== 'object') return namespace;
      return new Proxy(namespace, {
        get(nsTarget, method) {
          const fn = Reflect.get(nsTarget, method);
          if (typeof fn !== 'function') return fn;
          return async (...args: unknown[]) => {
            const key = keyOf(args);
            if (!key) return fn.apply(nsTarget, args);
            if (store.has(key)) return undefined;
            const result = await fn.apply(nsTarget, args);
            store.add(key);
            return result;
          };
        },
      });
    },
  });
}
