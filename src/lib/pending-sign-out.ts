/**
 * A sign-out the server has not received yet (the device was offline, or the call failed). While the marker exists the app treats
 * the person as signed out; the server sign-out is sent first when the device can reach it again (src/data/api/http.ts).
 * Holds no identity and no secret: only that a sign-out is owed.
 */
export const PENDING_SIGN_OUT_KEY = 'ox-pending-sign-out';

export function hasPendingSignOut(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(PENDING_SIGN_OUT_KEY) !== null;
  } catch {
    return false;
  }
}

export function setPendingSignOut(): void {
  try {
    window.localStorage.setItem(PENDING_SIGN_OUT_KEY, new Date().toISOString());
  } catch {
    /* storage unavailable: the person is still signed out on this device */
  }
}

export function clearPendingSignOut(): void {
  try {
    window.localStorage.removeItem(PENDING_SIGN_OUT_KEY);
  } catch {
    /* storage unavailable */
  }
}
