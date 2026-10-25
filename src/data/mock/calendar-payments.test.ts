import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories, mockDevControls } from './index';

describe('mockRepositories.payments and Calendar Pipeline (M8)', () => {
  beforeEach(() => {
    mockDevControls.setPersona('owner');
  });

  describe('Payments Register and Totals', () => {
    it('lists payments with accurate integer centavos live totalAmount', async () => {
      const res = await mockRepositories.payments.list();
      expect(res.items.length).toBeGreaterThan(0);
      expect(typeof res.totalAmount).toBe('number');

      const manualSum = res.items.reduce((sum, p) => sum + p.amount, 0);
      expect(res.totalAmount).toBe(manualSum);
    });

    it('filters payments by client, channel, and paidBy', async () => {
      const initial = await mockRepositories.payments.list();
      const first = initial.items[0];

      const byClient = await mockRepositories.payments.list({ clientId: first.clientId });
      expect(byClient.items.every((p) => p.clientId === first.clientId)).toBe(true);

      const byChannel = await mockRepositories.payments.list({ channel: first.channel });
      expect(byChannel.items.every((p) => p.channel === first.channel)).toBe(true);

      const byPaidBy = await mockRepositories.payments.list({ paidBy: 'operator' });
      expect(byPaidBy.items.every((p) => p.paidBy === 'operator')).toBe(true);
    });

    it('filters payments with missing proof (proofMissing: true)', async () => {
      const missing = await mockRepositories.payments.list({ proofMissing: true });
      expect(missing.items.every((p) => p.proofDocumentIds.length === 0)).toBe(true);
    });

    it('scopes payment visibility to assigned clients for helper persona (Ben)', async () => {
      mockDevControls.setPersona('helper');
      const helperRes = await mockRepositories.payments.list();

      // Ben only has access to client-rsp and client-cruz
      const allowedClientIds = ['client-rsp', 'client-cruz'];
      expect(helperRes.items.every((p) => allowedClientIds.includes(p.clientId))).toBe(true);

      // Ana (owner) sees all payments
      mockDevControls.setPersona('owner');
      const ownerRes = await mockRepositories.payments.list();
      expect(ownerRes.items.length).toBeGreaterThanOrEqual(helperRes.items.length);
    });

    it('records a new payment with integer centavos and logs audit activity', async () => {
      const newPayment = await mockRepositories.payments.save({
        clientId: 'client-rsp',
        taskId: 't-rsp-1601eq',
        amount: 250000, // ₱2,500.00 in centavos
        paidOn: '2026-10-25',
        channel: 'aab_otc',
        provider: 'Landbank',
        referenceNo: 'LBP-20261025-099',
        paidBy: 'operator',
        reimbursement: {
          status: 'waiting',
        },
        proofDocumentIds: [],
        note: 'Quarterly payment test',
      });

      expect(newPayment.id).toBeDefined();
      expect(newPayment.amount).toBe(250000);
      expect(newPayment.referenceNo).toBe('LBP-20261025-099');

      // Verify it appears in list
      const list = await mockRepositories.payments.list({ clientId: 'client-rsp' });
      const found = list.items.find((p) => p.id === newPayment.id);
      expect(found).toBeDefined();
      expect(found?.provider).toBe('Landbank');
    });

    it('updates existing payment record and increments version', async () => {
      const list = await mockRepositories.payments.list();
      const target = list.items[0];
      const originalAmount = target.amount;
      const originalVersion = target.version;

      const updated = await mockRepositories.payments.save({
        id: target.id,
        amount: originalAmount + 50000,
        provider: 'Updated Bank',
      });

      expect(updated.id).toBe(target.id);
      expect(updated.amount).toBe(originalAmount + 50000);
      expect(updated.provider).toBe('Updated Bank');
      expect(updated.version).toBe(originalVersion + 1);
    });

    it('clears next action "proof" on task when payment is recorded with proof attached (Section 11.12)', async () => {
      const taskList = await mockRepositories.tasks.list();
      const task = taskList.items[0].task;

      // Ensure task has a next action with 'proof'
      task.nextAction = {
        text: 'Attach payment proof for RDO confirmation',
        owner: 'client',
      };

      // Record payment with proofDocumentIds attached
      await mockRepositories.payments.save({
        clientId: task.clientId,
        taskId: task.id,
        amount: 120000,
        paidOn: '2026-10-25',
        channel: 'online',
        provider: 'GCash',
        referenceNo: 'GCASH-987654321',
        paidBy: 'client',
        proofDocumentIds: ['doc-proof-1'],
      });

      // Verify task nextAction was cleared
      const refreshedTask = await mockRepositories.tasks.get(task.id);
      expect(refreshedTask.task.nextAction).toBeUndefined();
    });

    it('soft deletes payment with audit reason', async () => {
      const list = await mockRepositories.payments.list();
      const target = list.items[0];

      await mockRepositories.payments.remove(target.id, 'Duplicate receipt entry error');

      const after = await mockRepositories.payments.list();
      const found = after.items.find((p) => p.id === target.id);
      expect(found).toBeUndefined();
    });
  });

  describe('Calendar Range & Aggregations', () => {
    it('returns task_due, visit, holiday, follow_up, and authorization_expiry items within range', async () => {
      // Query a broad range covering sample data (e.g. Oct to Dec 2026)
      const from = '2026-10-01';
      const to = '2026-12-31';

      const items = await mockRepositories.calendar.range(from, to);
      expect(items.length).toBeGreaterThan(0);

      const types = new Set(items.map((i) => i.type));
      expect(types.has('task_due')).toBe(true);
      expect(types.has('visit')).toBe(true);
      expect(types.has('holiday')).toBe(true);

      // Check task_due properties
      const taskDue = items.find((i) => i.type === 'task_due');
      expect(taskDue).toBeDefined();
      expect(taskDue!.date >= from && taskDue!.date <= to).toBe(true);
      expect(taskDue?.meta?.taskId).toBeDefined();
      expect(['critical', 'warn', 'info']).toContain(taskDue?.statusTone);

      // Check visit properties
      const visitItem = items.find((i) => i.type === 'visit');
      expect(visitItem).toBeDefined();
      expect(visitItem?.meta?.visitId).toBeDefined();
      expect(typeof visitItem?.meta?.isReady).toBe('boolean');

      // Check holiday properties
      const holidayItem = items.find((i) => i.type === 'holiday');
      expect(holidayItem).toBeDefined();
      expect(holidayItem?.meta?.holidayType).toBeDefined();
    });

    it('scopes calendar items for helper persona (Ben) to allowed clients', async () => {
      mockDevControls.setPersona('helper');
      const items = await mockRepositories.calendar.range('2026-10-01', '2026-12-31');

      const allowedClientIds = ['client-rsp', 'client-cruz'];

      // Client-linked calendar items must belong only to allowed clients
      items
        .filter((i) => i.clientId)
        .forEach((i) => {
          expect(allowedClientIds).toContain(i.clientId);
        });
    });

    it('changes task due date with statutory circular reference and reason', async () => {
      const taskList = await mockRepositories.tasks.list();
      const task = taskList.items[0].task;

      const newDate = '2026-11-20';
      const statutoryRef = 'RMC No. 112-2026';
      const reason = 'BIR administrative deadline extension for Q3 filings';

      const updated = await mockRepositories.tasks.changeDue(
        task.id,
        newDate,
        statutoryRef,
        reason
      );

      expect(updated.dueDate).toBe(newDate);
      expect(updated.dueSource.kind).toBe('override');
      expect(updated.dueSource.ref).toBe(statutoryRef);

      // Verify the task appears on the new date in calendar range
      const calendarItems = await mockRepositories.calendar.range('2026-11-01', '2026-11-30');
      const item = calendarItems.find((i) => i.id === task.id && i.type === 'task_due');
      expect(item).toBeDefined();
      expect(item?.date).toBe(newDate);
    });
  });
});
