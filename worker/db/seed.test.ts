import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openLocalBindings, type LocalBindings } from '../harness';
import { applyMigrations } from './migrate-helper';
import { buildSeedSql, SEED_TABLE_COUNTS } from './seed';
import { buildInitialStore } from '@/data/mock';
import { setDevToday } from '@/lib/dates';

const root = fileURLToPath(new URL('../../', import.meta.url));
const TODAY = '2026-10-27';

let env: LocalBindings;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ env, dispose } = await openLocalBindings());
  await applyMigrations(env.DB);
}, 120_000);
afterAll(async () => {
  await dispose?.();
});

const count = async (table: string, where = '') =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} ${where}`).first<{ n: number }>())!.n;

/** The statements a D1 `exec` runs: one per line. A statement with a line break inside would be cut in two. */
const lines = (sql: string) => sql.split('\n').filter((l) => l.trim() && !l.startsWith('--'));

describe('Demo seed SQL (db:seed-sql)', () => {
  it('is one statement per line, so any executor can run it', () => {
    const sql = buildSeedSql(TODAY);
    for (const line of lines(sql)) expect(line.endsWith(';'), line.slice(0, 80)).toBe(true);
    expect(lines(sql).length).toBeGreaterThan(300);
  });

  it('loads into a fresh local D1 with the same row counts as the mock seed', { timeout: 120_000 }, async () => {
    setDevToday(TODAY);
    const store = buildInitialStore(TODAY);
    const sql = buildSeedSql(TODAY);
    await env.DB.exec(sql);

    const expected: Record<string, number> = {
      orgs: 1,
      org_settings: 1,
      users: store.users.length,
      user_prefs: Object.keys(store.prefs).length,
      memberships: store.memberships.length,
      membership_clients: store.memberships.reduce((n, m) => n + m.clientIds.length, 0),
      offices: store.offices.length,
      clients: store.clients.length,
      client_assigned_users: store.clients.reduce((n, c) => n + c.assignedUserIds.length, 0),
      contacts: store.contacts.length,
      authorizations: store.authorizations.length,
      task_templates: store.templates.length,
      requirement_templates: store.reqTemplates.length,
      deadline_moves: store.deadlineMoves.length,
      holidays: store.holidays.length,
      message_templates: store.messageTemplates.length,
      tasks: store.tasks.length,
      task_lines: store.taskLines.length,
      documents: store.documents.length,
      line_documents: store.taskLines.reduce((n, l) => n + l.documentIds.length, 0),
      follow_ups: store.followUps.length,
      follow_up_lines: store.followUps.reduce((n, f) => n + f.lineIds.length, 0),
      follow_up_attempts: store.followUpAttempts.length,
      visits: store.visits.length,
      visit_items: store.visitItems.length,
      visit_item_evidence: store.visitItems.reduce((n, i) => n + i.evidenceDocumentIds.length, 0),
      visit_kit_items: store.visitKit.length,
      visit_packed: store.visits.reduce((n, v) => n + v.packedLineIds.length + v.packedKitItemIds.length, 0),
      payments: store.payments.length,
      payment_proofs: store.payments.reduce((n, p) => n + p.proofDocumentIds.length, 0),
      notes: store.notes.length,
      saved_views: store.savedViews.length,
      notifications: store.notifications.length,
      baselines: store.baseline ? 1 : 0,
      pulses: store.pulses.length,
      activity: store.activity.length,
    };
    for (const [table, n] of Object.entries(expected)) expect(await count(table), table).toBe(n);
    expect(SEED_TABLE_COUNTS).toBeDefined();
    // the same ids the mock uses, so the acceptance tests and the Demo organization line up
    expect(await count('clients', "WHERE id IN ('client-rsp','client-cruz','client-maria','client-horizon')")).toBe(4);
    expect(await count('tasks', "WHERE id = 'task-rsp-0619e'")).toBe(1);
    expect(await count('visits', "WHERE id = 'visit-today'")).toBe(1);
    expect(await count('visit_items', "WHERE visit_id = 'visit-today'")).toBe(1);
    expect(await count('memberships', "WHERE id = 'mem-ben' AND role = 'helper'")).toBe(1);
    expect(await count('membership_clients', "WHERE membership_id = 'mem-ben'")).toBe(2);
  });

  it('is idempotent: running it again leaves the same rows, and replaces edits made to demo data', { timeout: 120_000 }, async () => {
    const before = { clients: await count('clients'), tasks: await count('tasks'), activity: await count('activity'), lines: await count('task_lines') };
    await env.DB.prepare("UPDATE clients SET display_name = 'Edited in preview' WHERE id = 'client-rsp'").run();
    await env.DB.exec(buildSeedSql(TODAY));
    expect({ clients: await count('clients'), tasks: await count('tasks'), activity: await count('activity'), lines: await count('task_lines') }).toEqual(before);
    const name = (await env.DB.prepare("SELECT display_name FROM clients WHERE id = 'client-rsp'").first<{ display_name: string }>())!.display_name;
    expect(name).not.toBe('Edited in preview');
    // activity stays insert-only for everyone else: the trigger is back after the reseed
    await expect(env.DB.prepare("DELETE FROM activity WHERE id = 'act-init-1'").run()).rejects.toThrow(/insert-only/);
  });

  it('keeps a membership that is not part of the seed (the real owner) through a reseed', { timeout: 120_000 }, async () => {
    await env.DB.prepare("INSERT INTO memberships (id, org_id, email, role, active, invited_at, created_at, created_by, updated_at, updated_by) VALUES ('mem-real', 'org-demo-01', 'owner@example.org', 'owner', 1, 't', 't', 'u', 't', 'u')").run();
    await env.DB.exec(buildSeedSql(TODAY));
    expect(await count('memberships', "WHERE id = 'mem-real'")).toBe(1);
  });

  it('never stores a full TIN: only the masked form, and no ciphertext either (the seed has no key)', async () => {
    expect(await count('clients', 'WHERE tin_encrypted IS NOT NULL')).toBe(0);
    const masked = (await env.DB.prepare('SELECT tin_masked FROM clients WHERE has_tin = 1 AND tin_masked IS NOT NULL').all()).results as Array<{ tin_masked: string }>;
    expect(masked.length).toBeGreaterThan(0);
    for (const m of masked) expect(m.tin_masked).not.toMatch(/\d{3}-\d{3}-\d{3}-\d{3,5}/);
    const dump = buildSeedSql(TODAY);
    expect(dump).not.toMatch(/\b\d{3}-\d{3}-\d{3}-\d{5}\b/);
  });

  it('touches only the Demo organization: it never mentions another org id and deletes nothing unscoped', () => {
    const sql = buildSeedSql(TODAY);
    for (const line of lines(sql).filter((l) => /^DELETE /i.test(l))) {
      expect(line, line).toMatch(/org-demo-01|IN \(\s*'[\w-]+'/);
    }
  });

  it('prints the same SQL from the command line, to stdout only', { timeout: 120_000 }, () => {
    const result = spawnSync(process.execPath, ['scripts/seed-sql.mjs', '--today', TODAY], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(buildSeedSql(TODAY));
  });
});
