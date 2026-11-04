import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories, mockDevControls } from './index';

const upload = async (clientId: string, taskId: string, kind: 'payment_proof' | 'stamped_copy', info?: boolean) => {
  const bytes = new TextEncoder().encode('u43 ' + Math.random());
  return mockRepositories.documents.upload(
    { clientId, taskId, kind, source: 'upload' },
    new Blob([bytes], { type: 'application/pdf' }),
    undefined,
    info === false ? undefined : { originalName: 'f.pdf', originalSizeBytes: bytes.length, sha256: 'u43-' + Math.random() },
  );
};

describe('U43 referenced documents and made-up ids', () => {
  beforeEach(() => mockDevControls.setPersona('owner'));

  it('a document that is the proof of a payment cannot be removed; the message names the payment', async () => {
    const task = (await mockRepositories.tasks.list()).items[0].task;
    const proof = await upload(task.clientId, task.id, 'payment_proof');
    await mockRepositories.payments.save({
      clientId: task.clientId, taskId: task.id, amount: 123456, paidOn: '2026-10-20', channel: 'online',
      referenceNo: 'REF-U43', paidBy: 'client', proofDocumentIds: [proof.id],
    });
    await expect(mockRepositories.documents.remove(proof.id, 'wrong file')).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: expect.stringMatching(/₱1234\.56.*2026-10-20.*REF-U43/),
    });
  });

  it('once the payment no longer holds the proof, the document can be removed', async () => {
    const task = (await mockRepositories.tasks.list()).items[0].task;
    const proof = await upload(task.clientId, task.id, 'payment_proof');
    const pay = await mockRepositories.payments.save({
      clientId: task.clientId, taskId: task.id, amount: 5000, paidOn: '2026-10-20', channel: 'online', paidBy: 'client', proofDocumentIds: [proof.id],
    });
    await mockRepositories.payments.save({ id: pay.id, version: pay.version, clientId: task.clientId, taskId: task.id, amount: 5000, paidOn: '2026-10-20', channel: 'online', paidBy: 'client', proofDocumentIds: [] });
    await expect(mockRepositories.documents.remove(proof.id, 'wrong file')).resolves.toBeUndefined();
  });

  it('a visit outcome that names an evidence id that is not a saved file is refused', async () => {
    const visit = await mockRepositories.visits.get('visit-today');
    const item = visit.items[0].item;
    await expect(
      mockRepositories.visits.recordOutcome(item.id, {
        outcome: 'completed', evidenceDocumentIds: ['doc-' + 1762200000000],
      } as never),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('an upload that names no hash stores the real SHA-256, not a placeholder', async () => {
    const task = (await mockRepositories.tasks.list()).items[0].task;
    const doc = await upload(task.clientId, task.id, 'stamped_copy', false);
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
