import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories, mockDevControls } from './index';
import { canSetStatus, derivedStatus, isLateDiscovered } from '@/domain/rules';
import type { Task, TaskLine, CopyForm } from '@/domain/types';

describe('mockRepositories.tasks and Task Domain Rules (M4)', () => {
  beforeEach(() => {
    mockDevControls.setPersona('owner');
  });

  it('calculates derived status from checklist lines accurately', async () => {
    const listRes = await mockRepositories.tasks.list();
    expect(listRes.items.length).toBeGreaterThan(0);

    const firstSummary = listRes.items[0];
    const taskDetail = await mockRepositories.tasks.get(firstSummary.task.id);

    // Derived status should match rules.derivedStatus
    const computed = derivedStatus(taskDetail.task, taskDetail.lines);
    expect(taskDetail.summary.displayedStatus).toBe(computed);
  });

  it('strictly enforces status transition rules (canSetStatus): blocked task cannot advance to ready', () => {
    const dummyTask: Task = {
      id: 'task-test-1',
      orgId: 'org-1',
      clientId: 'client-1',
      kind: 'filing',
      dueDate: '2026-10-31',
      dueSource: { kind: 'template' },
      ownerUserId: 'user-ana',
      officeAction: false,
      paymentExpected: false,
      status: 'in_preparation',
      tags: [],
      createdAt: '2026-10-24T00:00:00+08:00',
      createdBy: 'user-ana',
      updatedAt: '2026-10-24T00:00:00+08:00',
      updatedBy: 'user-ana',
      version: 1,
    };

    const blockingLines: TaskLine[] = [
      {
        id: 'line-1',
        orgId: 'org-1',
        taskId: 'task-test-1',
        clientId: 'client-1',
        label: 'Signed Return Schedule',
        required: true,
        copyForm: 'digital',
        suppliedBy: 'client',
        printAndBring: false,
        status: 'requested', // NOT accepted -> blocks task
        sortOrder: 1,
        lateDiscovered: false,
        documentIds: [],
        createdAt: '2026-10-24T00:00:00+08:00',
        createdBy: 'user-ana',
        updatedAt: '2026-10-24T00:00:00+08:00',
        updatedBy: 'user-ana',
        version: 1,
      },
    ];

    // Helper cannot set ready_next_step when lines block it
    expect(canSetStatus(dummyTask, blockingLines, 'ready_next_step', 'helper')).toBe(false);

    // After lines are accepted, helper can advance
    const acceptedLines: TaskLine[] = [
      {
        ...blockingLines[0],
        status: 'accepted',
      },
    ];
    expect(canSetStatus(dummyTask, acceptedLines, 'ready_next_step', 'helper')).toBe(true);
  });

  it('allows owner to override task status with audit trail', async () => {
    mockDevControls.setPersona('owner');
    const listRes = await mockRepositories.tasks.list();
    const task = listRes.items[0].task;

    const overridden = await mockRepositories.tasks.override(
      task.id,
      'ready_next_step',
      'Client confirmed withholding figures via certified letter'
    );

    expect(overridden.statusOverride).toBeDefined();
    expect(overridden.statusOverride?.status).toBe('ready_next_step');
    expect(overridden.statusOverride?.reason).toContain('Client confirmed withholding');

    // Clears override cleanly
    const cleared = await mockRepositories.tasks.clearOverride(task.id, 'Reset back to standard flow');
    expect(cleared.statusOverride).toBeUndefined();
  });

  it('updates task due date with statutory source reference and note', async () => {
    mockDevControls.setPersona('owner');
    const listRes = await mockRepositories.tasks.list();
    const task = listRes.items[0].task;

    const updated = await mockRepositories.tasks.changeDue(
      task.id,
      '2026-11-15',
      'RMC 45-2026 Extension',
      'BIR nationwide filing server maintenance grace period'
    );

    expect(updated.dueDate).toBe('2026-11-15');
    expect(updated.dueSource.kind).toBe('override');
    expect(updated.dueSource.ref).toBe('RMC 45-2026 Extension');
  });

  it('guarantees open period idempotence (no duplicates created when run twice)', async () => {
    // 1. Preview open period for month 2026-09
    const preview = await mockRepositories.tasks.previewOpenPeriod('2026-09', ['client-rsp', 'client-vtl']);
    expect(preview.applicableTasks.length).toBeGreaterThanOrEqual(0);

    // 2. Open period with selections
    const plan = {
      period: '2026-09',
      selections: preview.applicableTasks.map((t) => ({
        clientId: t.clientId,
        templateId: t.templateId,
        dueDate: t.calculatedDue,
      })),
    };

    const firstRun = await mockRepositories.tasks.openPeriod(plan);

    // 3. Second run with same plan should skip existing tasks
    const secondRun = await mockRepositories.tasks.openPeriod(plan);
    expect(secondRun.created.length).toBe(0);
    expect(secondRun.skipped).toBe(plan.selections.length);
  });

  it('detects "Added late" requirement line when added within 3 days of due date', () => {
    const today = '2026-10-25';

    // Due in 2 days (within 3 days window) -> should be detected as late discovered
    const urgentTask: Task = {
      id: 'task-urgent',
      orgId: 'org-1',
      clientId: 'client-1',
      kind: 'filing',
      dueDate: '2026-10-27', // 2 days away
      dueSource: { kind: 'template' },
      ownerUserId: 'user-ana',
      officeAction: false,
      paymentExpected: false,
      status: 'in_preparation',
      tags: [],
      createdAt: '2026-10-24T00:00:00+08:00',
      createdBy: 'user-ana',
      updatedAt: '2026-10-24T00:00:00+08:00',
      updatedBy: 'user-ana',
      version: 1,
    };

    expect(isLateDiscovered(urgentTask, today, 3)).toBe(true);

    // Due in 15 days -> not late
    const relaxedTask: Task = {
      ...urgentTask,
      dueDate: '2026-11-10',
    };
    expect(isLateDiscovered(relaxedTask, today, 3)).toBe(false);
  });
});
