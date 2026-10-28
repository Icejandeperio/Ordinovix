import type { Repositories } from '../repositories';
import { createQueries } from '../queries';
import { createCommands, HELPER_FIELDS, takeVersion, assertVersion } from '../commands';
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
  FollowUpAttempt,
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
  NextAction,
  Role,
  ImportPreview,
  OpenPeriodPreview,
  OpenPeriodPlan,
  DocumentKind,
} from '@/domain/types';
import { generateSeedData } from './seed';
import { buildDemoData } from './seed-demo';
import { NotFoundError, ForbiddenError, VersionConflictError } from '@/domain/errors';
import {
  validate,
  validateReason,
  ClientWriteSchema,
  ContactWriteSchema,
  AuthorizationWriteSchema,
  TemplateWriteSchema,
  MarkVerifiedSchema,
  DeadlineMoveWriteSchema,
  HolidayWriteSchema,
  SettingsWriteSchema,
  MembershipInviteSchema,
  TaskCreateSchema,
  TaskUpdateSchema,
  MarkSubmittedSchema,
  MarkCompletedSchema,
  ChangeDueSchema,
  NextActionSchema,
  LineStatusExtraSchema,
  LineWriteSchema,
  DocumentMetaSchema,
  DocumentUpdateSchema,
  FollowUpCreateSchema,
  MarkSentWriteSchema,
  LogResponseWriteSchema,
  MessageWriteSchema,
  OfficeWriteSchema,
  VisitWriteSchema,
  VisitUpdateSchema,
  VisitItemWriteSchema,
  VisitAddItemSchema,
  OutcomeWriteSchema,
  FinishVisitSchema,
  VisitKitWriteSchema,
  PaymentWriteSchema,
  NoteWriteSchema,
  BaselineWriteSchema,
  PulseWriteSchema,
} from '@/domain/schemas';
import { requireClientAccess, requireOwner, canReviewLines, canAccessClient, canCancelVisit, insightsScope, type PolicyActor } from '@/domain/policy';
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
  canTransitionLine,
  canSetStatus,
  canFinishVisit,
  canCompleteWithEvidence,
  RuleViolationError,
} from '@/domain/rules';
import { calculateFirstPassRate, computeInsights } from '@/domain/metrics';
import { todayInManila, setDevToday, getDevToday, addDaysToDate, nowInManila } from '@/lib/dates';
import { generateId } from '@/lib/ids';
import { describeDevice } from '@/lib/audit';
import { FILE_KEY_PREFIX, documentDisplayName, getFileUrl, isStoredFileKey, putFile } from '@/lib/files';
import { FAILURE_RATE_KEY, OFFLINE_KEY, PERSONA_KEY } from '@/data/dev-state';

const STORAGE_KEY = 'ox-mock-data-v2';

export interface StoreData {
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

const getStorageItem = (k: string): string | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  return null;
};

const setStorageItem = (k: string, v: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      // ignore in constrained environments
    }
  }
};

let currentPersona: 'owner' | 'helper' = (getStorageItem(PERSONA_KEY) as 'owner' | 'helper') || 'owner';
let failureRate: number = parseFloat(getStorageItem(FAILURE_RATE_KEY) || '0');
let isOffline: boolean = getStorageItem(OFFLINE_KEY) === 'true';
let store: StoreData = loadStore();

/** The read side lives in src/data/queries.ts, shared with the Worker; this binds it to the mock's store and persona. */
const query = () => {
  const { user, membership } = getCurrentUser();
  return createQueries({ store, user, membership });
};

function buildSampleDocuments(orgId: string, baseDate: string): DocumentFile[] {
  const svgReturn = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="#ffffff"/><text x="50" y="80" font-family="sans-serif" font-size="20" font-weight="bold" fill="#111827">BIR Form No. 1601-EQ</text><text x="50" y="110" font-family="sans-serif" font-size="12" fill="#4b5563">Quarterly Remittance Return of Creditable Income Taxes</text><rect x="50" y="130" width="500" height="2" fill="#5A3DB8"/><text x="50" y="170" font-family="sans-serif" font-size="13" fill="#111827">Taxpayer: Rivera Salonga &amp; Partners</text><text x="50" y="195" font-family="sans-serif" font-size="13" fill="#111827">TIN: 123-456-789-00000 · RDO 039</text><rect x="50" y="225" width="500" height="150" fill="#f8fafc" stroke="#e2e8f0"/><text x="70" y="260" font-family="monospace" font-size="13" fill="#334155">Tax Withheld Due: PHP 12,345.50</text><text x="70" y="290" font-family="monospace" font-size="13" fill="#334155">Filing Channel: eBIRForms v7.9</text><circle cx="450" cy="480" r="45" fill="none" stroke="#5A3DB8" stroke-width="3" stroke-dasharray="4"/><text x="450" y="485" font-family="sans-serif" font-size="11" font-weight="bold" fill="#5A3DB8" text-anchor="middle">FILED</text></svg>');

  const svgAck = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="#ffffff"/><text x="50" y="80" font-family="sans-serif" font-size="18" font-weight="bold" fill="#065f46">BUREAU OF INTERNAL REVENUE</text><text x="50" y="105" font-family="sans-serif" font-size="13" fill="#047857">Electronic Filing Confirmation Notification</text><rect x="50" y="125" width="500" height="2" fill="#10b981"/><text x="50" y="165" font-family="sans-serif" font-size="13" fill="#111827">Reference Number: eFPS-2026-98765432</text><text x="50" y="190" font-family="sans-serif" font-size="13" fill="#111827">Date Received: 2026-10-24 14:22:05 PHT</text><rect x="50" y="220" width="500" height="120" fill="#ecfdf5" stroke="#a7f3d0"/><text x="70" y="255" font-family="monospace" font-size="12" fill="#065f46">Status: Successfully Received &amp; Recorded</text></svg>');

  return [
    {
      id: 'doc-rsp-1',
      orgId,
      clientId: 'client-rsp',
      kind: 'filed_return',
      displayName: 'RSP_1601EQ_2026Q3_return_v1.pdf',
      originalName: '1601EQ_Signed_Final.pdf',
      mimeType: 'image/svg+xml',
      sizeBytes: 420 * 1024,
      originalSizeBytes: 1200 * 1024,
      compressed: true,
      sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      storageKey: `data:image/svg+xml;utf8,${svgReturn}`,
      versionNo: 1,
      source: 'upload',
      createdAt: `${baseDate}T10:15:00+08:00`,
      createdBy: 'user-ana',
      updatedAt: `${baseDate}T10:15:00+08:00`,
      updatedBy: 'user-ana',
      version: 1,
    },
    {
      id: 'doc-rsp-2',
      orgId,
      clientId: 'client-rsp',
      kind: 'acknowledgment',
      displayName: 'RSP_1601EQ_2026Q3_ack_v1.pdf',
      originalName: 'eFPS_Confirmation_RSP.pdf',
      mimeType: 'image/svg+xml',
      sizeBytes: 180 * 1024,
      originalSizeBytes: 450 * 1024,
      compressed: true,
      sha256: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01a',
      storageKey: `data:image/svg+xml;utf8,${svgAck}`,
      versionNo: 1,
      source: 'upload',
      createdAt: `${baseDate}T10:18:00+08:00`,
      createdBy: 'user-ana',
      updatedAt: `${baseDate}T10:18:00+08:00`,
      updatedBy: 'user-ana',
      version: 1,
    },
    {
      id: 'doc-vtl-1',
      orgId,
      clientId: 'client-vtl',
      kind: 'payment_proof',
      displayName: 'VTL_0619E_2026-09_payproof_v1.jpg',
      originalName: 'BPI_Deposit_Confirmation.jpg',
      mimeType: 'image/svg+xml',
      sizeBytes: 310 * 1024,
      originalSizeBytes: 980 * 1024,
      compressed: true,
      sha256: 'c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01a2b',
      storageKey: `data:image/svg+xml;utf8,${svgAck}`,
      versionNo: 1,
      source: 'upload',
      createdAt: `${baseDate}T11:00:00+08:00`,
      createdBy: 'user-ben',
      updatedAt: `${baseDate}T11:00:00+08:00`,
      updatedBy: 'user-ben',
      version: 1,
    },
    {
      id: 'doc-cruz-1',
      orgId,
      clientId: 'client-cruz',
      kind: 'stamped_copy',
      displayName: 'CRUZ_1701Q_2026Q3_stamped_v1.jpg',
      originalName: 'RDO_Stamped_Receiving_Copy.jpg',
      mimeType: 'image/svg+xml',
      sizeBytes: 540 * 1024,
      originalSizeBytes: 1800 * 1024,
      compressed: true,
      sha256: 'd4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01a2b3c',
      storageKey: `data:image/svg+xml;utf8,${svgReturn}`,
      versionNo: 1,
      source: 'upload',
      createdAt: `${baseDate}T12:30:00+08:00`,
      createdBy: 'user-ben',
      updatedAt: `${baseDate}T12:30:00+08:00`,
      updatedBy: 'user-ben',
      version: 1,
    },
    {
      id: 'doc-rsp-3',
      orgId,
      clientId: 'client-rsp',
      kind: 'authorization',
      displayName: 'RSP_SPA_2026_auth_v1.pdf',
      originalName: 'Notarized_Special_Power_of_Attorney.pdf',
      mimeType: 'image/svg+xml',
      sizeBytes: 620 * 1024,
      originalSizeBytes: 1500 * 1024,
      compressed: true,
      sha256: 'e5f67890123456789abcdef0123456789abcdef0123456789abcdef01a2b3c4d',
      storageKey: `data:image/svg+xml;utf8,${svgReturn}`,
      versionNo: 1,
      source: 'upload',
      createdAt: `${baseDate}T09:30:00+08:00`,
      createdBy: 'user-ana',
      updatedAt: `${baseDate}T09:30:00+08:00`,
      updatedBy: 'user-ana',
      version: 1,
    },
  ];
}

function buildStandardMessageTemplates(orgId: string): MessageTemplate[] {
  const now = todayInManila() + 'T00:00:00+08:00';
  return [
    {
      id: 'tmpl-msg-fil-reminder',
      orgId,
      name: 'Paalala (Filipino)',
      language: 'fil',
      purpose: 'reminder',
      body: 'Magandang araw po, {{contact}}. Follow-up lang po sa:\n\n{{items}}\n\npara sa {{task}} ({{period}}). Pakisend po sa amin sa o bago mag-{{due}}. Maraming salamat po! — {{operator}}',
      active: true,
      createdAt: now,
      createdBy: 'user-ana',
      updatedAt: now,
      updatedBy: 'user-ana',
      version: 1,
    },
    {
      id: 'tmpl-msg-en-reminder',
      orgId,
      name: 'Follow-up Reminder (English)',
      language: 'en',
      purpose: 'reminder',
      body: 'Good day {{contact}},\n\nFollowing up on our request for {{task}} covering {{period}}. Kindly send over the remaining requirements on or before {{due}}:\n\n{{items}}\n\nThank you! — {{operator}}',
      active: true,
      createdAt: now,
      createdBy: 'user-ana',
      updatedAt: now,
      updatedBy: 'user-ana',
      version: 1,
    },
    {
      id: 'tmpl-msg-en-first',
      orgId,
      name: 'Initial Document Request (English)',
      language: 'en',
      purpose: 'first_request',
      body: 'Good day {{contact}},\n\nThis is {{operator}} from Santos Tax Services. For the upcoming {{task}} covering {{period}}, kindly send over the following requirements on or before {{due}}:\n\n{{items}}\n\nThank you!',
      active: true,
      createdAt: now,
      createdBy: 'user-ana',
      updatedAt: now,
      updatedBy: 'user-ana',
      version: 1,
    },
    {
      id: 'tmpl-msg-fil-first',
      orgId,
      name: 'Paunang Hiling ng Dokumento (Filipino)',
      language: 'fil',
      purpose: 'first_request',
      body: 'Magandang araw po, {{contact}}.\n\nMula po ito kay {{operator}}. Para po sa darating na {{task}} ({{period}}), pakipasa po ang mga sumusunod na requirements bago mag-{{due}}:\n\n{{items}}\n\nMaraming salamat po!',
      active: true,
      createdAt: now,
      createdBy: 'user-ana',
      updatedAt: now,
      updatedBy: 'user-ana',
      version: 1,
    },
    {
      id: 'tmpl-msg-en-correction',
      orgId,
      name: 'Correction Needed (English)',
      language: 'en',
      purpose: 'correction',
      body: 'Good day {{contact}},\n\nUpon reviewing the submitted documents for {{task}} ({{period}}), the following items require correction or replacement:\n\n{{items}}\n\nKindly send updated copies on or before {{due}}. Thank you! — {{operator}}',
      active: true,
      createdAt: now,
      createdBy: 'user-ana',
      updatedAt: now,
      updatedBy: 'user-ana',
      version: 1,
    },
  ];
}

function buildStandardFollowUps(
  orgId: string,
  baseDate: string
): { followUps: FollowUp[]; followUpAttempts: FollowUpAttempt[] } {
  const overdueDate = addDaysToDate(baseDate, -2);
  const futureDate = addDaysToDate(baseDate, 3);
  const pastDate = addDaysToDate(baseDate, -5);

  const followUps: FollowUp[] = [
    {
      id: 'fu-cruz-payroll',
      orgId,
      clientId: 'client-cruz',
      taskId: 'task-cruz-1601c',
      lineIds: ['line-cruz-1'],
      channel: 'viber',
      language: 'en',
      expectedBy: baseDate,
      attemptCount: 1,
      status: 'sent',
      createdAt: pastDate + 'T10:00:00+08:00',
      createdBy: 'user-ben',
      updatedAt: pastDate + 'T10:00:00+08:00',
      updatedBy: 'user-ben',
      version: 1,
    },
    {
      id: 'fu-rsp-2307',
      orgId,
      clientId: 'client-rsp',
      taskId: 'task-rsp-1601eq',
      lineIds: ['line-rsp-2'],
      contactId: 'con-rsp-1',
      channel: 'viber',
      language: 'fil',
      expectedBy: overdueDate,
      attemptCount: 2,
      status: 'sent',
      createdAt: addDaysToDate(baseDate, -6) + 'T09:30:00+08:00',
      createdBy: 'user-ana',
      updatedAt: overdueDate + 'T09:30:00+08:00',
      updatedBy: 'user-ana',
      version: 2,
    },
    {
      id: 'fu-horizon-invoices',
      orgId,
      clientId: 'client-horizon',
      taskId: 'task-hlc-1601c',
      lineIds: [],
      channel: 'email',
      language: 'en',
      expectedBy: futureDate,
      attemptCount: 1,
      status: 'sent',
      createdAt: addDaysToDate(baseDate, -1) + 'T14:00:00+08:00',
      createdBy: 'user-ana',
      updatedAt: addDaysToDate(baseDate, -1) + 'T14:00:00+08:00',
      updatedBy: 'user-ana',
      version: 1,
    },
    {
      id: 'fu-maria-resolved',
      orgId,
      clientId: 'client-maria',
      taskId: 'task-maria-2550q',
      lineIds: ['line-maria-1'],
      channel: 'messenger',
      language: 'en',
      expectedBy: overdueDate,
      attemptCount: 1,
      status: 'resolved',
      response: 'All invoices sent over via email',
      respondedAt: addDaysToDate(baseDate, -1) + 'T16:00:00+08:00',
      resolvedAt: addDaysToDate(baseDate, -1) + 'T16:05:00+08:00',
      resolvedReason: 'All requested lines received',
      createdAt: addDaysToDate(baseDate, -4) + 'T11:00:00+08:00',
      createdBy: 'user-ana',
      updatedAt: addDaysToDate(baseDate, -1) + 'T16:05:00+08:00',
      updatedBy: 'user-ana',
      version: 2,
    },
  ];

  const followUpAttempts: FollowUpAttempt[] = [
    {
      id: 'fua-cruz-1',
      orgId,
      followUpId: 'fu-cruz-payroll',
      attemptNo: 1,
      channel: 'viber',
      sentAt: pastDate + 'T10:15:00+08:00',
      sentBy: 'user-ben',
      messageSnapshot: 'Hi Atty. Cruz, checking in on the September payroll sheet needed for Form 1601-C filing.',
      expectedBy: baseDate,
      createdAt: pastDate + 'T10:15:00+08:00',
      createdBy: 'user-ben',
      updatedAt: pastDate + 'T10:15:00+08:00',
      updatedBy: 'user-ben',
      version: 1,
    },
    {
      id: 'fua-rsp-1',
      orgId,
      followUpId: 'fu-rsp-2307',
      attemptNo: 1,
      channel: 'viber',
      sentAt: addDaysToDate(baseDate, -6) + 'T09:30:00+08:00',
      sentBy: 'user-ana',
      messageSnapshot: 'Magandang araw po Maria, pakisend po ang signed 2307s at Q3 payee schedule.',
      expectedBy: addDaysToDate(baseDate, -3),
      createdAt: addDaysToDate(baseDate, -6) + 'T09:30:00+08:00',
      createdBy: 'user-ana',
      updatedAt: addDaysToDate(baseDate, -6) + 'T09:30:00+08:00',
      updatedBy: 'user-ana',
      version: 1,
    },
    {
      id: 'fua-rsp-2',
      orgId,
      followUpId: 'fu-rsp-2307',
      attemptNo: 2,
      channel: 'viber',
      sentAt: addDaysToDate(baseDate, -2) + 'T09:30:00+08:00',
      sentBy: 'user-ana',
      messageSnapshot: 'Magandang araw po Maria, follow-up lang po ulit para sa signed 2307s para maihabol sa 1601-EQ.',
      expectedBy: overdueDate,
      createdAt: addDaysToDate(baseDate, -2) + 'T09:30:00+08:00',
      createdBy: 'user-ana',
      updatedAt: addDaysToDate(baseDate, -2) + 'T09:30:00+08:00',
      updatedBy: 'user-ana',
      version: 1,
    },
  ];

  return { followUps, followUpAttempts };
}

function loadStore(): StoreData {
  const baseDate = todayInManila();
  try {
    const raw = getStorageItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const orgId = parsed.org?.id || 'org-demo-01';
      if (!parsed.documents || parsed.documents.length === 0) {
        parsed.documents = buildSampleDocuments(orgId, baseDate);
      }
      if (!parsed.messageTemplates || parsed.messageTemplates.length === 0) {
        parsed.messageTemplates = buildStandardMessageTemplates(orgId);
      }
      if (!parsed.followUps || parsed.followUps.length < 2) {
        const sampleFu = buildStandardFollowUps(orgId, baseDate);
        parsed.followUps = sampleFu.followUps;
        parsed.followUpAttempts = sampleFu.followUpAttempts;
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load store from localStorage', e);
  }
  const merged = buildInitialStore(baseDate);
  saveStore(merged);
  return merged;
}

/**
 * The sample organization the mock starts with, as plain data (no storage involved). The API's Demo seed
 * (scripts/seed-sql.mjs, U23) is built from this, so the mock and the preview start from the same records.
 */
export function buildInitialStore(baseDate: string): StoreData {
  const seed = generateSeedData(baseDate);
  const sampleFu = buildStandardFollowUps(seed.org.id, baseDate);
  const initialStore: StoreData = {
    ...seed,
    documents: buildSampleDocuments(seed.org.id, baseDate),
    messageTemplates: buildStandardMessageTemplates(seed.org.id),
    followUps: sampleFu.followUps,
    followUpAttempts: sampleFu.followUpAttempts,

    notes: [],
    notifications: [
      {
        id: 'notif-1',
        orgId: seed.org.id,
        userId: 'user-ana',
        type: 'daily_digest',
        title: 'Daily Digest',
        body: 'Today: 1 overdue, 1 due soon, 1 review needed, 1 visit scheduled.',
        link: '/',
        createdAt: `${todayInManila()}T07:00:00+08:00`,
        createdBy: 'user-ana',
        updatedAt: `${todayInManila()}T07:00:00+08:00`,
        updatedBy: 'user-ana',
        version: 1,
      },
      {
        id: 'notif-2',
        orgId: seed.org.id,
        userId: 'user-ana',
        type: 'due_soon_blocked',
        title: 'Due soon & missing items',
        body: 'RSP 1601-EQ Q3 is due in 3 days and still waiting on 2 items.',
        link: '/tasks/task-rsp-0619e',
        entity: 'task',
        entityId: 'task-rsp-0619e',
        createdAt: `${todayInManila()}T07:05:00+08:00`,
        createdBy: 'user-ana',
        updatedAt: `${todayInManila()}T07:05:00+08:00`,
        updatedBy: 'user-ana',
        version: 1,
      },
      {
        id: 'notif-3',
        orgId: seed.org.id,
        userId: 'user-ana',
        type: 'received_needs_review',
        title: 'Document needs review',
        body: 'Ben Morales added Signed 2307s for RSP 1601-EQ. Needs review.',
        link: '/',
        createdAt: `${todayInManila()}T08:15:00+08:00`,
        createdBy: 'user-ben',
        updatedAt: `${todayInManila()}T08:15:00+08:00`,
        updatedBy: 'user-ben',
        version: 1,
      },
      {
        id: 'notif-4',
        orgId: seed.org.id,
        userId: 'user-ana',
        type: 'visit_not_ready_tomorrow',
        title: 'Upcoming visit not ready',
        body: "Tomorrow's RDO 39 visit is not ready: 1 item missing.",
        link: '/visits/visit-today',
        entity: 'visit',
        entityId: 'visit-today',
        createdAt: `${todayInManila()}T08:30:00+08:00`,
        createdBy: 'user-ana',
        updatedAt: `${todayInManila()}T08:30:00+08:00`,
        updatedBy: 'user-ana',
        version: 1,
      },
      {
        id: 'notif-5',
        orgId: seed.org.id,
        userId: 'user-ben',
        type: 'assigned',
        title: 'Assigned to you',
        body: 'Ana Santos assigned you the RDO 39 visit on Oct 27.',
        link: '/visits/visit-today',
        entity: 'visit',
        entityId: 'visit-today',
        createdAt: `${todayInManila()}T09:00:00+08:00`,
        createdBy: 'user-ana',
        updatedAt: `${todayInManila()}T09:00:00+08:00`,
        updatedBy: 'user-ana',
        version: 1,
      },
    ],
    savedViews: [],
    baseline: null,
    pulses: [],
    activity: [
      {
        id: 'act-init-1',
        orgId: seed.org.id,
        at: `${todayInManila()}T08:30:00+08:00`,
        actorId: 'user-ana',
        entity: 'task',
        entityId: 'task-rsp-0619e',
        clientId: 'client-rsp',
        action: 'created',
        summary: 'Ana Santos created 0619-E September 2026 for Rivera Salonga & Partners',
      },
      {
        id: 'act-init-2',
        orgId: seed.org.id,
        at: `${todayInManila()}T09:15:00+08:00`,
        actorId: 'user-ben',
        entity: 'line',
        entityId: 'line-rsp-1',
        clientId: 'client-rsp',
        action: 'file_uploaded',
        summary: 'Ben Morales uploaded Signed 2307s for RSP',
      },
      {
        id: 'act-init-3',
        orgId: seed.org.id,
        at: `${todayInManila()}T10:00:00+08:00`,
        actorId: 'user-ana',
        entity: 'visit',
        entityId: 'visit-today',
        action: 'created',
        summary: 'Trip to RDO 39 scheduled for Tuesday morning',
      },
    ],
  };
  // Spec section 18 demo data, added around the base seed (existing ids never change)
  const demo = buildDemoData(seed.org.id, baseDate, initialStore.holidays);
  const merged: StoreData = {
    ...initialStore,
    offices: [...initialStore.offices, ...demo.offices],
    clients: [...initialStore.clients, ...demo.clients],
    contacts: [...initialStore.contacts, ...demo.contacts],
    authorizations: [...initialStore.authorizations, ...demo.authorizations],
    templates: [...initialStore.templates, ...demo.templates],
    reqTemplates: [...initialStore.reqTemplates, ...demo.reqTemplates],
    tasks: [...initialStore.tasks, ...demo.tasks],
    taskLines: [...initialStore.taskLines, ...demo.taskLines],
    visits: [...initialStore.visits, ...demo.visits],
    visitItems: [...initialStore.visitItems, ...demo.visitItems],
    followUps: [...initialStore.followUps, ...demo.followUps],
    followUpAttempts: [...initialStore.followUpAttempts, ...demo.followUpAttempts],
    payments: [...initialStore.payments, ...demo.payments],
    documents: [...initialStore.documents, ...demo.documents],
    notifications: [...initialStore.notifications, ...demo.notifications],
    notes: [...initialStore.notes, ...demo.notes],
    activity: [...initialStore.activity, ...demo.activity],
    holidays: [...initialStore.holidays, ...demo.holidays],
    deadlineMoves: [...initialStore.deadlineMoves, ...demo.deadlineMoves],
    baseline: demo.baseline,
    pulses: demo.pulses,
  };
  return merged;
}

function saveStore(data: StoreData = store) {
  try {
    setStorageItem(STORAGE_KEY, JSON.stringify(data));
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


function actor(): PolicyActor {
  return query().actor();
}
function assertOwner(): void {
  query().assertOwner();
}
function assertClient(clientId?: ID): void {
  query().assertClient(clientId);
}
function assertTask(id: ID): void {
  query().assertTask(id);
}
function assertLine(id: ID): void {
  query().assertLine(id);
}
function assertDocument(id: ID): void {
  query().assertDocument(id);
}
function assertFollowUp(id: ID): void {
  query().assertFollowUp(id);
}
function assertPayment(id: ID): void {
  query().assertPayment(id);
}
function canReachVisit(visitId: ID): boolean {
  return query().canReachVisit(visitId);
}
function isVisitListable(v: Visit): boolean {
  return query().isVisitListable(v);
}
function assertVisit(id: ID): void {
  query().assertVisit(id);
}
function assertVisitItem(id: ID): void {
  query().assertVisitItem(id);
}
function assertNoteTarget(entity: 'client' | 'task' | 'visit', entityId: ID): void {
  query().assertNoteTarget(entity, entityId);
}



function scopedInsightData() {
  query().scopedInsightData();
}

/** Spec 9.9 display name for a file attached to a client and, usually, a task. */
function nameForDocument(
  meta: { clientId: ID; taskId?: ID; kind: DocumentKind },
  versionNo: number,
  originalName: string,
  mimeType?: string,
): string {
  const client = store.clients.find((c) => c.id === meta.clientId);
  const task = meta.taskId ? store.tasks.find((t) => t.id === meta.taskId) : undefined;
  const template = task?.templateId ? store.templates.find((t) => t.id === task.templateId) : undefined;
  return documentDisplayName({
    clientCode: client?.code ?? 'CLIENT',
    templateCode: template?.code,
    period: task?.period ?? task?.transactionDate ?? todayInManila(),
    kind: meta.kind,
    versionNo,
    originalName,
    mimeType,
  });
}






function isClientAllowed(clientId: ID): boolean {
  return query().isClientAllowed(clientId);
}


function buildTaskSummary(task: Task): TaskSummary {
  return query().buildTaskSummary(task);
}

function buildClientSummary(client: Client): ClientSummary {
  return query().buildClientSummary(client);
}

function buildVisitSummary(visit: Visit): VisitSummary {
  return query().buildVisitSummary(visit);
}


/** The write side lives in src/data/commands.ts, shared with the Worker; this binds it to the mock's store and persona. */
const command = () => {
  const { user, membership } = getCurrentUser();
  return createCommands({ store, user, membership });
};
function assertCanSetStatus(task: Task, lines: TaskLine[], to: TaskStatus, role: Role): void {
  command().assertCanSetStatus(task, lines, to, role);
}
function rejectIdentityChange(patch: object, existing: object | undefined): void {
  command().rejectIdentityChange(patch, existing);
}
function assertRecordWrite(list: Array<{ id: ID; clientId: ID }>, id: ID | undefined, suppliedClientId?: ID): void {
  command().assertRecordWrite(list, id, suppliedClientId);
}
function assertCanReview(): void {
  command().assertCanReview();
}
function assertPatch(method: string, patch: object | undefined): void {
  command().assertPatch(method, patch);
}
function assertReferences(record: object | undefined, clientId: ID | undefined): void {
  command().assertReferences(record, clientId);
}
function upsertRow<T extends { id: ID; version: number; updatedAt: string; updatedBy: string }>(list: T[], created: T, patch: Partial<T>, userId: ID): T {
  return command().upsertRow(list, created, patch, userId);
}
function logActivity(action: ActivityEvent['action'], entity: ActivityEvent['entity'], entityId: ID, summary: string, clientId?: ID, reason?: string) {
  command().logActivity(action, entity, entityId, summary, clientId, reason);
  saveStore();
}
export { HELPER_FIELDS };

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
      const result = await command().prefs.save(p);
      saveStore();
      return result;
    },
  },

  settings: {
    async save(s: Partial<OrgSettings>) {
      await simulateLatency();
      const result = await command().settings.save(s);
      saveStore();
      return result;
    },
  },

  memberships: {
    async list() {
      await simulateLatency();
      return query().memberships.list();
    },
    async invite(m) {
      await simulateLatency();
      const result = await command().memberships.invite(m);
      saveStore();
      return result;
    },
    async update(id, input) {
      await simulateLatency();
      const result = await command().memberships.update(id, input);
      saveStore();
      return result;
    },
    async revoke(id) {
      await simulateLatency();
      const result = await command().memberships.revoke(id);
      saveStore();
      return result;
    },
  },

  today: {
    async queue(scope = 'everyone') {
      await simulateLatency();
      return query().today.queue(scope);
    },
  },

  clients: {
    async list(f) {
      await simulateLatency();
      return query().clients.list(f);
    },

    async get(id) {
      await simulateLatency();
      return query().clients.get(id);
    },

    async upsert(input) {
      await simulateLatency();
      const result = await command().clients.upsert(input);
      saveStore();
      return result;
    },

    async archive(id, reason) {
      await simulateLatency();
      const result = await command().clients.archive(id, reason);
      saveStore();
      return result;
    },

    async restore(id, reason) {
      await simulateLatency();
      const result = await command().clients.restore(id, reason);
      saveStore();
      return result;
    },

    async revealTin(id) {
      await simulateLatency();
      const result = await command().clients.revealTin(id);
      saveStore();
      return result;
    },

    async findDuplicates(c) {
      await simulateLatency();
      const result = await command().clients.findDuplicates(c);
      saveStore();
      return result;
    },

    async importPreview(rows, mapping) {
      await simulateLatency();
      const result = await command().clients.importPreview(rows, mapping);
      saveStore();
      return result;
    },

    async importCommit(preview) {
      await simulateLatency();
      const result = await command().clients.importCommit(preview);
      saveStore();
      return result;
    },

    async importUndo(batchId) {
      await simulateLatency();
      const result = await command().clients.importUndo(batchId);
      saveStore();
      return result;
    },
  },

  contacts: {
    async listByClient(clientId) {
      await simulateLatency();
      return query().contacts.listByClient(clientId);
    },
    async upsert(input) {
      await simulateLatency();
      const result = await command().contacts.upsert(input);
      saveStore();
      return result;
    },
    async remove(id, reason) {
      await simulateLatency();
      const result = await command().contacts.remove(id, reason);
      saveStore();
      return result;
    },
  },

  authorizations: {
    async listByClient(clientId) {
      await simulateLatency();
      return query().authorizations.listByClient(clientId);
    },
    async upsert(input) {
      await simulateLatency();
      const result = await command().authorizations.upsert(input);
      saveStore();
      return result;
    },
    async replace(oldId, next) {
      await simulateLatency();
      const result = await command().authorizations.replace(oldId, next);
      saveStore();
      return result;
    },
  },

  templates: {
    async list(f) {
      await simulateLatency();
      return query().templates.list(f);
    },
    async get(id) {
      await simulateLatency();
      return query().templates.get(id);
    },
    async save(input, lines) {
      await simulateLatency();
      const result = await command().templates.save(input, lines);
      saveStore();
      return result;
    },
    async markVerified(id, v) {
      await simulateLatency();
      const result = await command().templates.markVerified(id, v);
      saveStore();
      return result;
    },
  },

  deadlineMoves: {
    async list() {
      await simulateLatency();
      return query().deadlineMoves.list();
    },
    async save(m, applyToOpenTasks) {
      await simulateLatency();
      const result = await command().deadlineMoves.save(m, applyToOpenTasks);
      saveStore();
      return result;
    },
    async remove(id, reason) {
      await simulateLatency();
      const result = await command().deadlineMoves.remove(id, reason);
      saveStore();
      return result;
    },
  },

  holidays: {
    async list(year) {
      await simulateLatency();
      return query().holidays.list(year);
    },
    async save(h) {
      await simulateLatency();
      const result = await command().holidays.save(h);
      saveStore();
      return result;
    },
    async remove(id) {
      await simulateLatency();
      const result = await command().holidays.remove(id);
      saveStore();
      return result;
    },
  },

  tasks: {
    async list(f) {
      await simulateLatency();
      return query().tasks.list(f);
    },

    async get(id) {
      await simulateLatency();
      return query().tasks.get(id);
    },

    async create(t, lines) {
      await simulateLatency();
      const result = await command().tasks.create(t, lines);
      saveStore();
      return result;
    },

    async update(id, input) {
      await simulateLatency();
      const result = await command().tasks.update(id, input);
      saveStore();
      return result;
    },

    async setStatus(id, to, reason) {
      await simulateLatency();
      const result = await command().tasks.setStatus(id, to, reason);
      saveStore();
      return result;
    },

    async markSubmitted(id, s) {
      await simulateLatency();
      const result = await command().tasks.markSubmitted(id, s);
      saveStore();
      return result;
    },

    async markCompleted(id, c) {
      await simulateLatency();
      const result = await command().tasks.markCompleted(id, c);
      saveStore();
      return result;
    },

    async override(id, status, reason) {
      await simulateLatency();
      const result = await command().tasks.override(id, status, reason);
      saveStore();
      return result;
    },

    async clearOverride(id, reason) {
      await simulateLatency();
      const result = await command().tasks.clearOverride(id, reason);
      saveStore();
      return result;
    },

    async changeDue(id, dueDate, ref, reason, url) {
      await simulateLatency();
      const result = await command().tasks.changeDue(id, dueDate, ref, reason, url);
      saveStore();
      return result;
    },

    async setNextAction(id, next) {
      await simulateLatency();
      const result = await command().tasks.setNextAction(id, next);
      saveStore();
      return result;
    },

    async archive(id, reason) {
      await simulateLatency();
      const result = await command().tasks.archive(id, reason);
      saveStore();
      return result;
    },

    async restore(id, reason) {
      await simulateLatency();
      const result = await command().tasks.restore(id, reason);
      saveStore();
      return result;
    },

    async duplicateForNextPeriod(id) {
      await simulateLatency();
      const result = await command().tasks.duplicateForNextPeriod(id);
      saveStore();
      return result;
    },

    async previewOpenPeriod(period, clientIds) {
      await simulateLatency();
      const result = await command().tasks.previewOpenPeriod(period, clientIds);
      saveStore();
      return result;
    },

    async openPeriod(plan) {
      await simulateLatency();
      const result = await command().tasks.openPeriod(plan);
      saveStore();
      return result;
    },

    async board(f) {
      await simulateLatency();
      return query().tasks.board(f);
    },
  },

  lines: {
    async setStatus(id, to, extra) {
      await simulateLatency();
      const result = await command().lines.setStatus(id, to, extra);
      saveStore();
      return result;
    },

    async addAdHoc(taskId, line) {
      await simulateLatency();
      const result = await command().lines.addAdHoc(taskId, line);
      saveStore();
      return result;
    },

    async update(id, input) {
      await simulateLatency();
      const result = await command().lines.update(id, input);
      saveStore();
      return result;
    },

    async reorder(taskId, orderedIds) {
      await simulateLatency();
      const result = await command().lines.reorder(taskId, orderedIds);
      saveStore();
      return result;
    },

    async history(id) {
      await simulateLatency();
      return query().lines.history(id);
    },
  },

  documents: {
    async list(f) {
      await simulateLatency();
      return query().documents.list(f);
    },

    async upload(meta, file, thumb, info) {
      await simulateLatency();
      assertPatch('documents.upload', meta);
      assertReferences(meta, meta.clientId);
      assertClient(meta.clientId);
      validate(DocumentMetaSchema, meta);
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      const docId = generateId();
      const fileKey = FILE_KEY_PREFIX + docId;
      const thumbKey = thumb ? FILE_KEY_PREFIX + 'thumb-' + docId : undefined;
      await putFile(fileKey, file);
      if (thumb && thumbKey) await putFile(thumbKey, thumb);
      const originalName = info?.originalName || 'file.pdf';
      const doc: DocumentFile = {
        id: docId,
        orgId: store.org.id,
        clientId: meta.clientId,
        taskId: meta.taskId,
        lineId: meta.lineId,
        visitItemId: meta.visitItemId,
        paymentId: meta.paymentId,
        authorizationId: meta.authorizationId,
        kind: meta.kind,
        displayName: nameForDocument(meta, 1, originalName, file.type),
        originalName,
        mimeType: file.type || 'application/pdf',
        sizeBytes: file.size,
        originalSizeBytes: info?.originalSizeBytes || file.size,
        compressed: file.size < (info?.originalSizeBytes || file.size),
        pageCount: info?.pageCount,
        sha256: info?.sha256 || 'fake-hash-' + Date.now(),
        storageKey: fileKey,
        thumbnailKey: thumbKey,
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
          // Only move the line when the transition is allowed: an accepted line stays accepted, a received one stays received
          if (line.status !== 'received' && canTransitionLine(line.status, 'received')) {
            line.status = 'received';
            line.receivedAt = now;
          }
        }
      }

      saveStore();
      logActivity('file_uploaded', 'document', doc.id, `Uploaded ${doc.displayName}`, doc.clientId);
      return doc;
    },

    async replace(id, file, thumb, info) {
      await simulateLatency();
      assertDocument(id);
      const old = store.documents.find((d) => d.id === id);
      if (!old) throw new Error('Document not found');
      const { user } = getCurrentUser();
      const now = todayInManila() + 'T00:00:00+08:00';
      const newId = generateId();
      const fileKey = FILE_KEY_PREFIX + newId;
      const thumbKey = thumb ? FILE_KEY_PREFIX + 'thumb-' + newId : undefined;
      await putFile(fileKey, file);
      if (thumb && thumbKey) await putFile(thumbKey, thumb);
      const originalName = info?.originalName || old.originalName;
      const next: DocumentFile = {
        ...old,
        id: newId,
        displayName: nameForDocument(old, old.versionNo + 1, originalName, file.type),
        originalName,
        mimeType: file.type || old.mimeType,
        sizeBytes: file.size,
        originalSizeBytes: info?.originalSizeBytes || file.size,
        compressed: file.size < (info?.originalSizeBytes || file.size),
        pageCount: undefined,
        sha256: info?.sha256 || 'fake-hash-' + Date.now(),
        storageKey: fileKey,
        thumbnailKey: thumbKey,
        versionNo: old.versionNo + 1,
        replacesId: old.id,
        deletedAt: undefined,
        deletedReason: undefined,
        createdAt: now,
        createdBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
        version: 1,
      };
      store.documents.push(next);
      if (next.lineId) {
        const line = store.taskLines.find((l) => l.id === next.lineId);
        if (line) line.documentIds.push(next.id);
      }
      saveStore();
      logActivity('file_replaced', 'document', next.id, `Replaced ${old.displayName} with ${next.displayName}`, next.clientId);
      return next;
    },

    async update(id, input) {
      await simulateLatency();
      const { rest: d, expected } = takeVersion(input);
      assertPatch('documents.update', d);
      assertReferences(d, store.documents.find((x) => x.id === id)?.clientId);
      assertDocument(id);
      rejectIdentityChange(d, store.documents.find((x) => x.id === id));
      validate(DocumentUpdateSchema, d);
      const doc = store.documents.find((item) => item.id === id);
      if (!doc) throw new Error('Document not found');
      assertVersion(doc, expected);
      Object.assign(doc, d, { version: doc.version + 1, updatedAt: nowInManila(), updatedBy: getCurrentUser().user.id });
      saveStore();
      return doc;
    },

    async remove(id, reason) {
      await simulateLatency();
      assertDocument(id);
      validateReason(reason);
      const doc = store.documents.find((d) => d.id === id);
      if (doc) {
        doc.deletedAt = todayInManila() + 'T00:00:00+08:00';
        doc.deletedReason = reason;
        saveStore();
      }
    },

    async getUrl(id, purpose) {
      await simulateLatency();
      assertDocument(id);
      const doc = store.documents.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');
      logActivity(purpose === 'download' ? 'file_downloaded' : 'file_viewed', 'document', id, `${purpose} document ${doc.displayName}`, doc.clientId);
      // Stored files mint a fresh object URL from IndexedDB; seeded documents keep their data: URL
      return isStoredFileKey(doc.storageKey) ? getFileUrl(doc.storageKey) : doc.storageKey;
    },

    async findBySha(sha256, clientId) {
      await simulateLatency();
      return query().documents.findBySha(sha256, clientId);
    },
  },

  followUps: {
    async list(f) {
      await simulateLatency();
      return query().followUps.list(f);
    },

    async get(id) {
      await simulateLatency();
      return query().followUps.get(id);
    },

    async create(f) {
      await simulateLatency();
      const result = await command().followUps.create(f);
      saveStore();
      return result;
    },

    async markSent(id, a) {
      await simulateLatency();
      const result = await command().followUps.markSent(id, a);
      saveStore();
      return result;
    },

    async logResponse(id, r) {
      await simulateLatency();
      const result = await command().followUps.logResponse(id, r);
      saveStore();
      return result;
    },

    async escalate(id, reason) {
      await simulateLatency();
      const result = await command().followUps.escalate(id, reason);
      saveStore();
      return result;
    },

    async resolve(id, reason) {
      await simulateLatency();
      const result = await command().followUps.resolve(id, reason);
      saveStore();
      return result;
    },
  },

  messages: {
    async list() {
      await simulateLatency();
      return query().messages.list();
    },
    async save(m) {
      await simulateLatency();
      const result = await command().messages.save(m);
      saveStore();
      return result;
    },
  },

  offices: {
    async list(f) {
      await simulateLatency();
      return query().offices.list(f);
    },
    async get(id) {
      await simulateLatency();
      return query().offices.get(id);
    },
    async save(input) {
      await simulateLatency();
      const result = await command().offices.save(input);
      saveStore();
      return result;
    },
  },

  visits: {
    async list(f) {
      await simulateLatency();
      return query().visits.list(f);
    },

    async get(id) {
      await simulateLatency();
      return query().visits.get(id);
    },

    async create(v, items) {
      await simulateLatency();
      const result = await command().visits.create(v, items);
      saveStore();
      return result;
    },

    async update(id, input) {
      await simulateLatency();
      const result = await command().visits.update(id, input);
      saveStore();
      return result;
    },

    async suggestTasks(visitId) {
      await simulateLatency();
      return query().visits.suggestTasks(visitId);
    },

    async addItem(visitId, taskId, action) {
      await simulateLatency();
      const result = await command().visits.addItem(visitId, taskId, action);
      saveStore();
      return result;
    },

    async updateItem(itemId, input) {
      await simulateLatency();
      const result = await command().visits.updateItem(itemId, input);
      saveStore();
      return result;
    },

    async removeItem(itemId) {
      await simulateLatency();
      const result = await command().visits.removeItem(itemId);
      saveStore();
      return result;
    },

    async setPacked(visitId, ref, packed) {
      await simulateLatency();
      const result = await command().visits.setPacked(visitId, ref, packed);
      saveStore();
      return result;
    },

    async start(id, leaveAnywayReason) {
      await simulateLatency();
      const result = await command().visits.start(id, leaveAnywayReason);
      saveStore();
      return result;
    },

    async recordOutcome(itemId, o) {
      await simulateLatency();
      const result = await command().visits.recordOutcome(itemId, o);
      saveStore();
      return result;
    },

    async finish(id, f) {
      await simulateLatency();
      const result = await command().visits.finish(id, f);
      saveStore();
      return result;
    },

    async cancel(id, reason) {
      await simulateLatency();
      const result = await command().visits.cancel(id, reason);
      saveStore();
      return result;
    },
  },

  visitKit: {
    async list() {
      await simulateLatency();
      return query().visitKit.list();
    },
    async save(i) {
      await simulateLatency();
      const result = await command().visitKit.save(i);
      saveStore();
      return result;
    },
  },

  payments: {
    async list(f) {
      await simulateLatency();
      return query().payments.list(f);
    },

    async save(input) {
      await simulateLatency();
      const result = await command().payments.save(input);
      saveStore();
      return result;
    },

    async remove(id, reason) {
      await simulateLatency();
      const result = await command().payments.remove(id, reason);
      saveStore();
      return result;
    },
  },

  notes: {
    async list(entity, entityId) {
      await simulateLatency();
      return query().notes.list(entity, entityId);
    },
    async save(input) {
      await simulateLatency();
      const result = await command().notes.save(input);
      saveStore();
      return result;
    },
  },

  savedViews: {
    async list(page) {
      await simulateLatency();
      return query().savedViews.list(page);
    },
    async save(input) {
      await simulateLatency();
      const result = await command().savedViews.save(input);
      saveStore();
      return result;
    },
    async remove(id) {
      await simulateLatency();
      const result = await command().savedViews.remove(id);
      saveStore();
      return result;
    },
  },

  notifications: {
    async list() {
      await simulateLatency();
      return query().notifications.list();
    },
    async markRead(ids) {
      await simulateLatency();
      const result = await command().notifications.markRead(ids);
      saveStore();
      return result;
    },
    async unreadCount() {
      await simulateLatency();
      return query().notifications.unreadCount();
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
      return query().calendar.range(from, to, f);
    },
  },

  insights: {
    async get(tab: InsightsTab, f?: InsightsFilter) {
      await simulateLatency();
      return query().insights.get(tab, f) as never;
    },
  },

  baseline: {
    async get() {
      await simulateLatency();
      return query().baseline.get();
    },
    async save(input) {
      await simulateLatency();
      const result = await command().baseline.save(input);
      saveStore();
      return result;
    },
  },

  pulses: {
    async list() {
      await simulateLatency();
      return query().pulses.list();
    },
    async save(p) {
      await simulateLatency();
      const result = await command().pulses.save(p);
      saveStore();
      return result;
    },
  },

  reports: {
    async clientChecklist(clientId) {
      await simulateLatency();
      return query().reports.clientChecklist(clientId);
    },
    async clientHistory(clientId, year) {
      await simulateLatency();
      return query().reports.clientHistory(clientId, year);
    },
    async monthlySummary(month) {
      await simulateLatency();
      return query().reports.monthlySummary(month);
    },
    async exportCsv(kind) {
      await simulateLatency();
      return query().reports.exportCsv(kind);
    },
    async fullBackup() {
      await simulateLatency();
      return query().reports.fullBackup();
    },
  },

  activity: {
    async list(f) {
      await simulateLatency();
      return query().activity.list(f);
    },
  },

  search: {
    async query(q) {
      await simulateLatency();
      return query().search.query(q);
    },
  },
};

// Dev Controls
export const mockDevControls = {
  reset() {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    store = loadStore();
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    }
  },
  setPersona(role: 'owner' | 'helper') {
    currentPersona = role;
    setStorageItem(PERSONA_KEY, role);
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    }
  },
  getPersona(): 'owner' | 'helper' {
    return currentPersona;
  },
  setOffline(offline: boolean) {
    isOffline = offline;
    setStorageItem(OFFLINE_KEY, String(offline));
  },
  getOffline(): boolean {
    return isOffline;
  },
  setFailureRate(rate: number) {
    failureRate = rate;
    setStorageItem(FAILURE_RATE_KEY, String(rate));
  },
  getFailureRate(): number {
    return failureRate;
  },
  setToday(date: ISODate | null) {
    setDevToday(date);
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    }
  },
  getToday(): ISODate | null {
    return getDevToday();
  },
};

