import type {
  Repositories,
} from './repositories';
import type {
  User,
  Membership,
  Org,
  OrgSettings,
  UserPrefs,
  TodayQueue,
  ClientSummary,
  Client,
  Contact,
  Authorization,
  TaskTemplate,
  RequirementTemplate,
  DeadlineMove,
  Holiday,
  TaskSummary,
  Task,
  TaskLine,
  DocumentFile,
  VisitSummary,
  VisitItem,
  Payment,
  FollowUpView,
  FollowUp,
  MessageTemplate,
  Office,
  Visit,
  VisitKitItem,
  Note,
  SavedView,
  Notification,
  CalendarItem,
  InsightsTab,
  InsightsFilter,
  Baseline,
  Pulse,
  ActivityEvent,
  ID,
  TaskStatus,
} from '@/domain/types';


import {
  NotFoundError,
  ForbiddenError,
} from '@/domain/errors';

import {
  requireClientAccess,
  requireOwner,
  canAccessClient,
  insightsScope,
  type PolicyActor,
} from '@/domain/policy';
import {
  derivedStatus,
  dueState,
  isBlocked,
  blockingReason,
  statusGroup,
  visitItemReadiness,
  visitReadiness,
  packList,
  followUpState,
  authorizationState,
} from '@/domain/rules';
import {
  calculateFirstPassRate,
  computeInsights,
} from '@/domain/metrics';
import {
  todayInManila,
  addDaysToDate,
} from '@/lib/dates';
import {
  generateId,
} from '@/lib/ids';




/**
 * The read side of the data layer, as pure functions over the records of one organization and the signed-in person's
 * membership. The mock (localStorage) and the Worker (D1) both call these, so the permission filters, derived fields and
 * response shapes cannot drift apart (BACKEND_PLAN section 11). Nothing here touches storage, the network or the clock
 * except todayInManila().
 */
export interface QueryData {
  org: Org;
  settings: OrgSettings;
  users: User[];
  memberships: Membership[];
  prefs: Record<string, UserPrefs>;
  offices: Office[];
  clients: Client[];
  contacts: Contact[];
  authorizations: Authorization[];
  templates: TaskTemplate[];
  reqTemplates: RequirementTemplate[];
  tasks: Task[];
  taskLines: TaskLine[];
  visits: Visit[];
  visitItems: VisitItem[];
  visitKit: VisitKitItem[];
  followUps: FollowUp[];
  followUpAttempts: any[];
  payments: Payment[];
  messageTemplates: MessageTemplate[];
  holidays: Holiday[];
  deadlineMoves: DeadlineMove[];
  documents: DocumentFile[];
  notes: Note[];
  notifications: Notification[];
  savedViews: SavedView[];
  baseline: Baseline | null;
  pulses: Pulse[];
  activity: ActivityEvent[];
}

export interface QueryContext {
  store: QueryData;
  /** The signed-in person and their membership (role, assigned clients, active). */
  user: User;
  membership: Membership;
}

export function createQueries(ctx: QueryContext) {
  const { store } = ctx;
  const getCurrentUser = (): { user: User; membership: Membership } => ({ user: ctx.user, membership: ctx.membership });

  // ---- Policy guards (src/domain/policy.ts): every repository method calls one before it reads or writes ----
  function actor(): PolicyActor {
    return getCurrentUser().membership;
  }

  function assertOwner(): void {
    requireOwner(actor());
  }

  /** A write with no resolvable client can only be done by the owner; a helper is refused, never silently allowed. */
  function assertClient(clientId?: ID): void {
    if (!clientId) {
      requireOwner(actor());
      return;
    }
    requireClientAccess(actor(), clientId);
  }

  function assertTask(id: ID): void {
    const t = store.tasks.find((x) => x.id === id);
    if (!t || t.deletedAt) throw new NotFoundError('Task not found');
    assertClient(t.clientId);
  }

  function assertLine(id: ID): void {
    const l = store.taskLines.find((x) => x.id === id);
    if (!l) throw new NotFoundError('Line not found');
    assertClient(l.clientId);
  }

  function assertDocument(id: ID): void {
    const d = store.documents.find((x) => x.id === id);
    if (!d) throw new NotFoundError('Document not found');
    assertClient(d.clientId);
  }

  function assertFollowUp(id: ID): void {
    const f = store.followUps.find((x) => x.id === id);
    if (!f) throw new NotFoundError('Follow-up not found');
    assertClient(f.clientId);
  }

  function assertPayment(id: ID): void {
    const p = store.payments.find((x) => x.id === id);
    if (!p) throw new NotFoundError('Payment not found');
    assertClient(p.clientId);
  }

  /** A helper reaches a visit when it is theirs or when it carries an item for one of their clients. */
  function canReachVisit(visitId: ID): boolean {
    const a = actor();
    if (!a.active) return false;
    if (a.role === 'owner') return true;
    const { user } = getCurrentUser();
    const visit = store.visits.find((v) => v.id === visitId);
    if (!visit) return false;
    if (visit.assigneeUserId === user.id) return true;
    return store.visitItems.some((i) => i.visitId === visitId && canAccessClient(a, i.clientId));
  }

  /**
   * A visit as the person sees it in lists and calendars: one they can reach, and, for a helper, not one whose items
   * all belong to unassigned clients (it would read "0 of 0 ready"). A visit with no items at all still shows.
   */
  function isVisitListable(v: Visit): boolean {
    if (!canReachVisit(v.id)) return false;
    if (actor().role === 'owner') return true;
    const items = store.visitItems.filter((i) => i.visitId === v.id);
    return items.length === 0 || items.some((i) => isClientAllowed(i.clientId));
  }

  function assertVisit(id: ID): void {
    const v = store.visits.find((x) => x.id === id);
    if (!v || v.deletedAt) throw new NotFoundError('Visit not found');
    if (!canReachVisit(id)) throw new ForbiddenError("You don't have access to this visit");
  }

  function assertVisitItem(id: ID): void {
    const i = store.visitItems.find((x) => x.id === id);
    if (!i) throw new NotFoundError('Visit item not found');
    assertClient(i.clientId);
  }

  function assertNoteTarget(entity: 'client' | 'task' | 'visit', entityId: ID): void {
    if (entity === 'client') assertClient(entityId);
    else if (entity === 'task') assertTask(entityId);
    else assertVisit(entityId);
  }

  /** Records Insights may count for the current user: everything for the owner, assigned clients only for a helper. */
  function scopedInsightData() {
    const scope = insightsScope(actor());
    const ok = (clientId: ID) => scope.kind === 'all' || scope.clientIds.includes(clientId);
    return {
      visitItems: store.visitItems.filter((i) => ok(i.clientId)),
      tasks: store.tasks.filter((t) => ok(t.clientId)),
      taskLines: store.taskLines.filter((l) => ok(l.clientId)),
      visits: store.visits.filter((v) => canReachVisit(v.id)),
      clients: store.clients.filter((c) => ok(c.id)),
      followUps: store.followUps.filter((u) => ok(u.clientId)),
      attempts: store.followUpAttempts.filter((a) => store.followUps.some((u) => u.id === a.followUpId && ok(u.clientId))),
    };
  }

  function isClientAllowed(clientId: ID): boolean {
    return canAccessClient(actor(), clientId);
  }

  // Summary builders
  function buildTaskSummary(task: Task): TaskSummary {
    const client = store.clients.find((c) => c.id === task.clientId)!;
    const lines = store.taskLines.filter((l) => l.taskId === task.id);
    const status = derivedStatus(task, lines);
    const due = dueState(task, todayInManila());
    const accepted = lines.filter((l) => l.status === 'accepted').length;
    const required = lines.filter((l) => l.required && l.status !== 'not_applicable').length;
    const reason = blockingReason(lines);

    // Check attached visit
    const vItem = store.visitItems.find((vi) => vi.taskId === task.id);
    const visit = vItem ? store.visits.find((v) => v.id === vItem.visitId && v.status !== 'cancelled') : undefined;

    return {
      task,
      client,
      displayedStatus: status,
      statusGroup: statusGroup(status),
      dueState: due,
      acceptedLineCount: accepted,
      requiredLineCount: required,
      totalLineCount: lines.length,
      blockingReason: reason,
      attachedVisit: visit ? { visitId: visit.id, plannedDate: visit.plannedDate, officeName: visit.officeName } : undefined,
    };
  }

  function buildClientSummary(client: Client): ClientSummary {
    const tasks = store.tasks.filter((t) => t.clientId === client.id && t.status !== 'completed' && t.status !== 'archived');
    const taskLines = store.taskLines.filter((l) => l.clientId === client.id);

    let blockedCount = 0;
    let urgentDue: ClientSummary['urgentDueState'] = undefined;

    for (const t of tasks) {
      const lines = taskLines.filter((l) => l.taskId === t.id);
      const dStatus = derivedStatus(t, lines);
      if (statusGroup(dStatus) === 'blocked') {
        blockedCount++;
      }
      const due = dueState(t, todayInManila());
      if (due === 'overdue') urgentDue = 'overdue';
      else if (due === 'due_today' && urgentDue !== 'overdue') urgentDue = 'due_today';
      else if (due === 'due_soon' && !urgentDue) urgentDue = 'due_soon';
    }

    const pendingReview = taskLines.filter(
      (l) => l.status === 'received' || l.status === 'under_review'
    ).length;

    const auths = store.authorizations.filter((a) => a.clientId === client.id);
    const authAttention = auths.some((a) => authorizationState(a, todayInManila()) !== 'valid');

    const assigned = store.users.filter((u) => client.assignedUserIds.includes(u.id));

    return {
      client,
      activeTaskCount: tasks.length,
      blockedTaskCount: blockedCount,
      pendingReviewCount: pendingReview,
      urgentDueState: urgentDue,
      authAttention,
      assignedUsers: assigned,
    };
  }

  function buildVisitSummary(visit: Visit): VisitSummary {
    const items = store.visitItems.filter((vi) => vi.visitId === visit.id && isClientAllowed(vi.clientId));
    const reasons: string[] = [];
    let readyCount = 0;

    for (const vi of items) {
      const task = store.tasks.find((t) => t.id === vi.taskId)!;
      const lines = store.taskLines.filter((l) => l.taskId === task.id);
      const auths = store.authorizations.filter((a) => a.clientId === task.clientId);
      const client = store.clients.find((c) => c.id === task.clientId);
      const r = visitItemReadiness(vi, task, lines, auths, visit.plannedDate, client?.displayName);
      if (r.ready) readyCount++;
      else reasons.push(...r.reasons);
    }

    return {
      visit,
      itemCount: items.length,
      readyItemCount: readyCount,
      isReady: items.length > 0 && readyCount === items.length,
      blockingReasons: reasons,
    };
  }

  const today: Pick<Repositories['today'], 'queue'> = {
    async queue(scope = 'everyone') {
      const today = todayInManila();
      const { user } = getCurrentUser();

      // Filter tasks by allowed clients
      const allowedTasks = store.tasks.filter((t) => {
        if (!isClientAllowed(t.clientId)) return false;
        if (scope === 'mine' && t.ownerUserId !== user.id) return false;
        return t.status !== 'completed' && t.status !== 'archived';
      });

      const summaries = allowedTasks.map(buildTaskSummary);

      const overdue = summaries.filter((s) => s.dueState === 'overdue');
      const dueToday = summaries.filter((s) => s.dueState === 'due_today');
      const dueSoon = summaries.filter((s) => s.dueState === 'due_soon');

      // Lines needing review
      const reviewLines: TodayQueue['reviewRequiredLines'] = [];
      for (const t of allowedTasks) {
        const lines = store.taskLines.filter(
          (l) => l.taskId === t.id && (l.status === 'received' || l.status === 'under_review')
        );
        const client = store.clients.find((c) => c.id === t.clientId)!;
        for (const l of lines) {
          const files = store.documents.filter((d) => d.lineId === l.id && !d.deletedAt);
          reviewLines.push({ line: l, task: t, client, files });
        }
      }
      reviewLines.sort((a, b) => (a.line.receivedAt || '').localeCompare(b.line.receivedAt || ''));

      // Blocked by client tasks
      const clientBlockedMap = new Map<ID, { client: Client; tasks: Array<{ task: Task; missingLines: TaskLine[] }> }>();
      for (const t of allowedTasks) {
        const lines = store.taskLines.filter((l) => l.taskId === t.id);
        const missingLines = lines.filter(
          (l) =>
            l.status === 'requested' ||
            l.status === 'not_requested' ||
            l.status === 'incomplete' ||
            l.status === 'needs_correction'
        );
        if (missingLines.length > 0) {
          if (!clientBlockedMap.has(t.clientId)) {
            const client = store.clients.find((c) => c.id === t.clientId)!;
            clientBlockedMap.set(t.clientId, { client, tasks: [] });
          }
          clientBlockedMap.get(t.clientId)!.tasks.push({ task: t, missingLines });
        }
      }
      const blockedByClient: TodayQueue['blockedByClient'] = Array.from(clientBlockedMap.values()).map((entry) => {
        const allMissing = entry.tasks.flatMap((t) => t.missingLines);
        const labels = Array.from(new Set(allMissing.map((l) => l.label)));
        const firstTwo = labels.slice(0, 2);
        const remaining = labels.length - 2;
        const firstMissingLabels = remaining > 0 ? [...firstTwo, `+${remaining} more`] : firstTwo;

        const relatedFollowUps = store.followUps.filter((fu) => fu.clientId === entry.client.id);
        const attempts = store.followUpAttempts.filter((a) => relatedFollowUps.some((fu) => fu.id === a.followUpId));
        const lastAttempt = attempts.sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''))[0];

        return {
          client: entry.client,
          tasks: entry.tasks,
          missingCount: allMissing.length,
          firstMissingLabels,
          lastRequestedDate: lastAttempt && lastAttempt.sentAt ? lastAttempt.sentAt.slice(0, 10) : undefined,
          attemptCount: attempts.length,
        };
      });

      // Ready for my action
      const readyForActionTasks = summaries.filter((s) => {
        const lines = store.taskLines.filter((l) => l.taskId === s.task.id);
        const requiredLines = lines.filter((l) => l.required);
        const allRequiredAccepted = requiredLines.length > 0 && requiredLines.every((l) => l.status === 'accepted');
        return allRequiredAccepted && s.task.status !== 'completed' && s.task.status !== 'submitted';
      });

      // Next visits (upcoming visits, ordered by date)
      const nextVisits = store.visits
        .filter((v) => {
          if (v.status === 'cancelled' || v.status === 'done') return false;
          if (v.plannedDate < today) return false;
          return isVisitListable(v);
        })
        .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
        .slice(0, 5)
        .map((v) => {
          const summary = buildVisitSummary(v);
          const office = store.offices.find((o) => o.id === v.officeId);
          return {
            visit: v,
            office,
            itemCount: summary.itemCount,
            readyItemCount: summary.readyItemCount,
            isReady: summary.isReady,
            blockingReasons: summary.blockingReasons,
          };
        });

      // Follow-ups due
      const followUps = store.followUps
        .filter((fu) => isClientAllowed(fu.clientId) && fu.status !== 'resolved')
        .map((fu) => {
          const client = store.clients.find((c) => c.id === fu.clientId)!;
          const task = store.tasks.find((t) => t.id === fu.taskId);
          const lines = store.taskLines.filter((l) => fu.lineIds.includes(l.id));
          const contact = store.contacts.find((c) => c.id === fu.contactId);
          const state = followUpState(fu, today);
          const attempts = store.followUpAttempts.filter((a) => a.followUpId === fu.id);
          return { followUp: fu, client, task, lines, contact, state, attempts };
        })
        .filter((f) => f.state === 'due_today' || f.state === 'overdue');

      // Authorizations expiring
      const authorizationsExpiring = store.authorizations
        .filter((a) => {
          if (!isClientAllowed(a.clientId)) return false;
          const state = authorizationState(a, today);
          return state === 'expiring' || state === 'expired';
        })
        .map((a) => {
          const client = store.clients.find((c) => c.id === a.clientId)!;
          const state = authorizationState(a, today);
          return { authorization: a, client, state };
        })
        .sort((a, b) => (a.authorization.validUntil || '').localeCompare(b.authorization.validUntil || ''));

      // Next 14 days mini calendar
      const next14Days: TodayQueue['next14Days'] = [];
      for (let i = 0; i < 14; i++) {
        const d = addDaysToDate(today, i);
        const parts = d.split('-').map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayNumber = dt.getDate();
        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
        const hasDueTasks = allowedTasks.some((t) => t.dueDate === d);
        const hasVisits = store.visits.some(
          (v) =>
            v.plannedDate === d &&
            v.status !== 'cancelled' &&
            isVisitListable(v)
        );
        next14Days.push({ date: d, dayNumber, dayName, hasDueTasks, hasVisits });
      }

      // Recent activity
      const recentActivity = store.activity
        .filter((e) => (e.clientId ? isClientAllowed(e.clientId) : actor().active && actor().role === 'owner'))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 5);

      // KPI stats
      const firstPassRate = calculateFirstPassRate(scopedInsightData().visitItems);
      const blockedCount = summaries.filter((s) => s.statusGroup === 'blocked').length;

      // Counts
      const weekEndDate = addDaysToDate(today, 7);
      const visitsThisWeekCount = store.visits.filter((v) => {
        if (v.status === 'cancelled') return false;
        if (v.plannedDate < today || v.plannedDate > weekEndDate) return false;
        return isVisitListable(v);
      }).length;

      const counts = {
        overdue: overdue.length,
        dueThisWeek: summaries.filter((s) => s.dueState === 'due_soon' || s.dueState === 'due_today').length,
        blockedByClient: blockedByClient.length,
        awaitingReview: reviewLines.length,
        followUpsDue: followUps.length,
        visitsThisWeek: visitsThisWeekCount,
      };

      return {
        focusDate: today,
        overdueTasks: overdue,
        dueTodayTasks: dueToday,
        dueSoonTasks: dueSoon,
        reviewRequiredLines: reviewLines,
        blockedByClient,
        readyForActionTasks,
        nextVisits,
        followUpsDue: followUps,
        authorizationsExpiring,
        next14Days,
        recentActivity,
        counts,
        kpiStats: {
          firstPassRate,
          blockedCount,
          openTasksCount: allowedTasks.length,
        },
      };
    },
  };

  const clients: Pick<Repositories['clients'], 'list' | 'get'> = {
    async list(f) {
      let list = store.clients.filter((c) => !c.deletedAt && isClientAllowed(c.id));

      if (f?.search) {
        const q = f.search.toLowerCase();
        list = list.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.displayName.toLowerCase().includes(q) ||
            (c.registeredName && c.registeredName.toLowerCase().includes(q))
        );
      }
      if (f?.status) {
        list = list.filter((c) => c.status === f.status);
      }
      if (f?.entityType) {
        list = list.filter((c) => c.entityType === f.entityType);
      }
      if (f?.vatStatus) {
        list = list.filter((c) => c.vatStatus === f.vatStatus);
      }

      const summaries = list.map(buildClientSummary);
      return { items: summaries, total: summaries.length };
    },
    async get(id) {
      const client = store.clients.find((c) => c.id === id);
      if (!client || client.deletedAt) throw new NotFoundError('Client not found');
      if (!isClientAllowed(id)) throw new ForbiddenError("You don't have access to this client");
      return { client, summary: buildClientSummary(client) };
    },
  };

  const contacts: Pick<Repositories['contacts'], 'listByClient'> = {
    async listByClient(clientId) {
      assertClient(clientId);
      return store.contacts.filter((c) => c.clientId === clientId && !c.deletedAt);
    },
  };

  const authorizations: Pick<Repositories['authorizations'], 'listByClient'> = {
    async listByClient(clientId) {
      assertClient(clientId);
      return store.authorizations.filter((a) => a.clientId === clientId && !a.deletedAt);
    },
  };

  const templates: Pick<Repositories['templates'], 'list' | 'get'> = {
    async list(f) {
      if (f?.active !== undefined) return store.templates.filter((t) => t.active === f.active);
      return store.templates;
    },
    async get(id) {
      const template = store.templates.find((t) => t.id === id);
      if (!template) throw new NotFoundError('Template not found');
      const lines = store.reqTemplates.filter((l) => l.taskTemplateId === id);
      return { template, lines };
    },
  };

  const deadlineMoves: Pick<Repositories['deadlineMoves'], 'list'> = {
    async list() {
      return store.deadlineMoves;
    },
  };

  const holidays: Pick<Repositories['holidays'], 'list'> = {
    async list(year) {
      return store.holidays.filter((h) => h.date.startsWith(`${year}`));
    },
  };

  const tasks: Pick<Repositories['tasks'], 'list' | 'get' | 'board'> = {
    async list(f) {
      let list = store.tasks.filter((t) => !t.deletedAt && isClientAllowed(t.clientId));

      if (f?.clientId) list = list.filter((t) => t.clientId === f.clientId);
      if (f?.ownerUserId) list = list.filter((t) => t.ownerUserId === f.ownerUserId);
      if (f?.period) list = list.filter((t) => t.period === f.period);

      let summaries = list.map(buildTaskSummary);

      if (f?.statusGroup) {
        summaries = summaries.filter((s) => s.statusGroup === f.statusGroup);
      }
      if (f?.search) {
        const q = f.search.toLowerCase();
        summaries = summaries.filter(
          (s) =>
            s.client.displayName.toLowerCase().includes(q) ||
            (s.task.title && s.task.title.toLowerCase().includes(q))
        );
      }

      return { items: summaries, total: summaries.length };
    },
    async get(id) {
      const task = store.tasks.find((t) => t.id === id);
      if (!task || task.deletedAt) throw new NotFoundError('Task not found');
      if (!isClientAllowed(task.clientId)) throw new ForbiddenError("You don't have access to this client");
      const summary = buildTaskSummary(task);
      const lines = store.taskLines.filter((l) => l.taskId === id);
      const docs = store.documents.filter((d) => d.taskId === id);
      const vItems = store.visitItems.filter((vi) => vi.taskId === id);
      const visits = vItems.map((vi) => ({
        visit: buildVisitSummary(store.visits.find((v) => v.id === vi.visitId)!),
        item: vi,
      }));
      const payments = store.payments.filter((p) => p.taskId === id);
      const followUps = store.followUps
        .filter((fu) => fu.taskId === id)
        .map((fu) => ({
          followUp: fu,
          client: summary.client,
          lines: lines.filter((l) => fu.lineIds.includes(l.id)),
          state: followUpState(fu, todayInManila()),
          attempts: store.followUpAttempts.filter((a) => a.followUpId === fu.id),
        }));

      return { task, summary, lines, documents: docs, visits, payments, followUps };
    },
    async board(f) {
      const page = await tasks.list(f);
      const groups: Record<TaskStatus, TaskSummary[]> = {
        intake: [],
        waiting_on_client: [],
        review_required: [],
        needs_correction: [],
        in_preparation: [],
        ready_for_review: [],
        ready_next_step: [],
        submitted: [],
        awaiting_follow_up: [],
        completed: [],
        archived: [],
      };
      for (const item of page.items) {
        groups[item.displayedStatus].push(item);
      }
      return groups;
    },
  };

  const lines: Pick<Repositories['lines'], 'history'> = {
    async history(id) {
      assertLine(id);
      return store.activity.filter((a) => a.entity === 'line' && a.entityId === id);
    },
  };

  const documents: Pick<Repositories['documents'], 'list' | 'findBySha'> = {
    async list(f) {
      let list = store.documents.filter((d) => !d.deletedAt && isClientAllowed(d.clientId));
      if (f?.clientId) list = list.filter((d) => d.clientId === f.clientId);
      if (f?.taskId) list = list.filter((d) => d.taskId === f.taskId);
      if (f?.lineId) list = list.filter((d) => d.lineId === f.lineId);
      if (f?.kind && f.kind.length > 0) list = list.filter((d) => f.kind!.includes(d.kind));
      if (f?.uploadedBy) list = list.filter((d) => d.createdBy === f.uploadedBy);
      if (f?.search) {
        const q = f.search.toLowerCase();
        list = list.filter(
          (d) =>
            d.displayName.toLowerCase().includes(q) ||
            d.originalName.toLowerCase().includes(q) ||
            d.kind.toLowerCase().includes(q)
        );
      }
      return { items: list, total: list.length };
    },
    async findBySha(sha256, clientId) {
      assertClient(clientId);
      return store.documents.filter((d) => d.sha256 === sha256 && d.clientId === clientId);
    },
  };

  const followUps: Pick<Repositories['followUps'], 'list' | 'get'> = {
    async list(f) {
      let list = store.followUps.filter((fu) => !fu.deletedAt && isClientAllowed(fu.clientId));
      if (f?.clientId) {
        list = list.filter((fu) => fu.clientId === f.clientId);
      }
      if (f?.taskId) {
        list = list.filter((fu) => fu.taskId === f.taskId);
      }
      const today = todayInManila();
      let views: FollowUpView[] = list.map((fu) => {
        const client = store.clients.find((c) => c.id === fu.clientId) || store.clients[0];
        const task = store.tasks.find((t) => t.id === fu.taskId);
        const lines = store.taskLines.filter((l) => fu.lineIds.includes(l.id));
        const contact = store.contacts.find((c) => c.id === fu.contactId);
        const state = followUpState(fu, today);
        const attempts = store.followUpAttempts.filter((a) => a.followUpId === fu.id);
        return { followUp: fu, client, task, lines, contact, state, attempts };
      });
      if (f?.state && f.state.length > 0) {
        views = views.filter((v) => f.state!.includes(v.state));
      }
      return { items: views, total: views.length };
    },
    async get(id) {
      assertFollowUp(id);
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new NotFoundError('Follow-up not found');
      const client = store.clients.find((c) => c.id === fu.clientId) || store.clients[0];
      const task = store.tasks.find((t) => t.id === fu.taskId);
      const lines = store.taskLines.filter((l) => fu.lineIds.includes(l.id));
      const contact = store.contacts.find((c) => c.id === fu.contactId);
      const state = followUpState(fu, todayInManila());
      const attempts = store.followUpAttempts.filter((a) => a.followUpId === fu.id);
      return { followUp: fu, client, task, lines, contact, state, attempts };
    },
  };

  const messages: Pick<Repositories['messages'], 'list'> = {
    async list() {
      return [...store.messageTemplates]; // a copy, like the API: a changed row must look changed to the query cache
    },
  };

  const offices: Pick<Repositories['offices'], 'list' | 'get'> = {
    async list(f) {
      let list = store.offices;
      if (f?.type) list = list.filter((o) => o.type === f.type);
      if (f?.search) {
        const q = f.search.toLowerCase();
        list = list.filter((o) => o.name.toLowerCase().includes(q) || (o.rdoCode && o.rdoCode.includes(q)));
      }
      return list;
    },
    async get(id) {
      if (!actor().active) throw new ForbiddenError('Your access has been revoked');
      const office = store.offices.find((o) => o.id === id);
      if (!office) throw new NotFoundError('Office not found');
      // The office is practice-wide; its numbers cover only the visits and clients the person can reach
      const reachable = store.visits.filter((v) => v.officeId === id && canReachVisit(v.id));
      const vItems = store.visitItems.filter((vi) => reachable.some((v) => v.id === vi.visitId) && isClientAllowed(vi.clientId));
      const firstPass = calculateFirstPassRate(vItems);
      return {
        office,
        stats: {
          totalVisits: reachable.length,
          firstPassRate: firstPass,
          topCauses: [],
        },
      };
    },
  };

  const visits: Pick<Repositories['visits'], 'list' | 'get' | 'suggestTasks'> = {
    async list(f) {
      let list = store.visits.filter((v) => !v.deletedAt && canReachVisit(v.id));
      if (f?.status) list = list.filter((v) => f.status!.includes(v.status));
      const summaries = list.map(buildVisitSummary);
      return { items: summaries, total: summaries.length };
    },
    async get(id) {
      const visit = store.visits.find((v) => v.id === id);
      if (!visit || visit.deletedAt) throw new NotFoundError('Visit not found');
      if (!canReachVisit(id)) throw new ForbiddenError("You don't have access to this visit");
      const office = store.offices.find((o) => o.id === visit.officeId);
      // A helper sees only the items that belong to their own clients
      const items = store.visitItems.filter((vi) => vi.visitId === id && isClientAllowed(vi.clientId));

      const detailedItems = items.map((vi) => {
        const task = store.tasks.find((t) => t.id === vi.taskId)!;
        const client = store.clients.find((c) => c.id === task.clientId)!;
        const lines = store.taskLines.filter((l) => l.taskId === task.id);
        const auths = store.authorizations.filter((a) => a.clientId === client.id);
        const r = visitItemReadiness(vi, task, lines, auths, visit.plannedDate, client.displayName);
        return {
          item: vi,
          task,
          client,
          lines,
          isReady: r.ready,
          reasons: r.reasons,
        };
      });

      const readiness = visitReadiness(
        detailedItems.map((di) => ({
          ready: di.isReady,
          reasons: di.reasons,
          taskId: di.task.id,
          clientName: di.client.displayName,
        }))
      );

      const linesByTask: Record<ID, TaskLine[]> = {};
      detailedItems.forEach((di) => {
        linesByTask[di.task.id] = di.lines;
      });

      const clientMap: Record<ID, Client> = {};
      detailedItems.forEach((di) => {
        clientMap[di.client.id] = di.client;
      });

      const pList = packList(visit, items, linesByTask, store.visitKit, clientMap);

      return {
        visit,
        office,
        items: detailedItems,
        readiness,
        packList: pList.clientPacks,
        kitItems: pList.kitItems,
      };
    },
    async suggestTasks(visitId) {
      assertVisit(visitId);
      const readyTasks = store.tasks.filter((t) => {
        if (!isClientAllowed(t.clientId)) return false;
        if (t.status === 'completed' || t.status === 'archived') return false;
        const lines = store.taskLines.filter((l) => l.taskId === t.id);
        return derivedStatus(t, lines) === 'ready_next_step';
      });
      return readyTasks.map(buildTaskSummary);
    },
  };

  const visitKit: Pick<Repositories['visitKit'], 'list'> = {
    async list() {
      return [...store.visitKit];
    },
  };

  const payments: Pick<Repositories['payments'], 'list'> = {
    async list(f) {
      let list = store.payments.filter((p) => !p.deletedAt && isClientAllowed(p.clientId));
      if (f?.clientId) list = list.filter((p) => p.clientId === f.clientId);
      if (f?.taskId) list = list.filter((p) => p.taskId === f.taskId);
      if (f?.channel) list = list.filter((p) => p.channel === f.channel);
      if (f?.paidBy) list = list.filter((p) => p.paidBy === f.paidBy);
      if (f?.reimbursement) list = list.filter((p) => p.reimbursement?.status === f.reimbursement);
      if (f?.proofMissing !== undefined) {
        list = list.filter((p) =>
          f.proofMissing ? p.proofDocumentIds.length === 0 : p.proofDocumentIds.length > 0
        );
      }
      if (f?.from) list = list.filter((p) => p.paidOn >= f.from!);
      if (f?.to) list = list.filter((p) => p.paidOn <= f.to!);

      list.sort((a, b) => b.paidOn.localeCompare(a.paidOn));
      const total = list.reduce((acc, p) => acc + p.amount, 0);
      return { items: list, total: list.length, totalAmount: total };
    },
  };

  const notes: Pick<Repositories['notes'], 'list'> = {
    async list(entity, entityId) {
      assertNoteTarget(entity, entityId);
      return store.notes.filter((n) => n.entity === entity && n.entityId === entityId && !n.deletedAt);
    },
  };

  const savedViews: Pick<Repositories['savedViews'], 'list'> = {
    async list(page) {
      return store.savedViews.filter((v) => v.page === page);
    },
  };

  const notifications: Pick<Repositories['notifications'], 'list' | 'unreadCount'> = {
    async list() {
      const { user } = getCurrentUser();
      const list = store.notifications.filter((n) => n.userId === user.id);
      return { items: list, total: list.length };
    },
    async unreadCount() {
      const { user } = getCurrentUser();
      return store.notifications.filter((n) => n.userId === user.id && !n.readAt).length;
    },
  };

  const calendar: Pick<Repositories['calendar'], 'range'> = {
    async range(from, to, f) {
      if (!actor().active) return [];
      const items: CalendarItem[] = [];

      // 1. Task due dates
      store.tasks
        .filter(
          (t) =>
            isClientAllowed(t.clientId) &&
            t.dueDate >= from &&
            t.dueDate <= to &&
            t.status !== 'archived'
        )
        .forEach((t) => {
          const client = store.clients.find((c) => c.id === t.clientId);
          const lines = store.taskLines.filter((l) => l.taskId === t.id);
          const dispStatus = derivedStatus(t, lines);
          const dState = dueState(t, todayInManila());
          const blocked = isBlocked(t, lines);

          items.push({
            id: t.id,
            type: 'task_due',
            title: `${client?.code || 'Task'}: ${t.title || 'Filing Due'}`,
            date: t.dueDate,
            clientId: t.clientId,
            clientCode: client?.code,
            statusTone:
              dState === 'overdue'
                ? 'critical'
                : dState === 'due_today'
                ? 'warn'
                : 'info',
            meta: {
              taskId: t.id,
              clientCode: client?.code,
              clientName: client?.displayName,
              title: t.title,
              isBlocked: blocked,
              dueState: dState,
              displayedStatus: dispStatus,
              dueDate: t.dueDate,
              dueSource: t.dueSource,
              ownerUserId: t.ownerUserId,
            },
          });
        });

      // 2. Visits
      store.visits
        .filter(
          (v) =>
            !v.deletedAt &&
            v.status !== 'cancelled' &&
            v.plannedDate >= from &&
            v.plannedDate <= to &&
            isVisitListable(v)
        )
        .forEach((v) => {
          const summary = buildVisitSummary(v);
          items.push({
            id: v.id,
            type: 'visit',
            title: `Visit: ${v.officeName}`,
            date: v.plannedDate,
            meta: {
              visitId: v.id,
              officeName: v.officeName,
              rdoCode: v.rdoCode,
              arriveBy: v.arriveBy,
              assigneeUserId: v.assigneeUserId,
              isReady: summary.isReady,
              status: v.status,
            },
          });
        });

      // 3. Holidays
      store.holidays
        .filter((h) => h.date >= from && h.date <= to)
        .forEach((h) => {
          items.push({
            id: h.id,
            type: 'holiday',
            title: h.name,
            date: h.date,
            meta: {
              holidayType: h.type,
              sourceRef: h.sourceRef,
            },
          });
        });

      // 4. Follow-up expected responses
      store.followUps
        .filter(
          (fu) =>
            !fu.deletedAt &&
            fu.status !== 'resolved' &&
            fu.expectedBy &&
            fu.expectedBy >= from &&
            fu.expectedBy <= to &&
            isClientAllowed(fu.clientId)
        )
        .forEach((fu) => {
          const client = store.clients.find((c) => c.id === fu.clientId);
          items.push({
            id: fu.id,
            type: 'follow_up',
            title: `Follow-up: ${client?.code || 'Client'}`,
            date: fu.expectedBy!,
            clientId: fu.clientId,
            clientCode: client?.code,
            meta: {
              followUpId: fu.id,
              channel: fu.channel,
              attemptCount: fu.attemptCount,
            },
          });
        });

      // 5. Authorization expiries
      store.authorizations
        .filter(
          (a) =>
            !a.deletedAt &&
            !a.replacedById &&
            a.validUntil &&
            a.validUntil >= from &&
            a.validUntil <= to &&
            isClientAllowed(a.clientId)
        )
        .forEach((a) => {
          const client = store.clients.find((c) => c.id === a.clientId);
          items.push({
            id: a.id,
            type: 'authorization_expiry',
            title: `SPA Expiry: ${client?.code || 'Client'}`,
            date: a.validUntil!,
            clientId: a.clientId,
            clientCode: client?.code,
            meta: {
              authId: a.id,
              authType: a.type,
            },
          });
        });

      return items;
    },
  };

  const insights: Pick<Repositories['insights'], 'get'> = {
    async get(tab: InsightsTab, f?: InsightsFilter) {
      const scoped = scopedInsightData();
      const roleOf = new Map(store.memberships.filter((m) => m.userId).map((m) => [m.userId!, m.role]));
      const data = computeInsights(
        {
          ...scoped,
          deadlineMoves: store.deadlineMoves,
          templates: store.templates,
          pulses: store.pulses,
          baseline: store.baseline,
          userNames: Object.fromEntries(store.users.map((u) => [u.id, u.name])),
          userRoles: Object.fromEntries([...roleOf].map(([id, role]) => [id, role === 'owner' ? 'owner' : 'helper'])),
        },
        f ?? {},
        todayInManila(),
      );
      return data[tab] as any;
    },
  };

  const baseline: Pick<Repositories['baseline'], 'get'> = {
    async get() {
      return store.baseline;
    },
  };

  const pulses: Pick<Repositories['pulses'], 'list'> = {
    async list() {
      return store.pulses;
    },
  };

  const reports: Pick<Repositories['reports'], 'clientChecklist' | 'clientHistory' | 'monthlySummary' | 'exportCsv' | 'fullBackup'> = {
    async clientChecklist(clientId) {
      assertClient(clientId);
      const client = store.clients.find((c) => c.id === clientId)!;
      const tasks = store.tasks.filter((t) => t.clientId === clientId);
      const res = tasks.map((t) => ({
        task: t,
        lines: store.taskLines.filter((l) => l.taskId === t.id),
      }));
      return {
        client,
        generatedAt: todayInManila() + 'T00:00:00+08:00',
        tasks: res,
      };
    },
    async clientHistory(clientId, year) {
      assertClient(clientId);
      const client = store.clients.find((c) => c.id === clientId)!;
      const tasks = store.tasks.filter((t) => t.clientId === clientId && t.dueDate.startsWith(`${year}`));
      const payments = store.payments.filter((p) => p.clientId === clientId);
      const total = payments.reduce((acc, p) => acc + p.amount, 0);
      return {
        client,
        year,
        tasks: tasks.map(buildTaskSummary),
        totalPayments: total,
      };
    },
    async monthlySummary(month) {
      assertOwner();
      return {
        month,
        filingsCount: 16,
        onTimeFilingsCount: 15,
        totalVisits: 8,
        firstPassRate: 88,
        paymentsHandled: 4500000,
      };
    },
    async exportCsv(kind) {
      assertOwner();
      const csv = `Entity,ID,Timestamp\n${kind},${generateId()},${todayInManila()}`;
      return new Blob([csv], { type: 'text/csv' });
    },
    async fullBackup() {
      assertOwner();
      return new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    },
  };

  const activity: Pick<Repositories['activity'], 'list'> = {
    async list(f) {
      const who = actor();
      if (!who.active) throw new ForbiddenError('Your access has been revoked');
      if (f?.clientId) assertClient(f.clientId);
      if (!f?.clientId && !f?.entityId && who.role !== 'owner') {
        throw new ForbiddenError('Access denied: Practice-wide audit log is restricted to practice owners');
      }
      let list = store.activity;
      // A helper sees only events of clients they can reach; practice-wide events are the owner's
      if (who.role !== 'owner') list = list.filter((a) => a.clientId && canAccessClient(who, a.clientId));
      if (f?.entity) list = list.filter((a) => a.entity === f.entity);
      if (f?.clientId) list = list.filter((a) => a.clientId === f.clientId);
      if ((f as any)?.entityId) list = list.filter((a) => (a as any).entityId === (f as any).entityId);
      if (f?.actorId) list = list.filter((a) => a.actorId === f.actorId);
      if (f?.actions?.length) list = list.filter((a) => f.actions!.includes(a.action));
      if (f?.from) list = list.filter((a) => a.at.slice(0, 10) >= f.from!);
      if (f?.to) list = list.filter((a) => a.at.slice(0, 10) <= f.to!);
      // Newest first, whatever order the events were stored in
      const sorted = [...list].sort((a, b) => b.at.localeCompare(a.at));
      return { items: sorted, total: sorted.length };
    },
  };

  const search: Pick<Repositories['search'], 'query'> = {
    async query(q) {
      const query = q.toLowerCase();
      const today = todayInManila();
      if (!actor().active) return { clients: [], tasks: [], documents: [], visits: [], followUps: [], payments: [], offices: [] };

      // Clients: match name, code, or contacts
      const matchingClientIds = new Set<ID>();
      store.contacts.forEach((ct) => {
        if (ct.name.toLowerCase().includes(query) || (ct.email && ct.email.toLowerCase().includes(query))) {
          matchingClientIds.add(ct.clientId);
        }
      });

      const clients = store.clients
        .filter(
          (c) =>
            isClientAllowed(c.id) &&
            (c.displayName.toLowerCase().includes(query) ||
              c.code.toLowerCase().includes(query) ||
              (c.registeredName && c.registeredName.toLowerCase().includes(query)) ||
              matchingClientIds.has(c.id))
        )
        .map(buildClientSummary);

      // Tasks: match title, period, kind
      const tasks = store.tasks
        .filter(
          (t) =>
            isClientAllowed(t.clientId) &&
            (t.title?.toLowerCase().includes(query) ||
              t.period?.toLowerCase().includes(query) ||
              t.kind.toLowerCase().includes(query))
        )
        .map(buildTaskSummary);

      // Documents: match display name
      const documents = store.documents.filter(
        (d) => isClientAllowed(d.clientId) && !d.deletedAt && d.displayName.toLowerCase().includes(query)
      );

      // Visits: match officeName or purpose, respect scoping
      const visits = store.visits
        .filter((v) => {
          if (v.status === 'cancelled' || !isVisitListable(v)) return false;
          return (
            v.officeName.toLowerCase().includes(query) ||
            (v.purpose && v.purpose.toLowerCase().includes(query))
          );
        })
        .map(buildVisitSummary);

      // Follow-ups: match client or lines
      const followUps = store.followUps
        .filter((fu) => isClientAllowed(fu.clientId))
        .map((fu) => {
          const client = store.clients.find((c) => c.id === fu.clientId)!;
          const task = store.tasks.find((t) => t.id === fu.taskId);
          const lines = store.taskLines.filter((l) => fu.lineIds.includes(l.id));
          const contact = store.contacts.find((c) => c.id === fu.contactId);
          const state = followUpState(fu, today);
          const attempts = store.followUpAttempts.filter((a) => a.followUpId === fu.id);
          return { followUp: fu, client, task, lines, contact, state, attempts };
        })
        .filter(
          (f) =>
            f.client.displayName.toLowerCase().includes(query) ||
            f.client.code.toLowerCase().includes(query) ||
            f.lines.some((l) => l.label.toLowerCase().includes(query))
        );

      // Payments: match reference number or channel
      const payments = store.payments.filter((p) => {
        if (!isClientAllowed(p.clientId)) return false;
        return (
          (p.referenceNo && p.referenceNo.toLowerCase().includes(query)) ||
          p.channel.toLowerCase().includes(query)
        );
      });

      // Offices: match name or rdoCode
      const offices = store.offices.filter(
        (o) => o.name.toLowerCase().includes(query) || (o.rdoCode && o.rdoCode.toLowerCase().includes(query))
      );

      return {
        clients,
        tasks,
        documents,
        visits,
        followUps,
        payments,
        offices,
      };
    },
  };

  return { actor, assertOwner, assertClient, assertTask, assertLine, assertDocument, assertFollowUp, assertPayment, canReachVisit, isVisitListable, assertVisit, assertVisitItem, assertNoteTarget, scopedInsightData, isClientAllowed, buildTaskSummary, buildClientSummary, buildVisitSummary, today, clients, contacts, authorizations, templates, deadlineMoves, holidays, tasks, lines, documents, followUps, messages, offices, visits, visitKit, payments, notes, savedViews, notifications, calendar, insights, baseline, pulses, reports, activity, search };
}

export type Queries = ReturnType<typeof createQueries>;
