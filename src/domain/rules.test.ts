import { describe, it, expect } from 'vitest';
import {
  canTransitionLine,
  derivedStatus,
  isBlocked,
  blockingReason,
  statusGroup,
  canSetStatus,
  dueState,
  authorizationState,
  validAuthorization,
  followUpState,
  isLateDiscovered,
  nonWorkingDayNote,
  visitItemReadiness,
  visitReadiness,
  periodKey,
  periodLabel,
  periodRange,
  defaultDue,
  templateApplies,
  canFinishVisit,
  packList,
  canCompleteWithEvidence,
} from './rules';
import type { Task, TaskLine, Authorization, FollowUp, Holiday, TaskTemplate, Client, VisitItem, Visit, CopyForm } from './types';

describe('domain/rules', () => {
  describe('canTransitionLine', () => {
    it('allows valid line transitions', () => {
      expect(canTransitionLine('not_requested', 'requested')).toBe(true);
      expect(canTransitionLine('requested', 'received')).toBe(true);
      expect(canTransitionLine('received', 'accepted')).toBe(true);
      expect(canTransitionLine('received', 'needs_correction')).toBe(true);
      expect(canTransitionLine('accepted', 'under_review')).toBe(true);
    });

    it('denies illegal jumps', () => {
      expect(canTransitionLine('not_requested', 'accepted')).toBe(false); // received is not accepted
      expect(canTransitionLine('accepted', 'requested')).toBe(false);
    });
  });

  describe('derivedStatus', () => {
    const baseTask: Task = {
      id: 'task-1',
      orgId: 'org-1',
      clientId: 'client-1',
      kind: 'filing',
      dueDate: '2026-10-31',
      dueSource: { kind: 'template' },
      ownerUserId: 'user-1',
      officeAction: false,
      paymentExpected: false,
      status: 'in_preparation',
      tags: [],
      createdAt: '2026-10-01T00:00:00+08:00',
      createdBy: 'user-1',
      updatedAt: '2026-10-01T00:00:00+08:00',
      updatedBy: 'user-1',
      version: 1,
    };

    it('returns completed if stored status is completed', () => {
      expect(derivedStatus({ ...baseTask, status: 'completed' }, [])).toBe('completed');
    });

    it('returns needs_correction if any required line needs correction', () => {
      const lines: TaskLine[] = [
        {
          id: 'line-1',
          taskId: 'task-1',
          clientId: 'client-1',
          label: 'Doc A',
          required: true,
          copyForm: 'digital',
          suppliedBy: 'client',
          printAndBring: false,
          status: 'needs_correction',
          sortOrder: 1,
          lateDiscovered: false,
          documentIds: [],
          createdAt: '',
          createdBy: '',
          updatedAt: '',
          updatedBy: '',
          version: 1,
          orgId: 'org-1',
        },
      ];
      expect(derivedStatus(baseTask, lines)).toBe('needs_correction');
      expect(isBlocked(baseTask, lines)).toBe(true);
    });

    it('returns intake if all required lines are not_requested', () => {
      const lines: TaskLine[] = [
        {
          id: 'line-1',
          taskId: 'task-1',
          clientId: 'client-1',
          label: 'Doc A',
          required: true,
          copyForm: 'digital',
          suppliedBy: 'client',
          printAndBring: false,
          status: 'not_requested',
          sortOrder: 1,
          lateDiscovered: false,
          documentIds: [],
          createdAt: '',
          createdBy: '',
          updatedAt: '',
          updatedBy: '',
          version: 1,
          orgId: 'org-1',
        },
      ];
      expect(derivedStatus(baseTask, lines)).toBe('intake');
    });

    it('returns waiting_on_client if any required line is requested', () => {
      const lines: TaskLine[] = [
        {
          id: 'line-1',
          taskId: 'task-1',
          clientId: 'client-1',
          label: 'Doc A',
          required: true,
          copyForm: 'digital',
          suppliedBy: 'client',
          printAndBring: false,
          status: 'requested',
          sortOrder: 1,
          lateDiscovered: false,
          documentIds: [],
          createdAt: '',
          createdBy: '',
          updatedAt: '',
          updatedBy: '',
          version: 1,
          orgId: 'org-1',
        },
      ];
      expect(derivedStatus(baseTask, lines)).toBe('waiting_on_client');
    });

    it('returns review_required if required line is received or under_review', () => {
      const lines: TaskLine[] = [
        {
          id: 'line-1',
          taskId: 'task-1',
          clientId: 'client-1',
          label: 'Doc A',
          required: true,
          copyForm: 'digital',
          suppliedBy: 'client',
          printAndBring: false,
          status: 'received',
          sortOrder: 1,
          lateDiscovered: false,
          documentIds: [],
          createdAt: '',
          createdBy: '',
          updatedAt: '',
          updatedBy: '',
          version: 1,
          orgId: 'org-1',
        },
      ];
      expect(derivedStatus(baseTask, lines)).toBe('review_required');
    });

    it('returns operator-set status if all required lines are accepted', () => {
      const lines: TaskLine[] = [
        {
          id: 'line-1',
          taskId: 'task-1',
          clientId: 'client-1',
          label: 'Doc A',
          required: true,
          copyForm: 'digital',
          suppliedBy: 'client',
          printAndBring: false,
          status: 'accepted',
          sortOrder: 1,
          lateDiscovered: false,
          documentIds: [],
          createdAt: '',
          createdBy: '',
          updatedAt: '',
          updatedBy: '',
          version: 1,
          orgId: 'org-1',
        },
      ];
      expect(derivedStatus({ ...baseTask, status: 'ready_next_step' }, lines)).toBe('ready_next_step');
    });
  });

  describe('dueState', () => {
    const task: Task = {
      id: 'task-1',
      orgId: 'org-1',
      clientId: 'client-1',
      kind: 'filing',
      dueDate: '2026-10-25',
      dueSource: { kind: 'template' },
      ownerUserId: 'user-1',
      officeAction: false,
      paymentExpected: false,
      status: 'in_preparation',
      tags: [],
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      updatedBy: '',
      version: 1,
    };

    it('returns due_today on exact match', () => {
      expect(dueState(task, '2026-10-25')).toBe('due_today');
    });

    it('returns overdue when date is past', () => {
      expect(dueState(task, '2026-10-26')).toBe('overdue');
    });

    it('returns due_soon within window', () => {
      expect(dueState(task, '2026-10-20', 7)).toBe('due_soon');
    });

    it('returns ok beyond window', () => {
      expect(dueState(task, '2026-10-10', 7)).toBe('ok');
    });
  });

  describe('visitItemReadiness & visitReadiness', () => {
    const item: VisitItem = {
      id: 'vi-1',
      visitId: 'v-1',
      taskId: 't-1',
      clientId: 'c-1',
      intendedAction: 'submit',
      isFirstVisitForTask: true,
      evidenceDocumentIds: [],
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      updatedBy: '',
      version: 1,
      orgId: 'org-1',
    };

    const task: Task = {
      id: 't-1',
      orgId: 'org-1',
      clientId: 'c-1',
      kind: 'filing',
      dueDate: '2026-10-28',
      dueSource: { kind: 'template' },
      ownerUserId: 'u-1',
      officeAction: true,
      paymentExpected: false,
      status: 'ready_next_step',
      tags: [],
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      updatedBy: '',
      version: 1,
    };

    it('flags unaccepted required lines and missing authorisations', () => {
      const lines: TaskLine[] = [
        {
          id: 'l-1',
          taskId: 't-1',
          clientId: 'c-1',
          label: 'Photocopy of 2307',
          required: true,
          copyForm: 'photocopy',
          suppliedBy: 'client',
          printAndBring: true,
          status: 'requested',
          sortOrder: 1,
          lateDiscovered: false,
          documentIds: [],
          createdAt: '',
          createdBy: '',
          updatedAt: '',
          updatedBy: '',
          version: 1,
          orgId: 'org-1',
        },
      ];

      const readiness = visitItemReadiness(item, task, lines, [], '2026-10-26', 'RSP Law');
      expect(readiness.ready).toBe(false);
      expect(readiness.reasons.length).toBe(2); // unaccepted line + missing SPA
    });
  });

  describe('period calculations', () => {
    it('creates accurate period keys and ranges', () => {
      expect(periodKey('monthly', 2026, 9)).toBe('2026-09');
      expect(periodKey('quarterly', 2026, 3)).toBe('2026-Q3');
      expect(periodLabel('2026-09')).toBe('Sep 2026');
      expect(periodLabel('2026-Q3')).toBe('Q3 2026');

      const range = periodRange('2026-09');
      expect(range.start).toBe('2026-09-01');
      expect(range.end).toBe('2026-09-30');
    });
  });

  describe('canFinishVisit (product rule 3)', () => {
    const item = (id: string, outcome?: VisitItem['outcome']) => ({ id, outcome }) as Pick<VisitItem, 'id' | 'outcome'>;

    it('is true only when every item has a saved outcome', () => {
      expect(canFinishVisit([item('a', 'completed'), item('b', 'not_accepted')])).toBe(true);
    });

    it('is false when any item has no saved outcome', () => {
      expect(canFinishVisit([item('a', 'completed'), item('b')])).toBe(false);
      expect(canFinishVisit([item('a')])).toBe(false);
    });
  });

  describe('canSetStatus (spec table 16.4)', () => {
    const baseTask: Task = {
      id: 't', orgId: 'o', clientId: 'c', kind: 'filing', dueDate: '2026-10-31', dueSource: { kind: 'template' },
      ownerUserId: 'u', officeAction: false, paymentExpected: false, status: 'in_preparation', tags: [],
      createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', version: 1,
    };
    const line = (status: TaskLine['status']): TaskLine => ({
      id: 'l', orgId: 'o', taskId: 't', clientId: 'c', label: 'Doc', required: true, copyForm: 'digital',
      suppliedBy: 'client', printAndBring: false, status, sortOrder: 1, lateDiscovered: false, documentIds: [],
      createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', version: 1,
    });
    const accepted = [line('accepted')];
    const allStatuses = [
      'intake', 'waiting_on_client', 'review_required', 'needs_correction', 'in_preparation', 'ready_for_review',
      'ready_next_step', 'submitted', 'awaiting_follow_up', 'completed', 'archived',
    ] as const;
    const withStatus = (status: Task['status']): Task => ({ ...baseTask, status });
    const allowed = (from: Task['status'], role: 'owner' | 'helper' = 'owner') =>
      allStatuses.filter((to) => to !== from && canSetStatus(withStatus(from), accepted, to, role));

    it('B04 blocked task accepts no manual target for any role', () => {
      for (const lineStatus of ['not_requested', 'requested', 'received', 'under_review', 'incomplete', 'needs_correction'] as const) {
        for (const role of ['owner', 'helper'] as const) {
          for (const to of allStatuses) {
            expect(canSetStatus(baseTask, [line(lineStatus)], to, role), lineStatus + ' ' + role + ' -> ' + to).toBe(false);
          }
        }
      }
    });

    it('In preparation -> Ready for review, Ready for next step', () => {
      expect(allowed('in_preparation')).toEqual(['ready_for_review', 'ready_next_step']);
    });
    it('Ready for review -> In preparation, Ready for next step', () => {
      expect(allowed('ready_for_review')).toEqual(['in_preparation', 'ready_next_step']);
    });
    it('Ready for next step -> In preparation, Submitted, Completed', () => {
      expect(allowed('ready_next_step')).toEqual(['in_preparation', 'submitted', 'completed']);
    });
    it('Submitted -> Awaiting follow-up, Completed', () => {
      expect(allowed('submitted')).toEqual(['awaiting_follow_up', 'completed']);
    });
    it('Awaiting follow-up -> Submitted, Completed', () => {
      expect(allowed('awaiting_follow_up')).toEqual(['submitted', 'completed']);
    });
    it('Completed -> In preparation (reopen)', () => {
      expect(allowed('completed')).toEqual(['in_preparation']);
    });
    it('Archived -> restore is owner only', () => {
      expect(allowed('archived', 'owner').length).toBeGreaterThan(0);
      expect(allowed('archived', 'helper')).toEqual([]);
    });
  });

  describe('canCompleteWithEvidence (spec 12.7)', () => {
    it('is true with evidence, regardless of reason', () => {
      expect(canCompleteWithEvidence(true)).toBe(true);
    });
    it('without evidence needs a reason of at least 10 characters', () => {
      expect(canCompleteWithEvidence(false)).toBe(false);
      expect(canCompleteWithEvidence(false, 'too short')).toBe(false);
      expect(canCompleteWithEvidence(false, '   ok       ')).toBe(false);
      expect(canCompleteWithEvidence(false, 'Client collected the stamped copy himself')).toBe(true);
    });
  });
});

describe('packList copies (B22)', () => {
  const line = (id: string, copyForm: CopyForm, copies?: number): TaskLine => ({
    id, orgId: 'o', taskId: 't', clientId: 'c', label: id, required: true, copyForm, copies, suppliedBy: 'client',
    printAndBring: true, status: 'accepted', sortOrder: 1, lateDiscovered: false, documentIds: [],
    createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', version: 1,
  });

  it('defaults to 1 copy when the line has none, including for Originals, and keeps the template value otherwise', () => {
    const visit = { packedLineIds: [], packedKitItemIds: [] } as unknown as Visit;
    const items = [{ taskId: 't', clientId: 'c' }] as unknown as VisitItem[];
    const lines = [line('orig', 'original'), line('photo-unset', 'photocopy'), line('photo-3', 'photocopy', 3), line('cert-2', 'certified_true_copy', 2)];
    const pack = packList(visit, items, { t: lines }, [], { c: { id: 'c', displayName: 'Client' } as never });
    const copies = Object.fromEntries(pack.clientPacks[0].items.map((i) => [i.label, i.copies]));
    expect(copies).toEqual({ orig: 1, 'photo-unset': 1, 'photo-3': 3, 'cert-2': 2 });
  });
});
