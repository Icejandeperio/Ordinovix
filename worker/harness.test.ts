import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openLocalBindings, type LocalBindings } from './harness';

let env: LocalBindings;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ env, dispose } = await openLocalBindings());
}, 60_000);

afterAll(async () => {
  await dispose?.();
});

describe('local D1 and R2 through getPlatformProxy()', () => {
  it('runs SQL on a local D1 and reads the rows back', async () => {
    await env.DB.exec('CREATE TABLE IF NOT EXISTS harness_probe (id INTEGER PRIMARY KEY, label TEXT NOT NULL)');
    await env.DB.prepare('INSERT INTO harness_probe (id, label) VALUES (?, ?)').bind(1, 'first').run();
    const row = await env.DB.prepare('SELECT label FROM harness_probe WHERE id = ?').bind(1).first<{ label: string }>();
    expect(row?.label).toBe('first');
    const batch = await env.DB.batch([
      env.DB.prepare('INSERT INTO harness_probe (id, label) VALUES (?, ?)').bind(2, 'second'),
      env.DB.prepare('SELECT COUNT(*) AS n FROM harness_probe'),
    ]);
    expect((batch[1].results[0] as { n: number }).n).toBe(2);
  });

  it('stores and reads an object in a local R2 bucket', async () => {
    await env.FILES.put('probe/hello.txt', 'hello');
    const object = await env.FILES.get('probe/hello.txt');
    expect(await object?.text()).toBe('hello');
    await env.FILES.delete('probe/hello.txt');
    expect(await env.FILES.get('probe/hello.txt')).toBeNull();
  });

  it('is the local environment, and in memory (no state shared with other test files)', async () => {
    expect(env.APP_ENV).toBe('local');
    const second = await openLocalBindings();
    try {
      const tables = await second.env.DB.prepare("SELECT name FROM sqlite_master WHERE name = 'harness_probe'").all();
      expect(tables.results).toHaveLength(0);
    } finally {
      await second.dispose();
    }
  }, 60_000);
});
