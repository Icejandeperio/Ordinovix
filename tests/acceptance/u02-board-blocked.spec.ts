/**
 * U02 — A blocked task changes status only through an owner override with a reason (B04).
 * The repository-level B04 contract test lives in regressions.spec.ts; these cover the board UI.
 * The board is about 1600 px wide, so these run at a desktop width where source and target columns are both visible.
 */
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 900 } });

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  });
}

async function displayedStatus(page: Page, taskId: string): Promise<string> {
  return page.evaluate(async (id) => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
    const mod = await load('/src/data/index.ts');
    return (await mod.repositories.tasks.get(id)).summary.displayedStatus;
  }, taskId);
}

async function dragBlockedCardTo(page: Page, column: string) {
  const card = page.locator('[draggable="true"]', { has: page.locator('a[href="/tasks/task-cruz-1601c"]') });
  await expect(card).toBeVisible();
  await card.dragTo(page.getByRole('heading', { name: column, exact: true }), { sourcePosition: { x: 4, y: 4 } });
}

test.describe('U02 Blocked task board rules', () => {
  test('U02 B04 board: dragging a blocked task to Completed shows the reason and does not move it', async ({ page }) => {
    await asOwner(page);
    await page.goto('/tasks?view=board');
    expect(await displayedStatus(page, 'task-cruz-1601c')).toBe('waiting_on_client');

    await dragBlockedCardTo(page, 'Completed');

    await expect(page.locator('main')).toContainText(/cannot move to "completed"/i);
    await expect(page.locator('main')).toContainText(/owner override with a reason/i);
    expect(await displayedStatus(page, 'task-cruz-1601c')).toBe('waiting_on_client');
  });

  test('U02 B04 board: dragging a blocked task to Submitted shows the reason instead of the submit dialog', async ({ page }) => {
    await asOwner(page);
    await page.goto('/tasks?view=board');

    await dragBlockedCardTo(page, 'Submitted');

    await expect(page.locator('main')).toContainText(/cannot move to "submitted"/i);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await displayedStatus(page, 'task-cruz-1601c')).toBe('waiting_on_client');
  });
});
