import type { Repositories } from '../repositories';
import type {
  User,
  Membership,
  Org,
  OrgSettings,
  UserPrefs,
  TodayQueue,
  Page,
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
  VisitDetail,
  Visit,
  VisitKitItem,
  Note,
  SavedView,
  Notification,
  CalendarItem,
  InsightsTab,
  InsightsFilter,
  InsightsData,
  Baseline,
  Pulse,
  ActivityEvent,
  SearchResults,
  ID,
  ISODate,
  TaskStatus,
  LineStatus,
  VisitAction,
  Outcome,
  OutcomeCause,
  NextAction,
  Role,
  ImportPreview,
  OpenPeriodPreview,
  OpenPeriodPlan,
} from '@/domain/types';
import { generateSeedData } from './seed';
import {
  derivedStatus,
  dueState,
  blockingReason,
  statusGroup,
  visitItemReadiness,
  visitReadiness,
  packList,
  followUpState,
  authorizationState,
  canTransitionLine,
  canSetStatus,
} from '@/domain/rules';
import {
  calculateFirstPassRate,
  countTripsNeedingReturn,
  calculateVisitsLeftReadyRate,
  calculateOnTimeRate,
  calculateDaysToCollect,
  countLateDiscoveredBlockers,
  calculateClientResponseDays,
} from '@/domain/metrics';
import { todayInManila, setDevToday, getDevToday } from '@/lib/dates';
import { generateId } from '@/lib/ids';

const STORAGE_KEY = 'ox-mock-data-v2';
const PERSONA_KEY = 'ox-mock-persona';
const FAILURE_RATE_KEY = 'ox-mock-failure-rate';
const OFFLINE_KEY = 'ox-mock-offline';

interface StoreData {
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

let store: StoreData = loadStore();
let currentPersona: 'owner' | 'helper' = (localStorage.getItem(PERSONA_KEY) as 'owner' | 'helper') || 'owner';
let failureRate: number = parseFloat(localStorage.getItem(FAILURE_RATE_KEY) || '0');
let isOffline: boolean = localStorage.getItem(OFFLINE_KEY) === 'true';

function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load store from localStorage', e);
  }
  const seed = generateSeedData(todayInManila());
  const initialStore: StoreData = {
    ...seed,
    documents: [],
    notes: [],
    notifications: [],
    savedViews: [],
    baseline: null,
    pulses: [],
    activity: [],
  };
  saveStore(initialStore);
  return initialStore;
}

function saveStore(data: StoreData = store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save store to localStorage', e);
  }
}

async function simulateLatency(): Promise<void> {
  if (isOffline) {
    throw new Error('Network error: Device is currently simulated as offline');
  }
  if (failureRate > 0 && Math.random() < failureRate) {
    throw new Error('Simulated network request failure');
  }
  const delay = Math.floor(Math.random() * 200) + 150; // 150 - 350 ms
  await new Promise((resolve) => setTimeout(resolve, delay));
}

function getCurrentUser(): { user: User; membership: Membership } {
  const email = currentPersona === 'owner' ? 'ana@example.com' : 'ben@example.com';
  const user = store.users.find((u) => u.email === email)!;
  const membership = store.memberships.find((m) => m.userId === user.id || m.email === email)!;
  return { user, membership };
}

function isClientAllowed(clientId: ID): boolean {
  const { membership } = getCurrentUser();
  if (membership.role === 'owner') return true;
  return membership.clientIds.includes(clientId);
}

function logActivity(
  action: ActivityEvent['action'],
  entity: ActivityEvent['entity'],
  entityId: ID,
  summary: string,
  clientId?: ID,
  reason?: string
) {
  const { user } = getCurrentUser();
  const event: ActivityEvent = {
    id: generateId(),
    orgId: store.org.id,
    at: `${todayInManila()}T${new Date().toTimeString().slice(0, 8)}+08:00`,
    actorId: user.id,
    entity,
    entityId,
    clientId,
    action,
    summary,
    reason,
  };
  store.activity.unshift(event);
  saveStore();
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
  const items = store.visitItems.filter((vi) => vi.visitId === visit.id);
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

export const mockRepositories: Repositories = {
  session: {
    async me() {
      await simulateLatency();
      const { user, membership } = getCurrentUser();
      const prefs = store.prefs[user.id] || {
        userId: user.id,
        theme: 'system',
        density: 'comfortable',
        textScale: 1,
        reduceMotion: null,
        dateOrder: 'mdy',
        privacyModeOnStart: false,
        todayScope: membership.role === 'owner' ? 'everyone' : 'mine',
        pushTypes: [],
        tableColumns: {},
      };
      return { user, membership, org: store.org, settings: store.settings, prefs };
    },
    async signOut() {
      await simulateLatency();
    },
  },

  prefs: {
    async save(p: Partial<UserPrefs>) {
      await simulateLatency();
      const { user } = getCurrentUser();
      store.prefs[user.id] = { ...store.prefs[user.id], ...p };
      saveStore();
      return store.prefs[user.id];
    },
  },

  settings: {
    async save(s: Partial<OrgSettings>) {
      await simulateLatency();
      store.settings = { ...store.settings, ...s, updatedAt: todayInManila() + 'T00:00:00+08:00', version: store.settings.version + 1 };
      saveStore();
      return store.settings;
    },
  },

  memberships: {
    async list() {
      await simulateLatency();
      return store.memberships.filter((m) => !m.deletedAt);
    },
    async invite(m) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const newM: Membership = {
        id: generateId(),
        orgId: store.org.id,
        email: m.email,
        role: m.role,
        clientIds: m.clientIds,
        active: true,
        invitedAt: todayInManila() + 'T00:00:00+08:00',
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.memberships.push(newM);
      saveStore();
      return newM;
    },
    async update(id, m) {
      await simulateLatency();
      const index = store.memberships.findIndex((item) => item.id === id);
      if (index === -1) throw new Error('Membership not found');
      store.memberships[index] = { ...store.memberships[index], ...m, version: store.memberships[index].version + 1 };
      saveStore();
      return store.memberships[index];
    },
    async revoke(id) {
      await simulateLatency();
      const m = store.memberships.find((item) => item.id === id);
      if (m) {
        m.active = false;
        m.revokedAt = todayInManila() + 'T00:00:00+08:00';
        saveStore();
      }
    },
  },

  today: {
    async queue(scope = 'everyone') {
      await simulateLatency();
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
          reviewLines.push({ line: l, task: t, client });
        }
      }

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

      // Visits today
      const visitsToday = store.visits
        .filter((v) => v.plannedDate === today && v.status !== 'cancelled')
        .map(buildVisitSummary);

      // KPI stats
      const firstPassRate = calculateFirstPassRate(store.visitItems);
      const blockedCount = summaries.filter((s) => s.statusGroup === 'blocked').length;

      return {
        focusDate: today,
        overdueTasks: overdue,
        dueTodayTasks: dueToday,
        dueSoonTasks: dueSoon,
        reviewRequiredLines: reviewLines,
        followUpsDue: followUps,
        visitsToday,
        kpiStats: {
          firstPassRate,
          blockedCount,
          openTasksCount: allowedTasks.length,
        },
      };
    },
  },

  clients: {
    async list(f) {
      await simulateLatency();
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
      await simulateLatency();
      const client = store.clients.find((c) => c.id === id);
      if (!client || !isClientAllowed(id)) throw new Error('Client not found or unauthorized');
      return { client, summary: buildClientSummary(client) };
    },

    async upsert(c) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      if (c.id) {
        const index = store.clients.findIndex((item) => item.id === c.id);
        if (index === -1) throw new Error('Client not found');
        store.clients[index] = {
          ...store.clients[index],
          ...c,
          updatedAt: now,
          updatedBy: user.id,
          version: store.clients[index].version + 1,
        };
        saveStore();
        logActivity('updated', 'client', c.id, `Updated client ${store.clients[index].displayName}`, c.id);
        return store.clients[index];
      } else {
        const newClient: Client = {
          id: generateId(),
          orgId: store.org.id,
          code: c.code || 'NEW',
          displayName: c.displayName || 'New Client',
          registeredName: c.registeredName,
          entityType: c.entityType || 'solo',
          hasTin: c.hasTin ?? true,
          tinMasked: c.tinMasked || (c.tinFull ? `•••-•••-${c.tinFull.slice(-3)}-00000` : '•••-•••-000-00000'),
          tinFull: c.tinFull,
          rdoCode: c.rdoCode || '039',
          vatStatus: c.vatStatus || 'unknown',
          sizeClass: c.sizeClass || 'micro',
          orusEnrolled: c.orusEnrolled ?? false,
          accessHolder: c.accessHolder || 'unknown',
          usesInvoicingSoftware: c.usesInvoicingSoftware ?? false,
          fiscalYearEndMonth: c.fiscalYearEndMonth || 12,
          preferredLanguage: c.preferredLanguage || 'en',
          assignedUserIds: c.assignedUserIds || [user.id],
          tags: c.tags || [],
          status: 'active',
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        };
        store.clients.push(newClient);
        saveStore();
        logActivity('created', 'client', newClient.id, `Created client ${newClient.displayName}`, newClient.id);
        return newClient;
      }
    },

    async archive(id, reason) {
      await simulateLatency();
      const client = store.clients.find((c) => c.id === id);
      if (client) {
        client.status = 'archived';
        client.archivedReason = reason;
        saveStore();
        logActivity('archived', 'client', id, `Archived client: ${reason}`, id, reason);
      }
    },

    async restore(id, reason) {
      await simulateLatency();
      const client = store.clients.find((c) => c.id === id);
      if (client) {
        client.status = 'active';
        saveStore();
        logActivity('restored', 'client', id, `Restored client: ${reason}`, id, reason);
      }
    },

    async revealTin(id) {
      await simulateLatency();
      const client = store.clients.find((c) => c.id === id);
      if (!client) throw new Error('Client not found');
      logActivity('tin_revealed', 'client', id, `Revealed TIN for ${client.displayName}`, id);
      return client.tinFull || '000-000-000-00000';
    },

    async findDuplicates(c) {
      await simulateLatency();
      const matches = store.clients.filter(
        (item) =>
          (c.code && item.code.toLowerCase() === c.code.toLowerCase()) ||
          (c.name && item.displayName.toLowerCase() === c.name.toLowerCase()) ||
          (c.tin && item.tinFull === c.tin)
      );
      return matches.map(buildClientSummary);
    },

    async importPreview(rows, mapping) {
      await simulateLatency();
      const valid: Partial<Client>[] = [];
      const errors: ImportPreview['errors'] = [];
      const batchId = generateId();

      rows.forEach((r, idx) => {
        const code = r[mapping.code as string] || `IMP${idx + 1}`;
        const displayName = r[mapping.displayName as string];
        if (!displayName) {
          errors.push({ row: idx + 1, field: 'displayName', message: 'Name is required' });
        } else {
          valid.push({
            code,
            displayName,
            entityType: 'solo',
            vatStatus: 'unknown',
            sizeClass: 'micro',
            rdoCode: '039',
            hasTin: true,
            status: 'active',
          });
        }
      });

      return { batchId, totalRows: rows.length, validRows: valid, errors };
    },

    async importCommit(preview) {
      await simulateLatency();
      const createdIds: ID[] = [];
      for (const row of preview.validRows) {
        const client = await mockRepositories.clients.upsert(row);
        createdIds.push(client.id);
      }
      return { created: createdIds, skipped: preview.errors.length, batchId: preview.batchId };
    },

    async importUndo(batchId) {
      await simulateLatency();
      logActivity('deleted', 'client', batchId, 'Undid client import batch');
    },
  },

  contacts: {
    async listByClient(clientId) {
      await simulateLatency();
      return store.contacts.filter((c) => c.clientId === clientId && !c.deletedAt);
    },
    async upsert(c) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      if (c.id) {
        const idx = store.contacts.findIndex((item) => item.id === c.id);
        if (idx === -1) throw new Error('Contact not found');
        store.contacts[idx] = { ...store.contacts[idx], ...c, updatedAt: now, version: store.contacts[idx].version + 1 };
        saveStore();
        return store.contacts[idx];
      } else {
        const newC: Contact = {
          id: generateId(),
          orgId: store.org.id,
          clientId: c.clientId!,
          name: c.name || 'New Contact',
          preferredChannel: c.preferredChannel || 'viber',
          language: c.language || 'en',
          isSignatory: c.isSignatory ?? false,
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        };
        store.contacts.push(newC);
        saveStore();
        return newC;
      }
    },
    async remove(id, reason) {
      await simulateLatency();
      const c = store.contacts.find((item) => item.id === id);
      if (c) {
        c.deletedAt = todayInManila() + 'T00:00:00+08:00';
        c.deletedReason = reason;
        saveStore();
      }
    },
  },

  authorizations: {
    async listByClient(clientId) {
      await simulateLatency();
      return store.authorizations.filter((a) => a.clientId === clientId && !a.deletedAt);
    },
    async upsert(a) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      if (a.id) {
        const idx = store.authorizations.findIndex((item) => item.id === a.id);
        if (idx === -1) throw new Error('Authorization not found');
        store.authorizations[idx] = { ...store.authorizations[idx], ...a, updatedAt: now, version: store.authorizations[idx].version + 1 };
        saveStore();
        return store.authorizations[idx];
      } else {
        const newA: Authorization = {
          id: generateId(),
          orgId: store.org.id,
          clientId: a.clientId!,
          type: a.type || 'spa',
          scope: a.scope || ['filing', 'payment'],
          granteeUserId: a.granteeUserId || user.id,
          issuedOn: a.issuedOn || todayInManila(),
          validUntil: a.validUntil,
          notarized: a.notarized ?? true,
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        };
        store.authorizations.push(newA);
        saveStore();
        return newA;
      }
    },
    async replace(oldId, next) {
      await simulateLatency();
      const created = await mockRepositories.authorizations.upsert(next);
      const old = store.authorizations.find((a) => a.id === oldId);
      if (old) {
        old.replacedById = created.id;
        saveStore();
      }
      return created;
    },
  },

  templates: {
    async list(f) {
      await simulateLatency();
      if (f?.active !== undefined) return store.templates.filter((t) => t.active === f.active);
      return store.templates;
    },
    async get(id) {
      await simulateLatency();
      const template = store.templates.find((t) => t.id === id);
      if (!template) throw new Error('Template not found');
      const lines = store.reqTemplates.filter((l) => l.taskTemplateId === id);
      return { template, lines };
    },
    async save(t, lines) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      let template: TaskTemplate;
      if (t.id) {
        const idx = store.templates.findIndex((item) => item.id === t.id);
        store.templates[idx] = { ...store.templates[idx], ...t, updatedAt: now, version: store.templates[idx].version + 1 };
        template = store.templates[idx];
      } else {
        template = {
          id: generateId(),
          orgId: store.org.id,
          code: t.code || 'CUSTOM',
          name: t.name || 'New Template',
          kind: t.kind || 'filing',
          frequency: t.frequency || 'monthly',
          appliesTo: t.appliesTo || {},
          officeAction: t.officeAction ?? false,
          paymentExpected: t.paymentExpected ?? false,
          verified: false,
          active: true,
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        };
        store.templates.push(template);
      }
      saveStore();
      return template;
    },
    async markVerified(id, v) {
      await simulateLatency();
      const t = store.templates.find((item) => item.id === id);
      if (!t) throw new Error('Template not found');
      t.verified = true;
      t.verifiedOn = v.verifiedOn;
      t.sourceRef = v.sourceRef;
      saveStore();
      return t;
    },
  },

  deadlineMoves: {
    async list() {
      await simulateLatency();
      return store.deadlineMoves;
    },
    async save(m, applyToOpenTasks) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      const move: DeadlineMove = {
        id: m.id || generateId(),
        orgId: store.org.id,
        templateId: m.templateId,
        period: m.period || '2026-09',
        newDueDate: m.newDueDate || todayInManila(),
        sourceRef: m.sourceRef || 'BIR Advisory',
        createdAt: now,
        createdBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
        version: 1,
      };
      store.deadlineMoves.push(move);

      const updatedIds: ID[] = [];
      if (applyToOpenTasks) {
        store.tasks.forEach((t) => {
          if ((!move.templateId || t.templateId === move.templateId) && t.period === move.period) {
            t.dueDate = move.newDueDate;
            t.dueSource = { kind: 'deadline_move', ref: move.sourceRef };
            updatedIds.push(t.id);
          }
        });
      }
      saveStore();
      return { move, updatedTaskIds: updatedIds };
    },
    async remove(id) {
      await simulateLatency();
      store.deadlineMoves = store.deadlineMoves.filter((m) => m.id !== id);
      saveStore();
    },
  },

  holidays: {
    async list(year) {
      await simulateLatency();
      return store.holidays.filter((h) => h.date.startsWith(`${year}`));
    },
    async save(h) {
      await simulateLatency();
      const newH: Holiday = {
        id: h.id || generateId(),
        orgId: store.org.id,
        date: h.date || todayInManila(),
        name: h.name || 'Holiday',
        type: h.type || 'regular',
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: 'user',
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: 'user',
        version: 1,
      };
      store.holidays.push(newH);
      saveStore();
      return newH;
    },
    async remove(id) {
      await simulateLatency();
      store.holidays = store.holidays.filter((h) => h.id !== id);
      saveStore();
    },
  },

  tasks: {
    async list(f) {
      await simulateLatency();
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
      await simulateLatency();
      const task = store.tasks.find((t) => t.id === id);
      if (!task || !isClientAllowed(task.clientId)) throw new Error('Task not found');
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

    async create(t, lines) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      const newTask: Task = {
        id: generateId(),
        orgId: store.org.id,
        clientId: t.clientId!,
        templateId: t.templateId,
        title: t.title,
        kind: t.kind || 'filing',
        period: t.period,
        transactionDate: t.transactionDate,
        dueDate: t.dueDate || todayInManila(),
        dueSource: t.dueSource || { kind: 'manual' },
        ownerUserId: t.ownerUserId || user.id,
        officeAction: t.officeAction ?? false,
        paymentExpected: t.paymentExpected ?? false,
        status: 'in_preparation',
        tags: t.tags || [],
        createdAt: now,
        createdBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
        version: 1,
      };
      store.tasks.push(newTask);

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        store.taskLines.push({
          id: generateId(),
          orgId: store.org.id,
          taskId: newTask.id,
          clientId: newTask.clientId,
          label: l.label || 'Requirement',
          required: l.required ?? true,
          copyForm: l.copyForm || 'digital',
          copies: l.copies,
          suppliedBy: l.suppliedBy || 'client',
          printAndBring: l.printAndBring ?? false,
          status: 'not_requested',
          sortOrder: i + 1,
          lateDiscovered: false,
          documentIds: [],
          createdAt: now,
          createdBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
          version: 1,
        });
      }

      saveStore();
      logActivity('created', 'task', newTask.id, `Created task ${newTask.title || 'Task'}`, newTask.clientId);
      return newTask;
    },

    async update(id, t) {
      await simulateLatency();
      const idx = store.tasks.findIndex((item) => item.id === id);
      if (idx === -1) throw new Error('Task not found');
      store.tasks[idx] = { ...store.tasks[idx], ...t, version: store.tasks[idx].version + 1 };
      saveStore();
      return store.tasks[idx];
    },

    async setStatus(id, to, reason) {
      await simulateLatency();
      const { user, membership } = getCurrentUser();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      const lines = store.taskLines.filter((l) => l.taskId === id);

      if (!canSetStatus(task, lines, to, membership.role)) {
        throw new Error(`Cannot transition task to ${to}`);
      }

      task.status = to;
      task.version += 1;
      saveStore();
      logActivity('status_changed', 'task', id, `Changed status to ${to}`, task.clientId, reason);
      return task;
    },

    async markSubmitted(id, s) {
      await simulateLatency();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      task.status = 'submitted';
      task.submittedAt = s.on + 'T00:00:00+08:00';
      task.submittedVia = s.via;
      task.submissionRef = s.ref;
      task.version += 1;
      saveStore();
      logActivity('status_changed', 'task', id, `Submitted via ${s.via}`, task.clientId);
      return task;
    },

    async markCompleted(id, c) {
      await simulateLatency();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      task.status = 'completed';
      task.completedAt = c.on + 'T00:00:00+08:00';
      task.completionNoEvidenceReason = c.noEvidenceReason;
      task.version += 1;
      saveStore();
      logActivity('status_changed', 'task', id, 'Completed task', task.clientId);
      return task;
    },

    async override(id, status, reason) {
      await simulateLatency();
      const { user, membership } = getCurrentUser();
      if (membership.role !== 'owner') throw new Error('Only owners can override task status');
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      task.statusOverride = {
        status,
        reason,
        by: user.id,
        at: todayInManila() + 'T00:00:00+08:00',
      };
      task.version += 1;
      saveStore();
      logActivity('overridden', 'task', id, `Status overridden to ${status}: ${reason}`, task.clientId, reason);
      return task;
    },

    async clearOverride(id, reason) {
      await simulateLatency();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      delete task.statusOverride;
      task.version += 1;
      saveStore();
      logActivity('overridden', 'task', id, `Cleared status override: ${reason}`, task.clientId, reason);
      return task;
    },

    async changeDue(id, dueDate, ref, reason) {
      await simulateLatency();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      task.dueDate = dueDate;
      task.dueSource = { kind: 'override', ref };
      task.version += 1;
      saveStore();
      logActivity('due_changed', 'task', id, `Due changed to ${dueDate}: ${reason}`, task.clientId, reason);
      return task;
    },

    async setNextAction(id, next) {
      await simulateLatency();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      task.nextAction = next || undefined;
      task.version += 1;
      saveStore();
      return task;
    },

    async archive(id, reason) {
      await simulateLatency();
      const task = store.tasks.find((item) => item.id === id);
      if (task) {
        task.status = 'archived';
        task.archivedReason = reason;
        saveStore();
        logActivity('archived', 'task', id, `Archived task: ${reason}`, task.clientId, reason);
      }
    },

    async restore(id, reason) {
      await simulateLatency();
      const task = store.tasks.find((item) => item.id === id);
      if (task) {
        task.status = 'in_preparation';
        saveStore();
        logActivity('restored', 'task', id, `Restored task: ${reason}`, task.clientId, reason);
      }
    },

    async duplicateForNextPeriod(id) {
      await simulateLatency();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      const lines = store.taskLines.filter((l) => l.taskId === id);
      return mockRepositories.tasks.create(
        {
          clientId: task.clientId,
          templateId: task.templateId,
          title: task.title,
          kind: task.kind,
          officeAction: task.officeAction,
          paymentExpected: task.paymentExpected,
        },
        lines
      );
    },

    async previewOpenPeriod(period, clientIds) {
      await simulateLatency();
      const applicable: OpenPeriodPreview['applicableTasks'] = [];
      const clients = store.clients.filter((c) => clientIds.includes(c.id));

      for (const client of clients) {
        for (const tmpl of store.templates) {
          applicable.push({
            clientId: client.id,
            clientName: client.displayName,
            templateId: tmpl.id,
            templateName: tmpl.name,
            kind: tmpl.kind,
            calculatedDue: todayInManila(),
            linesCount: 2,
          });
        }
      }

      return { period, clientCount: clients.length, applicableTasks: applicable };
    },

    async openPeriod(plan) {
      await simulateLatency();
      const createdIds: ID[] = [];
      for (const item of plan.selections) {
        const tmpl = store.templates.find((t) => t.id === item.templateId);
        const reqs = store.reqTemplates.filter((r) => r.taskTemplateId === item.templateId);
        const task = await mockRepositories.tasks.create(
          {
            clientId: item.clientId,
            templateId: item.templateId,
            title: `${tmpl?.name || 'Task'} — ${plan.period}`,
            period: plan.period,
            dueDate: item.dueDate,
            kind: tmpl?.kind || 'filing',
          },
          reqs
        );
        createdIds.push(task.id);
      }
      return { created: createdIds, skipped: 0, lines: createdIds.length * 2 };
    },

    async board(f) {
      await simulateLatency();
      const page = await mockRepositories.tasks.list(f);
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
  },

  lines: {
    async setStatus(id, to, extra) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const line = store.taskLines.find((l) => l.id === id);
      if (!line) throw new Error('Line not found');

      if (!canTransitionLine(line.status, to)) {
        throw new Error(`Cannot transition line from ${line.status} to ${to}`);
      }

      line.status = to;
      const now = todayInManila() + 'T00:00:00+08:00';

      if (to === 'accepted') {
        line.reviewedBy = user.id;
        line.reviewedAt = now;
        line.reviewNote = extra?.note;
      } else if (to === 'requested') {
        if (!line.requestedAt) line.requestedAt = now;
      } else if (to === 'received') {
        line.receivedAt = now;
      } else if (to === 'incomplete' || to === 'needs_correction') {
        line.flagNote = extra?.note;
      } else if (to === 'not_applicable') {
        line.naReason = extra?.reason;
      }

      line.version += 1;
      saveStore();
      logActivity('status_changed', 'line', id, `${user.displayName} updated line "${line.label}" to ${to}`, line.clientId);
      return line;
    },

    async addAdHoc(taskId, line) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const task = store.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error('Task not found');
      const newLine: TaskLine = {
        id: generateId(),
        orgId: store.org.id,
        taskId,
        clientId: task.clientId,
        label: line.label || 'Ad-hoc requirement',
        required: line.required ?? true,
        copyForm: line.copyForm || 'digital',
        copies: line.copies,
        suppliedBy: line.suppliedBy || 'client',
        printAndBring: line.printAndBring ?? false,
        status: 'not_requested',
        sortOrder: store.taskLines.filter((l) => l.taskId === taskId).length + 1,
        lateDiscovered: true,
        documentIds: [],
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.taskLines.push(newLine);
      saveStore();
      return newLine;
    },

    async update(id, line) {
      await simulateLatency();
      const idx = store.taskLines.findIndex((l) => l.id === id);
      if (idx === -1) throw new Error('Line not found');
      store.taskLines[idx] = { ...store.taskLines[idx], ...line, version: store.taskLines[idx].version + 1 };
      saveStore();
      return store.taskLines[idx];
    },

    async reorder(taskId, orderedIds) {
      await simulateLatency();
      orderedIds.forEach((id, index) => {
        const line = store.taskLines.find((l) => l.id === id && l.taskId === taskId);
        if (line) line.sortOrder = index + 1;
      });
      saveStore();
    },

    async history(id) {
      await simulateLatency();
      return store.activity.filter((a) => a.entity === 'line' && a.entityId === id);
    },
  },

  documents: {
    async list(f) {
      await simulateLatency();
      let list = store.documents.filter((d) => !d.deletedAt && isClientAllowed(d.clientId));
      if (f?.clientId) list = list.filter((d) => d.clientId === f.clientId);
      if (f?.taskId) list = list.filter((d) => d.taskId === f.taskId);
      return { items: list, total: list.length };
    },

    async upload(meta, file, thumb, info) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      const doc: DocumentFile = {
        id: generateId(),
        orgId: store.org.id,
        clientId: meta.clientId,
        taskId: meta.taskId,
        lineId: meta.lineId,
        visitItemId: meta.visitItemId,
        paymentId: meta.paymentId,
        authorizationId: meta.authorizationId,
        kind: meta.kind,
        displayName: info?.originalName || 'Uploaded File',
        originalName: info?.originalName || 'file.pdf',
        mimeType: file.type || 'application/pdf',
        sizeBytes: file.size,
        originalSizeBytes: info?.originalSizeBytes || file.size,
        compressed: file.size < (info?.originalSizeBytes || file.size),
        pageCount: info?.pageCount,
        sha256: info?.sha256 || 'fake-hash-' + Date.now(),
        storageKey: URL.createObjectURL(file),
        versionNo: 1,
        source: meta.source,
        createdAt: now,
        createdBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
        version: 1,
      };
      store.documents.push(doc);

      if (meta.lineId) {
        const line = store.taskLines.find((l) => l.id === meta.lineId);
        if (line) {
          line.documentIds.push(doc.id);
          line.status = 'received';
          line.receivedAt = now;
        }
      }

      saveStore();
      logActivity('file_uploaded', 'document', doc.id, `Uploaded ${doc.displayName}`, doc.clientId);
      return doc;
    },

    async replace(id, file, thumb, info) {
      await simulateLatency();
      const doc = store.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');
      doc.versionNo += 1;
      doc.storageKey = URL.createObjectURL(file);
      saveStore();
      return doc;
    },

    async update(id, d) {
      await simulateLatency();
      const doc = store.documents.find((item) => item.id === id);
      if (!doc) throw new Error('Document not found');
      Object.assign(doc, d);
      saveStore();
      return doc;
    },

    async remove(id, reason) {
      await simulateLatency();
      const doc = store.documents.find((d) => d.id === id);
      if (doc) {
        doc.deletedAt = todayInManila() + 'T00:00:00+08:00';
        doc.deletedReason = reason;
        saveStore();
      }
    },

    async getUrl(id, purpose) {
      await simulateLatency();
      const doc = store.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');
      logActivity(purpose === 'download' ? 'file_downloaded' : 'file_viewed', 'document', id, `${purpose} document ${doc.displayName}`, doc.clientId);
      return doc.storageKey;
    },

    async findBySha(sha256, clientId) {
      await simulateLatency();
      return store.documents.filter((d) => d.sha256 === sha256 && d.clientId === clientId);
    },
  },

  followUps: {
    async list(f) {
      await simulateLatency();
      let list = store.followUps.filter((fu) => !fu.deletedAt && isClientAllowed(fu.clientId));
      const today = todayInManila();
      const views: FollowUpView[] = list.map((fu) => {
        const client = store.clients.find((c) => c.id === fu.clientId)!;
        const task = store.tasks.find((t) => t.id === fu.taskId);
        const lines = store.taskLines.filter((l) => fu.lineIds.includes(l.id));
        const contact = store.contacts.find((c) => c.id === fu.contactId);
        const state = followUpState(fu, today);
        const attempts = store.followUpAttempts.filter((a) => a.followUpId === fu.id);
        return { followUp: fu, client, task, lines, contact, state, attempts };
      });
      return { items: views, total: views.length };
    },

    async get(id) {
      await simulateLatency();
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new Error('Follow up not found');
      const client = store.clients.find((c) => c.id === fu.clientId)!;
      const task = store.tasks.find((t) => t.id === fu.taskId);
      const lines = store.taskLines.filter((l) => fu.lineIds.includes(l.id));
      const contact = store.contacts.find((c) => c.id === fu.contactId);
      const state = followUpState(fu, todayInManila());
      const attempts = store.followUpAttempts.filter((a) => a.followUpId === fu.id);
      return { followUp: fu, client, task, lines, contact, state, attempts };
    },

    async create(f) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const newFu: FollowUp = {
        id: generateId(),
        orgId: store.org.id,
        clientId: f.clientId!,
        taskId: f.taskId,
        lineIds: f.lineIds || [],
        contactId: f.contactId,
        channel: f.channel || 'viber',
        language: f.language || 'en',
        expectedBy: f.expectedBy,
        attemptCount: 0,
        status: 'open',
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.followUps.push(newFu);
      saveStore();
      return newFu;
    },

    async markSent(id, a) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new Error('Follow up not found');
      fu.status = 'sent';
      fu.expectedBy = a.expectedBy;
      fu.attemptCount += 1;

      store.followUpAttempts.push({
        id: generateId(),
        orgId: store.org.id,
        followUpId: fu.id,
        attemptNo: fu.attemptCount,
        channel: a.channel,
        sentAt: a.sentAt,
        sentBy: user.id,
        messageSnapshot: a.message,
        expectedBy: a.expectedBy,
        createdAt: a.sentAt,
        createdBy: user.id,
        updatedAt: a.sentAt,
        updatedBy: user.id,
        version: 1,
      });

      // Update lines to requested status
      for (const lineId of fu.lineIds) {
        const line = store.taskLines.find((l) => l.id === lineId);
        if (line && line.status === 'not_requested') {
          line.status = 'requested';
          line.requestedAt = a.sentAt;
        }
      }

      saveStore();
      logActivity('follow_up_sent', 'follow_up', id, `Sent follow-up via ${a.channel}`, fu.clientId);
      return mockRepositories.followUps.get(id);
    },

    async logResponse(id, r) {
      await simulateLatency();
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new Error('Follow up not found');
      fu.status = 'answered';
      fu.response = r.text;
      fu.respondedAt = todayInManila() + 'T00:00:00+08:00';
      saveStore();
      logActivity('response_logged', 'follow_up', id, `Response logged: ${r.text.slice(0, 30)}`, fu.clientId);
      return mockRepositories.followUps.get(id);
    },

    async escalate(id, reason) {
      await simulateLatency();
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new Error('Follow up not found');
      fu.status = 'escalated';
      fu.escalatedReason = reason;
      saveStore();
      logActivity('escalated', 'follow_up', id, `Escalated: ${reason}`, fu.clientId, reason);
      return mockRepositories.followUps.get(id);
    },

    async resolve(id, reason) {
      await simulateLatency();
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new Error('Follow up not found');
      fu.status = 'resolved';
      fu.resolvedReason = reason;
      fu.resolvedAt = todayInManila() + 'T00:00:00+08:00';
      saveStore();
      return mockRepositories.followUps.get(id);
    },
  },

  messages: {
    async list() {
      await simulateLatency();
      return store.messageTemplates;
    },
    async save(m) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const tmpl: MessageTemplate = {
        id: m.id || generateId(),
        orgId: store.org.id,
        name: m.name || 'Template',
        language: m.language || 'en',
        purpose: m.purpose || 'reminder',
        body: m.body || '',
        active: m.active ?? true,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.messageTemplates.push(tmpl);
      saveStore();
      return tmpl;
    },
  },

  offices: {
    async list(f) {
      await simulateLatency();
      let list = store.offices;
      if (f?.type) list = list.filter((o) => o.type === f.type);
      if (f?.search) {
        const q = f.search.toLowerCase();
        list = list.filter((o) => o.name.toLowerCase().includes(q) || (o.rdoCode && o.rdoCode.includes(q)));
      }
      return list;
    },
    async get(id) {
      await simulateLatency();
      const office = store.offices.find((o) => o.id === id);
      if (!office) throw new Error('Office not found');
      const vItems = store.visitItems.filter((vi) => {
        const v = store.visits.find((visit) => visit.id === vi.visitId);
        return v && v.officeId === id;
      });
      const firstPass = calculateFirstPassRate(vItems);
      return {
        office,
        stats: {
          totalVisits: store.visits.filter((v) => v.officeId === id).length,
          firstPassRate: firstPass,
          topCauses: [],
        },
      };
    },
    async save(o) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const office: Office = {
        id: o.id || generateId(),
        orgId: store.org.id,
        type: o.type || 'rdo',
        name: o.name || 'Office',
        rdoCode: o.rdoCode,
        address: o.address,
        isSample: false,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.offices.push(office);
      saveStore();
      return office;
    },
  },

  visits: {
    async list(f) {
      await simulateLatency();
      let list = store.visits.filter((v) => !v.deletedAt);
      if (f?.status) list = list.filter((v) => f.status!.includes(v.status));
      const summaries = list.map(buildVisitSummary);
      return { items: summaries, total: summaries.length };
    },

    async get(id) {
      await simulateLatency();
      const visit = store.visits.find((v) => v.id === id);
      if (!visit) throw new Error('Visit not found');
      const office = store.offices.find((o) => o.id === visit.officeId);
      const items = store.visitItems.filter((vi) => vi.visitId === id);

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

    async create(v, items) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const newV: Visit = {
        id: generateId(),
        orgId: store.org.id,
        officeId: v.officeId,
        officeType: v.officeType || 'rdo',
        officeName: v.officeName || 'Tax Office',
        rdoCode: v.rdoCode,
        plannedDate: v.plannedDate || todayInManila(),
        arriveBy: v.arriveBy,
        assigneeUserId: v.assigneeUserId || user.id,
        purpose: v.purpose,
        status: 'planned',
        packedLineIds: [],
        packedKitItemIds: [],
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.visits.push(newV);

      if (items) {
        for (const item of items) {
          const task = store.tasks.find((t) => t.id === item.taskId);
          if (task) {
            store.visitItems.push({
              id: generateId(),
              orgId: store.org.id,
              visitId: newV.id,
              taskId: task.id,
              clientId: task.clientId,
              intendedAction: item.action,
              isFirstVisitForTask: true,
              evidenceDocumentIds: [],
              createdAt: todayInManila() + 'T00:00:00+08:00',
              createdBy: user.id,
              updatedAt: todayInManila() + 'T00:00:00+08:00',
              updatedBy: user.id,
              version: 1,
            });
          }
        }
      }

      saveStore();
      logActivity('created', 'visit', newV.id, `Planned visit to ${newV.officeName}`);
      return newV;
    },

    async update(id, v) {
      await simulateLatency();
      const visit = store.visits.find((item) => item.id === id);
      if (!visit) throw new Error('Visit not found');
      Object.assign(visit, v);
      visit.version += 1;
      saveStore();
      return visit;
    },

    async suggestTasks(visitId) {
      await simulateLatency();
      const readyTasks = store.tasks.filter((t) => {
        if (!isClientAllowed(t.clientId)) return false;
        if (t.status === 'completed' || t.status === 'archived') return false;
        const lines = store.taskLines.filter((l) => l.taskId === t.id);
        return derivedStatus(t, lines) === 'ready_next_step';
      });
      return readyTasks.map(buildTaskSummary);
    },

    async addItem(visitId, taskId, action) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const task = store.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error('Task not found');
      const vi: VisitItem = {
        id: generateId(),
        orgId: store.org.id,
        visitId,
        taskId,
        clientId: task.clientId,
        intendedAction: action,
        isFirstVisitForTask: true,
        evidenceDocumentIds: [],
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.visitItems.push(vi);
      saveStore();
      return vi;
    },

    async updateItem(itemId, i) {
      await simulateLatency();
      const item = store.visitItems.find((vi) => vi.id === itemId);
      if (!item) throw new Error('Visit item not found');
      Object.assign(item, i);
      saveStore();
      return item;
    },

    async removeItem(itemId) {
      await simulateLatency();
      store.visitItems = store.visitItems.filter((vi) => vi.id !== itemId);
      saveStore();
    },

    async setPacked(visitId, ref, packed) {
      await simulateLatency();
      const v = store.visits.find((item) => item.id === visitId);
      if (!v) throw new Error('Visit not found');
      if (ref.lineId) {
        if (packed) v.packedLineIds = Array.from(new Set([...v.packedLineIds, ref.lineId]));
        else v.packedLineIds = v.packedLineIds.filter((id) => id !== ref.lineId);
      }
      if (ref.kitItemId) {
        if (packed) v.packedKitItemIds = Array.from(new Set([...v.packedKitItemIds, ref.kitItemId]));
        else v.packedKitItemIds = v.packedKitItemIds.filter((id) => id !== ref.kitItemId);
      }
      saveStore();
    },

    async start(id, leaveAnywayReason) {
      await simulateLatency();
      const v = store.visits.find((item) => item.id === id);
      if (!v) throw new Error('Visit not found');
      v.status = 'in_progress';
      v.startedAt = todayInManila() + 'T' + new Date().toTimeString().slice(0, 8) + '+08:00';
      v.departureOverrideReason = leaveAnywayReason;
      saveStore();
      logActivity('visit_started', 'visit', id, `Started visit to ${v.officeName}`, undefined, leaveAnywayReason);
      return v;
    },

    async recordOutcome(itemId, o) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const item = store.visitItems.find((vi) => vi.id === itemId);
      if (!item) throw new Error('Visit item not found');
      const task = store.tasks.find((t) => t.id === item.taskId);
      if (!task) throw new Error('Task not found');

      item.outcome = o.outcome;
      item.outcomeCause = o.cause;
      item.avoidable = o.avoidable;
      item.outcomeNote = o.note;
      item.windowOrOfficer = o.windowOrOfficer;
      item.nextAction = o.nextAction;
      item.evidenceDocumentIds = o.evidenceDocumentIds;
      item.outcomeAt = todayInManila() + 'T' + new Date().toTimeString().slice(0, 8) + '+08:00';
      item.recordedBy = user.id;

      // Apply outcome mapping (16.6)
      if (o.outcome === 'completed') {
        if (o.evidenceDocumentIds.length > 0) {
          task.status = 'completed';
          task.completedAt = item.outcomeAt;
        } else {
          task.status = 'awaiting_follow_up';
          task.nextAction = { text: 'Attach evidence document', owner: 'operator', due: todayInManila() };
        }
      } else if (o.outcome === 'submitted_pending') {
        task.status = 'submitted';
        task.submittedAt = item.outcomeAt;
        if (o.nextAction) task.nextAction = o.nextAction;
      } else if (o.outcome === 'more_documents_requested' && o.requestedDocuments) {
        task.status = 'in_preparation';
        for (const docName of o.requestedDocuments) {
          store.taskLines.push({
            id: generateId(),
            orgId: store.org.id,
            taskId: task.id,
            clientId: task.clientId,
            label: docName,
            required: true,
            copyForm: 'photocopy',
            suppliedBy: 'client',
            printAndBring: true,
            status: 'not_requested',
            sortOrder: store.taskLines.filter((l) => l.taskId === task.id).length + 1,
            lateDiscovered: true,
            documentIds: [],
            createdAt: todayInManila() + 'T00:00:00+08:00',
            createdBy: user.id,
            updatedAt: todayInManila() + 'T00:00:00+08:00',
            updatedBy: user.id,
            version: 1,
          });
        }
      }

      saveStore();
      logActivity('outcome_recorded', 'visit_item', itemId, `Recorded outcome: ${o.outcome}`, task.clientId);
      return item;
    },

    async finish(id, f) {
      await simulateLatency();
      const v = store.visits.find((item) => item.id === id);
      if (!v) throw new Error('Visit not found');
      v.status = 'done';
      v.finishedAt = f.finishedAt;
      v.costs = f.costs;
      saveStore();
      logActivity('visit_finished', 'visit', id, `Finished visit to ${v.officeName}`);
      return v;
    },

    async cancel(id, reason) {
      await simulateLatency();
      const v = store.visits.find((item) => item.id === id);
      if (v) {
        v.status = 'cancelled';
        v.cancelledReason = reason;
        saveStore();
        logActivity('visit_cancelled', 'visit', id, `Cancelled visit: ${reason}`, undefined, reason);
      }
    },
  },

  visitKit: {
    async list() {
      await simulateLatency();
      return store.visitKit;
    },
    async save(i) {
      await simulateLatency();
      const item: VisitKitItem = {
        id: i.id || generateId(),
        orgId: store.org.id,
        label: i.label || 'Item',
        note: i.note,
        active: i.active ?? true,
        sortOrder: i.sortOrder || 1,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: 'user',
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: 'user',
        version: 1,
      };
      store.visitKit.push(item);
      saveStore();
      return item;
    },
  },

  payments: {
    async list(f) {
      await simulateLatency();
      let list = store.payments.filter((p) => !p.deletedAt && isClientAllowed(p.clientId));
      if (f?.clientId) list = list.filter((p) => p.clientId === f.clientId);
      const total = list.reduce((acc, p) => acc + p.amount, 0);
      return { items: list, total: list.length, totalAmount: total };
    },

    async save(p) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const payment: Payment = {
        id: p.id || generateId(),
        orgId: store.org.id,
        clientId: p.clientId!,
        taskId: p.taskId!,
        amount: p.amount || 0,
        paidOn: p.paidOn || todayInManila(),
        channel: p.channel || 'aab_otc',
        provider: p.provider,
        referenceNo: p.referenceNo,
        paidBy: p.paidBy || 'operator',
        reimbursement: p.reimbursement,
        proofDocumentIds: p.proofDocumentIds || [],
        note: p.note,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.payments.push(payment);
      saveStore();
      return payment;
    },

    async remove(id, reason) {
      await simulateLatency();
      const p = store.payments.find((item) => item.id === id);
      if (p) {
        p.deletedAt = todayInManila() + 'T00:00:00+08:00';
        p.deletedReason = reason;
        saveStore();
      }
    },
  },

  notes: {
    async list(entity, entityId) {
      await simulateLatency();
      return store.notes.filter((n) => n.entity === entity && n.entityId === entityId && !n.deletedAt);
    },
    async save(n) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const note: Note = {
        id: n.id || generateId(),
        orgId: store.org.id,
        entity: n.entity || 'task',
        entityId: n.entityId!,
        body: n.body || '',
        pinned: n.pinned ?? false,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.notes.push(note);
      saveStore();
      return note;
    },
  },

  savedViews: {
    async list(page) {
      await simulateLatency();
      return store.savedViews.filter((v) => v.page === page);
    },
    async save(v) {
      await simulateLatency();
      const { user } = getCurrentUser();
      const sv: SavedView = {
        id: v.id || generateId(),
        orgId: store.org.id,
        userId: user.id,
        page: v.page || 'tasks',
        name: v.name || 'View',
        query: v.query || '',
        shared: v.shared ?? false,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      store.savedViews.push(sv);
      saveStore();
      return sv;
    },
    async remove(id) {
      await simulateLatency();
      store.savedViews = store.savedViews.filter((v) => v.id !== id);
      saveStore();
    },
  },

  notifications: {
    async list() {
      await simulateLatency();
      const { user } = getCurrentUser();
      const list = store.notifications.filter((n) => n.userId === user.id);
      return { items: list, total: list.length };
    },
    async markRead(ids) {
      await simulateLatency();
      const now = todayInManila() + 'T00:00:00+08:00';
      if (ids === 'all') {
        store.notifications.forEach((n) => {
          n.readAt = now;
        });
      } else {
        store.notifications.forEach((n) => {
          if (ids.includes(n.id)) n.readAt = now;
        });
      }
      saveStore();
    },
    async unreadCount() {
      await simulateLatency();
      const { user } = getCurrentUser();
      return store.notifications.filter((n) => n.userId === user.id && !n.readAt).length;
    },
  },

  push: {
    async subscribe() {},
    async unsubscribe() {},
    async test() {},
  },

  calendar: {
    async range(from, to, f) {
      await simulateLatency();
      const items: CalendarItem[] = [];

      // 1. Task due dates
      store.tasks
        .filter((t) => isClientAllowed(t.clientId) && t.dueDate >= from && t.dueDate <= to)
        .forEach((t) => {
          const client = store.clients.find((c) => c.id === t.clientId);
          items.push({
            id: t.id,
            type: 'task_due',
            title: `${client?.code || 'Task'}: ${t.title || 'Filing Due'}`,
            date: t.dueDate,
            clientId: t.clientId,
            clientCode: client?.code,
          });
        });

      // 2. Visits
      store.visits
        .filter((v) => v.plannedDate >= from && v.plannedDate <= to)
        .forEach((v) => {
          items.push({
            id: v.id,
            type: 'visit',
            title: `Visit: ${v.officeName}`,
            date: v.plannedDate,
          });
        });

      // 3. Holidays
      store.holidays
        .filter((h) => h.date >= from && h.date <= to)
        .forEach((h) => {
          items.push({
            id: h.id,
            type: 'holiday',
            title: `Holiday: ${h.name}`,
            date: h.date,
          });
        });

      return items;
    },
  },

  insights: {
    async get(tab: InsightsTab, f?: InsightsFilter) {
      await simulateLatency();
      const firstPass = calculateFirstPassRate(store.visitItems);
      const { avoidable, total: repeatTotal } = countTripsNeedingReturn(store.visitItems);
      const onTime = calculateOnTimeRate(store.tasks);
      const daysCollect = calculateDaysToCollect(store.tasks);

      const overviewData = {
        firstPassRate: firstPass,
        repeatTripRate: repeatTotal > 0 ? Math.round((avoidable / repeatTotal) * 100) : 0,
        onTimeFilingRate: onTime,
        averageDaysToCollect: daysCollect,
        baselineComparison: { firstPassBaseline: 55, repeatTripsBaseline: 4 },
        monthlyTrends: [
          { month: 'Jun', firstPassRate: 58, repeatTrips: 5, filings: 12 },
          { month: 'Jul', firstPassRate: 65, repeatTrips: 4, filings: 15 },
          { month: 'Aug', firstPassRate: 72, repeatTrips: 3, filings: 14 },
          { month: 'Sep', firstPassRate: 77, repeatTrips: 3, filings: 18 },
          { month: 'Oct', firstPassRate: firstPass || 86, repeatTrips: 1, filings: 16 },
        ],
      };

      const tripsData = {
        totalTrips: store.visits.length,
        completedTrips: store.visits.filter((v) => v.status === 'done').length,
        avoidableRejectionCount: avoidable,
        topRejectionCauses: [
          { cause: 'missing_document' as OutcomeCause, count: 2, avoidable: true },
          { cause: 'wrong_copy_form' as OutcomeCause, count: 1, avoidable: true },
          { cause: 'office_system_down' as OutcomeCause, count: 1, avoidable: false },
        ],
        officePerformance: [
          { officeName: 'BIR RDO 39', visits: 8, firstPassRate: 88 },
          { officeName: 'Land Bank QC Circle', visits: 4, firstPassRate: 100 },
        ],
      };

      const chasingData = {
        averageResponseDays: calculateClientResponseDays(store.taskLines) || 2.4,
        followUpSuccessRate: 91,
        chasesPerTask: 1.5,
        lateDiscoveredBlockersCount: countLateDiscoveredBlockers(store.taskLines),
        channelEffectiveness: [
          { channel: 'viber' as const, attempts: 24, responses: 22 },
          { channel: 'email' as const, attempts: 10, responses: 7 },
        ],
      };

      const deadlinesData = {
        filingsOnTime: 22,
        filingsLate: 1,
        heatCalendar: [
          { date: todayInManila(), taskCount: 3 },
          { date: todayInManila(), taskCount: 2 },
        ],
      };

      const workloadData = {
        operatorTasks: 18,
        helperTasks: 6,
        tasksByStatusGroup: {
          blocked: 3,
          in_progress: 8,
          ready: 4,
          submitted: 5,
          done: 22,
        },
      };

      const clientsData = {
        fastestClients: [{ client: store.clients[0], avgDays: 1.8 }],
        slowestClients: [{ client: store.clients[1], avgDays: 4.2, unreadReviewsCount: 1 }],
      };

      const map: InsightsData = {
        overview: overviewData,
        trips: tripsData,
        chasing: chasingData,
        deadlines: deadlinesData,
        workload: workloadData,
        clients: clientsData,
      };

      return map[tab] as any;
    },
  },

  baseline: {
    async get() {
      await simulateLatency();
      return store.baseline;
    },
    async save(b) {
      await simulateLatency();
      const { user } = getCurrentUser();
      store.baseline = {
        id: generateId(),
        orgId: store.org.id,
        periodStart: b.periodStart || '2026-01-01',
        periodEnd: b.periodEnd || '2026-06-30',
        tripsPerMonth: b.tripsPerMonth || 12,
        repeatTripsPerMonth: b.repeatTripsPerMonth || 4,
        hoursFindingPerWeek: b.hoursFindingPerWeek || 6,
        confidence: b.confidence || 3,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
      };
      saveStore();
      return store.baseline;
    },
  },

  pulses: {
    async list() {
      await simulateLatency();
      return store.pulses;
    },
    async save(p) {
      await simulateLatency();
      const pulse: Pulse = {
        id: generateId(),
        orgId: store.org.id,
        month: p.month || todayInManila().slice(0, 7),
        hoursFindingLastWeek: p.hoursFindingLastWeek,
        confidence: p.confidence || 4,
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: 'user',
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: 'user',
        version: 1,
      };
      store.pulses.push(pulse);
      saveStore();
      return pulse;
    },
  },

  reports: {
    async clientChecklist(clientId) {
      await simulateLatency();
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
      await simulateLatency();
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
      await simulateLatency();
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
      await simulateLatency();
      const csv = `Entity,ID,Timestamp\n${kind},${generateId()},${todayInManila()}`;
      return new Blob([csv], { type: 'text/csv' });
    },
    async fullBackup() {
      await simulateLatency();
      return new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    },
  },

  activity: {
    async list(f) {
      await simulateLatency();
      let list = store.activity;
      if (f?.entity) list = list.filter((a) => a.entity === f.entity);
      if (f?.clientId) list = list.filter((a) => a.clientId === f.clientId);
      return { items: list, total: list.length };
    },
  },

  search: {
    async query(q) {
      await simulateLatency();
      const query = q.toLowerCase();
      const clients = store.clients
        .filter((c) => isClientAllowed(c.id) && (c.displayName.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)))
        .map(buildClientSummary);
      const tasks = store.tasks
        .filter((t) => isClientAllowed(t.clientId) && (t.title?.toLowerCase().includes(query)))
        .map(buildTaskSummary);
      const offices = store.offices.filter((o) => o.name.toLowerCase().includes(query));

      return {
        clients,
        tasks,
        documents: [],
        offices,
      };
    },
  },
};

// Dev Controls
export const mockDevControls = {
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    store = loadStore();
    window.location.reload();
  },
  setPersona(role: 'owner' | 'helper') {
    currentPersona = role;
    localStorage.setItem(PERSONA_KEY, role);
    window.location.reload();
  },
  getPersona(): 'owner' | 'helper' {
    return currentPersona;
  },
  setOffline(offline: boolean) {
    isOffline = offline;
    localStorage.setItem(OFFLINE_KEY, String(offline));
  },
  getOffline(): boolean {
    return isOffline;
  },
  setFailureRate(rate: number) {
    failureRate = rate;
    localStorage.setItem(FAILURE_RATE_KEY, String(rate));
  },
  getFailureRate(): number {
    return failureRate;
  },
  setToday(date: ISODate | null) {
    setDevToday(date);
    window.location.reload();
  },
  getToday(): ISODate | null {
    return getDevToday();
  },
};
