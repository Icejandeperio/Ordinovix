import { describe, expect, it } from 'vitest';
import { createCommands } from './commands';
import { buildInitialStore } from './mock';
import { visitIsReady } from '@/domain/events';
import { RuleViolationError } from '@/domain/rules';
import { todayInManila } from '@/lib/dates';
import type { Notification } from '@/domain/types';

/**
 * U35: the notifications that actions cause (spec 14), made by the shared commands, so the mock and the Worker agree. Each test runs a
 * real command against the seed as a person and reads what was added to the store.
 */
const today = todayInManila();
type Store = ReturnType<typeof buildInitialStore>;

function as(persona: 'owner' | 'helper', mutate?: (s: Store) => void) {
  const store = buildInitialStore(today);
  mutate?.(store);
  const membership = store.memberships.find((m) => m.role === persona)!;
  const user = store.users.find((u) => u.id === membership.userId)!;
  const cmd = createCommands({ store, user, membership });
  const ids = new Set(store.notifications.map((n) => n.id));
  const made = (): Notification[] => store.notifications.filter((n) => !ids.has(n.id));
  return { store, cmd, made };
}

/** Where a notification's link leads: the record must exist (spec 14: each notification links to its record). */
function linkExists(store: Store, link: string): boolean {
  const [, area, id] = link.split('/');
  if (area === 'tasks') return store.tasks.some((t) => t.id === id);
  if (area === 'visits') return store.visits.some((v) => v.id === id);
  return false;
}

const withRequestedLine = (s: Store) => {
  // a requested line of an RSP task that the owner (Ana) looks after, so a helper can mark it received
  s.taskLines.find((l) => l.id === 'line-rsp-2')!.status = 'requested';
};

describe('U35 Received, needs review', () => {
  it('a helper marking a line received tells the task owner, with a lock-screen-safe title and a fuller body', async () => {
    const { store, cmd, made } = as('helper', withRequestedLine);
    await cmd.lines.setStatus('line-rsp-2', 'received');
    expect(made()).toHaveLength(1);
    const n = made()[0];
    expect(n).toMatchObject({ userId: 'user-ana', type: 'received_needs_review', link: '/tasks/task-rsp-0619e', entity: 'task', entityId: 'task-rsp-0619e', createdBy: 'system', orgId: store.org.id });
    expect(n.body).toContain('Ben');
    expect(n.body).toContain('Signed Form 2307 Certificates');
    expect(n.title).toContain('RSP');
    expect(n.title).not.toContain('Ben');
    expect(linkExists(store, n.link)).toBe(true);
  });

  it('an upload by a helper that moves a line to received does the same', async () => {
    const { store, cmd, made } = as('helper', withRequestedLine);
    const files = { keyFor: () => 'k', put: async () => undefined, urlFor: async () => 'blob:x' };
    const withFiles = createCommands({ store, user: store.users.find((u) => u.id === 'user-ben')!, membership: store.memberships.find((m) => m.id === 'mem-ben')!, files });
    void cmd;
    await withFiles.documents.upload(
      { clientId: 'client-rsp', taskId: 'task-rsp-0619e', lineId: 'line-rsp-2', kind: 'other', source: 'upload' } as never,
      new File(['%PDF-1.4 test'], 'x.pdf', { type: 'application/pdf' }),
    );
    expect(store.taskLines.find((l) => l.id === 'line-rsp-2')!.status).toBe('received');
    expect(made().map((n) => [n.userId, n.type, n.link])).toEqual([['user-ana', 'received_needs_review', '/tasks/task-rsp-0619e']]);
  });

  it('goes to the organization owner when the task owner is the helper and helpers may not accept', async () => {
    const { cmd, made } = as('helper', (s) => {
      s.settings.helpersCanAccept = false;
      s.taskLines.find((l) => l.id === 'line-cruz-1')!.status = 'requested';
    });
    await cmd.lines.setStatus('line-cruz-1', 'received'); // task-cruz-1601c is Ben's own
    expect(made().map((n) => [n.userId, n.type])).toEqual([['user-ana', 'received_needs_review']]);
  });

  it('tells nobody when the helper who may accept marks their own task received, or when the owner does it', async () => {
    const own = as('helper', (s) => (s.taskLines.find((l) => l.id === 'line-cruz-1')!.status = 'requested'));
    await own.cmd.lines.setStatus('line-cruz-1', 'received');
    expect(own.made()).toEqual([]);
    const byOwner = as('owner', withRequestedLine);
    await byOwner.cmd.lines.setStatus('line-rsp-2', 'received');
    expect(byOwner.made()).toEqual([]);
  });

  it('collapses to one per task and day, however many lines arrive', async () => {
    const { cmd, made } = as('helper', (s) => {
      withRequestedLine(s);
      s.taskLines.find((l) => l.id === 'line-rsp-1')!.status = 'requested';
    });
    await cmd.lines.setStatus('line-rsp-2', 'received');
    await cmd.lines.setStatus('line-rsp-1', 'received');
    expect(made()).toHaveLength(1);
  });
});

describe('U35 Visit ready', () => {
  const nearlyReady = (s: Store) => {
    const task = s.tasks.find((t) => t.id === 'task-rsp-0619e')!;
    task.officeAction = undefined as never; // no authorization needed, so only the lines decide
    for (const l of s.taskLines.filter((x) => x.taskId === task.id)) l.status = l.id === 'line-rsp-2' ? 'received' : 'accepted';
  };

  it('the line that makes the last item ready tells the assignee', async () => {
    const { store, cmd, made } = as('owner', nearlyReady);
    expect(visitIsReady(store, store.visits.find((v) => v.id === 'visit-today')!)).toBe(false);
    await cmd.lines.setStatus('line-rsp-2', 'accepted');
    expect(visitIsReady(store, store.visits.find((v) => v.id === 'visit-today')!)).toBe(true);
    const n = made().find((x) => x.type === 'visit_ready')!;
    expect(n).toMatchObject({ userId: 'user-ana', link: '/visits/visit-today', entity: 'visit', entityId: 'visit-today' });
    expect(n.title).toMatch(/visit is ready to go\.$/);
    expect(linkExists(store, n.link)).toBe(true);
  });

  it('a change that leaves the visit not ready says nothing', async () => {
    const { cmd, made } = as('owner', (s) => {
      nearlyReady(s);
      s.taskLines.find((l) => l.id === 'line-rsp-1')!.status = 'requested';
    });
    await cmd.lines.setStatus('line-rsp-2', 'accepted');
    expect(made().filter((n) => n.type === 'visit_ready')).toEqual([]);
  });
});

describe('U35 Left without everything ready', () => {
  it('a helper starting the visit with a reason tells the owner, who sees the reason; the lock screen does not', async () => {
    const { store, cmd, made } = as('helper', (s) => (s.visits.find((v) => v.id === 'visit-today')!.assigneeUserId = 'user-ben'));
    expect(visitIsReady(store, store.visits.find((v) => v.id === 'visit-today')!)).toBe(false);
    await cmd.visits.start('visit-today', 'SPA expired');
    const n = made().find((x) => x.type === 'left_not_ready')!;
    expect(n).toMatchObject({ userId: 'user-ana', link: '/visits/visit-today', entityId: 'visit-today' });
    expect(n.body).toContain('Ben');
    expect(n.body).toContain('SPA expired');
    expect(n.title).toMatch(/not ready/);
    expect(n.title).not.toMatch(/Ben|SPA expired/);
  });

  it('starting without a reason, or the owner starting it, makes none', async () => {
    const noReason = as('helper', (s) => (s.visits.find((v) => v.id === 'visit-today')!.assigneeUserId = 'user-ben'));
    await noReason.cmd.visits.start('visit-today');
    expect(noReason.made().filter((n) => n.type === 'left_not_ready')).toEqual([]);
    const byOwner = as('owner');
    await byOwner.cmd.visits.start('visit-today', 'Client is waiting');
    expect(byOwner.made().filter((n) => n.type === 'left_not_ready')).toEqual([]);
  });
});

describe('U35 Outcome recorded', () => {
  it('a helper recording an outcome tells the owner what happened, by code and outcome', async () => {
    const { store, cmd, made } = as('helper');
    await cmd.visits.recordOutcome('vitem-1', { outcome: 'more_documents_requested', note: 'Asked for the 2307s', evidenceDocumentIds: [] });
    const n = made().find((x) => x.type === 'outcome_recorded')!;
    expect(n).toMatchObject({ userId: 'user-ana', link: '/visits/visit-today', entity: 'visit', entityId: 'visit-today' });
    expect(n.body).toContain('Ben');
    expect(n.body).toContain('More documents requested');
    expect(n.title).toContain('RSP');
    expect(n.title).not.toMatch(/Ben|2307s/);
    expect(linkExists(store, n.link)).toBe(true);
  });

  it('the owner recording one tells nobody', async () => {
    const { cmd, made } = as('owner');
    await cmd.visits.recordOutcome('vitem-1', { outcome: 'completed', evidenceDocumentIds: [] }).catch(() => undefined);
    expect(made().filter((n) => n.type === 'outcome_recorded')).toEqual([]);
  });
});

describe('U35 Assigned to you', () => {
  it('giving a task to someone tells them, and a person assigning to themselves does not', async () => {
    const { store, cmd, made } = as('owner');
    await cmd.tasks.update('task-rsp-0619e', { ownerUserId: 'user-ben' });
    const n = made().find((x) => x.type === 'assigned')!;
    expect(n).toMatchObject({ userId: 'user-ben', link: '/tasks/task-rsp-0619e', entity: 'task', entityId: 'task-rsp-0619e' });
    expect(n.body).toContain('Ana');
    expect(n.title).toContain('RSP');
    expect(n.title).not.toContain('Ana');
    expect(linkExists(store, n.link)).toBe(true);
    await cmd.tasks.update('task-maria-2550q', { ownerUserId: 'user-ana' }); // already hers, and she is the actor
    expect(made().filter((x) => x.userId === 'user-ana')).toEqual([]);
  });

  it('giving a visit to someone tells them; so does planning a visit for them', async () => {
    const { cmd, made } = as('owner');
    await cmd.visits.update('visit-today', { assigneeUserId: 'user-ben' });
    expect(made().find((n) => n.type === 'assigned')).toMatchObject({ userId: 'user-ben', link: '/visits/visit-today', entity: 'visit' });
    const planned = await cmd.visits.create({ officeType: 'rdo', officeName: 'RDO 39', plannedDate: today, assigneeUserId: 'user-ben' }, [{ taskId: 'task-rsp-0619e', action: 'submit' }]);
    expect(made().some((n) => n.type === 'assigned' && n.link === `/visits/${planned.id}`)).toBe(true);
  });

  it('is not sent to a helper who cannot reach the client', async () => {
    const { cmd, made } = as('owner');
    await cmd.tasks.update('task-maria-2550q', { ownerUserId: 'user-ben' }); // client-maria is not one of Ben's
    expect(made().filter((n) => n.type === 'assigned')).toEqual([]);
  });

  it('collapses to one per record, person and day', async () => {
    const { cmd, made } = as('owner');
    await cmd.tasks.update('task-rsp-0619e', { ownerUserId: 'user-ben' });
    await cmd.tasks.update('task-rsp-0619e', { ownerUserId: 'user-ana' });
    await cmd.tasks.update('task-rsp-0619e', { ownerUserId: 'user-ben' });
    expect(made().filter((n) => n.type === 'assigned' && n.userId === 'user-ben')).toHaveLength(1);
  });
});

describe('U35 what a failed command leaves behind', () => {
  it('adds no notification when the command is refused', async () => {
    const { cmd, made } = as('helper');
    await expect(cmd.lines.setStatus('line-rsp-1', 'received')).rejects.toBeInstanceOf(RuleViolationError); // an accepted line stays accepted
    expect(made()).toEqual([]);
  });
});
