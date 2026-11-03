import { dehydrate, hydrate, type DehydratedState, type Query, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { clear as idbClear, createStore, del, get, keys as idbKeys, set } from 'idb-keyval';

/**
 * Spec 19.3 "Offline data": the last opened Today, tasks, visits and clients are kept on the device for 24 hours so a reload
 * without a connection still shows them. Built from dehydrate/hydrate and idb-keyval (no persister package).
 *
 * What it keeps, and for whom:
 * - one saved copy per person and organization (`cache:<user>:<org>`); a different person signing in never reads it, and the
 *   copies of anyone else are deleted as soon as the signed-in person is known;
 * - only the allowlisted query roots, only successful queries, only data fetched in the last 24 hours (on save and on restore),
 *   under the app's cache buster;
 * - never: a revealed TIN, a signed document or file URL, the session, notifications, a query keyed by a search string, a
 *   mutation. Anything of that kind found inside a kept query is cut out of the copy before it is written.
 * Sign-out clears the whole store, whether or not the server could be reached.
 */
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Change this when the shape of cached data changes: every saved copy is then dropped on read. */
export const CACHE_BUSTER = 'u40-1';
/** The query roots worth reading offline (src/hooks/useData.ts). */
export const PERSISTED_ROOTS = ['today', 'tasks', 'visits', 'clients', 'client', 'calendar'] as const;

export interface CacheIdentity {
  userId: string;
  orgId: string;
}

interface SavedCache {
  buster: string;
  savedAt: number;
  identity: CacheIdentity;
  state: DehydratedState;
}

export interface CacheStorage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

const IDENTITY_KEY = 'identity';
const entryKey = (id: CacheIdentity) => `cache:${id.userId}:${id.orgId}`;

// ---- what may be kept -----------------------------------------------------------------------------------------------------

/** Field names that carry a revealed TIN or a file link; they are removed wherever they sit in a kept query. */
const FORBIDDEN_FIELDS = new Set(['tinfull', 'revealedtin', 'signedurl', 'downloadurl', 'fileurl', 'thumburl', 'previewurl']);
/** A link that grants access by itself: a signature, an expiry or a token in the query string, or a blob made by this page. */
const SIGNED_URL = /^(blob:|https?:\/\/[^\s]*[?&](signature|sig|expires|token|x-amz-[a-z-]+|x-goog-[a-z-]+)=)/i;

export function isPersistableKey(queryKey: QueryKey): boolean {
  const [root, ...rest] = queryKey;
  if (!PERSISTED_ROOTS.includes(root as (typeof PERSISTED_ROOTS)[number])) return false;
  // a query keyed by what the person typed in a search box is not kept
  return !rest.some((part) => part !== null && typeof part === 'object' && ['search', 'q', 'query'].some((f) => (part as Record<string, unknown>)[f]));
}

/** A copy of `value` without forbidden fields or signed links; plain JSON, so it can be stored. */
export function scrub<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return SIGNED_URL.test(v) ? undefined : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, inner] of Object.entries(v)) {
        if (FORBIDDEN_FIELDS.has(k.toLowerCase())) continue;
        const cleaned = walk(inner);
        if (cleaned !== undefined) out[k] = cleaned;
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

const isFresh = (updatedAt: number, now: number) => updatedAt > 0 && now - updatedAt <= CACHE_MAX_AGE_MS;

/** The saved form of the client's cache: allowlisted, successful, fresh and scrubbed queries only, and no mutations. */
export function snapshot(client: QueryClient, now: number): DehydratedState {
  const state = dehydrate(client, {
    shouldDehydrateQuery: (q: Query) => q.state.status === 'success' && isPersistableKey(q.queryKey) && isFresh(q.state.dataUpdatedAt, now),
    shouldDehydrateMutation: () => false,
  });
  return JSON.parse(JSON.stringify({ mutations: [], queries: state.queries.map((q) => ({ ...q, state: { ...q.state, data: scrub(q.state.data) } })) }));
}

/** Puts a saved copy back into the client: only fresh allowlisted queries, whatever the file says. */
export function restoreState(client: QueryClient, state: DehydratedState, now: number): number {
  const queries = state.queries.filter((q) => isPersistableKey(q.queryKey) && isFresh(q.state.dataUpdatedAt, now));
  hydrate(client, { mutations: [], queries });
  return queries.length;
}

// ---- storage --------------------------------------------------------------------------------------------------------------

export function idbStorage(name = 'ordinovix-query-cache'): CacheStorage {
  const store = createStore(name, 'cache');
  return {
    get: (k) => get(k, store),
    set: (k, v) => set(k, v, store),
    del: (k) => del(k, store),
    keys: async () => (await idbKeys(store)).map(String),
    clear: () => idbClear(store),
  };
}

export function memoryStorage(): CacheStorage {
  const map = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => map.get(k) as T | undefined,
    set: async (k, v) => void map.set(k, v),
    del: async (k) => void map.delete(k),
    keys: async () => [...map.keys()],
    clear: async () => map.clear(),
  };
}

// ---- the saved cache ------------------------------------------------------------------------------------------------------

export interface QueryCacheOptions {
  client: QueryClient;
  storage: CacheStorage;
  now?: () => number;
  /** True while the device has no connection: the saved copy of the last person is then restored without waiting for the session. */
  isOffline?: () => boolean;
  throttleMs?: number;
}

const identityOf = (client: QueryClient): CacheIdentity | null => {
  const s = client.getQueryData<{ user?: { id?: string }; org?: { id?: string } }>(['session']);
  return s?.user?.id && s.org?.id ? { userId: s.user.id, orgId: s.org.id } : null;
};

export function createQueryCache(opts: QueryCacheOptions) {
  const { client, storage } = opts;
  const now = opts.now ?? Date.now;
  const throttleMs = opts.throttleMs ?? 1000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;
  /** After a sign-out nothing is saved until a session has been loaded again. */
  let blocked = false;
  let restoredFor: string | null = null;

  /** Reads one person's saved copy back into the client. */
  async function restore(identity: CacheIdentity): Promise<number> {
    const saved = await storage.get<SavedCache>(entryKey(identity));
    if (!saved) return 0;
    const sameOwner = saved.identity?.userId === identity.userId && saved.identity?.orgId === identity.orgId;
    if (saved.buster !== CACHE_BUSTER || !sameOwner || !isFresh(saved.savedAt, now())) {
      await storage.del(entryKey(identity));
      return 0;
    }
    return restoreState(client, saved.state, now());
  }

  /** Everyone else's saved copy goes once the signed-in person is known. */
  async function dropOthers(identity: CacheIdentity) {
    const keep = entryKey(identity);
    for (const k of await storage.keys()) if (k.startsWith('cache:') && k !== keep) await storage.del(k);
  }

  async function save(): Promise<void> {
    timer = null;
    const identity = identityOf(client);
    if (blocked || !identity) return;
    const state = snapshot(client, now());
    if (state.queries.length === 0) return;
    const entry: SavedCache = { buster: CACHE_BUSTER, savedAt: now(), identity, state };
    await storage.set(entryKey(identity), entry);
    await storage.set(IDENTITY_KEY, identity);
  }

  const schedule = () => {
    if (!timer && !blocked) timer = setTimeout(() => void save(), throttleMs);
  };

  async function onSessionLoaded() {
    blocked = false;
    const identity = identityOf(client);
    if (!identity) return;
    const key = entryKey(identity);
    await dropOthers(identity);
    if (restoredFor !== key) {
      restoredFor = key;
      await restore(identity);
    }
    schedule();
  }

  return {
    /** Restores the last person's copy when the device is offline at start-up, then watches the client for changes. */
    async start(): Promise<void> {
      if (opts.isOffline?.()) {
        const marker = await storage.get<CacheIdentity>(IDENTITY_KEY);
        if (marker) {
          restoredFor = entryKey(marker);
          await restore(marker);
        }
      }
      unsubscribe = client.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated' && event.type !== 'added') return;
        const query = event.query;
        if (query.queryKey[0] === 'session') {
          if (event.type === 'updated' && event.action.type === 'success') void onSessionLoaded();
        } else if (isPersistableKey(query.queryKey)) schedule();
      });
    },
    /** Saves now (tests, and before the page goes away). */
    flush: save,
    /** Sign-out: nothing stays on the device, and nothing is saved again until a session is loaded. */
    async clear(): Promise<void> {
      blocked = true;
      restoredFor = null;
      if (timer) clearTimeout(timer);
      timer = null;
      await storage.clear();
    },
    stop() {
      unsubscribe?.();
      if (timer) clearTimeout(timer);
    },
    restore,
  };
}

export type QueryCache = ReturnType<typeof createQueryCache>;

// ---- the app's one saved cache --------------------------------------------------------------------------------------------

let active: QueryCache | null = null;
const hasIndexedDb = () => typeof indexedDB !== 'undefined';

/** Called once at start-up with the app's client and its offline test. */
export async function startQueryCache(client: QueryClient, isOffline: () => boolean): Promise<QueryCache | null> {
  if (!hasIndexedDb()) return null;
  active = createQueryCache({ client, storage: idbStorage(), isOffline });
  await active.start().catch(() => undefined); // a browser that refuses IndexedDB just has no saved cache
  return active;
}

/** Clears the saved cache, started or not; never throws, so a sign-out is not held up by it. */
export async function clearSavedQueryCache(): Promise<void> {
  try {
    if (active) await active.clear();
    else if (hasIndexedDb()) await idbStorage().clear();
  } catch {
    /* nothing saved, or storage unavailable */
  }
}

/** The saved entries on this device (names only), for tests. */
export async function savedCacheKeys(): Promise<string[]> {
  return hasIndexedDb() ? idbStorage().keys() : [];
}
