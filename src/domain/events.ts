/**
 * The notifications that actions cause (spec 14): a line received, a visit ready, a visit started without everything ready, an
 * outcome recorded, something assigned to you. They are derived from what a command changed, not written inside each command:
 * capture a small state before the command runs, compare it with the records afterwards, and make the rows the changes call for.
 * One place, so the mock and the Worker (which both run the same commands) make the same notifications, and a new code path
 * that changes a line or a visit cannot forget one.
 *
 * Each notification has a `title` that is safe on a lock screen (client and task codes, office type and dates; never a person's
 * name, a TIN, an amount or a document's contents): a push shows the title. The `body` is the fuller sentence of spec 14, with the
 * first name of whoever acted, for the Notifications screen only.
 *
 * Pure: no storage, no network, no clock but the arguments.
 */
import type {
  Authorization, Client, FollowUp, ID, ISODate, ISODateTime, Membership, Notification, NotificationType, Org, OrgSettings, Outcome, Task, TaskLine,
  User, Visit, VisitItem,
} from './types';
import { OUTCOME_META } from './labels';
import { visitItemReadiness } from './rules';

/** The records the rules read. The mock's store and the Worker's loaded organization both have this shape. */
export interface EventStore {
  org: Pick<Org, 'id'>;
  settings: Pick<OrgSettings, 'helpersCanAccept'>;
  users: User[];
  memberships: Membership[];
  clients: Client[];
  tasks: Task[];
  taskLines: TaskLine[];
  authorizations: Authorization[];
  visits: Visit[];
  visitItems: VisitItem[];
  followUps: FollowUp[];
  notifications: Notification[];
}

export interface EventState {
  lineStatus: Map<ID, string>;
  taskOwner: Map<ID, ID | undefined>;
  visitAssignee: Map<ID, ID | undefined>;
  visitStatus: Map<ID, string>;
  itemOutcome: Map<ID, Outcome | undefined>;
  readyVisits: Set<ID>;
  followUpIds: Set<ID>;
}

/** A planned visit with items is ready when every item is (spec: a visit is ready only when every item is ready). */
export function visitIsReady(store: EventStore, visit: Visit): boolean {
  const items = store.visitItems.filter((i) => i.visitId === visit.id && !i.deletedAt);
  if (items.length === 0) return false;
  return items.every((item) => itemIsReady(store, visit, item));
}

function itemIsReady(store: EventStore, visit: Visit, item: VisitItem): boolean {
  const task = store.tasks.find((t) => t.id === item.taskId);
  if (!task) return false;
  const lines = store.taskLines.filter((l) => l.taskId === task.id && !l.deletedAt);
  const auths = store.authorizations.filter((a) => a.clientId === task.clientId);
  return visitItemReadiness(item, task, lines, auths, visit.plannedDate, store.clients.find((c) => c.id === task.clientId)?.displayName).ready;
}

function notReadyCount(store: EventStore, visit: Visit): number {
  return store.visitItems.filter((i) => i.visitId === visit.id && !i.deletedAt && !itemIsReady(store, visit, i)).length;
}

export function captureEventState(store: EventStore): EventState {
  return {
    lineStatus: new Map(store.taskLines.map((l) => [l.id, l.status])),
    taskOwner: new Map(store.tasks.map((t) => [t.id, t.ownerUserId])),
    visitAssignee: new Map(store.visits.map((v) => [v.id, v.assigneeUserId])),
    visitStatus: new Map(store.visits.map((v) => [v.id, v.status])),
    itemOutcome: new Map(store.visitItems.map((i) => [i.id, i.outcome])),
    readyVisits: new Set(store.visits.filter((v) => v.status === 'planned' && visitIsReady(store, v)).map((v) => v.id)),
    followUpIds: new Set(store.followUps.map((f) => f.id)),
  };
}

// ---- Words --------------------------------------------------------------------------------------------------------------
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayOf = (d: ISODate) => WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()];
const shortDate = (d: ISODate) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const where = (v: Visit) => (v.officeType === 'rdo' ? 'RDO' : v.officeType === 'bank' ? 'bank' : v.officeType.replace('_', ' '));
const firstName = (u: User | undefined) => u?.displayName ?? u?.name.split(' ')[0] ?? 'Someone';

export interface EventActor {
  user: User;
  membership: Pick<Membership, 'role'>;
}

/**
 * The notifications this change calls for, already free of duplicates (one per type, record, person and day, also against the
 * ones already in the store). The caller appends them to `store.notifications`.
 */
export function deriveEventNotifications(before: EventState, store: EventStore, actor: EventActor, today: ISODate, now: ISODateTime): Notification[] {
  const out: Notification[] = [];
  const seen = new Set(store.notifications.map((n) => n.id));
  const people = store.memberships.filter((m) => m.userId && m.active && !m.revokedAt && !m.deletedAt);
  const memberOf = (userId: ID | undefined) => people.find((m) => m.userId === userId);
  const owners = people.filter((m) => m.role === 'owner' && m.userId !== actor.user.id).map((m) => m.userId!);
  const code = (clientId: ID) => store.clients.find((c) => c.id === clientId)?.code ?? 'Client';
  const taskText = (t: Task) => `${code(t.clientId)} ${t.title ?? 'task'}`;
  const actorIsHelper = actor.membership.role === 'helper';
  const first = firstName(actor.user);

  /** A helper reaches a client only when it is assigned to them; an owner reaches every client. */
  const reaches = (userId: ID, clientId: ID) => {
    const m = memberOf(userId);
    return !!m && (m.role === 'owner' || m.clientIds.includes(clientId));
  };
  const reachesVisit = (userId: ID, v: Visit) => {
    const m = memberOf(userId);
    if (!m) return false;
    if (m.role === 'owner' || v.assigneeUserId === userId) return true;
    return store.visitItems.some((i) => i.visitId === v.id && m.clientIds.includes(i.clientId));
  };

  function add(userId: ID, type: NotificationType, key: string, n: Pick<Notification, 'title' | 'body' | 'link' | 'entity' | 'entityId'>) {
    const id = `ntf-${type}-${key}-${userId}-${today}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      orgId: store.org.id,
      userId,
      type,
      ...n,
      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system',
      version: 1,
    });
  }

  // Received, needs review: a helper marks a line received (or uploads one). To the task owner when they can review it, else to
  // the organization owner (helpers who may not accept leave the review to the owner).
  if (actorIsHelper) {
    for (const line of store.taskLines) {
      if (line.status !== 'received' || before.lineStatus.get(line.id) === 'received') continue;
      const task = store.tasks.find((t) => t.id === line.taskId);
      if (!task) continue;
      const ownerM = memberOf(task.ownerUserId);
      const ownerCanReview = !!ownerM && (ownerM.role === 'owner' || store.settings.helpersCanAccept);
      const recipients = ownerM && ownerM.userId !== actor.user.id && ownerCanReview ? [ownerM.userId!] : store.settings.helpersCanAccept ? [] : owners;
      for (const userId of recipients) {
        if (!reaches(userId, task.clientId)) continue;
        add(userId, 'received_needs_review', task.id, {
          title: `${taskText(task)}: needs review.`,
          body: `${first} added ${line.label} for ${taskText(task)}. Needs review.`,
          link: `/tasks/${task.id}`,
          entity: 'task',
          entityId: task.id,
        });
      }
    }
  }

  for (const visit of store.visits) {
    const was = before.visitStatus.get(visit.id);

    // Visit ready: a planned visit that was not ready now is. To the assignee.
    if (visit.status === 'planned' && was !== undefined && !before.readyVisits.has(visit.id) && visitIsReady(store, visit) && visit.assigneeUserId && reachesVisit(visit.assigneeUserId, visit)) {
      add(visit.assigneeUserId, 'visit_ready', visit.id, {
        title: `${weekdayOf(visit.plannedDate)}'s ${where(visit)} visit is ready to go.`,
        body: `Every item on the ${shortDate(visit.plannedDate)} ${where(visit)} visit is ready.`,
        link: `/visits/${visit.id}`,
        entity: 'visit',
        entityId: visit.id,
      });
    }

    // Left without everything ready: a visit starts with a reason. To the organization owner.
    if (was === 'planned' && visit.status === 'in_progress' && visit.departureOverrideReason) {
      const missing = notReadyCount(store, visit);
      if (missing > 0) {
        for (const userId of owners) {
          add(userId, 'left_not_ready', visit.id, {
            title: `${where(visit)} visit started with ${plural(missing, 'item')} not ready.`,
            body: `${first} started the ${where(visit)} visit with ${plural(missing, 'item')} not ready: ${visit.departureOverrideReason}.`,
            link: `/visits/${visit.id}`,
            entity: 'visit',
            entityId: visit.id,
          });
        }
      }
    }

    // Assigned to you: a visit is given to someone else, or made for them
    if (visit.assigneeUserId && visit.assigneeUserId !== actor.user.id && visit.assigneeUserId !== before.visitAssignee.get(visit.id) && reachesVisit(visit.assigneeUserId, visit)) {
      add(visit.assigneeUserId, 'assigned', visit.id, {
        title: `You were assigned the ${where(visit)} visit on ${shortDate(visit.plannedDate)}.`,
        body: `${first} assigned you the ${where(visit)} visit on ${shortDate(visit.plannedDate)}.`,
        link: `/visits/${visit.id}`,
        entity: 'visit',
        entityId: visit.id,
      });
    }
  }

  // Outcome recorded: a helper records what happened at the counter. To the organization owner.
  if (actorIsHelper) {
    for (const item of store.visitItems) {
      if (!item.outcome || before.itemOutcome.get(item.id)) continue;
      const task = store.tasks.find((t) => t.id === item.taskId);
      const visit = store.visits.find((v) => v.id === item.visitId);
      if (!task || !visit) continue;
      const label = OUTCOME_META[item.outcome].label;
      const followUp = store.followUps.some((f) => !before.followUpIds.has(f.id) && f.taskId === task.id);
      for (const userId of owners) {
        add(userId, 'outcome_recorded', item.id, {
          title: `${taskText(task)}: ${label.toLowerCase()}.`,
          body: `${first} recorded "${label}" for ${taskText(task)}.${followUp ? ' Follow-up created.' : ''}`,
          link: `/visits/${visit.id}`,
          entity: 'visit',
          entityId: visit.id,
        });
      }
    }
  }

  // Assigned to you: a task is given to someone else, or made for them
  for (const task of store.tasks) {
    const owner = task.ownerUserId;
    if (!owner || owner === actor.user.id || owner === before.taskOwner.get(task.id) || !reaches(owner, task.clientId)) continue;
    add(owner, 'assigned', task.id, {
      title: `You were assigned ${taskText(task)}.`,
      body: `${first} assigned you ${taskText(task)}.`,
      link: `/tasks/${task.id}`,
      entity: 'task',
      entityId: task.id,
    });
  }

  return out;
}
