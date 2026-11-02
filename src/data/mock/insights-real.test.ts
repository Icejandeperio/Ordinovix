import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories as R, mockDevControls } from './index';

const RANGE = { from: '2026-06-01', to: '2026-09-30' };

describe('U12 Insights are computed from the data (B20)', () => {
  beforeEach(() => {
    mockDevControls.reset();
    mockDevControls.setPersona('owner');
  });

  it('the date range sets the months of every monthly series', async () => {
    const trips = await R.insights.get('trips', RANGE);
    expect(trips.months).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
    expect(trips.visitsByMonth.map((r) => r.month)).toEqual(trips.months);
    const narrow = await R.insights.get('trips', { from: '2026-09-01', to: '2026-09-30' });
    expect(narrow.months).toEqual(['2026-09']);
    expect(narrow.totalTrips).toBe(trips.visitsByMonth.find((r) => r.month === '2026-09')!.count);
    expect(narrow.totalTrips).toBeLessThan(trips.totalTrips);
  });

  it('the visit total equals the sum of its monthly bars', async () => {
    const trips = await R.insights.get('trips', RANGE);
    expect(trips.visitsByMonth.reduce((s, r) => s + r.count, 0)).toBe(trips.totalTrips);
    expect(trips.offices.reduce((s, o) => s + o.visits, 0)).toBe(trips.totalTrips);
  });

  it('the client filter narrows every tab to that client', async () => {
    const all = await R.insights.get('trips', RANGE);
    const rsp = await R.insights.get('trips', { ...RANGE, clientId: 'client-rsp' });
    expect(rsp.totalTrips).toBeGreaterThan(0);
    expect(rsp.totalTrips).toBeLessThanOrEqual(all.totalTrips);
    const clients = await R.insights.get('clients', { ...RANGE, clientId: 'client-rsp' });
    expect(clients.rows.map((r) => r.clientId)).toEqual(['client-rsp']);
    const workload = await R.insights.get('workload', { clientId: 'client-rsp' });
    const everyone = await R.insights.get('workload', {});
    expect(workload.openByPerson.reduce((s, p) => s + p.value, 0)).toBeLessThan(everyone.openByPerson.reduce((s, p) => s + p.value, 0));
  });

  it('the owner filter keeps only that person\'s tasks', async () => {
    const ben = await R.insights.get('workload', { assignedUserId: 'user-ben' });
    expect(ben.openByPerson.map((p) => p.userId)).toEqual(['user-ben']);
    expect(ben.missingNextAction.every((t) => t.ownerName === 'Ben Morales')).toBe(true);
  });

  it('the template filter keeps only that template', async () => {
    const all = await R.insights.get('workload', {});
    expect(all.daysToCollectByTemplate.length).toBeGreaterThan(1);
    const one = await R.insights.get('workload', { templateId: 'tmpl-1601c' });
    expect(one.daysToCollectByTemplate.map((t) => t.templateId)).toEqual(['tmpl-1601c']);
  });

  it('a pulse saved by the owner shows up in the confidence and hours charts', async () => {
    const before = await R.insights.get('overview', { from: '2026-10-01', to: '2026-10-27' });
    expect(before.confidenceByMonth).toEqual([{ month: '2026-10', value: null }]);
    expect(before.takeaways.confidence).toBe('Not enough data yet.');
    await R.pulses.save({ month: '2026-10', hoursFindingLastWeek: 3, confidence: 4 });
    const after = await R.insights.get('overview', { from: '2026-10-01', to: '2026-10-27' });
    expect(after.confidenceByMonth).toEqual([{ month: '2026-10', value: 4 }]);
    expect(after.hoursFindingByMonth).toEqual([{ month: '2026-10', value: 3 }]);
  });

  it('the owner baseline appears as the self-reported baseline', async () => {
    await R.baseline.save({ tripsPerMonth: 20, repeatTripsPerMonth: 5, followUpsPerWeek: 12, lateFilingsPerQuarter: 2 });
    const o = await R.insights.get('overview', RANGE);
    expect(o.firstPassBaseline).toBe(75);
    expect(o.kpis.find((k) => k.key === 'firstPass')!.note).toContain('self-reported before Ordinovix');
    expect(o.kpis.find((k) => k.key === 'repeatTrips')!.note).toContain('5/month');
  });

  it('a helper only sees the numbers of the assigned clients', async () => {
    const owner = await R.insights.get('trips', RANGE);
    const ownerClients = await R.insights.get('clients', RANGE);
    const ownerWorkload = await R.insights.get('workload', {});
    mockDevControls.setPersona('helper');
    const trips = await R.insights.get('trips', RANGE);
    const clients = await R.insights.get('clients', RANGE);
    const workload = await R.insights.get('workload', {});
    expect(trips.totalTrips).toBeLessThan(owner.totalTrips);
    expect(clients.rows.map((r) => r.clientId).sort()).toEqual(['client-cruz', 'client-rsp']);
    expect(ownerClients.rows.length).toBeGreaterThan(clients.rows.length);
    expect(workload.openByPerson.reduce((s, p) => s + p.value, 0)).toBeLessThan(ownerWorkload.openByPerson.reduce((s, p) => s + p.value, 0));
    expect(workload.missingNextAction.every((t) => ['RSP', 'CSL'].includes(t.clientCode))).toBe(true);
  });

  it('a helper filtering to an unassigned client sees nothing, not that client\'s numbers', async () => {
    mockDevControls.setPersona('helper');
    const trips = await R.insights.get('trips', { ...RANGE, clientId: 'client-maria' });
    expect(trips.totalTrips).toBe(0);
    expect(trips.isEmpty).toBe(true);
    const clients = await R.insights.get('clients', { clientId: 'client-maria' });
    expect(clients.rows).toEqual([]);
  });

  it('the heat calendar counts open tasks on the dates they are due', async () => {
    const d = await R.insights.get('deadlines', {});
    expect(d.heatCalendar.length).toBeGreaterThan(0);
    const dates = d.heatCalendar.map((h) => h.date);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
    expect(d.heatCalendar.every((h) => h.taskCount > 0)).toBe(true);
    expect(d.heatStart <= dates[0]).toBe(true);
  });
});
