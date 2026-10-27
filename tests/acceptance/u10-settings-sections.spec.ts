/**
 * U10 — Settings saves for real (B06): every section loads from and saves to its repository method, so a
 * saved change survives a reload, and "Settings saved" appears only after the save succeeded.
 */
import { test, expect, type Page } from '@playwright/test';

async function as(page: Page, persona: 'owner' | 'helper', failureRate = '0') {
  await page.addInitScript(
    ([p, rate]) => {
      try { localStorage.setItem('ox-mock-persona', p); localStorage.setItem('ox-mock-failure-rate', rate); } catch { /* storage unavailable */ }
    },
    [persona, failureRate],
  );
}

const save = (page: Page) => page.getByRole('button', { name: 'Save changes' }).first();

test.describe('U10 settings sections save for real', () => {
  test('U10 B06 profile: the display name and mobile number persist, and the banner appears after the save', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/profile');
    await expect(page.getByLabel('Display Name (in messages)')).toHaveValue(/.+/);
    await expect(page.getByText('Settings saved')).toHaveCount(0);
    await page.getByLabel('Display Name (in messages)').fill('Ana QA');
    await page.getByLabel('Mobile Number (PH)').fill('+639170000001');
    await save(page).click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Display Name (in messages)')).toHaveValue('Ana QA');
    await expect(page.getByLabel('Mobile Number (PH)')).toHaveValue('+639170000001');
  });

  test('U10 B06 a failed save shows the error and never the "Settings saved" banner', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/practice');
    await expect(page.getByLabel('Practice Firm Name')).toHaveValue(/.+/);
    await page.getByLabel('Practice Firm Name').fill('x'); // under 2 characters: refused at the repository boundary
    await save(page).click();
    await expect(page.getByRole('alert')).toContainText(/at least 2 characters/i);
    await expect(page.getByText('Settings saved')).toHaveCount(0);
  });

  test('U10 B06 practice: firm name and accreditation persist', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/practice');
    await expect(page.getByLabel('Practice Firm Name')).toHaveValue(/.+/);
    await page.getByLabel('Practice Firm Name').fill('QA Tax Practice');
    await page.getByLabel('BIR Tax Agent Accreditation No.').fill('BOA-99999-2026');
    await save(page).click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Practice Firm Name')).toHaveValue('QA Tax Practice');
    await expect(page.getByLabel('BIR Tax Agent Accreditation No.')).toHaveValue('BOA-99999-2026');
  });

  test('U10 B06 notifications: a switched-off alert stays off after a reload', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/notifications');
    const alert = page.getByLabel('Visit trip readiness updates');
    await expect(alert).toBeChecked();
    await alert.uncheck();
    await save(page).click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Visit trip readiness updates')).not.toBeChecked();
    await expect(page.getByLabel('Deadlines due within 7 days')).toBeChecked();
  });

  test('U10 B06 security: the idle lock and privacy mode persist', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/security');
    await page.getByRole('button', { name: '30 min' }).click();
    await page.getByLabel('Privacy mode on startup').check();
    await save(page).click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: '30 min' })).toHaveClass(/stamp-soft/);
    await expect(page.getByLabel('Privacy mode on startup')).toBeChecked();
  });

  test('U10 B06 messages: an edited template persists and is not duplicated', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/messages');
    const boxes = page.locator('textarea');
    await expect(boxes.first()).toHaveValue(/.+/);
    const before = await boxes.count();
    await boxes.first().fill('Good day {{contact}}, this is the QA wording for {{task}}.');
    await save(page).click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.locator('textarea').first()).toHaveValue('Good day {{contact}}, this is the QA wording for {{task}}.');
    await expect(page.locator('textarea')).toHaveCount(before);
  });

  test('U10 B06 deadlines: the due-soon window persists', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/calendar');
    await expect(page.locator('#threshold-due-soon')).toHaveValue(/\d+/);
    await page.locator('#threshold-due-soon').fill('10');
    await save(page).click();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.locator('#threshold-due-soon')).toHaveValue('10');
  });

  test('U10 B06 visit kit: a new item persists and is not duplicated', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/visit-kit');
    await expect(page.locator('main label').first()).toBeVisible();
    const before = await page.locator('main label').count();
    await page.getByLabel('New kit item').fill('Spare printer ribbon');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Spare printer ribbon')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Spare printer ribbon')).toHaveCount(1);
    await expect(page.locator('main label')).toHaveCount(before + 1);
  });

  test('U10 B06 users: Helpers can accept persists', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/users');
    const toggle = page.locator('#helpers-accept-toggle');
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await expect(page.getByText('Settings saved')).toBeVisible();
    await page.reload();
    await expect(page.locator('#helpers-accept-toggle')).not.toBeChecked();
  });

  test('U10 B06 a helper sees the profile read-only and cannot save practice details', async ({ page }) => {
    await as(page, 'helper');
    await page.goto('/settings/profile');
    await expect(page.getByLabel('Display Name (in messages)')).toHaveAttribute('readonly', '');
    await expect(save(page)).toBeDisabled();
    await expect(page.getByText(/only the practice owner can change these details/i)).toBeVisible();
  });
});
