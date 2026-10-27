/**
 * U09 — Uploaded files persist across reloads (B05) and follow the naming convention (B24).
 * The repository contract test for B05 lives in regressions.spec.ts; this one checks what the operator sees.
 */
import { test, expect, type Page } from '@playwright/test';

// A valid 1x1 PNG, so the browser can actually decode it
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  });
}

test.describe('U09 uploads', () => {
  test('U09 B05 an uploaded image still renders on the Documents page after a reload, under its convention name', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    const displayName = await page.evaluate(async (b64) => {
      const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
      const mod = await load('/src/data/index.ts');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const doc = await mod.repositories.documents.upload(
        { clientId: 'client-rsp', taskId: 'task-rsp-0619e', kind: 'stamped_copy', source: 'upload' },
        new Blob([bytes], { type: 'image/png' }),
        undefined,
        { originalName: 'counter-photo.png', originalSizeBytes: bytes.length, sha256: 'u09-' + Date.now() },
      );
      return doc.displayName as string;
    }, PNG_1X1);

    expect(displayName).toBe('RSP_0619E_2026-09_stamped_v1.png');

    await page.goto('/documents');
    await page.reload();
    const image = page.locator(`img[alt="${displayName}"]`).first();
    await expect(image).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('main')).toContainText(displayName);
  });
});
