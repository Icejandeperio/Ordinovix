/**
 * U30 — the screens behave the same whichever data source is running (mock, or the Worker with VITE_DATA_SOURCE=api).
 * These tests reach the data layer through `/src/data/index.ts`, which is whichever source the app is using, so they pass in
 * both modes. (The U21 tests import the mock store directly and can only run in mock mode.)
 */
import { test, expect, type Page } from '@playwright/test';

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  });
}

/** Runs `fn` in the page with the app's repositories (the data source in use). */
async function inApp<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<Record<string, unknown>>;
    const mod = await load('/src/data/index.ts');
    return new Function('m', `return (${body})(m)`)(mod);
  }, fn) as Promise<T>;
}

const CONFLICT = /changed by someone else/i;

test.describe('U30 data source', () => {
  test('U30 a stale save of the practice settings shows the message and the other change, then the second try goes through', async ({ page }) => {
    await asOwner(page);
    await page.goto('/settings/practice');
    const name = page.getByLabel('Practice Firm Name');
    await expect(name).toHaveValue(/.+/);

    // Another device saves first: a save that names no version, as a second device's would look to the first
    await inApp(page, `async (m) => { await m.repositories.settings.save({ practiceName: 'Changed on another device' }); }`);

    await name.fill('My edit');
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await expect(page.getByText(CONFLICT).first()).toBeVisible();
    await expect(page.getByText('Settings saved')).toHaveCount(0);
    await expect(name).toHaveValue('Changed on another device');

    await name.fill('My edit, second try');
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Practice Firm Name')).toHaveValue('My edit, second try');
  });

  test('U30 a helper is refused an unassigned client with the access copy, whichever data source answers', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('ox-mock-persona', 'helper'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
    });
    await page.goto('/clients/client-maria');
    await expect(page.getByRole('alert')).toContainText(/don.t have access to this client\. Ask the owner to assign it to you/i, { timeout: 10_000 });
  });

  test('U30 an uploaded file opens after a reload through the data source (an object URL, or a signed URL)', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const url = await page.evaluate(async (b64) => {
      const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
      const mod = await load('/src/data/index.ts');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const doc = await mod.repositories.documents.upload(
        { clientId: 'client-rsp', taskId: 'task-rsp-0619e', kind: 'other', source: 'upload' },
        new Blob([bytes], { type: 'image/png' }),
        undefined,
        { originalName: 'u30.png', originalSizeBytes: bytes.length, sha256: 'u30-' + Date.now() },
      );
      return (await mod.repositories.documents.getUrl(doc.id, 'view')) as string;
    }, PNG_1X1);
    const bytes = await page.evaluate(async (u) => Array.from(new Uint8Array(await (await fetch(u)).arrayBuffer())), url);
    expect(Buffer.from(bytes).toString('base64')).toBe(PNG_1X1);
  });
});
