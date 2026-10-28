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

/**
 * With the API data source a file lives in R2 under org/{org}/client/{client}/{year}/{task|misc}/{documentId}-v{n}.{ext}. Its
 * document id is in the key, so a screen that holds only the key can still ask the API for a short-lived signed URL.
 */
const REMOTE_KEY = /^org\/.+\/([^/]+)-v\d+\.[A-Za-z0-9_]+$/;
export const isRemoteFileKey = (key: string): boolean => REMOTE_KEY.test(key);
/** Whether the key needs a lookup (a file kept on this device, or one in R2) before a browser can load it. */
export const needsFileLookup = (key: string): boolean => isStoredFileKey(key) || isRemoteFileKey(key);

/** A fresh URL for a stored file: an object URL (the caller may revoke it; the bytes stay in IndexedDB), or a signed API URL. */
export async function getFileUrl(key: string, purpose: 'view' | 'download' = 'view'): Promise<string> {
  const remote = REMOTE_KEY.exec(key);
  if (remote) {
    const { repositories } = await import('@/data'); // loaded on demand: the data layer itself imports this module
    return repositories.documents.getUrl(remote[1], purpose);
  }
  const blob = await getFileBlob(key);
  if (!blob) throw new Error('This file is not stored on this device');
  return URL.createObjectURL(blob);
}

/** Save a stored or seeded file under `filename`: mints a fresh URL for stored files, clicks a hidden link, then revokes it. */
export async function saveFile(storageKey: string, filename: string): Promise<void> {
  const stored = needsFileLookup(storageKey);
  const href = stored ? await getFileUrl(storageKey, 'download') : storageKey;
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

// Spec 9.9 display names live in a module with no browser dependencies, so the Worker can use them too
export * from './document-name';
