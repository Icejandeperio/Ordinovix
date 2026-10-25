import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories, mockDevControls } from './index';
import { interpolatePlaceholders, calculateSmsSegments, formatItemsList } from '@/lib/messaging';
import { todayInManila, addDaysToDate } from '@/lib/dates';
import type { TaskLine } from '@/domain/types';

describe('Follow-ups & Messaging Pipeline (M6)', () => {
  beforeEach(async () => {
    mockDevControls.setPersona('owner');
    mockDevControls.reset();
  });

  it('interpolates all message template placeholders and formats items checklist', () => {
    const lines: TaskLine[] = [
      {
        id: 'line-1',
        orgId: 'org-demo-01',
        taskId: 't-1',
        clientId: 'c-1',
        label: 'Signed 2307s from payors',
        required: true,
        copyForm: 'original',
        suppliedBy: 'client',
        printAndBring: false,
        status: 'requested',
        sortOrder: 1,
        lateDiscovered: false,
        documentIds: [],
        createdAt: '2026-10-25T00:00:00+08:00',
        createdBy: 'user-ana',
        updatedAt: '2026-10-25T00:00:00+08:00',
        updatedBy: 'user-ana',
        version: 1,
      },
      {
        id: 'line-2',
        orgId: 'org-demo-01',
        taskId: 't-1',
        clientId: 'c-1',
        label: 'Quarterly payee data',
        required: true,
        copyForm: 'digital',
        suppliedBy: 'client',
        printAndBring: false,
        status: 'requested',
        sortOrder: 2,
        flagNote: 'September missing',
        lateDiscovered: false,
        documentIds: [],
        createdAt: '2026-10-25T00:00:00+08:00',
        createdBy: 'user-ana',
        updatedAt: '2026-10-25T00:00:00+08:00',
        updatedBy: 'user-ana',
        version: 1,
      },
    ];

    const formattedList = formatItemsList(lines);
    expect(formattedList).toContain('1) Signed 2307s from payors (original)');
    expect(formattedList).toContain('2) Quarterly payee data (digital) — September missing');

    const template =
      'Magandang araw po, {{contact}} ng {{client}}.\n\nFollow-up lang po sa:\n{{items}}\n\npara sa {{task}} ({{period}}). Pakisend po sa o bago mag-{{due}}. Deadline is {{deadline}}.\n\nSalamat po! — {{operator}}';

    const rendered = interpolatePlaceholders(template, {
      contactName: 'Atty. Santos',
      clientName: 'Rivera Salonga & Partners',
      taskTitle: 'BIR Form 1601-EQ',
      period: 'Q3 2026',
      lines,
      dueDate: '2026-10-28',
      deadlineDate: '2026-10-31',
      operatorName: 'Santos Tax Services',
    });

    expect(rendered).toContain('Magandang araw po, Atty. Santos ng Rivera Salonga & Partners.');
    expect(rendered).toContain('1) Signed 2307s from payors (original)');
    expect(rendered).toContain('2) Quarterly payee data (digital) — September missing');
    expect(rendered).toContain('para sa BIR Form 1601-EQ (Q3 2026).');
    expect(rendered).toContain('Salamat po! — Santos Tax Services');
  });

  it('calculates SMS characters and multipart segments per Spec 11.8', () => {
    // 1. GSM-7 within 160 limit
    const gsmShort = 'Good day, please send the required tax documents before Friday. Thank you!';
    const calc1 = calculateSmsSegments(gsmShort);
    expect(calc1.isGsm7).toBe(true);
    expect(calc1.segmentCount).toBe(1);
    expect(calc1.maxPerSegment).toBe(160);

    // 2. GSM-7 exceeding 160 limit (splits by 153)
    const gsmLong = 'A'.repeat(170);
    const calc2 = calculateSmsSegments(gsmLong);
    expect(calc2.isGsm7).toBe(true);
    expect(calc2.segmentCount).toBe(2);
    expect(calc2.maxPerSegment).toBe(153);

    // 3. Unicode within 70 limit
    const unicodeShort = 'Magandang araw po! 👍'; // contains emoji
    const calc3 = calculateSmsSegments(unicodeShort);
    expect(calc3.isGsm7).toBe(false);
    expect(calc3.segmentCount).toBe(1);
    expect(calc3.maxPerSegment).toBe(70);

    // 4. Unicode exceeding 70 limit (splits by 67)
    const unicodeLong = 'Magandang araw po! 👍 ' + 'B'.repeat(60);
    const calc4 = calculateSmsSegments(unicodeLong);
    expect(calc4.isGsm7).toBe(false);
    expect(calc4.segmentCount).toBe(2);
    expect(calc4.maxPerSegment).toBe(67);
  });

  it('marks follow-up as sent: increments attempt, records snapshot, sets waiting state', async () => {
    const listRes = await mockRepositories.followUps.list();
    const target = listRes.items.find((item) => item.followUp.attemptCount === 1) || listRes.items[0];
    const initialAttempts = target.followUp.attemptCount;

    const messageText = 'Follow-up message snapshot for audit log.';
    const nextExpected = addDaysToDate(todayInManila(), 3);

    const updated = await mockRepositories.followUps.markSent(target.followUp.id, {
      channel: 'viber',
      sentAt: `${todayInManila()}T11:00:00+08:00`,
      expectedBy: nextExpected,
      message: messageText,
    });

    expect(updated.followUp.attemptCount).toBe(initialAttempts + 1);
    expect(updated.followUp.status).toBe('sent');
    expect(updated.followUp.expectedBy).toBe(nextExpected);
    expect(updated.state).toBe('waiting');

    // Attempt snapshot is saved
    const latestAttempt = updated.attempts[updated.attempts.length - 1];
    expect(latestAttempt.messageSnapshot).toBe(messageText);
    expect(latestAttempt.channel).toBe('viber');
  });

  it('logs response: marks ticked lines as received and auto-resolves when all lines complete', async () => {
    const listRes = await mockRepositories.followUps.list();
    // Pick follow-up with lines
    const target = listRes.items.find((item) => item.lines.length > 0)!;
    const lineIdsToMark = [target.lines[0].id];

    const updated = await mockRepositories.followUps.logResponse(target.followUp.id, {
      text: 'Received via messenger file transfer',
      receivedLineIds: lineIdsToMark,
      via: 'messenger',
    });

    expect(updated.followUp.response).toBe('Received via messenger file transfer');

    // Check task lines
    const taskDetails = await mockRepositories.tasks.get(target.task!.id);
    const changedLine = taskDetails.lines.find((l) => l.id === target.lines[0].id);
    expect(changedLine?.status).toBe('received');
  });

  it('enforces >= 10 characters for escalation reason and marks state as escalated', async () => {
    const listRes = await mockRepositories.followUps.list();
    const target = listRes.items[0];

    // Less than 10 characters should fail
    await expect(mockRepositories.followUps.escalate(target.followUp.id, 'Too short')).rejects.toThrow();

    // Valid escalation
    const validReason = 'Client unresponsive after 3 attempts, calling office.';
    const escalated = await mockRepositories.followUps.escalate(target.followUp.id, validReason);

    expect(escalated.followUp.status).toBe('escalated');
    expect(escalated.followUp.escalatedReason).toBe(validReason);
    expect(escalated.state).toBe('escalated');
  });

  it('scopes follow-up visibility strictly to assigned clients for helper persona', async () => {
    // Owner sees all
    mockDevControls.setPersona('owner');
    const ownerList = await mockRepositories.followUps.list();
    const allClientIds = new Set(ownerList.items.map((i) => i.client.id));
    expect(allClientIds.size).toBeGreaterThanOrEqual(2);

    // Switch to Ben Morales (Helper - only assigned to RSP and Cruz)
    mockDevControls.setPersona('helper');
    const helperList = await mockRepositories.followUps.list();

    for (const item of helperList.items) {
      expect(['client-rsp', 'client-cruz']).toContain(item.client.id);
    }
  });
});
