/**
 * U37 — offline and install details (spec 19.3, 19.5), in both data sources: a failed offline write holds the later ones until Retry
 * or Discard, actions that need a connection are disabled offline with a hint, sign-out warns about waiting changes and then clears
 * them, and the Install app button or the iPhone card shows until the app is installed.
 */
import { test, expect, type Page } from '@playwright/test';

async function inApp<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<Record<string, unknown>>;
    const mod = await load('/src/data/index.ts');
    return new Function('m', `return (${body})(m)`)(mod);
  }, fn) as Promise<T>;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ox-mock-persona', 'owner');
      localStorage.setItem('ox-mock-failure-rate', '0');
    } catch {
      /* storage unavailable */
    }
  });
});

const open = async (page: Page, path = '/') => {
  await page.goto(path);
  await expect(page.locator('#main-content')).toBeVisible();
};

const setOffline = (page: Page, offline: boolean) => inApp(page, `async (m) => { m.devControls.setOffline(${offline}); }`);

test.describe('U37 offline queue', () => {
  test('U37 a rejected write holds the later one until it is discarded; Retry and Discard are on the failed item', async ({ page }) => {
    await open(page);
    await setOffline(page, true);
    // Two writes made offline: the first names a line that does not exist, the second is a note
    await inApp(
      page,
      `async (m) => {
        await m.repositories.lines.setStatus('line-does-not-exist', 'received');
        await m.repositories.notes.save({ entity: 'client', entityId: 'client-rsp', body: 'U37 held note', pinned: false });
      }`,
    );
    await setOffline(page, false);

    await page.getByRole('button', { name: /need.* attention/ }).click();
    const waiting = page.getByRole('dialog', { name: 'Waiting changes' });
    const items = waiting.getByRole('listitem');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Failed');
    await expect(items.nth(0).getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(items.nth(0).getByRole('button', { name: 'Discard' })).toBeVisible();
    await expect(items.nth(1)).toContainText('Waiting for connection'); // held, not sent

    // Retry sends the same call again; it is rejected again and still holds the note
    await items.nth(0).getByRole('button', { name: 'Retry' }).click();
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Failed');
    await expect(items.nth(1)).toContainText('Waiting for connection');

    // Discard lets the note through
    await items.nth(0).getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();
    const notes = await inApp<string[]>(page, `async (m) => (await m.repositories.notes.list('client', 'client-rsp')).map((n) => n.body)`);
    expect(notes).toContain('U37 held note');
  });

  test('U37 New Client and Open Filing Period are disabled offline, with a hint, and work again online', async ({ page }) => {
    await open(page, '/clients');
    const newClient = page.getByRole('button', { name: 'New Client' });
    await expect(newClient).toBeEnabled();
    await setOffline(page, true);
    await expect(newClient).toBeDisabled();
    await expect(page.getByText('Needs a connection')).toBeVisible();
    await setOffline(page, false);
    await expect(newClient).toBeEnabled();

    await open(page, '/tasks');
    await setOffline(page, true);
    await expect(page.getByRole('button', { name: 'Open Filing Period' })).toBeDisabled();
    await expect(page.getByText('Needs a connection')).toBeVisible();
  });

  test('U37 sign-out warns when changes are waiting, keeps them if cancelled, and clears them when confirmed', async ({ page }) => {
    await open(page);
    // Two changes waiting while the device is online: one the server rejects, and the note held behind it
    await setOffline(page, true);
    await inApp(
      page,
      `async (m) => {
        await m.repositories.lines.setStatus('line-does-not-exist', 'received');
        await m.repositories.notes.save({ entity: 'client', entityId: 'client-rsp', body: 'U37 waiting note', pinned: false });
      }`,
    );
    await setOffline(page, false);
    const waitingCount = () => inApp<number>(page, `async (m) => m.offlineQueue.getSnapshot().items.length`);
    await expect.poll(waitingCount).toBe(2);

    const signOut = page.locator('button[aria-label="Sign out"]:visible').first();
    const messages: string[] = [];
    page.once('dialog', (d) => {
      messages.push(d.message());
      void d.dismiss();
    });
    await signOut.click();
    await expect.poll(() => messages.length).toBe(1);
    expect(messages[0]).toMatch(/2 changes have not been saved yet/);
    await expect(page).not.toHaveURL(/sign-in/);
    expect(await waitingCount()).toBe(2);

    page.once('dialog', (d) => {
      void d.accept();
    });
    await signOut.click();
    await expect(page).toHaveURL(/sign-in/);
    expect(await waitingCount()).toBe(0);
  });

  test('U37 sign-out with nothing waiting asks nothing', async ({ page }) => {
    await open(page);
    let asked = false;
    page.on('dialog', (d) => {
      asked = true;
      void d.dismiss();
    });
    await page.locator('button[aria-label="Sign out"]:visible').first().click();
    await expect(page).toHaveURL(/sign-in/);
    expect(asked).toBe(false);
  });
});

test.describe('U37 install app', () => {
  test("U37 the browser's offer shows an Install app button that uses it once", async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
    await page.evaluate(() => {
      const w = window as unknown as { __prompted?: number };
      const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => {
          w.__prompted = (w.__prompted ?? 0) + 1;
        },
      });
      window.dispatchEvent(offer);
    });
    const button = page.getByRole('button', { name: 'Install app' });
    await expect(button).toBeVisible();
    await button.click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: number }).__prompted)).toBe(1);
    await expect(button).toHaveCount(0);
  });

  test('U37 an installed app shows no Install app button', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    await open(page);
    await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => undefined })));
    await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0);
  });

  test('U37 an iPhone gets the Share, Add to Home Screen card, and not once installed', async ({ browser }) => {
    const iphone = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
    };
    const persona = () => {
      try {
        localStorage.setItem('ox-mock-persona', 'owner');
      } catch {
        /* storage unavailable */
      }
    };

    const context = await browser.newContext(iphone);
    const page = await context.newPage();
    await page.addInitScript(persona);
    await open(page);
    await page.getByRole('button', { name: 'Install app' }).click();
    const card = page.getByRole('dialog', { name: /Install Ordinovix on your iPhone/ });
    await expect(card).toContainText('Share');
    await expect(card).toContainText('Add to Home Screen');
    await context.close();

    const installed = await browser.newContext(iphone);
    const page2 = await installed.newPage();
    await page2.addInitScript(persona);
    await page2.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    await open(page2);
    await expect(page2.getByRole('button', { name: 'Install app' })).toHaveCount(0);
    await installed.close();
  });
});
