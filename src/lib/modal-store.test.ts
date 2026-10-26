import { describe, it, expect, vi, beforeEach } from 'vitest';
import { centerModalStore } from './modal-store';

describe('centerModalStore', () => {
  beforeEach(() => {
    // Reset store count to 0
    while (centerModalStore.getCount() > 0) {
      centerModalStore.close();
    }
  });

  it('tracks modal open and close states correctly', () => {
    expect(centerModalStore.isOpen()).toBe(false);
    expect(centerModalStore.getCount()).toBe(0);

    centerModalStore.open();
    expect(centerModalStore.isOpen()).toBe(true);
    expect(centerModalStore.getCount()).toBe(1);

    centerModalStore.open();
    expect(centerModalStore.isOpen()).toBe(true);
    expect(centerModalStore.getCount()).toBe(2);

    centerModalStore.close();
    expect(centerModalStore.isOpen()).toBe(true);
    expect(centerModalStore.getCount()).toBe(1);

    centerModalStore.close();
    expect(centerModalStore.isOpen()).toBe(false);
    expect(centerModalStore.getCount()).toBe(0);
  });

  it('never drops below 0 when close is called extra times', () => {
    centerModalStore.close();
    centerModalStore.close();
    expect(centerModalStore.getCount()).toBe(0);
    expect(centerModalStore.isOpen()).toBe(false);
  });

  it('notifies registered subscribers on open and close', () => {
    const listener = vi.fn();
    const unsubscribe = centerModalStore.subscribe(listener);

    centerModalStore.open();
    expect(listener).toHaveBeenCalledTimes(1);

    centerModalStore.close();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    centerModalStore.open();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
