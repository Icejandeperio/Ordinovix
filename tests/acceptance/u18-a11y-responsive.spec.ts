/**
 * U18 — Accessibility and responsive sweep: no serious or critical axe violations on the main routes in both
 * themes, and no horizontal scroll at 360 px on any route.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const AXE_ROUTES = [
  '/', '/tasks', '/tasks/task-rsp-0619e', '/clients', '/clients/client-rsp', '/follow-ups', '/visits', '/visits/visit-today',
  '/calendar', '/documents', '/payments', '/offices', '/insights', '/reports', '/audit', '/settings', '/help', '/notifications',
  '/welcome', '/sign-in',
];

const SCROLL_ROUTES = [
  ...AXE_ROUTES, '/clients/import', '/follow-ups/run', '/visits/visit-today/record', '/visits/visit-today/summary',
  '/settings/templates', '/search', '/no-such-page',
];

async function open(page: Page, route: string, theme: 'light' | 'dark') {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('ox-mock-persona', 'owner');
      localStorage.setItem('ox-mock-failure-rate', '0');
      localStorage.setItem('ox-theme', t);
    } catch { /* storage unavailable */ }
  }, theme);
  await page.goto(route);
  await expect(page.locator('h1, h2').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  // Review stamps fade in (opacity 0 -> 0.95 over 0.36 s). Axe must not sample a half-transparent stamp, or it
  // reports a colour-contrast violation that exists only mid-animation (seen in CI in both themes).
  await page.waitForFunction(
    () => [...document.querySelectorAll<HTMLElement>('.border-stamp-ink')]
      .every((el) => Number(getComputedStyle(el).opacity) >= 0.94),
    undefined,
    { timeout: 5_000 },
  );
}

for (const theme of ['light', 'dark'] as const) {
  for (const route of AXE_ROUTES) {
    test(`U18 axe: ${route} in the ${theme} theme has no serious or critical violations`, async ({ page }) => {
      await open(page, route, theme);
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const blocking = result.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
      expect(blocking).toEqual([]);
    });
  }
}

for (const route of SCROLL_ROUTES) {
  test(`U18 responsive: ${route} does not scroll sideways at 360 px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page, route, 'light');
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const main = document.getElementById('main-content');
      return { page: de.scrollWidth - de.clientWidth, main: main ? main.scrollWidth - main.clientWidth : 0 };
    });
    expect(overflow).toEqual({ page: 0, main: 0 });
  });
}
