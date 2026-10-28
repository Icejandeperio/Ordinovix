import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONAS, TEST_SECRETS, addMembership, openWorld, type World } from '../testing/world';
import { signedFilePath, sha256Hex } from '../files/store';
import { runRetention } from '../cron/retention';

/**
 * U28: files in R2. Upload checks the type by content and the size, stores the bytes under a key that is never reused and the
 * SHA-256 and metadata in D1; a file is opened only through a 5-minute signed URL, and viewing or downloading is logged.
 */
let world: World;
const cookie: Record<string, string> = {};
let n = 0;

beforeAll(async () => {
  world = await openWorld();
  cookie.owner = await world.cookieFor(PERSONAS.owner);
  cookie.helper = await world.cookieFor(PERSONAS.helper);
  await addMembership(world, { id: 'mem-rev', email: 'rev@example.com', role: 'helper', userId: 'user-rev', active: false, revoked: true, clientIds: ['client-rsp'] });
  cookie.revoked = await world.cookieFor({ id: 'user-rev', name: 'Rev Oked', email: 'rev@example.com' });
  cookie.none = await world.cookieFor({ id: 'ba-none', name: 'No Member', email: 'none@example.com' });
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});

const pdf = (extra = 'sample') => new TextEncoder().encode(`%PDF-1.4\n% ${extra}\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n`);
const png = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1]);
const jpeg = () => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const exe = () => Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);

const count = async (sql: string, ...bind: unknown[]) => (await world.env.DB.prepare(sql).bind(...bind).first<{ n: number }>())!.n;
const row = async (sql: string, ...bind: unknown[]) => (await world.env.DB.prepare(sql).bind(...bind).first<any>())!;
const objects = async () => (await world.env.FILES.list({ prefix: 'org/' })).objects.map((o) => o.key);

interface UploadOptions {
  who?: 'owner' | 'helper' | 'revoked' | 'none';
  meta?: Record<string, unknown>;
  bytes?: Uint8Array;
  type?: string;
  name?: string;
  thumb?: Uint8Array;
  key?: string;
  extra?: Record<string, string>;
  env?: Record<string, unknown>;
}
async function upload(o: UploadOptions = {}) {
  const form = new FormData();
  form.set('meta', JSON.stringify({ clientId: 'client-maria', kind: 'source', source: 'upload', ...(o.meta ?? {}) }));
  form.set('file', new File([(o.bytes ?? pdf()) as BlobPart], o.name ?? 'scan.pdf', { type: o.type ?? 'application/pdf' }));
  if (o.thumb) form.set('thumb', new File([o.thumb as BlobPart], 'thumb.jpg', { type: 'image/jpeg' }));
  for (const [k, v] of Object.entries(o.extra ?? {})) form.set(k, v);
  const res = await world.request('/api/v1/documents', {
    method: 'POST',
    headers: { 'Idempotency-Key': o.key ?? `doc-key-${++n}-${crypto.randomUUID()}` },
    body: form,
    cookie: cookie[o.who ?? 'owner'],
    env: o.env as never,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, text };
}

const get = async (path: string, who?: keyof typeof cookie) => {
  const res = await world.request(path, { cookie: who ? cookie[who] : undefined });
  return res;
};

describe('upload', () => {
  it('stores the bytes in R2 under the key layout, the SHA-256 and metadata in D1, moves the line, and logs the upload', async () => {
    const bytes = pdf('first upload');
    // a line that is still waiting for its document (an accepted one stays accepted)
    const waiting = await row("SELECT id, task_id FROM task_lines WHERE client_id = 'client-maria' AND status IN ('requested', 'not_requested') LIMIT 1");
    const res = await upload({ bytes, meta: { taskId: waiting.task_id, lineId: waiting.id }, name: 'Signed Form.pdf' });
    expect(res.status, res.text).toBe(201);
    const doc = res.body;
    const year = new Date(Date.now() + 8 * 3600_000).getUTCFullYear();
    expect(doc.storageKey.startsWith(`org/org-demo-01/client/client-maria/${year}/${waiting.task_id}/`)).toBe(true);
    expect(doc.storageKey.endsWith(`/${doc.id}-v1.pdf`)).toBe(true);
    expect(doc.sha256).toBe(await sha256Hex(bytes));
    expect(doc).toMatchObject({ mimeType: 'application/pdf', sizeBytes: bytes.length, versionNo: 1, clientId: 'client-maria' });
    const stored = await world.env.FILES.get(doc.storageKey);
    expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(bytes);
    expect(await row('SELECT sha256, storage_key FROM documents WHERE id = ?', doc.id)).toEqual({ sha256: doc.sha256, storage_key: doc.storageKey });
    expect((await row('SELECT status FROM task_lines WHERE id = ?', waiting.id)).status).toBe('received');
    expect(await count('SELECT COUNT(*) AS n FROM line_documents WHERE document_id = ?', doc.id)).toBe(1);
    expect((await row("SELECT action, actor_id FROM activity WHERE entity_id = ? ORDER BY rowid DESC", doc.id))).toEqual({ action: 'file_uploaded', actor_id: 'user-ana' });
  });

  it('a file without a task goes under misc, a thumbnail under thumbs/, both written once', async () => {
    const res = await upload({ thumb: jpeg() });
    expect(res.status, res.text).toBe(201);
    expect(res.body.storageKey).toMatch(/\/misc\/[^/]+-v1\.pdf$/);
    expect(res.body.thumbnailKey).toMatch(/\/misc\/thumbs\/[^/]+-v1\.jpg$/);
    expect(await world.env.FILES.get(res.body.thumbnailKey)).not.toBeNull();
  });

  it('takes the type from the content: PDF, PNG and JPEG are accepted, and the name does not matter', async () => {
    for (const [bytes, type, ext] of [[png(), 'image/png', 'png'], [jpeg(), 'image/jpeg', 'jpg']] as const) {
      const res = await upload({ bytes, type, name: 'photo.bin' });
      expect(res.status, res.text).toBe(201);
      expect(res.body.mimeType).toBe(type);
      expect(res.body.storageKey.endsWith(`.${ext}`) || res.body.storageKey.endsWith('.bin')).toBe(true);
    }
  });

  it('refuses a file whose content is not an accepted type, however it is named or labelled, and stores nothing', async () => {
    const before = { objects: (await objects()).length, docs: await count('SELECT COUNT(*) AS n FROM documents') };
    const cases: Array<[string, UploadOptions]> = [
      ['an executable named .pdf', { bytes: exe(), name: 'invoice.pdf', type: 'application/pdf' }],
      ['text named .pdf', { bytes: new TextEncoder().encode('hello'), name: 'a.pdf' }],
      ['a PNG that claims to be a PDF', { bytes: png(), type: 'application/pdf' }],
      ['an empty file', { bytes: new Uint8Array(0) }],
    ];
    for (const [label, o] of cases) {
      const res = await upload(o);
      expect(res.status, label).toBe(422);
      expect(Object.keys(res.body.error.fields), label).toContain('file');
    }
    expect((await objects()).length).toBe(before.objects);
    expect(await count('SELECT COUNT(*) AS n FROM documents')).toBe(before.docs);
  });

  it('refuses a file over 15 MB, and accepts one at the limit', async () => {
    const big = new Uint8Array(15 * 1024 * 1024 + 1);
    big.set(pdf());
    const res = await upload({ bytes: big });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.file[0]).toMatch(/15 MB/);
    const edge = new Uint8Array(15 * 1024 * 1024);
    edge.set(pdf());
    expect((await upload({ bytes: edge })).status).toBe(201);
  });

  it('refuses a form field or a metadata key it does not know', async () => {
    expect((await upload({ extra: { sha256: 'abc' } })).status).toBe(422);
    const res = await upload({ meta: { orgId: 'org-other' } });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toContain('meta.orgId');
  });

  it('computes the hash itself: a hash sent by the browser is ignored (it is not even accepted)', async () => {
    const res = await upload({ extra: {}, bytes: pdf('hash me') });
    expect(res.body.sha256).toBe(await sha256Hex(pdf('hash me')));
  });

  it('a repeated Idempotency-Key returns the first response and stores one object', async () => {
    const key = 'doc-idem-key-0001';
    const first = await upload({ key, bytes: pdf('idem') });
    const keys = (await objects()).length;
    const again = await upload({ key, bytes: pdf('idem') });
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(first.body.id);
    expect((await objects()).length).toBe(keys);
  });

  it('removes the object again when the database batch fails, so the bucket holds nothing without a record', async () => {
    // batch #1 is the read of the organization's records; batch #2 is the write: fail the write, after the bytes are in R2
    let batches = 0;
    const failing = new Proxy(world.env.DB, {
      get(target, prop) {
        if (prop === 'batch') {
          return (statements: D1PreparedStatement[]) =>
            ++batches < 2 ? target.batch(statements) : target.batch([...statements, target.prepare("INSERT INTO orgs (id, name, is_demo, created_at) VALUES (NULL, 'boom', 0, 'x')")]);
        }
        const v = (target as any)[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    }) as D1Database;
    const before = { objects: (await objects()).length, docs: await count('SELECT COUNT(*) AS n FROM documents'), activity: await count('SELECT COUNT(*) AS n FROM activity') };
    const putsBefore = (await objects()).length;
    const res = await upload({ bytes: pdf('doomed'), thumb: jpeg(), env: { DB: failing } });
    expect(res.status).toBe(500);
    expect(batches).toBe(2); // the write batch really ran (and failed) after the bytes were stored
    expect(putsBefore).toBe(before.objects);
    expect((await objects()).length).toBe(before.objects);
    expect(await count('SELECT COUNT(*) AS n FROM documents')).toBe(before.docs);
    expect(await count('SELECT COUNT(*) AS n FROM activity')).toBe(before.activity);
  });

  it('a key is never reused: replacing writes a new object and leaves the old one', async () => {
    const first = await upload({ bytes: pdf('version one'), meta: { taskId: 'task-maria-2550q' } });
    const form = new FormData();
    form.set('file', new File([pdf('version two') as BlobPart], 'scan v2.pdf', { type: 'application/pdf' }));
    const res = await world.request(`/api/v1/documents/${first.body.id}/replace`, { method: 'POST', headers: { 'Idempotency-Key': `replace-key-${++n}-${crypto.randomUUID()}` }, body: form, cookie: cookie.owner });
    const next = (await res.json()) as any;
    expect(res.status, JSON.stringify(next)).toBe(201);
    expect(next.versionNo).toBe(2);
    expect(next.replacesId).toBe(first.body.id);
    expect(next.storageKey).not.toBe(first.body.storageKey);
    expect(next.storageKey).toMatch(/-v2\.pdf$/);
    expect(await world.env.FILES.get(first.body.storageKey)).not.toBeNull();
    expect(await world.env.FILES.get(next.storageKey)).not.toBeNull();
  });
});

describe('who may upload', () => {
  it('a helper uploads to an assigned client; to an unassigned client he is refused and nothing is stored', async () => {
    expect((await upload({ who: 'helper', meta: { clientId: 'client-rsp' } })).status).toBe(201);
    const before = { objects: (await objects()).length, docs: await count('SELECT COUNT(*) AS n FROM documents') };
    const res = await upload({ who: 'helper', meta: { clientId: 'client-maria' } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await objects()).length).toBe(before.objects);
    expect(await count('SELECT COUNT(*) AS n FROM documents')).toBe(before.docs);
  });

  it('no membership is ACCESS_PENDING and a revoked membership is FORBIDDEN; neither stores anything', async () => {
    const before = (await objects()).length;
    const none = await upload({ who: 'none' });
    expect(none.status).toBe(403);
    expect(none.body.error.code).toBe('ACCESS_PENDING');
    const revoked = await upload({ who: 'revoked', meta: { clientId: 'client-rsp' } });
    expect(revoked.status).toBe(403);
    expect(revoked.body.error.code).toBe('FORBIDDEN');
    const nobody = await world.request('/api/v1/documents', { method: 'POST', body: new FormData() });
    expect(nobody.status).toBe(401);
    expect((await objects()).length).toBe(before);
  });
});

describe('signed URLs', () => {
  let docId: string;
  let bytes: Uint8Array;
  beforeAll(async () => {
    bytes = pdf('to be opened');
    const res = await upload({ bytes, meta: { taskId: 'task-maria-2550q' }, name: 'Opened.pdf' });
    docId = res.body.id;
  });

  const mint = async (purpose = 'view', who: keyof typeof cookie = 'owner', id = docId) => {
    const res = await get(`/api/v1/files/${id}?purpose=${purpose}`, who);
    return { status: res.status, body: (await res.json()) as any };
  };

  it('mints a URL that opens the file without a cookie, never cached, and logs the view', async () => {
    const before = await count("SELECT COUNT(*) AS n FROM activity WHERE action = 'file_viewed' AND entity_id = ?", docId);
    const { status, body } = await mint('view');
    expect(status).toBe(200);
    expect(body.url).toMatch(/^\/api\/v1\/files\/[^/]+\/content\?purpose=view&exp=\d+&sig=[\w-]+$/);
    expect(body.expiresInSeconds).toBe(300);
    const opened = await get(body.url); // no cookie
    expect(opened.status).toBe(200);
    expect(new Uint8Array(await opened.arrayBuffer())).toEqual(bytes);
    expect(opened.headers.get('cache-control')).toBe('private, max-age=0');
    expect(opened.headers.get('content-type')).toBe('application/pdf');
    expect(opened.headers.get('content-disposition')).toMatch(/^inline;/);
    expect(opened.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await count("SELECT COUNT(*) AS n FROM activity WHERE action = 'file_viewed' AND entity_id = ?", docId)).toBe(before + 1);
  });

  it('a download is an attachment with the display name, and is logged as a download', async () => {
    const { body } = await mint('download');
    const res = await get(body.url);
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename\*=UTF-8''/);
    expect(await count("SELECT COUNT(*) AS n FROM activity WHERE action = 'file_downloaded' AND entity_id = ?", docId)).toBeGreaterThan(0);
  });

  it('refuses a tampered signature, another file, another purpose, an expired link and a link valid for too long', async () => {
    const { body } = await mint('view');
    const url = new URL(body.url, 'https://x.test');
    const sig = url.searchParams.get('sig')!;
    const bad = (path: string) => get(path).then((r) => r.status);
    expect(await bad(`${url.pathname}?purpose=view&exp=${url.searchParams.get('exp')}&sig=${sig.slice(0, -2)}xx`)).toBe(403);
    expect(await bad(`${url.pathname}?purpose=download&exp=${url.searchParams.get('exp')}&sig=${sig}`)).toBe(403);
    expect(await bad(`/api/v1/files/some-other-id/content?purpose=view&exp=${url.searchParams.get('exp')}&sig=${sig}`)).toBe(403);
    expect(await bad(`${url.pathname}?purpose=view&exp=${Number(url.searchParams.get('exp')) + 1}&sig=${sig}`)).toBe(403);
    expect(await bad(`${url.pathname}?purpose=view`)).toBe(403);
    const now = Math.floor(Date.now() / 1000);
    const expired = await signedFilePath(TEST_SECRETS.FILE_URL_SIGNING_KEY, docId, 'view', now - 301);
    expect(await bad(expired)).toBe(403);
    const longLived = await signedFilePath(TEST_SECRETS.FILE_URL_SIGNING_KEY, docId, 'view', now + 600);
    expect(await bad(longLived)).toBe(403);
    const signedWithAnotherKey = await signedFilePath('another-secret-entirely', docId, 'view');
    expect(await bad(signedWithAnotherKey)).toBe(403);
    // the real one still works
    expect(await bad(body.url)).toBe(200);
  });

  it('the bucket is not reachable except through the signed route: the key is not a path', async () => {
    const doc = await row('SELECT storage_key FROM documents WHERE id = ?', docId);
    expect((await get(`/${doc.storage_key}`)).status).not.toBe(200);
    expect((await get(`/api/v1/files/${docId}/content`)).status).toBe(403);
  });

  it('a helper cannot mint a URL for an unassigned client\'s file, and the refusal is not logged as a view', async () => {
    const before = await count("SELECT COUNT(*) AS n FROM activity WHERE action = 'file_viewed'");
    const { status, body } = await mint('view', 'helper');
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(await count("SELECT COUNT(*) AS n FROM activity WHERE action = 'file_viewed'")).toBe(before);
    expect((await mint('view', 'none')).body.error.code).toBe('ACCESS_PENDING');
    expect((await mint('view', 'revoked')).body.error.code).toBe('FORBIDDEN');
    expect((await get(`/api/v1/files/${docId}?purpose=view`)).status).toBe(401);
  });

  it('a helper opens a file of an assigned client', async () => {
    const mine = await upload({ who: 'helper', meta: { clientId: 'client-rsp' } });
    const { status, body } = await mint('view', 'helper', mine.body.id);
    expect(status).toBe(200);
    expect((await get(body.url)).status).toBe(200);
  });

  it('a seeded sample file is served as its data: URL, since the seed puts nothing in R2', async () => {
    const seeded = await row("SELECT id FROM documents WHERE storage_key LIKE 'data:%' AND client_id = 'client-rsp' LIMIT 1");
    const { status, body } = await mint('view', 'owner', seeded.id);
    expect(status).toBe(200);
    expect(body.url).toMatch(/^data:/);
    expect(body.url).not.toContain('#');
  });

  it('a removed file cannot be opened: no new URL, and a URL minted before stops working', async () => {
    const res = await upload({ bytes: pdf('soon removed') });
    const { body } = await mint('view', 'owner', res.body.id);
    const removed = await world.request(`/api/v1/documents/${res.body.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json', 'Idempotency-Key': `rm-key-${++n}-${crypto.randomUUID()}` }, body: JSON.stringify({ reason: 'Uploaded to the wrong client' }), cookie: cookie.owner });
    expect(removed.status).toBe(200);
    expect((await mint('view', 'owner', res.body.id)).status).toBe(404);
    expect((await get(body.url)).status).toBe(404);
    // the object stays in the bucket until the retention job removes it
    expect(await world.env.FILES.get(res.body.storageKey)).not.toBeNull();
  });
});

describe('retention job', () => {
  const seedDoc = async (id: string, fields: { removed: boolean; retainUntil: string | null }) => {
    const key = `org/org-demo-01/client/client-maria/2026/misc/${id}-v1.pdf`;
    await world.env.FILES.put(key, pdf(id));
    await world.env.DB
      .prepare(
        "INSERT INTO documents (id, org_id, client_id, kind, display_name, original_name, mime_type, size_bytes, original_size_bytes, sha256, storage_key, source, retain_until, deleted_at, deleted_reason, created_at, created_by, updated_at, updated_by) VALUES (?, 'org-demo-01', 'client-maria', 'other', ?, 'a.pdf', 'application/pdf', 10, 10, ?, ?, 'upload', ?, ?, ?, 't', 'u', 't', 'u')",
      )
      .bind(id, `${id}.pdf`, id, key, fields.retainUntil, fields.removed ? 't' : null, fields.removed ? 'removed' : null)
      .run();
    return key;
  };

  it('deletes nothing when no retention period is configured, however many removed files there are', async () => {
    const key = await seedDoc('ret-none', { removed: true, retainUntil: null });
    const before = (await objects()).length;
    const result = await runRetention(world.env);
    expect(result.filesPurged).toBe(0);
    expect((await objects()).length).toBe(before);
    expect(await world.env.FILES.get(key)).not.toBeNull();
  });

  it('removes the bytes of a removed file once its retention date has passed, keeps the record, and notes it in the activity', async () => {
    const expired = await seedDoc('ret-expired', { removed: true, retainUntil: '2020-01-01' });
    const future = await seedDoc('ret-future', { removed: true, retainUntil: '2999-01-01' });
    const live = await seedDoc('ret-live', { removed: false, retainUntil: '2020-01-01' });
    const result = await runRetention(world.env);
    expect(result.filesPurged).toBe(1);
    expect(await world.env.FILES.get(expired)).toBeNull();
    expect(await world.env.FILES.get(future)).not.toBeNull();
    expect(await world.env.FILES.get(live)).not.toBeNull(); // a file that was never removed is never purged
    expect((await row("SELECT storage_key, deleted_at FROM documents WHERE id = 'ret-expired'")).storage_key).toBe('purged:ret-expired');
    expect(await count("SELECT COUNT(*) AS n FROM activity WHERE entity_id = 'ret-expired' AND actor_id = 'system'")).toBe(1);
    // running it again changes nothing
    expect((await runRetention(world.env)).filesPurged).toBe(0);
  });

  it('purges idempotency keys older than 7 days and keeps newer ones', async () => {
    const insert = (key: string, createdAt: string) =>
      world.env.DB.prepare("INSERT INTO idempotency_keys (org_id, user_id, key, method, path, status, response_json, created_at) VALUES ('org-demo-01', 'user-ana', ?, 'POST', '/x', 200, '{}', ?)").bind(key, createdAt).run();
    const now = new Date('2026-10-28T00:00:00.000Z');
    await insert('old-key-aaaa', '2026-10-20T00:00:00.000Z');
    await insert('fresh-key-aaaa', '2026-10-25T00:00:00.000Z');
    const result = await runRetention(world.env, now);
    expect(result.keysPurged).toBeGreaterThanOrEqual(1);
    expect(await count("SELECT COUNT(*) AS n FROM idempotency_keys WHERE key = 'old-key-aaaa'")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM idempotency_keys WHERE key = 'fresh-key-aaaa'")).toBe(1);
  });
});
