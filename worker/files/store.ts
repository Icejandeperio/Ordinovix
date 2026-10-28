/**
 * Files in R2 (BACKEND_PLAN section 7). The bucket is never public: bytes go in through the Worker after the checks below,
 * and come out only through a short-lived signed URL (or a data: URL for the seeded sample files).
 */
import type { FileStore } from '@/data/commands';
import type { DocumentFile } from '@/domain/types';
import { todayInManila } from '@/lib/dates';
import type { AppBindings } from '../env';

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_THUMB_BYTES = 1024 * 1024;
export const URL_TTL_SECONDS = 5 * 60;

// ---- type by content, never by the name or the type the browser claims -------------------------------------------------
const startsWith = (b: Uint8Array, at: number, text: string) => [...text].every((ch, i) => b[at + i] === ch.charCodeAt(0));

/** PDF, PNG, JPEG, WebP or HEIC/HEIF by their first bytes; null for anything else. */
export function sniffType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, 0, '%PDF-')) return 'application/pdf';
  if (bytes[0] === 0x89 && startsWith(bytes, 1, 'PNG\r\n') && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP')) return 'image/webp';
  if (startsWith(bytes, 4, 'ftyp') && ['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heif'].some((brand) => startsWith(bytes, 8, brand))) return 'image/heic';
  return null;
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as ArrayBuffer));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- signed URLs -------------------------------------------------------------------------------------------------------
const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmacKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}
const message = (id: string, purpose: string, exp: number) => encoder.encode(`${id}.${purpose}.${exp}`);

export async function signedFilePath(secret: string, id: string, purpose: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const exp = nowSeconds + URL_TTL_SECONDS;
  const sig = b64url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), message(id, purpose, exp))));
  return `/api/v1/files/${encodeURIComponent(id)}/content?purpose=${purpose}&exp=${exp}&sig=${sig}`;
}

/** True only for an unexpired URL whose id, purpose and expiry are exactly what was signed. */
export async function verifyFileUrl(secret: string, id: string, purpose: string, exp: string | undefined, sig: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const expiry = Number(exp);
  if (!sig || !Number.isInteger(expiry) || expiry < nowSeconds || expiry > nowSeconds + URL_TTL_SECONDS) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(secret, ['verify']), fromB64url(sig), message(id, purpose, expiry));
  } catch {
    return false;
  }
}

// ---- the R2 FileStore -----------------------------------------------------------------------------------------------
const safeSegment = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');

/**
 * Key layout: org/{orgId}/client/{clientId}/{yyyy}/{taskId|misc}/{documentId}-v{n}.{ext}; thumbnails in a thumbs/ folder beside.
 * A key is written once and never overwritten or reused: a replacement is a new document id and a new version.
 */
export function createR2Files(env: Pick<AppBindings, 'FILES' | 'FILE_URL_SIGNING_KEY'>): FileStore & { uploaded: string[]; discard(): Promise<void> } {
  const uploaded: string[] = [];
  return {
    uploaded,
    keyFor: ({ orgId, clientId, taskId, documentId, versionNo, ext, thumb }) => {
      const year = todayInManila().slice(0, 4);
      const folder = `org/${safeSegment(orgId)}/client/${safeSegment(clientId)}/${year}/${taskId ? safeSegment(taskId) : 'misc'}`;
      return `${folder}/${thumb ? 'thumbs/' : ''}${safeSegment(documentId)}-v${versionNo}.${safeSegment(ext)}`;
    },
    put: async (key, blob) => {
      const stored = await env.FILES.put(key, await blob.arrayBuffer(), {
        httpMetadata: { contentType: blob.type },
        onlyIf: { etagDoesNotMatch: '*' }, // never overwrite: keys are not reused
      });
      if (!stored) throw new Error('A file already exists under this key');
      uploaded.push(key);
    },
    urlFor: async (doc: DocumentFile, purpose) => {
      // seeded sample files carry a data: URL (with '#<id>' only to stay unique), there is nothing in R2 for them
      if (doc.storageKey.startsWith('data:')) return doc.storageKey.replace(/#[\w-]+$/, '');
      return signedFilePath(env.FILE_URL_SIGNING_KEY, doc.id, purpose);
    },
    /** After a failed write: remove what this request put in the bucket. */
    discard: async () => {
      if (uploaded.length > 0) await env.FILES.delete(uploaded.splice(0));
    },
  };
}
