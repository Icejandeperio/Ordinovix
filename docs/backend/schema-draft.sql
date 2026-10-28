-- Ordinovix D1 (SQLite) schema draft.
-- DRAFT: not applied anywhere. No database exists yet and no command has been run against one.
-- Source: src/domain/types.ts (one table per interface) and spec section 21.6.
-- Conventions: snake_case; every business table has org_id first in its composite indexes; ids are UUIDv7 text;
-- dates are 'YYYY-MM-DD' text; timestamps are ISO 8601 text with +08:00; money is integer centavos; booleans are 0/1;
-- soft delete through deleted_at / deleted_reason; version starts at 1 and is bumped on every update.
-- Better Auth owns its own tables (user, session, account, verification); users below is the app profile keyed to it.

-- ---------------------------------------------------------------- organization, people, settings
CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE org_settings (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id),
  practice_name TEXT NOT NULL,
  operator_display_name TEXT NOT NULL,
  mobile_e164 TEXT,
  accreditation_number TEXT,
  accreditation_valid_until TEXT,
  due_soon_days INTEGER NOT NULL DEFAULT 7,
  follow_up_wait_days INTEGER NOT NULL DEFAULT 3,
  auth_warn_days INTEGER NOT NULL DEFAULT 30,
  helpers_can_accept INTEGER NOT NULL DEFAULT 1,
  idle_lock_minutes INTEGER NOT NULL DEFAULT 15 CHECK (idle_lock_minutes IN (0, 5, 15, 30)),
  quiet_hours_start TEXT NOT NULL DEFAULT '20:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '07:00',
  digest_time TEXT NOT NULL DEFAULT '07:00',
  paper_size TEXT NOT NULL DEFAULT 'long' CHECK (paper_size IN ('a4', 'letter', 'long')),
  week_starts_on INTEGER NOT NULL DEFAULT 0 CHECK (week_starts_on IN (0, 1)),
  retention_years INTEGER NOT NULL DEFAULT 5,
  support_contact TEXT,
  onboarding_done TEXT NOT NULL DEFAULT '[]',        -- JSON array of finished first-run steps
  onboarding_dismissed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,                                -- the Better Auth user id
  name TEXT NOT NULL,
  display_name TEXT,
  email TEXT NOT NULL UNIQUE,
  initials TEXT NOT NULL,
  mobile_e164 TEXT,
  last_sign_in_at TEXT
);

CREATE TABLE user_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  density TEXT NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable', 'compact')),
  text_scale REAL NOT NULL DEFAULT 1,
  reduce_motion INTEGER,                              -- NULL follows the device
  date_order TEXT NOT NULL DEFAULT 'mdy' CHECK (date_order IN ('mdy', 'dmy')),
  privacy_mode_on_start INTEGER NOT NULL DEFAULT 0,
  today_scope TEXT NOT NULL DEFAULT 'mine' CHECK (today_scope IN ('mine', 'everyone')),
  push_types TEXT NOT NULL DEFAULT '[]',              -- JSON array of notification types
  table_columns TEXT NOT NULL DEFAULT '{}'            -- JSON object
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  email TEXT NOT NULL,                                -- the allowlist entry (Google account)
  user_id TEXT REFERENCES users(id),                  -- set on first sign-in
  role TEXT NOT NULL CHECK (role IN ('owner', 'helper')),
  active INTEGER NOT NULL DEFAULT 1,
  invited_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT,
  UNIQUE (org_id, email)
);
CREATE INDEX idx_memberships_user ON memberships (user_id);

CREATE TABLE membership_clients (                     -- a helper's assigned clients
  membership_id TEXT NOT NULL REFERENCES memberships(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  PRIMARY KEY (membership_id, client_id)
);
CREATE INDEX idx_membership_clients_client ON membership_clients (client_id);

-- ---------------------------------------------------------------- offices, clients
CREATE TABLE offices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  type TEXT NOT NULL CHECK (type IN ('rdo', 'bank', 'lgu', 'sec', 'client_office', 'other')),
  name TEXT NOT NULL,
  rdo_code TEXT, address TEXT, map_url TEXT, hours TEXT, phone_e164 TEXT, tips TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_offices_org ON offices (org_id, type);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  registered_name TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('gpp', 'solo', 'other')),
  has_tin INTEGER NOT NULL DEFAULT 0,
  tin_masked TEXT,                                    -- display only
  tin_encrypted TEXT,                                 -- AES-GCM (Web Crypto), base64 of iv + ciphertext; revealed only by clients.revealTin
  tin_hash TEXT,                                      -- HMAC of the TIN for duplicate checks, never reversible
  rdo_code TEXT NOT NULL,
  rdo_office_id TEXT REFERENCES offices(id),
  vat_status TEXT NOT NULL CHECK (vat_status IN ('vat', 'non_vat_percentage', 'non_vat_8pct', 'unknown')),
  size_class TEXT NOT NULL CHECK (size_class IN ('micro', 'small', 'medium', 'large', 'unknown')),
  filing_channel TEXT CHECK (filing_channel IN ('efps', 'ebirforms', 'manual')),
  efps_group TEXT CHECK (efps_group IN ('A', 'B', 'C', 'D', 'E')),
  orus_enrolled INTEGER NOT NULL DEFAULT 0,
  access_holder TEXT NOT NULL CHECK (access_holder IN ('client', 'operator', 'other', 'unknown')),
  uses_invoicing_software INTEGER NOT NULL DEFAULT 0,
  fiscal_year_end_month INTEGER NOT NULL DEFAULT 12,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'fil')),
  delivery_preference TEXT,
  address TEXT,
  tags TEXT NOT NULL DEFAULT '[]',                    -- display-only JSON array
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_reason TEXT,
  import_batch_id TEXT REFERENCES import_batches(id),
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT,
  UNIQUE (org_id, code)
);
CREATE INDEX idx_clients_org_status ON clients (org_id, status);
CREATE INDEX idx_clients_org_tin_hash ON clients (org_id, tin_hash);

CREATE TABLE client_assigned_users (
  client_id TEXT NOT NULL REFERENCES clients(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (client_id, user_id)
);

CREATE TABLE import_batches (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  total_rows INTEGER NOT NULL,
  created_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  undone_at TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL
);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  title TEXT CHECK (title IN ('Atty.', 'Mr.', 'Ms.')),
  role TEXT, phone_e164 TEXT, email TEXT,
  preferred_channel TEXT NOT NULL DEFAULT 'viber' CHECK (preferred_channel IN ('viber', 'messenger', 'sms', 'email', 'phone', 'in_person')),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fil')),
  is_signatory INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_contacts_client ON contacts (org_id, client_id);

CREATE TABLE authorizations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  type TEXT NOT NULL CHECK (type IN ('spa', 'authorization_letter', 'secretary_certificate', 'partnership_resolution', 'other')),
  scope TEXT NOT NULL DEFAULT '[]',                   -- JSON array of task kinds
  grantee_user_id TEXT NOT NULL REFERENCES users(id),
  issued_on TEXT NOT NULL,
  valid_until TEXT,
  notarized INTEGER NOT NULL DEFAULT 0,
  document_id TEXT,
  replaced_by_id TEXT REFERENCES authorizations(id),
  notes TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_authorizations_client ON authorizations (org_id, client_id);
CREATE INDEX idx_authorizations_valid_until ON authorizations (org_id, valid_until);

-- ---------------------------------------------------------------- templates and calendar
CREATE TABLE task_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('filing', 'payment', 'registration', 'one_time_transaction', 'lgu', 'other')),
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual', 'one_off')),
  applies_to TEXT NOT NULL DEFAULT '{}',              -- JSON: entityTypes, vatStatuses
  office_action INTEGER NOT NULL DEFAULT 0,
  default_office_type TEXT,
  default_action TEXT,
  payment_expected INTEGER NOT NULL DEFAULT 0,
  default_due_kind TEXT CHECK (default_due_kind IN ('day_of_next_month', 'days_after_period_end')),
  default_due_value INTEGER,
  description TEXT,
  source_ref TEXT, source_url TEXT,
  verified INTEGER NOT NULL DEFAULT 0,                -- never 1 without source_ref
  verified_on TEXT, verified_by TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT,
  UNIQUE (org_id, code)
);

CREATE TABLE requirement_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  task_template_id TEXT NOT NULL REFERENCES task_templates(id),
  label TEXT NOT NULL,
  description TEXT,
  required INTEGER NOT NULL DEFAULT 1,
  copy_form TEXT NOT NULL CHECK (copy_form IN ('original', 'certified_true_copy', 'photocopy', 'digital')),
  copies INTEGER,
  supplied_by TEXT NOT NULL CHECK (supplied_by IN ('client', 'operator', 'third_party')),
  validity_days INTEGER,
  sort_order INTEGER NOT NULL,
  source_ref TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_requirement_templates_task ON requirement_templates (org_id, task_template_id, sort_order);

CREATE TABLE deadline_moves (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  template_id TEXT REFERENCES task_templates(id),     -- NULL = all templates
  period TEXT NOT NULL,                               -- '2026-09', '2026-Q3' or '2026'
  new_due_date TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  source_url TEXT,
  note TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_deadline_moves_period ON deadline_moves (org_id, period);

CREATE TABLE holidays (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('regular', 'special_non_working', 'local', 'office_closure')),
  source_ref TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_holidays_date ON holidays (org_id, date);

CREATE TABLE message_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'fil')),
  purpose TEXT NOT NULL CHECK (purpose IN ('first_request', 'reminder', 'correction', 'outcome_update', 'other')),
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);

-- ---------------------------------------------------------------- work: tasks and lines
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  template_id TEXT REFERENCES task_templates(id),
  title TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('filing', 'payment', 'registration', 'one_time_transaction', 'lgu', 'other')),
  period TEXT,
  transaction_date TEXT,
  due_date TEXT NOT NULL,
  due_source_kind TEXT NOT NULL CHECK (due_source_kind IN ('template', 'deadline_move', 'override', 'manual')),
  due_source_ref TEXT, due_source_url TEXT,
  channel TEXT CHECK (channel IN ('efps', 'ebirforms', 'manual')),
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  office_action INTEGER NOT NULL DEFAULT 0,
  payment_expected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,                               -- operator-set or stored status; displayed status is derived, never stored
  override_status TEXT, override_reason TEXT, override_by TEXT, override_at TEXT,
  next_action_text TEXT, next_action_owner TEXT CHECK (next_action_owner IN ('client', 'operator', 'third_party')), next_action_due TEXT,
  ready_at TEXT,                                      -- first time every required line was accepted (metrics)
  submitted_at TEXT, submitted_via TEXT, submission_ref TEXT,
  completed_at TEXT, completion_no_evidence_reason TEXT,
  archived_reason TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_tasks_client_status ON tasks (org_id, client_id, status);
CREATE INDEX idx_tasks_due ON tasks (org_id, due_date);
CREATE INDEX idx_tasks_owner ON tasks (org_id, owner_user_id);
-- One OPEN task per client, template and period: the idempotence rule openPeriod relies on. Completed and archived tasks do
-- not count (U23: the seeded history repeats a client, template and period once per finished run).
CREATE UNIQUE INDEX idx_tasks_open_period ON tasks (org_id, client_id, template_id, period) WHERE deleted_at IS NULL AND template_id IS NOT NULL AND period IS NOT NULL AND status NOT IN ('completed', 'archived');

CREATE TABLE task_lines (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  client_id TEXT NOT NULL REFERENCES clients(id),     -- copied from the task for permission scoping
  requirement_template_id TEXT REFERENCES requirement_templates(id),
  label TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1,
  copy_form TEXT NOT NULL CHECK (copy_form IN ('original', 'certified_true_copy', 'photocopy', 'digital')),
  copies INTEGER,
  supplied_by TEXT NOT NULL CHECK (supplied_by IN ('client', 'operator', 'third_party')),
  print_and_bring INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('not_requested', 'requested', 'received', 'under_review', 'accepted', 'incomplete', 'needs_correction', 'not_applicable')),
  sort_order INTEGER NOT NULL,
  needed_by TEXT,
  requested_at TEXT, received_at TEXT, received_via TEXT,
  reviewed_by TEXT, reviewed_at TEXT, review_note TEXT, flag_note TEXT, na_reason TEXT,
  late_discovered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_task_lines_task ON task_lines (org_id, task_id);
CREATE INDEX idx_task_lines_status ON task_lines (org_id, status);
CREATE INDEX idx_task_lines_client ON task_lines (org_id, client_id);

-- ---------------------------------------------------------------- documents
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  task_id TEXT REFERENCES tasks(id),
  line_id TEXT REFERENCES task_lines(id),
  visit_item_id TEXT,
  payment_id TEXT,
  authorization_id TEXT REFERENCES authorizations(id),
  kind TEXT NOT NULL CHECK (kind IN ('source', 'filed_return', 'acknowledgment', 'payment_proof', 'stamped_copy', 'ecar', 'authorization', 'other')),
  display_name TEXT NOT NULL,                         -- spec 9.9 convention
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  original_size_bytes INTEGER NOT NULL,
  compressed INTEGER NOT NULL DEFAULT 0,
  page_count INTEGER,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,                   -- R2 key, immutable, never reused
  thumbnail_key TEXT,
  version_no INTEGER NOT NULL DEFAULT 1,
  replaces_id TEXT REFERENCES documents(id),
  source TEXT NOT NULL CHECK (source IN ('upload', 'camera', 'import')),
  retain_until TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_documents_client ON documents (org_id, client_id);
CREATE INDEX idx_documents_sha ON documents (org_id, sha256);

CREATE TABLE line_documents (
  line_id TEXT NOT NULL REFERENCES task_lines(id),
  document_id TEXT NOT NULL REFERENCES documents(id),
  PRIMARY KEY (line_id, document_id)
);

-- ---------------------------------------------------------------- follow-ups
CREATE TABLE follow_ups (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  task_id TEXT REFERENCES tasks(id),
  contact_id TEXT REFERENCES contacts(id),
  channel TEXT NOT NULL CHECK (channel IN ('viber', 'messenger', 'sms', 'email', 'phone', 'in_person')),
  language TEXT NOT NULL CHECK (language IN ('en', 'fil')),
  template_id TEXT REFERENCES message_templates(id),
  expected_by TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('open', 'sent', 'answered', 'escalated', 'resolved')),  -- due, overdue, waiting are derived
  escalated_reason TEXT,
  response TEXT, responded_at TEXT,
  resolved_at TEXT, resolved_reason TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_follow_ups_status ON follow_ups (org_id, status, expected_by);
CREATE INDEX idx_follow_ups_client ON follow_ups (org_id, client_id);

CREATE TABLE follow_up_lines (
  follow_up_id TEXT NOT NULL REFERENCES follow_ups(id),
  line_id TEXT NOT NULL REFERENCES task_lines(id),
  PRIMARY KEY (follow_up_id, line_id)
);

CREATE TABLE follow_up_attempts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  follow_up_id TEXT NOT NULL REFERENCES follow_ups(id),
  attempt_no INTEGER NOT NULL,
  channel TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  sent_by TEXT NOT NULL REFERENCES users(id),
  message_snapshot TEXT NOT NULL,
  expected_by TEXT NOT NULL,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_follow_up_attempts_fu ON follow_up_attempts (org_id, follow_up_id);
CREATE INDEX idx_follow_up_attempts_sent ON follow_up_attempts (org_id, sent_at);

-- ---------------------------------------------------------------- visits
CREATE TABLE visits (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  office_id TEXT REFERENCES offices(id),
  office_type TEXT NOT NULL,
  office_name TEXT NOT NULL,
  rdo_code TEXT,
  planned_date TEXT NOT NULL,
  arrive_by TEXT,
  assignee_user_id TEXT NOT NULL REFERENCES users(id),
  purpose TEXT,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'done', 'cancelled')),  -- Ready / Not ready is derived
  started_at TEXT,
  departure_override_reason TEXT,
  finished_at TEXT,
  cost_transport INTEGER, cost_parking INTEGER, cost_other INTEGER, cost_note TEXT,   -- centavos
  cancelled_reason TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_visits_planned ON visits (org_id, planned_date);
CREATE INDEX idx_visits_assignee ON visits (org_id, assignee_user_id);

CREATE TABLE visit_items (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  visit_id TEXT NOT NULL REFERENCES visits(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  client_id TEXT NOT NULL REFERENCES clients(id),     -- copied for permission scoping and canReachVisit
  intended_action TEXT NOT NULL CHECK (intended_action IN ('submit', 'pay', 'claim', 'inquire', 'follow_up')),
  questions TEXT,
  ready_at_departure INTEGER,
  is_first_visit_for_task INTEGER NOT NULL DEFAULT 0, -- set when the outcome is recorded (metrics)
  outcome TEXT CHECK (outcome IN ('completed', 'submitted_pending', 'paid_proof_pending', 'more_documents_requested', 'correction_required', 'not_accepted', 'follow_up_required')),
  outcome_cause TEXT,
  avoidable INTEGER,
  outcome_note TEXT,
  window_or_officer TEXT,
  next_action_text TEXT, next_action_owner TEXT, next_action_due TEXT,
  outcome_at TEXT, recorded_by TEXT,
  follow_up_id TEXT REFERENCES follow_ups(id),
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_visit_items_visit ON visit_items (org_id, visit_id);
CREATE INDEX idx_visit_items_client ON visit_items (org_id, client_id);
CREATE INDEX idx_visit_items_task ON visit_items (org_id, task_id);

CREATE TABLE visit_item_evidence (
  visit_item_id TEXT NOT NULL REFERENCES visit_items(id),
  document_id TEXT NOT NULL REFERENCES documents(id),
  PRIMARY KEY (visit_item_id, document_id)
);

CREATE TABLE visit_kit_items (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  label TEXT NOT NULL,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);

CREATE TABLE visit_packed (                           -- what has been packed for a visit: a task line or a kit item
  visit_id TEXT NOT NULL REFERENCES visits(id),
  line_id TEXT REFERENCES task_lines(id),
  kit_item_id TEXT REFERENCES visit_kit_items(id),
  packed_at TEXT NOT NULL,
  CHECK ((line_id IS NOT NULL) <> (kit_item_id IS NOT NULL)),
  UNIQUE (visit_id, line_id, kit_item_id)
);

-- ---------------------------------------------------------------- payments, notes, views, notifications
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  amount INTEGER NOT NULL,                            -- centavos
  paid_on TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('aab_otc', 'rco', 'online', 'other')),
  provider TEXT, reference_no TEXT,
  paid_by TEXT NOT NULL CHECK (paid_by IN ('client', 'operator')),
  reimbursement_status TEXT CHECK (reimbursement_status IN ('not_needed', 'waiting', 'reimbursed')),
  reimbursed_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_payments_client ON payments (org_id, client_id, paid_on);
CREATE INDEX idx_payments_task ON payments (org_id, task_id);

CREATE TABLE payment_proofs (
  payment_id TEXT NOT NULL REFERENCES payments(id),
  document_id TEXT NOT NULL REFERENCES documents(id),
  PRIMARY KEY (payment_id, document_id)
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  entity TEXT NOT NULL CHECK (entity IN ('client', 'task', 'visit')),
  entity_id TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id),              -- the target's client, for permission scoping
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  edited_at TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_notes_entity ON notes (org_id, entity, entity_id);

CREATE TABLE saved_views (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  page TEXT NOT NULL CHECK (page IN ('tasks', 'clients', 'documents', 'payments', 'follow_ups', 'audit')),
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_saved_views_user ON saved_views (org_id, user_id, page);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT NOT NULL,                                 -- always points at a record that exists
  entity TEXT, entity_id TEXT,
  client_id TEXT REFERENCES clients(id),              -- lets a helper's list drop links to unreachable clients
  read_at TEXT,
  pushed_at TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_notifications_user ON notifications (org_id, user_id, read_at);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (org_id, user_id);

-- ---------------------------------------------------------------- baseline, pulses
CREATE TABLE baselines (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) UNIQUE,    -- one self-reported baseline per organization
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  trips_per_month REAL,
  repeat_trips_per_month REAL,
  follow_ups_per_week REAL,
  hours_finding_per_week REAL,
  late_filings_per_quarter REAL,
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
  note TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE pulses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  month TEXT NOT NULL,                                -- '2026-10'
  hours_finding_last_week REAL,
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
  note TEXT,
  created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX idx_pulses_month ON pulses (org_id, month);

-- ---------------------------------------------------------------- activity (insert-only) and API bookkeeping
CREATE TABLE activity (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  client_id TEXT,                                     -- NULL for practice-wide events (the owner's)
  action TEXT NOT NULL,
  summary TEXT NOT NULL,                              -- plain sentence
  before_json TEXT,                                   -- never a revealed TIN or any secret
  after_json TEXT,
  reason TEXT,
  device TEXT
);
CREATE INDEX idx_activity_entity ON activity (org_id, entity, entity_id, at);
CREATE INDEX idx_activity_at ON activity (org_id, at);
CREATE INDEX idx_activity_client ON activity (org_id, client_id, at);
CREATE TRIGGER activity_no_update BEFORE UPDATE ON activity BEGIN SELECT RAISE(ABORT, 'activity is insert-only'); END;
CREATE TRIGGER activity_no_delete BEFORE DELETE ON activity BEGIN SELECT RAISE(ABORT, 'activity is insert-only'); END;

CREATE TABLE idempotency_keys (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,                           -- the retention job removes keys older than 7 days
  PRIMARY KEY (org_id, user_id, key)
);

-- ---------------------------------------------------------------- search (confirm FTS5 on D1 at build time)
-- Rows are written by the repository layer in the same batch as the change that they index.
CREATE VIRTUAL TABLE search_index USING fts5 (
  org_id UNINDEXED,
  entity UNINDEXED,
  entity_id UNINDEXED,
  client_id UNINDEXED,                                -- the helper filter is applied on this column
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);
