import { createStore, get, set, type UseStore } from 'idb-keyval';
import type { DocumentKind } from '@/domain/types';

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

// ---- Spec 9.9 display names: {CLIENTCODE}_{TEMPLATECODE}_{PERIOD}_{KIND}_v{N}.{ext} ----

const KIND_SLUGS: Record<DocumentKind, string> = {
  source: 'src',
  filed_return: 'return',
  acknowledgment: 'ack',
  payment_proof: 'payproof',
  stamped_copy: 'stamped',
  ecar: 'ecar',
  authorization: 'auth',
  other: 'other',
};

export const documentKindSlug = (kind: DocumentKind): string => KIND_SLUGS[kind] ?? 'other';

/** "BIR 1601-EQ" becomes "1601EQ"; a task without a template is "TASK". */
export function templateCodeSlug(code?: string): string {
  const cleaned = (code ?? '').replace(/^BIR\s+/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned || 'TASK';
}

/** "2026-Q3" becomes "2026Q3"; months, years and dates are kept as they are. */
export function periodSlug(period: string): string {
  return period.replace(/-(Q\d)$/i, '$1');
}

const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

function extensionOf(originalName: string, mimeType?: string): string {
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(originalName);
  if (m) return m[1].toLowerCase();
  return (mimeType && MIME_EXT[mimeType]) || 'pdf';
}

export function documentDisplayName(opts: {
  clientCode: string;
  templateCode?: string;
  /** Period key for periodic tasks, or the transaction date for one-off tasks. */
  period: string;
  kind: DocumentKind;
  versionNo: number;
  originalName: string;
  mimeType?: string;
}): string {
  const ext = extensionOf(opts.originalName, opts.mimeType);
  return `${opts.clientCode}_${templateCodeSlug(opts.templateCode)}_${periodSlug(opts.period)}_${documentKindSlug(opts.kind)}_v${opts.versionNo}.${ext}`;
}
