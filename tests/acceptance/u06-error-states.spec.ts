/**
 * U06 — One QueryState for every data page (B13): loading, error with Retry (403 and 404 variants), and a real
 * error page for crashes (B14). B03 and B10 also have regression tests in regressions.spec.ts.
 */
import { test, expect, type Page } from '@playwright/test';

async function as(page: Page, persona: 'owner' | 'helper', failureRate = '0') {
  await page.addInitScript(
    ([p, rate]) => {
      try { localStorage.setItem('ox-mock-persona', p); localStorage.setItem('ox-mock-failure-rate', rate); } catch { /* storage unavailable */ }
    },
    [persona, failureRate],
  );
}

const DATA_PAGES = [
  '/calendar',
  '/clients',
  '/clients/client-rsp',
  '/documents',
  '/follow-ups/run',
  '/insights',
  '/notifications',
  '/offices',
  '/payments',
  '/settings',
  '/tasks',
  '/visits',
  '/visits/visit-today',
  '/visits/visit-today/print',
  '/visits/visit-today/record',
  '/visits/visit-today/summary',
];

test.describe('U06 error states', () => {
  for (const path of DATA_PAGES) {
    test(`U06 B13 ${path} shows an error with Retry when every request fails`, async ({ page }) => {
      await as(page, 'owner', '1');
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('alert')).toContainText(/something went wrong|offline/i);
    });
  }

  test('U06 B13 search shows an error with Retry when the search request fails', async ({ page }) => {
    await as(page, 'owner', '1');
    await page.goto('/search?q=rsp');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible({ timeout: 15_000 });
  });

  test('U06 B13 navigation keeps working while a page is in its error state', async ({ page }) => {
    await as(page, 'owner', '1');
    await page.goto('/tasks');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: 'Offices', exact: true }).first().click();
    await expect(page).toHaveURL(/\/offices$/);
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible({ timeout: 15_000 });
  });

  test('U06 B13 Retry loads the page once requests succeed again', async ({ page }) => {
    await as(page, 'owner', '1');
    await page.goto('/offices');
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => { localStorage.setItem('ox-mock-failure-rate', '0'); });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
    await expect(page.locator('main')).toContainText(/offices/i);
  });

  test('U06 B03 unknown visit shows the 404 message with a way home and no Retry', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/visits/does-not-exist');
    await expect(page.getByRole('alert')).toContainText(/doesn.t exist/i, { timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Go to Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  });

  test('U06 B10 helper opening an unassigned client sees the 403 copy', async ({ page }) => {
    await as(page, 'helper');
    await page.goto('/clients/client-maria');
    await expect(page.getByRole('alert')).toContainText(/don.t have access to this client\. Ask the owner to assign it to you/i, { timeout: 10_000 });
  });

  test('U06 B14 a render crash shows the error page with an error ID, not the 404 page', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    // Corrupt one field so the visit page throws while rendering ("Objects are not valid as a React child")
    await page.evaluate(async () => {
      const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
      const mod = await load('/src/data/index.ts');
      await mod.repositories.visits.update('visit-today', { officeName: { broken: true } });
    });
    await page.goto('/visits/visit-today');
    await expect(page.getByRole('alert')).toContainText('This page stopped working. Your saved changes are safe.');
    await expect(page.getByRole('alert')).toContainText(/Error ID ERR-[A-Z0-9]+/);
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/page not found/i);
  });
});
