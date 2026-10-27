/**
 * U14 — Small correctness fixes batch: visit cost fields start empty (B15) and the task header shows a
 * readable period label (B28). B22, B23, B25 and B29 are covered by Vitest.
 */
import { test, expect, type Page } from '@playwright/test';

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  });
}

test.describe('U14 small fixes', () => {
  test('U14 B15 the finish-trip cost fields start empty', async ({ page }) => {
    await asOwner(page);
    await page.goto('/tasks/task-rsp-0619e');
    await page.getByRole('button', { name: 'Stamp Accept' }).first().click();
    await expect(page.locator('main')).toContainText(/in preparation/i);
    await page.goto('/visits/visit-today');
    await page.getByRole('button', { name: /start trip/i }).first().click();
    await expect(page.locator('main')).toContainText(/what happened at the counter/i);

    await page.getByText('Completed', { exact: true }).first().click();
    await page.getByPlaceholder(/follow up on certified copy/i).fill('Attach evidence document');
    await page.getByRole('button', { name: 'Save Item Outcome' }).click();
    const finish = page.locator('main button').filter({ hasText: /finish visit/i }).first();
    await expect(finish).toBeEnabled();
    await finish.click();

    await expect(page.getByText('Finish Office Trip')).toBeVisible();
    const costs = page.locator('input[type="number"]');
    await expect(costs).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(costs.nth(i)).toHaveValue('');
  });

  test('U14 B28 the task header shows the period as Sep 2026, not 2026-09', async ({ page }) => {
    await asOwner(page);
    await page.goto('/tasks/task-rsp-0619e');
    await expect(page.getByText('Period: Sep 2026')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Period: 2026-09');
  });
});
