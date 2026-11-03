/**
 * U41 — demo readiness: an offline sign-out still ends the session, and an API build shows no simulated UI.
 * Runs in both data sources: with VITE_DATA_SOURCE=api (the `verify-api` CI job) each test proves the real behaviour; in mock mode
 * it proves the sample-data behaviour is unchanged where the criterion is about the API build.
 */
import { test, expect, type Page } from '@playwright/test';

const API = process.env.VITE_DATA_SOURCE === 'api';
const PENDING_KEY = 'ox-pending-sign-out';
// A valid 1x1 PNG, so the browser can decode it
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ox-mock-persona', 'owner');
      localStorage.setItem('ox-mock-failure-rate', '0');
    } catch {
      /* storage unavailable */
    }
  });
}

const FORBIDDEN_TEXT = /simulated|sample data/i;

async function expectNoSimulatedText(page: Page) {
  await expect(page.locator('body')).not.toContainText(FORBIDDEN_TEXT);
}

test.describe('U41 offline sign-out', () => {
  test('U41 a sign-out the server did not receive keeps the person signed out until it is sent', async ({ page, playwright, baseURL }) => {
    await asOwner(page);
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();
    if (!API) {
      // The sample data has no server session: signing out just returns to /sign-in, with nothing pending
      await page.locator('button[aria-label="Sign out"]:visible').first().click();
      await expect(page).toHaveURL(/\/sign-in/);
      expect(await page.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).toBeNull();
      return;
    }

    // The session cookie the browser holds now authorizes reads
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
    const withOldCookie = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: cookie } });
    expect((await withOldCookie.get('/api/v1/session/me')).status()).toBe(200);

    // No dev sign-in from here on, so only a real session could authorize anything
    await page.route('**/api/v1/dev/sign-in', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'x' } }) }),
    );
    // The server cannot be reached for the sign-out
    await page.route('**/api/auth/sign-out', (route) => route.abort('internetdisconnected'));

    await page.locator('button[aria-label="Sign out"]:visible').first().click();
    await expect(page).toHaveURL(/\/sign-in/);
    expect(await page.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).not.toBeNull();

    // While the marker exists, opening the app goes to /sign-in and no data request is sent
    const dataRequests: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/v1/')) dataRequests.push(r.url());
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator('#main-content')).toHaveCount(0);
    expect(dataRequests).toEqual([]);

    // Back online: the server sign-out is sent first and the marker is removed
    await page.unroute('**/api/auth/sign-out');
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in/);
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).toBeNull();
    expect((await withOldCookie.get('/api/v1/session/me')).status()).toBe(401);
    await withOldCookie.dispose();
  });
});

test.describe('U41 task detail uploads', () => {
  test('U41 the payment proof button uploads through the documents flow and the file is on the task after a reload', async ({ page }) => {
    await asOwner(page);
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await page.goto('/tasks/task-rsp-0619e');
    await expect(page.getByText('Payment Proof', { exact: true })).toBeVisible();
    await expect(page.getByText('Payment receipt missing')).toBeVisible();

    await page.getByRole('button', { name: /Upload Payment Proof/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="file"]:not([capture])').setInputFiles({
      name: 'proof.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_1X1, 'base64'),
    });
    await expect(dialog).toHaveCount(0, { timeout: 15_000 }); // the upload finished and the dialog closed

    await page.reload();
    await expect(page.getByText('Bank deposit validated')).toBeVisible();
    expect(dialogs).toEqual([]); // never alert()
  });
});

test.describe('U41 Today preview', () => {
  test('U41 previewing a received document opens the real preview drawer', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    const preview = page.getByTitle('Preview file').first();
    await expect(preview).toBeVisible();
    await preview.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Simulated Document Preview')).toHaveCount(0);
    // the drawer's own controls, not the old placeholder box
    await expect(page.getByTitle('Download original file')).toBeVisible();
  });
});

test.describe('U41 no simulated wording in the API build', () => {
  test('U41 Today, a task detail, Settings and Welcome show no "Simulated" or "sample data" text in the API build', async ({ page }) => {
    await asOwner(page);
    // each page with something only it shows, so the text is checked once the page has loaded
    const pages: Array<[string, string | RegExp]> = [
      ['/', /Received, Awaiting My Review/],
      ['/tasks/task-rsp-0619e', /Payment Proof/],
      ['/settings/data', /Automated Backup Status/],
      ['/welcome?step=2', /Step 2 of 5/],
    ];
    for (const [path, loaded] of pages) {
      await page.goto(path);
      await expect(page.getByText(loaded).first()).toBeVisible();
      if (API) await expectNoSimulatedText(page);
    }
    if (!API) return;

    // the backup panel: only facts the app knows
    await page.goto('/settings/data');
    await expect(page.getByText(/schedule set up by the administrator/i)).toBeVisible();
    for (const gone of [/Yesterday at/, /AES-256/, /NIRC/, /^Active$/]) await expect(page.getByText(gone)).toHaveCount(0);
  });
});
