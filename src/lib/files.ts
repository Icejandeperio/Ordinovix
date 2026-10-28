import { createStore, get, set, type UseStore } from 'idb-keyval';

/**
 * File bytes live in IndexedDB (never as a blob: URL in a record, which dies on reload).
 * A record keeps only an immutable key; every view mints a fresh object URL from the stored bytes.
 */
export const FILE_KEY_PREFIX = 'idb:';
export const isStoredFileKey = (key: string): boolean => key.startsWith(FILE_KEY_PREFIX);

let store: UseStore | null = null;
/** Where IndexedDB does not exist (unit tests on plain Node) files stay in memory for the session. */
const memory = new Map<string, Blob>();
const hasIndexedDb = () => typeof indexedDB !== 'undefined';
const fileStore = () => (store ??= createStore('ordinovix-files', 'blobs'));

export async function putFile(key: string, blob: Blob): Promise<void> {
  if (!hasIndexedDb()) {
    memory.set(key, blob);
    return;
  }
  await set(key, blob, fileStore());
}

export async function getFileBlob(key: string): Promise<Blob | undefined> {
  if (!hasIndexedDb()) return memory.get(key);
  return get<Blob>(key, fileStore());
}

/** A fresh object URL for a stored file. The caller may revoke it; the bytes stay in IndexedDB. */
export async function getFileUrl(key: string): Promise<string> {
  const blob = await getFileBlob(key);
  if (!blob) throw new Error('This file is not stored on this device');
  return URL.createObjectURL(blob);
}

/** Save a stored or seeded file under `filename`: mints a fresh object URL for stored files, clicks a hidden link, then revokes it. */
export async function saveFile(storageKey: string, filename: string): Promise<void> {
  const stored = isStoredFileKey(storageKey);
  const href = stored ? await getFileUrl(storageKey) : storageKey;
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  if (stored) setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

// Spec 9.9 display names live in a module with no browser dependencies, so the Worker can use them too
export * from './document-name';
