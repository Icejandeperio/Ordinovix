import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLocalBindings, type LocalBindings } from '../harness';
import { applyMigrations, migrationStatements } from './migrate-helper';

const root = fileURLToPath(new URL('../../', import.meta.url));

let env: LocalBindings;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ env, dispose } = await openLocalBindings());
  await applyMigrations(env.DB);
}, 120_000);
afterAll(async () => {
  await dispose?.();
});

const names = async (type: string) =>
  ((await env.DB.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').bind(type).all()).results as Array<{ name: string }>).map((r) => r.name);

describe('migrations/ applied to a fresh local D1', () => {
  it('are generated files in order (0000, 0001, ...) and none is empty', () => {
    const files = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
    expect(files.length).toBeGreaterThanOrEqual(1);
    files.forEach((f, i) => expect(f.startsWith(String(i).padStart(4, '0'))).toBe(true));
    expect(migrationStatements().length).toBeGreaterThan(40);
  });

  it('create every table of the draft, the Better Auth tables and the bookkeeping table', async () => {
    const have = await names('table');
    const draft = [...readFileSync(join(root, 'docs/backend/schema-draft.sql'), 'utf8').matchAll(/CREATE TABLE (\w+) \(/g)].map((m) => m[1]);
    for (const t of [...draft, 'user', 'session', 'account', 'verification']) expect(have, t).toContain(t);
  });

  it('create every index the draft names, and the partial unique index on open tasks', async () => {
    const have = await names('index');
    const draft = [...readFileSync(join(root, 'docs/backend/schema-draft.sql'), 'utf8').matchAll(/CREATE (?:UNIQUE )?INDEX (\w+) ON/g)].map((m) => m[1]);
    for (const i of draft) expect(have, i).toContain(i);
    const sql = (await env.DB.prepare("SELECT sql FROM sqlite_master WHERE name = 'idx_tasks_open_period'").first<{ sql: string }>())!.sql;
    expect(sql).toMatch(/WHERE/i);
  });

  it('create the full-text search table and the insert-only triggers on activity', async () => {
    expect(await names('table')).toContain('search_index');
    expect(await names('trigger')).toEqual(expect.arrayContaining(['activity_no_update', 'activity_no_delete']));
    await env.DB.prepare("INSERT INTO search_index (org_id, entity, entity_id, client_id, body) VALUES ('o','client','c1','c1','Rivera Salonga and Partners')").run();
    const hit = await env.DB.prepare("SELECT entity_id FROM search_index WHERE search_index MATCH 'salonga'").all();
    expect(hit.results).toHaveLength(1);
  });

  it('keep activity insert-only: an update or a delete is refused', async () => {
    await env.DB.prepare("INSERT INTO orgs (id, name, is_demo, created_at) VALUES ('org-t', 'T', 0, '2026-10-28T00:00:00+08:00')").run();
    await env.DB.prepare("INSERT INTO activity (id, org_id, at, actor_id, entity, entity_id, action, summary) VALUES ('a1','org-t','2026-10-28T00:00:00+08:00','u','client','c','created','x')").run();
    await expect(env.DB.prepare("UPDATE activity SET summary = 'y' WHERE id = 'a1'").run()).rejects.toThrow(/insert-only/);
    await expect(env.DB.prepare("DELETE FROM activity WHERE id = 'a1'").run()).rejects.toThrow(/insert-only/);
  });

  it('enforce enums and rules in the database: a bad enum value, and one open task per client, template and period', async () => {
    const stamp = "'t', 'u', 't', 'u'";
    await env.DB.prepare("INSERT OR IGNORE INTO orgs (id, name, is_demo, created_at) VALUES ('org-t', 'T', 0, '2026-10-28T00:00:00+08:00')").run();
    await env.DB.prepare("INSERT INTO users (id, name, email, initials) VALUES ('u', 'U', 'u@example.com', 'U')").run();
    await env.DB.prepare(
      `INSERT INTO task_templates (id, org_id, code, name, kind, frequency, created_at, created_by, updated_at, updated_by) VALUES ('tmpl-x', 'org-t', 'X', 'X', 'filing', 'monthly', ${stamp})`,
    ).run();
    const client = (id: string, entityType: string) =>
      env.DB.prepare(
        `INSERT INTO clients (id, org_id, code, display_name, entity_type, rdo_code, vat_status, size_class, access_holder, created_at, created_by, updated_at, updated_by) VALUES (?, 'org-t', ?, 'C', ?, '039', 'vat', 'micro', 'client', ${stamp})`,
      ).bind(id, id, entityType);
    await client('c1', 'gpp').run();
    await expect(client('c2', 'not-a-type').run()).rejects.toThrow(/CHECK/i);

    const task = (id: string, templateId: string | null) =>
      env.DB.prepare(
        `INSERT INTO tasks (id, org_id, client_id, template_id, kind, period, due_date, due_source_kind, owner_user_id, status, created_at, created_by, updated_at, updated_by) VALUES (?, 'org-t', 'c1', ?, 'filing', '2026-09', '2026-10-10', 'manual', 'u', 'not_started', ${stamp})`,
      ).bind(id, templateId);
    // without a template the open-period rule does not apply, so two manual tasks for one period are fine
    await task('t1', null).run();
    await task('t2', null).run();
    await task('t3', 'tmpl-x').run();
    await expect(task('t4', 'tmpl-x').run()).rejects.toThrow(/UNIQUE/i);
    // a finished task no longer blocks the period (history keeps one completed task per run), nor does a soft-deleted one
    await env.DB.prepare("UPDATE tasks SET status = 'completed' WHERE id = 't3'").run();
    await task('t6', 'tmpl-x').run();
    await expect(task('t7', 'tmpl-x').run()).rejects.toThrow(/UNIQUE/i);
    await env.DB.prepare("UPDATE tasks SET deleted_at = 't', deleted_reason = 'test' WHERE id = 't6'").run();
    await task('t5', 'tmpl-x').run();
  });

  it('refuse a verified template without a source reference (a requirement never shown as verified unsourced)', async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO task_templates (id, org_id, code, name, kind, frequency, verified, created_at, created_by, updated_at, updated_by) VALUES ('tmpl-v', 'org-t', 'V', 'V', 'filing', 'monthly', 1, 't', 'u', 't', 'u')",
      ).run(),
    ).rejects.toThrow(/CHECK/i);
  });
});

describe('wrangler applies the migrations to a fresh local database', () => {
  let state: string;
  beforeAll(() => {
    state = mkdtempSync(join(tmpdir(), 'ox-d1-'));
  });
  afterAll(() => rmSync(state, { recursive: true, force: true }));

  it('npx wrangler d1 migrations apply DB --local succeeds and lists nothing left to apply', { timeout: 180_000 }, () => {
    const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [wrangler, 'd1', 'migrations', ...args, 'DB', '--local', '--persist-to', state], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1', NO_COLOR: '1' },
      });
    const applied = run('apply');
    expect(applied.stderr + applied.stdout).not.toMatch(/error/i);
    expect(applied.status).toBe(0);
    const listed = run('list');
    expect(listed.status).toBe(0);
    expect(listed.stdout).toMatch(/No migrations to apply/i);
    expect(existsSync(state)).toBe(true);
  });
});
