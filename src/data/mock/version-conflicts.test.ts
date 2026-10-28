import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories as R, mockDevControls } from './index';
import { classifyError, VersionConflictError } from '@/domain/errors';
import { todayInManila } from '@/lib/dates';

/**
 * U21: every record that a screen edits carries a `version`; an update that names an older version fails with
 * VERSION_CONFLICT and carries the stored record (the API answers 409 with the same body). An update that names
 * the current version, or none, goes through and bumps the version by one.
 */
const code = (e: unknown) => (e as { code?: string })?.code;
const outcome = async (p: Promise<unknown>) => p.then(() => 'ALLOWED', (e) => code(e) ?? (e as Error).message);

beforeEach(() => {
  mockDevControls.reset();
  mockDevControls.setPersona('owner');
});

interface Case {
  /** The record as stored now, with its version. */
  load: () => Promise<{ version: number }>;
  /** Save a change that names `version` as the version the editor loaded. */
  save: (version: number | undefined, tag: string) => Promise<{ version: number }>;
}

const TIMEOUT = { timeout: 30_000 };

const cases: Record<string, () => Promise<Case>> = {
  'settings.save': async () => ({
    load: async () => (await R.session.me()).settings,
    save: (version, tag) => R.settings.save({ practiceName: `Practice ${tag}`, version }),
  }),
  'memberships.update': async () => ({
    load: async () => (await R.memberships.list()).find((m) => m.id === 'mem-ben')!,
    save: (version, tag) => R.memberships.update('mem-ben', { name: `Ben ${tag}`, version }),
  }),
  'clients.upsert': async () => ({
    load: async () => (await R.clients.get('client-rsp')).client,
    save: (version, tag) => R.clients.upsert({ id: 'client-rsp', displayName: `RSP ${tag}`, version }),
  }),
  'contacts.upsert': async () => {
    const contact = (await R.contacts.listByClient('client-rsp'))[0];
    return {
      load: async () => (await R.contacts.listByClient('client-rsp')).find((c) => c.id === contact.id)!,
      save: (version, tag) => R.contacts.upsert({ id: contact.id, name: `Contact ${tag}`, version }),
    };
  },
  'authorizations.upsert': async () => {
    const auth = (await R.authorizations.listByClient('client-rsp'))[0];
    return {
      load: async () => (await R.authorizations.listByClient('client-rsp')).find((a) => a.id === auth.id)!,
      save: (version, tag) => R.authorizations.upsert({ id: auth.id, notes: `Notes ${tag}`, version }),
    };
  },
  'templates.save': async () => ({
    load: async () => (await R.templates.get('tmpl-0619e')).template,
    save: (version, tag) => R.templates.save({ id: 'tmpl-0619e', name: `Template ${tag}`, version }, []),
  }),
  'holidays.save': async () => {
    const created = await R.holidays.save({ date: '2026-12-30', name: 'Rizal Day (test)', type: 'regular' });
    return {
      load: async () => (await R.holidays.list(2026)).find((h) => h.id === created.id)!,
      save: (version, tag) => R.holidays.save({ id: created.id, name: `Holiday ${tag}`, version }),
    };
  },
  'tasks.update': async () => ({
    load: async () => (await R.tasks.get('task-rsp-0619e')).task,
    save: (version, tag) => R.tasks.update('task-rsp-0619e', { notes: `Note ${tag}`, version }),
  }),
  'lines.update': async () => {
    const line = (await R.tasks.get('task-rsp-0619e')).lines[0];
    return {
      load: async () => (await R.tasks.get('task-rsp-0619e')).lines.find((l) => l.id === line.id)!,
      save: (version, tag) => R.lines.update(line.id, { label: `Line ${tag}`, version }),
    };
  },
  'documents.update': async () => {
    const doc = (await R.documents.list({ clientId: 'client-rsp' })).items[0];
    return {
      load: async () => (await R.documents.list({ clientId: 'client-rsp' })).items.find((d) => d.id === doc.id)!,
      save: (version, tag) => R.documents.update(doc.id, { kind: tag === 'a' ? 'other' : 'source', version }),
    };
  },
  'messages.save': async () => {
    const message = (await R.messages.list())[0];
    return {
      load: async () => (await R.messages.list()).find((m) => m.id === message.id)!,
      save: (version, tag) => R.messages.save({ id: message.id, name: `Message ${tag}`, version }),
    };
  },
  'offices.save': async () => ({
    load: async () => (await R.offices.get('off-rdo39')).office,
    save: (version, tag) => R.offices.save({ id: 'off-rdo39', name: `Office ${tag}`, version }),
  }),
  'visits.update': async () => ({
    load: async () => (await R.visits.get('visit-today')).visit,
    save: (version, tag) => R.visits.update('visit-today', { purpose: `Purpose ${tag}`, version }),
  }),
  'visits.updateItem': async () => {
    const item = (await R.visits.get('visit-today')).items[0].item;
    return {
      load: async () => (await R.visits.get('visit-today')).items.find((i) => i.item.id === item.id)!.item,
      save: (version, tag) => R.visits.updateItem(item.id, { questions: `Question ${tag}`, version }),
    };
  },
  'visitKit.save': async () => {
    const kit = (await R.visitKit.list())[0];
    return {
      load: async () => (await R.visitKit.list()).find((k) => k.id === kit.id)!,
      save: (version, tag) => R.visitKit.save({ id: kit.id, label: `Kit ${tag}`, version }),
    };
  },
  'payments.save': async () => {
    const payment = (await R.payments.list({ clientId: 'client-rsp' })).items[0];
    return {
      load: async () => (await R.payments.list({ clientId: 'client-rsp' })).items.find((p) => p.id === payment.id)!,
      save: (version, tag) => R.payments.save({ id: payment.id, note: `Payment ${tag}`, version }),
    };
  },
  'notes.save': async () => {
    const note = await R.notes.save({ entity: 'client', entityId: 'client-rsp', body: 'First draft' });
    return {
      load: async () => (await R.notes.list('client', 'client-rsp')).find((n) => n.id === note.id)!,
      save: (version, tag) => R.notes.save({ id: note.id, entity: 'client', entityId: 'client-rsp', body: `Body ${tag}`, version }),
    };
  },
  'savedViews.save': async () => {
    const view = await R.savedViews.save({ page: 'tasks', name: 'Mine', query: 'a=1' });
    return {
      load: async () => (await R.savedViews.list('tasks')).find((v) => v.id === view.id)!,
      save: (version, tag) => R.savedViews.save({ id: view.id, page: 'tasks', name: `View ${tag}`, version }),
    };
  },
  'baseline.save': async () => {
    await R.baseline.save({ tripsPerMonth: 10 });
    return {
      load: async () => (await R.baseline.get())!,
      save: (version, tag) => R.baseline.save({ tripsPerMonth: tag === 'a' ? 11 : 12, version }),
    };
  },
};

describe('VERSION_CONFLICT on every namespace a screen edits', () => {
  for (const [name, make] of Object.entries(cases)) {
    it(`${name}: a stale version is rejected with the stored record, the current one is accepted`, TIMEOUT, async () => {
      const c = await make();
      // The mock hands out its stored objects, so keep the number, not the object
      const loadedVersion = (await c.load()).version;
      expect(loadedVersion, 'the record carries a version').toBeGreaterThanOrEqual(1);

      // Two editors loaded the same version; the first one saves
      const firstVersion = (await c.save(loadedVersion, 'a')).version;
      expect(firstVersion).toBe(loadedVersion + 1);

      // The second one holds a stale version
      let error: unknown;
      try {
        await c.save(loadedVersion, 'b');
      } catch (e) {
        error = e;
      }
      expect(code(error), `${name} stale save`).toBe('VERSION_CONFLICT');
      expect(error).toBeInstanceOf(VersionConflictError);
      expect(classifyError(error)).toBe('conflict');
      expect((error as VersionConflictError).current).toMatchObject({ version: firstVersion });
      // nothing was applied by the stale save
      expect((await c.load()).version).toBe(firstVersion);

      // After reloading, the new version goes through
      const reloadedVersion = (await c.load()).version;
      expect((await c.save(reloadedVersion, 'c')).version).toBe(reloadedVersion + 1);
    });
  }

  it('an update that names no version is still accepted (programmatic callers, queued writes)', TIMEOUT, async () => {
    const c = await cases['tasks.update']();
    const before = (await c.load()).version;
    expect((await c.save(undefined, 'x')).version).toBe(before + 1);
  });

  it('a version that is ahead of the stored record also conflicts', TIMEOUT, async () => {
    const c = await cases['clients.upsert']();
    const before = (await c.load()).version;
    expect(await outcome(c.save(before + 5, 'x'))).toBe('VERSION_CONFLICT');
  });

  it('a helper sees FORBIDDEN, not a conflict, on a record they cannot reach', TIMEOUT, async () => {
    const mariaVersion = (await R.clients.get('client-maria')).client.version;
    mockDevControls.setPersona('helper');
    expect(await outcome(R.clients.upsert({ id: 'client-maria', displayName: 'X', version: mariaVersion + 9 }))).toBe('FORBIDDEN');
  });

  it('a helper can save an assigned client with the version they loaded', TIMEOUT, async () => {
    mockDevControls.setPersona('helper');
    const rspVersion = (await R.clients.get('client-rsp')).client.version;
    const saved = await R.clients.upsert({ id: 'client-rsp', displayName: 'RSP renamed', version: rspVersion });
    expect(saved.version).toBe(rspVersion + 1);
    expect(await outcome(R.clients.upsert({ id: 'client-rsp', displayName: 'Again', version: rspVersion }))).toBe('VERSION_CONFLICT');
  });
});

describe('U21 deadlineMoves has no unreadCount', () => {
  it('is not part of the contract: nothing tracks which moves a person has seen', () => {
    expect(Object.keys(R.deadlineMoves).sort()).toEqual(['list', 'remove', 'save']);
  });
});

describe('U21 settings.save writes an activity event', () => {
  it('logs a plain sentence with the changed field names and no values', TIMEOUT, async () => {
    const before = (await R.activity.list({ entity: 'settings' })).items.length;
    await R.settings.save({ practiceName: 'Santos Tax and Bookkeeping', mobileE164: '+639175550101' });
    const events = (await R.activity.list({ entity: 'settings' })).items;
    expect(events.length).toBe(before + 1);
    const event = events[0];
    expect(event.action).toBe('updated');
    expect(event.summary).toMatch(/settings/i);
    expect(event.summary).toContain('practiceName');
    const dump = JSON.stringify(event);
    expect(dump).not.toContain('+639175550101');
    expect(dump).not.toMatch(/\d{3}-\d{3}-\d{3}/); // no TIN-shaped value
  });
});

describe('U21 notes.save refuses an id that belongs to a note on another entity', () => {
  it('raises RULE_VIOLATION instead of creating a duplicate, and edits in place on the same entity', TIMEOUT, async () => {
    const note = await R.notes.save({ entity: 'client', entityId: 'client-rsp', body: 'Original' });
    const noteVersion = note.version;
    const other = (await R.tasks.get('task-rsp-0619e')).task.id;

    expect(await outcome(R.notes.save({ id: note.id, entity: 'task', entityId: other, body: 'Hijack' }))).toBe('RULE_VIOLATION');
    expect(await outcome(R.notes.save({ id: note.id, entity: 'client', entityId: 'client-cruz', body: 'Move' }))).toBe('RULE_VIOLATION');
    expect((await R.notes.list('task', other)).filter((n) => n.id === note.id)).toHaveLength(0);

    // same entity: one note, edited
    const edited = await R.notes.save({ id: note.id, entity: 'client', entityId: 'client-rsp', body: 'Edited' });
    expect(edited.version).toBe(noteVersion + 1);
    const notes = (await R.notes.list('client', 'client-rsp')).filter((n) => n.id === note.id);
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe('Edited');
  });
});

describe('U21 a visit that holds items for clients the helper cannot reach', () => {
  async function mixedVisit() {
    mockDevControls.setPersona('owner');
    const mixed = await R.visits.create(
      { officeId: 'off-rdo39', plannedDate: todayInManila(), arriveBy: '09:00', assigneeUserId: 'user-ben', purpose: 'Mixed trip' },
      [
        { taskId: 'task-rsp-0619e', action: 'submit' },
        { taskId: 'task-maria-2550q', action: 'submit' },
      ],
    );
    const own = await R.visits.create(
      { officeId: 'off-rdo39', plannedDate: todayInManila(), arriveBy: '09:00', assigneeUserId: 'user-ben', purpose: 'Own trip' },
      [{ taskId: 'task-rsp-0619e', action: 'submit' }],
    );
    return { mixed, own };
  }

  it('cannot be cancelled by the helper, can by the owner', TIMEOUT, async () => {
    const { mixed } = await mixedVisit();
    mockDevControls.setPersona('helper');
    expect(await outcome(R.visits.cancel(mixed.id, 'Client rescheduled the trip'))).toBe('FORBIDDEN');
    mockDevControls.setPersona('owner');
    expect((await R.visits.get(mixed.id)).visit.status).not.toBe('cancelled');
    expect(await outcome(R.visits.cancel(mixed.id, 'Client rescheduled the trip'))).toBe('ALLOWED');
    expect((await R.visits.get(mixed.id)).visit.status).toBe('cancelled');
  });

  it('a helper can still cancel a visit whose items are all theirs', TIMEOUT, async () => {
    const { own } = await mixedVisit();
    mockDevControls.setPersona('helper');
    expect(await outcome(R.visits.cancel(own.id, 'Client rescheduled the trip'))).toBe('ALLOWED');
  });
});
