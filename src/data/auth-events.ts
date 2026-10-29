/**
 * How the data layer tells the app that the server refused a request for want of a session. The HTTP layer reports it (it
 * sees every request, including queued writes); the app shell registers one handler that routes to /sign-in or
 * /access-pending. No imports on purpose: both sides load it without pulling in the other.
 */
export type AuthFailure = 'unauthenticated' | 'access-pending';

let handler: ((failure: AuthFailure) => void) | undefined;

export const setAuthFailureHandler = (fn: ((failure: AuthFailure) => void) | undefined): void => {
  handler = fn;
};

export const notifyAuthFailure = (failure: AuthFailure): void => handler?.(failure);
