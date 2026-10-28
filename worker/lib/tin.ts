/**
 * Full TINs (rule 6 and the backend rules): encrypted with AES-GCM under TIN_ENCRYPTION_KEY, shown only masked, matched for
 * duplicates by an HMAC. A full TIN is never written to activity, logs, errors or any response except the one reveal route.
 */
export const TIN_PATTERN = /^\d{3}-?\d{3}-?\d{3}(?:-?\d{3,5})?$/;

/** '123456789' or '123-456-789-00000' to '123-456-789-00000'; null when it is not a TIN. */
export function normalizeTin(raw: string): string | null {
  const text = raw.trim();
  if (!TIN_PATTERN.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  const branch = digits.slice(9).padEnd(5, '0');
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${branch}`;
}

/** The display form: only the last three digits of the number and the branch code. */
export function maskTin(tin: string): string {
  const [, , third, branch] = tin.split('-');
  return `•••-•••-${third}-${branch}`;
}

const b64 = {
  encode: (bytes: Uint8Array) => {
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  },
  decode: (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0)),
};

async function aesKey(keyB64: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const raw = b64.decode(keyB64);
  if (raw.length !== 32) throw new Error('TIN_ENCRYPTION_KEY must be 32 bytes, base64');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, usage);
}

/** base64 of a random 12 byte IV followed by the ciphertext (which carries the GCM tag). */
export async function encryptTin(keyB64: string, tin: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64, ['encrypt']), new TextEncoder().encode(tin)));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return b64.encode(out);
}

export async function decryptTin(keyB64: string, blob: string): Promise<string> {
  const bytes = b64.decode(blob);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await aesKey(keyB64, ['decrypt']), bytes.slice(12));
  return new TextDecoder().decode(plain);
}

/** Hex HMAC-SHA256 of the digits, for duplicate checks. Not reversible, and useless without the key. */
export async function hashTin(keyB64: string, tin: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', b64.decode(keyB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`tin-hash:${tin.replace(/\D/g, '')}`)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Removes every key that could carry a full TIN or its ciphertext from a value about to be sent or logged. */
export function scrubTin<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null, (key, v) => (key === 'tinFull' || key === 'tinEncrypted' || key === 'tinHash' ? undefined : v)));
}
