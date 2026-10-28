import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONAS, openWorld, type World } from '../testing/world';
import { decryptTin } from '../lib/tin';
import { TEST_SECRETS } from '../testing/world';

/**
 * U26: what every write route guarantees, shown on clients, tasks and contacts: an Idempotency-Key, an If-Match version on
 * updates, the change and its activity row in one batch, strict bodies, and full TINs encrypted and never echoed.
 */
let world: World;
const cookie: Record<string, string> = {};
let n = 0;

beforeAll(async () => {
  world = await openWorld();
  cookie.owner = await world.cookieFor(PERSONAS.owner);
  cookie.helper = await world.cookieFor(PERSONAS.helper);
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

interface Sent {
  status: number;
  body: any;
  headers: Headers;
}
async function send(who: 'owner' | 'helper', method: string, path: string, body?: unknown, opts: { key?: string | null; ifMatch?: number | string } = {}): Promise<Sent> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.key !== null) headers['Idempotency-Key'] = opts.key ?? `test-key-${++n}-${crypto.randomUUID()}`;
  if (opts.ifMatch !== undefined) headers['If-Match'] = `"${opts.ifMatch}"`;
  const res = await world.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cookie: cookie[who] });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

const count = async (sql: string, ...bind: unknown[]) => (await world.env.DB.prepare(sql).bind(...bind).first<{ n: number }>())!.n;
const newClient = (extra: Record<string, unknown> = {}) => ({ code: `T${++n}`.slice(0, 6).toUpperCase(), displayName: `Test Client ${n}`, entityType: 'solo', rdoCode: '039', ...extra });

describe('Idempotency-Key', () => {
  it('is required on a write', async () => {
    const res = await send('owner', 'POST', '/api/v1/clients', newClient(), { key: null });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toContain('Idempotency-Key');
  });

  it('a repeated key returns the first response and applies nothing', async () => {
    const key = 'repeat-key-0001';
    const body = newClient();
    const first = await send('owner', 'POST', '/api/v1/clients', body, { key });
    expect(first.status).toBe(201);
    const clients = await count('SELECT COUNT(*) AS n FROM clients');
    const activity = await count('SELECT COUNT(*) AS n FROM activity');
    const again = await send('owner', 'POST', '/api/v1/clients', body, { key });
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(again.headers.get('Idempotent-Replay')).toBe('true');
    expect(await count('SELECT COUNT(*) AS n FROM clients')).toBe(clients);
    expect(await count('SELECT COUNT(*) AS n FROM activity')).toBe(activity);
  });

  it('a key reused for a different request is refused', async () => {
    const key = 'reused-key-0002';
    expect((await send('owner', 'POST', '/api/v1/clients', newClient(), { key })).status).toBe(201);
    const other = await send('owner', 'POST', '/api/v1/contacts', { clientId: 'client-rsp', name: 'Pat Reyes', phoneE164: '+639171234567' }, { key });
    expect(other.status).toBe(422);
  });

  it('is kept for 7 days: an older key is treated as new', async () => {
    const key = 'old-key-000003';
    const first = await send('owner', 'POST', '/api/v1/clients', newClient(), { key });
    await world.env.DB.prepare("UPDATE idempotency_keys SET created_at = '2026-01-01T00:00:00.000Z' WHERE key = ?").bind(key).run();
    const again = await send('owner', 'POST', '/api/v1/clients', newClient(), { key });
    expect(again.status).toBe(201);
    expect(again.body.id).not.toBe(first.body.id);
  });

  it('a read-only POST (duplicate check) needs no key', async () => {
    const res = await send('owner', 'POST', '/api/v1/clients/duplicates', { code: 'RSP' }, { key: null });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('If-Match version on updates', () => {
  it('is required to update', async () => {
    const res = await send('owner', 'PATCH', '/api/v1/clients/client-maria', { displayName: 'Maria Co.' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toContain('If-Match');
  });

  it('a stale version is 409 VERSION_CONFLICT with the current record, and applies nothing', async () => {
    const created = await send('owner', 'POST', '/api/v1/clients', newClient());
    const id = created.body.id;
    const v1 = created.body.version;
    const saved = await send('owner', 'PATCH', `/api/v1/clients/${id}`, { displayName: 'Renamed once' }, { ifMatch: v1 });
    expect(saved.status).toBe(200);
    expect(saved.body.version).toBe(v1 + 1);
    const activity = await count('SELECT COUNT(*) AS n FROM activity');
    const stale = await send('owner', 'PATCH', `/api/v1/clients/${id}`, { displayName: 'Renamed twice' }, { ifMatch: v1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    expect(stale.body.error.current).toMatchObject({ id, displayName: 'Renamed once', version: v1 + 1 });
    expect(await count('SELECT COUNT(*) AS n FROM activity')).toBe(activity);
    const stored = await world.env.DB.prepare('SELECT display_name, version FROM clients WHERE id = ?').bind(id).first<any>();
    expect(stored).toEqual({ display_name: 'Renamed once', version: v1 + 1 });
  });

  it('a version that lands between our load and our write rolls the whole batch back', async () => {
    const created = await send('owner', 'POST', '/api/v1/clients', newClient());
    const id = created.body.id;
    // the guard statement is the first thing in the batch: simulate the other writer by changing the row after the load
    const real = world.env.DB;
    let bumped = false;
    const wrapped = new Proxy(real, {
      get(target, prop) {
        if (prop === 'batch') {
          return async (statements: D1PreparedStatement[]) => {
            if (!bumped) {
              bumped = true;
              await target.prepare('UPDATE clients SET version = version + 1, notes = ? WHERE id = ?').bind('written by someone else', id).run();
            }
            return target.batch(statements);
          };
        }
        const value = (target as any)[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const activity = await count('SELECT COUNT(*) AS n FROM activity');
    const res = await world.request(`/api/v1/clients/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'race-key-00001', 'If-Match': `"${created.body.version}"` },
      body: JSON.stringify({ displayName: 'Lost the race' }),
      cookie: cookie.owner,
      env: { DB: wrapped as D1Database },
    });
    expect(res.status).toBe(409);
    expect((await res.json() as any).error.code).toBe('VERSION_CONFLICT');
    const stored = await world.env.DB.prepare('SELECT display_name, notes FROM clients WHERE id = ?').bind(id).first<any>();
    expect(stored.display_name).not.toBe('Lost the race');
    expect(stored.notes).toBe('written by someone else');
    expect(await count('SELECT COUNT(*) AS n FROM activity')).toBe(activity);
    expect(await count("SELECT COUNT(*) AS n FROM idempotency_keys WHERE key = 'race-key-00001'")).toBe(0);
  });
});

describe('the change and its activity row are written together', () => {
  it('a create writes the row and one activity event naming it', async () => {
    const before = await count('SELECT COUNT(*) AS n FROM activity');
    const res = await send('owner', 'POST', '/api/v1/clients', newClient());
    expect(res.status).toBe(201);
    expect(await count('SELECT COUNT(*) AS n FROM activity')).toBe(before + 1);
    const row = await world.env.DB.prepare("SELECT action, entity, entity_id, client_id, actor_id FROM activity WHERE entity_id = ? ORDER BY rowid DESC").bind(res.body.id).first<any>();
    expect(row).toMatchObject({ action: 'created', entity: 'client', entity_id: res.body.id, actor_id: 'user-ana' });
  });

  it('a refused change leaves no row and no activity (the rule runs before anything is written)', async () => {
    const activity = await count('SELECT COUNT(*) AS n FROM activity');
    const keys = await count('SELECT COUNT(*) AS n FROM idempotency_keys');
    const res = await send('owner', 'POST', '/api/v1/tasks/task-rsp-0619e/status', { to: 'completed' });
    expect([409, 422]).toContain(res.status);
    expect(await count('SELECT COUNT(*) AS n FROM activity')).toBe(activity);
    expect(await count('SELECT COUNT(*) AS n FROM idempotency_keys')).toBe(keys); // a failed request can be retried with the same key
  });

  it('a task and its lines are created in one batch, with one activity event', async () => {
    const before = { tasks: await count('SELECT COUNT(*) AS n FROM tasks'), lines: await count('SELECT COUNT(*) AS n FROM task_lines'), activity: await count('SELECT COUNT(*) AS n FROM activity') };
    const res = await send('owner', 'POST', '/api/v1/tasks', {
      clientId: 'client-maria',
      title: 'One-off registration update',
      kind: 'registration',
      dueDate: '2026-11-20',
      lines: [
        { label: 'Signed form', required: true, copyForm: 'original', suppliedBy: 'client' },
        { label: 'Valid ID', required: true, copyForm: 'photocopy', suppliedBy: 'client' },
        { label: 'Fee receipt', required: false, copyForm: 'digital', suppliedBy: 'operator' },
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(await count('SELECT COUNT(*) AS n FROM tasks')).toBe(before.tasks + 1);
    expect(await count('SELECT COUNT(*) AS n FROM task_lines')).toBe(before.lines + 3);
    expect(await count('SELECT COUNT(*) AS n FROM activity')).toBe(before.activity + 1);
  });
});

describe('inserts stay under the bound-value limit of a D1 statement', () => {
  it('a task with 30 lines is written as multi-row inserts of at most 100 bound values each', async () => {
    const bound: number[] = [];
    const real = world.env.DB;
    const spy = new Proxy(real, {
      get(target, prop) {
        if (prop === 'prepare') {
          return (sql: string) => {
            const statement = target.prepare(sql);
            return new Proxy(statement, {
              get(st, p2) {
                if (p2 === 'bind') return (...values: unknown[]) => (bound.push(values.length), st.bind(...values));
                const v = (st as any)[p2];
                return typeof v === 'function' ? v.bind(st) : v;
              },
            });
          };
        }
        const v = (target as any)[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    const lines = Array.from({ length: 30 }, (_, i) => ({ label: `Requirement ${i + 1}`, required: true, copyForm: 'original', suppliedBy: 'client' }));
    const before = await count('SELECT COUNT(*) AS n FROM task_lines');
    const res = await world.request('/api/v1/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'chunk-key-00001' },
      body: JSON.stringify({ clientId: 'client-maria', title: 'Thirty lines', kind: 'other', dueDate: '2026-12-01', lines }),
      cookie: cookie.owner,
      env: { DB: spy as D1Database },
    });
    expect(res.status).toBe(201);
    expect(await count('SELECT COUNT(*) AS n FROM task_lines')).toBe(before + 30);
    expect(Math.max(...bound)).toBeLessThanOrEqual(100);
    expect(bound.filter((n) => n > 50).length).toBeGreaterThan(0); // the 30 line rows really were grouped into multi-row statements
  });
});

describe('bodies are strict', () => {
  it('rejects a field the route does not accept, naming it', async () => {
    const res = await send('owner', 'POST', '/api/v1/clients', { ...newClient(), orgId: 'org-other', version: 9, createdBy: 'x' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['createdBy', 'orgId', 'version']);
  });

  it('rejects text that is not JSON, and an array', async () => {
    const bad = await world.request('/api/v1/clients', { method: 'POST', headers: { 'Idempotency-Key': 'bad-json-0001', 'content-type': 'application/json' }, body: '{nope', cookie: cookie.owner });
    expect(bad.status).toBe(422);
    expect((await send('owner', 'POST', '/api/v1/clients', [1, 2])).status).toBe(422);
  });

  it('validates values with the shared schemas and reports each field', async () => {
    const res = await send('owner', 'POST', '/api/v1/clients', { code: 'x', displayName: 'a', entityType: 'solo', rdoCode: '039' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['displayName', 'code']));
  });

  it('cannot verify a template by saving it: verified and verifiedOn are not accepted', async () => {
    const res = await send('owner', 'PUT', '/api/v1/templates/tmpl-0619e', { verified: true, sourceRef: 'made up' }, { ifMatch: 1 });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toContain('verified');
  });
});

describe('full TINs: encrypted, masked everywhere else, never echoed', () => {
  it('stores ciphertext and a hash, returns the masked value, and writes no TIN to activity or the idempotency record', async () => {
    const tin = '987-654-321-00000';
    const res = await send('owner', 'POST', '/api/v1/clients', newClient({ tinFull: tin }));
    expect(res.status).toBe(201);
    expect(res.body.tinMasked).toBe('•••-•••-321-00000');
    expect(res.body.hasTin).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('987');
    const row = await world.env.DB.prepare('SELECT tin_masked, tin_encrypted, tin_hash FROM clients WHERE id = ?').bind(res.body.id).first<any>();
    expect(row.tin_masked).toBe('•••-•••-321-00000');
    expect(row.tin_encrypted).toBeTruthy();
    expect(row.tin_encrypted).not.toContain('987');
    expect(row.tin_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await decryptTin(TEST_SECRETS.TIN_ENCRYPTION_KEY, row.tin_encrypted)).toBe(tin);
    // nothing else holds the number
    for (const sql of ["SELECT group_concat(summary || ifnull(before_json, '') || ifnull(after_json, '')) AS t FROM activity", 'SELECT group_concat(response_json) AS t FROM idempotency_keys']) {
      const { t } = (await world.env.DB.prepare(sql).first<{ t: string }>())!;
      expect(t).not.toContain('987-654-321');
      expect(t).not.toContain('987654321');
    }
  });

  it('treats a TIN typed into tinMasked (what the form sends) as a full TIN, never storing it as the display value', async () => {
    const res = await send('owner', 'POST', '/api/v1/clients', newClient({ tinMasked: '111-222-333' }));
    expect(res.status).toBe(201);
    expect(res.body.tinMasked).toBe('•••-•••-333-00000');
    const row = await world.env.DB.prepare('SELECT tin_masked, tin_encrypted FROM clients WHERE id = ?').bind(res.body.id).first<any>();
    expect(row.tin_masked).toBe('•••-•••-333-00000');
    expect(row.tin_encrypted).toBeTruthy();
  });

  it('refuses text in tinMasked that is neither a TIN nor the masked form', async () => {
    const res = await send('owner', 'POST', '/api/v1/clients', newClient({ tinMasked: 'my cousin' }));
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toContain('tinMasked');
  });

  it('an update that sends no TIN leaves the ciphertext alone', async () => {
    const created = await send('owner', 'POST', '/api/v1/clients', newClient({ tinFull: '555-666-777-00000' }));
    const before = await world.env.DB.prepare('SELECT tin_encrypted, tin_hash FROM clients WHERE id = ?').bind(created.body.id).first<any>();
    const patched = await send('owner', 'PATCH', `/api/v1/clients/${created.body.id}`, { displayName: 'Same TIN' }, { ifMatch: created.body.version });
    expect(patched.status).toBe(200);
    expect(await world.env.DB.prepare('SELECT tin_encrypted, tin_hash FROM clients WHERE id = ?').bind(created.body.id).first()).toEqual(before);
  });

  it('reveal-tin decrypts for someone with access, logs an event without the value, and keeps the value out of the stored response', async () => {
    const created = await send('owner', 'POST', '/api/v1/clients', newClient({ tinFull: '321-654-987-00001' }));
    const id = created.body.id;
    const key = 'reveal-key-0001';
    const reveal = await send('owner', 'POST', `/api/v1/clients/${id}/reveal-tin`, undefined, { key });
    expect(reveal.status).toBe(200);
    expect(reveal.body).toEqual({ tin: '321-654-987-00001' });
    const event = await world.env.DB.prepare("SELECT summary, before_json, after_json FROM activity WHERE action = 'tin_revealed' AND entity_id = ?").bind(id).first<any>();
    expect(event).toBeTruthy();
    expect(JSON.stringify(event)).not.toContain('321-654');
    const kept = await world.env.DB.prepare('SELECT response_json FROM idempotency_keys WHERE key = ?').bind(key).first<any>();
    expect(kept.response_json).not.toContain('321');
    // a replay applies nothing and does not log a second reveal
    const again = await send('owner', 'POST', `/api/v1/clients/${id}/reveal-tin`, undefined, { key });
    expect(again.body).toEqual({ revealed: true });
    expect(await count("SELECT COUNT(*) AS n FROM activity WHERE action = 'tin_revealed' AND entity_id = ?", id)).toBe(1);
  });

  it('reveal-tin on a seeded client with no stored TIN is 404, not a made-up number; on an unassigned client a helper gets 403 first', async () => {
    expect((await send('owner', 'POST', '/api/v1/clients/client-rsp/reveal-tin')).status).toBe(404);
    const helper = await send('helper', 'POST', '/api/v1/clients/client-maria/reveal-tin');
    expect(helper.status).toBe(403);
    expect(helper.body.error.code).toBe('FORBIDDEN');
  });

  it('finds a duplicate by TIN through the keyed hash, without returning the TIN', async () => {
    const created = await send('owner', 'POST', '/api/v1/clients', newClient({ tinFull: '246-810-121-00000' }));
    const found = await send('owner', 'POST', '/api/v1/clients/duplicates', { tin: '246810121' }, { key: null });
    expect(found.status).toBe(200);
    expect(found.body.map((s: any) => s.client.id)).toContain(created.body.id);
    expect(JSON.stringify(found.body)).not.toContain('246-810-121');
    expect((await send('helper', 'POST', '/api/v1/clients/duplicates', { tin: '246810121' }, { key: null })).status).toBe(403);
  });
});
