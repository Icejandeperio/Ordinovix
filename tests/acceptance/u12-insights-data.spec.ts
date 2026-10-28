/**
 * U12 — Insights are computed from the data (B20): no hard-coded series, the filters change the numbers,
 * a helper only sees the assigned clients, and every chart has a table view and a CSV.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const BOM = String.fromCharCode(0xfeff);

async function as(page: Page, persona: 'owner' | 'helper') {
  await page.addInitScript((p) => {
    try {
      localStorage.setItem('ox-mock-persona', p);
      localStorage.setItem('ox-mock-failure-rate', '0');
      localStorage.setItem('ox-mock-today', '2026-10-27');
    } catch { /* storage unavailable */ }
  }, persona);
}

/** The chart card whose heading is `title`. */
const card = (page: Page, title: string): Locator =>
  page.getByRole('heading', { name: title }).locator('xpath=ancestor::div[contains(@class,"rounded-panel")][1]');

async function tableOf(page: Page, title: string): Promise<{ headers: string[]; rows: string[][] }> {
  const c = card(page, title);
  await expect(c).toBeVisible();
  const open = c.getByRole('button', { name: 'View chart data as accessible table' });
  if (await open.count()) await open.click();
  await expect(c.locator('tbody tr').first()).toBeVisible();
  const headers = await c.locator('thead th').allTextContents();
  const rows = await c.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '')));
  return { headers, rows };
}

const sumColumn = (rows: string[][], col: number) => rows.reduce((s, r) => s + Number(r[col].replace(/[^\d.]/g, '')), 0);

test.describe('U12 insights', () => {
  test('U12 B20 the Overview shows computed numbers, not the old hard-coded ones', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/insights');
    await expect(page.getByText('First-Pass Completion', { exact: true }).first()).toBeVisible();
    const main = page.locator('main');
    await expect(main).not.toContainText('up 9 pts vs Sep');
    await expect(main).not.toContainText('climbed from 58% in June');
    await expect(main).not.toContainText('baseline ~55%');
    await expect(main).toContainText(/First-pass completion in [A-Z][a-z]{2}: \d+%/);
    await expect(page.getByText('Not enough data yet.').first()).toBeVisible(); // no check-in saved yet: confidence and hours are empty, not invented
  });

  test('U12 B20 the client filter changes the numbers and lives in the URL', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/insights?tab=trips');
    const all = await tableOf(page, 'Total Office Visits per Month');
    const allTotal = sumColumn(all.rows, 1);
    expect(allTotal).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Client: All Clients/ }).click();
    await page.getByRole('option', { name: /RSP/ }).click();
    await expect(page).toHaveURL(/client=client-rsp/);
    // The filtered numbers arrive after a data round trip; under full-gate load that can exceed the default poll
    // window, so poll longer and less often instead of re-reading the table every few milliseconds.
    await expect.poll(
      async () => sumColumn((await tableOf(page, 'Total Office Visits per Month')).rows, 1),
      { timeout: 20_000, intervals: [500, 1_000, 2_000] },
    ).toBeLessThan(allTotal);
    expect(sumColumn((await tableOf(page, 'Total Office Visits per Month')).rows, 1)).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByRole('button', { name: /RSP/ }).first()).toBeVisible();
    await expect(page).toHaveURL(/client=client-rsp/);
  });

  test('U12 B20 the date range sets the months on the charts', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/insights?tab=trips');
    const sixMonths = await tableOf(page, 'Total Office Visits per Month');
    expect(sixMonths.rows.map((r) => r[0])).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);

    await page.goto('/insights?tab=trips&range=last_quarter');
    const quarter = await tableOf(page, 'Total Office Visits per Month');
    expect(quarter.rows.map((r) => r[0])).toEqual(['Jul', 'Aug', 'Sep']);
    expect(sumColumn(quarter.rows, 1)).toBeLessThan(sumColumn(sixMonths.rows, 1));
  });

  test('U12 B20 the owner filter narrows Workload to one person', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/insights?tab=workload');
    const everyone = await tableOf(page, 'Open Tasks by Assigned Operator');
    expect(everyone.rows.map((r) => r[0])).toEqual(['Ana Santos', 'Ben Morales']);

    await page.goto('/insights?tab=workload&owner=user-ben');
    const ben = await tableOf(page, 'Open Tasks by Assigned Operator');
    expect(ben.rows.map((r) => r[0])).toEqual(['Ben Morales']);
  });

  test('U12 B20 a saved monthly check-in appears in the confidence chart', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    await page.evaluate(async () => {
      const load = new Function('p', 'return import(p)') as (p: string) => Promise<{ repositories: { pulses: { save: (p: { month: string; hoursFindingLastWeek: number; confidence: number }) => Promise<unknown> } } }>;
      const mod = await load('/src/data/index.ts');
      await mod.repositories.pulses.save({ month: '2026-10', hoursFindingLastWeek: 3, confidence: 4 });
    });
    await page.goto('/insights');
    const confidence = await tableOf(page, 'Operator Confidence by Month');
    expect(confidence.rows.at(-1)).toEqual(['Oct', '4']);
  });

  test('U12 B20 every chart has a table view, and its CSV carries the same rows', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/insights');
    await expect(page.getByText('First-Pass Completion', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'View chart data as accessible table' })).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Download chart data as CSV' })).toHaveCount(4);

    const table = await tableOf(page, 'Trips Needing a Return by Month');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      card(page, 'Trips Needing a Return by Month').getByRole('button', { name: 'Download chart data as CSV' }).click(),
    ]);
    const raw = await readFile(await download.path(), 'utf8');
    const csv = raw.startsWith(BOM) ? raw.slice(1) : raw;
    const lines = csv.split(/\r?\n/).filter(Boolean);
    expect(lines[0]).toBe('Month,Avoidable Trips,Not Avoidable Trips');
    expect(lines.slice(1)).toEqual(table.rows.map((r) => r.join(',')));
  });

  test('U12 B20 a helper sees only the assigned clients on every tab', async ({ page, context }) => {
    await as(page, 'helper');
    await page.goto('/insights?tab=clients');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    const codes = (await page.locator('tbody tr td:nth-child(1)').allTextContents()).map((c) => c.trim()).sort();
    expect(codes).toEqual(['CSL', 'RSP']);
    await expect(page.locator('main')).not.toContainText('Horizon');

    await page.goto('/insights?tab=workload');
    const people = await tableOf(page, 'Open Tasks by Assigned Operator');
    const helperTotal = sumColumn(people.rows, 1);

    const ownerPage = await context.newPage();
    await as(ownerPage, 'owner');
    await ownerPage.goto('/insights?tab=workload');
    const ownerPeople = await tableOf(ownerPage, 'Open Tasks by Assigned Operator');
    expect(sumColumn(ownerPeople.rows, 1)).toBeGreaterThan(helperTotal);
  });

  test('U12 B20 the heat calendar counts real due dates', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/insights?tab=deadlines');
    const heading = page.getByRole('heading', { name: /Upcoming Filings Density/ });
    await expect(heading).toBeVisible();
    const cells = page.locator('[title$="due"]');
    await expect(cells.first()).toBeVisible();
    const titles = await cells.evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''));
    expect(titles).toHaveLength(40); // 8 weeks x 5 weekdays
    expect(titles.every((t) => /^\d{4}-\d{2}-\d{2}: \d+ tasks? due$/.test(t))).toBe(true);
    expect(titles.some((t) => !t.includes(': 0 tasks'))).toBe(true);
  });
});
