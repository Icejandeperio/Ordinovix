/**
 * Security headers (BACKEND_PLAN section 8). The Worker adds them to every response it produces; the same set is in
 * public/_headers so the static app shell (index.html and assets, which the platform serves without running the
 * Worker) carries them too. worker/security-headers.test.ts keeps the two in step.
 *
 * script-src allows exactly one inline script by hash: the theme bootstrap in index.html that prevents a flash of the
 * wrong theme. The test recomputes the hash from index.html, so editing that script without updating this value fails.
 * style-src keeps 'unsafe-inline' because React and the motion library set inline style attributes.
 */
export const THEME_SCRIPT_HASH = 'sha256-DHNZJBbqAHWlQ5jX3v4o+VsPJNoJRKCQ04jnFdln8fs=';

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    `script-src 'self' '${THEME_SCRIPT_HASH}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "frame-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(self), geolocation=()',
};
