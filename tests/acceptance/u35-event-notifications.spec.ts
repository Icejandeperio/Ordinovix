/**
 * U35 — the notifications that actions cause (spec 14) reach the Notifications screen the same way in both data sources: a task
 * given to the helper tells the helper, and a line the helper marks received tells the owner, with the lock-screen-safe title and the
 * fuller body, linking to the task. The people take turns in one browser (the mock keeps its data in the page; the Worker keeps it in
 * its database), switching persona as the dev tools do.
 */
import { test, expect, type Page } from '@playwright/test';

async function inApp<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<Record<string, unknown>>;
    const mod = await load('/src/data/index.ts');
    return new Function('r', `return (${body})(r)`)((mod as { repositories: unknown }).repositories);
  }, fn) as Promise<T>;
}

/** Becomes `persona` (the saved choice, which the mock reads and the dev sign-in of the Worker follows) and reloads. */
async function become(page: Page, persona: 'owner' | 'helper', path = '/') {
  await page.evaluate((p) => localStorage.setItem('ox-mock-persona', p), persona);
  await page.goto(path);
  await expect(page.locator('#main-content')).toBeVisible();
}

test.describe('U35 notifications caused by actions', () => {
  test('U35 assigning a task tells the helper; a helper marking a line received tells the owner', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        if (!localStorage.getItem('ox-mock-persona')) localStorage.setItem('ox-mock-persona', 'owner');
        localStorage.setItem('ox-mock-failure-rate', '0');
      } catch { /* storage unavailable */ }
    });
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();

    // Ana gives the RSP task to Ben, and takes Ben's own CSL task for herself (so that Ben's next receipt is hers to review)
    await inApp(page, `async (r) => { await r.tasks.update('task-cruz-1601c', { ownerUserId: 'user-ana' }); await r.tasks.update('task-rsp-0619e', { ownerUserId: 'user-ben' }); }`);

    // Ben is told he was assigned the task; the title has no name in it, the body names Ana
    await become(page, 'helper', '/notifications');
    await expect(page.getByText('You were assigned RSP BIR 0619-E')).toBeVisible();
    await expect(page.getByText('Ana assigned you RSP BIR 0619-E')).toBeVisible();

    // Ben marks the CSL payroll line received
    await inApp(page, `async (r) => { await r.lines.setStatus('line-cruz-1', 'received'); }`);

    // Ana is told it needs review, and opening it goes to the task
    await become(page, 'owner', '/notifications');
    await expect(page.getByText('Ben added Monthly Compensation Payroll Sheet')).toContainText('Needs review');
    await page.getByText(/^CSL BIR 1601-C .*: needs review.$/).click();
    await expect(page).toHaveURL(/\/tasks\/task-cruz-1601c$/);
  });
});
