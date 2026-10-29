/**
 * U33 — the U18 axe checks hold while a page is still loading, not only once it has settled (CI saw /audit fail on its loading
 * skeleton and /clients fail in the dark theme on a filter button's label, in API mode). Against the API the data requests are held
 * back so the skeleton stays on screen while axe runs; in mock mode the same pages are checked as soon as they have a heading.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const API = process.env.VITE_DATA_SOURCE === 'api';
const ROUTES = ['/audit', '/clients'];

async function blocking(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

for (const theme of ['light', 'dark'] as const) {
  for (const route of ROUTES) {
    test(`U33 axe: ${route} in the ${theme} theme has no serious or critical violations while it loads`, async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('ox-mock-persona', 'owner');
          localStorage.setItem('ox-mock-failure-rate', '0');
          localStorage.setItem('ox-theme', t);
        } catch { /* storage unavailable */ }
      }, theme);

      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      if (API) {
        // Everything but the session and the dev sign-in waits, so the page shows its loading state
        await page.route('**/api/v1/**', async (route) => {
          const path = new URL(route.request().url()).pathname;
          if (!/\/(session\/me|dev\/)/.test(path)) await held;
          await route.continue();
        });
      }

      await page.goto(route);
      await expect(page.locator('h1, h2').first()).toBeVisible();
      if (API) await expect(page.locator('.animate-pulse').first()).toBeVisible(); // the loading placeholders are on screen
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');

      expect(await blocking(page)).toEqual([]);

      release();
      await page.waitForLoadState('networkidle');
      expect(await blocking(page)).toEqual([]);
    });
  }
}
