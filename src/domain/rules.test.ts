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
} from './rules';
import type { Task, TaskLine, Authorization, FollowUp, Holiday, TaskTemplate, Client, VisitItem } from './types';

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
});
