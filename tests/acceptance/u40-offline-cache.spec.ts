/**
 * U40 — the persisted query cache (spec 19.3 "Offline data"), in both data sources: a reload without a connection shows the last
 * opened Clients list; the saved copy belongs to one person; signing out, even offline with the server unreachable, leaves nothing
 * to restore after signing in again; and a TIN or a signed document link is never written to the device.
 */
import { test, expect, type Page } from '@playwright/test';

async function inCache<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<Record<string, unknown>>;
    const [cache, data] = await Promise.all([load('/src/data/query-cache.ts'), load('/src/data/index.ts')]);
    return new Function('c', 'd', `return (${body})(c, d)`)(cache, data);
  }, fn) as Promise<T>;
}

const setOffline = (page: Page, offline: boolean) => inCache(page, `async (c, d) => { d.devControls.setOffline(${offline}); }`);
const savedKeys = (page: Page) => inCache<string[]>(page, `async (c) => c.savedCacheKeys()`);

async function as(page: Page, persona: 'owner' | 'helper') {
  await page.addInitScript((p) => {
    try {
      // only the first page of the test sets the persona: a reload keeps whatever the test or the sign-in page chose since
      if (!sessionStorage.getItem('u40-init')) {
        localStorage.setItem('ox-mock-persona', p);
        localStorage.setItem('ox-mock-failure-rate', '0');
        sessionStorage.setItem('u40-init', '1');
      }
    } catch {
      /* storage unavailable */
    }
  }, persona);
}

/** Opens Clients and waits until the list is on screen and the cache has been written to the device. */
async function openClientsAndWaitForSave(page: Page) {
  await page.goto('/clients');
  await expect(page.getByRole('button', { name: 'New Client' })).toBeVisible();
  await expect(page.getByText('Rivera').first().or(page.getByText('RSP').first())).toBeVisible();
  await expect.poll(() => savedKeys(page), { timeout: 15_000 }).toEqual(expect.arrayContaining([expect.stringMatching(/^cache:/)]));
}

test.describe('U40 persisted query cache', () => {
  test('U40 a reload while offline shows the last opened Clients list from the saved copy', async ({ page }) => {
    await as(page, 'owner');
    await openClientsAndWaitForSave(page);
    const names = await page.locator('main').innerText();

    await setOffline(page, true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'New Client' })).toBeVisible();
    await expect(page.getByText(/Something went wrong|Could not load/i)).toHaveCount(0);
    expect(await page.locator('main').innerText()).toContain((names.match(/RSP|Rivera/) ?? ['RSP'])[0]);
  });

  test('U40 the saved copy is the signed-in person\'s: another account on the same device restores nothing', async ({ page }) => {
    await as(page, 'owner');
    await openClientsAndWaitForSave(page);
    const ownerKey = (await savedKeys(page)).find((k) => k.startsWith('cache:'))!;

    // The helper signs in on the same device without the owner having signed out (a session that simply ended)
    await page.evaluate(() => localStorage.setItem('ox-mock-persona', 'helper'));
    await page.reload();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect.poll(() => savedKeys(page), { timeout: 15_000 }).not.toContain(ownerKey);
    const dump = await inCache<string>(page, `async (c) => c.savedCacheDump()`);
    expect(dump).not.toContain(ownerKey.split(':')[1]); // nothing of the owner's copy remains
  });

  test('U40 signing out while offline clears the saved copy and the queue, and signing in again restores nothing', async ({ page }) => {
    await as(page, 'owner');
    await openClientsAndWaitForSave(page);
    await setOffline(page, true);
    await inCache(page, `async (c, d) => { await d.repositories.notes.save({ entity: 'client', entityId: 'client-rsp', body: 'U40 waiting offline', pinned: false }); }`);
    expect(await inCache<number>(page, `async (c, d) => d.offlineQueue.getSnapshot().items.length`)).toBe(1);

    page.once('dialog', (d) => void d.accept()); // the warning about the waiting change
    await page.locator('button[aria-label="Sign out"]:visible').first().click();
    await expect(page).toHaveURL(/sign-in/);
    expect(await savedKeys(page)).toEqual([]);
    expect(await inCache<number>(page, `async (c, d) => d.offlineQueue.getSnapshot().items.length`)).toBe(0);

    // Sign in again as the same person, still offline: the saved copy is gone, so a start-up restore brings back nothing
    await page.evaluate(() => localStorage.setItem('ox-mock-persona', 'owner'));
    await page.goto('/clients');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByText('RSP')).toHaveCount(0);
    expect(await inCache<string>(page, `async (c) => c.savedCacheDump()`)).not.toContain('RSP');
    expect(await inCache<string>(page, `async (c) => c.savedCacheDump()`)).not.toContain('U40 waiting offline');
  });

  test('U40 a TIN or a signed document link is never written to the device', async ({ page }) => {
    await as(page, 'owner');
    await openClientsAndWaitForSave(page);
    await page.goto('/clients/client-rsp');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect.poll(() => savedKeys(page), { timeout: 15_000 }).toEqual(expect.arrayContaining([expect.stringMatching(/^cache:/)]));
    const dump = await inCache<string>(page, `async (c) => c.savedCacheDump()`);
    expect(dump).not.toContain('tinFull');
    expect(dump).not.toMatch(/X-Amz|signedUrl|downloadUrl|blob:/);
    expect(dump).not.toMatch(/\d{3}-\d{3}-\d{3}-\d{5}/); // a full TIN
  });
});
