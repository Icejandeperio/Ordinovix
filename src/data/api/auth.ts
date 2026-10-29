import { request } from './http';

/**
 * Sign-in with Google through Better Auth (`/api/auth`). The server answers with the Google URL to go to; Google then sends the
 * person to /api/auth/callback/google, which sets the session cookie and redirects to `callbackURL`.
 */
export async function requestGoogleSignIn(callbackURL: string, fetchImpl?: typeof fetch): Promise<string> {
  const answer = await request<{ url?: string } | undefined>('POST', '/api/auth/sign-in/social', {
    body: { provider: 'google', callbackURL, errorCallbackURL: '/sign-in' },
    bootstrap: true,
    fetchImpl,
  });
  const url = answer?.url;
  let parsed: URL | undefined;
  try {
    parsed = url ? new URL(url) : undefined;
  } catch {
    parsed = undefined;
  }
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
    throw new Error('Google sign-in did not start. Try again.');
  }
  return parsed.toString();
}

/** The Google address the person is signed in with (shown on the access-pending page), or undefined when there is none. */
export async function fetchSignedInEmail(fetchImpl: typeof fetch = fetch): Promise<string | undefined> {
  try {
    const res = await fetchImpl('/api/auth/get-session', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { user?: { email?: string } } | null;
    return body?.user?.email || undefined;
  } catch {
    return undefined;
  }
}
