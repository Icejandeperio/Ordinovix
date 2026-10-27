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
    const { items } = await mockRepositories.activity.list({});
    for (const e of items) {
      if (e.entity === 'task') await expect(mockRepositories.tasks.get(e.entityId), `activity ${e.id}`).resolves.toBeDefined();
      if (e.entity === 'visit') await expect(mockRepositories.visits.get(e.entityId), `activity ${e.id}`).resolves.toBeDefined();
      if (e.clientId) await expect(mockRepositories.clients.get(e.clientId), `activity ${e.id} client`).resolves.toBeDefined();
    }
  });
});
