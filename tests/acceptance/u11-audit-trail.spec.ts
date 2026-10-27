/**
 * U11 — The Audit Log shows real activity (B08): it renders activity.list() with the spec 11.18 filters and
 * built-in views, and the CSV export carries the same rows.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// The exported CSV starts with a byte order mark so Excel reads it as UTF-8
const BOM = String.fromCharCode(0xfeff);

async function as(page: Page, persona: 'owner' | 'helper') {
  await page.addInitScript((p) => {
    try { localStorage.setItem('ox-mock-persona', p); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  }, persona);
}

async function revealHorizonTin(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<{ repositories: { clients: { revealTin: (id: string) => Promise<string> } } }>;
    const mod = await load('/src/data/index.ts');
    await mod.repositories.clients.revealTin('client-horizon');
  });
}

const rows = (page: Page) => page.locator('tbody tr');
/** Cell text as written in the page (innerText would return the badge in its CSS upper case). */
const column = (page: Page, n: number) => page.locator(`tbody tr td:nth-child(${n})`).allTextContents();
const distinct = (values: string[]) => [...new Set(values.map((v) => v.trim()))];

test.describe('U11 audit log', () => {
  test('U11 B08 the hard-coded sample events are gone and real activity is listed newest first', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/audit');
    await expect(rows(page).first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Desktop Chrome 130');
    await expect(page.locator('main')).not.toContainText('123-456-789-000');
    const stamps = await column(page, 1);
    expect(stamps.length).toBeGreaterThan(20);
    expect([...stamps].sort().reverse()).toEqual(stamps);
  });

  test('U11 B08 a TIN reveal appears in the log and the Sensitive view, but not in Overrides', async ({ page }) => {
    await as(page, 'owner');
    await revealHorizonTin(page);
    await page.goto('/audit');
    await expect(page.locator('tbody').getByText('TIN Revealed')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('Horizon');
    await expect(page.locator('main')).not.toContainText('123-456-789'); // the revealed value itself is never logged

    await page.getByRole('button', { name: /Sensitive Events/ }).click();
    await expect(page.locator('tbody').getByText('TIN Revealed')).toHaveCount(1);
    await expect.poll(async () => (await column(page, 4)).every((a) => /TIN Revealed|File Downloaded|Access/.test(a))).toBe(true);

    await page.getByRole('button', { name: /Manual Overrides/ }).click();
    await expect(page.locator('tbody').getByText('TIN Revealed')).toHaveCount(0);
  });

  test('U11 B08 filtering by actor and by action narrows the table', async ({ page }) => {
    await as(page, 'owner');
    await revealHorizonTin(page);
    await page.goto('/audit');
    await expect(rows(page).first()).toBeVisible();

    await page.getByLabel('Actor').selectOption({ label: 'Ben Morales' });
    await expect.poll(async () => distinct(await column(page, 2))).toEqual(['Ben Morales']);

    await page.getByLabel('Actor').selectOption({ label: 'Everyone' });
    await page.getByLabel('Action').selectOption({ label: 'TIN Revealed' });
    await expect.poll(async () => distinct(await column(page, 4))).toEqual(['TIN Revealed']);
  });

  test('U11 B08 a filter with no matches says so', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/audit');
    await expect(rows(page).first()).toBeVisible();
    await page.getByLabel('Action').selectOption({ label: 'Signed In' });
    await expect(page.getByText('No activity matches these filters.')).toBeVisible();
  });

  test('U11 B08 the CSV export carries the same rows as the table', async ({ page }) => {
    await as(page, 'owner');
    await revealHorizonTin(page);
    await page.goto('/audit');
    await page.getByLabel('Action').selectOption({ label: 'TIN Revealed' });
    await expect(rows(page)).toHaveCount(1);

    await page.getByRole('button', { name: /Export Audit Log/ }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      page.getByText('CSV Spreadsheet').click(),
    ]);
    const path = await download.path();
    const raw = await readFile(path, 'utf8');
    const csv = raw.startsWith(BOM) ? raw.slice(1) : raw;
    const lines = csv.split(/\r?\n/).filter(Boolean);
    expect(lines[0]).toContain('Timestamp (PHT)');
    expect(lines).toHaveLength(2); // header + the one filtered row
    expect(lines[1]).toContain('TIN Revealed');
    expect(lines[1]).toContain('Horizon');
  });

  test('U11 B08 a helper still gets Access Denied', async ({ page }) => {
    await as(page, 'helper');
    await page.goto('/audit');
    await expect(page.getByText('Access Denied')).toBeVisible();
  });
});
