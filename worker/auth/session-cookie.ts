import { SESSION_MAX_AGE_SECONDS } from './auth';

/**
 * The session cookie Better Auth reads: `<token>.<signature>` where the signature is the base64 HMAC-SHA256 of the token
 * under BETTER_AUTH_SECRET, URL-encoded. The dev sign-in route and the Worker tests create sessions directly in the
 * database, so they have to produce the same cookie Better Auth itself would set after a Google sign-in.
 */
export const SESSION_COOKIE_NAME = '__Secure-better-auth.session_token';

async function hmacBase64(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  let binary = '';
  new Uint8Array(signature).forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export async function signedSessionValue(secret: string, token: string): Promise<string> {
  return encodeURIComponent(`${token}.${await hmacBase64(secret, token)}`);
}

/** A `Cookie` request header value for a session token. */
export async function sessionCookieHeader(secret: string, token: string): Promise<string> {
  return `${SESSION_COOKIE_NAME}=${await signedSessionValue(secret, token)}`;
}

/** A `Set-Cookie` header for a new session: HttpOnly, Secure, SameSite=Lax, 30 days. */
export async function setSessionCookieHeader(secret: string, token: string): Promise<string> {
  return `${SESSION_COOKIE_NAME}=${await signedSessionValue(secret, token)}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
