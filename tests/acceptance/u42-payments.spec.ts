/**
 * U42 — editing a payment: the proof is a real uploaded file that is still there after a reload (no invented document id), and a
 * server fault shows its error ID with a way to copy it. Both data sources; the fault test needs the Worker's answer, so it runs in
 * API mode (the `verify-api` CI job).
 */
import { test, expect, type Page } from '@playwright/test';

const API = process.env.VITE_DATA_SOURCE === 'api';
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

const missingRows = (page: Page) => page.locator('tbody tr').filter({ hasText: 'Proof missing' });

test.describe('U42 payment proof and server faults', () => {
  test('U42 a proof uploaded while editing a payment is still attached after a reload', async ({ page }) => {
    await asOwner(page);
    await page.goto('/payments');
    await expect(page.getByRole('button', { name: /Record Payment/ }).first()).toBeVisible();
    await expect(missingRows(page).first()).toBeVisible();
    const before = await missingRows(page).count();

    await missingRows(page).first().getByTitle('Edit Payment').click();
    await page.getByRole('button', { name: /Upload Proof/ }).click();
    await page.locator('input[type="file"]:not([capture])').last().setInputFiles({ name: 'slip.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1X1, 'base64') });
    await expect(page.getByText('Payment receipt attached').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Update Payment/ }).click();
    await expect(page.getByText('Payment updated').first()).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole('button', { name: /Record Payment/ }).first()).toBeVisible();
    await expect(missingRows(page)).toHaveCount(before - 1);
  });

  test('U42 a 5xx on saving a payment shows the error ID, with a control that copies it', async ({ page, context }) => {
    await asOwner(page);
    if (!API) {
      // The sample data has no server to fail; the unit tests cover the message and the ID
      await page.goto('/payments');
      await expect(page.getByRole('button', { name: /Record Payment/ }).first()).toBeVisible();
      return;
    }
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.route('**/api/v1/payments/*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Try again; if it keeps happening, quote the error ID.', errorId: 'e1e1-u42-test' } }),
          })
        : route.continue(),
    );
    await page.goto('/payments');
    await page.getByTitle('Edit Payment').first().click();
    await page.getByRole('button', { name: /Update Payment/ }).click();

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Something went wrong on our side' });
    await expect(toast).toContainText('e1e1-u42-test');
    await toast.getByRole('button', { name: 'Copy error ID' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('e1e1-u42-test');
  });
});
