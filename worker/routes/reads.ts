/**
 * Read routes (BACKEND_PLAN section 4). Each one loads the organization's records for the signed-in person and calls the
 * same read side as the mock (src/data/queries.ts): the permission filters, the derived fields (rules.ts) and the response
 * shapes are shared code, not a second copy. Mounted behind requireSession, requireMembership and requireActive.
 */
import { Hono, type Context } from 'hono';
import { createQueries, type Queries } from '@/data/queries';
import { ValidationError } from '@/domain/errors';
import { requireOwner } from '@/domain/policy';
import type { InsightsFilter, InsightsTab } from '@/domain/types';
import { ALL_TABLES, loadQueryData, type QueryTable } from '../db/load';
import type { AppEnv } from '../env';

export const readRoutes = new Hono<AppEnv>();

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/** The shared read side bound to this request's organization and person. */
async function queriesFor(c: Context<AppEnv>, tables: readonly QueryTable[] = ALL_TABLES): Promise<Queries> {
  const actor = c.get('actor');
  const needed = [...new Set<QueryTable>([...tables, 'users', 'memberships'])];
  const store = await loadQueryData(c.env.DB, actor.orgId, needed);
  const authUser = c.get('authUser');
  const user = store.users.find((u) => u.id === actor.userId) ?? { id: actor.userId, name: authUser.name, email: authUser.email, initials: 'OP' };
  const membership = store.memberships.find((m) => m.id === actor.membershipId)!;
  return createQueries({ store, user, membership });
}

const list = (value: string | undefined) => (value ? value.split(',').map((v) => v.trim()).filter(Boolean) : undefined);
const flag = (value: string | undefined) => (value === undefined ? undefined : value === 'true' || value === '1');
const num = (value: string | undefined, field: string) => {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ValidationError({ [field]: [`${field} must be a number`] });
  return n;
};
/** Only keys that were sent: the shared code tells "not given" from "given" by presence. */
const defined = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/**
 * Cursor pagination for a list result: `limit` (at most 100, default 50) and an opaque `cursor`. The cursor is the offset of
 * the next item, so a page is always taken from the same ordered, permission-filtered list.
 */
function paginate<T>(page: { items: T[]; total?: number }, query: Record<string, string>) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, num(query.limit, 'limit') ?? DEFAULT_LIMIT));
  const offset = query.cursor ? Number(atob(query.cursor)) : 0;
  if (!Number.isInteger(offset) || offset < 0) throw new ValidationError({ cursor: ['cursor is not valid'] });
  const items = page.items.slice(offset, offset + limit);
  const next = offset + limit < page.items.length ? btoa(String(offset + limit)) : undefined;
  return { items, total: page.total ?? page.items.length, ...(next ? { nextCursor: next } : {}) };
}

// ---- today, calendar, search, insights ------------------------------------------------------------------------
readRoutes.get('/today', async (c) => c.json(await (await queriesFor(c)).today.queue(c.req.query('scope') === 'mine' ? 'mine' : 'everyone')));

readRoutes.get('/calendar', async (c) => {
  const { from, to, clientId, ownerUserId, types } = c.req.query();
  if (!from || !to) throw new ValidationError({ from: ['from and to are required'] });
  const filter = defined({ clientId, ownerUserId, types: list(types) as never });
  return c.json(await (await queriesFor(c)).calendar.range(from, to, Object.keys(filter).length ? filter : undefined));
});

readRoutes.get('/search', async (c) => {
  const { q, types } = c.req.query();
  return c.json(await (await queriesFor(c)).search.query(q ?? '', types ? { types: list(types) as never } : undefined));
});

readRoutes.get('/insights/:tab', async (c) => {
  const tab = c.req.param('tab') as InsightsTab;
  if (!['overview', 'trips', 'chasing', 'deadlines', 'workload', 'clients'].includes(tab)) throw new ValidationError({ tab: ['Unknown Insights tab'] });
  const { period, from, to, clientId, assignedUserId, templateId } = c.req.query();
  const filter: InsightsFilter = defined({ period, from, to, clientId, assignedUserId, templateId });
  return c.json(await (await queriesFor(c)).insights.get(tab, Object.keys(filter).length ? filter : undefined));
});

readRoutes.get('/baseline', async (c) => c.json(await (await queriesFor(c, ['baseline'])).baseline.get()));
readRoutes.get('/pulses', async (c) => c.json(await (await queriesFor(c, ['pulses'])).pulses.list()));

// ---- clients, contacts, authorizations --------------------------------------------------------------------------
readRoutes.get('/clients', async (c) => {
  const f = c.req.query();
  const filter = defined({
    search: f.search,
    status: f.status as never,
    entityType: f.entityType as never,
    vatStatus: f.vatStatus as never,
    channel: f.channel as never,
    efpsGroup: f.efpsGroup as never,
    assignedUserId: f.assignedUserId,
    hasBlocked: flag(f.hasBlocked),
    authAttention: flag(f.authAttention),
    tags: list(f.tags),
  });
  return c.json(paginate(await (await queriesFor(c)).clients.list(filter), f));
});
readRoutes.get('/clients/:id', async (c) => c.json(await (await queriesFor(c)).clients.get(c.req.param('id'))));
readRoutes.get('/clients/:clientId/contacts', async (c) => c.json(await (await queriesFor(c)).contacts.listByClient(c.req.param('clientId'))));
readRoutes.get('/clients/:clientId/authorizations', async (c) => c.json(await (await queriesFor(c)).authorizations.listByClient(c.req.param('clientId'))));

// ---- templates, deadlines, holidays, messages -------------------------------------------------------------------
readRoutes.get('/templates', async (c) => c.json(await (await queriesFor(c, ['templates'])).templates.list(defined({ active: flag(c.req.query('active')) }))));
readRoutes.get('/templates/:id', async (c) => c.json(await (await queriesFor(c, ['templates', 'reqTemplates'])).templates.get(c.req.param('id'))));
readRoutes.get('/deadline-moves', async (c) => c.json(await (await queriesFor(c, ['deadlineMoves'])).deadlineMoves.list()));
readRoutes.get('/holidays', async (c) => {
  const year = num(c.req.query('year'), 'year') ?? new Date().getUTCFullYear();
  return c.json(await (await queriesFor(c, ['holidays'])).holidays.list(year));
});
readRoutes.get('/messages', async (c) => c.json(await (await queriesFor(c, ['messageTemplates'])).messages.list()));

// ---- tasks and lines --------------------------------------------------------------------------------------------
function taskFilter(f: Record<string, string>) {
  return defined({
    clientId: f.clientId,
    statuses: list(f.statuses) as never,
    statusGroup: f.statusGroup as never,
    templateIds: list(f.templateIds),
    kinds: list(f.kinds) as never,
    ownerUserId: f.ownerUserId,
    dueFrom: f.dueFrom,
    dueTo: f.dueTo,
    period: f.period,
    officeAction: flag(f.officeAction),
    onVisit: flag(f.onVisit),
    unverified: flag(f.unverified),
    ids: list(f.ids),
    search: f.search,
    sort: f.sort,
  });
}
readRoutes.get('/tasks/board', async (c) => c.json(await (await queriesFor(c)).tasks.board(taskFilter(c.req.query()))));
readRoutes.get('/tasks', async (c) => c.json(paginate(await (await queriesFor(c)).tasks.list(taskFilter(c.req.query())), c.req.query())));
readRoutes.get('/tasks/:id', async (c) => c.json(await (await queriesFor(c)).tasks.get(c.req.param('id'))));
readRoutes.get('/lines/:id/history', async (c) => c.json(await (await queriesFor(c)).lines.history(c.req.param('id'))));

// ---- documents --------------------------------------------------------------------------------------------------
readRoutes.get('/documents/by-sha', async (c) => {
  const { sha256, clientId } = c.req.query();
  if (!sha256 || !clientId) throw new ValidationError({ sha256: ['sha256 and clientId are required'] });
  return c.json(await (await queriesFor(c)).documents.findBySha(sha256, clientId));
});
readRoutes.get('/documents', async (c) => {
  const f = c.req.query();
  const filter = defined({
    clientId: f.clientId,
    taskId: f.taskId,
    lineId: f.lineId,
    kind: list(f.kind) as never,
    lineStatus: list(f.lineStatus) as never,
    uploadedBy: f.uploadedBy,
    from: f.from,
    to: f.to,
    search: f.search,
  });
  return c.json(paginate(await (await queriesFor(c)).documents.list(filter), f));
});

// ---- follow-ups -------------------------------------------------------------------------------------------------
readRoutes.get('/follow-ups', async (c) => {
  const f = c.req.query();
  const filter = defined({ state: list(f.state) as never, clientId: f.clientId, taskId: f.taskId });
  return c.json(paginate(await (await queriesFor(c)).followUps.list(filter), f));
});
readRoutes.get('/follow-ups/:id', async (c) => c.json(await (await queriesFor(c)).followUps.get(c.req.param('id'))));

// ---- offices and visits -----------------------------------------------------------------------------------------
readRoutes.get('/offices', async (c) => {
  const f = c.req.query();
  return c.json(await (await queriesFor(c)).offices.list(defined({ type: f.type as never, search: f.search })));
});
readRoutes.get('/offices/:id', async (c) => c.json(await (await queriesFor(c)).offices.get(c.req.param('id'))));
readRoutes.get('/visit-kit', async (c) => c.json(await (await queriesFor(c, ['visitKit'])).visitKit.list()));
readRoutes.get('/visits', async (c) => {
  const f = c.req.query();
  const filter = defined({ status: list(f.status) as never, from: f.from, to: f.to, assigneeUserId: f.assigneeUserId });
  return c.json(paginate(await (await queriesFor(c)).visits.list(filter), f));
});
readRoutes.get('/visits/:id/suggestions', async (c) => c.json(await (await queriesFor(c)).visits.suggestTasks(c.req.param('id'))));
readRoutes.get('/visits/:id', async (c) => c.json(await (await queriesFor(c)).visits.get(c.req.param('id'))));

// ---- payments, notes, saved views, notifications ----------------------------------------------------------------
readRoutes.get('/payments', async (c) => {
  const f = c.req.query();
  const filter = defined({
    clientId: f.clientId,
    taskId: f.taskId,
    channel: f.channel as never,
    paidBy: f.paidBy as never,
    reimbursement: f.reimbursement as never,
    proofMissing: flag(f.proofMissing),
    from: f.from,
    to: f.to,
  });
  const result = await (await queriesFor(c)).payments.list(filter);
  return c.json({ ...paginate(result, f), totalAmount: result.totalAmount });
});
readRoutes.get('/notes', async (c) => {
  const { entity, entityId } = c.req.query();
  if (!entity || !entityId) throw new ValidationError({ entity: ['entity and entityId are required'] });
  return c.json(await (await queriesFor(c)).notes.list(entity as never, entityId));
});
readRoutes.get('/saved-views', async (c) => c.json(await (await queriesFor(c, ['savedViews'])).savedViews.list((c.req.query('page') ?? 'tasks') as never)));
readRoutes.get('/notifications/unread-count', async (c) => c.json(await (await queriesFor(c, ['notifications'])).notifications.unreadCount()));
readRoutes.get('/notifications', async (c) => c.json(paginate(await (await queriesFor(c, ['notifications'])).notifications.list(), c.req.query())));

// ---- reports and activity ---------------------------------------------------------------------------------------
readRoutes.get('/reports/client-checklist/:clientId', async (c) => c.json(await (await queriesFor(c)).reports.clientChecklist(c.req.param('clientId'))));
readRoutes.get('/reports/client-history/:clientId', async (c) => {
  const year = num(c.req.query('year'), 'year') ?? new Date().getUTCFullYear();
  return c.json(await (await queriesFor(c)).reports.clientHistory(c.req.param('clientId'), year));
});
readRoutes.get('/reports/monthly-summary', async (c) => {
  const month = c.req.query('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new ValidationError({ month: ['month must look like 2026-10'] });
  return c.json(await (await queriesFor(c)).reports.monthlySummary(month));
});
readRoutes.get('/reports/backup', async (c) => {
  requireOwner(c.get('actor'));
  const blob = await (await queriesFor(c)).reports.fullBackup();
  return new Response(await blob.text(), { headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="ordinovix-backup.json"', 'cache-control': 'private, no-store' } });
});
readRoutes.get('/reports/export/:file', async (c) => {
  requireOwner(c.get('actor'));
  const file = c.req.param('file');
  const kind = file.replace(/\.csv$/, '');
  if (!['clients', 'tasks', 'lines', 'follow_ups', 'visits', 'payments', 'activity'].includes(kind)) throw new ValidationError({ entity: ['Unknown export'] });
  const blob = await (await queriesFor(c)).reports.exportCsv(kind as never);
  return new Response('﻿' + (await blob.text()), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${kind}.csv"`, 'cache-control': 'private, no-store' } });
});
readRoutes.get('/activity', async (c) => {
  const f = c.req.query();
  const filter = defined({
    entity: f.entity as never,
    entityId: f.entityId,
    clientId: f.clientId,
    actorId: f.actorId,
    actions: list(f.actions) as never,
    from: f.from,
    to: f.to,
  });
  return c.json(paginate(await (await queriesFor(c)).activity.list(filter), f));
});
