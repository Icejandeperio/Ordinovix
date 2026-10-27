import { describe, it, expect } from 'vitest';
import { generateSeedData } from './seed';
import { buildDemoData } from './seed-demo';
import { derivedStatus, nonWorkingDayNote, visitItemReadiness, visitReadiness } from '@/domain/rules';
import { countTripsNeedingReturn, calculateFirstPassRate, calculateOnTimeRate } from '@/domain/metrics';
import { addDaysToDate } from '@/lib/dates';
import type { LineStatus, TaskStatus } from '@/domain/types';

const BASES = ['2026-10-27', '2027-03-15']; // a Tuesday and a Monday: every relative rule must hold for any seed day

function build(base: string) {
  const seed = generateSeedData(base);
  const demo = buildDemoData(seed.org.id, base, seed.holidays);
  const holidays = [...seed.holidays, ...demo.holidays];
  return { seed, demo, holidays };
}

describe.each(BASES)('U05 demo seed relative to %s (spec section 18)', (base) => {
  const { seed, demo, holidays } = build(base);
  const allTasks = [...seed.tasks, ...demo.tasks];
  const allLines = [...seed.taskLines, ...demo.taskLines];
  const allVisits = [...seed.visits, ...demo.visits];
  const allItems = [...seed.visitItems, ...demo.visitItems];
  const isHistory = (id: string) => /^task-h\d-/.test(id);
  const open = allTasks.filter((t) => !isHistory(t.id) && t.status !== 'completed' && t.status !== 'archived');

  it('is deterministic', () => {
    expect(JSON.stringify(buildDemoData(seed.org.id, base, seed.holidays))).toBe(JSON.stringify(demo));
  });

  it('keeps every required seed id and its starting state; visit-today still has one item', () => {
    expect(seed.users.map((u) => u.id)).toEqual(expect.arrayContaining(['user-ana', 'user-ben']));
    expect(seed.memberships.find((m) => m.id === 'mem-ben')?.clientIds).toEqual(['client-rsp', 'client-cruz']);
    for (const id of ['client-rsp', 'client-cruz', 'client-maria', 'client-horizon']) expect(seed.clients.some((c) => c.id === id)).toBe(true);
    for (const id of ['task-rsp-0619e', 'task-cruz-1601c', 'task-maria-2550q']) expect(seed.tasks.some((t) => t.id === id)).toBe(true);
    expect(seed.templates.some((t) => t.id === 'tmpl-0619e')).toBe(true);
    expect(seed.offices.some((o) => o.id === 'off-rdo39')).toBe(true);
    expect(allVisits.find((v) => v.id === 'visit-today')?.status).toBe('planned');
    expect(allItems.filter((i) => i.visitId === 'visit-today')).toHaveLength(1);
    // Nothing in the demo data reuses a base id
    const baseIds = new Set([...seed.clients, ...seed.tasks, ...seed.taskLines, ...seed.visits, ...seed.templates].map((x) => x.id));
    for (const x of [...demo.clients, ...demo.tasks, ...demo.taskLines, ...demo.visits, ...demo.templates]) expect(baseIds.has(x.id), x.id).toBe(false);
  });

  it('has 8 clients and 9 sample templates, all unverified', () => {
    expect(seed.clients.length + demo.clients.length).toBe(8);
    const templates = [...seed.templates, ...demo.templates];
    expect(templates).toHaveLength(9);
    expect(templates.every((t) => t.verified === false)).toBe(true);
    expect(demo.clients.some((c) => c.status === 'archived')).toBe(true);
    const amd = demo.clients.find((c) => c.code === 'AMD')!;
    expect(amd.hasTin).toBe(false);
    expect(amd.vatStatus).toBe('unknown');
  });

  it('has about 26 open tasks that show every task status and every line status', () => {
    expect(open.length).toBeGreaterThanOrEqual(24);
    expect(open.length).toBeLessThanOrEqual(30);
    const statuses = new Set<TaskStatus>();
    for (const t of allTasks.filter((x) => !isHistory(x.id))) {
      statuses.add(derivedStatus(t, allLines.filter((l) => l.taskId === t.id)));
    }
    const all: TaskStatus[] = ['intake', 'waiting_on_client', 'review_required', 'needs_correction', 'in_preparation', 'ready_for_review', 'ready_next_step', 'submitted', 'awaiting_follow_up', 'completed', 'archived'];
    for (const s of all) expect(statuses.has(s), `task status ${s}`).toBe(true);
    const lineStatuses = new Set<LineStatus>(allLines.map((l) => l.status));
    for (const s of ['not_requested', 'requested', 'received', 'under_review', 'accepted', 'incomplete', 'needs_correction', 'not_applicable'] as LineStatus[]) {
      expect(lineStatuses.has(s), `line status ${s}`).toBe(true);
    }
    expect(allLines.find((l) => l.status === 'not_applicable')?.naReason).toBeTruthy();
    expect(allLines.some((l) => l.lateDiscovered)).toBe(true);
    expect(allLines.filter((l) => l.status === 'received' && !isHistory(l.taskId)).length).toBeGreaterThanOrEqual(3);
  });

  it('has the overdue and due-soon tasks, one override, and one task per template', () => {
    const overdue = open.filter((t) => t.dueDate < base);
    expect(overdue.map((t) => t.dueDate)).toEqual(expect.arrayContaining([addDaysToDate(base, -2), addDaysToDate(base, -5)]));
    const dueSoon = open.filter((t) => t.dueDate >= base && t.dueDate <= addDaysToDate(base, 7));
    expect(dueSoon.length).toBeGreaterThanOrEqual(3);
    const overridden = allTasks.filter((t) => t.statusOverride);
    expect(overridden).toHaveLength(1);
    expect(overridden[0].statusOverride?.reason).toBe('Payroll unchanged — confirmed by phone');
    const templateIds = new Set(allTasks.map((t) => t.templateId).filter(Boolean));
    for (const t of [...seed.templates, ...demo.templates]) expect(templateIds.has(t.id), t.code).toBe(true);
  });

  it('plans V1 (not ready), V2 (ready) and V3 (done) on working days relative to the seed day', () => {
    const v = (id: string) => allVisits.find((x) => x.id === id)!;
    for (const id of ['visit-v1', 'visit-v2', 'visit-v3']) expect(nonWorkingDayNote(v(id).plannedDate, holidays), id).toBeNull();
    expect(v('visit-v2').plannedDate > base).toBe(true);
    expect(v('visit-v1').plannedDate > v('visit-v2').plannedDate).toBe(true);
    expect(v('visit-v3').plannedDate < base).toBe(true);
    expect(v('visit-v3').status).toBe('done');

    const readiness = (id: string) => {
      const visit = v(id);
      const items = allItems.filter((i) => i.visitId === id).map((i) => {
        const task = allTasks.find((t) => t.id === i.taskId)!;
        const r = visitItemReadiness(i, task, allLines.filter((l) => l.taskId === task.id), [...seed.authorizations, ...demo.authorizations], visit.plannedDate, 'client');
        return { ...r, taskId: task.id, clientName: 'client' };
      });
      return visitReadiness(items);
    };
    const r1 = readiness('visit-v1');
    expect(r1.ready).toBe(false);
    expect(r1.blockingItems.map((b) => b.taskId)).toEqual(expect.arrayContaining(['task-bol-ecar', 'task-vtl-reg']));
    expect(r1.blockingItems.map((b) => b.taskId)).not.toContain('task-rsp-1601eq');
    expect(readiness('visit-v2').ready).toBe(true);

    const v3Items = allItems.filter((i) => i.visitId === 'visit-v3');
    expect(v3Items.some((i) => i.outcome === 'completed' && i.evidenceDocumentIds.length > 0)).toBe(true);
    expect(v3Items.some((i) => i.outcome === 'more_documents_requested' && i.outcomeCause === 'missing_document' && i.avoidable === true)).toBe(true);
  });

  it('no seeded visit falls on a weekend or a seeded holiday', () => {
    for (const v of demo.visits) expect(nonWorkingDayNote(v.plannedDate, holidays), `${v.id} ${v.plannedDate}`).toBeNull();
  });

  it('has the expected spread of follow-ups, payments, documents, notes, activity and baseline', () => {
    expect(demo.notes).toHaveLength(6);
    expect(demo.pulses).toHaveLength(6);
    expect(demo.pulses[0].confidence).toBe(2);
    expect(demo.pulses[5].confidence).toBe(4);
    expect(demo.baseline.tripsPerMonth).toBe(9);
    expect(demo.notifications).toHaveLength(7); // plus the base seed's five unread = twelve
    expect(demo.notifications.every((n) => n.readAt)).toBe(true);
    expect(demo.deadlineMoves[0].sourceRef).toBe('RMC 30-2026');

    const recent = demo.payments.filter((p) => p.paidOn >= addDaysToDate(base, -60));
    expect(recent.length).toBe(7); // plus the base seed's advance payment = eight
    expect(demo.payments.some((p) => p.proofDocumentIds.length === 0 && p.paidOn >= addDaysToDate(base, -60))).toBe(true);

    const docs = demo.documents;
    expect(docs.length + 5).toBeGreaterThanOrEqual(25);
    expect(docs.length + 5).toBeLessThanOrEqual(45);
    expect(docs.some((d) => d.versionNo === 2 && d.replacesId)).toBe(true);
    expect(docs.some((d) => d.createdBy === 'user-ben')).toBe(true);

    expect(demo.activity.length + 3).toBeGreaterThanOrEqual(120);
    const current = demo.followUps.filter((f) => !f.id.startsWith('fu-h'));
    expect(current.length).toBe(3); // plus the base builder's four = seven
    expect(current.some((f) => f.status === 'escalated')).toBe(true);
    for (const f of demo.followUps) {
      const attempts = demo.followUpAttempts.filter((a) => a.followUpId === f.id);
      expect(attempts.length, f.id).toBe(f.attemptCount);
    }
  });

  it('tells the six-month improvement story that Insights can compute', () => {
    const expected = { visits: [9, 8, 7, 6, 6, 5], returns: [6, 5, 4, 3, 2, 2], avoidable: [5, 4, 3, 2, 2, 1] };
    const firstPass: number[] = [];
    const onTime: number[] = [];
    for (let k = 6; k >= 1; k--) {
      const mi = 6 - k;
      const visits = demo.visits.filter((v) => v.id.startsWith(`visit-h${k}-`));
      expect(visits.length, `M-${k} visits`).toBe(expected.visits[mi]);
      const ids = new Set(visits.map((v) => v.id));
      const items = demo.visitItems.filter((i) => ids.has(i.visitId));
      const trips = countTripsNeedingReturn(items);
      expect(trips.total, `M-${k} returns`).toBe(expected.returns[mi]);
      expect(trips.avoidable, `M-${k} avoidable`).toBe(expected.avoidable[mi]);
      firstPass.push(calculateFirstPassRate(items));
      onTime.push(calculateOnTimeRate(demo.tasks.filter((t) => t.id.startsWith(`task-h${k}-`))));
      for (const v of visits) {
        expect(v.status).toBe('done');
        expect((v.costs?.transport ?? 0) >= 15000 && (v.costs?.transport ?? 0) <= 45000).toBe(true);
      }
    }
    // Counts per month are fixed by the spec table, so rounding may wobble a point or two; the trend must still climb
    for (let i = 1; i < firstPass.length; i++) expect(firstPass[i], `first-pass M-${6 - i}`).toBeGreaterThanOrEqual(firstPass[i - 1] - 2);
    expect(firstPass[5] - firstPass[0]).toBeGreaterThanOrEqual(20);
    expect(onTime[5]).toBeGreaterThan(onTime[0]);

    // SCL-like slowest client: CSL takes longer to send documents than the others
    const days = (clientId: string) => {
      const ls = demo.taskLines.filter((l) => l.clientId === clientId && l.requestedAt && l.receivedAt && isHistory(l.taskId));
      const ds = ls.map((l) => (Date.parse(l.receivedAt!.slice(0, 10)) - Date.parse(l.requestedAt!.slice(0, 10))) / 86_400_000);
      return ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length);
    };
    expect(days('client-cruz')).toBeGreaterThan(days('client-rsp') + 2);
  });
});
