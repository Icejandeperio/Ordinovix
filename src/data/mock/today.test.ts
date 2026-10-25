import { describe, it, expect } from 'vitest';
import { mockRepositories, mockDevControls } from './index';

describe('mockRepositories.today.queue', () => {
  it('loads today queue without throwing', async () => {
    const queue = await mockRepositories.today.queue('everyone');
    expect(queue).toBeDefined();
    expect(queue.counts).toBeDefined();
  });

  it('filters strictly by allowed clients when persona is helper (Ben)', async () => {
    // Switch to helper persona
    mockDevControls.setPersona('helper');
    const queue = await mockRepositories.today.queue('mine');
    
    // Check that only Ben's assigned clients appear
    const allowedClientIds = ['client-rsp', 'client-cruz'];
    for (const t of queue.overdueTasks) {
      expect(allowedClientIds).toContain(t.client.id);
    }
    for (const t of queue.dueTodayTasks) {
      expect(allowedClientIds).toContain(t.client.id);
    }
    for (const t of queue.dueSoonTasks) {
      expect(allowedClientIds).toContain(t.client.id);
    }
    for (const r of queue.reviewRequiredLines) {
      expect(allowedClientIds).toContain(r.client.id);
    }
    for (const b of queue.blockedByClient) {
      expect(allowedClientIds).toContain(b.client.id);
    }
    for (const fu of queue.followUpsDue) {
      expect(allowedClientIds).toContain(fu.client.id);
    }
    for (const a of queue.authorizationsExpiring) {
      expect(allowedClientIds).toContain(a.client.id);
    }

    // Reset back to owner
    mockDevControls.setPersona('owner');
  });
});
