import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PERSONAS, openWorld, type World } from '../testing/world';
import { setDevToday } from '@/lib/dates';

/**
 * U42 updating a payment: the operator's edit (Land Bank, a reference, paid by the client) saves in the small hours of Manila's day
 * (still the previous day in UTC); a proof is a real document; and bad input is a 4xx with a message, never a 5xx.
 */
let world: World;
let cookie: string;
let n = 0;

beforeAll(async () => {
  world = await openWorld();
  setDevToday(null); // the seed pins today to its own day; this suite runs on the real clock
  cookie = await world.cookieFor(PERSONAS.owner);
}, 180_000);
afterAll(async () => {
  await world?.dispose();
});
afterEach(() => {
  vi.setSystemTime(new Date('2026-10-28T02:00:00.000Z')); // the suite's pinned clock (vitest.setup.ts)
});

async function send(method: string, path: string, body?: unknown, version?: number) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'Idempotency-Key': `pay-key-${++n}-${crypto.randomUUID()}` };
  if (version !== undefined) headers['If-Match'] = `"${version}"`;
  const res = await world.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cookie });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const base = { clientId: 'client-rsp', taskId: 'task-rsp-0619e', amount: 2500000, channel: 'aab_otc', paidBy: 'client' };

async function upload(): Promise<string> {
  const form = new FormData();
  form.set('meta', JSON.stringify({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', kind: 'payment_proof', source: 'upload' }));
  form.set('file', new File([new TextEncoder().encode(`%PDF-1.4 proof ${crypto.randomUUID()}`)], 'proof.pdf', { type: 'application/pdf' }));
  const res = await world.request('/api/v1/documents', { method: 'POST', headers: { 'Idempotency-Key': `pay-doc-${++n}-${crypto.randomUUID()}` }, body: form, cookie });
  const doc = (await res.json()) as { id: string };
  expect(res.status).toBe(201);
  return doc.id;
}

describe('U42 update payment', () => {
  it('saves an edit dated today in Manila at every hour from 00:00 to 07:59, when UTC is still the day before', { timeout: 60_000 }, async () => {
    for (const utc of ['2026-11-03T16:00:00Z', '2026-11-03T18:21:00Z', '2026-11-03T23:59:00Z']) {
      vi.setSystemTime(new Date(utc));
      const made = await send('POST', '/api/v1/payments', { ...base, paidOn: '2026-11-04' });
      expect(made.status, JSON.stringify(made.body)).toBe(201);
      const edited = await send(
        'PATCH',
        `/api/v1/payments/${made.body.id}`,
        { ...base, paidOn: '2026-11-04', provider: 'Land Bank', referenceNo: 'LBP-TXN-0928', paidBy: 'client', proofDocumentIds: [] },
        made.body.version,
      );
      expect(edited.status, JSON.stringify(edited.body)).toBe(200);
      expect(edited.body).toMatchObject({ paidOn: '2026-11-04', referenceNo: 'LBP-TXN-0928', version: 2 });
      // tomorrow in Manila is still the future
      const future = await send('PATCH', `/api/v1/payments/${made.body.id}`, { paidOn: '2026-11-05' }, edited.body.version);
      expect(future.status).toBe(422);
    }
  });

  it('keeps a real proof across reloads and across a later edit', { timeout: 60_000 }, async () => {
    const proof = await upload();
    const made = await send('POST', '/api/v1/payments', { ...base, paidOn: '2026-10-20', proofDocumentIds: [proof] });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    const edited = await send('PATCH', `/api/v1/payments/${made.body.id}`, { ...base, paidOn: '2026-10-21', proofDocumentIds: [proof], note: 'again' }, made.body.version);
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    const list = await world.request('/api/v1/payments', { cookie });
    const rows = ((await list.json()) as { items?: Array<{ id: string; proofDocumentIds: string[] }> } | Array<{ id: string; proofDocumentIds: string[] }>);
    const all = Array.isArray(rows) ? rows : (rows.items ?? []);
    expect(all.find((p) => p.id === made.body.id)?.proofDocumentIds).toEqual([proof]);
  });

  it('answers a proof that is not a document with a 422 and a message about the proof, never a 5xx', async () => {
    const made = await send('POST', '/api/v1/payments', { ...base, paidOn: '2026-10-20' });
    const bad = await send('PATCH', `/api/v1/payments/${made.body.id}`, { ...base, paidOn: '2026-10-20', proofDocumentIds: ['doc-proof-1730000000000'] }, made.body.version);
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION');
    expect(bad.body.error.fields.proofDocumentIds[0]).toMatch(/proof/i);
    const creating = await send('POST', '/api/v1/payments', { ...base, paidOn: '2026-10-20', proofDocumentIds: ['nope'] });
    expect(creating.status).toBe(422);
  });

  it('turns a database constraint into a 422 instead of a 5xx', async () => {
    // a task that does not exist: the reference check cannot see it, the foreign key can
    const res = await send('POST', '/api/v1/payments', { ...base, taskId: 'task-that-does-not-exist', paidOn: '2026-10-20' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
