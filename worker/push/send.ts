/**
 * Web Push from the Worker (BACKEND_PLAN 7a). @pushforge/builder builds the VAPID-signed, encrypted request with Web Crypto; the
 * Worker posts it to the push service the browser gave us. Nothing here runs in a test against the network: the caller passes
 * the functions that build and send (`PushDeps`), and tests pass stubs.
 */
import { buildPushHTTPRequest } from '@pushforge/builder';
import type { AppBindings } from '../env';

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** What a push carries: a short text with client and task codes only (spec 14: never names, TINs, amounts or contents). */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PushDeps {
  build: typeof buildPushHTTPRequest;
  fetch: (url: string, init: RequestInit) => Promise<{ status: number }>;
}

export const realPushDeps = (): PushDeps => ({ build: buildPushHTTPRequest, fetch: (url, init) => fetch(url, init) });

/** The VAPID private key as the JWK the builder wants, from the two base64url secrets (public point 0x04||x||y, private scalar d). */
export function vapidJwk(env: Pick<AppBindings, 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY'>): JsonWebKey {
  const raw = Uint8Array.from(atob(env.VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  if (raw.length !== 65 || raw[0] !== 4) throw new Error('VAPID_PUBLIC_KEY must be an uncompressed P-256 point');
  const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { kty: 'EC', crv: 'P-256', x: b64url(raw.slice(1, 33)), y: b64url(raw.slice(33, 65)), d: env.VAPID_PRIVATE_KEY, ext: true };
}

/**
 * Only the real push services: the Worker will POST to whatever endpoint is stored, so a stored endpoint must never point
 * at an address of someone's choosing (SSRF). https and a host under one of these.
 */
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com', 'push.apple.com', 'notify.windows.com'];
export function isPushEndpoint(raw: string): boolean {
  if (raw.length > 2000) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export type PushResult = 'sent' | 'gone' | 'failed';

/** One push to one subscription. 404 and 410 mean the browser dropped it: the caller deletes the subscription. */
export async function sendPush(deps: PushDeps, env: AppBindings, sub: PushSubscriptionRow, payload: PushPayload, adminContact: string): Promise<PushResult> {
  try {
    const request = await deps.build({
      privateJWK: vapidJwk(env),
      subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      message: { payload: { ...payload }, adminContact, options: { ttl: 12 * 60 * 60, urgency: 'normal', topic: payload.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, '') || undefined } },
    });
    const res = await deps.fetch(request.endpoint, { method: 'POST', headers: request.headers, body: request.body });
    if (res.status >= 200 && res.status < 300) return 'sent';
    if (res.status === 404 || res.status === 410) return 'gone';
    return 'failed';
  } catch {
    return 'failed';
  }
}

// ---- quiet hours -----------------------------------------------------------------------------------------------------
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** True from `start` until `end`, the window may cross midnight (20:00 to 07:00). The end minute itself is not quiet. */
export function inQuietHours(manilaHHmm: string, start: string, end: string): boolean {
  const now = minutes(manilaHHmm);
  const s = minutes(start);
  const e = minutes(end);
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

export const manilaHHmm = (now: Date): string => new Date(now.getTime() + 8 * 3600_000).toISOString().slice(11, 16);

/** Spec 14 defaults: which types push when a person has not chosen. */
export const DEFAULT_PUSH_TYPES = [
  'daily_digest', 'due_soon_blocked', 'overdue', 'follow_ups_due', 'visit_not_ready_tomorrow', 'left_not_ready', 'authorization_expiring',
  'accreditation_expiring', 'assigned',
] as const;
