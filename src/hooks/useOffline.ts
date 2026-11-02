import { useSyncExternalStore } from 'react';
import { devControls, offlineQueue } from '@/data';

const subscribe = (notify: () => void): (() => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  // The dev menu's offline switch tells the queue to refresh
  const unsubscribe = offlineQueue.subscribe(notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
    unsubscribe();
  };
};

const read = (): boolean => (typeof navigator !== 'undefined' && navigator.onLine === false) || devControls.getOffline();

/** True while the device has no connection (spec 19.3). Actions that need one, such as creating a client, disable themselves. */
export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export const NEEDS_CONNECTION = 'Needs a connection. Try again when you are back online.';
