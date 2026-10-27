/**
 * U10 — a helper's Profile shows the helper's own details, not the practice owner's (regression found in review).
 */
import { test, expect } from '@playwright/test';

test.describe('U10 helper profile', () => {
  test('U10 B06 a helper sees their own name and mobile number on Profile, read-only', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('ox-mock-persona', 'helper'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
    });
    await page.goto('/settings/profile');
    await expect(page.getByLabel('Full Name')).toHaveValue('Ben Morales');
    await expect(page.getByLabel('Display Name (in messages)')).toHaveValue('Ben');
    await expect(page.getByLabel('Mobile Number (PH)')).toHaveValue('+639189876543');
    await expect(page.getByLabel('Mobile Number (PH)')).toHaveAttribute('readonly', '');
  });

  test('U10 B06 the owner sees the practice operator details on Profile', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
    });
    await page.goto('/settings/profile');
    await expect(page.getByLabel('Full Name')).toHaveValue('Ana Santos');
    await expect(page.getByLabel('Mobile Number (PH)')).toHaveValue('+639171234567');
  });
});
