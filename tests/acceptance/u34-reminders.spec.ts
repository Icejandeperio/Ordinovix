/**
 * U34 — "Turn on reminders" subscribes this device (spec 14 and 19.3): permission is asked only after the tap, the subscription is
 * saved on the server and shown as On with a Turn off, an iPhone that is not installed is told what it needs, and signing out removes
 * the device's subscription. The browser's push pieces are stubbed (no push service is ever reached); with VITE_DATA_SOURCE=api the
 * requests go to the local Worker, in mock mode the button shows a "Push preview" toast instead.
 */
import { test, expect, type Page } from '@playwright/test';

const API = process.env.VITE_DATA_SOURCE === 'api';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/u34-test-endpoint';

interface Stub {
  permission?: 'granted' | 'denied';
  /** an iPhone with the page open in Safari, not installed: no PushManager, no Notification */
  iphone?: boolean;
  /** the device already holds a subscription */
  subscribed?: boolean;
}

async function stubPush(page: Page, stub: Stub = {}) {
  await page.addInitScript(
    ([o, endpoint]) => {
      const w = window as unknown as Record<string, any>;
      try {
        localStorage.setItem('ox-mock-persona', 'owner');
        localStorage.setItem('ox-mock-failure-rate', '0');
      } catch { /* storage unavailable */ }
      const state = { asks: 0, subscribed: !!o.subscribed, unsubscribed: 0, keyBytes: 0 };
      w.__push = state;
      const sub = {
        endpoint,
        toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'p'.repeat(24), auth: 'a'.repeat(22) } }),
        unsubscribe: async () => {
          state.subscribed = false;
          state.unsubscribed++;
          return true;
        },
      };
      const registration = {
        pushManager: {
          getSubscription: async () => (state.subscribed ? sub : null),
          subscribe: async (options: { applicationServerKey: Uint8Array }) => {
            state.subscribed = true;
            state.keyBytes = options.applicationServerKey.length;
            return sub;
          },
        },
      };
      Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: async () => registration, ready: Promise.resolve(registration) }, configurable: true });
      if (o.iphone) {
        Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', configurable: true });
        Object.defineProperty(navigator, 'platform', { value: 'iPhone', configurable: true });
        delete w.PushManager;
        delete w.Notification;
      } else {
        w.PushManager = function PushManager() { /* stub */ };
        w.Notification = {
          permission: 'default',
          requestPermission: async () => {
            state.asks++;
            return o.permission ?? 'granted';
          },
        };
      }
    },
    [stub, ENDPOINT] as const,
  );
}

const pushState = (page: Page) => page.evaluate(() => (window as unknown as { __push: { asks: number; subscribed: boolean; unsubscribed: number; keyBytes: number } }).__push);

/** Every request to the Worker's push routes, in order, as "METHOD /path". */
function watchPush(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/v1/push') || u.pathname === '/api/auth/sign-out') seen.push(`${r.method()} ${u.pathname}${u.search}`);
  });
  return seen;
}

test.describe('U34 phone reminders', () => {
  test('U34 Turn on reminders asks only after the tap, saves the subscription, shows On, and Turn off removes it', async ({ page }) => {
    await stubPush(page);
    const requests = watchPush(page);
    await page.goto('/settings/notifications');

    const turnOn = page.getByRole('button', { name: 'Turn on reminders' });
    await expect(turnOn).toBeVisible();
    expect((await pushState(page)).asks).toBe(0); // nothing was asked on page load

    await turnOn.click();
    await expect(page.getByText('Reminders On')).toBeVisible();
    expect((await pushState(page)).asks).toBe(API ? 1 : 0); // the mock has no permission to ask for

    if (API) {
      expect(requests).toContain('GET /api/v1/push/vapid-key');
      expect(requests).toContain('POST /api/v1/push/subscriptions');
      expect((await pushState(page)).keyBytes).toBe(65); // the server's VAPID public key, an uncompressed P-256 point
    } else {
      await expect(page.getByText(/Push preview/)).toBeVisible();
    }

    await page.getByRole('button', { name: 'Turn off' }).click();
    await expect(page.getByRole('button', { name: 'Turn on reminders' })).toBeVisible();
    if (API) {
      expect(requests).toContain(`DELETE /api/v1/push/subscriptions?endpoint=${encodeURIComponent(ENDPOINT)}`);
      expect((await pushState(page)).unsubscribed).toBe(1);
    }
  });

  test('U34 a device that already has reminders on shows On after a reload of the page', async ({ page }) => {
    await stubPush(page, { subscribed: true });
    await page.goto('/settings/notifications');
    if (!API) {
      // the mock keeps its own "on" flag, set by the button
      await page.getByRole('button', { name: 'Turn on reminders' }).click();
      await page.reload();
    }
    await expect(page.getByText('Reminders On')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn off' })).toBeVisible();
  });

  test('U34 an iPhone that is not on the Home Screen is told what it needs; a refusal in the browser is explained', async ({ page }) => {
    if (!API) {
      // the mock has no push service and does not look at the device
      await stubPush(page, { iphone: true });
      await page.goto('/settings/notifications');
      await expect(page.getByRole('button', { name: 'Turn on reminders' })).toBeVisible();
      return;
    }

    await stubPush(page, { iphone: true });
    await page.goto('/settings/notifications');
    await expect(page.getByText(/iOS 16\.4 or later/)).toBeVisible();
    await expect(page.getByText(/Add to Home Screen/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turn on reminders' })).toHaveCount(0);

    const refused = await page.context().newPage();
    await stubPush(refused, { permission: 'denied' });
    await refused.goto('/settings/notifications');
    await refused.getByRole('button', { name: 'Turn on reminders' }).click();
    await expect(refused.getByText(/blocked for Ordinovix in this browser/)).toBeVisible();
    expect((await pushState(refused)).asks).toBe(1);
    expect((await pushState(refused)).subscribed).toBe(false);
  });

  test('U34 Welcome step 5 turns reminders on from the same control, without a placeholder subscription', async ({ page }) => {
    await stubPush(page);
    const requests = watchPush(page);
    await page.goto('/welcome?step=5');
    await page.getByRole('button', { name: 'Turn on reminders' }).click();
    await expect(page.getByText('Reminders On')).toBeVisible();
    expect((await pushState(page)).asks).toBe(API ? 1 : 0); // the mock has no permission to ask for
    await page.getByRole('button', { name: 'Complete Setup' }).click();
    await expect(page).toHaveURL(/\/($|clients|\?)/);
    // one real subscription at the tap; Complete Setup adds none
    if (API) expect(requests.filter((r) => r.startsWith('POST /api/v1/push/subscriptions'))).toHaveLength(1);
  });

  test('U34 signing out removes this device\'s subscription before the session ends', async ({ page }) => {
    await stubPush(page, { subscribed: true });
    const requests = watchPush(page);
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();

    await page.locator('button[aria-label="Sign out"]:visible').first().click();
    await expect(page).toHaveURL(/\/sign-in/);

    expect((await pushState(page)).unsubscribed).toBe(1);
    if (API) {
      const remove = requests.findIndex((r) => r.startsWith('DELETE /api/v1/push/subscriptions'));
      const signOut = requests.indexOf('POST /api/auth/sign-out');
      expect(remove).toBeGreaterThanOrEqual(0);
      expect(signOut).toBeGreaterThan(remove); // while the session was still valid
    }
  });
});
