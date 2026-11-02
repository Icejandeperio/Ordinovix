/**
 * U36 — Reports with real numbers, in both data sources: opening a period reports the lines it really created, the monthly summary
 * agrees with Insights and Payments for the same month, and the CSV exports are the real rows (a byte-order mark for Excel, the same
 * columns as the Reports screen, masked TINs only).
 */
import { test, expect, type Page } from '@playwright/test';

async function inApp<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<Record<string, unknown>>;
    const mod = await load('/src/data/index.ts');
    return new Function('r', `return (${body})(r)`)((mod as { repositories: unknown }).repositories);
  }, fn) as Promise<T>;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ox-mock-persona', 'owner');
      localStorage.setItem('ox-mock-failure-rate', '0');
    } catch { /* storage unavailable */ }
  });
  await page.goto('/');
  await expect(page.locator('#main-content')).toBeVisible();
});

test.describe('U36 reports with real numbers', () => {
  test('U36 opening a period returns the number of lines it really created, and none the second time', async ({ page }) => {
    // One task from every template, so the counts differ from task to task (a flat "two lines each" would be wrong)
    const plan = `async (r) => ({ period: '2027-03', selections: (await r.templates.list()).map((t) => ({ clientId: 'client-maria', templateId: t.id, dueDate: '2027-04-10' })) })`;
    const first = await inApp<{ created: string[]; skipped: number; lines: number }>(page, `async (r) => r.tasks.openPeriod(await (${plan})(r))`);
    expect(first.created.length).toBeGreaterThan(1);
    expect(first.skipped).toBe(0);

    // The lines the tasks really hold: the total the call reported must be exactly that
    const perTask = await inApp<number[]>(page, `async (r) => Promise.all(${JSON.stringify(first.created)}.map(async (id) => (await r.tasks.get(id)).lines.length))`);
    expect(new Set(perTask).size).toBeGreaterThan(1);
    expect(first.lines).toBe(perTask.reduce((a, b) => a + b, 0));

    const again = await inApp<{ created: string[]; skipped: number; lines: number }>(page, `async (r) => r.tasks.openPeriod(await (${plan})(r))`);
    expect(again).toEqual({ created: [], skipped: first.created.length, lines: 0 });
  });

  test('U36 the monthly summary agrees with Insights and Payments for the same month', async ({ page }) => {
    const { summary, overview, paid } = await inApp<{ summary: Record<string, unknown>; overview: Record<string, any>; paid: number }>(
      page,
      `async (r) => ({
        summary: await r.reports.monthlySummary('2026-10'),
        overview: await r.insights.get('overview', { from: '2026-10-01', to: '2026-10-31' }),
        paid: (await r.payments.list({ from: '2026-10-01', to: '2026-10-31' })).totalAmount,
      })`,
    );
    const october = overview.monthlyTrends[0];
    expect(summary.month).toBe('2026-10');
    expect(summary.filingsCount).toBe(october.filings);
    expect(summary.firstPassRate).toBe(october.firstPassRate);
    expect(summary.avoidableRepeatTrips).toBe(october.repeatTrips);
    expect(summary.onTimeRate).toBe(overview.onTimeFilingRate);
    expect(summary.firstPassBaseline).toBe(overview.firstPassBaseline);
    expect(summary.paymentsHandled).toBe(paid);
    // Not the old canned figures
    expect(summary).not.toMatchObject({ filingsCount: 16, onTimeFilingsCount: 15, totalVisits: 8, paymentsHandled: 4500000 });
  });

  test('U36 CSV exports have a byte-order mark, the columns of the Reports screen and no full TIN', async ({ page }) => {
    const bytes = await inApp<number[]>(page, `async (r) => Array.from(new Uint8Array(await (await r.reports.exportCsv('clients')).arrayBuffer()))`);
    expect(bytes.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(new Uint8Array(bytes));
    const [header, ...rows] = text.split('\r\n').filter(Boolean);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.join('\n')).toContain('RSP');
    expect(rows.join('\n')).not.toMatch(/\d{3}-\d{3}-\d{3}/);

    // The file the screen's own CSV button saves has the same columns
    await page.goto('/reports');
    await page.getByRole('button', { name: /Export Clients/ }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('CSV Spreadsheet').first().click()]);
    const screenCsv = (await (await import('node:fs/promises')).readFile((await download.path())!, 'utf8')).replace(String.fromCharCode(0xfeff), '');
    expect(screenCsv.split('\r\n')[0]).toBe(header);

    // Every export kind answers with real columns, not the old one-row stub
    const headers = await inApp<Record<string, string>>(
      page,
      `async (r) => { const out = {}; for (const k of ['clients','tasks','lines','follow_ups','visits','payments','activity']) out[k] = (await (await r.reports.exportCsv(k)).text()).split('\\r\\n')[0].replace(/^\\uFEFF/, ''); return out; }`,
    );
    for (const [kind, line] of Object.entries(headers)) expect(line.split(',').length, kind).toBeGreaterThanOrEqual(6);
  });

  test('U36 the client history report reads the client\'s real tasks and payments', async ({ page }) => {
    const history = await inApp<{ year: number; tasks: Array<{ task: { clientId: string; dueDate: string } }>; totalPayments: number }>(
      page,
      `async (r) => r.reports.clientHistory('client-rsp', 2026)`,
    );
    const real = await inApp<{ payments: number; tasks: number }>(
      page,
      `async (r) => ({
        payments: (await r.payments.list({ clientId: 'client-rsp', from: '2026-01-01', to: '2026-12-31' })).totalAmount,
        tasks: (await r.tasks.list({ clientId: 'client-rsp' })).items.filter((t) => t.task.dueDate.startsWith('2026')).length,
      })`,
    );
    expect(history.tasks).toHaveLength(real.tasks);
    expect(history.tasks.every((t) => t.task.clientId === 'client-rsp' && t.task.dueDate.startsWith('2026'))).toBe(true);
    expect(history.totalPayments).toBe(real.payments);
  });
});
