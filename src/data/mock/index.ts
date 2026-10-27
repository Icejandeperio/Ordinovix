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
  OutcomeCause,
  NextAction,
  Role,
  ImportPreview,
  OpenPeriodPreview,
  OpenPeriodPlan,
} from '@/domain/types';
import { generateSeedData } from './seed';
import { buildDemoData } from './seed-demo';
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
import {
  calculateFirstPassRate,
  countTripsNeedingReturn,
  calculateVisitsLeftReadyRate,
  calculateOnTimeRate,
  calculateDaysToCollect,
  countLateDiscoveredBlockers,
  calculateClientResponseDays,
} from '@/domain/metrics';
import { todayInManila, setDevToday, getDevToday, addDaysToDate } from '@/lib/dates';
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
      contactId: 'contact-cruz-1',
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
      lineIds: ['line-rsp-2', 'line-rsp-3'],
      contactId: 'contact-rsp-1',
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
      taskId: 'task-horizon-0619e',
      lineIds: ['line-horizon-1'],
      contactId: 'contact-horizon-1',
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
      contactId: 'contact-maria-1',
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
    {
      id: 'fua-vtl-1',
      orgId,
      followUpId: 'fu-vtl-invoices',
      attemptNo: 1,
      channel: 'email',
      sentAt: addDaysToDate(baseDate, -1) + 'T14:00:00+08:00',
      sentBy: 'user-ben',
      messageSnapshot: 'Good day Mr. Lim, requesting September sales and purchases summaries for Form 2550-M.',
      expectedBy: futureDate,
      createdAt: addDaysToDate(baseDate, -1) + 'T14:00:00+08:00',
      createdBy: 'user-ben',
      updatedAt: addDaysToDate(baseDate, -1) + 'T14:00:00+08:00',
      updatedBy: 'user-ben',
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
  saveStore(merged);
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

/** Throws RULE_VIOLATION when canSetStatus refuses; a blocked task says why and that only an owner override can move it. */
function assertCanSetStatus(task: Task, lines: TaskLine[], to: TaskStatus, role: Role): void {
  if (canSetStatus(task, lines, to, role)) return;
  if (isBlocked(task, lines)) {
    throw new RuleViolationError(
      `Task is blocked: ${blockingReason(lines) ?? 'required lines are not accepted'}. Only an owner override with a reason can change its status.`,
    );
  }
  throw new RuleViolationError(`Cannot transition task to ${to}`);
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
      return store.memberships.filter((m) => !m.deletedAt).map((m) => {
        const u = store.users.find((user) => user.id === m.userId || user.email === m.email);
        return {
          ...m,
          name: u?.name || (m.role === 'owner' ? 'Ana Santos' : 'Ben Morales'),
          initials: u?.initials || (m.role === 'owner' ? 'AS' : 'BM'),
          lastSignInAt: u?.lastSignInAt || (m.role === 'owner' ? '2026-10-26T08:30:00+08:00' : '2026-10-25T17:15:00+08:00'),
        };
      });
    },
    async invite(m) {
      await simulateLatency();
      const { user, membership } = getCurrentUser();
      if (membership.role !== 'owner') {
        throw new Error('Access denied: Only practice owners can manage operator memberships');
      }
      const name = m.name || m.email.split('@')[0];
      const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase() || 'OP';
      const newUserId = generateId();

      const newUser: User = {
        id: newUserId,
        name,
        email: m.email,
        initials,
        displayName: name,
        lastSignInAt: undefined,
      };
      store.users.push(newUser);

      const newM: Membership & { name?: string; initials?: string } = {
        id: generateId(),
        orgId: store.org.id,
        userId: newUserId,
        email: m.email,
        role: m.role,
        clientIds: m.clientIds || [],
        active: true,
        invitedAt: todayInManila() + 'T00:00:00+08:00',
        createdAt: todayInManila() + 'T00:00:00+08:00',
        createdBy: user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: 1,
        name,
        initials,
      };
      store.memberships.push(newM);
      logActivity('access_granted', 'membership', newM.id, `Invited ${name} (${m.email}) as ${m.role}`);
      saveStore();
      return newM;
    },
    async update(id, m) {
      await simulateLatency();
      const { membership: callerMembership } = getCurrentUser();
      if (callerMembership.role !== 'owner') {
        throw new Error('Access denied: Only practice owners can manage operator memberships');
      }
      const index = store.memberships.findIndex((item) => item.id === id);
      if (index === -1) throw new Error('Membership not found');
      store.memberships[index] = { ...store.memberships[index], ...m, version: store.memberships[index].version + 1 };
      if (m.name) {
        const u = store.users.find((user) => user.id === store.memberships[index].userId || user.email === store.memberships[index].email);
        if (u) {
          u.name = m.name;
          u.displayName = m.name;
        }
      }
      if (m.active === true && store.memberships[index].revokedAt) {
        delete store.memberships[index].revokedAt;
      }
      logActivity('updated', 'membership', id, `Updated account permissions for ${store.memberships[index].email}`);
      saveStore();
      const updatedUser = store.users.find((user) => user.id === store.memberships[index].userId || user.email === store.memberships[index].email);
      return {
        ...store.memberships[index],
        name: updatedUser?.name || m.name,
        initials: updatedUser?.initials || 'OP',
      };
    },
    async revoke(id) {
      await simulateLatency();
      const { membership: callerMembership } = getCurrentUser();
      if (callerMembership.role !== 'owner') {
        throw new Error('Access denied: Only practice owners can manage operator memberships');
      }
      const m = store.memberships.find((item) => item.id === id);
      if (m) {
        m.active = false;
        m.revokedAt = todayInManila() + 'T00:00:00+08:00';
        logActivity('access_revoked', 'membership', id, `Revoked access for ${m.email}`);
        saveStore();
      }
    },
  },

  today: {
    async queue(scope = 'everyone') {
      await simulateLatency();
      const today = todayInManila();
      const { user, membership } = getCurrentUser();

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
          const items = store.visitItems.filter((vi) => vi.visitId === v.id);
          const hasAllowedClient = items.some((vi) => {
            const task = store.tasks.find((t) => t.id === vi.taskId);
            return task && isClientAllowed(task.clientId);
          });
          if (membership.role !== 'owner' && !hasAllowedClient && v.assigneeUserId !== user.id) {
            return false;
          }
          return true;
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
            (membership.role === 'owner' || v.assigneeUserId === user.id)
        );
        next14Days.push({ date: d, dayNumber, dayName, hasDueTasks, hasVisits });
      }

      // Recent activity
      const recentActivity = store.activity
        .filter((e) => !e.clientId || isClientAllowed(e.clientId))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 5);

      // KPI stats
      const firstPassRate = calculateFirstPassRate(store.visitItems);
      const blockedCount = summaries.filter((s) => s.statusGroup === 'blocked').length;

      // Counts
      const weekEndDate = addDaysToDate(today, 7);
      const visitsThisWeekCount = store.visits.filter((v) => {
        if (v.status === 'cancelled') return false;
        if (v.plannedDate < today || v.plannedDate > weekEndDate) return false;
        const items = store.visitItems.filter((vi) => vi.visitId === v.id);
        const hasAllowedClient = items.some((vi) => {
          const task = store.tasks.find((t) => t.id === vi.taskId);
          return task && isClientAllowed(task.clientId);
        });
        return membership.role === 'owner' || hasAllowedClient || v.assigneeUserId === user.id;
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
        const rawCode = r[mapping.code as string];
        const code = (rawCode ? String(rawCode).trim() : `IMP${idx + 1}`).toUpperCase();
        const displayName = r[mapping.displayName as string] ? String(r[mapping.displayName as string]).trim() : '';
        const tin = r[mapping.tin as string] ? String(r[mapping.tin as string]).trim() : undefined;

        const codeDuplicate = store.clients.find((c) => !c.deletedAt && c.code.toUpperCase() === code);
        const nameDuplicate = displayName ? store.clients.find((c) => !c.deletedAt && c.displayName.toLowerCase() === displayName.toLowerCase()) : undefined;

        if (!displayName) {
          errors.push({ row: idx + 1, field: 'displayName', message: 'Client name is required' });
        } else if (codeDuplicate) {
          errors.push({ row: idx + 1, field: 'code', message: `Duplicate client code: ${code}` });
        } else if (nameDuplicate) {
          errors.push({ row: idx + 1, field: 'displayName', message: `Duplicate client name: ${displayName}` });
        } else {
          valid.push({
            code,
            displayName,
            entityType: (r[mapping.entityType as string] as any) || 'solo',
            vatStatus: (r[mapping.vatStatus as string] as any) || 'vat',
            sizeClass: 'small',
            rdoCode: r[mapping.rdoCode as string] || '039',
            tinFull: tin,
            tinMasked: tin ? `•••-•••-${tin.replace(/\D/g, '').slice(-3)}-00000` : undefined,
            hasTin: Boolean(tin),
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
      // Save batch mapping for undo
      const batches = (store as any)._importBatches || {};
      batches[preview.batchId] = createdIds;
      (store as any)._importBatches = batches;

      return { created: createdIds, skipped: preview.errors.length, batchId: preview.batchId };
    },

    async importUndo(batchId) {
      await simulateLatency();
      const batches = (store as any)._importBatches || {};
      const ids: ID[] = batches[batchId] || [];
      const now = todayInManila() + 'T00:00:00+08:00';
      for (const id of ids) {
        const cl = store.clients.find((c) => c.id === id);
        if (cl) {
          cl.deletedAt = now;
          cl.deletedReason = 'Import batch undo rollback';
        }
      }
      delete batches[batchId];
      saveStore();
      logActivity('deleted', 'client', batchId, `Undid client import batch (${ids.length} removed)`);
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

      assertCanSetStatus(task, lines, to, membership.role);

      task.status = to;
      task.version += 1;
      saveStore();
      logActivity('status_changed', 'task', id, `Changed status to ${to}`, task.clientId, reason);
      return task;
    },

    async markSubmitted(id, s) {
      await simulateLatency();
      const { membership } = getCurrentUser();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      assertCanSetStatus(task, store.taskLines.filter((l) => l.taskId === id), 'submitted', membership.role);
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
      const { membership } = getCurrentUser();
      const task = store.tasks.find((item) => item.id === id);
      if (!task) throw new Error('Task not found');
      assertCanSetStatus(task, store.taskLines.filter((l) => l.taskId === id), 'completed', membership.role);
      const hasEvidence = store.documents.some(
        (d) => d.taskId === id && !d.deletedAt && (d.kind === 'filed_return' || d.kind === 'acknowledgment'),
      );
      if (!canCompleteWithEvidence(hasEvidence, c.noEvidenceReason)) {
        throw new RuleViolationError('Attach the filed return or acknowledgment, or give a reason of at least 10 characters');
      }
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
      let skipped = 0;
      for (const item of plan.selections) {
        const existing = store.tasks.find(
          (t) => !t.deletedAt && t.clientId === item.clientId && t.templateId === item.templateId && t.period === plan.period
        );
        if (existing) {
          skipped++;
          continue;
        }

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
      return { created: createdIds, skipped, lines: createdIds.length * 2 };
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
      await simulateLatency();
      const fu = store.followUps.find((item) => item.id === id);
      if (!fu) throw new Error('Follow up not found');
      const client = store.clients.find((c) => c.id === fu.clientId) || store.clients[0];
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
      fu.channel = a.channel;

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

      // Update ticked lines to 'received' status per Spec 11.8
      if (r.receivedLineIds && r.receivedLineIds.length > 0) {
        for (const lineId of r.receivedLineIds) {
          const line = store.taskLines.find((l) => l.id === lineId);
          if (line) {
            line.status = 'received';
            line.receivedAt = todayInManila() + 'T00:00:00+08:00';
            line.receivedVia = r.via || fu.channel;
          }
        }
      }

      // Spec 11.8: Automatic resolve when every line in it is received or not applicable
      const allLines = store.taskLines.filter((l) => fu.lineIds.includes(l.id));
      const allComplete = allLines.every(
        (l) => l.status === 'received' || l.status === 'accepted' || l.status === 'not_applicable'
      );
      if (allComplete && allLines.length > 0) {
        fu.status = 'resolved';
        fu.resolvedAt = todayInManila() + 'T00:00:00+08:00';
        fu.resolvedReason = 'All requested lines received';
      }

      saveStore();
      logActivity('response_logged', 'follow_up', id, `Response logged: ${r.text.slice(0, 30)}`, fu.clientId);
      return mockRepositories.followUps.get(id);
    },

    async escalate(id, reason) {
      await simulateLatency();
      if (!reason || reason.trim().length < 10) {
        throw new Error('Escalation reason must be at least 10 characters');
      }
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
      fu.resolvedReason = reason || 'Resolved manually';
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
      const existing = o.id ? store.offices.find((item) => item.id === o.id) : undefined;
      if (existing) {
        if (o.type) existing.type = o.type;
        if (o.name) existing.name = o.name;
        existing.rdoCode = o.rdoCode;
        existing.address = o.address;
        existing.mapUrl = o.mapUrl;
        existing.hours = o.hours;
        existing.phoneE164 = o.phoneE164;
        existing.tips = o.tips;
        existing.updatedAt = todayInManila() + 'T00:00:00+08:00';
        existing.updatedBy = user.id;
        existing.version += 1;
        saveStore();
        return existing;
      }

      const office: Office = {
        id: o.id || generateId(),
        orgId: store.org.id,
        type: o.type || 'rdo',
        name: o.name || 'Office',
        rdoCode: o.rdoCode,
        address: o.address,
        mapUrl: o.mapUrl,
        hours: o.hours,
        phoneE164: o.phoneE164,
        tips: o.tips,
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

      // Check whether this is the first visit outcome recorded for this task
      const earlierOutcomeCount = store.visitItems.filter(
        (vi) => vi.taskId === task.id && vi.id !== item.id && vi.outcome
      ).length;
      item.isFirstVisitForTask = earlierOutcomeCount === 0;

      item.outcome = o.outcome;
      item.outcomeCause = o.cause;
      item.avoidable = o.avoidable;
      item.outcomeNote = o.note;
      item.windowOrOfficer = o.windowOrOfficer;
      item.nextAction = o.nextAction;
      item.evidenceDocumentIds = o.evidenceDocumentIds || [];
      item.outcomeAt = todayInManila() + 'T' + new Date().toTimeString().slice(0, 8) + '+08:00';
      item.recordedBy = user.id;

      // Apply outcome mapping (Spec 16.6)
      if (o.outcome === 'completed') {
        if (o.evidenceDocumentIds && o.evidenceDocumentIds.length > 0) {
          task.status = 'completed';
          task.completedAt = item.outcomeAt;
        } else {
          task.status = 'awaiting_follow_up';
          task.nextAction = o.nextAction || {
            text: 'Attach evidence document',
            owner: 'operator',
            due: addDaysToDate(todayInManila(), 2),
          };
        }
      } else if (o.outcome === 'submitted_pending') {
        task.status = 'submitted';
        if (!task.submittedAt) task.submittedAt = item.outcomeAt;
        if (o.nextAction) task.nextAction = o.nextAction;
      } else if (o.outcome === 'paid_proof_pending') {
        task.status = 'awaiting_follow_up';
        task.nextAction = o.nextAction || {
          text: 'Attach payment proof',
          owner: 'operator',
          due: addDaysToDate(todayInManila(), 2),
        };
      } else if (o.outcome === 'more_documents_requested') {
        task.status = 'in_preparation';
        if (o.requestedDocuments && o.requestedDocuments.length > 0) {
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
        if (o.nextAction) task.nextAction = o.nextAction;
      } else if (o.outcome === 'correction_required') {
        task.status = 'in_preparation';
        if (o.affectedLineIds && o.affectedLineIds.length > 0) {
          for (const lineId of o.affectedLineIds) {
            const line = store.taskLines.find((l) => l.id === lineId);
            if (line) {
              line.status = 'needs_correction';
              if (o.note) line.flagNote = o.note;
            }
          }
        }
        if (o.nextAction) task.nextAction = o.nextAction;
      } else if (o.outcome === 'not_accepted') {
        task.status = 'in_preparation';
        if (o.affectedLineIds && o.affectedLineIds.length > 0) {
          for (const lineId of o.affectedLineIds) {
            const line = store.taskLines.find((l) => l.id === lineId);
            if (line) {
              line.status = 'needs_correction';
              if (o.note) line.flagNote = o.note;
            }
          }
        }
        if (o.nextAction) task.nextAction = o.nextAction;
      } else if (o.outcome === 'follow_up_required') {
        task.status = 'awaiting_follow_up';
        if (o.nextAction) task.nextAction = o.nextAction;
      }

      saveStore();
      logActivity('outcome_recorded', 'visit_item', itemId, `Recorded outcome: ${o.outcome}`, task.clientId);
      return item;
    },

    async finish(id, f) {
      await simulateLatency();
      const v = store.visits.find((item) => item.id === id);
      if (!v) throw new Error('Visit not found');
      if (!canFinishVisit(store.visitItems.filter((i) => i.visitId === id))) {
        throw new RuleViolationError('Every item needs a saved outcome before the visit can be finished');
      }
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

    async save(p) {
      await simulateLatency();
      const { user } = getCurrentUser();

      const existing = p.id ? store.payments.find((item) => item.id === p.id) : undefined;
      if (existing) {
        if (p.amount !== undefined) existing.amount = p.amount;
        if (p.paidOn) existing.paidOn = p.paidOn;
        if (p.channel) existing.channel = p.channel;
        existing.provider = p.provider;
        existing.referenceNo = p.referenceNo;
        if (p.paidBy) existing.paidBy = p.paidBy;
        existing.reimbursement = p.reimbursement;
        if (p.proofDocumentIds) existing.proofDocumentIds = p.proofDocumentIds;
        existing.note = p.note;
        existing.updatedAt = todayInManila() + 'T00:00:00+08:00';
        existing.updatedBy = user.id;
        existing.version += 1;

        if (existing.proofDocumentIds.length > 0 && existing.taskId) {
          const task = store.tasks.find((t) => t.id === existing.taskId);
          if (task && task.nextAction?.text?.toLowerCase().includes('proof')) {
            delete task.nextAction;
          }
        }

        saveStore();
        return existing;
      }

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

      // Section 11.12: Recording payment with proof clears next action "Attach payment proof"
      if (payment.proofDocumentIds.length > 0 && payment.taskId) {
        const task = store.tasks.find((t) => t.id === payment.taskId);
        if (task && task.nextAction?.text?.toLowerCase().includes('proof')) {
          delete task.nextAction;
        }
      }

      saveStore();
      logActivity(
        'created',
        'payment',
        payment.id,
        `Recorded payment of ₱${(payment.amount / 100).toFixed(2)}`,
        payment.clientId
      );
      return payment;
    },

    async remove(id, reason) {
      await simulateLatency();
      const p = store.payments.find((item) => item.id === id);
      if (p) {
        p.deletedAt = todayInManila() + 'T00:00:00+08:00';
        p.deletedReason = reason;
        saveStore();
        logActivity('deleted', 'payment', id, `Removed payment record: ${reason}`, p.clientId);
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
            v.plannedDate <= to
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
        id: store.baseline?.id || generateId(),
        orgId: store.org.id,
        periodStart: b.periodStart || '2026-01-01',
        periodEnd: b.periodEnd || '2026-06-30',
        tripsPerMonth: b.tripsPerMonth ?? 12,
        repeatTripsPerMonth: b.repeatTripsPerMonth ?? 4,
        followUpsPerWeek: b.followUpsPerWeek ?? 10,
        hoursFindingPerWeek: b.hoursFindingPerWeek ?? 6,
        lateFilingsPerQuarter: b.lateFilingsPerQuarter ?? 1,
        confidence: b.confidence ?? 3,
        note: b.note ?? '',
        createdAt: store.baseline?.createdAt || (todayInManila() + 'T00:00:00+08:00'),
        createdBy: store.baseline?.createdBy || user.id,
        updatedAt: todayInManila() + 'T00:00:00+08:00',
        updatedBy: user.id,
        version: (store.baseline?.version ?? 0) + 1,
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
      const { membership } = getCurrentUser();
      if (!f?.clientId && !f?.entityId && membership.role !== 'owner') {
        throw new Error('Access denied: Practice-wide audit log is restricted to practice owners');
      }
      let list = store.activity;
      if (membership.role === 'helper' && membership.clientIds) {
        list = list.filter((a) => !a.clientId || membership.clientIds.includes(a.clientId));
      }
      if (f?.entity) list = list.filter((a) => a.entity === f.entity);
      if (f?.clientId) list = list.filter((a) => a.clientId === f.clientId);
      if ((f as any)?.entityId) list = list.filter((a) => (a as any).entityId === (f as any).entityId);
      return { items: list, total: list.length };
    },
  },

  search: {
    async query(q) {
      await simulateLatency();
      const query = q.toLowerCase();
      const today = todayInManila();
      const { user, membership } = getCurrentUser();

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
          if (v.status === 'cancelled') return false;
          const items = store.visitItems.filter((vi) => vi.visitId === v.id);
          const hasAllowedClient = items.some((vi) => {
            const task = store.tasks.find((t) => t.id === vi.taskId);
            return task && isClientAllowed(task.clientId);
          });
          if (membership.role !== 'owner' && !hasAllowedClient && v.assigneeUserId !== user.id) {
            return false;
          }
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

