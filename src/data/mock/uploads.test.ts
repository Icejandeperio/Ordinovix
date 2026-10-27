import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories as R, mockDevControls } from './index';
import { putFile, getFileBlob } from '@/lib/files';

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const png = () => new Blob([PNG], { type: 'image/png' });
const info = (name = 'qa.png') => ({ originalName: name, originalSizeBytes: 8, sha256: 'qa-' + name } as never);

async function bytesAt(url: string): Promise<number[]> {
  const res = await fetch(url);
  return Array.from(new Uint8Array(await res.arrayBuffer()));
}

describe('U09 uploads persist in IndexedDB (B05) and follow the naming rules (B24)', () => {
  beforeEach(() => {
    mockDevControls.reset();
    mockDevControls.setPersona('owner');
  });

  it('stores file bytes in IndexedDB, not as a blob: URL in the record', async () => {
    const doc = await R.documents.upload({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', kind: 'other', source: 'upload' }, png(), undefined, info());
    expect(doc.storageKey.startsWith('idb:')).toBe(true);
    expect(doc.storageKey.startsWith('blob:')).toBe(false);
    const stored = await getFileBlob(doc.storageKey);
    expect(stored).toBeDefined();
    expect(Array.from(new Uint8Array(await stored!.arrayBuffer()))).toEqual(Array.from(PNG));
  });

  it('getUrl mints a fresh object URL each time and the bytes survive', async () => {
    const doc = await R.documents.upload({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', kind: 'other', source: 'upload' }, png(), undefined, info());
    const a = await R.documents.getUrl(doc.id, 'view');
    const b = await R.documents.getUrl(doc.id, 'view');
    expect(a.startsWith('blob:')).toBe(true);
    expect(a).not.toBe(b);
    expect(await bytesAt(a)).toEqual(Array.from(PNG));
    expect(await bytesAt(b)).toEqual(Array.from(PNG));
  });

  it('keeps thumbnails in IndexedDB too', async () => {
    const thumb = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
    const doc = await R.documents.upload({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', kind: 'other', source: 'upload' }, png(), thumb, info());
    expect(doc.thumbnailKey?.startsWith('idb:')).toBe(true);
    const t = await getFileBlob(doc.thumbnailKey!);
    expect(Array.from(new Uint8Array(await t!.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it('still serves seeded documents whose key is a data: URL', async () => {
    const seeded = (await R.documents.list({ clientId: 'client-rsp' })).items.find((d) => d.storageKey.startsWith('data:'))!;
    expect(await R.documents.getUrl(seeded.id, 'view')).toBe(seeded.storageKey);
  });

  it('applies the spec 9.9 display name', async () => {
    const doc = await R.documents.upload({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', kind: 'acknowledgment', source: 'upload' }, png(), undefined, info('Scan 12.PNG'));
    expect(doc.displayName).toBe('RSP_0619E_2026-09_ack_v1.png');
    expect(doc.originalName).toBe('Scan 12.PNG');
  });

  it('respects line transitions instead of forcing Received', async () => {
    const detail = await R.tasks.get('task-rsp-0619e');
    const accepted = detail.lines.find((l) => l.status === 'accepted')!;
    const received = detail.lines.find((l) => l.status === 'received')!;
    const filesBefore = accepted.documentIds.length; // the mock returns live records, so read it before uploading

    await R.documents.upload({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', lineId: accepted.id, kind: 'source', source: 'upload' }, png(), undefined, info('a.png'));
    const afterAccepted = (await R.tasks.get('task-rsp-0619e')).lines.find((l) => l.id === accepted.id)!;
    expect(afterAccepted.status).toBe('accepted');
    expect(afterAccepted.documentIds.length).toBe(filesBefore + 1);

    await R.documents.upload({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', lineId: received.id, kind: 'source', source: 'upload' }, png(), undefined, info('b.png'));
    expect((await R.tasks.get('task-rsp-0619e')).lines.find((l) => l.id === received.id)!.status).toBe('received');

    // A line still waiting for the file does become Received
    const waiting = (await R.tasks.get('task-vtl-2551q')).lines[0];
    expect(waiting.status).toBe('requested');
    await R.documents.upload({ clientId: 'client-vtl', taskId: 'task-vtl-2551q', lineId: waiting.id, kind: 'source', source: 'upload' }, png(), undefined, info('c.png'));
    expect((await R.tasks.get('task-vtl-2551q')).lines[0].status).toBe('received');
  });

  it('replace creates a new version record and never mutates the old one', async () => {
    const v1 = await R.documents.upload({ clientId: 'client-rsp', taskId: 'task-rsp-0619e', kind: 'acknowledgment', source: 'upload' }, png(), undefined, info('first.png'));
    const snapshot = JSON.stringify(v1);
    const second = new Blob([new Uint8Array([9, 9, 9, 9])], { type: 'image/png' });
    const v2 = await R.documents.replace(v1.id, second, undefined, { originalName: 'second.png', originalSizeBytes: 4, sha256: 'second' } as never);

    expect(v2.id).not.toBe(v1.id);
    expect(v2.versionNo).toBe(2);
    expect(v2.replacesId).toBe(v1.id);
    expect(v2.displayName).toBe('RSP_0619E_2026-09_ack_v2.png');
    expect(v2.storageKey).not.toBe(v1.storageKey);

    const list = (await R.documents.list({ clientId: 'client-rsp' })).items;
    const old = list.find((d) => d.id === v1.id)!;
    expect(JSON.stringify(old)).toBe(snapshot);
    expect(await bytesAt(await R.documents.getUrl(v1.id, 'view'))).toEqual(Array.from(PNG));
    expect(await bytesAt(await R.documents.getUrl(v2.id, 'view'))).toEqual([9, 9, 9, 9]);
  });

  it('putFile and getFileBlob round trip, and an unknown key is undefined', async () => {
    await putFile('idb:test-key', new Blob(['hello']));
    expect(await (await getFileBlob('idb:test-key'))!.text()).toBe('hello');
    expect(await getFileBlob('idb:missing')).toBeUndefined();
  });
});
