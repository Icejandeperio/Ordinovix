/**
 * U38 — every edit names the version it was made from. In the API build each save is a request whose If-Match is the loaded
 * version, never "*"; these flows (the Welcome wizard's sequential saves, the helpers-can-accept toggle, Getting started, a calendar
 * drag and its Undo) record those requests and fail on a wildcard or a missing version. In the mock build there is no request, so
 * the same flows check the saves took effect in order (a stale version would have been refused).
 */
import { test, expect, type Page } from '@playwright/test';

async function inApp<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<Record<string, unknown>>;
    const mod = await load('/src/data/index.ts');
    return new Function('r', `return (${body})(r)`)((mod as { repositories: unknown }).repositories);
  }, fn) as Promise<T>;
}

/** Every write of the app (PUT, PATCH) with its If-Match, as the browser sends it. Empty in the mock build. */
function recordUpdates(page: Page) {
  const sent: Array<{ method: string; path: string; ifMatch: string | undefined }> = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/api/v1/') && (req.method() === 'PUT' || req.method() === 'PATCH') && url.pathname !== '/api/v1/prefs') {
      sent.push({ method: req.method(), path: url.pathname, ifMatch: req.headers()['if-match'] });
    }
  });
  return sent;
}

const expectVersioned = (sent: ReturnType<typeof recordUpdates>) => {
  for (const s of sent) expect(s.ifMatch, `${s.method} ${s.path}`).toMatch(/^"?\d+"?$/);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('ox-mock-persona', 'owner');
      localStorage.setItem('ox-mock-failure-rate', '0');
    } catch {
      /* storage unavailable */
    }
  });
});

test.describe('U38 callers send the version', () => {
  test('U38 the Welcome wizard saves its steps one after another, each from the version the last returned', async ({ page }) => {
    const sent = recordUpdates(page);
    await page.goto('/welcome');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    const before = await inApp<number>(page, `async (r) => (await r.session.me()).settings.version`);

    await page.getByLabel(/Practice Name/).fill('Reyes Tax Desk');
    await page.getByRole('button', { name: 'Continue' }).click(); // step 1: a settings save
    await expect(page.getByText('Add your clients', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click(); // step 2
    await expect(page.getByText(/obligation templates/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click(); // step 3: another settings save, from the version the first returned
    await expect(page.getByText(/helper/i).first()).toBeVisible();

    const after = await inApp<number>(page, `async (r) => (await r.session.me()).settings.version`);
    expect(after).toBeGreaterThanOrEqual(before + 2);
    expectVersioned(sent);
  });

  test('U38 the helpers-can-accept toggle and the Getting started card send the settings version', async ({ page }) => {
    const sent = recordUpdates(page);
    await page.goto('/settings/users');
    const toggle = page.locator('#helpers-accept-toggle');
    await toggle.scrollIntoViewIfNeeded();
    const was = await toggle.isChecked();
    const before = await inApp<number>(page, `async (r) => (await r.session.me()).settings.version`);
    await toggle.click();
    await expect.poll(() => inApp<boolean>(page, `async (r) => (await r.session.me()).settings.helpersCanAccept`)).toBe(!was);
    expect(await inApp<number>(page, `async (r) => (await r.session.me()).settings.version`)).toBe(before + 1);
    await toggle.click(); // and back, from the version the first save produced
    await expect.poll(() => inApp<boolean>(page, `async (r) => (await r.session.me()).settings.helpersCanAccept`)).toBe(was);
    expect(await inApp<number>(page, `async (r) => (await r.session.me()).settings.version`)).toBe(before + 2);

    await page.goto('/');
    const dismiss = page.getByRole('button', { name: 'Dismiss' });
    if (await dismiss.isVisible().catch(() => false)) {
      await dismiss.click();
      await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);
    }
    expectVersioned(sent);
  });

  test('U38 a calendar drag and its Undo carry the visit version, and Undo uses the version the move produced', async ({ page }) => {
    const sent = recordUpdates(page);
    // The seed's planned visit is on today's date, which the month view opens on; move it one day and Undo
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible();
    const visit = await inApp<{ id: string; date: string; version: number }>(
      page,
      `async (r) => { const v = (await r.visits.get('visit-today')).visit; return { id: v.id, date: v.plannedDate, version: v.version }; }`,
    );
    await page.goto('/calendar');
    await expect(page.locator('#main-content')).toBeVisible();

    const day = Number(visit.date.slice(8, 10));
    const targetDate = `${visit.date.slice(0, 8)}${String(day < 27 ? day + 1 : day - 1).padStart(2, '0')}`;
    const chip = page.locator(`[data-date="${visit.date}"] [draggable="true"][title*="Drag to reschedule"]`).first();
    await expect(chip).toBeVisible();
    await chip.dragTo(page.locator(`[data-date="${targetDate}"]`));
    await expect.poll(() => inApp<number>(page, `async (r) => (await r.visits.get('${visit.id}')).visit.version`)).toBe(visit.version + 1);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => inApp<number>(page, `async (r) => (await r.visits.get('${visit.id}')).visit.version`)).toBe(visit.version + 2);
    expect(await inApp<string>(page, `async (r) => (await r.visits.get('${visit.id}')).visit.plannedDate`)).toBe(visit.date);
    expectVersioned(sent);
  });
});
