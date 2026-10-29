/**
 * U39 — a deployed build signs people in with Google, sends a refused session to /sign-in or /access-pending, and signs out on the
 * server. The suite runs in both data sources: with VITE_DATA_SOURCE=api (the `verify-api` CI job, or locally with a Worker) each test
 * proves the real behaviour; in mock mode it proves the sample-data behaviour is unchanged. Google is never reached: its round trip
 * is stubbed with route interception.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

const API = process.env.VITE_DATA_SOURCE === 'api';

const GOOGLE_URL =
  'https://accounts.google.com/o/oauth2/v2/auth?client_id=stub-client&redirect_uri=http%3A%2F%2F127.0.0.1%3A5173%2Fapi%2Fauth%2Fcallback%2Fgoogle&response_type=code';

/** Stubs Google: the sign-in/social call answers with a Google URL, and nothing leaves the machine. */
async function stubGoogle(page: Page, onSignIn: (route: Route, body: Record<string, unknown>, n: number) => Promise<void> | void) {
  let calls = 0;
  await page.route('**/api/auth/sign-in/social', async (route) => {
    calls += 1;
    await onSignIn(route, route.request().postDataJSON() as Record<string, unknown>, calls);
  });
  await page.route('https://accounts.google.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Stubbed Google</h1>' }));
}

const answerWithGoogleUrl = (route: Route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: GOOGLE_URL, redirect: true }) });

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  });
}

test.describe('U39 real sign-in', () => {
  test('U39 Continue with Google starts the Google sign-in, and a failed start shows Retry', async ({ page }) => {
    if (!API) {
      // Mock mode keeps today's behaviour: the Google button signs in as the owner persona
      await asOwner(page);
      await page.goto('/sign-in');
      await page.getByRole('button', { name: 'Continue with Google' }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByText('Sample Data Mode')).toBeVisible();
      return;
    }

    const bodies: Array<Record<string, unknown>> = [];
    await stubGoogle(page, async (route, body, n) => {
      bodies.push(body);
      if (n === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) });
      return answerWithGoogleUrl(route);
    });

    await page.goto('/sign-in?next=%2Ftasks');
    await page.getByRole('button', { name: 'Continue with Google' }).click();

    // The first try fails: an inline error with Retry, and the person stays on the page
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(/could not start google sign-in/i);
    await expect(page).toHaveURL(/\/sign-in/);

    // Retry posts again and follows the URL the server returns
    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toMatchObject({ provider: 'google', callbackURL: '/tasks' });
  });

  test('U39 an API build shows no mock-only or dev-only control or wording', async ({ page }) => {
    await asOwner(page);
    await page.goto('/sign-in');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    const mockBlock = [page.getByText(/mock mode only/i), page.getByRole('button', { name: /Continue as (Ana|Ben)/ }), page.getByText(/Simulate unauthorized/i)];
    for (const item of mockBlock) {
      if (API) await expect(item).toHaveCount(0);
      else await expect(item.first()).toBeVisible();
    }

    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByText('Sample Data Mode')).toHaveCount(API ? 0 : 1);
    await expect(page.getByText('Dev Menu', { exact: true })).toHaveCount(API ? 0 : 1);

    if (!API) return;
    // The error state of a screen no longer talks about simulated latency
    await page.route('**/api/v1/today**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL', message: 'x' } }) }));
    await page.reload();
    await expect(page.getByText('Failed to load Today queue')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/simulated/i)).toHaveCount(0);
  });

  test('U39 a signed-out visit goes to sign-in and remembers the page; access pending goes to its page', async ({ page }) => {
    await asOwner(page);
    if (!API) {
      await page.goto('/tasks');
      await expect(page).toHaveURL(/\/tasks$/);
      return;
    }

    // No dev sign-in: the browser has no session, whatever persona is saved in localStorage
    await page.route('**/api/v1/dev/sign-in', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'x' } }) }));
    let callback: unknown;
    await stubGoogle(page, (route, body) => {
      callback = body.callbackURL;
      return answerWithGoogleUrl(route);
    });

    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Ftasks$/);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.locator('#main-content')).toHaveCount(0); // nothing of the app shows while signed out

    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
    expect(callback).toBe('/tasks'); // after signing in the server sends the person back to /tasks

    // Signed in with Google but not added by the owner yet
    await page.unroute('**/api/v1/dev/sign-in');
    await page.route('**/api/v1/session/me', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 'ACCESS_PENDING', message: 'pending' } }) }));
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ session: {}, user: { email: 'pat@example.org' } }) }));
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/access-pending$/);
    await expect(page.getByRole('heading', { name: 'Access Pending' })).toBeVisible();
    await expect(page.getByText('pat@example.org')).toBeVisible();
  });

  test('U39 Sign out ends the server session before returning to sign-in', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();

    const signOut = page.locator('button[aria-label="Sign out"]:visible').first();
    if (!API) {
      await signOut.click();
      await expect(page).toHaveURL(/\/sign-in$/);
      return;
    }

    expect((await page.request.get('/api/v1/session/me')).status()).toBe(200);
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('/api/auth/sign-out') && r.request().method() === 'POST'), signOut.click()]);
    expect(response.ok()).toBe(true);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.locator('#main-content')).toHaveCount(0);
    // The session is gone on the server, not only forgotten by the page
    expect((await page.request.get('/api/v1/session/me')).status()).toBe(401);
  });
});
