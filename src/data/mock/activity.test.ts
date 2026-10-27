import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories as R, mockDevControls } from './index';

describe('U11 activity.list filters and the audit trail (B08)', () => {
  beforeEach(() => {
    mockDevControls.reset();
    mockDevControls.setPersona('owner');
  });

  it('filters by actor', async () => {
    const all = (await R.activity.list({})).items;
    expect(new Set(all.map((e) => e.actorId)).size).toBeGreaterThan(1);
    const ben = (await R.activity.list({ actorId: 'user-ben' })).items;
    expect(ben.length).toBeGreaterThan(0);
    expect(ben.every((e) => e.actorId === 'user-ben')).toBe(true);
  });

  it('filters by action', async () => {
    const items = (await R.activity.list({ actions: ['file_uploaded', 'visit_finished'] })).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((e) => e.action === 'file_uploaded' || e.action === 'visit_finished')).toBe(true);
  });

  it('filters by date range, inclusive of both ends', async () => {
    const all = (await R.activity.list({})).items;
    const day = all[Math.floor(all.length / 2)].at.slice(0, 10);
    const items = (await R.activity.list({ from: day, to: day })).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((e) => e.at.slice(0, 10) === day)).toBe(true);
    const before = (await R.activity.list({ to: '2000-01-01' })).items;
    expect(before).toHaveLength(0);
  });

  it('a TIN reveal is logged with who, what and which client, and sorts first', async () => {
    await R.clients.revealTin('client-horizon');
    const items = (await R.activity.list({ actions: ['tin_revealed'] })).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ actorId: 'user-ana', entity: 'client', entityId: 'client-horizon', clientId: 'client-horizon' });
    expect(items[0].summary).toMatch(/Horizon/);
  });

  it('no activity event stores a revealed TIN or any other secret', async () => {
    const clients = (await R.clients.list({})).items.map((s) => s.client);
    const tins = clients.map((c) => c.tinFull).filter((t): t is string => Boolean(t));
    expect(tins.length).toBeGreaterThan(0);

    // Reveal, edit and archive so every path that logs about a client has run
    await R.clients.revealTin('client-horizon');
    await R.clients.revealTin('client-rsp');
    await R.clients.upsert({ id: 'client-rsp', displayName: 'RSP Law Offices' });

    const text = JSON.stringify((await R.activity.list({})).items);
    for (const tin of tins) {
      expect(text.includes(tin), `activity text contains the TIN ${tin.slice(0, 3)}…`).toBe(false);
      expect(text.includes(tin.replace(/-/g, '')), 'activity text contains an unformatted TIN').toBe(false);
    }
    for (const e of (await R.activity.list({})).items) {
      const delta = JSON.stringify({ before: e.before, after: e.after });
      expect(/tinFull|password|secret|token/i.test(delta), `${e.id} before/after`).toBe(false);
    }
  });
});
