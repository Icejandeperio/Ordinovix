CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_account_user` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`at` text NOT NULL,
	`actor_id` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`client_id` text,
	`action` text NOT NULL,
	`summary` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text,
	`device` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_activity_entity` ON `activity` (`org_id`,`entity`,`entity_id`,`at`);--> statement-breakpoint
CREATE INDEX `idx_activity_at` ON `activity` (`org_id`,`at`);--> statement-breakpoint
CREATE INDEX `idx_activity_client` ON `activity` (`org_id`,`client_id`,`at`);--> statement-breakpoint
CREATE TABLE `authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`client_id` text NOT NULL,
	`type` text NOT NULL,
	`scope` text DEFAULT '[]' NOT NULL,
	`grantee_user_id` text NOT NULL,
	`issued_on` text NOT NULL,
	`valid_until` text,
	`notarized` integer DEFAULT false NOT NULL,
	`document_id` text,
	`replaced_by_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grantee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`replaced_by_id`) REFERENCES `authorizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_authorizations_type" CHECK("authorizations"."type" IN ('spa', 'authorization_letter', 'secretary_certificate', 'partnership_resolution', 'other'))
);
--> statement-breakpoint
CREATE INDEX `idx_authorizations_client` ON `authorizations` (`org_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `idx_authorizations_valid_until` ON `authorizations` (`org_id`,`valid_until`);--> statement-breakpoint
CREATE TABLE `baselines` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`trips_per_month` real,
	`repeat_trips_per_month` real,
	`follow_ups_per_week` real,
	`hours_finding_per_week` real,
	`late_filings_per_quarter` real,
	`confidence` integer,
	`note` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_baselines_confidence" CHECK("baselines"."confidence" IS NULL OR "baselines"."confidence" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `baselines_org_id_unique` ON `baselines` (`org_id`);--> statement-breakpoint
CREATE TABLE `client_assigned_users` (
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`client_id`, `user_id`),
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`code` text NOT NULL,
	`display_name` text NOT NULL,
	`registered_name` text,
	`entity_type` text NOT NULL,
	`has_tin` integer DEFAULT false NOT NULL,
	`tin_masked` text,
	`tin_encrypted` text,
	`tin_hash` text,
	`rdo_code` text NOT NULL,
	`rdo_office_id` text,
	`vat_status` text NOT NULL,
	`size_class` text NOT NULL,
	`filing_channel` text,
	`efps_group` text,
	`orus_enrolled` integer DEFAULT false NOT NULL,
	`access_holder` text NOT NULL,
	`uses_invoicing_software` integer DEFAULT false NOT NULL,
	`fiscal_year_end_month` integer DEFAULT 12 NOT NULL,
	`preferred_language` text DEFAULT 'en' NOT NULL,
	`delivery_preference` text,
	`address` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_reason` text,
	`import_batch_id` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rdo_office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_clients_entity_type" CHECK("clients"."entity_type" IN ('gpp', 'solo', 'other')),
	CONSTRAINT "chk_clients_vat_status" CHECK("clients"."vat_status" IN ('vat', 'non_vat_percentage', 'non_vat_8pct', 'unknown')),
	CONSTRAINT "chk_clients_size_class" CHECK("clients"."size_class" IN ('micro', 'small', 'medium', 'large', 'unknown')),
	CONSTRAINT "chk_clients_filing_channel" CHECK("clients"."filing_channel" IS NULL OR "clients"."filing_channel" IN ('efps', 'ebirforms', 'manual')),
	CONSTRAINT "chk_clients_efps_group" CHECK("clients"."efps_group" IS NULL OR "clients"."efps_group" IN ('A', 'B', 'C', 'D', 'E')),
	CONSTRAINT "chk_clients_access_holder" CHECK("clients"."access_holder" IN ('client', 'operator', 'other', 'unknown')),
	CONSTRAINT "chk_clients_language" CHECK("clients"."preferred_language" IN ('en', 'fil')),
	CONSTRAINT "chk_clients_status" CHECK("clients"."status" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE INDEX `idx_clients_org_status` ON `clients` (`org_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_clients_org_tin_hash` ON `clients` (`org_id`,`tin_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_clients_org_code` ON `clients` (`org_id`,`code`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`role` text,
	`phone_e164` text,
	`email` text,
	`preferred_channel` text DEFAULT 'viber' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`is_signatory` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_contacts_title" CHECK("contacts"."title" IS NULL OR "contacts"."title" IN ('Atty.', 'Mr.', 'Ms.')),
	CONSTRAINT "chk_contacts_channel" CHECK("contacts"."preferred_channel" IN ('viber', 'messenger', 'sms', 'email', 'phone', 'in_person')),
	CONSTRAINT "chk_contacts_language" CHECK("contacts"."language" IN ('en', 'fil'))
);
--> statement-breakpoint
CREATE INDEX `idx_contacts_client` ON `contacts` (`org_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `deadline_moves` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`template_id` text,
	`period` text NOT NULL,
	`new_due_date` text NOT NULL,
	`source_ref` text NOT NULL,
	`source_url` text,
	`note` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_deadline_moves_period` ON `deadline_moves` (`org_id`,`period`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`client_id` text NOT NULL,
	`task_id` text,
	`line_id` text,
	`visit_item_id` text,
	`payment_id` text,
	`authorization_id` text,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`original_size_bytes` integer NOT NULL,
	`compressed` integer DEFAULT false NOT NULL,
	`page_count` integer,
	`sha256` text NOT NULL,
	`storage_key` text NOT NULL,
	`thumbnail_key` text,
	`version_no` integer DEFAULT 1 NOT NULL,
	`replaces_id` text,
	`source` text NOT NULL,
	`retain_until` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`line_id`) REFERENCES `task_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`authorization_id`) REFERENCES `authorizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`replaces_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_documents_kind" CHECK("documents"."kind" IN ('source', 'filed_return', 'acknowledgment', 'payment_proof', 'stamped_copy', 'ecar', 'authorization', 'other')),
	CONSTRAINT "chk_documents_source" CHECK("documents"."source" IN ('upload', 'camera', 'import'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_client` ON `documents` (`org_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_sha` ON `documents` (`org_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `follow_up_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`follow_up_id` text NOT NULL,
	`attempt_no` integer NOT NULL,
	`channel` text NOT NULL,
	`sent_at` text NOT NULL,
	`sent_by` text NOT NULL,
	`message_snapshot` text NOT NULL,
	`expected_by` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`follow_up_id`) REFERENCES `follow_ups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sent_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_follow_up_attempts_fu` ON `follow_up_attempts` (`org_id`,`follow_up_id`);--> statement-breakpoint
CREATE INDEX `idx_follow_up_attempts_sent` ON `follow_up_attempts` (`org_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `follow_up_lines` (
	`follow_up_id` text NOT NULL,
	`line_id` text NOT NULL,
	PRIMARY KEY(`follow_up_id`, `line_id`),
	FOREIGN KEY (`follow_up_id`) REFERENCES `follow_ups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`line_id`) REFERENCES `task_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`client_id` text NOT NULL,
	`task_id` text,
	`contact_id` text,
	`channel` text NOT NULL,
	`language` text NOT NULL,
	`template_id` text,
	`expected_by` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`escalated_reason` text,
	`response` text,
	`responded_at` text,
	`resolved_at` text,
	`resolved_reason` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `message_templates`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_follow_ups_channel" CHECK("follow_ups"."channel" IN ('viber', 'messenger', 'sms', 'email', 'phone', 'in_person')),
	CONSTRAINT "chk_follow_ups_language" CHECK("follow_ups"."language" IN ('en', 'fil')),
	CONSTRAINT "chk_follow_ups_status" CHECK("follow_ups"."status" IN ('open', 'sent', 'answered', 'escalated', 'resolved'))
);
--> statement-breakpoint
CREATE INDEX `idx_follow_ups_status` ON `follow_ups` (`org_id`,`status`,`expected_by`);--> statement-breakpoint
CREATE INDEX `idx_follow_ups_client` ON `follow_ups` (`org_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`source_ref` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_holidays_type" CHECK("holidays"."type" IN ('regular', 'special_non_working', 'local', 'office_closure'))
);
--> statement-breakpoint
CREATE INDEX `idx_holidays_date` ON `holidays` (`org_id`,`date`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`status` integer NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`org_id`, `user_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`total_rows` integer NOT NULL,
	`created_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`undone_at` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `line_documents` (
	`line_id` text NOT NULL,
	`document_id` text NOT NULL,
	PRIMARY KEY(`line_id`, `document_id`),
	FOREIGN KEY (`line_id`) REFERENCES `task_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `membership_clients` (
	`membership_id` text NOT NULL,
	`client_id` text NOT NULL,
	PRIMARY KEY(`membership_id`, `client_id`),
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_membership_clients_client` ON `membership_clients` (`client_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`invited_at` text NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_memberships_role" CHECK("memberships"."role" IN ('owner', 'helper'))
);
--> statement-breakpoint
CREATE INDEX `idx_memberships_user` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_memberships_org_email` ON `memberships` (`org_id`,`email`);--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`language` text NOT NULL,
	`purpose` text NOT NULL,
	`body` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_message_templates_language" CHECK("message_templates"."language" IN ('en', 'fil')),
	CONSTRAINT "chk_message_templates_purpose" CHECK("message_templates"."purpose" IN ('first_request', 'reminder', 'correction', 'outcome_update', 'other'))
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`client_id` text,
	`body` text NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`edited_at` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_notes_entity" CHECK("notes"."entity" IN ('client', 'task', 'visit'))
);
--> statement-breakpoint
CREATE INDEX `idx_notes_entity` ON `notes` (`org_id`,`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`link` text NOT NULL,
	`entity` text,
	`entity_id` text,
	`client_id` text,
	`read_at` text,
	`pushed_at` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`org_id`,`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `offices` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`rdo_code` text,
	`address` text,
	`map_url` text,
	`hours` text,
	`phone_e164` text,
	`tips` text,
	`is_sample` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_offices_type" CHECK("offices"."type" IN ('rdo', 'bank', 'lgu', 'sec', 'client_office', 'other'))
);
--> statement-breakpoint
CREATE INDEX `idx_offices_org` ON `offices` (`org_id`,`type`);--> statement-breakpoint
CREATE TABLE `org_settings` (
	`org_id` text PRIMARY KEY NOT NULL,
	`practice_name` text NOT NULL,
	`operator_display_name` text NOT NULL,
	`mobile_e164` text,
	`accreditation_number` text,
	`accreditation_valid_until` text,
	`due_soon_days` integer DEFAULT 7 NOT NULL,
	`follow_up_wait_days` integer DEFAULT 3 NOT NULL,
	`auth_warn_days` integer DEFAULT 30 NOT NULL,
	`helpers_can_accept` integer DEFAULT true NOT NULL,
	`idle_lock_minutes` integer DEFAULT 15 NOT NULL,
	`quiet_hours_start` text DEFAULT '20:00' NOT NULL,
	`quiet_hours_end` text DEFAULT '07:00' NOT NULL,
	`digest_time` text DEFAULT '07:00' NOT NULL,
	`paper_size` text DEFAULT 'long' NOT NULL,
	`week_starts_on` integer DEFAULT 0 NOT NULL,
	`retention_years` integer DEFAULT 5 NOT NULL,
	`support_contact` text,
	`onboarding_done` text DEFAULT '[]' NOT NULL,
	`onboarding_dismissed` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_org_settings_idle_lock" CHECK("org_settings"."idle_lock_minutes" IN (0, 5, 15, 30)),
	CONSTRAINT "chk_org_settings_paper_size" CHECK("org_settings"."paper_size" IN ('a4', 'letter', 'long')),
	CONSTRAINT "chk_org_settings_week_starts_on" CHECK("org_settings"."week_starts_on" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_proofs` (
	`payment_id` text NOT NULL,
	`document_id` text NOT NULL,
	PRIMARY KEY(`payment_id`, `document_id`),
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`client_id` text NOT NULL,
	`task_id` text NOT NULL,
	`amount` integer NOT NULL,
	`paid_on` text NOT NULL,
	`channel` text NOT NULL,
	`provider` text,
	`reference_no` text,
	`paid_by` text NOT NULL,
	`reimbursement_status` text,
	`reimbursed_on` text,
	`note` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_payments_channel" CHECK("payments"."channel" IN ('aab_otc', 'rco', 'online', 'other')),
	CONSTRAINT "chk_payments_paid_by" CHECK("payments"."paid_by" IN ('client', 'operator')),
	CONSTRAINT "chk_payments_reimbursement" CHECK("payments"."reimbursement_status" IS NULL OR "payments"."reimbursement_status" IN ('not_needed', 'waiting', 'reimbursed'))
);
--> statement-breakpoint
CREATE INDEX `idx_payments_client` ON `payments` (`org_id`,`client_id`,`paid_on`);--> statement-breakpoint
CREATE INDEX `idx_payments_task` ON `payments` (`org_id`,`task_id`);--> statement-breakpoint
CREATE TABLE `pulses` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`month` text NOT NULL,
	`hours_finding_last_week` real,
	`confidence` integer,
	`note` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_pulses_confidence" CHECK("pulses"."confidence" IS NULL OR "pulses"."confidence" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX `idx_pulses_month` ON `pulses` (`org_id`,`month`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_user` ON `push_subscriptions` (`org_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `requirement_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`task_template_id` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`required` integer DEFAULT true NOT NULL,
	`copy_form` text NOT NULL,
	`copies` integer,
	`supplied_by` text NOT NULL,
	`validity_days` integer,
	`sort_order` integer NOT NULL,
	`source_ref` text,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_requirement_templates_copy_form" CHECK("requirement_templates"."copy_form" IN ('original', 'certified_true_copy', 'photocopy', 'digital')),
	CONSTRAINT "chk_requirement_templates_supplied_by" CHECK("requirement_templates"."supplied_by" IN ('client', 'operator', 'third_party'))
);
--> statement-breakpoint
CREATE INDEX `idx_requirement_templates_task` ON `requirement_templates` (`org_id`,`task_template_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`page` text NOT NULL,
	`name` text NOT NULL,
	`query` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_saved_views_page" CHECK("saved_views"."page" IN ('tasks', 'clients', 'documents', 'payments', 'follow_ups', 'audit'))
);
--> statement-breakpoint
CREATE INDEX `idx_saved_views_user` ON `saved_views` (`org_id`,`user_id`,`page`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `task_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`task_id` text NOT NULL,
	`client_id` text NOT NULL,
	`requirement_template_id` text,
	`label` text NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`copy_form` text NOT NULL,
	`copies` integer,
	`supplied_by` text NOT NULL,
	`print_and_bring` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`sort_order` integer NOT NULL,
	`needed_by` text,
	`requested_at` text,
	`received_at` text,
	`received_via` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_note` text,
	`flag_note` text,
	`na_reason` text,
	`late_discovered` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requirement_template_id`) REFERENCES `requirement_templates`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_task_lines_copy_form" CHECK("task_lines"."copy_form" IN ('original', 'certified_true_copy', 'photocopy', 'digital')),
	CONSTRAINT "chk_task_lines_supplied_by" CHECK("task_lines"."supplied_by" IN ('client', 'operator', 'third_party')),
	CONSTRAINT "chk_task_lines_status" CHECK("task_lines"."status" IN ('not_requested', 'requested', 'received', 'under_review', 'accepted', 'incomplete', 'needs_correction', 'not_applicable'))
);
--> statement-breakpoint
CREATE INDEX `idx_task_lines_task` ON `task_lines` (`org_id`,`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_lines_status` ON `task_lines` (`org_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_task_lines_client` ON `task_lines` (`org_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `task_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`frequency` text NOT NULL,
	`applies_to` text DEFAULT '{}' NOT NULL,
	`office_action` integer DEFAULT false NOT NULL,
	`default_office_type` text,
	`default_action` text,
	`payment_expected` integer DEFAULT false NOT NULL,
	`default_due_kind` text,
	`default_due_value` integer,
	`description` text,
	`source_ref` text,
	`source_url` text,
	`verified` integer DEFAULT false NOT NULL,
	`verified_on` text,
	`verified_by` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_task_templates_kind" CHECK("task_templates"."kind" IN ('filing', 'payment', 'registration', 'one_time_transaction', 'lgu', 'other')),
	CONSTRAINT "chk_task_templates_frequency" CHECK("task_templates"."frequency" IN ('monthly', 'quarterly', 'annual', 'one_off')),
	CONSTRAINT "chk_task_templates_due_kind" CHECK("task_templates"."default_due_kind" IS NULL OR "task_templates"."default_due_kind" IN ('day_of_next_month', 'days_after_period_end')),
	CONSTRAINT "chk_task_templates_verified_source" CHECK("task_templates"."verified" = 0 OR "task_templates"."source_ref" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_task_templates_org_code` ON `task_templates` (`org_id`,`code`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`client_id` text NOT NULL,
	`template_id` text,
	`title` text,
	`kind` text NOT NULL,
	`period` text,
	`transaction_date` text,
	`due_date` text NOT NULL,
	`due_source_kind` text NOT NULL,
	`due_source_ref` text,
	`due_source_url` text,
	`channel` text,
	`owner_user_id` text NOT NULL,
	`office_action` integer DEFAULT false NOT NULL,
	`payment_expected` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`override_status` text,
	`override_reason` text,
	`override_by` text,
	`override_at` text,
	`next_action_text` text,
	`next_action_owner` text,
	`next_action_due` text,
	`ready_at` text,
	`submitted_at` text,
	`submitted_via` text,
	`submission_ref` text,
	`completed_at` text,
	`completion_no_evidence_reason` text,
	`archived_reason` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_tasks_kind" CHECK("tasks"."kind" IN ('filing', 'payment', 'registration', 'one_time_transaction', 'lgu', 'other')),
	CONSTRAINT "chk_tasks_due_source_kind" CHECK("tasks"."due_source_kind" IN ('template', 'deadline_move', 'override', 'manual')),
	CONSTRAINT "chk_tasks_channel" CHECK("tasks"."channel" IS NULL OR "tasks"."channel" IN ('efps', 'ebirforms', 'manual')),
	CONSTRAINT "chk_tasks_next_action_owner" CHECK("tasks"."next_action_owner" IS NULL OR "tasks"."next_action_owner" IN ('client', 'operator', 'third_party'))
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_client_status` ON `tasks` (`org_id`,`client_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due` ON `tasks` (`org_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_tasks_owner` ON `tasks` (`org_id`,`owner_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tasks_open_period` ON `tasks` (`org_id`,`client_id`,`template_id`,`period`) WHERE "tasks"."deleted_at" IS NULL AND "tasks"."template_id" IS NOT NULL AND "tasks"."period" IS NOT NULL AND "tasks"."status" NOT IN ('completed', 'archived');--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`density` text DEFAULT 'comfortable' NOT NULL,
	`text_scale` real DEFAULT 1 NOT NULL,
	`reduce_motion` integer,
	`date_order` text DEFAULT 'mdy' NOT NULL,
	`privacy_mode_on_start` integer DEFAULT false NOT NULL,
	`today_scope` text DEFAULT 'mine' NOT NULL,
	`push_types` text DEFAULT '[]' NOT NULL,
	`table_columns` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_user_prefs_theme" CHECK("user_prefs"."theme" IN ('system', 'light', 'dark')),
	CONSTRAINT "chk_user_prefs_density" CHECK("user_prefs"."density" IN ('comfortable', 'compact')),
	CONSTRAINT "chk_user_prefs_date_order" CHECK("user_prefs"."date_order" IN ('mdy', 'dmy')),
	CONSTRAINT "chk_user_prefs_today_scope" CHECK("user_prefs"."today_scope" IN ('mine', 'everyone'))
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`email` text NOT NULL,
	`initials` text NOT NULL,
	`mobile_e164` text,
	`last_sign_in_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_verification_identifier` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `visit_item_evidence` (
	`visit_item_id` text NOT NULL,
	`document_id` text NOT NULL,
	PRIMARY KEY(`visit_item_id`, `document_id`),
	FOREIGN KEY (`visit_item_id`) REFERENCES `visit_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visit_items` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`task_id` text NOT NULL,
	`client_id` text NOT NULL,
	`intended_action` text NOT NULL,
	`questions` text,
	`ready_at_departure` integer,
	`is_first_visit_for_task` integer DEFAULT false NOT NULL,
	`outcome` text,
	`outcome_cause` text,
	`avoidable` integer,
	`outcome_note` text,
	`window_or_officer` text,
	`next_action_text` text,
	`next_action_owner` text,
	`next_action_due` text,
	`outcome_at` text,
	`recorded_by` text,
	`follow_up_id` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`follow_up_id`) REFERENCES `follow_ups`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_visit_items_action" CHECK("visit_items"."intended_action" IN ('submit', 'pay', 'claim', 'inquire', 'follow_up')),
	CONSTRAINT "chk_visit_items_outcome" CHECK("visit_items"."outcome" IS NULL OR "visit_items"."outcome" IN ('completed', 'submitted_pending', 'paid_proof_pending', 'more_documents_requested', 'correction_required', 'not_accepted', 'follow_up_required'))
);
--> statement-breakpoint
CREATE INDEX `idx_visit_items_visit` ON `visit_items` (`org_id`,`visit_id`);--> statement-breakpoint
CREATE INDEX `idx_visit_items_client` ON `visit_items` (`org_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `idx_visit_items_task` ON `visit_items` (`org_id`,`task_id`);--> statement-breakpoint
CREATE TABLE `visit_kit_items` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`label` text NOT NULL,
	`note` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visit_packed` (
	`visit_id` text NOT NULL,
	`line_id` text,
	`kit_item_id` text,
	`packed_at` text NOT NULL,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`line_id`) REFERENCES `task_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kit_item_id`) REFERENCES `visit_kit_items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_visit_packed_one_target" CHECK(("visit_packed"."line_id" IS NOT NULL) <> ("visit_packed"."kit_item_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_visit_packed` ON `visit_packed` (`visit_id`,`line_id`,`kit_item_id`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`office_id` text,
	`office_type` text NOT NULL,
	`office_name` text NOT NULL,
	`rdo_code` text,
	`planned_date` text NOT NULL,
	`arrive_by` text,
	`assignee_user_id` text NOT NULL,
	`purpose` text,
	`status` text NOT NULL,
	`started_at` text,
	`departure_override_reason` text,
	`finished_at` text,
	`cost_transport` integer,
	`cost_parking` integer,
	`cost_other` integer,
	`cost_note` text,
	`cancelled_reason` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	`deleted_reason` text,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`office_id`) REFERENCES `offices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_visits_status" CHECK("visits"."status" IN ('planned', 'in_progress', 'done', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_visits_planned` ON `visits` (`org_id`,`planned_date`);--> statement-breakpoint
CREATE INDEX `idx_visits_assignee` ON `visits` (`org_id`,`assignee_user_id`);