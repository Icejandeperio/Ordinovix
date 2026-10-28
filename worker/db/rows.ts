/**
 * Entities to table rows: the inverse of worker/db/load.ts. One list of {table, rows} for a whole organization, parents before
 * children. The Demo seed inserts these rows; the write path compares the rows before and after a command to find what to
 * write (worker/db/persist.ts). No mock code is imported here, so the Worker bundle stays free of it.
 */
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { QueryData } from '@/data/queries';
import * as s from './schema';

export type Row = Record<string, unknown>;
type Entity = object;

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

/** The rows of every table for the Demo organization, from the mock's initial store. */
export function rowsOf(store: QueryData): Array<{ table: SQLiteTable; rows: Row[] }> {
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
    { table: s.importBatches, rows: (store.importBatches ?? []).map((b) => asRow(b)) },
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

