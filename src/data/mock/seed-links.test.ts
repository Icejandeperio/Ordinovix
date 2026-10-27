import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories, mockDevControls } from './index';

describe('B09 seeded notification and activity references point at existing records', () => {
  beforeEach(() => {
    mockDevControls.reset();
    mockDevControls.setPersona('owner');
  });

  it('every notification link to a task, visit or client resolves', async () => {
    const { items } = await mockRepositories.notifications.list();
    expect(items.length).toBeGreaterThan(0);
    for (const n of items) {
      const m = n.link.match(/^\/(tasks|visits|clients)\/([^/?#]+)/);
      if (!m) continue;
      const lookup =
        m[1] === 'tasks' ? mockRepositories.tasks.get(m[2])
        : m[1] === 'visits' ? mockRepositories.visits.get(m[2])
        : mockRepositories.clients.get(m[2]);
      await expect(lookup, `notification ${n.id} -> ${n.link}`).resolves.toBeDefined();
    }
  });

  it('every seeded activity event references an existing task, visit or client', async () => {
    const [events, tasks, visits, clients] = await Promise.all([
      mockRepositories.activity.list({}),
      mockRepositories.tasks.list({}),
      mockRepositories.visits.list({}),
      mockRepositories.clients.list({}),
    ]);
    const taskIds = new Set(tasks.items.map((s) => s.task.id));
    const visitIds = new Set(visits.items.map((s) => s.visit.id));
    const clientIds = new Set(clients.items.map((s) => s.client.id));
    expect(events.items.length).toBeGreaterThan(0);
    for (const e of events.items) {
      if (e.entity === 'task') expect(taskIds.has(e.entityId), `activity ${e.id} -> task ${e.entityId}`).toBe(true);
      if (e.entity === 'visit') expect(visitIds.has(e.entityId), `activity ${e.id} -> visit ${e.entityId}`).toBe(true);
      if (e.clientId) expect(clientIds.has(e.clientId), `activity ${e.id} -> client ${e.clientId}`).toBe(true);
    }
  });
});
