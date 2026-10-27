/**
 * U04 — Pinch zoom restored (B19) and dev tools visible in mock mode (B18; the api-mode hiding is unit-tested
 * in src/lib/data-source.test.ts because the fixed Playwright config only serves mock mode).
 */
import { test, expect } from '@playwright/test';

test.describe('U04 viewport and dev tools', () => {
  test('U04 B19 viewport meta does not disable zoom', async ({ page }) => {
    await page.goto('/');
    const content = (await page.locator('meta[name="viewport"]').getAttribute('content')) ?? '';
    expect(content).toContain('width=device-width');
    expect(content).not.toMatch(/maximum-scale/i);
    expect(content).not.toMatch(/user-scalable/i);
  });

  test('U04 B18 mock mode still shows the sample-data banner and dev menu', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('ox-mock-persona', 'owner'); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
    });
    await page.goto('/');
    await expect(page.getByText('Sample Data Mode')).toBeVisible();
    await expect(page.getByRole('button', { name: /dev menu/i })).toBeVisible();
  });
});
