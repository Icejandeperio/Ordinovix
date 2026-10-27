/**
 * U01 — Finish Visit counts saved outcomes only (B02).
 * Complements the B02 regression test: this one proves Finish becomes available once the outcome is SAVED.
 */
import { test, expect } from '@playwright/test';

test.describe('U01 Finish visit guard', () => {
  test('U01 B02 Finish visit enables only after the outcome is saved', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
    });
    await page.goto('/tasks/task-rsp-0619e');
    await page.getByRole('button', { name: 'Stamp Accept' }).first().click();
    await expect(page.locator('main')).toContainText(/in preparation/i);
    await page.goto('/visits/visit-today');
    await page.getByRole('button', { name: /start trip/i }).first().click();
    await expect(page.locator('main')).toContainText(/what happened at the counter/i);

    const finish = page.locator('main button').filter({ hasText: /finish visit/i }).first();
    await page.getByText('Completed', { exact: true }).first().click(); // selected, NOT saved
    await expect(finish).toBeDisabled();
    await expect(finish).toContainText('0/1');

    await page.getByPlaceholder(/follow up on certified copy/i).fill('Attach evidence document');
    await page.getByRole('button', { name: 'Save Item Outcome' }).click();

    await expect(finish).toBeEnabled();
    await expect(finish).toContainText('1/1');
  });
});
