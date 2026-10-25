// ===== Primitives =====
export type ID = string;            // UUIDv7, generated client-side
export type ISODate = string;       // 'YYYY-MM-DD', an Asia/Manila calendar date
export type ISODateTime = string;   // ISO 8601 with offset, e.g. '2026-10-24T15:12:00+08:00'
export type HHmm = string;          // '09:30'
export type Centavos = number;      // integer; ₱12,345.50 === 1234550
export type PeriodKey = string;     // '2026-09' (month) | '2026-Q3' (quarter) | '2026' (year)

export interface BaseRecord {
  id: ID;
  orgId: ID;
  createdAt: ISODateTime;
  createdBy: ID;
  updatedAt: ISODateTime;
  updatedBy: ID;
  version: number;                  // 1 on create, +1 on every update; stale saves are rejected
  deletedAt?: ISODateTime;
  deletedReason?: string; // soft delete only
}

// ===== Enums =====
export type Role = 'owner' | 'helper';
export type EntityType = 'gpp' | 'solo' | 'other';
export type VatStatus = 'vat' | 'non_vat_percentage' | 'non_vat_8pct' | 'unknown';
export type SizeClass = 'micro' | 'small' | 'medium' | 'large' | 'unknown';
export type FilingChannel = 'efps' | 'ebirforms' | 'manual';
export type EfpsGroup = 'A' | 'B' | 'C' | 'D' | 'E';
export type AccessHolder = 'client' | 'operator' | 'other' | 'unknown';
export type Channel = 'viber' | 'messenger' | 'sms' | 'email' | 'phone' | 'in_person';
export type Language = 'en' | 'fil';
export type TaskKind = 'filing' | 'payment' | 'registration' | 'one_time_transaction' | 'lgu' | 'other';
export type Frequency = 'monthly' | 'quarterly' | 'annual' | 'one_off';
export type Supplier = 'client' | 'operator' | 'third_party';
export type CopyForm = 'original' | 'certified_true_copy' | 'photocopy' | 'digital'; // label: "Certified copy"
export type OfficeType = 'rdo' | 'bank' | 'lgu' | 'sec' | 'client_office' | 'other';
export type VisitAction = 'submit' | 'pay' | 'claim' | 'inquire' | 'follow_up';
export type DocumentKind =
  | 'source' | 'filed_return' | 'acknowledgment' | 'payment_proof'
  | 'stamped_copy' | 'ecar' | 'authorization' | 'other';
export type PaymentChannel = 'aab_otc' | 'rco' | 'online' | 'other';

export type TaskStatus =
  | 'intake' | 'waiting_on_client' | 'review_required' | 'needs_correction'   // derived from lines
  | 'in_preparation' | 'ready_for_review' | 'ready_next_step'                 // operator-set
  | 'submitted' | 'awaiting_follow_up' | 'completed' | 'archived';            // operator-set

export type LineStatus =
  | 'not_requested' | 'requested' | 'received' | 'under_review'
  | 'accepted' | 'incomplete' | 'needs_correction' | 'not_applicable';

export type Outcome =
  | 'completed' | 'submitted_pending' | 'paid_proof_pending' | 'more_documents_requested'
  | 'correction_required' | 'not_accepted' | 'follow_up_required';

export type OutcomeCause =
  // avoidable by default
  | 'missing_document' | 'wrong_copy_form' | 'wrong_copy_count' | 'authorization_problem'
  | 'document_error' | 'unsigned_or_unnotarized'
  // not avoidable by default
  | 'office_system_down' | 'officer_unavailable' | 'new_requirement'
  | 'processing_time' | 'cutoff_reached' | 'other';

export type VisitStatus = 'planned' | 'in_progress' | 'done' | 'cancelled'; // Ready / Not ready is derived

// Derived, never stored
export type DueState = 'closed' | 'overdue' | 'due_today' | 'due_soon' | 'ok';
export type FollowUpState = 'not_sent' | 'due_today' | 'overdue' | 'waiting' | 'escalated' | 'resolved';
export type AuthorizationState = 'valid' | 'expiring' | 'expired';
export type StatusGroup = 'blocked' | 'in_progress' | 'ready' | 'submitted' | 'done';

// ===== Organization, people, settings =====
export interface Org {
  id: ID;
  name: string;
  isDemo: boolean;
  createdAt: ISODateTime;
}

export interface OrgSettings {
  orgId: ID;
  practiceName: string;
  operatorDisplayName: string;          // {{operator}} in messages
  mobileE164?: string;
  accreditation?: { number: string; validUntil?: ISODate };
  dueSoonDays: number;                  // default 7
  followUpWaitDays: number;             // default 3
  authWarnDays: number;                 // default 30
  helpersCanAccept: boolean;            // default true
  idleLockMinutes: 0 | 5 | 15 | 30;     // default 15
  quietHours: { start: HHmm; end: HHmm }; // default 20:00–07:00
  digestTime: HHmm;                     // default 07:00
  paperSize: 'a4' | 'letter' | 'long';  // long = 8.5 x 13 in
  weekStartsOn: 0 | 1;                  // 0 = Sunday (default)
  retentionYears: number;               // confirm with the operator
  supportContact?: string;
  updatedAt: ISODateTime;
  version: number;
}

export interface User {
  id: ID;
  name: string;
  displayName?: string;
  email: string;
  initials: string;
  mobileE164?: string;
  lastSignInAt?: ISODateTime;
}

export interface Membership extends BaseRecord {
  email: string;                        // the allowlist entry (Google account)
  userId?: ID;                          // set on first sign-in
  role: Role;
  clientIds: ID[];                      // helpers: assigned clients; owners: ignored (all)
  active: boolean;
  invitedAt: ISODateTime;
  acceptedAt?: ISODateTime;
  revokedAt?: ISODateTime;
}

export interface UserPrefs {
  userId: ID;
  theme: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  textScale: 1 | 1.125 | 1.25;
  reduceMotion: boolean | null;         // null = follow the device
  dateOrder: 'mdy' | 'dmy';             // for typed dates
  privacyModeOnStart: boolean;
  todayScope: 'mine' | 'everyone';
  pushTypes: NotificationType[];
  tableColumns: Record<string, string[]>;
}

// ===== Clients =====
export interface Client extends BaseRecord {
  code: string;                         // 'RSP'
  displayName: string;
  registeredName?: string;
  entityType: EntityType;
  hasTin: boolean;
  tinMasked?: string;                   // '•••-•••-789-00000'; full TIN only via clients.revealTin
  tinFull?: string;                     // stored internally in mock
  rdoCode: string;
  rdoOfficeId?: ID;
  vatStatus: VatStatus;
  sizeClass: SizeClass;
  filingChannel?: FilingChannel;
  efpsGroup?: EfpsGroup;
  orusEnrolled: boolean;
  accessHolder: AccessHolder;
  usesInvoicingSoftware: boolean;
  fiscalYearEndMonth: number;           // 1–12, default 12 (informational in v2)
  preferredLanguage: Language;
  deliveryPreference?: string;
  address?: string;
  assignedUserIds: ID[];
  tags: string[];
  notes?: string;
  status: 'active' | 'archived';
  archivedReason?: string;
}

export interface Contact extends BaseRecord {
  clientId: ID;
  name: string;
  title?: 'Atty.' | 'Mr.' | 'Ms.';
  role?: string;
  phoneE164?: string;
  email?: string;
  preferredChannel: Channel;
  language: Language;
  isSignatory: boolean;
  notes?: string;
}

export interface Authorization extends BaseRecord {
  clientId: ID;
  type: 'spa' | 'authorization_letter' | 'secretary_certificate' | 'partnership_resolution' | 'other';
  scope: TaskKind[];
  granteeUserId: ID;
  issuedOn: ISODate;
  validUntil?: ISODate;
  notarized: boolean;
  documentId?: ID;
  replacedById?: ID;
  notes?: string;
}

// ===== Templates and calendar =====
export interface TaskTemplate extends BaseRecord {
  code: string;
  name: string;
  kind: TaskKind;
  frequency: Frequency;
  appliesTo: { entityTypes?: EntityType[]; vatStatuses?: VatStatus[] };
  officeAction: boolean;
  defaultOfficeType?: OfficeType;
  defaultAction?: VisitAction;
  paymentExpected: boolean;
  defaultDue?: { kind: 'day_of_next_month' | 'days_after_period_end'; value: number };
  description?: string;
  sourceRef?: string;
  sourceUrl?: string;
  verified: boolean;
  verifiedOn?: ISODate;
  verifiedBy?: ID;
  active: boolean;
}

export interface RequirementTemplate extends BaseRecord {
  taskTemplateId: ID;
  label: string;
  description?: string;
  required: boolean;
  copyForm: CopyForm;
  copies?: number;
  suppliedBy: Supplier;
  validityDays?: number;
  sortOrder: number;
  sourceRef?: string;
  verified: boolean;
}

export interface DeadlineMove extends BaseRecord {
  templateId?: ID;                      // undefined = all templates
  period: PeriodKey;
  newDueDate: ISODate;
  sourceRef: string;
  sourceUrl?: string;
  note?: string;
}

export interface Holiday extends BaseRecord {
  date: ISODate;
  name: string;
  type: 'regular' | 'special_non_working' | 'local' | 'office_closure';
  sourceRef?: string;
}

export interface MessageTemplate extends BaseRecord {
  name: string;
  language: Language;
  purpose: 'first_request' | 'reminder' | 'correction' | 'outcome_update' | 'other';
  body: string;                         // placeholders: {{contact}} {{client}} {{task}} {{period}} {{items}} {{due}} {{deadline}} {{operator}}
  active: boolean;
}

export interface Office extends BaseRecord {
  type: OfficeType;
  name: string;
  rdoCode?: string;
  address?: string;
  mapUrl?: string;
  hours?: string;
  phoneE164?: string;
  tips?: string;
  isSample: boolean;
}

export interface VisitKitItem extends BaseRecord {
  label: string;
  note?: string;
  active: boolean;
  sortOrder: number;
}

// ===== Work =====
export interface NextAction {
  text: string;
  owner: Supplier;
  due?: ISODate;
}

export interface Task extends BaseRecord {
  clientId: ID;
  templateId?: ID;
  title?: string;                       // title for one-off tasks
  kind: TaskKind;
  period?: PeriodKey;
  transactionDate?: ISODate;           // one of period or transactionDate
  dueDate: ISODate;
  dueSource: { kind: 'template' | 'deadline_move' | 'override' | 'manual'; ref?: string; url?: string };
  channel?: FilingChannel;
  ownerUserId: ID;
  officeAction: boolean;
  paymentExpected: boolean;
  status: TaskStatus;                   // stored status; display uses rules.derivedStatus
  statusOverride?: { status: TaskStatus; reason: string; by: ID; at: ISODateTime };
  nextAction?: NextAction;
  readyAt?: ISODateTime;                // first time every required line was accepted (metrics)
  submittedAt?: ISODateTime;
  submittedVia?: FilingChannel | 'office';
  submissionRef?: string;
  completedAt?: ISODateTime;
  completionNoEvidenceReason?: string;
  archivedReason?: string;
  tags: string[];
  notes?: string;
}

export interface TaskLine extends BaseRecord {
  taskId: ID;
  clientId: ID;                         // clientId copied for permission scoping
  requirementTemplateId?: ID;
  label: string;
  required: boolean;
  copyForm: CopyForm;
  copies?: number;
  suppliedBy: Supplier;
  printAndBring: boolean;
  status: LineStatus;
  sortOrder: number;
  neededBy?: ISODate;
  requestedAt?: ISODateTime;            // first request (metrics)
  receivedAt?: ISODateTime;
  receivedVia?: Channel;
  reviewedBy?: ID;
  reviewedAt?: ISODateTime;
  reviewNote?: string;
  flagNote?: string;                    // incomplete / needs correction note
  naReason?: string;
  lateDiscovered: boolean;              // rules.isLateDiscovered at creation or flagging
  documentIds: ID[];
}

export interface DocumentFile extends BaseRecord {
  clientId: ID;
  taskId?: ID;
  lineId?: ID;
  visitItemId?: ID;
  paymentId?: ID;
  authorizationId?: ID;
  kind: DocumentKind;
  displayName: string;                  // section 9.9 convention
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  originalSizeBytes: number;
  compressed: boolean;
  pageCount?: number;
  sha256: string;
  storageKey: string;                   // immutable; mock: object URL key
  thumbnailKey?: string;
  versionNo: number;
  replacesId?: ID;
  source: 'upload' | 'camera' | 'import';
  retainUntil?: ISODate;
}

export interface FollowUp extends BaseRecord {
  clientId: ID;
  taskId?: ID;
  lineIds: ID[];
  contactId?: ID;
  channel: Channel;
  language: Language;
  templateId?: ID;
  expectedBy?: ISODate;
  attemptCount: number;
  status: 'open' | 'sent' | 'answered' | 'escalated' | 'resolved'; // due/overdue/waiting are derived
  escalatedReason?: string;
  response?: string;
  respondedAt?: ISODateTime;
  resolvedAt?: ISODateTime;
  resolvedReason?: string;
}

export interface FollowUpAttempt extends BaseRecord {
  followUpId: ID;
  attemptNo: number;
  channel: Channel;
  sentAt: ISODateTime;
  sentBy: ID;
  messageSnapshot: string;
  expectedBy: ISODate;
}

export interface Visit extends BaseRecord {
  officeId?: ID;
  officeType: OfficeType;
  officeName: string;
  rdoCode?: string;
  plannedDate: ISODate;
  arriveBy?: HHmm;
  assigneeUserId: ID;
  purpose?: string;
  status: VisitStatus;
  packedLineIds: ID[];
  packedKitItemIds: ID[];
  startedAt?: ISODateTime;
  departureOverrideReason?: string;
  finishedAt?: ISODateTime;
  costs?: { transport?: Centavos; parking?: Centavos; other?: Centavos; note?: string };
  cancelledReason?: string;
}

export interface VisitItem extends BaseRecord {
  visitId: ID;
  taskId: ID;
  clientId: ID;
  intendedAction: VisitAction;
  questions?: string;
  readyAtDeparture?: boolean;
  isFirstVisitForTask: boolean;         // set when the outcome is recorded (metrics)
  outcome?: Outcome;
  outcomeCause?: OutcomeCause;
  avoidable?: boolean;
  outcomeNote?: string;
  windowOrOfficer?: string;
  nextAction?: NextAction;
  evidenceDocumentIds: ID[];
  outcomeAt?: ISODateTime;
  recordedBy?: ID;
  followUpId?: ID;                      // created by the outcome mapping
}

export interface Payment extends BaseRecord {
  clientId: ID;
  taskId: ID;
  amount: Centavos;
  paidOn: ISODate;
  channel: PaymentChannel;
  provider?: string;
  referenceNo?: string;
  paidBy: 'client' | 'operator';
  reimbursement?: { status: 'not_needed' | 'waiting' | 'reimbursed'; reimbursedOn?: ISODate };
  proofDocumentIds: ID[];
  note?: string;
}

// ===== Collaboration, tracking, system =====
export interface Note extends BaseRecord {
  entity: 'client' | 'task' | 'visit';
  entityId: ID;
  body: string;
  pinned: boolean;
  editedAt?: ISODateTime;
}

export interface SavedView extends BaseRecord {
  userId: ID;
  page: 'tasks' | 'clients' | 'documents' | 'payments' | 'follow_ups' | 'audit';
  name: string;
  query: string;                        // URL query string
  shared: boolean;
}

export type NotificationType =
  | 'daily_digest' | 'due_soon_blocked' | 'overdue' | 'follow_ups_due' | 'received_needs_review'
  | 'visit_not_ready_tomorrow' | 'visit_ready' | 'left_not_ready' | 'outcome_recorded'
  | 'authorization_expiring' | 'accreditation_expiring' | 'assigned' | 'monthly_check_in';

export interface Notification extends BaseRecord {
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  entity?: ActivityEntity;
  entityId?: ID;
  readAt?: ISODateTime;
  pushedAt?: ISODateTime;
}

export interface Baseline extends BaseRecord {
  periodStart: ISODate;
  periodEnd: ISODate;
  tripsPerMonth?: number;
  repeatTripsPerMonth?: number;
  followUpsPerWeek?: number;
  hoursFindingPerWeek?: number;
  lateFilingsPerQuarter?: number;
  confidence?: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

export interface Pulse extends BaseRecord {
  month: string;                        // '2026-10'
  hoursFindingLastWeek?: number;
  confidence?: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

export type ActivityEntity =
  | 'client' | 'contact' | 'authorization' | 'task' | 'line' | 'document' | 'follow_up'
  | 'visit' | 'visit_item' | 'payment' | 'template' | 'office' | 'settings' | 'membership' | 'note';

export type ActivityAction =
  | 'created' | 'updated' | 'status_changed' | 'overridden' | 'due_changed' | 'reassigned'
  | 'archived' | 'restored' | 'deleted'
  | 'file_uploaded' | 'file_replaced' | 'file_viewed' | 'file_downloaded' | 'tin_revealed'
  | 'follow_up_sent' | 'response_logged' | 'escalated' | 'resolved'
  | 'visit_started' | 'outcome_recorded' | 'visit_finished' | 'visit_cancelled'
  | 'access_granted' | 'access_revoked' | 'signed_in' | 'exported' | 'imported' | 'verified';

export interface ActivityEvent {
  id: ID;
  orgId: ID;
  at: ISODateTime;
  actorId: ID;
  entity: ActivityEntity;
  entityId: ID;
  clientId?: ID;
  action: ActivityAction;
  summary: string;                      // plain sentence: "Ana accepted Signed 2307s"
  before?: unknown;
  after?: unknown;
  reason?: string;
  device?: string;
}

// ===== View Models & Helpers =====
export interface Page<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

export interface TaskSummary {
  task: Task;
  client: Client;
  displayedStatus: TaskStatus;
  statusGroup: StatusGroup;
  dueState: DueState;
  acceptedLineCount: number;
  requiredLineCount: number;
  totalLineCount: number;
  blockingReason?: string;
  attachedVisit?: { visitId: ID; plannedDate: ISODate; officeName: string };
}

export interface ClientSummary {
  client: Client;
  activeTaskCount: number;
  blockedTaskCount: number;
  pendingReviewCount: number;
  urgentDueState?: DueState;
  authAttention: boolean;
  assignedUsers: User[];
}

export interface TodayQueue {
  focusDate: ISODate;
  overdueTasks: TaskSummary[];
  dueTodayTasks: TaskSummary[];
  dueSoonTasks: TaskSummary[];
  reviewRequiredLines: Array<{ line: TaskLine; task: Task; client: Client; files: DocumentFile[] }>;
  blockedByClient: Array<{
    client: Client;
    tasks: Array<{ task: Task; missingLines: TaskLine[] }>;
    missingCount: number;
    firstMissingLabels: string[];
    lastRequestedDate?: ISODate;
    attemptCount: number;
  }>;
  readyForActionTasks: TaskSummary[];
  nextVisits: Array<{
    visit: Visit;
    office?: Office;
    itemCount: number;
    readyItemCount: number;
    isReady: boolean;
    blockingReasons: string[];
  }>;
  followUpsDue: FollowUpView[];
  authorizationsExpiring: Array<{
    authorization: Authorization;
    client: Client;
    state: AuthorizationState;
  }>;
  next14Days: Array<{
    date: ISODate;
    dayNumber: number;
    dayName: string;
    hasDueTasks: boolean;
    hasVisits: boolean;
  }>;
  recentActivity: ActivityEvent[];
  counts: {
    overdue: number;
    dueThisWeek: number;
    blockedByClient: number;
    awaitingReview: number;
    followUpsDue: number;
    visitsThisWeek: number;
  };
  kpiStats: {
    firstPassRate: number;              // 0-100%
    blockedCount: number;
    openTasksCount: number;
  };
}

export interface VisitSummary {
  visit: Visit;
  itemCount: number;
  readyItemCount: number;
  isReady: boolean;
  blockingReasons: string[];
}

export interface VisitDetail {
  visit: Visit;
  office?: Office;
  items: Array<{
    item: VisitItem;
    task: Task;
    client: Client;
    lines: TaskLine[];
    isReady: boolean;
    reasons: string[];
  }>;
  readiness: {
    ready: boolean;
    readyCount: number;
    total: number;
    blockingItems: Array<{ taskId: ID; clientName: string; reasons: string[] }>;
  };
  packList: Array<{
    clientId: ID;
    clientName: string;
    items: Array<{ label: string; form: CopyForm; copies: number; packed: boolean; refId: ID }>;
  }>;
  kitItems: Array<{ kitItem: VisitKitItem; packed: boolean }>;
}

export interface FollowUpView {
  followUp: FollowUp;
  client: Client;
  task?: Task;
  lines: TaskLine[];
  contact?: Contact;
  state: FollowUpState;
  attempts: FollowUpAttempt[];
}

export interface OpenPeriodPreview {
  period: PeriodKey;
  clientCount: number;
  applicableTasks: Array<{
    clientId: ID;
    clientName: string;
    templateId: ID;
    templateName: string;
    kind: TaskKind;
    calculatedDue: ISODate;
    linesCount: number;
  }>;
}

export interface OpenPeriodPlan {
  period: PeriodKey;
  selections: Array<{ clientId: ID; templateId: ID; dueDate: ISODate }>;
}

export interface SearchResults {
  clients: ClientSummary[];
  tasks: TaskSummary[];
  documents: DocumentFile[];
  visits: VisitSummary[];
  followUps: FollowUpView[];
  payments: Payment[];
  offices: Office[];
}

export interface CalendarItem {
  id: ID;
  type: 'task_due' | 'visit' | 'follow_up' | 'holiday' | 'authorization_expiry';
  title: string;
  date: ISODate;
  clientId?: ID;
  clientCode?: string;
  statusTone?: string;
  meta?: Record<string, unknown>;
}

export interface OfficeStats {
  totalVisits: number;
  firstPassRate: number;
  averageMinutes?: number;
  topCauses: Array<{ cause: OutcomeCause; count: number }>;
}

export interface ImportPreview {
  batchId: ID;
  totalRows: number;
  validRows: Partial<Client>[];
  errors: Array<{ row: number; field: string; message: string }>;
}

export interface ClientChecklistReport {
  client: Client;
  generatedAt: ISODateTime;
  tasks: Array<{ task: Task; lines: TaskLine[] }>;
}

export interface ClientHistoryReport {
  client: Client;
  year: number;
  tasks: TaskSummary[];
  totalPayments: Centavos;
}

export interface MonthlySummaryReport {
  month: string;
  filingsCount: number;
  onTimeFilingsCount: number;
  totalVisits: number;
  firstPassRate: number;
  paymentsHandled: Centavos;
}

export type InsightsTab = 'overview' | 'trips' | 'chasing' | 'deadlines' | 'workload' | 'clients';

export interface InsightsFilter {
  period?: PeriodKey;
  from?: ISODate;
  to?: ISODate;
  clientId?: ID;
  assignedUserId?: ID;
}

export interface InsightsData {
  overview: {
    firstPassRate: number;
    repeatTripRate: number;
    onTimeFilingRate: number;
    averageDaysToCollect: number;
    baselineComparison?: { firstPassBaseline: number; repeatTripsBaseline: number };
    monthlyTrends: Array<{ month: string; firstPassRate: number; repeatTrips: number; filings: number }>;
  };
  trips: {
    totalTrips: number;
    completedTrips: number;
    avoidableRejectionCount: number;
    topRejectionCauses: Array<{ cause: OutcomeCause; count: number; avoidable: boolean }>;
    officePerformance: Array<{ officeName: string; visits: number; firstPassRate: number }>;
  };
  chasing: {
    averageResponseDays: number;
    followUpSuccessRate: number;
    chasesPerTask: number;
    lateDiscoveredBlockersCount: number;
    channelEffectiveness: Array<{ channel: Channel; attempts: number; responses: number }>;
  };
  deadlines: {
    filingsOnTime: number;
    filingsLate: number;
    heatCalendar: Array<{ date: ISODate; taskCount: number }>;
  };
  workload: {
    operatorTasks: number;
    helperTasks: number;
    tasksByStatusGroup: Record<StatusGroup, number>;
  };
  clients: {
    fastestClients: Array<{ client: Client; avgDays: number }>;
    slowestClients: Array<{ client: Client; avgDays: number; unreadReviewsCount: number }>;
  };
}

