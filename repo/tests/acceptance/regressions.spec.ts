/**
 * Ordinovix — regression acceptance tests from the QA audit of 2026-10-27.
 *
 * Each test encodes one confirmed bug (IDs match QA_AUDIT_2026-10-27.md).
 * Every test FAILS on commit 34fd1c5 and must PASS once the bug is fixed.
 * Read-only to the Builder (AGENTS.md rule 3): fix the app, never the test.
 *
 * Mock phase: tests marked [contract] call the Repositories interface through the
 * Vite dev server (`/src/data/index.ts`). When the API implementation lands, the same
 * assertions move to API tests that call the Worker as Ben and as Ana.
 */
import { test, expect, type Page } from '@playwright/test';

type Persona = 'owner' | 'helper';

async function as(page: Page, persona: Persona) {
  await page.addInitScript((p) => {
    try { localStorage.setItem('ox-mock-persona', p); localStorage.setItem('ox-mock-failure-rate', '0'); } catch { /* storage unavailable */ }
  }, persona);
}

/** Run a function against the live Repositories instance the app is using. */
async function repo<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(async (body) => {
    // Built at runtime so the test transpiler never rewrites this dynamic import.
    const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
    const mod = await load('/src/data/index.ts');
    const run = new Function('R', 'D', `return (async () => { ${body} })();`);
    return run(mod.repositories, mod.devControls);
  }, fn) as Promise<T>;
}

/** Repo call that should be refused; returns 'REJECTED' or 'ALLOWED'. */
async function attempt(page: Page, call: string): Promise<'REJECTED' | 'ALLOWED'> {
  return repo(page, `try { await ${call}; return 'ALLOWED'; } catch (e) { return 'REJECTED'; }`);
}

const notFoundText = /page not found|doesn.t exist/i;

async function acceptRspLineAndStartTrip(page: Page) {
  await page.goto('/tasks/task-rsp-0619e');
  await page.getByRole('button', { name: 'Stamp Accept' }).first().click();
  await expect(page.locator('main')).toContainText(/in preparation/i);
  await page.goto('/visits/visit-today');
  await page.getByRole('button', { name: /start trip/i }).first().click();
  await expect(page).toHaveURL(/\/visits\/visit-today\/record$/);
  await expect(page.locator('main')).toContainText(/what happened at the counter/i);
}

test.describe('Visits — the signature flow', () => {
  test('B01 Record page survives a browser reload (Rules of Hooks crash)', async ({ page }) => {
    await as(page, 'owner');
    const hookErrors: string[] = [];
    page.on('console', (m) => { if (/rendered more hooks|order of hooks/i.test(m.text())) hookErrors.push(m.text()); });
    await acceptRspLineAndStartTrip(page);
    await page.reload();
    await expect(page.locator('main')).toContainText(/what happened at the counter/i, { timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(notFoundText);
    expect(hookErrors, 'React hook-order errors').toEqual([]);
  });

  test('B01 Summary page opens on a direct load (Rules of Hooks crash)', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/visits/visit-today/summary');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toContainText(notFoundText);
  });

  test('B02 Finish visit stays disabled until every outcome is saved', async ({ page }) => {
    await as(page, 'owner');
    await acceptRspLineAndStartTrip(page);
    await page.getByText('Not accepted', { exact: true }).first().click(); // selected, NOT saved
    const finish = page.locator('main button').filter({ hasText: /finish visit/i }).first();
    await expect(finish).toBeDisabled();
  });

  test('B03 Unknown visit shows a not-found message, not a blank page', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/visits/does-not-exist');
    await expect(page.locator('main')).toContainText(/not found|doesn.t exist|no access/i, { timeout: 10_000 });
  });
});

test.describe('Core rules', () => {
  test('B04 [contract] A blocked task cannot be completed without an override reason', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    const before = await repo<string>(page, `return (await R.tasks.get('task-cruz-1601c')).summary.displayedStatus;`);
    expect(before).toBe('waiting_on_client');
    expect(await attempt(page, `R.tasks.setStatus('task-cruz-1601c', 'completed')`)).toBe('REJECTED');
  });

  test('B05 [contract] An uploaded file still opens after a reload', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    const id = await repo<string>(page, `
      const blob = new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: 'image/png' });
      const doc = await R.documents.upload(
        { clientId: 'client-rsp', taskId: 'task-rsp-0619e', kind: 'other', source: 'upload' },
        blob, undefined, { originalName: 'qa.png', originalSizeBytes: 8, sha256: 'qa' });
      return doc.id;`);
    await page.reload();
    const status = await repo<string>(page, `
      const url = await R.documents.getUrl('${id}', 'view');
      try { const r = await fetch(url); return r.ok ? 'ok' : 'http ' + r.status; } catch (e) { return 'dead'; }`);
    expect(status).toBe('ok');
  });
});

test.describe('Settings and facades', () => {
  test('B06 Settings → Practice: a saved change survives a reload', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/settings/practice');
    const field = page.locator('main input').first();
    await expect(field).toHaveValue(/.+/);
    await field.fill('QA Renamed Practice');
    await page.locator('main button').filter({ hasText: /save changes/i }).first().click();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.locator('main input').first()).toHaveValue('QA Renamed Practice', { timeout: 10_000 });
  });

  test('B07 Settings → Task templates lists the repository templates, with their real verification state', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    const templates = await repo<{ code: string; verified: boolean }[]>(page,
      `return (await R.templates.list()).map(t => ({ code: t.code, verified: t.verified }));`);
    await page.goto('/settings/templates');
    const main = page.locator('main');
    for (const t of templates) await expect(main).toContainText(t.code);
    // No hard-coded legal references that the repository does not hold
    await expect(main).not.toContainText('NIRC Sec. 58 / RR 2-98');
    await expect(main).not.toContainText('BOOK-STAMP');
  });

  test('B08 Audit log shows real activity (TIN reveal appears)', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    await repo(page, `await R.clients.revealTin('client-horizon'); return true;`);
    await page.goto('/audit');
    await expect(page.locator('main')).toContainText(/Horizon/, { timeout: 10_000 });
  });

  test('B09 Notification links open existing records', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    const broken = await repo<string[]>(page, `
      const items = (await R.notifications.list()).items;
      const bad = [];
      for (const n of items) {
        const m = n.link.match(/^\\/(tasks|visits|clients)\\/([^/?#]+)/);
        if (!m) continue;
        try {
          if (m[1] === 'tasks') await R.tasks.get(m[2]);
          if (m[1] === 'visits') await R.visits.get(m[2]);
          if (m[1] === 'clients') await R.clients.get(m[2]);
        } catch (e) { bad.push(n.link); }
      }
      return bad;`);
    expect(broken).toEqual([]);
  });
});

test.describe('Helper scoping (Ben is assigned RSP and Cruz only)', () => {
  test('B10 Helper opening an unassigned client sees a no-access message', async ({ page }) => {
    await as(page, 'helper');
    await page.goto('/clients/client-maria');
    await expect(page.locator('main')).toContainText(/access|not found/i, { timeout: 10_000 });
  });

  test('B11 [contract] Helper cannot act on unassigned clients or owner-only data', async ({ page }) => {
    await as(page, 'helper');
    await page.goto('/');
    const results = {
      changeDue: await attempt(page, `R.tasks.changeDue('task-maria-2550q', '2026-12-31', 'RMC X', 'helper test reason')`),
      archiveClient: await attempt(page, `R.clients.archive('client-maria', 'helper test reason')`),
      revealTin: await attempt(page, `R.clients.revealTin('client-maria')`),
      editTemplate: await attempt(page, `R.templates.save({ id: 'tmpl-0619e', name: 'x' }, [])`),
      fullBackup: await attempt(page, `R.reports.fullBackup()`),
    };
    expect(results).toEqual({
      changeDue: 'REJECTED', archiveClient: 'REJECTED', revealTin: 'REJECTED',
      editTemplate: 'REJECTED', fullBackup: 'REJECTED',
    });
  });
});

test.describe('Dev tools', () => {
  test('B12 Dev menu "set today" survives the reload it triggers', async ({ page }) => {
    await as(page, 'owner');
    await page.goto('/');
    await repo(page, `D.setToday('2026-11-03'); return true;`).catch(() => undefined); // triggers a reload
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
    const today = await page.evaluate(async () => {
      const load = new Function('p', 'return import(p)') as (p: string) => Promise<any>;
      return (await load('/src/lib/dates.ts')).todayInManila();
    });
    expect(today).toBe('2026-11-03');
  });
});
