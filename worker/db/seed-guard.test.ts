import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openLocalBindings, type LocalBindings } from '../harness';
import { applyMigrations } from './migrate-helper';
import { buildSeedSql } from './seed';

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

const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
const deletes = (sql: string) => sql.split('\n').filter((l) => /^DELETE /i.test(l));

describe('U23 verifier: the seed deletes only fire for an organization flagged is_demo', () => {
  it('leaves every row alone when the organization is not flagged as the demo', { timeout: 120_000 }, async () => {
    const sql = buildSeedSql(TODAY);
    await env.DB.exec(sql);
    await env.DB.prepare("UPDATE orgs SET is_demo = 0 WHERE id = 'org-demo-01'").run();
    const before = { clients: await count('clients'), tasks: await count('tasks'), activity: await count('activity'), memberships: await count('memberships'), users: await count('users'), settings: await count('org_settings') };
    for (const line of deletes(sql)) await env.DB.exec(line);
    expect({ clients: await count('clients'), tasks: await count('tasks'), activity: await count('activity'), memberships: await count('memberships'), users: await count('users'), settings: await count('org_settings') }).toEqual(before);
  });

  it('control: the same deletes without the guard do remove rows (the test above can fail)', { timeout: 120_000 }, async () => {
    const sql = buildSeedSql(TODAY);
    const unguarded = deletes(sql).map((l) => l.replace(/ AND EXISTS \(SELECT 1 FROM orgs WHERE id = 'org-demo-01' AND is_demo = 1\);$/, ';')).filter((l) => !/DELETE FROM activity/.test(l));
    expect(unguarded.some((l, i) => l !== deletes(sql).filter((x) => !/DELETE FROM activity/.test(x))[i])).toBe(true);
    for (const line of unguarded) await env.DB.exec(line);
    expect(await count('clients')).toBe(0);
  });
});
