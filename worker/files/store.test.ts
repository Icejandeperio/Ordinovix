import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openLocalBindings, type LocalBindings } from '../harness';
import { createR2Files, sniffType } from './store';

let env: LocalBindings;
let dispose: () => Promise<void>;
beforeAll(async () => {
  ({ env, dispose } = await openLocalBindings());
}, 60_000);
afterAll(async () => {
  await dispose?.();
});

const files = () => createR2Files({ FILES: env.FILES, FILE_URL_SIGNING_KEY: 'k' });

describe('R2 file store', () => {
  it('never overwrites a key: a second write to the same key fails and the first bytes stay', async () => {
    const store = files();
    const key = store.keyFor({ orgId: 'o', clientId: 'c', documentId: 'd1', versionNo: 1, ext: 'pdf' });
    await store.put(key, new Blob(['first'], { type: 'application/pdf' }));
    await expect(files().put(key, new Blob(['second'], { type: 'application/pdf' }))).rejects.toThrow(/already exists/);
    expect(await (await env.FILES.get(key))!.text()).toBe('first');
  });

  it('discard removes only what this request put in the bucket', async () => {
    const mine = files();
    const other = files();
    const a = mine.keyFor({ orgId: 'o', clientId: 'c', documentId: 'mine', versionNo: 1, ext: 'pdf' });
    const b = other.keyFor({ orgId: 'o', clientId: 'c', documentId: 'other', versionNo: 1, ext: 'pdf' });
    await mine.put(a, new Blob(['a']));
    await other.put(b, new Blob(['b']));
    await mine.discard();
    expect(await env.FILES.get(a)).toBeNull();
    expect(await env.FILES.get(b)).not.toBeNull();
  });

  it('keys keep out characters that could climb out of the layout', () => {
    const key = files().keyFor({ orgId: '../o', clientId: 'c/../x', taskId: 't\..', documentId: 'd', versionNo: 2, ext: 'p/df' });
    expect(key).not.toContain('..');
    expect(key.split('/').length).toBe(7);
  });

  it('sniffs the type by content only', () => {
    expect(sniffType(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffType(new TextEncoder().encode('<html>'))).toBeNull();
    expect(sniffType(new Uint8Array(0))).toBeNull();
  });
});
