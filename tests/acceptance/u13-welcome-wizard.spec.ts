/**
 * U13 — The welcome wizard saves what it collects (B30): each step goes through the repository
 * (settings, template activation, invite) and the Today "Getting started" card shows the progress.
 */
import { test, expect, type Page } from '@playwright/test';

async function as(page: Page, persona: 'owner' | 'helper') {
  await page.addInitScript((p) => {
    try {
      localStorage.setItem('ox-mock-persona', p);
      localStorage.setItem('ox-mock-failure-rate', '0');
    } catch { /* storage unavailable */ }
  }, persona);
}

type Repos = {
  session: { me: () => Promise<{ settings: { practiceName: string; onboarding?: { done: string[]; dismissed?: boolean } } }> };
  templates: { list: () => Promise<Array<{ id: string; code: string; active: boolean }>> };
  memberships: { list: () => Promise<Array<{ email: string; role: string; clientIds: string[] }>> };
  settings: { save: (s: unknown) => Promise<unknown> };
};

/** Runs `fn` in the page with the app's repositories. */
async function inApp<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<{ repositories: unknown }>;
    const mod = await load('/src/data/index.ts');
    return new Function('r', `return (${body})(r)`)(mod.repositories);
  }, fn) as Promise<T>;
}

const settingsNow = (page: Page) => inApp<{ practiceName: string; onboarding?: { done: string[]; dismissed?: boolean } }>(page, 'async (r) => (await r.session.me()).settings');
const templatesNow = (page: Page) => inApp<Array<{ id: string; code: string; active: boolean }>>(page, 'async (r) => r.templates.list()');
const membersNow = (page: Page) => inApp<Array<{ email: string; role: string; clientIds: string[] }>>(page, 'async (r) => r.memberships.list()');

const card = (page: Page) => page.getByRole('region', { name: 'Getting started' });
const next = (page: Page) => page.getByRole('button', { name: /^Continue$/ });

test.describe('U13 welcome wizard', () => {
  test('U13 B30 the Getting started card lists the five steps, none done on a fresh practice', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('0 of 5 done');
    for (const title of ['Your practice details', 'Add your clients', 'Choose obligation templates', 'Invite a helper', 'Put Ordinovix on your phone']) {
      await expect(card(page)).toContainText(title);
    }
  });

  test('U13 B30 step 1 saves the practice details and the card counts it', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/welcome');
    await page.getByLabel(/Practice Name/).fill('Reyes Tax Desk');
    await next(page).click();
    await expect(page.getByText('Add your clients', { exact: true }).first()).toBeVisible();

    const saved = await settingsNow(page);
    expect(saved.practiceName).toBe('Reyes Tax Desk');
    expect(saved.onboarding?.done).toEqual(['details']);

    await page.goto('/');
    await expect(card(page)).toContainText('1 of 5 done');
  });

  test('U13 B30 step 1 refuses a mobile number that is not a Philippine mobile and saves nothing', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/welcome');
    await page.getByLabel(/Mobile Number/).fill('12345');
    await page.getByLabel(/Practice Name/).fill('Should Not Save');
    await next(page).click();
    await expect(page.getByRole('alert')).toContainText('Philippine mobile number');
    await expect(page.getByText('Your practice details')).toBeVisible();
    expect((await settingsNow(page)).practiceName).not.toBe('Should Not Save');
  });

  test('U13 B30 step 3 saves which templates are active', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/welcome?step=3');
    await expect(page.getByText('Choose obligation templates')).toBeVisible();
    const before = await templatesNow(page);
    expect(before.length).toBeGreaterThan(1);
    expect(before.every((t) => t.active)).toBe(true);

    await page.getByLabel(`Include ${before[0].code}`).click();
    await next(page).click();
    await expect(page.getByText('Invite a helper (Optional)')).toBeVisible();

    const after = await templatesNow(page);
    expect(after.find((t) => t.id === before[0].id)!.active).toBe(false);
    expect(after.filter((t) => t.id !== before[0].id).every((t) => t.active)).toBe(true);
    expect((await settingsNow(page)).onboarding?.done).toEqual(['templates']);
  });

  test('U13 B30 step 4 invites the helper through the repository', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/welcome?step=4');
    await page.getByLabel(/Helper Google Account Email/).fill('new.helper@example.com');
    await next(page).click();
    await expect(page.getByText('Put Ordinovix on your phone')).toBeVisible();

    const member = (await membersNow(page)).find((m) => m.email === 'new.helper@example.com');
    expect(member?.role).toBe('helper');
    expect((await settingsNow(page)).onboarding?.done).toEqual(['helper']);
  });

  test('U13 B30 a bad helper email shows the error and stays on the step', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/welcome?step=4');
    const before = (await membersNow(page)).length;
    await page.getByLabel(/Helper Google Account Email/).fill('not-an-email');
    await next(page).click();
    await expect(page.getByRole('alert')).toContainText('Enter a valid email address');
    await expect(page.getByText('Invite a helper (Optional)')).toBeVisible();
    expect((await membersNow(page)).length).toBe(before);
    expect((await settingsNow(page)).onboarding?.done ?? []).toEqual([]);
  });

  test('U13 B30 skipping a step saves nothing from it', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/welcome?step=4');
    const before = (await membersNow(page)).length;
    await page.getByLabel(/Helper Google Account Email/).fill('skipped@example.com');
    await page.getByRole('button', { name: 'Skip this step' }).click();
    await expect(page.getByText('Put Ordinovix on your phone')).toBeVisible();
    expect((await membersNow(page)).length).toBe(before);
    expect((await settingsNow(page)).onboarding?.done ?? []).toEqual([]);
  });

  test('U13 B30 finishing all five steps saves them and the card goes away', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/welcome');
    await next(page).click(); // details
    await page.getByText('Add clients one at a time').click();
    await next(page).click(); // clients
    await next(page).click(); // templates
    await page.getByLabel(/Helper Google Account Email/).fill('finish.helper@example.com');
    await next(page).click(); // helper
    await page.getByRole('button', { name: 'Complete Setup' }).click();

    await expect(page).toHaveURL(/\/clients$/); // the "add one at a time" choice lands on Clients
    await expect(page.getByText('Setup saved. You can change any of this in Settings.')).toBeVisible();
    expect((await settingsNow(page)).onboarding?.done).toEqual(['details', 'clients', 'templates', 'helper', 'phone']);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test('U13 B30 Continue setup on the card opens the first step that is not done', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    await inApp(page, "async (r) => r.settings.save({ onboarding: { done: ['details', 'clients'] } })");
    await page.reload();
    await expect(card(page)).toContainText('2 of 5 done');
    await card(page).getByRole('link', { name: 'Continue setup' }).click();
    await expect(page).toHaveURL(/\/welcome\?step=3/);
    await expect(page.getByText('Choose obligation templates')).toBeVisible();
  });

  test('U13 B30 Dismiss hides the card, and it stays hidden after a reload', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    await card(page).getByRole('button', { name: 'Dismiss' }).click();
    await expect(card(page)).toHaveCount(0);
    expect((await settingsNow(page)).onboarding?.dismissed).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test('U13 B30 a helper never sees the Getting started card', async ({ page }) => {
    await as(page, 'helper');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });
});
