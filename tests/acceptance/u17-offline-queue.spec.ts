/**
 * U17 — Installable app and offline write queue (B17): writes made offline wait in IndexedDB with idempotency keys,
 * replay in order on reconnect, show in the sync indicator, and are never applied twice.
 */
import { test, expect, type Page } from '@playwright/test';

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ox-mock-persona', 'owner');
      localStorage.setItem('ox-mock-failure-rate', '0');
    } catch { /* storage unavailable */ }
  });
}

/** Runs `fn` in the page with the app's repositories, offline queue and dev controls. */
async function inApp<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<Record<string, unknown>>;
    const mod = await load('/src/data/index.ts');
    return new Function('m', `return (${body})(m)`)(mod);
  }, fn) as Promise<T>;
}

const indicator = (page: Page) => page.getByRole('button', { name: /All changes saved|Offline|waiting|attention|Saving/ }).first();

const TASK = 'task-rsp-0619e';

async function receivedLineId(page: Page): Promise<string> {
  return inApp<string>(page, `async (m) => (await m.repositories.tasks.get('${TASK}')).lines.find((l) => l.status === 'received').id`);
}

const notesOn = (page: Page) =>
  inApp<Array<{ id: string; body: string }>>(page, `async (m) => (await m.repositories.notes.list('task', '${TASK}')).map((n) => ({ id: n.id, body: n.body }))`);

test.describe('U17 offline queue', () => {
  test('U17 B17 offline, a note and a line review are queued, counted by the sync indicator, and survive a reload', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    await expect(indicator(page)).toContainText('All changes saved');
    const lineId = await receivedLineId(page);

    await inApp(page, 'async (m) => m.devControls.setOffline(true)');
    await expect(indicator(page)).toContainText('Offline');
    await inApp(page, `async (m) => { await m.repositories.notes.save({ entity: 'task', entityId: '${TASK}', body: 'Offline note one' }); await m.repositories.lines.setStatus('${lineId}', 'accepted'); }`);
    await expect(indicator(page)).toContainText('Offline — 2 changes waiting');

    await page.reload();
    await expect(indicator(page)).toContainText('Offline — 2 changes waiting');
  });

  test('U17 B17 on reconnect the queue replays in order and nothing is saved twice', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    const lineId = await receivedLineId(page);
    const before = (await notesOn(page)).length;

    await inApp(page, 'async (m) => m.devControls.setOffline(true)');
    await inApp(
      page,
      `async (m) => {
        await m.repositories.notes.save({ entity: 'task', entityId: '${TASK}', body: 'First offline note' });
        await m.repositories.notes.save({ entity: 'task', entityId: '${TASK}', body: 'Second offline note' });
        await m.repositories.lines.setStatus('${lineId}', 'accepted');
      }`,
    );
    await expect(indicator(page)).toContainText('Offline — 3 changes waiting');

    await inApp(page, 'async (m) => m.devControls.setOffline(false)');
    await expect(indicator(page)).toContainText('All changes saved', { timeout: 15_000 });
    // Ask for a second replay while the first may still be running, and again after it finished
    await inApp(page, 'async (m) => { await Promise.all([m.offlineQueue.replay(), m.offlineQueue.replay()]); await m.offlineQueue.replay(); }');

    const notes = await notesOn(page);
    expect(notes).toHaveLength(before + 2);
    const mine = notes.filter((n) => /offline note/.test(n.body)).sort((a, b) => a.id.localeCompare(b.id));
    expect(mine.map((n) => n.body)).toEqual(['First offline note', 'Second offline note']); // replayed in the order they were made
    const status = await inApp<string>(page, `async (m) => (await m.repositories.tasks.get('${TASK}')).lines.find((l) => l.id === '${lineId}').status`);
    expect(status).toBe('accepted');
    expect(await inApp<number>(page, 'async (m) => (await m.offlineQueue.list()).length')).toBe(0);
  });

  test('U17 B17 a change the server rejects stays in the queue with Retry and Discard', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    await inApp(page, 'async (m) => m.devControls.setOffline(true)');
    await inApp(page, "async (m) => { await m.repositories.lines.setStatus('no-such-line', 'accepted'); }");
    await expect(indicator(page)).toContainText('Offline — 1 change waiting');

    await inApp(page, 'async (m) => m.devControls.setOffline(false)');
    await expect(indicator(page)).toContainText('1 change needs attention', { timeout: 15_000 });
    await indicator(page).click();
    const panel = page.getByRole('dialog', { name: 'Waiting changes' });
    await expect(panel).toContainText('Checklist line status');
    await expect(panel).toContainText('Failed');
    await expect(panel.getByRole('button', { name: 'Retry' })).toBeVisible();
    await panel.getByRole('button', { name: 'Discard' }).click();
    await expect(indicator(page)).toContainText('All changes saved');
  });

  test('U17 B17 a write that needs a connection is refused offline, not queued', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    await inApp(page, 'async (m) => m.devControls.setOffline(true)');
    const message = await inApp<string>(page, "async (m) => { try { await m.repositories.clients.upsert({ displayName: 'Offline Client' }); return 'saved'; } catch (e) { return e.message; } }");
    expect(message).toContain('Network error');
    await expect(indicator(page)).toContainText('Offline');
    await expect(indicator(page)).not.toContainText('waiting');
  });

  test('U17 B17 the app is installable: manifest, PNG icons and apple-touch-icon are served', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon-180.png');
    for (const icon of ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon-180.png']) {
      const res = await page.request.get(icon);
      expect(res.status(), icon).toBe(200);
      expect(res.headers()['content-type'], icon).toContain('image/png');
    }
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();
    expect(manifest.icons.some((i: { purpose?: string; src: string }) => i.purpose === 'maskable' && i.src.endsWith('.png'))).toBe(true);
  });
});
