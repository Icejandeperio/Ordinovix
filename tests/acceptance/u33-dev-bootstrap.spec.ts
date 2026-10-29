/**
 * U33 — a failed dev sign-in (VITE_DATA_SOURCE=api on a local Worker) is reported, in the console and in a visible dev-only notice,
 * instead of leaving a signed-out app that looks empty. Mock mode has no dev sign-in, so there it must show nothing.
 */
import { test, expect } from '@playwright/test';

const API = process.env.VITE_DATA_SOURCE === 'api';

test.describe('U33 dev bootstrap', () => {
  test('U33 a failed dev sign-in shows a notice and a console error; mock mode shows none', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
    });
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    if (API) {
      await page.route('**/api/v1/dev/sign-in', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }) }));
    }
    await page.goto('/');

    if (!API) {
      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.locator('#dev-bootstrap-notice')).toHaveCount(0);
      return;
    }
    // Signed out (no session), so the app goes to sign-in; the notice says why the dev sign-in did not happen
    await expect(page.locator('#dev-bootstrap-notice')).toContainText(/dev sign-in failed/i);
    await expect(page.locator('#dev-bootstrap-notice')).toHaveAttribute('role', 'alert');
    expect(errors.some((e) => e.includes('[dev bootstrap]'))).toBe(true);
  });
});
