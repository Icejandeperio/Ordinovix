import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import worker, { CRON } from '../index';
import { openWorld, type World } from '../testing/world';

/** U29: the cron triggers in wrangler.jsonc and the Worker's scheduled handler agree, and each cron runs its own job. */
// a job loads the whole organization and runs the shared read side per person: give it room when the machine is busy
vi.setConfig({ testTimeout: 60_000 });

let world: World;
beforeAll(async () => {
  world = await openWorld();
}, 120_000);
afterAll(async () => {
  await world?.dispose();
});

const config = JSON.parse(
  readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'),
);

async function fire(cron: string) {
  const pending: Promise<unknown>[] = [];
  await worker.scheduled({ cron, scheduledTime: Date.now(), type: 'scheduled', noRetry() {} } as never, world.env, { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} } as never);
  await Promise.all(pending);
}

describe('cron triggers', () => {
  it('are the three the plan names, in every environment: clean-up 03:00, digest 07:00 and visit check 17:00 Manila', () => {
    expect(CRON).toEqual({ retention: '0 19 * * *', morning: '0 23 * * *', evening: '0 9 * * *' });
    for (const scope of [config, config.env.preview, config.env.production]) {
      expect([...scope.triggers.crons].sort()).toEqual(Object.values(CRON).sort());
    }
  });

  it('the morning cron writes the digests; the retention cron purges old idempotency keys; an unknown cron does nothing', async () => {
    await world.env.DB.prepare("DELETE FROM notifications WHERE created_by = 'system'").run();
    await fire(CRON.morning);
    expect((await world.env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE type = 'daily_digest' AND created_by = 'system'").first<{ n: number }>())!.n).toBeGreaterThan(0);

    await world.env.DB.prepare("INSERT INTO idempotency_keys (org_id, user_id, key, method, path, status, response_json, created_at) VALUES ('org-demo-01', 'user-ana', 'ancient-key-1', 'POST', '/x', 200, '{}', '2020-01-01T00:00:00.000Z')").run();
    await fire(CRON.retention);
    expect((await world.env.DB.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE key = 'ancient-key-1'").first<{ n: number }>())!.n).toBe(0);

    const before = (await world.env.DB.prepare('SELECT COUNT(*) AS n FROM notifications').first<{ n: number }>())!.n;
    await fire('* * * * *');
    expect((await world.env.DB.prepare('SELECT COUNT(*) AS n FROM notifications').first<{ n: number }>())!.n).toBe(before);
  });
});
