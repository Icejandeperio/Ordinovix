/**
 * U43 — Edit Payment shows every stored field, and a proof id whose file is gone is shown as "Proof file missing" with a way to
 * remove it, after which the payment saves. The orphan can only be made in the mock's store (the API refuses to save one), so
 * that test runs in mock mode.
 */
import { test, expect, type Page } from '@playwright/test';

// A valid 1x1 PNG, so the browser can decode it
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const API = process.env.VITE_DATA_SOURCE === 'api';

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

test.describe('U43 Edit Payment', () => {
  test('U43 Edit Payment prefills every field from the stored payment', async ({ page }) => {
    await asOwner(page);
    await page.goto('/payments');
    await page.getByRole('button', { name: /Record Payment/ }).first().click();

    const dialog = page.getByRole('dialog');
    const selects = dialog.locator('select');
    await selects.nth(0).selectOption({ index: 1 });
    await expect(selects.nth(1).locator('option')).not.toHaveCount(1);
    await selects.nth(1).selectOption({ index: 1 });
    await dialog.getByLabel('Amount Paid (PHP)').fill('1234.56');
    await selects.nth(2).selectOption('online');
    await dialog.getByPlaceholder('e.g. Land Bank, GCash...').fill('GCash U43');
    const ref = `U43-${Date.now()}`;
    await dialog.getByPlaceholder('e.g. LBP-TXN-2026-998812').fill(ref);
    await dialog.getByRole('button', { name: 'Direct by Client' }).click();
    await dialog.getByPlaceholder('e.g. Deposit slip handed to client messenger...').fill('note for U43');
    const client = await selects.nth(0).inputValue();
    const task = await selects.nth(1).inputValue();
    await dialog.getByRole('button', { name: /Save Payment Record/ }).click();
    await expect(page.getByText('Payment recorded successfully').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('tbody tr').filter({ hasText: ref }).getByTitle('Edit Payment').click();
    const edit = page.getByRole('dialog');
    await expect(edit.locator('select').nth(0)).toHaveValue(client);
    await expect(edit.locator('select').nth(1)).toHaveValue(task);
    await expect(edit.getByLabel('Amount Paid (PHP)')).toHaveValue(/1,?234\.56/);
    await expect(edit.locator('select').nth(2)).toHaveValue('online');
    await expect(edit.getByPlaceholder('e.g. Land Bank, GCash...')).toHaveValue('GCash U43');
    await expect(edit.getByPlaceholder('e.g. LBP-TXN-2026-998812')).toHaveValue(ref);
    await expect(edit.getByRole('button', { name: 'Direct by Client' })).toHaveClass(/bg-stamp/);
    await expect(edit.getByPlaceholder('e.g. Deposit slip handed to client messenger...')).toHaveValue('note for U43');
  });

  test('U43 a proof whose file is missing shows "Proof file missing", can be removed inline, and the payment then saves', async ({ page }) => {
    await asOwner(page);
    if (API) {
      // The API refuses to save a payment with a proof id that is not a file (U42), so no such payment can exist there
      await page.goto('/payments');
      await expect(page.getByRole('button', { name: /Record Payment/ }).first()).toBeVisible();
      return;
    }
    await page.goto('/payments');
    await expect(page.getByRole('button', { name: /Record Payment/ }).first()).toBeVisible();
    const ref = await page.evaluate(() => {
      const raw = localStorage.getItem('ox-mock-data-v2');
      if (!raw) throw new Error('store not seeded');
      const data = JSON.parse(raw);
      const p = data.payments.find((x: { referenceNo?: string; deletedAt?: string }) => x.referenceNo && !x.deletedAt);
      p.proofDocumentIds = ['doc-gone-u43'];
      localStorage.setItem('ox-mock-data-v2', JSON.stringify(data));
      return p.referenceNo as string;
    });
    await page.reload();
    await page.locator('tbody tr').filter({ hasText: ref }).getByTitle('Edit Payment').click();
    const edit = page.getByRole('dialog');
    await expect(edit.getByText('Proof file missing')).toBeVisible();
    await edit.getByRole('button', { name: 'Remove missing proof' }).click();
    await expect(edit.getByText('Proof file missing')).toHaveCount(0);
    await edit.getByRole('button', { name: /Update Payment/ }).click();
    await expect(page.getByText('Payment updated').first()).toBeVisible({ timeout: 15_000 });
  });

  test('U43 removing a file that is the proof of a payment is refused, and the screen says which payment', async ({ page }) => {
    await asOwner(page);
    await page.goto('/payments');
    await page.getByTitle('Edit Payment').first().click();
    const edit = page.getByRole('dialog');
    await edit.getByRole('button', { name: /Upload Proof/ }).click();
    await page.locator('input[type="file"]:not([capture])').last().setInputFiles({ name: 'slip-u43.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1X1, 'base64') });
    await expect(page.getByText('Payment receipt attached').first()).toBeVisible({ timeout: 15_000 });
    await edit.getByRole('button', { name: /Update Payment/ }).click();
    await expect(page.getByText('Payment updated').first()).toBeVisible({ timeout: 15_000 });

    await page.goto('/documents');
    page.on('dialog', (d) => void d.accept('wrong file'));
    const removes = page.getByTitle('Remove file');
    await expect(removes.first()).toBeVisible();
    // Every proof file belongs to a payment in the sample data, so removing one of them is refused; try rows until the message shows
    const refused = page.locator('[data-sonner-toast]').filter({ hasText: 'is the proof of the payment of' });
    for (let i = 0; i < Math.min(await removes.count(), 40) && !(await refused.count()); i++) {
      await removes.nth(i).click();
      await page.waitForTimeout(150);
    }
    await expect(refused.first()).toBeVisible();
    await expect(refused.first()).toContainText('Remove it from that payment first');
  });
});
