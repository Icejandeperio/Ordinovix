/** Where sign-in and the session gate send the person, and how they come back. Pure helpers; no browser access. */
export const SIGN_IN_PATH = '/sign-in';
export const ACCESS_PENDING_PATH = '/access-pending';

const AUTH_PAGES = [SIGN_IN_PATH, ACCESS_PENDING_PATH];

/**
 * The in-app page to return to after signing in. Only a plain path is accepted (no other site, no protocol-relative
 * `//host`, no backslash tricks), and the auth pages themselves are never a destination. Anything else is Today.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  // eslint-disable-next-line no-control-regex
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return '/';
  const pathname = raw.split(/[?#]/)[0];
  if (AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return '/';
  return raw;
}

/** `/sign-in`, carrying the page the person wanted when it is not Today. */
export function signInPath(next?: string): string {
  const target = safeNext(next);
  return target === '/' ? SIGN_IN_PATH : `${SIGN_IN_PATH}?next=${encodeURIComponent(target)}`;
}
