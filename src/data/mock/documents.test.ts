import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories, mockDevControls } from './index';
import {
  computeSha256,
  formatStandardizedDocName,
  formatBytes,
} from '@/lib/compression';
import type { DocumentKind } from '@/domain/types';

describe('mockRepositories.documents and Pipeline (M5)', () => {
  beforeEach(() => {
    mockDevControls.setPersona('owner');
  });

  it('generates standardized document names per Section 9.9 convention', () => {
    const formatted = formatStandardizedDocName({
      clientCode: 'rsp',
      templateCode: '1601-EQ',
      period: '2026-Q3',
      kind: 'acknowledgment',
      version: 1,
      ext: 'pdf',
    });

    expect(formatted).toBe('RSP_1601EQ_2026-Q3_ack_v1.pdf');

    const stampedPhoto = formatStandardizedDocName({
      clientCode: 'bol',
      templateCode: 'ECARSALE',
      period: '2026-10-12',
      kind: 'stamped_copy',
      version: 2,
      ext: 'jpg',
    });

    expect(stampedPhoto).toBe('BOL_ECARSALE_2026-10-12_stamped_v2.jpg');
  });

  it('formats human-readable byte sizes with tabular formatting', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(420 * 1024)).toBe('420 KB');
    expect(formatBytes(3.4 * 1024 * 1024)).toBe('3.4 MB');
  });

  it('computes SHA-256 hash using Web Crypto API', async () => {
    const blob = new Blob(['sample-test-content-for-hash'], { type: 'text/plain' });
    const hash = await computeSha256(blob);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // standard sha-256 hex string
  });

  it('sets line status to "received" upon file upload (never "accepted")', async () => {
    // 1. Get a task with a line that is still waiting for its file (U09: an upload no longer forces
    //    an accepted or under-review line back to Received, so the target must be a waiting line)
    const taskList = await mockRepositories.tasks.list();
    const targetTaskId = taskList.items.find((s) => s.task.id === 'task-vtl-2551q')!.task.id;
    const taskRes = await mockRepositories.tasks.get(targetTaskId);
    const firstLine = taskRes.lines.find((l) => l.status === 'requested' || l.status === 'not_requested')!;
    expect(firstLine).toBeDefined();

    // 2. Upload document targeting this line
    const testBlob = new Blob(['fake image binary data'], { type: 'image/webp' });
    const uploaded = await mockRepositories.documents.upload(
      {
        clientId: taskRes.task.clientId,
        taskId: taskRes.task.id,
        lineId: firstLine.id,
        kind: 'source',
        source: 'upload',
      },
      testBlob,
      undefined,
      {
        originalName: 'schedules.pdf',
        originalSizeBytes: testBlob.size,
        sha256: 'test-sha-' + Date.now(),
      }
    );

    expect(uploaded.id).toBeDefined();
    expect(uploaded.lineId).toBe(firstLine.id);

    // 3. Line status must be 'received', never 'accepted'
    const updatedTask = await mockRepositories.tasks.get(targetTaskId);
    const updatedLine = updatedTask.lines.find((l) => l.id === firstLine.id);
    expect(updatedLine?.status).toBe('received');
    expect(updatedLine?.documentIds).toContain(uploaded.id);
  });

  it('detects duplicate files by SHA-256 hash within client scope', async () => {
    const sha = 'identical-file-hash-12345';
    const testBlob = new Blob(['duplicate payload'], { type: 'application/pdf' });

    // Upload first document
    await mockRepositories.documents.upload(
      {
        clientId: 'client-rsp',
        kind: 'source',
        source: 'upload',
      },
      testBlob,
      undefined,
      { originalName: 'doc1.pdf', originalSizeBytes: 100, sha256: sha }
    );

    // Search by SHA for the same client
    const duplicates = await mockRepositories.documents.findBySha(sha, 'client-rsp');
    expect(duplicates.length).toBeGreaterThanOrEqual(1);
    expect(duplicates[0].sha256).toBe(sha);
  });

  it('scopes document access strictly for Helper (Ben Morales)', async () => {
    mockDevControls.setPersona('helper');
    const res = await mockRepositories.documents.list();

    const allowedClients = ['client-rsp', 'client-cruz'];
    for (const doc of res.items) {
      expect(allowedClients).toContain(doc.clientId);
    }
  });

  it('soft-deletes document with required reason', async () => {
    mockDevControls.setPersona('owner');
    const listRes = await mockRepositories.documents.list();
    const doc = listRes.items[0];

    await mockRepositories.documents.remove(doc.id, 'Superseded by clearer 300dpi scan');

    // Should no longer appear in active list
    const afterList = await mockRepositories.documents.list();
    expect(afterList.items.some((d) => d.id === doc.id)).toBe(false);
  });
});
