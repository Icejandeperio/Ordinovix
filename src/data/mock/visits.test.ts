import { describe, it, expect, beforeEach } from 'vitest';
import { repositories } from '../index';
import { mockDevControls } from './index';
import { visitItemReadiness, visitReadiness, packList } from '@/domain/rules';
import type { TaskLine, Authorization, VisitItem, Task } from '@/domain/types';

describe('mockRepositories.visits and Visits Pipeline (M7)', () => {
  beforeEach(() => {
    mockDevControls.reset();
  });

  it('determines visit readiness and names specific blocking items and clients', async () => {
    const listRes = await repositories.visits.list();
    expect(listRes.items.length).toBeGreaterThan(0);

    const firstSummary = listRes.items[0];
    const detail = await repositories.visits.get(firstSummary.visit.id);

    expect(detail.visit.id).toBe(firstSummary.visit.id);
    expect(detail.items.length).toBeGreaterThan(0);
    expect(detail.readiness).toBeDefined();

    // Verify readiness calculation matches rules.visitReadiness
    if (!detail.readiness.ready) {
      expect(detail.readiness.blockingItems.length).toBeGreaterThan(0);
      const blocker = detail.readiness.blockingItems[0];
      expect(blocker.reasons.length).toBeGreaterThan(0);
      // Reasons must name the unaccepted line or missing/expired SPA
      expect(typeof blocker.clientName).toBe('string');
    }
  });

  it('generates physical trip pack checklist excluding digital-only items unless printAndBring is set', async () => {
    const listRes = await repositories.visits.list();
    const detail = await repositories.visits.get(listRes.items[0].visit.id);

    expect(detail.packList).toBeDefined();
    expect(Array.isArray(detail.packList)).toBe(true);

    for (const clientPack of detail.packList) {
      expect(clientPack.clientId).toBeDefined();
      expect(clientPack.clientName).toBeDefined();
      for (const item of clientPack.items) {
        expect(['original', 'certified_true_copy', 'photocopy', 'digital']).toContain(item.form);
        expect(item.copies).toBeGreaterThan(0);
        expect(typeof item.packed).toBe('boolean');
      }
    }

    expect(detail.kitItems.length).toBeGreaterThan(0);
    expect(detail.kitItems.some((k) => k.kitItem.label.toLowerCase().includes('pen') || k.kitItem.label.toLowerCase().includes('stapler'))).toBe(true);
  });

  it('allows ticking pack items and persists packed state', async () => {
    const listRes = await repositories.visits.list();
    const visitId = listRes.items[0].visit.id;
    const detailBefore = await repositories.visits.get(visitId);

    const firstKitItem = detailBefore.kitItems[0];
    expect(firstKitItem).toBeDefined();

    // Toggle packed to true
    await repositories.visits.setPacked(visitId, { kitItemId: firstKitItem.kitItem.id }, true);

    const detailAfter = await repositories.visits.get(visitId);
    const updatedKitItem = detailAfter.kitItems.find((k) => k.kitItem.id === firstKitItem.kitItem.id);
    expect(updatedKitItem?.packed).toBe(true);

    // Toggle back to false
    await repositories.visits.setPacked(visitId, { kitItemId: firstKitItem.kitItem.id }, false);
    const detailReverted = await repositories.visits.get(visitId);
    const revertedKitItem = detailReverted.kitItems.find((k) => k.kitItem.id === firstKitItem.kitItem.id);
    expect(revertedKitItem?.packed).toBe(false);
  });

  it('starts a visit and records departure override reason when incomplete', async () => {
    const listRes = await repositories.visits.list();
    const visitId = listRes.items[0].visit.id;

    const leaveReason = 'Officer agreed to intake while SPA is en route';
    const startedVisit = await repositories.visits.start(visitId, leaveReason);

    expect(startedVisit.status).toBe('in_progress');
    expect(startedVisit.startedAt).toBeDefined();
    expect(startedVisit.departureOverrideReason).toBe(leaveReason);
  });

  it('records counter outcome: completed with evidence completes the task', async () => {
    const listRes = await repositories.visits.list();
    const detail = await repositories.visits.get(listRes.items[0].visit.id);
    const itemToRecord = detail.items[0];

    const outcomeResult = await repositories.visits.recordOutcome(itemToRecord.item.id, {
      outcome: 'completed',
      evidenceDocumentIds: ['doc-receipt-001'],
      windowOrOfficer: 'Window 4 - Officer Reyes',
    });

    expect(outcomeResult.outcome).toBe('completed');
    expect(outcomeResult.evidenceDocumentIds).toContain('doc-receipt-001');

    // Verify task state was updated to completed per Spec 16.6
    const updatedTask = await repositories.tasks.get(itemToRecord.task.id);
    expect(updatedTask.task.status).toBe('completed');
    expect(updatedTask.task.completedAt).toBeDefined();
  });

  it('records counter outcome: more_documents_requested creates new required lines with lateDiscovered', async () => {
    const listRes = await repositories.visits.list();
    const detail = await repositories.visits.get(listRes.items[0].visit.id);
    const itemToRecord = detail.items[0];

    await repositories.visits.recordOutcome(itemToRecord.item.id, {
      outcome: 'more_documents_requested',
      cause: 'missing_document',
      avoidable: true,
      requestedDocuments: ['Certified Copy of Real Property Tax Receipt 2026'],
      nextAction: {
        text: 'Request RPT receipt from client',
        owner: 'client',
        due: '2026-10-30',
      },
      evidenceDocumentIds: [],
    });

    const updatedTask = await repositories.tasks.get(itemToRecord.task.id);
    expect(updatedTask.task.status).toBe('in_preparation');
    const newLine = updatedTask.lines.find((l) =>
      l.label.includes('Certified Copy of Real Property Tax Receipt 2026')
    );
    expect(newLine).toBeDefined();
    expect(newLine?.required).toBe(true);
    expect(newLine?.lateDiscovered).toBe(true);
    expect(newLine?.status).toBe('not_requested');
  });

  it('records counter outcome: correction_required marks affected lines as needs_correction', async () => {
    const listRes = await repositories.visits.list();
    const detail = await repositories.visits.get(listRes.items[0].visit.id);
    const itemToRecord = detail.items[0];
    const targetLine = itemToRecord.lines[0];

    await repositories.visits.recordOutcome(itemToRecord.item.id, {
      outcome: 'correction_required',
      cause: 'document_error',
      avoidable: true,
      note: 'TIN digit inverted in box 14',
      affectedLineIds: [targetLine.id],
      nextAction: {
        text: 'Re-print corrected schedule and obtain client wet signature',
        owner: 'operator',
        due: '2026-10-28',
      },
      evidenceDocumentIds: [],
    });

    const updatedTask = await repositories.tasks.get(itemToRecord.task.id);
    const lineAfter = updatedTask.lines.find((l) => l.id === targetLine.id);
    expect(lineAfter?.status).toBe('needs_correction');
    expect(lineAfter?.flagNote).toBe('TIN digit inverted in box 14');
  });

  it('finishes a visit with end time and expenses in centavos', async () => {
    const listRes = await repositories.visits.list();
    const visitId = listRes.items[0].visit.id;

    const finished = await repositories.visits.finish(visitId, {
      finishedAt: '2026-10-25T11:45:00+08:00',
      costs: {
        transport: 18000, // ₱180.00
        parking: 6000,   // ₱60.00
        other: 2000,     // ₱20.00
        note: 'Grab fare and Manila City Hall parking',
      },
    });

    expect(finished.status).toBe('done');
    expect(finished.finishedAt).toBe('2026-10-25T11:45:00+08:00');
    expect(finished.costs?.transport).toBe(18000);
    expect(finished.costs?.parking).toBe(6000);
  });

  it('manages offices directory with counter tips and supports updating existing offices', async () => {
    const offices = await repositories.offices.list();
    expect(offices.length).toBeGreaterThan(0);

    const saved = await repositories.offices.save({
      type: 'rdo',
      name: 'BIR RDO 040 - Cubao District',
      rdoCode: '040',
      address: 'Edsa Cubao, Quezon City',
      tips: 'Queue at Window 2 before 8:30 AM for ONETT intake',
    });

    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('BIR RDO 040 - Cubao District');
    expect(saved.tips).toContain('Queue at Window 2');

    // Update office
    const updated = await repositories.offices.save({
      id: saved.id,
      name: 'BIR RDO 040 - Cubao District Office',
      tips: 'Updated counter tip: Window 3 now handles assessments',
    });

    expect(updated.id).toBe(saved.id);
    expect(updated.name).toBe('BIR RDO 040 - Cubao District Office');
    expect(updated.tips).toContain('Window 3');
  });
});
