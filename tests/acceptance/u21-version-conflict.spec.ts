/**
 * U21 — a save that names an older version of the record fails with VERSION_CONFLICT. The screen says so in plain
 * words, reloads the record and shows the other person's change; nothing is overwritten silently.
 *
 * The mock keeps its store in the page, so "someone else saved first" is simulated by calling the repository from
 * the page with no version, which is what a second device's save looks like to the first.
 */
import { test, expect, type Page } from '@playwright/test';

async function asOwner(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  });
}

const CONFLICT = /changed by someone else/i;

test.describe('U21 stale saves are refused and the record reloads', () => {
  test('U21 practice settings: a stale save shows the message and the other change', async ({ page }) => {
    await asOwner(page);
    await page.goto('/settings/practice');
    const name = page.getByLabel('Practice Firm Name');
    await expect(name).toHaveValue(/.+/);

    // Another device saves first
    await page.evaluate(async () => {
      const mock = await import('/src/data/mock/index.ts');
      await mock.mockRepositories.settings.save({ practiceName: 'Changed on another device' });
    });

    await name.fill('My edit');
    await page.getByRole('button', { name: 'Save changes' }).first().click();

    await expect(page.getByText(CONFLICT).first()).toBeVisible();
    await expect(page.getByText('Settings saved')).toHaveCount(0);
    // The form reloaded with what the other device saved; my edit was not applied
    await expect(name).toHaveValue('Changed on another device');

    // With the latest version in hand the save goes through
    await name.fill('My edit, second try');
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Practice Firm Name')).toHaveValue('My edit, second try');
  });

  test('U21 message templates: a stale save shows the message and reloads the text', async ({ page }) => {
    await asOwner(page);
    await page.goto('/settings/messages');
    const box = page.getByRole('textbox', { name: / message$/ }).first();
    await expect(box).toHaveValue(/.+/);

    await page.evaluate(async () => {
      const mock = await import('/src/data/mock/index.ts');
      const [first] = await mock.mockRepositories.messages.list();
      await mock.mockRepositories.messages.save({ id: first.id, body: 'Edited on another device' });
    });

    await box.fill('My wording');
    await page.getByRole('button', { name: 'Save changes' }).first().click();

    await expect(page.getByText(CONFLICT).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: / message$/ }).first()).toHaveValue('Edited on another device');
  });
});
