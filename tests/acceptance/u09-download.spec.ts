/**
 * U09 — Grid-view "Download File" saves an uploaded file under its convention name (B05).
 * Uploaded files are stored in IndexedDB, so the download must mint an object URL instead of using the storage key.
 */
import { test, expect, type Page } from '@playwright/test';

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  });
}

test.describe('U09 download', () => {
  test('U09 B05 grid Download File saves the uploaded bytes under the convention name', async ({ page }) => {
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
        { originalName: 'download-me.png', originalSizeBytes: bytes.length, sha256: 'u09dl-' + Date.now() },
      );
      return doc.displayName as string;
    }, PNG_1X1);

    await page.goto('/documents?view=grid');
    const tile = page.getByText(displayName).first().locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await expect(tile).toHaveCount(1);
    await tile.getByRole('button').last().click();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      page.getByRole('button', { name: 'Download File' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(displayName);
    const failure = await download.failure();
    expect(failure).toBeNull();
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const saved = Buffer.concat(chunks);
    expect(saved.equals(Buffer.from(PNG_1X1, 'base64'))).toBe(true);
  });
});
