/**
 * U08 — Every write is validated at the repository boundary (B16). The unit tests cover every method; these two
 * show what the operator sees: a clear message, and nothing saved.
 */
import { test, expect, type Page } from '@playwright/test';

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  });
}

test.describe('U08 validation at the repository boundary', () => {
  test('U08 B16 removing a document with a too-short reason shows the message and keeps the document', async ({ page }) => {
    await asOwner(page);
    await page.goto('/documents');
    const removeButtons = page.getByTitle('Remove file');
    await expect(removeButtons.first()).toBeVisible();
    const before = await removeButtons.count();

    page.once('dialog', (dialog) => dialog.accept('short'));
    await removeButtons.first().click();

    await expect(page.getByText('Reason must be at least 10 characters')).toBeVisible();
    await expect(removeButtons).toHaveCount(before);
  });

  test('U08 B16 removing a document with a proper reason still works', async ({ page }) => {
    await asOwner(page);
    await page.goto('/documents');
    const removeButtons = page.getByTitle('Remove file');
    await expect(removeButtons.first()).toBeVisible();
    const before = await removeButtons.count();

    page.once('dialog', (dialog) => dialog.accept('Duplicate scan of the same return'));
    await removeButtons.first().click();

    await expect(removeButtons).toHaveCount(before - 1);
  });
});
