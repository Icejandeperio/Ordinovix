/**
 * Loads one organization's records from D1 as the entities the screens use (the shape of the mock's store), so the shared read
 * side (src/data/queries.ts) runs over them unchanged. Every statement is filtered by org_id; the permission filters for a
 * helper (assigned clients, reachable visits, revoked membership) are applied by that shared code, the same code the mock runs.
 *
 * A route says which tables it needs; the rest stay empty. All the statements go to D1 in one batch (D1 allows 50 queries per
 * request on the free plan; a full load is 33).
 */
import { eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { BatchItem } from 'drizzle-orm/batch';
import type { QueryData } from '@/data/queries';
import type {
  ActivityEvent,
  Baseline,
  Client,
  FollowUp,
  Org,
  OrgSettings,
  Payment,
  Task,
  TaskTemplate,
  User,
  UserPrefs,
  Visit,
  VisitItem,
} from '@/domain/types';
import { rowToMembership, rowToOrg, rowToPrefs, rowToSettings, rowToUser } from './mappers';
import * as s from './schema';

export type QueryTable = Exclude<keyof QueryData, 'org' | 'settings'> | 'org' | 'settings';
export const ALL_TABLES: QueryTable[] = [
  'org', 'settings', 'users', 'memberships', 'prefs', 'offices', 'importBatches', 'clients', 'contacts', 'authorizations', 'templates', 'reqTemplates',
  'tasks', 'taskLines', 'visits', 'visitItems', 'visitKit', 'followUps', 'followUpAttempts', 'payments', 'messageTemplates',
  'holidays', 'deadlineMoves', 'documents', 'notes', 'notifications', 'savedViews', 'baseline', 'pulses', 'activity',
];

/** Drops null and undefined: an absent optional field is undefined in the entities, like in the mock. */
function clean<T extends object>(row: T, drop: string[] = []): any {
  return Object.fromEntries(Object.entries(row).filter(([k, v]) => v !== null && v !== undefined && !drop.includes(k)));
}

const group = <T, K extends string>(rows: T[], key: (row: T) => K): Map<K, T[]> => {
  const out = new Map<K, T[]>();
  for (const row of rows) out.set(key(row), [...(out.get(key(row)) ?? []), row]);
  return out;
};

export async function loadQueryData(d1: D1Database, orgId: string, tables: readonly QueryTable[] = ALL_TABLES): Promise<QueryData> {
  const want = new Set<QueryTable>(tables);
  const db = drizzle(d1, { schema: s });
  const org = (t: { orgId: any }) => eq(t.orgId, orgId);

  // name -> statement; only what was asked for runs. Join tables are read through their parent's org.
  const plan: Record<string, BatchItem<'sqlite'>> = {};
  const add = (key: string, statement: BatchItem<'sqlite'>) => (plan[key] = statement);
  const wantAny = (...names: QueryTable[]) => names.some((n) => want.has(n));

  if (want.has('org')) add('org', db.select().from(s.orgs).where(eq(s.orgs.id, orgId)).orderBy(sql`rowid`));
  if (want.has('settings')) add('settings', db.select().from(s.orgSettings).where(eq(s.orgSettings.orgId, orgId)).orderBy(sql`rowid`));
  // the people of this organization: those who hold a membership here
  const members = db.select({ id: s.memberships.userId }).from(s.memberships).where(org(s.memberships));
  if (wantAny('users')) add('users', db.select().from(s.users).where(inArray(s.users.id, members)).orderBy(sql`rowid`));
  if (want.has('prefs')) add('prefs', db.select().from(s.userPrefs).where(inArray(s.userPrefs.userId, members)).orderBy(sql`rowid`));
  if (want.has('memberships')) {
    add('memberships', db.select().from(s.memberships).where(org(s.memberships)).orderBy(sql`rowid`));
    add('membershipClients', db.select().from(s.membershipClients).where(inArray(s.membershipClients.membershipId, db.select({ id: s.memberships.id }).from(s.memberships).where(org(s.memberships)))).orderBy(sql`rowid`));
  }
  if (want.has('offices')) add('offices', db.select().from(s.offices).where(org(s.offices)).orderBy(sql`rowid`));
  if (want.has('importBatches')) add('importBatches', db.select().from(s.importBatches).where(org(s.importBatches)).orderBy(sql`rowid`));
  if (want.has('clients')) {
    add('clients', db.select().from(s.clients).where(org(s.clients)).orderBy(sql`rowid`));
    add('clientAssigned', db.select().from(s.clientAssignedUsers).where(inArray(s.clientAssignedUsers.clientId, db.select({ id: s.clients.id }).from(s.clients).where(org(s.clients)))).orderBy(sql`rowid`));
  }
  if (want.has('contacts')) add('contacts', db.select().from(s.contacts).where(org(s.contacts)).orderBy(sql`rowid`));
  if (want.has('authorizations')) add('authorizations', db.select().from(s.authorizations).where(org(s.authorizations)).orderBy(sql`rowid`));
  if (want.has('templates')) add('templates', db.select().from(s.taskTemplates).where(org(s.taskTemplates)).orderBy(sql`rowid`));
  if (want.has('reqTemplates')) add('reqTemplates', db.select().from(s.requirementTemplates).where(org(s.requirementTemplates)).orderBy(sql`rowid`));
  if (want.has('tasks')) add('tasks', db.select().from(s.tasks).where(org(s.tasks)).orderBy(sql`rowid`));
  if (want.has('taskLines')) {
    add('taskLines', db.select().from(s.taskLines).where(org(s.taskLines)).orderBy(sql`rowid`));
    add('lineDocuments', db.select().from(s.lineDocuments).where(inArray(s.lineDocuments.lineId, db.select({ id: s.taskLines.id }).from(s.taskLines).where(org(s.taskLines)))).orderBy(sql`rowid`));
  }
  if (want.has('visits')) {
    add('visits', db.select().from(s.visits).where(org(s.visits)).orderBy(sql`rowid`));
    add('visitPacked', db.select().from(s.visitPacked).where(inArray(s.visitPacked.visitId, db.select({ id: s.visits.id }).from(s.visits).where(org(s.visits)))).orderBy(sql`rowid`));
  }
  if (want.has('visitItems')) {
    add('visitItems', db.select().from(s.visitItems).where(org(s.visitItems)).orderBy(sql`rowid`));
    add('visitEvidence', db.select().from(s.visitItemEvidence).where(inArray(s.visitItemEvidence.visitItemId, db.select({ id: s.visitItems.id }).from(s.visitItems).where(org(s.visitItems)))).orderBy(sql`rowid`));
  }
  if (want.has('visitKit')) add('visitKit', db.select().from(s.visitKitItems).where(org(s.visitKitItems)).orderBy(sql`rowid`));
  if (want.has('followUps')) {
    add('followUps', db.select().from(s.followUps).where(org(s.followUps)).orderBy(sql`rowid`));
    add('followUpLines', db.select().from(s.followUpLines).where(inArray(s.followUpLines.followUpId, db.select({ id: s.followUps.id }).from(s.followUps).where(org(s.followUps)))).orderBy(sql`rowid`));
  }
  if (want.has('followUpAttempts')) add('followUpAttempts', db.select().from(s.followUpAttempts).where(org(s.followUpAttempts)).orderBy(sql`rowid`));
  if (want.has('payments')) {
    add('payments', db.select().from(s.payments).where(org(s.payments)).orderBy(sql`rowid`));
    add('paymentProofs', db.select().from(s.paymentProofs).where(inArray(s.paymentProofs.paymentId, db.select({ id: s.payments.id }).from(s.payments).where(org(s.payments)))).orderBy(sql`rowid`));
  }
  if (want.has('messageTemplates')) add('messageTemplates', db.select().from(s.messageTemplates).where(org(s.messageTemplates)).orderBy(sql`rowid`));
  if (want.has('holidays')) add('holidays', db.select().from(s.holidays).where(org(s.holidays)).orderBy(sql`rowid`));
  if (want.has('deadlineMoves')) add('deadlineMoves', db.select().from(s.deadlineMoves).where(org(s.deadlineMoves)).orderBy(sql`rowid`));
  if (want.has('documents')) add('documents', db.select().from(s.documents).where(org(s.documents)).orderBy(sql`rowid`));
  if (want.has('notes')) add('notes', db.select().from(s.notes).where(org(s.notes)).orderBy(sql`rowid`));
  if (want.has('notifications')) add('notifications', db.select().from(s.notifications).where(org(s.notifications)).orderBy(sql`rowid`));
  if (want.has('savedViews')) add('savedViews', db.select().from(s.savedViews).where(org(s.savedViews)).orderBy(sql`rowid`));
  if (want.has('baseline')) add('baseline', db.select().from(s.baselines).where(org(s.baselines)).orderBy(sql`rowid`));
  if (want.has('pulses')) add('pulses', db.select().from(s.pulses).where(org(s.pulses)).orderBy(sql`rowid`));
  if (want.has('activity')) add('activity', db.select().from(s.activity).where(org(s.activity)).orderBy(sql`rowid`));

  const keys = Object.keys(plan);
  const results: Record<string, any[]> = {};
  if (keys.length > 0) {
    const out = (await db.batch(keys.map((k) => plan[k]) as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])) as any[][];
    keys.forEach((k, i) => (results[k] = out[i]));
  }
  const r = (k: string): any[] => results[k] ?? [];

  const clientIdsOf = group(r('membershipClients'), (x) => x.membershipId);
  const assignedOf = group(r('clientAssigned'), (x) => x.clientId);
  const docsOfLine = group(r('lineDocuments'), (x) => x.lineId);
  const packedOf = group(r('visitPacked'), (x) => x.visitId);
  const evidenceOf = group(r('visitEvidence'), (x) => x.visitItemId);
  const linesOfFollowUp = group(r('followUpLines'), (x) => x.followUpId);
  const proofsOf = group(r('paymentProofs'), (x) => x.paymentId);

  const orgRow = r('org')[0];
  const settingsRow = r('settings')[0];

  return {
    org: (orgRow ? rowToOrg(orgRow) : undefined) as Org,
    settings: (settingsRow ? rowToSettings(settingsRow) : undefined) as OrgSettings,
    users: r('users').map(rowToUser) as User[],
    memberships: r('memberships').map((m) => rowToMembership(m, (clientIdsOf.get(m.id) ?? []).map((x) => x.clientId))),
    prefs: Object.fromEntries(r('prefs').map((p) => [p.userId, rowToPrefs(p)])) as Record<string, UserPrefs>,
    offices: r('offices').map((x) => clean(x)),
    clients: r('clients').map(
      (c) => ({ ...clean(c, ['tinEncrypted', 'tinHash']), assignedUserIds: (assignedOf.get(c.id) ?? []).map((x) => x.userId) }) as Client,
    ),
    importBatches: r('importBatches').map((x) => clean(x)),
    contacts: r('contacts').map((x) => clean(x)),
    authorizations: r('authorizations').map((x) => clean(x)),
    templates: r('templates').map(
      (t) =>
        ({
          ...clean(t, ['defaultDueKind', 'defaultDueValue']),
          ...(t.defaultDueKind ? { defaultDue: { kind: t.defaultDueKind, value: t.defaultDueValue } } : {}),
        }) as TaskTemplate,
    ),
    reqTemplates: r('reqTemplates').map((x) => clean(x)),
    tasks: r('tasks').map((t) => {
      const base = clean(t, ['dueSourceKind', 'dueSourceRef', 'dueSourceUrl', 'overrideStatus', 'overrideReason', 'overrideBy', 'overrideAt', 'nextActionText', 'nextActionOwner', 'nextActionDue']);
      return {
        ...base,
        dueSource: clean({ kind: t.dueSourceKind, ref: t.dueSourceRef, url: t.dueSourceUrl }),
        ...(t.overrideStatus ? { statusOverride: { status: t.overrideStatus, reason: t.overrideReason, by: t.overrideBy, at: t.overrideAt } } : {}),
        ...(t.nextActionText ? { nextAction: clean({ text: t.nextActionText, owner: t.nextActionOwner, due: t.nextActionDue }) } : {}),
      } as Task;
    }),
    taskLines: r('taskLines').map((l) => ({ ...clean(l), documentIds: (docsOfLine.get(l.id) ?? []).map((x) => x.documentId) })),
    visits: r('visits').map((v) => {
      const packed = packedOf.get(v.id) ?? [];
      const costs = clean({ transport: v.costTransport, parking: v.costParking, other: v.costOther, note: v.costNote });
      return {
        ...clean(v, ['costTransport', 'costParking', 'costOther', 'costNote']),
        packedLineIds: packed.filter((x) => x.lineId).map((x) => x.lineId),
        packedKitItemIds: packed.filter((x) => x.kitItemId).map((x) => x.kitItemId),
        ...(Object.keys(costs).length > 0 ? { costs } : {}),
      } as Visit;
    }),
    visitItems: r('visitItems').map(
      (i) =>
        ({
          ...clean(i, ['nextActionText', 'nextActionOwner', 'nextActionDue']),
          ...(i.nextActionText ? { nextAction: clean({ text: i.nextActionText, owner: i.nextActionOwner, due: i.nextActionDue }) } : {}),
          evidenceDocumentIds: (evidenceOf.get(i.id) ?? []).map((x) => x.documentId),
        }) as VisitItem,
    ),
    visitKit: r('visitKit').map((x) => clean(x)),
    followUps: r('followUps').map((f) => ({ ...clean(f), lineIds: (linesOfFollowUp.get(f.id) ?? []).map((x) => x.lineId) }) as FollowUp),
    followUpAttempts: r('followUpAttempts').map((x) => clean(x)),
    payments: r('payments').map(
      (p) =>
        ({
          ...clean(p, ['reimbursementStatus', 'reimbursedOn']),
          ...(p.reimbursementStatus ? { reimbursement: clean({ status: p.reimbursementStatus, reimbursedOn: p.reimbursedOn }) } : {}),
          proofDocumentIds: (proofsOf.get(p.id) ?? []).map((x) => x.documentId),
        }) as Payment,
    ),
    messageTemplates: r('messageTemplates').map((x) => clean(x)),
    holidays: r('holidays').map((x) => clean(x)),
    deadlineMoves: r('deadlineMoves').map((x) => clean(x)),
    documents: r('documents').map((x) => clean(x)),
    notes: r('notes').map((x) => clean(x, ['clientId'])),
    notifications: r('notifications').map((x) => clean(x, ['clientId'])),
    savedViews: r('savedViews').map((x) => clean(x)),
    baseline: (r('baseline')[0] ? (clean(r('baseline')[0]) as Baseline) : null),
    pulses: r('pulses').map((x) => clean(x)),
    activity: r('activity').map(
      (a) => ({ ...clean(a, ['beforeJson', 'afterJson', 'orgId']), orgId: a.orgId, ...(a.beforeJson != null ? { before: a.beforeJson } : {}), ...(a.afterJson != null ? { after: a.afterJson } : {}) }) as ActivityEvent,
    ),
  };
}
