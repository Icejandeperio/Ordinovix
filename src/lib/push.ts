/**
 * Reminders on this device (spec 14 and 19.3): Web Push through the service worker. Nothing here runs at page load: the person
 * taps "Turn on reminders", and only then does the browser ask for permission. The functions take their browser and server
 * access as `PushDeps`, so tests pass stubs and nothing reaches the network.
 */
export interface PushEnv {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** The app is open from the Home Screen (iPhone) or as an installed app. */
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

export type PushSupport = 'ok' | 'needs-install' | 'unsupported';

/**
 * iPhone and iPad give a web page push only after "Add to Home Screen" and from iOS 16.4 (spec 19.3), and without the install
 * they show no PushManager at all, so the install hint has to be decided before looking for the API.
 */
export function pushSupport(env: PushEnv): PushSupport {
  const apple = /iPhone|iPad|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
  if (apple && !env.standalone) return 'needs-install';
  return env.hasServiceWorker && env.hasPushManager && env.hasNotification ? 'ok' : 'unsupported';
}

/** The state of the button: `unavailable` is a browser that could, but where this build has no service worker (the dev server). */
export type RemindersStatus = 'on' | 'off' | 'blocked' | 'needs-install' | 'unsupported' | 'unavailable';

export interface PushSubscriptionLike {
  endpoint: string;
  toJSON(): PushSubscriptionJSON;
  unsubscribe(): Promise<boolean>;
}

export interface PushRegistrationLike {
  pushManager: {
    getSubscription(): Promise<PushSubscriptionLike | null>;
    subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<PushSubscriptionLike>;
  };
}

export interface PushDeps {
  env: PushEnv;
  permission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  /** The registration of the app's service worker, or undefined when there is none. */
  registration(): Promise<PushRegistrationLike | undefined>;
  /** The public half of the VAPID key (GET /api/v1/push/vapid-key), base64url. */
  vapidKey(): Promise<string>;
  save(sub: PushSubscriptionJSON): Promise<void>;
  remove(endpoint: string): Promise<void>;
}

export function urlBase64ToUint8Array(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** What this device is now. It never asks the person for anything. */
export async function readStatus(deps: PushDeps): Promise<RemindersStatus> {
  const support = pushSupport(deps.env);
  if (support !== 'ok') return support;
  if (deps.permission() === 'denied') return 'blocked';
  const registration = await deps.registration();
  if (!registration) return 'unavailable';
  return (await registration.pushManager.getSubscription()) ? 'on' : 'off';
}

/** The tap on "Turn on reminders": ask, subscribe with the server's key, keep the subscription on the server. */
export async function turnOn(deps: PushDeps): Promise<RemindersStatus> {
  const support = pushSupport(deps.env);
  if (support !== 'ok') return support;
  // The question comes first, inside the tap: iOS Safari only allows it while the tap is still the active gesture, and looking up
  // the service worker is asynchronous. (On the development server there is no worker, and the person is told so after the question.)
  if ((await deps.requestPermission()) !== 'granted') return 'blocked';
  const registration = await deps.registration();
  if (!registration) return 'unavailable';
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(await deps.vapidKey()),
  });
  try {
    await deps.save(subscription.toJSON());
  } catch (error) {
    // a subscription the server does not hold would never get a reminder: do not leave it behind in the browser
    await subscription.unsubscribe().catch(() => false);
    throw error;
  }
  return 'on';
}

export async function turnOff(deps: PushDeps): Promise<RemindersStatus> {
  const registration = await deps.registration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await deps.remove(subscription.endpoint);
    await subscription.unsubscribe();
  }
  return 'off';
}

/**
 * Sign-out (spec 19.5): this device stops getting reminders for the person who signs out. Best effort: signing out is never held up
 * by it, and the browser subscription goes even when the server cannot be reached (the Worker drops a dead one on its next send).
 */
export async function removeThisDevice(deps: PushDeps): Promise<void> {
  if (pushSupport(deps.env) !== 'ok') return;
  try {
    const registration = await deps.registration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await deps.remove(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe().catch(() => false);
  } catch {
    // nothing to remove, or the browser would not say: sign-out goes on
  }
}

/** The browser side of `PushDeps`; the server side (`vapidKey`, `save`, `remove`) comes from the data layer. */
export function browserPushDeps(server: Pick<PushDeps, 'vapidKey' | 'save' | 'remove'>): PushDeps {
  const hasWindow = typeof window !== 'undefined';
  const nav = (hasWindow ? navigator : undefined) as (Navigator & { standalone?: boolean }) | undefined;
  return {
    env: {
      userAgent: nav?.userAgent ?? '',
      platform: nav?.platform ?? '',
      maxTouchPoints: nav?.maxTouchPoints ?? 0,
      standalone: !!nav && (nav.standalone === true || (hasWindow && window.matchMedia?.('(display-mode: standalone)').matches === true)),
      hasServiceWorker: !!nav && 'serviceWorker' in nav,
      hasPushManager: hasWindow && 'PushManager' in window,
      hasNotification: hasWindow && 'Notification' in window,
    },
    permission: () => (typeof Notification === 'undefined' ? 'default' : Notification.permission),
    requestPermission: () => Notification.requestPermission(),
    registration: async () => {
      if (!nav || !('serviceWorker' in nav)) return undefined;
      // the generated worker exists only in a production build; none registered means "unavailable", not an error
      return (await nav.serviceWorker.getRegistration()) as unknown as PushRegistrationLike | undefined;
    },
    ...server,
  };
}
