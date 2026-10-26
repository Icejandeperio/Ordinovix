import { useSyncExternalStore } from 'react';

/**
 * Global reactive store tracking whether any floating center modal/window
 * (such as ModalDialog, CommandPalette, etc.) is currently open.
 * Enables AppShell to automatically slide away sidebars, top bars, and banners.
 */
let activeCenterModalCount = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error notifying modal store listener:', err);
    }
  });

  if (typeof document !== 'undefined') {
    if (activeCenterModalCount > 0) {
      document.documentElement.setAttribute('data-center-modal-open', 'true');
    } else {
      document.documentElement.removeAttribute('data-center-modal-open');
    }
  }
}

export const centerModalStore = {
  open: () => {
    activeCenterModalCount++;
    notify();
  },
  close: () => {
    activeCenterModalCount = Math.max(0, activeCenterModalCount - 1);
    notify();
  },
  getCount: () => activeCenterModalCount,
  isOpen: () => activeCenterModalCount > 0,
  subscribe: (callback: () => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
};

/**
 * React hook to observe whether any center modal or floating window is active.
 */
export function useIsCenterModalOpen(): boolean {
  return useSyncExternalStore(
    centerModalStore.subscribe,
    centerModalStore.isOpen,
    () => false
  );
}
