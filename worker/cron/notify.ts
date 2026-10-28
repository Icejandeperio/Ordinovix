/**
 * Notification jobs (spec section 14, BACKEND_PLAN 7a). Two crons, in UTC:
 *   0 23 * * *  = 7:00 AM Manila: daily digest, due soon and blocked, newly overdue, follow-ups due, authorization and accreditation
 *                 expiry, and the monthly check-in on the first working day;
 *   0 9 * * *   = 5:00 PM Manila: visits tomorrow that are not ready.
 * Each notification is a row with a link to a record (or screen) that exists. One notification per type, record, person and day:
 * the id is built from those and the insert ignores a repeat. After the rows are written, pushes go out to the devices of people
 * who have that type switched on, outside their quiet hours; a push held back by quiet hours is sent by a later run.
 * Push text is built from client codes and task titles only: no names, TINs, amounts or document contents.
 *
 * The read side is the same shared code the API uses (src/data/queries.ts), run as the person each notification is for, so a
 * helper's digest counts only the clients assigned to them.
 */
import { createQueries, type Queries, type QueryData } from '@/data/queries';
import type { Membership, NotificationType, TaskSummary, User } from '@/domain/types';
import { addDaysToDate, daysFromToday, todayInManila } from '@/lib/dates';
import { loadQueryData } from '../db/load';
import type { AppBindings } from '../env';
import { DEFAULT_PUSH_TYPES, inQuietHours, manilaHHmm, realPushDeps, sendPush, type PushDeps, type PushPayload } from '../push/send';

export interface Draft {
  userId: string;
  type: NotificationType;
  /** The record the notification is about; with the type, the person and the day it makes the id, so repeats collapse. */
  key: string;
  title: string;
  body: string;
  link: string;
  entity?: 'task' | 'visit' | 'authorization' | 'client' | 'settings';
  entityId?: string;
  clientId?: string;
}

const days = (n: number) => (n === 0 ? 'today' : n === 1 ? 'in 1 day' : `in ${n} days`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
const AUTH_LABEL: Record<string, string> = {
  spa: 'SPA',
  authorization_letter: 'authorization letter',
  secretary_certificate: "secretary's certificate",
  partnership_resolution: 'partnership resolution',
  other: 'authorization',
};

function viewerFor(store: QueryData, membership: Membership): Queries | null {
  const user: User | undefined = store.users.find((u) => u.id === membership.userId);
  return user ? createQueries({ store, user, membership }) : null;
}

const activeMembers = (store: QueryData) => store.memberships.filter((m) => m.active && !m.revokedAt && !m.deletedAt && m.userId);

/** First working day of the month: not a weekend and not a holiday. */
export function isFirstWorkingDay(today: string, holidays: string[]): boolean {
  const skip = new Set(holidays);
  const first = today.slice(0, 8) + '01';
  for (let i = 0; i < 31; i++) {
    const d = addDaysToDate(first, i);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6 && !skip.has(d)) return d === today;
  }
  return false;
}

const taskText = (store: QueryData, s: TaskSummary) => `${store.clients.find((c) => c.id === s.task.clientId)?.code ?? 'Client'} ${s.task.title ?? 'task'}`;

/** The 7:00 AM notifications for one organization. */
export async function morningDrafts(store: QueryData): Promise<Draft[]> {
  const today = todayInManila();
  const tomorrow = addDaysToDate(today, 1);
  const yesterday = addDaysToDate(today, -1);
  const out: Draft[] = [];
  const members = activeMembers(store);
  const memberIds = new Set(members.map((m) => m.userId!));
  const owners = members.filter((m) => m.role === 'owner');
  const ownerView = owners.map((m) => viewerFor(store, m)).find((q): q is Queries => Boolean(q));
  const ownerIds = owners.map((m) => m.userId!);
  const code = (clientId: string) => store.clients.find((c) => c.id === clientId)?.code ?? 'Client';

  for (const m of members) {
    const q = viewerFor(store, m);
    if (!q) continue;
    const queue = await q.today.queue('mine');
    const { overdue, awaitingReview, followUpsDue } = queue.counts;
    const visitTomorrowNotReady = queue.nextVisits.some((v) => v.visit.plannedDate === tomorrow && !v.isReady);
    const parts = [
      overdue > 0 ? `${overdue} overdue` : '',
      awaitingReview > 0 ? `${awaitingReview} to review` : '',
      followUpsDue > 0 ? `${plural(followUpsDue, 'follow-up')} to send` : '',
      visitTomorrowNotReady ? 'visit tomorrow not ready' : '',
    ].filter(Boolean);
    out.push({ userId: m.userId!, type: 'daily_digest', key: 'digest', title: 'Daily digest', body: parts.length ? `Today: ${parts.join(', ')}.` : 'Today: nothing needs you.', link: '/' });
    if (followUpsDue > 0) {
      out.push({ userId: m.userId!, type: 'follow_ups_due', key: 'follow-ups', title: 'Follow-ups to send', body: `${plural(followUpsDue, 'follow-up')} to send today.`, link: '/follow-ups' });
    }
    // due soon and still waiting on items: the task owner
    const blocked = await q.tasks.list({ ownerUserId: m.userId!, statusGroup: 'blocked' });
    for (const s of blocked.items.filter((x) => x.dueState === 'due_today' || x.dueState === 'due_soon')) {
      const missing = Math.max(1, s.requiredLineCount - s.acceptedLineCount);
      out.push({
        userId: m.userId!,
        type: 'due_soon_blocked',
        key: s.task.id,
        title: 'Due soon and missing items',
        body: `${taskText(store, s)} is due ${days(daysFromToday(s.task.dueDate))} and still waiting on ${plural(missing, 'item')}.`,
        link: `/tasks/${s.task.id}`,
        entity: 'task',
        entityId: s.task.id,
        clientId: s.task.clientId,
      });
    }
  }

  if (ownerView) {
    // newly overdue: due yesterday and still open; the task owner and the organization owners
    const justOverdue = await ownerView.tasks.list({ dueFrom: yesterday, dueTo: yesterday });
    for (const s of justOverdue.items.filter((x) => x.dueState === 'overdue')) {
      for (const userId of new Set([s.task.ownerUserId, ...ownerIds].filter((id) => memberIds.has(id)))) {
        out.push({ userId, type: 'overdue', key: s.task.id, title: 'Newly overdue', body: `${taskText(store, s)} is overdue.`, link: `/tasks/${s.task.id}`, entity: 'task', entityId: s.task.id, clientId: s.task.clientId });
      }
    }
  }

  // authorizations expiring in 30 days, in 7 days, and on the day: the organization owners
  for (const a of store.authorizations.filter((x) => !x.deletedAt && !x.replacedById && x.validUntil)) {
    const left = daysFromToday(a.validUntil!);
    if (![30, 7, 0].includes(left)) continue;
    for (const userId of ownerIds) {
      out.push({ userId, type: 'authorization_expiring', key: a.id, title: 'Authorization expiring', body: `${code(a.clientId)}'s ${AUTH_LABEL[a.type] ?? 'authorization'} expires ${days(left)}.`, link: `/clients/${a.clientId}`, entity: 'authorization', entityId: a.id, clientId: a.clientId });
    }
  }

  // the tax agent accreditation: 60 and 30 days before
  const until = store.settings?.accreditation?.validUntil;
  if (until && [60, 30].includes(daysFromToday(until))) {
    for (const userId of ownerIds) {
      out.push({ userId, type: 'accreditation_expiring', key: 'accreditation', title: 'Accreditation expiring', body: `Your tax agent accreditation expires on ${shortDate(until)}.`, link: '/settings/practice', entity: 'settings', entityId: store.org.id });
    }
  }

  if (isFirstWorkingDay(today, store.holidays.map((h) => h.date))) {
    for (const userId of ownerIds) {
      out.push({ userId, type: 'monthly_check_in', key: 'check-in', title: 'Monthly check-in', body: 'Two quick questions about last month.', link: '/insights' });
    }
  }
  return out;
}

/** The 5:00 PM notifications for one organization: tomorrow's visits that are not ready. */
export async function eveningDrafts(store: QueryData): Promise<Draft[]> {
  const tomorrow = addDaysToDate(todayInManila(), 1);
  const members = activeMembers(store);
  const memberIds = new Set(members.map((m) => m.userId!));
  const owners = members.filter((m) => m.role === 'owner');
  const ownerView = owners.map((m) => viewerFor(store, m)).find((q): q is Queries => Boolean(q));
  if (!ownerView) return [];
  const out: Draft[] = [];
  const visits = await ownerView.visits.list({ from: tomorrow, to: tomorrow });
  for (const s of visits.items.filter((x) => x.visit.status === 'planned' && x.itemCount > 0 && !x.isReady)) {
    const where = s.visit.officeType === 'rdo' ? 'RDO' : s.visit.officeType === 'bank' ? 'bank' : s.visit.officeType.replace('_', ' ');
    const notReady = s.itemCount - s.readyItemCount;
    for (const userId of new Set([s.visit.assigneeUserId, ...owners.map((o) => o.userId!)].filter((id) => memberIds.has(id)))) {
      out.push({ userId, type: 'visit_not_ready_tomorrow', key: s.visit.id, title: 'Visit not ready', body: `Tomorrow's ${where} visit is not ready: ${plural(notReady, 'item')}.`, link: `/visits/${s.visit.id}`, entity: 'visit', entityId: s.visit.id });
    }
  }
  return out;
}

const stamp = (now: Date) => new Date(now.getTime() + 8 * 3600_000).toISOString().replace('Z', '+08:00');
const BATCH = 100;

async function insertDrafts(env: AppBindings, orgId: string, drafts: Draft[], now: Date): Promise<number> {
  const day = todayInManila();
  const at = stamp(now);
  const statements = drafts.map((d) =>
    env.DB
      .prepare(
        'INSERT OR IGNORE INTO notifications (id, org_id, user_id, type, title, body, link, entity, entity_id, client_id, created_at, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(`ntf-${d.type}-${d.key}-${d.userId}-${day}`, orgId, d.userId, d.type, d.title, d.body, d.link, d.entity ?? null, d.entityId ?? null, d.clientId ?? null, at, 'system', at, 'system'),
  );
  let created = 0;
  for (let i = 0; i < statements.length; i += BATCH) {
    const results = await env.DB.batch(statements.slice(i, i + BATCH));
    created += results.reduce((n, r) => n + (r.meta?.changes ?? 0), 0);
  }
  return created;
}

export interface NotifyResult {
  created: number;
  pushed: number;
  removedSubscriptions: number;
}

/** Writes the notifications of one job for every organization, then sends the pushes that are due. */
export async function runNotifications(env: AppBindings, job: 'morning' | 'evening', deps: PushDeps = realPushDeps(), now: Date = new Date()): Promise<NotifyResult> {
  const { results: orgs } = await env.DB.prepare('SELECT id FROM orgs').all<{ id: string }>();
  let created = 0;
  for (const { id } of orgs) {
    const store = await loadQueryData(env.DB, id);
    if (!store.org || !store.settings) continue;
    const drafts = job === 'morning' ? await morningDrafts(store) : await eveningDrafts(store);
    created += await insertDrafts(env, id, drafts, now);
  }
  const sent = await sendDuePushes(env, deps, now);
  return { created, ...sent };
}

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/**
 * Sends the pushes that are due: notifications made by the jobs in the last 24 hours that nobody has read or been pushed yet,
 * of a type the person has switched on, to each of their devices, outside their quiet hours. A subscription that answers 404 or
 * 410 is removed. A notification is marked pushed once any device took it; one that every device refused with a server
 * error stays pending for the next run.
 */
export async function sendDuePushes(env: AppBindings, deps: PushDeps, now: Date = new Date()): Promise<{ pushed: number; removedSubscriptions: number }> {
  const since = stamp(new Date(now.getTime() - 24 * 3600_000));
  const { results: pending } = await env.DB
    .prepare(
      "SELECT id, org_id, user_id, type, title, body, link FROM notifications WHERE created_by = 'system' AND pushed_at IS NULL AND read_at IS NULL AND deleted_at IS NULL AND created_at >= ? ORDER BY created_at",
    )
    .bind(since)
    .all<{ id: string; org_id: string; user_id: string; type: string; title: string; body: string; link: string }>();
  let pushed = 0;
  let removed = 0;
  const hhmm = manilaHHmm(now);
  const ctx = new Map<string, { quiet: boolean; contact: string }>();
  const orgContext = async (orgId: string) => {
    if (!ctx.has(orgId)) {
      const s = await env.DB.prepare('SELECT quiet_hours_start AS qs, quiet_hours_end AS qe, support_contact AS support FROM org_settings WHERE org_id = ?').bind(orgId).first<{ qs: string; qe: string; support: string | null }>();
      const owner = await env.DB.prepare("SELECT email FROM memberships WHERE org_id = ? AND role = 'owner' AND active = 1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1").bind(orgId).first<{ email: string }>();
      const support = s?.support ?? '';
      const contact = /^https:\/\//.test(support) ? support : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(support) ? `mailto:${support}` : `mailto:${owner?.email ?? 'admin@ordinovix.invalid'}`;
      ctx.set(orgId, { quiet: s ? inQuietHours(hhmm, s.qs, s.qe) : false, contact });
    }
    return ctx.get(orgId)!;
  };
  const prefsOf = new Map<string, string[] | null>();
  const enabledTypes = async (userId: string) => {
    if (!prefsOf.has(userId)) {
      const row = await env.DB.prepare('SELECT push_types FROM user_prefs WHERE user_id = ?').bind(userId).first<{ push_types: string }>();
      prefsOf.set(userId, row ? (JSON.parse(row.push_types) as string[]) : null);
    }
    return prefsOf.get(userId) ?? [...DEFAULT_PUSH_TYPES];
  };

  for (const n of pending) {
    const { quiet, contact } = await orgContext(n.org_id);
    if (quiet) continue; // held until the quiet hours end; a later run sends it
    if (!(await enabledTypes(n.user_id)).includes(n.type)) continue;
    const { results: subs } = await env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE org_id = ? AND user_id = ?').bind(n.org_id, n.user_id).all<{ id: string; endpoint: string; p256dh: string; auth: string }>();
    if (subs.length === 0) continue;
    const payload: PushPayload = { title: clip(n.title, 60), body: clip(n.body, 120), url: n.link, tag: n.type };
    let delivered = false;
    for (const sub of subs) {
      const result = await sendPush(deps, env, sub, payload, contact);
      if (result === 'sent') delivered = true;
      if (result === 'gone') {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
        removed++;
      }
    }
    if (delivered) {
      await env.DB.prepare('UPDATE notifications SET pushed_at = ? WHERE id = ?').bind(stamp(now), n.id).run();
      pushed++;
    }
  }
  return { pushed, removedSubscriptions: removed };
}
