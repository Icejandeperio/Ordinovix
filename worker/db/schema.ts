/**
 * D1 schema (Drizzle). Source: docs/backend/schema-draft.sql (U19), which follows src/domain/types.ts and spec 21.6.
 * Migrations are generated from this file with `npx drizzle-kit generate` and are never edited once on main.
 *
 * Conventions: snake_case columns; every business table carries org_id and puts it first in its composite indexes; ids are
 * text; dates are 'YYYY-MM-DD' text; timestamps are ISO 8601 text with +08:00; money is integer centavos; booleans are 0/1;
 * soft delete through deleted_at / deleted_reason; `version` starts at 1 and is bumped on every update (If-Match).
 * Derived values (displayed status, due state, readiness, follow-up state) are never stored.
 * A TIN is never stored in the clear: tin_encrypted (AES-GCM) + tin_masked (display) + tin_hash (duplicate check).
 *
 * Two tables are not Drizzle's: the FTS5 table search_index and the insert-only triggers on activity are created by the
 * hand-written migration that follows the generated one (drizzle-kit cannot express them).
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, real, sqliteTable, text, unique, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

// ---- helpers ---------------------------------------------------------------------------------------------------
const bool = (name: string) => integer(name, { mode: 'boolean' });

/** CHECK (column IN ('a', 'b')): the enums of the draft, enforced in the database as well as in the API. */
const oneOf = (column: SQLiteColumn, values: readonly string[]) =>
  sql`${column} IN (${sql.raw(values.map((v) => `'${v}'`).join(', '))})`;

const stamps = () => ({
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by').notNull(),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});

/** created/updated stamps, version and soft delete: the columns of every business record (BaseRecord in types.ts). */
const record = () => ({
  ...stamps(),
  version: integer('version').notNull().default(1),
  deletedAt: text('deleted_at'),
  deletedReason: text('deleted_reason'),
});

const orgRef = () =>
  text('org_id')
    .notNull()
    .references((): AnySQLiteColumn => orgs.id);

const CHANNELS = ['viber', 'messenger', 'sms', 'email', 'phone', 'in_person'] as const;
const LANGUAGES = ['en', 'fil'] as const;
const TASK_KINDS = ['filing', 'payment', 'registration', 'one_time_transaction', 'lgu', 'other'] as const;
const COPY_FORMS = ['original', 'certified_true_copy', 'photocopy', 'digital'] as const;
const SUPPLIERS = ['client', 'operator', 'third_party'] as const;
const FILING_CHANNELS = ['efps', 'ebirforms', 'manual'] as const;

// ---- organization, people, settings -----------------------------------------------------------------------------
export const orgs = sqliteTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isDemo: bool('is_demo').notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const orgSettings = sqliteTable(
  'org_settings',
  {
    orgId: text('org_id')
      .primaryKey()
      .references((): AnySQLiteColumn => orgs.id),
    practiceName: text('practice_name').notNull(),
    operatorDisplayName: text('operator_display_name').notNull(),
    mobileE164: text('mobile_e164'),
    accreditationNumber: text('accreditation_number'),
    accreditationValidUntil: text('accreditation_valid_until'),
    dueSoonDays: integer('due_soon_days').notNull().default(7),
    followUpWaitDays: integer('follow_up_wait_days').notNull().default(3),
    authWarnDays: integer('auth_warn_days').notNull().default(30),
    helpersCanAccept: bool('helpers_can_accept').notNull().default(true),
    idleLockMinutes: integer('idle_lock_minutes').notNull().default(15),
    quietHoursStart: text('quiet_hours_start').notNull().default('20:00'),
    quietHoursEnd: text('quiet_hours_end').notNull().default('07:00'),
    digestTime: text('digest_time').notNull().default('07:00'),
    paperSize: text('paper_size').notNull().default('long'),
    weekStartsOn: integer('week_starts_on').notNull().default(0),
    retentionYears: integer('retention_years').notNull().default(5),
    supportContact: text('support_contact'),
    onboardingDone: text('onboarding_done', { mode: 'json' }).$type<string[]>().notNull().default([]),
    onboardingDismissed: bool('onboarding_dismissed').notNull().default(false),
    updatedAt: text('updated_at').notNull(),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    check('chk_org_settings_idle_lock', sql`${t.idleLockMinutes} IN (0, 5, 15, 30)`),
    check('chk_org_settings_paper_size', oneOf(t.paperSize, ['a4', 'letter', 'long'])),
    check('chk_org_settings_week_starts_on', sql`${t.weekStartsOn} IN (0, 1)`),
  ],
);

/** The app profile of a person, keyed to the Better Auth user (`user`) it belongs to once they sign in. */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayName: text('display_name'),
  email: text('email').notNull().unique(),
  initials: text('initials').notNull(),
  mobileE164: text('mobile_e164'),
  lastSignInAt: text('last_sign_in_at'),
});

export const userPrefs = sqliteTable(
  'user_prefs',
  {
    userId: text('user_id')
      .primaryKey()
      .references((): AnySQLiteColumn => users.id),
    theme: text('theme').notNull().default('system'),
    density: text('density').notNull().default('comfortable'),
    textScale: real('text_scale').notNull().default(1),
    reduceMotion: bool('reduce_motion'),
    dateOrder: text('date_order').notNull().default('mdy'),
    privacyModeOnStart: bool('privacy_mode_on_start').notNull().default(false),
    todayScope: text('today_scope').notNull().default('mine'),
    pushTypes: text('push_types', { mode: 'json' }).$type<string[]>().notNull().default([]),
    tableColumns: text('table_columns', { mode: 'json' }).$type<Record<string, string[]>>().notNull().default({}),
  },
  (t) => [
    check('chk_user_prefs_theme', oneOf(t.theme, ['system', 'light', 'dark'])),
    check('chk_user_prefs_density', oneOf(t.density, ['comfortable', 'compact'])),
    check('chk_user_prefs_date_order', oneOf(t.dateOrder, ['mdy', 'dmy'])),
    check('chk_user_prefs_today_scope', oneOf(t.todayScope, ['mine', 'everyone'])),
  ],
);

export const memberships = sqliteTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    email: text('email').notNull(),
    userId: text('user_id').references((): AnySQLiteColumn => users.id),
    role: text('role').notNull(),
    active: bool('active').notNull().default(true),
    invitedAt: text('invited_at').notNull(),
    acceptedAt: text('accepted_at'),
    revokedAt: text('revoked_at'),
    ...record(),
  },
  (t) => [
    unique('uq_memberships_org_email').on(t.orgId, t.email),
    index('idx_memberships_user').on(t.userId),
    check('chk_memberships_role', oneOf(t.role, ['owner', 'helper'])),
  ],
);

export const membershipClients = sqliteTable(
  'membership_clients',
  {
    membershipId: text('membership_id')
      .notNull()
      .references((): AnySQLiteColumn => memberships.id),
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.clientId] }), index('idx_membership_clients_client').on(t.clientId)],
);

// ---- offices, clients -------------------------------------------------------------------------------------------
export const offices = sqliteTable(
  'offices',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    rdoCode: text('rdo_code'),
    address: text('address'),
    mapUrl: text('map_url'),
    hours: text('hours'),
    phoneE164: text('phone_e164'),
    tips: text('tips'),
    isSample: bool('is_sample').notNull().default(false),
    ...record(),
  },
  (t) => [index('idx_offices_org').on(t.orgId, t.type), check('chk_offices_type', oneOf(t.type, ['rdo', 'bank', 'lgu', 'sec', 'client_office', 'other']))],
);

export const importBatches = sqliteTable('import_batches', {
  id: text('id').primaryKey(),
  orgId: orgRef(),
  totalRows: integer('total_rows').notNull(),
  createdCount: integer('created_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  undoneAt: text('undone_at'),
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by').notNull(),
});

export const clients = sqliteTable(
  'clients',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    code: text('code').notNull(),
    displayName: text('display_name').notNull(),
    registeredName: text('registered_name'),
    entityType: text('entity_type').notNull(),
    hasTin: bool('has_tin').notNull().default(false),
    /** Display only: '•••-•••-789-00000'. */
    tinMasked: text('tin_masked'),
    /** AES-GCM (Web Crypto), base64 of iv + ciphertext; decrypted only by clients.revealTin. */
    tinEncrypted: text('tin_encrypted'),
    /** HMAC of the TIN for duplicate checks; never reversible. */
    tinHash: text('tin_hash'),
    rdoCode: text('rdo_code').notNull(),
    rdoOfficeId: text('rdo_office_id').references((): AnySQLiteColumn => offices.id),
    vatStatus: text('vat_status').notNull(),
    sizeClass: text('size_class').notNull(),
    filingChannel: text('filing_channel'),
    efpsGroup: text('efps_group'),
    orusEnrolled: bool('orus_enrolled').notNull().default(false),
    accessHolder: text('access_holder').notNull(),
    usesInvoicingSoftware: bool('uses_invoicing_software').notNull().default(false),
    fiscalYearEndMonth: integer('fiscal_year_end_month').notNull().default(12),
    preferredLanguage: text('preferred_language').notNull().default('en'),
    deliveryPreference: text('delivery_preference'),
    address: text('address'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    notes: text('notes'),
    status: text('status').notNull().default('active'),
    archivedReason: text('archived_reason'),
    importBatchId: text('import_batch_id').references((): AnySQLiteColumn => importBatches.id),
    ...record(),
  },
  (t) => [
    unique('uq_clients_org_code').on(t.orgId, t.code),
    index('idx_clients_org_status').on(t.orgId, t.status),
    index('idx_clients_org_tin_hash').on(t.orgId, t.tinHash),
    check('chk_clients_entity_type', oneOf(t.entityType, ['gpp', 'solo', 'other'])),
    check('chk_clients_vat_status', oneOf(t.vatStatus, ['vat', 'non_vat_percentage', 'non_vat_8pct', 'unknown'])),
    check('chk_clients_size_class', oneOf(t.sizeClass, ['micro', 'small', 'medium', 'large', 'unknown'])),
    check('chk_clients_filing_channel', sql`${t.filingChannel} IS NULL OR ${oneOf(t.filingChannel, FILING_CHANNELS)}`),
    check('chk_clients_efps_group', sql`${t.efpsGroup} IS NULL OR ${oneOf(t.efpsGroup, ['A', 'B', 'C', 'D', 'E'])}`),
    check('chk_clients_access_holder', oneOf(t.accessHolder, ['client', 'operator', 'other', 'unknown'])),
    check('chk_clients_language', oneOf(t.preferredLanguage, LANGUAGES)),
    check('chk_clients_status', oneOf(t.status, ['active', 'archived'])),
  ],
);

export const clientAssignedUsers = sqliteTable(
  'client_assigned_users',
  {
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
    userId: text('user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.userId] })],
);

export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
    name: text('name').notNull(),
    title: text('title'),
    role: text('role'),
    phoneE164: text('phone_e164'),
    email: text('email'),
    preferredChannel: text('preferred_channel').notNull().default('viber'),
    language: text('language').notNull().default('en'),
    isSignatory: bool('is_signatory').notNull().default(false),
    notes: text('notes'),
    ...record(),
  },
  (t) => [
    index('idx_contacts_client').on(t.orgId, t.clientId),
    check('chk_contacts_title', sql`${t.title} IS NULL OR ${oneOf(t.title, ['Atty.', 'Mr.', 'Ms.'])}`),
    check('chk_contacts_channel', oneOf(t.preferredChannel, CHANNELS)),
    check('chk_contacts_language', oneOf(t.language, LANGUAGES)),
  ],
);

export const authorizations = sqliteTable(
  'authorizations',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
    type: text('type').notNull(),
    scope: text('scope', { mode: 'json' }).$type<string[]>().notNull().default([]),
    granteeUserId: text('grantee_user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id),
    issuedOn: text('issued_on').notNull(),
    validUntil: text('valid_until'),
    notarized: bool('notarized').notNull().default(false),
    documentId: text('document_id'),
    replacedById: text('replaced_by_id').references((): AnySQLiteColumn => authorizations.id),
    notes: text('notes'),
    ...record(),
  },
  (t) => [
    index('idx_authorizations_client').on(t.orgId, t.clientId),
    index('idx_authorizations_valid_until').on(t.orgId, t.validUntil),
    check('chk_authorizations_type', oneOf(t.type, ['spa', 'authorization_letter', 'secretary_certificate', 'partnership_resolution', 'other'])),
  ],
);

// ---- templates and calendar -------------------------------------------------------------------------------------
export const taskTemplates = sqliteTable(
  'task_templates',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    frequency: text('frequency').notNull(),
    appliesTo: text('applies_to', { mode: 'json' }).$type<{ entityTypes?: string[]; vatStatuses?: string[] }>().notNull().default({}),
    officeAction: bool('office_action').notNull().default(false),
    defaultOfficeType: text('default_office_type'),
    defaultAction: text('default_action'),
    paymentExpected: bool('payment_expected').notNull().default(false),
    defaultDueKind: text('default_due_kind'),
    defaultDueValue: integer('default_due_value'),
    description: text('description'),
    sourceRef: text('source_ref'),
    sourceUrl: text('source_url'),
    /** Never true without a source_ref. */
    verified: bool('verified').notNull().default(false),
    verifiedOn: text('verified_on'),
    verifiedBy: text('verified_by'),
    active: bool('active').notNull().default(true),
    ...record(),
  },
  (t) => [
    unique('uq_task_templates_org_code').on(t.orgId, t.code),
    check('chk_task_templates_kind', oneOf(t.kind, TASK_KINDS)),
    check('chk_task_templates_frequency', oneOf(t.frequency, ['monthly', 'quarterly', 'annual', 'one_off'])),
    check('chk_task_templates_due_kind', sql`${t.defaultDueKind} IS NULL OR ${oneOf(t.defaultDueKind, ['day_of_next_month', 'days_after_period_end'])}`),
    check('chk_task_templates_verified_source', sql`${t.verified} = 0 OR ${t.sourceRef} IS NOT NULL`),
  ],
);

export const requirementTemplates = sqliteTable(
  'requirement_templates',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    taskTemplateId: text('task_template_id')
      .notNull()
      .references((): AnySQLiteColumn => taskTemplates.id),
    label: text('label').notNull(),
    description: text('description'),
    required: bool('required').notNull().default(true),
    copyForm: text('copy_form').notNull(),
    copies: integer('copies'),
    suppliedBy: text('supplied_by').notNull(),
    validityDays: integer('validity_days'),
    sortOrder: integer('sort_order').notNull(),
    sourceRef: text('source_ref'),
    verified: bool('verified').notNull().default(false),
    ...record(),
  },
  (t) => [
    index('idx_requirement_templates_task').on(t.orgId, t.taskTemplateId, t.sortOrder),
    check('chk_requirement_templates_copy_form', oneOf(t.copyForm, COPY_FORMS)),
    check('chk_requirement_templates_supplied_by', oneOf(t.suppliedBy, SUPPLIERS)),
  ],
);

export const deadlineMoves = sqliteTable(
  'deadline_moves',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    /** NULL = all templates. */
    templateId: text('template_id').references((): AnySQLiteColumn => taskTemplates.id),
    /** '2026-09', '2026-Q3' or '2026'. */
    period: text('period').notNull(),
    newDueDate: text('new_due_date').notNull(),
    sourceRef: text('source_ref').notNull(),
    sourceUrl: text('source_url'),
    note: text('note'),
    ...record(),
  },
  (t) => [index('idx_deadline_moves_period').on(t.orgId, t.period)],
);

export const holidays = sqliteTable(
  'holidays',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    date: text('date').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    sourceRef: text('source_ref'),
    ...record(),
  },
  (t) => [index('idx_holidays_date').on(t.orgId, t.date), check('chk_holidays_type', oneOf(t.type, ['regular', 'special_non_working', 'local', 'office_closure']))],
);

export const messageTemplates = sqliteTable(
  'message_templates',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    name: text('name').notNull(),
    language: text('language').notNull(),
    purpose: text('purpose').notNull(),
    body: text('body').notNull(),
    active: bool('active').notNull().default(true),
    ...record(),
  },
  (t) => [
    check('chk_message_templates_language', oneOf(t.language, LANGUAGES)),
    check('chk_message_templates_purpose', oneOf(t.purpose, ['first_request', 'reminder', 'correction', 'outcome_update', 'other'])),
  ],
);

// ---- work: tasks and lines --------------------------------------------------------------------------------------
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
    templateId: text('template_id').references((): AnySQLiteColumn => taskTemplates.id),
    title: text('title'),
    kind: text('kind').notNull(),
    period: text('period'),
    transactionDate: text('transaction_date'),
    dueDate: text('due_date').notNull(),
    dueSourceKind: text('due_source_kind').notNull(),
    dueSourceRef: text('due_source_ref'),
    dueSourceUrl: text('due_source_url'),
    channel: text('channel'),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id),
    officeAction: bool('office_action').notNull().default(false),
    paymentExpected: bool('payment_expected').notNull().default(false),
    /** Operator-set or stored status. The displayed status is derived (rules.derivedStatus), never stored. */
    status: text('status').notNull(),
    overrideStatus: text('override_status'),
    overrideReason: text('override_reason'),
    overrideBy: text('override_by'),
    overrideAt: text('override_at'),
    nextActionText: text('next_action_text'),
    nextActionOwner: text('next_action_owner'),
    nextActionDue: text('next_action_due'),
    /** First time every required line was accepted (metrics). */
    readyAt: text('ready_at'),
    submittedAt: text('submitted_at'),
    submittedVia: text('submitted_via'),
    submissionRef: text('submission_ref'),
    completedAt: text('completed_at'),
    completionNoEvidenceReason: text('completion_no_evidence_reason'),
    archivedReason: text('archived_reason'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    notes: text('notes'),
    ...record(),
  },
  (t) => [
    index('idx_tasks_client_status').on(t.orgId, t.clientId, t.status),
    index('idx_tasks_due').on(t.orgId, t.dueDate),
    index('idx_tasks_owner').on(t.orgId, t.ownerUserId),
    // One OPEN task per client, template and period (the idempotence rule openPeriod relies on). Finished tasks do not count:
    // the history of a client keeps one completed task per period it was run, and a period can be run again after a re-open.
    uniqueIndex('idx_tasks_open_period')
      .on(t.orgId, t.clientId, t.templateId, t.period)
      .where(
        sql`${t.deletedAt} IS NULL AND ${t.templateId} IS NOT NULL AND ${t.period} IS NOT NULL AND ${t.status} NOT IN ('completed', 'archived')`,
      ),
    check('chk_tasks_kind', oneOf(t.kind, TASK_KINDS)),
    check('chk_tasks_due_source_kind', oneOf(t.dueSourceKind, ['template', 'deadline_move', 'override', 'manual'])),
    check('chk_tasks_channel', sql`${t.channel} IS NULL OR ${oneOf(t.channel, FILING_CHANNELS)}`),
    check('chk_tasks_next_action_owner', sql`${t.nextActionOwner} IS NULL OR ${oneOf(t.nextActionOwner, SUPPLIERS)}`),
  ],
);

export const taskLines = sqliteTable(
  'task_lines',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    taskId: text('task_id')
      .notNull()
      .references((): AnySQLiteColumn => tasks.id),
    /** Copied from the task for permission scoping. */
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
    requirementTemplateId: text('requirement_template_id').references((): AnySQLiteColumn => requirementTemplates.id),
    label: text('label').notNull(),
    required: bool('required').notNull().default(true),
    copyForm: text('copy_form').notNull(),
    copies: integer('copies'),
    suppliedBy: text('supplied_by').notNull(),
    printAndBring: bool('print_and_bring').notNull().default(false),
    status: text('status').notNull(),
    sortOrder: integer('sort_order').notNull(),
    neededBy: text('needed_by'),
    requestedAt: text('requested_at'),
    receivedAt: text('received_at'),
    receivedVia: text('received_via'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    reviewNote: text('review_note'),
    flagNote: text('flag_note'),
    naReason: text('na_reason'),
    lateDiscovered: bool('late_discovered').notNull().default(false),
    ...record(),
  },
  (t) => [
    index('idx_task_lines_task').on(t.orgId, t.taskId),
    index('idx_task_lines_status').on(t.orgId, t.status),
    index('idx_task_lines_client').on(t.orgId, t.clientId),
    check('chk_task_lines_copy_form', oneOf(t.copyForm, COPY_FORMS)),
    check('chk_task_lines_supplied_by', oneOf(t.suppliedBy, SUPPLIERS)),
    check('chk_task_lines_status', oneOf(t.status, ['not_requested', 'requested', 'received', 'under_review', 'accepted', 'incomplete', 'needs_correction', 'not_applicable'])),
  ],
);

// ---- documents --------------------------------------------------------------------------------------------------
export const documents = sqliteTable(
  'documents',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
    taskId: text('task_id').references((): AnySQLiteColumn => tasks.id),
    lineId: text('line_id').references((): AnySQLiteColumn => taskLines.id),
    visitItemId: text('visit_item_id'),
    paymentId: text('payment_id'),
    authorizationId: text('authorization_id').references((): AnySQLiteColumn => authorizations.id),
    kind: text('kind').notNull(),
    /** Spec 9.9 naming convention. */
    displayName: text('display_name').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    originalSizeBytes: integer('original_size_bytes').notNull(),
    compressed: bool('compressed').notNull().default(false),
    pageCount: integer('page_count'),
    sha256: text('sha256').notNull(),
    /** R2 key: immutable and never reused. */
    storageKey: text('storage_key').notNull().unique(),
    thumbnailKey: text('thumbnail_key'),
    versionNo: integer('version_no').notNull().default(1),
    replacesId: text('replaces_id').references((): AnySQLiteColumn => documents.id),
    source: text('source').notNull(),
    retainUntil: text('retain_until'),
    ...record(),
  },
  (t) => [
    index('idx_documents_client').on(t.orgId, t.clientId),
    index('idx_documents_sha').on(t.orgId, t.sha256),
    check('chk_documents_kind', oneOf(t.kind, ['source', 'filed_return', 'acknowledgment', 'payment_proof', 'stamped_copy', 'ecar', 'authorization', 'other'])),
    check('chk_documents_source', oneOf(t.source, ['upload', 'camera', 'import'])),
  ],
);

export const lineDocuments = sqliteTable(
  'line_documents',
  {
    lineId: text('line_id')
      .notNull()
      .references((): AnySQLiteColumn => taskLines.id),
    documentId: text('document_id')
      .notNull()
      .references((): AnySQLiteColumn => documents.id),
  },
  (t) => [primaryKey({ columns: [t.lineId, t.documentId] })],
);

// ---- follow-ups -------------------------------------------------------------------------------------------------
export const followUps = sqliteTable(
  'follow_ups',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
    taskId: text('task_id').references((): AnySQLiteColumn => tasks.id),
    contactId: text('contact_id').references((): AnySQLiteColumn => contacts.id),
    channel: text('channel').notNull(),
    language: text('language').notNull(),
    templateId: text('template_id').references((): AnySQLiteColumn => messageTemplates.id),
    expectedBy: text('expected_by'),
    attemptCount: integer('attempt_count').notNull().default(0),
    /** due, overdue and waiting are derived (rules.followUpState), not stored. */
    status: text('status').notNull(),
    escalatedReason: text('escalated_reason'),
    response: text('response'),
    respondedAt: text('responded_at'),
    resolvedAt: text('resolved_at'),
    resolvedReason: text('resolved_reason'),
    ...record(),
  },
  (t) => [
    index('idx_follow_ups_status').on(t.orgId, t.status, t.expectedBy),
    index('idx_follow_ups_client').on(t.orgId, t.clientId),
    check('chk_follow_ups_channel', oneOf(t.channel, CHANNELS)),
    check('chk_follow_ups_language', oneOf(t.language, LANGUAGES)),
    check('chk_follow_ups_status', oneOf(t.status, ['open', 'sent', 'answered', 'escalated', 'resolved'])),
  ],
);

export const followUpLines = sqliteTable(
  'follow_up_lines',
  {
    followUpId: text('follow_up_id')
      .notNull()
      .references((): AnySQLiteColumn => followUps.id),
    lineId: text('line_id')
      .notNull()
      .references((): AnySQLiteColumn => taskLines.id),
  },
  (t) => [primaryKey({ columns: [t.followUpId, t.lineId] })],
);

export const followUpAttempts = sqliteTable(
  'follow_up_attempts',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    followUpId: text('follow_up_id')
      .notNull()
      .references((): AnySQLiteColumn => followUps.id),
    attemptNo: integer('attempt_no').notNull(),
    channel: text('channel').notNull(),
    sentAt: text('sent_at').notNull(),
    sentBy: text('sent_by')
      .notNull()
      .references((): AnySQLiteColumn => users.id),
    messageSnapshot: text('message_snapshot').notNull(),
    expectedBy: text('expected_by').notNull(),
    ...record(),
  },
  (t) => [index('idx_follow_up_attempts_fu').on(t.orgId, t.followUpId), index('idx_follow_up_attempts_sent').on(t.orgId, t.sentAt)],
);

// ---- visits -----------------------------------------------------------------------------------------------------
export const visits = sqliteTable(
  'visits',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    officeId: text('office_id').references((): AnySQLiteColumn => offices.id),
    officeType: text('office_type').notNull(),
    officeName: text('office_name').notNull(),
    rdoCode: text('rdo_code'),
    plannedDate: text('planned_date').notNull(),
    arriveBy: text('arrive_by'),
    assigneeUserId: text('assignee_user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id),
    purpose: text('purpose'),
    /** Ready / Not ready is derived (rules.visitReadiness). */
    status: text('status').notNull(),
    startedAt: text('started_at'),
    departureOverrideReason: text('departure_override_reason'),
    finishedAt: text('finished_at'),
    costTransport: integer('cost_transport'),
    costParking: integer('cost_parking'),
    costOther: integer('cost_other'),
    costNote: text('cost_note'),
    cancelledReason: text('cancelled_reason'),
    ...record(),
  },
  (t) => [
    index('idx_visits_planned').on(t.orgId, t.plannedDate),
    index('idx_visits_assignee').on(t.orgId, t.assigneeUserId),
    check('chk_visits_status', oneOf(t.status, ['planned', 'in_progress', 'done', 'cancelled'])),
  ],
);

export const visitItems = sqliteTable(
  'visit_items',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    visitId: text('visit_id')
      .notNull()
      .references((): AnySQLiteColumn => visits.id),
    taskId: text('task_id')
      .notNull()
      .references((): AnySQLiteColumn => tasks.id),
    /** Copied for permission scoping and canReachVisit. */
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
    intendedAction: text('intended_action').notNull(),
    questions: text('questions'),
    readyAtDeparture: bool('ready_at_departure'),
    /** Set when the outcome is recorded (metrics). */
    isFirstVisitForTask: bool('is_first_visit_for_task').notNull().default(false),
    outcome: text('outcome'),
    outcomeCause: text('outcome_cause'),
    avoidable: bool('avoidable'),
    outcomeNote: text('outcome_note'),
    windowOrOfficer: text('window_or_officer'),
    nextActionText: text('next_action_text'),
    nextActionOwner: text('next_action_owner'),
    nextActionDue: text('next_action_due'),
    outcomeAt: text('outcome_at'),
    recordedBy: text('recorded_by'),
    followUpId: text('follow_up_id').references((): AnySQLiteColumn => followUps.id),
    ...record(),
  },
  (t) => [
    index('idx_visit_items_visit').on(t.orgId, t.visitId),
    index('idx_visit_items_client').on(t.orgId, t.clientId),
    index('idx_visit_items_task').on(t.orgId, t.taskId),
    check('chk_visit_items_action', oneOf(t.intendedAction, ['submit', 'pay', 'claim', 'inquire', 'follow_up'])),
    check(
      'chk_visit_items_outcome',
      sql`${t.outcome} IS NULL OR ${oneOf(t.outcome, ['completed', 'submitted_pending', 'paid_proof_pending', 'more_documents_requested', 'correction_required', 'not_accepted', 'follow_up_required'])}`,
    ),
  ],
);

export const visitItemEvidence = sqliteTable(
  'visit_item_evidence',
  {
    visitItemId: text('visit_item_id')
      .notNull()
      .references((): AnySQLiteColumn => visitItems.id),
    documentId: text('document_id')
      .notNull()
      .references((): AnySQLiteColumn => documents.id),
  },
  (t) => [primaryKey({ columns: [t.visitItemId, t.documentId] })],
);

export const visitKitItems = sqliteTable('visit_kit_items', {
  id: text('id').primaryKey(),
  orgId: orgRef(),
  label: text('label').notNull(),
  note: text('note'),
  active: bool('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull(),
  ...record(),
});

/** What has been packed for a visit: a task line or a kit item. */
export const visitPacked = sqliteTable(
  'visit_packed',
  {
    visitId: text('visit_id')
      .notNull()
      .references((): AnySQLiteColumn => visits.id),
    lineId: text('line_id').references((): AnySQLiteColumn => taskLines.id),
    kitItemId: text('kit_item_id').references((): AnySQLiteColumn => visitKitItems.id),
    packedAt: text('packed_at').notNull(),
  },
  (t) => [
    unique('uq_visit_packed').on(t.visitId, t.lineId, t.kitItemId),
    check('chk_visit_packed_one_target', sql`(${t.lineId} IS NOT NULL) <> (${t.kitItemId} IS NOT NULL)`),
  ],
);

// ---- payments, notes, views, notifications ----------------------------------------------------------------------
export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    clientId: text('client_id')
      .notNull()
      .references((): AnySQLiteColumn => clients.id),
    taskId: text('task_id')
      .notNull()
      .references((): AnySQLiteColumn => tasks.id),
    /** Integer centavos. */
    amount: integer('amount').notNull(),
    paidOn: text('paid_on').notNull(),
    channel: text('channel').notNull(),
    provider: text('provider'),
    referenceNo: text('reference_no'),
    paidBy: text('paid_by').notNull(),
    reimbursementStatus: text('reimbursement_status'),
    reimbursedOn: text('reimbursed_on'),
    note: text('note'),
    ...record(),
  },
  (t) => [
    index('idx_payments_client').on(t.orgId, t.clientId, t.paidOn),
    index('idx_payments_task').on(t.orgId, t.taskId),
    check('chk_payments_channel', oneOf(t.channel, ['aab_otc', 'rco', 'online', 'other'])),
    check('chk_payments_paid_by', oneOf(t.paidBy, ['client', 'operator'])),
    check('chk_payments_reimbursement', sql`${t.reimbursementStatus} IS NULL OR ${oneOf(t.reimbursementStatus, ['not_needed', 'waiting', 'reimbursed'])}`),
  ],
);

export const paymentProofs = sqliteTable(
  'payment_proofs',
  {
    paymentId: text('payment_id')
      .notNull()
      .references((): AnySQLiteColumn => payments.id),
    documentId: text('document_id')
      .notNull()
      .references((): AnySQLiteColumn => documents.id),
  },
  (t) => [primaryKey({ columns: [t.paymentId, t.documentId] })],
);

export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    /** The target's client, for permission scoping. */
    clientId: text('client_id').references((): AnySQLiteColumn => clients.id),
    body: text('body').notNull(),
    pinned: bool('pinned').notNull().default(false),
    editedAt: text('edited_at'),
    ...record(),
  },
  (t) => [index('idx_notes_entity').on(t.orgId, t.entity, t.entityId), check('chk_notes_entity', oneOf(t.entity, ['client', 'task', 'visit']))],
);

export const savedViews = sqliteTable(
  'saved_views',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    userId: text('user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id),
    page: text('page').notNull(),
    name: text('name').notNull(),
    query: text('query').notNull(),
    shared: bool('shared').notNull().default(false),
    ...record(),
  },
  (t) => [
    index('idx_saved_views_user').on(t.orgId, t.userId, t.page),
    check('chk_saved_views_page', oneOf(t.page, ['tasks', 'clients', 'documents', 'payments', 'follow_ups', 'audit'])),
  ],
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    userId: text('user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** Always points at a record that exists. */
    link: text('link').notNull(),
    entity: text('entity'),
    entityId: text('entity_id'),
    /** Lets a helper's list drop links to unreachable clients. */
    clientId: text('client_id').references((): AnySQLiteColumn => clients.id),
    readAt: text('read_at'),
    pushedAt: text('pushed_at'),
    ...record(),
  },
  (t) => [index('idx_notifications_user').on(t.orgId, t.userId, t.readAt)],
);

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    userId: text('user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_push_subscriptions_user').on(t.orgId, t.userId)],
);

// ---- baseline, pulses -------------------------------------------------------------------------------------------
export const baselines = sqliteTable(
  'baselines',
  {
    id: text('id').primaryKey(),
    /** One self-reported baseline per organization. */
    orgId: text('org_id')
      .notNull()
      .unique()
      .references((): AnySQLiteColumn => orgs.id),
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(),
    tripsPerMonth: real('trips_per_month'),
    repeatTripsPerMonth: real('repeat_trips_per_month'),
    followUpsPerWeek: real('follow_ups_per_week'),
    hoursFindingPerWeek: real('hours_finding_per_week'),
    lateFilingsPerQuarter: real('late_filings_per_quarter'),
    confidence: integer('confidence'),
    note: text('note'),
    ...stamps(),
    version: integer('version').notNull().default(1),
  },
  (t) => [check('chk_baselines_confidence', sql`${t.confidence} IS NULL OR ${t.confidence} BETWEEN 1 AND 5`)],
);

export const pulses = sqliteTable(
  'pulses',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    /** '2026-10'. */
    month: text('month').notNull(),
    hoursFindingLastWeek: real('hours_finding_last_week'),
    confidence: integer('confidence'),
    note: text('note'),
    ...record(),
  },
  (t) => [index('idx_pulses_month').on(t.orgId, t.month), check('chk_pulses_confidence', sql`${t.confidence} IS NULL OR ${t.confidence} BETWEEN 1 AND 5`)],
);

// ---- activity (insert-only) and API bookkeeping -----------------------------------------------------------------
/** Insert-only: the triggers in the hand-written migration refuse any update or delete. */
export const activity = sqliteTable(
  'activity',
  {
    id: text('id').primaryKey(),
    orgId: orgRef(),
    at: text('at').notNull(),
    actorId: text('actor_id').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    /** NULL for practice-wide events (the owner's). */
    clientId: text('client_id'),
    action: text('action').notNull(),
    /** A plain sentence. */
    summary: text('summary').notNull(),
    /** Never a revealed TIN or any secret. */
    beforeJson: text('before_json', { mode: 'json' }),
    afterJson: text('after_json', { mode: 'json' }),
    reason: text('reason'),
    device: text('device'),
  },
  (t) => [
    index('idx_activity_entity').on(t.orgId, t.entity, t.entityId, t.at),
    index('idx_activity_at').on(t.orgId, t.at),
    index('idx_activity_client').on(t.orgId, t.clientId, t.at),
  ],
);

export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    orgId: text('org_id').notNull(),
    userId: text('user_id').notNull(),
    key: text('key').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    status: integer('status').notNull(),
    responseJson: text('response_json').notNull(),
    /** The retention job removes keys older than 7 days. */
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId, t.key] })],
);

// ---- Better Auth (names and fields as the Drizzle adapter expects; Google is the only provider) -----------------
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: bool('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('idx_session_user').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references((): AnySQLiteColumn => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('idx_account_user').on(t.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('idx_verification_identifier').on(t.identifier)],
);
