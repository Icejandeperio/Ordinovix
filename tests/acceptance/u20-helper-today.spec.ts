/**
 * U20 — A helper's visit whose items all belong to unassigned clients is not shown on Today as an empty
 * "0 of 0 ready" visit (found in the U07 final review, B11).
 */
import { test, expect, type Page } from '@playwright/test';

async function as(page: Page, persona: 'owner' | 'helper') {
  await page.addInitScript((p) => {
    try {
      localStorage.setItem('ox-mock-persona', p);
      localStorage.setItem('ox-mock-failure-rate', '0');
      localStorage.setItem('ox-mock-today', '2026-10-27');
    } catch { /* storage unavailable */ }
  }, persona);
}

test.describe('U20 helper Today', () => {
  test('U20 B11 a visit made only of unassigned clients\' items is not shown to the helper as 0 of 0 ready', async ({ page, context }) => {
    await as(page, 'owner');
    await page.goto('/');
    const visitId = await page.evaluate(async () => {
      const load = new Function('p', 'return import(p)') as (p: string) => Promise<{ repositories: { visits: { create: (v: unknown, items: unknown[]) => Promise<{ id: string }> } } }>;
      const mod = await load('/src/data/index.ts');
      const v = await mod.repositories.visits.create({ officeId: 'off-rdo39', plannedDate: '2026-10-28', assigneeUserId: 'user-ben', purpose: 'Maria only visit' }, [{ taskId: 'task-maria-2550q', action: 'submit' }]);
      return v.id;
    });
    expect(visitId).toBeTruthy();

    // The owner still sees it on Today
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();

    const helperPage = await context.newPage();
    await as(helperPage, 'helper');
    await helperPage.goto('/');
    await expect(helperPage.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await expect(helperPage.locator('main')).not.toContainText('0 of 0');
    await expect(helperPage.locator('main')).not.toContainText('Maria only visit');
  });
});
