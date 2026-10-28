import { describe, it, expect } from 'vitest';
import { isRemoteFileKey, needsFileLookup } from './files';

/** U30: with the API data source a document's storage key is an R2 key, which carries the document id. */
describe('file keys', () => {
  it('knows an R2 key by its layout, and so which files need a signed URL', () => {
    expect(isRemoteFileKey('org/org-demo-01/client/client-rsp/2026/task-rsp-0619e/doc-abc123-v1.png')).toBe(true);
    expect(isRemoteFileKey('org/org-demo-01/client/client-rsp/2026/misc/doc-abc123-v12.pdf')).toBe(true);
    expect(needsFileLookup('org/org-demo-01/client/client-rsp/2026/misc/doc-abc123-v2.pdf')).toBe(true);
  });

  it('leaves device files and seeded sample files as they were', () => {
    expect(isRemoteFileKey('idb:doc-1')).toBe(false);
    expect(needsFileLookup('idb:doc-1')).toBe(true);
    expect(isRemoteFileKey('data:image/svg+xml;utf8,<svg></svg>#doc-9')).toBe(false);
    expect(needsFileLookup('data:image/svg+xml;utf8,<svg></svg>')).toBe(false);
    expect(needsFileLookup('purged:doc-3')).toBe(false);
    expect(needsFileLookup('https://example.com/org/x/doc-v1.png')).toBe(false);
  });
});
