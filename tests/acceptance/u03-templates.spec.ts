/**
 * U03 — Task templates screen and Welcome wizard read the repository's templates (B07).
 * No fabricated "Verified" badges: verification state comes from the data and changes only through markVerified.
 */
import { test, expect, type Page } from '@playwright/test';

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  });
}

type TemplateRow = { id: string; code: string; verified: boolean; sourceRef?: string };

async function repoTemplates(page: Page): Promise<TemplateRow[]> {
  return page.evaluate(async () => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
    const mod = await load('/src/data/index.ts');
    return (await mod.repositories.templates.list()).map((t: any) => ({ id: t.id, code: t.code, verified: t.verified, sourceRef: t.sourceRef }));
  });
}

test.describe('U03 Templates read real data', () => {
  test('U03 B07 Settings templates show each repository template with its real verification state and line count', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    const templates = await repoTemplates(page);
    expect(templates.length).toBeGreaterThan(0);

    await page.goto('/settings/templates');
    const main = page.locator('main');
    for (const t of templates) await expect(main).toContainText(t.code);
    await expect(main).toContainText(/requirement lines/);
    await expect(main).not.toContainText('…'); // line counts resolved
    const unverified = templates.filter((t) => !t.verified).length;
    await expect(main.getByText('Unverified', { exact: true })).toHaveCount(unverified);
    await expect(main.getByText('Verified', { exact: true })).toHaveCount(templates.length - unverified);
  });

  test('U03 B07 Mark Verified needs a source reference, then persists through the repository', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    const target = (await repoTemplates(page)).find((t) => !t.verified)!;
    expect(target, 'a seed template that is not verified').toBeDefined();

    await page.goto('/settings/templates');
    await page.getByRole('button', { name: 'Mark Verified' }).first().click();
    await page.getByRole('button', { name: 'Confirm Verification' }).click();
    await expect(page.getByText(/source reference is required/i)).toBeVisible();

    await page.getByLabel(/Source Reference/i).fill('RR 8-2018 Sec. 4');
    await page.getByRole('button', { name: 'Confirm Verification' }).click();
    await expect(page.getByRole('button', { name: 'Confirm Verification' })).toHaveCount(0);

    await page.reload();
    const after = await repoTemplates(page);
    const first = after.find((t) => t.id === (after.find((x) => x.verified)?.id));
    expect(first?.sourceRef).toBe('RR 8-2018 Sec. 4');
    await expect(page.locator('main')).toContainText('RR 8-2018 Sec. 4');
  });

  test('U03 B07 Welcome wizard lists the repository templates, not a hard-coded set', async ({ page }) => {
    await asOwner(page);
    await page.goto('/');
    const templates = await repoTemplates(page);

    await page.goto('/welcome');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText('Choose obligation templates')).toBeVisible();
    const main = page.locator('body');
    for (const t of templates) await expect(main).toContainText(t.code);
    await expect(main).not.toContainText('BOOK-STAMP');
    await expect(main).not.toContainText('1702-Q');
  });
});
