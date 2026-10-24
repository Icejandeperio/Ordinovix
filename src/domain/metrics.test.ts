import { describe, it, expect } from 'vitest';
import {
  calculateFirstPassRate,
  countTripsNeedingReturn,
  calculateVisitsLeftReadyRate,
  calculateOnTimeRate,
  calculateOwnershipCoverage,
  median,
} from './metrics';
import type { VisitItem, Visit, Task } from './types';

describe('domain/metrics', () => {
  it('calculates median properly for odd and even counts', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('calculates first pass completion rate', () => {
    const items: VisitItem[] = [
      {
        id: '1',
        isFirstVisitForTask: true,
        outcome: 'completed',
        visitId: 'v1',
        taskId: 't1',
        clientId: 'c1',
        intendedAction: 'submit',
        evidenceDocumentIds: [],
        createdAt: '',
        createdBy: '',
        updatedAt: '',
        updatedBy: '',
        version: 1,
        orgId: 'o1',
      },
      {
        id: '2',
        isFirstVisitForTask: true,
        outcome: 'submitted_pending',
        visitId: 'v1',
        taskId: 't2',
        clientId: 'c1',
        intendedAction: 'submit',
        evidenceDocumentIds: [],
        createdAt: '',
        createdBy: '',
        updatedAt: '',
        updatedBy: '',
        version: 1,
        orgId: 'o1',
      },
      {
        id: '3',
        isFirstVisitForTask: true,
        outcome: 'not_accepted',
        visitId: 'v1',
        taskId: 't3',
        clientId: 'c1',
        intendedAction: 'submit',
        evidenceDocumentIds: [],
        createdAt: '',
        createdBy: '',
        updatedAt: '',
        updatedBy: '',
        version: 1,
        orgId: 'o1',
      },
      {
        id: '4',
        isFirstVisitForTask: false, // repeat visit, should be excluded from first pass rate
        outcome: 'completed',
        visitId: 'v2',
        taskId: 't3',
        clientId: 'c1',
        intendedAction: 'submit',
        evidenceDocumentIds: [],
        createdAt: '',
        createdBy: '',
        updatedAt: '',
        updatedBy: '',
        version: 1,
        orgId: 'o1',
      },
    ];

    // 2 successes out of 3 first-visits = 67%
    expect(calculateFirstPassRate(items)).toBe(67);
  });

  it('categorizes avoidable vs non-avoidable repeat trips', () => {
    const items: VisitItem[] = [
      {
        id: '1',
        isFirstVisitForTask: true,
        outcome: 'more_documents_requested',
        avoidable: true,
        visitId: 'v1',
        taskId: 't1',
        clientId: 'c1',
        intendedAction: 'submit',
        evidenceDocumentIds: [],
        createdAt: '',
        createdBy: '',
        updatedAt: '',
        updatedBy: '',
        version: 1,
        orgId: 'o1',
      },
      {
        id: '2',
        isFirstVisitForTask: true,
        outcome: 'not_accepted',
        avoidable: false,
        visitId: 'v1',
        taskId: 't2',
        clientId: 'c1',
        intendedAction: 'submit',
        evidenceDocumentIds: [],
        createdAt: '',
        createdBy: '',
        updatedAt: '',
        updatedBy: '',
        version: 1,
        orgId: 'o1',
      },
    ];

    const result = countTripsNeedingReturn(items);
    expect(result.total).toBe(2);
    expect(result.avoidable).toBe(1);
    expect(result.notAvoidable).toBe(1);
  });

  it('calculates visits that left ready rate', () => {
    const visits: Visit[] = [
      {
        id: 'v1',
        officeType: 'rdo',
        officeName: 'RDO 39',
        plannedDate: '2026-10-20',
        assigneeUserId: 'u1',
        status: 'done',
        packedLineIds: [],
        packedKitItemIds: [],
        startedAt: '2026-10-20T09:00:00+08:00',
        createdAt: '',
        createdBy: '',
        updatedAt: '',
        updatedBy: '',
        version: 1,
        orgId: 'o1',
      },
      {
        id: 'v2',
        officeType: 'rdo',
        officeName: 'RDO 39',
        plannedDate: '2026-10-21',
        assigneeUserId: 'u1',
        status: 'done',
        packedLineIds: [],
        packedKitItemIds: [],
        startedAt: '2026-10-21T09:00:00+08:00',
        departureOverrideReason: 'Client insisted to leave early',
        createdAt: '',
        createdBy: '',
        updatedAt: '',
        updatedBy: '',
        version: 1,
        orgId: 'o1',
      },
    ];

    expect(calculateVisitsLeftReadyRate(visits)).toBe(50);
  });
});
