/**
 * Demo organization seed for D1 (preview only). Built from the same records the mock starts with (buildInitialStore), so
 * the ids match: client-rsp, task-rsp-0619e, visit-today, mem-ben and the rest. `npm run --silent db:seed-sql` prints it.
 *
 * Idempotent: it removes what it owns and inserts again, so running it twice (or after someone edited the demo data in
 * preview) gives the same rows. It touches only the Demo organization:
 *  - every DELETE is scoped to the organization and only fires while that organization is flagged is_demo;
 *  - memberships that are not part of the seed (the real owner's, added by the first-owner SQL) are kept;
 *  - the organization row itself is upserted, never deleted.
 * activity is insert-only (triggers refuse update and delete), so its delete drops the delete trigger and puts it back on
 * the next line; the trigger text is the one in migrations/0001_search_and_triggers.sql.
 *
 * Every statement is on one line so any executor can run it (D1 `exec` reads one statement per line; wrangler's file
 * import reads the same). Line breaks inside text become char(10) concatenations.
 *
 * No secrets and no real data: the seed has no encryption key, so it stores only the masked TIN (tin_encrypted stays NULL
 * and revealTin on a seeded client finds no full TIN). Seeded documents keep the mock's storage_key, a data: URI for the
 * sample files, plus '#<document id>' to keep keys unique: there are no objects to put in R2, and the files route can
 * serve a data: key as it is.
 */
import { getTableColumns, getTableName } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { buildInitialStore, type StoreData } from '@/data/mock';
import { setDevToday } from '@/lib/dates';
import * as s from './schema';

type Row = Record<string, unknown>;
type Entity = object;

const DEMO_ORG_GUARD = (org: string) => `EXISTS (SELECT 1 FROM orgs WHERE id = ${lit(org)} AND is_demo = 1)`;

/** SQL literal. Text keeps its characters; line breaks are rebuilt with char() so the statement stays on one line. */
export function lit(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''").replace(/\r\n/g, "' || char(13) || char(10) || '").replace(/\n/g, "' || char(10) || '").replace(/\r/g, "' || char(13) || '")}'`;
}

/** One INSERT for a row, using the table's own columns: JS property name to column name, with value conversion by column type. */
function insert(table: SQLiteTable, row: Row, verb = 'INSERT'): string {
  const columns = Object.entries(getTableColumns(table));
  const names: string[] = [];
  const values: string[] = [];
  for (const [key, column] of columns) {
    const raw = row[key];
    names.push(column.name);
    if (raw === undefined || raw === null) {
      values.push('NULL');
    } else if (column.columnType === 'SQLiteTextJson') {
      values.push(lit(JSON.stringify(raw)));
    } else if (column.columnType === 'SQLiteTimestamp') {
      values.push(lit(raw instanceof Date ? raw.getTime() : raw));
    } else {
      values.push(lit(raw));
    }
  }
  return `${verb} INTO ${getTableName(table)} (${names.join(', ')}) VALUES (${values.join(', ')});`;
}

/** Parents before children for a table that references itself (replaced_by_id, replaces_id). */
function parentsFirst<T extends { id: string }>(rows: T[], parentOf: (row: T) => string | undefined): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: T[] = [];
  const seen = new Set<string>();
  const visit = (row: T) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    const parent = parentOf(row);
    if (parent && byId.has(parent)) visit(byId.get(parent)!);
    out.push(row);
  };
  rows.forEach(visit);
  return out;
}

const asRow = (e: Entity, extra: Row = {}): Row => ({ ...(e as Row), ...extra });

export interface SeedPlan {
  /** Insert statements in dependency order, with the table each belongs to. */
  inserts: Array<{ table: string; sql: string }>;
}

/** The rows of every table for the Demo organization, from the mock's initial store. */
export function seedRows(store: StoreData): Array<{ table: SQLiteTable; rows: Row[] }> {
  const orgId = store.org.id;
  const tasksById = new Map(store.tasks.map((t) => [t.id, t]));
  const clientOfEntity = (entity?: string, entityId?: string): string | null => {
    if (!entity || !entityId) return null;
    if (entity === 'client') return entityId;
    if (entity === 'task') return tasksById.get(entityId)?.clientId ?? null;
    return null;
  };
  const st = store.settings;

  return [
    { table: s.orgs, rows: [asRow(store.org)] },
    {
      table: s.orgSettings,
      rows: [
        asRow(st, {
          accreditationNumber: st.accreditation?.number,
          accreditationValidUntil: st.accreditation?.validUntil,
          quietHoursStart: st.quietHours.start,
          quietHoursEnd: st.quietHours.end,
          onboardingDone: st.onboarding?.done ?? [],
          onboardingDismissed: st.onboarding?.dismissed ?? false,
        }),
      ],
    },
    { table: s.users, rows: store.users.map((u) => asRow(u)) },
    { table: s.userPrefs, rows: Object.values(store.prefs).map((p) => asRow(p)) },
    { table: s.offices, rows: store.offices.map((o) => asRow(o)) },
    { table: s.clients, rows: store.clients.map((c) => asRow(c, { tinEncrypted: null, tinHash: null })) },
    { table: s.memberships, rows: store.memberships.map((m) => asRow(m)) },
    { table: s.membershipClients, rows: store.memberships.flatMap((m) => m.clientIds.map((clientId) => ({ membershipId: m.id, clientId }))) },
    { table: s.clientAssignedUsers, rows: store.clients.flatMap((c) => c.assignedUserIds.map((userId) => ({ clientId: c.id, userId }))) },
    { table: s.contacts, rows: store.contacts.map((c) => asRow(c)) },
    {
      table: s.taskTemplates,
      rows: store.templates.map((t) => asRow(t, { defaultDueKind: t.defaultDue?.kind, defaultDueValue: t.defaultDue?.value })),
    },
    { table: s.requirementTemplates, rows: store.reqTemplates.map((r) => asRow(r)) },
    { table: s.authorizations, rows: parentsFirst(store.authorizations, (a) => a.replacedById).map((a) => asRow(a)) },
    { table: s.deadlineMoves, rows: store.deadlineMoves.map((d) => asRow(d)) },
    { table: s.holidays, rows: store.holidays.map((h) => asRow(h)) },
    { table: s.messageTemplates, rows: store.messageTemplates.map((m) => asRow(m)) },
    {
      table: s.tasks,
      rows: store.tasks.map((t) =>
        asRow(t, {
          dueSourceKind: t.dueSource.kind,
          dueSourceRef: t.dueSource.ref,
          dueSourceUrl: t.dueSource.url,
          overrideStatus: t.statusOverride?.status,
          overrideReason: t.statusOverride?.reason,
          overrideBy: t.statusOverride?.by,
          overrideAt: t.statusOverride?.at,
          nextActionText: t.nextAction?.text,
          nextActionOwner: t.nextAction?.owner,
          nextActionDue: t.nextAction?.due,
        }),
      ),
    },
    { table: s.taskLines, rows: store.taskLines.map((l) => asRow(l)) },
    {
      table: s.documents,
      // storage_key is unique and never reused, but the mock's sample files share a few data: URIs; the document id after
      // '#' keeps each key unique and still readable as the same data URI (a fragment is not part of the data)
      rows: parentsFirst(store.documents, (d) => d.replacesId).map((d) =>
        asRow(d, { storageKey: d.storageKey.startsWith('data:') ? `${d.storageKey}#${d.id}` : d.storageKey }),
      ),
    },
    { table: s.lineDocuments, rows: store.taskLines.flatMap((l) => l.documentIds.map((documentId) => ({ lineId: l.id, documentId }))) },
    { table: s.followUps, rows: store.followUps.map((f) => asRow(f)) },
    { table: s.followUpLines, rows: store.followUps.flatMap((f) => f.lineIds.map((lineId) => ({ followUpId: f.id, lineId }))) },
    { table: s.followUpAttempts, rows: store.followUpAttempts.map((a) => asRow(a)) },
    {
      table: s.visits,
      rows: store.visits.map((v) =>
        asRow(v, { costTransport: v.costs?.transport, costParking: v.costs?.parking, costOther: v.costs?.other, costNote: v.costs?.note }),
      ),
    },
    {
      table: s.visitItems,
      rows: store.visitItems.map((i) =>
        asRow(i, { nextActionText: i.nextAction?.text, nextActionOwner: i.nextAction?.owner, nextActionDue: i.nextAction?.due }),
      ),
    },
    {
      table: s.visitItemEvidence,
      rows: store.visitItems.flatMap((i) => i.evidenceDocumentIds.map((documentId) => ({ visitItemId: i.id, documentId }))),
    },
    { table: s.visitKitItems, rows: store.visitKit.map((k) => asRow(k)) },
    {
      table: s.visitPacked,
      rows: store.visits.flatMap((v) => [
        ...v.packedLineIds.map((lineId) => ({ visitId: v.id, lineId, kitItemId: null, packedAt: v.updatedAt })),
        ...v.packedKitItemIds.map((kitItemId) => ({ visitId: v.id, lineId: null, kitItemId, packedAt: v.updatedAt })),
      ]),
    },
    {
      table: s.payments,
      rows: store.payments.map((p) => asRow(p, { reimbursementStatus: p.reimbursement?.status, reimbursedOn: p.reimbursement?.reimbursedOn })),
    },
    { table: s.paymentProofs, rows: store.payments.flatMap((p) => p.proofDocumentIds.map((documentId) => ({ paymentId: p.id, documentId }))) },
    { table: s.notes, rows: store.notes.map((n) => asRow(n, { clientId: clientOfEntity(n.entity, n.entityId) })) },
    { table: s.savedViews, rows: store.savedViews.map((v) => asRow(v)) },
    { table: s.notifications, rows: store.notifications.map((n) => asRow(n, { clientId: clientOfEntity(n.entity, n.entityId) })) },
    { table: s.baselines, rows: store.baseline ? [asRow(store.baseline)] : [] },
    { table: s.pulses, rows: store.pulses.map((p) => asRow(p)) },
    {
      table: s.activity,
      rows: store.activity.map((a) => asRow(a, { orgId: a.orgId ?? orgId, beforeJson: a.before, afterJson: a.after })),
    },
  ];
}

const ACTIVITY_DELETE_TRIGGER = "CREATE TRIGGER activity_no_delete BEFORE DELETE ON activity BEGIN SELECT RAISE(ABORT, 'activity is insert-only'); END;";

/** Statements that remove the seed's own data, children first. */
function deleteStatements(store: StoreData): string[] {
  const org = lit(store.org.id);
  const guard = DEMO_ORG_GUARD(store.org.id);
  const own = (table: string) => `DELETE FROM ${table} WHERE org_id = ${org} AND ${guard};`;
  const seedMemberships = store.memberships.map((m) => lit(m.id)).join(', ');
  const seedUsers = store.users.map((u) => lit(u.id)).join(', ');
  const clientIds = `(SELECT id FROM clients WHERE org_id = ${org})`;
  return [
    `DROP TRIGGER IF EXISTS activity_no_delete;`,
    own('activity'),
    ACTIVITY_DELETE_TRIGGER,
    own('pulses'),
    own('baselines'),
    own('notifications'),
    own('saved_views'),
    own('notes'),
    `DELETE FROM payment_proofs WHERE payment_id IN (SELECT id FROM payments WHERE org_id = ${org}) AND ${guard};`,
    own('payments'),
    `DELETE FROM visit_packed WHERE visit_id IN (SELECT id FROM visits WHERE org_id = ${org}) AND ${guard};`,
    own('visit_kit_items'),
    `DELETE FROM visit_item_evidence WHERE visit_item_id IN (SELECT id FROM visit_items WHERE org_id = ${org}) AND ${guard};`,
    own('visit_items'),
    own('visits'),
    own('follow_up_attempts'),
    `DELETE FROM follow_up_lines WHERE follow_up_id IN (SELECT id FROM follow_ups WHERE org_id = ${org}) AND ${guard};`,
    own('follow_ups'),
    `DELETE FROM line_documents WHERE line_id IN (SELECT id FROM task_lines WHERE org_id = ${org}) AND ${guard};`,
    own('documents'),
    own('task_lines'),
    own('tasks'),
    own('message_templates'),
    own('holidays'),
    own('deadline_moves'),
    own('authorizations'),
    own('requirement_templates'),
    own('task_templates'),
    own('contacts'),
    `DELETE FROM client_assigned_users WHERE client_id IN ${clientIds} AND ${guard};`,
    // a helper added in preview may be assigned to a demo client: those links go with the clients
    `DELETE FROM membership_clients WHERE (membership_id IN (${seedMemberships}) OR client_id IN ${clientIds}) AND ${guard};`,
    // the seed's own memberships only; the real owner's membership stays
    `DELETE FROM memberships WHERE id IN (${seedMemberships}) AND ${guard};`,
    own('clients'),
    own('offices'),
    own('import_batches'),
    own('push_subscriptions'),
    `DELETE FROM user_prefs WHERE user_id IN (${seedUsers}) AND ${guard};`,
    `DELETE FROM users WHERE id IN (${seedUsers}) AND ${guard};`,
    `DELETE FROM org_settings WHERE org_id = ${org} AND ${guard};`,
  ];
}

/** Row counts per table that the seed inserts, for tests and for the runbook. */
export let SEED_TABLE_COUNTS: Record<string, number> = {};

/**
 * The SQL for the Demo organization, dated relative to `today` (YYYY-MM-DD in Asia/Manila), like the mock seed.
 * Every line is one statement (no comments).
 */
export function buildSeedSql(today: string): string {
  setDevToday(today);
  const store = buildInitialStore(today);
  const counts: Record<string, number> = {};
  // No comment lines: D1's exec refuses a line that holds no statement
  const lines: string[] = [
    ...deleteStatements(store),
  ];
  for (const { table, rows } of seedRows(store)) {
    const name = getTableName(table);
    counts[name] = rows.length;
    for (const row of rows) {
      // the organization row is upserted: real memberships keep pointing at it
      if (name === 'orgs') {
        lines.push(insert(table, row).replace(/;$/, ` ON CONFLICT(id) DO UPDATE SET name = excluded.name, is_demo = excluded.is_demo, created_at = excluded.created_at;`));
      } else {
        lines.push(insert(table, row));
      }
    }
  }
  SEED_TABLE_COUNTS = counts;
  return lines.join('\n') + '\n';
}
