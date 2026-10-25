import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories, mockDevControls } from './index';

describe('mockRepositories.clients', () => {
  beforeEach(() => {
    mockDevControls.setPersona('owner');
  });

  it('lists active clients and computes summary statistics', async () => {
    const res = await mockRepositories.clients.list({ status: 'active' });
    expect(res.items.length).toBeGreaterThan(0);

    const first = res.items[0];
    expect(first.client).toBeDefined();
    expect(typeof first.activeTaskCount).toBe('number');
    expect(typeof first.blockedTaskCount).toBe('number');
    expect(typeof first.authAttention).toBe('boolean');
  });

  it('scopes client visibility to assigned clients for Helper (Ben Morales)', async () => {
    mockDevControls.setPersona('helper');
    const res = await mockRepositories.clients.list();

    const allowed = ['client-rsp', 'client-cruz'];
    for (const item of res.items) {
      expect(allowed).toContain(item.client.id);
    }
  });

  it('reveals full TIN and writes an audit event', async () => {
    const list = await mockRepositories.clients.list();
    const target = list.items[0].client;

    const fullTin = await mockRepositories.clients.revealTin(target.id);
    expect(fullTin).toBeDefined();
    expect(fullTin).not.toContain('•••');

    // Verify activity event was written
    const activity = await mockRepositories.activity.list({ entityId: target.id });
    const hasTinEvent = activity.items.some((a) => a.action === 'tin_revealed');
    expect(hasTinEvent).toBe(true);
  });

  it('archives client with reason and allows restoration', async () => {
    const list = await mockRepositories.clients.list();
    const target = list.items[0].client;

    // Archive
    await mockRepositories.clients.archive(target.id, 'Client business terminated');
    const getArchived = await mockRepositories.clients.get(target.id);
    expect(getArchived.client.status).toBe('archived');

    // Restore
    await mockRepositories.clients.restore(target.id, 'Client resumed practice');
    const getRestored = await mockRepositories.clients.get(target.id);
    expect(getRestored.client.status).toBe('active');
  });

  it('handles CSV import preview duplicate detection, commit, and undo rollback', async () => {
    const sampleRows = [
      {
        Name: 'Unique New Corp',
        Code: 'UNC',
        TIN: '111-222-333-00000',
        RDO: '039',
      },
      {
        Name: 'Duplicate RSP Test',
        Code: 'RSP', // RSP already exists in seed data
        TIN: '999-888-777-00000',
        RDO: '039',
      },
    ];

    const mapping = {
      displayName: 'Name',
      code: 'Code',
      tin: 'TIN',
      rdoCode: 'RDO',
    };

    // 1. Preview
    const preview = await mockRepositories.clients.importPreview(sampleRows, mapping as any);
    expect(preview.validRows.length).toBe(1);
    expect(preview.errors.length).toBe(1);
    expect(preview.errors[0].field).toBe('code');
    expect(preview.errors[0].message).toContain('Duplicate client code');

    // 2. Commit valid rows
    const commit = await mockRepositories.clients.importCommit(preview);
    expect(commit.created.length).toBe(1);
    expect(commit.skipped).toBe(1);

    // Verify the newly created client exists
    const createdId = commit.created[0];
    const createdClient = await mockRepositories.clients.get(createdId);
    expect(createdClient.client.code).toBe('UNC');

    // 3. Rollback (Undo)
    await mockRepositories.clients.importUndo(commit.batchId);
    
    // Check that the created client was soft-deleted
    const afterUndoList = await mockRepositories.clients.list();
    const found = afterUndoList.items.find((i) => i.client.id === createdId);
    expect(found).toBeUndefined();
  });
});
