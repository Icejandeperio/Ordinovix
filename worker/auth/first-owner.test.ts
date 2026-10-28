import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openWorld, type World } from '../testing/world';

const script = fileURLToPath(new URL('../../scripts/first-owner-sql.mjs', import.meta.url));
const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

let world: World | undefined;
afterEach(async () => {
  await world?.dispose();
  world = undefined;
});

describe('npm run db:first-owner-sql -- --email <address>', () => {
  it('prints SQL that makes that Google account an owner of the Demo organization, who then gets in', { timeout: 120_000 }, async () => {
    world = await openWorld();
    const result = run('--email', 'Owner@Example.org', '--now', '2026-10-28T09:00:00+08:00');
    expect(result.status, result.stderr).toBe(0);
    await world.env.DB.exec(result.stdout);

    const row = await world.env.DB.prepare("SELECT role, active, user_id, org_id FROM memberships WHERE email = 'owner@example.org'").first<any>();
    expect(row).toMatchObject({ role: 'owner', active: 1, user_id: null, org_id: 'org-demo-01' });
    expect((await world.env.DB.prepare("SELECT COUNT(*) AS n FROM activity WHERE action = 'access_granted' AND summary LIKE '%owner@example.org%'").first<any>()).n).toBe(1);

    // the person signs in with Google (their email is verified) and is linked on the first request
    const res = await world.request('/api/v1/session/me', { cookie: await world.cookieFor({ id: 'ba-first-owner', name: 'First Owner', email: 'owner@example.org' }) });
    expect(res.status).toBe(200);
    const me = (await res.json()) as any;
    expect(me.membership).toMatchObject({ role: 'owner', userId: 'ba-first-owner', orgId: 'org-demo-01' });
    expect(me.org.isDemo).toBe(true);
  });

  it('is safe to run again, and restores an owner entry that was revoked', { timeout: 120_000 }, async () => {
    world = await openWorld();
    const sql = run('--email', 'owner@example.org', '--now', '2026-10-28T09:00:00+08:00').stdout;
    await world.env.DB.exec(sql);
    await world.env.DB.prepare("UPDATE memberships SET active = 0, revoked_at = 't' WHERE email = 'owner@example.org'").run();
    await world.env.DB.exec(sql);
    const row = await world.env.DB.prepare("SELECT active, revoked_at FROM memberships WHERE email = 'owner@example.org'").first<any>();
    expect(row).toMatchObject({ active: 1, revoked_at: null });
    expect((await world.env.DB.prepare("SELECT COUNT(*) AS n FROM memberships WHERE email = 'owner@example.org'").first<any>()).n).toBe(1);
  });

  it('creates a new, non-demo organization with its settings when asked (production)', { timeout: 120_000 }, async () => {
    world = await openWorld({ seed: false });
    const result = run('--email', 'owner@example.org', '--org', 'org-live', '--org-name', "Santos & O'Brien Tax", '--now', '2026-10-28T09:00:00+08:00');
    expect(result.status, result.stderr).toBe(0);
    await world.env.DB.exec(result.stdout);
    expect(await world.env.DB.prepare("SELECT name, is_demo FROM orgs WHERE id = 'org-live'").first<any>()).toEqual({ name: "Santos & O'Brien Tax", is_demo: 0 });
    expect((await world.env.DB.prepare("SELECT COUNT(*) AS n FROM org_settings WHERE org_id = 'org-live'").first<any>()).n).toBe(1);
    const res = await world.request('/api/v1/session/me', { cookie: await world.cookieFor({ id: 'ba-live-owner', name: 'Live Owner', email: 'owner@example.org' }) });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).org).toMatchObject({ id: 'org-live', isDemo: false });
  });

  it('prints one statement per line, no comments, nothing but SQL', () => {
    const out = run('--email', 'owner@example.org').stdout;
    for (const line of out.split('\n').filter(Boolean)) expect(line).toMatch(/^(INSERT) .*;$/);
  });

  it('refuses a missing, malformed or hostile email and prints nothing', () => {
    for (const args of [[], ['--email', 'not-an-email'], ['--email', "o'brien@example.org"], ['--email', "a@b.co'); DROP TABLE memberships;--"], ['--email', 'a b@example.org']]) {
      const result = run(...args);
      expect(result.status, args.join(' ')).not.toBe(0);
      expect(result.stdout).toBe('');
    }
    expect(run('--email', 'owner@example.org', '--org', "x'; DROP TABLE orgs;--").status).not.toBe(0);
  });
});
