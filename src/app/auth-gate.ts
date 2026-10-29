import type { QueryClient } from '@tanstack/react-query';
import { setAuthFailureHandler } from '@/data/auth-events';
import { ACCESS_PENDING_PATH, SIGN_IN_PATH, signInPath } from '@/lib/auth';
import { router } from './router';

/**
 * Builds that talk to the API: when the server refuses a request for want of a session (401 UNAUTHENTICATED) the person goes to
 * /sign-in and comes back to the page they wanted; when they are signed in but not yet added (403 ACCESS_PENDING) they go to
 * /access-pending. Whatever was loaded is dropped once they have left, so nothing signed-in shows while signed out.
 */
export function installAuthGate(queryClient: QueryClient): void {
  let leaving = false;
  setAuthFailureHandler((failure) => {
    const { pathname, search, hash } = router.state.location;
    const onAuthPage = [SIGN_IN_PATH, ACCESS_PENDING_PATH].some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (leaving || onAuthPage) return;
    leaving = true;
    const target = failure === 'access-pending' ? ACCESS_PENDING_PATH : signInPath(`${pathname}${search}${hash}`);
    void router
      .navigate(target, { replace: true })
      .then(() => queryClient.clear())
      .finally(() => {
        leaving = false;
      });
  });
}
