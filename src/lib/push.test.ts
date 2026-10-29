import { describe, expect, it, vi } from 'vitest';
import { pushSupport, readStatus, removeThisDevice, turnOff, turnOn, urlBase64ToUint8Array, type PushDeps, type PushEnv } from './push';

const desktop: PushEnv = { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', platform: 'Win32', maxTouchPoints: 0, standalone: false, hasServiceWorker: true, hasPushManager: true, hasNotification: true };
const iPhone = (o: Partial<PushEnv>): PushEnv => ({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', platform: 'iPhone', maxTouchPoints: 5, standalone: false, hasServiceWorker: true, hasPushManager: false, hasNotification: false, ...o });

describe('U34 can this device take reminders', () => {
  it('a current desktop or Android browser can', () => {
    expect(pushSupport(desktop)).toBe('ok');
  });

  it('an iPhone with the page open in Safari must first add the app to the Home Screen', () => {
    expect(pushSupport(iPhone({}))).toBe('needs-install');
    // an iPad reports itself as a Mac with a touch screen
    expect(pushSupport(iPhone({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', platform: 'MacIntel' }))).toBe('needs-install');
  });

  it('an iPhone with the app on the Home Screen can, from iOS 16.4 (which is when PushManager appears)', () => {
    expect(pushSupport(iPhone({ standalone: true, hasPushManager: true, hasNotification: true }))).toBe('ok');
    expect(pushSupport(iPhone({ standalone: true, hasPushManager: false }))).toBe('unsupported');
  });

  it('a browser without service workers, PushManager or Notification cannot', () => {
    expect(pushSupport({ ...desktop, hasPushManager: false })).toBe('unsupported');
    expect(pushSupport({ ...desktop, hasNotification: false })).toBe('unsupported');
    expect(pushSupport({ ...desktop, hasServiceWorker: false })).toBe('unsupported');
  });
});

describe('U34 base64url keys', () => {
  it('decodes the VAPID public key to its bytes', () => {
    expect([...urlBase64ToUint8Array('AQID_-A')]).toEqual([1, 2, 3, 255, 224]);
  });
});

interface Sub {
  endpoint: string;
  toJSON: () => PushSubscriptionJSON;
  unsubscribe: ReturnType<typeof vi.fn>;
}
const sub = (endpoint = 'https://fcm.googleapis.com/fcm/send/abc'): Sub => ({
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(20) } }),
  unsubscribe: vi.fn(async () => true),
});

function deps(o: { env?: PushEnv; permission?: NotificationPermission; granted?: NotificationPermission; existing?: Sub | null; registration?: boolean; saveFails?: boolean; removeFails?: boolean } = {}) {
  const created = sub('https://fcm.googleapis.com/fcm/send/new');
  const subscribe = vi.fn(async (_o: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => created);
  const d = {
    env: o.env ?? desktop,
    permission: vi.fn(() => o.permission ?? 'default'),
    requestPermission: vi.fn(async () => o.granted ?? 'granted'),
    registration: vi.fn(async () => (o.registration === false ? undefined : { pushManager: { getSubscription: async () => o.existing ?? null, subscribe } })),
    vapidKey: vi.fn(async () => 'AQID_-A'),
    save: vi.fn(async (_s: PushSubscriptionJSON) => {
      if (o.saveFails) throw new Error('server said no');
    }),
    remove: vi.fn(async (_e: string) => {
      if (o.removeFails) throw new Error('offline');
    }),
  } satisfies PushDeps;
  return { d: d as PushDeps, raw: d, subscribe, created };
}

describe('U34 reminders state of this device', () => {
  it('asks nothing of the person while it only reads the state', async () => {
    const t = deps();
    expect(await readStatus(t.d)).toBe('off');
    expect(t.raw.requestPermission).not.toHaveBeenCalled();
  });

  it('on when this device already has a subscription', async () => {
    expect(await readStatus(deps({ permission: 'granted', existing: sub() }).d)).toBe('on');
  });

  it('blocked when the person refused notifications in the browser', async () => {
    expect(await readStatus(deps({ permission: 'denied' }).d)).toBe('blocked');
  });

  it('unavailable without a service worker (the development server), and the support answers come first', async () => {
    expect(await readStatus(deps({ registration: false }).d)).toBe('unavailable');
    const t = deps({ env: iPhone({}) });
    expect(await readStatus(t.d)).toBe('needs-install');
    expect(t.raw.registration).not.toHaveBeenCalled();
    expect(await readStatus(deps({ env: { ...desktop, hasPushManager: false } }).d)).toBe('unsupported');
  });
});

describe('U34 Turn on reminders', () => {
  it('asks for permission, subscribes with the server key, saves the subscription, and is On', async () => {
    const t = deps();
    expect(await turnOn(t.d)).toBe('on');
    expect(t.raw.requestPermission).toHaveBeenCalledTimes(1);
    expect(t.subscribe).toHaveBeenCalledTimes(1);
    const arg = t.subscribe.mock.calls[0][0];
    expect(arg.userVisibleOnly).toBe(true);
    expect([...arg.applicationServerKey]).toEqual([1, 2, 3, 255, 224]);
    expect(t.raw.save).toHaveBeenCalledWith(t.created.toJSON());
  });

  it('asks first thing: iOS Safari wants the question inside the tap, before anything is awaited', async () => {
    const order: string[] = [];
    const t = deps();
    t.raw.requestPermission.mockImplementation(async () => {
      order.push('ask');
      return 'granted';
    });
    t.raw.registration.mockImplementation(async () => {
      order.push('registration');
      return { pushManager: { getSubscription: async () => null, subscribe: t.subscribe } };
    });
    await turnOn(t.d);
    expect(order).toEqual(['ask', 'registration']);
  });

  it('stops at a refusal: nothing is subscribed or saved', async () => {
    const t = deps({ granted: 'denied' });
    expect(await turnOn(t.d)).toBe('blocked');
    expect(t.subscribe).not.toHaveBeenCalled();
    expect(t.raw.save).not.toHaveBeenCalled();
  });

  it('does not ask on a device that cannot take reminders', async () => {
    const t = deps({ env: iPhone({}) });
    expect(await turnOn(t.d)).toBe('needs-install');
    expect(t.raw.requestPermission).not.toHaveBeenCalled();
  });

  it('undoes the browser subscription when the server does not keep it, and says so', async () => {
    const t = deps({ saveFails: true });
    await expect(turnOn(t.d)).rejects.toThrow('server said no');
    expect(t.created.unsubscribe).toHaveBeenCalled();
  });
});

describe('U34 Turn off reminders and sign-out', () => {
  it('Turn off removes the subscription on the server and in the browser', async () => {
    const existing = sub();
    const t = deps({ permission: 'granted', existing });
    expect(await turnOff(t.d)).toBe('off');
    expect(t.raw.remove).toHaveBeenCalledWith(existing.endpoint);
    expect(existing.unsubscribe).toHaveBeenCalled();
  });

  it('sign-out removes this device and never blocks signing out, even when the server cannot be reached', async () => {
    const existing = sub();
    const t = deps({ permission: 'granted', existing, removeFails: true });
    await expect(removeThisDevice(t.d)).resolves.toBeUndefined();
    expect(existing.unsubscribe).toHaveBeenCalled();
  });

  it('sign-out on a device with no subscription or no support does nothing', async () => {
    const none = deps();
    await removeThisDevice(none.d);
    expect(none.raw.remove).not.toHaveBeenCalled();
    const unsupported = deps({ env: { ...desktop, hasPushManager: false } });
    await removeThisDevice(unsupported.d);
    expect(unsupported.raw.registration).not.toHaveBeenCalled();
  });
});
