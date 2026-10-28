# Ordinovix backend plan

Status: plan only. Nothing here has been built, deployed or applied. No Cloudflare, Wrangler or Google OAuth command has been run, and no account has been created. The owner decisions and accounts this plan needs are at the end of this file and in `docs/state/QUEUE.md`.

Sources: `Inspirations/Ordinovix_Build_Spec_v2.md` section 21 (backend and hosting handoff), section 19.3 (offline writes), the `Repositories` contract in `src/data/repositories.ts`, and the rules the mock already enforces in `src/domain/policy.ts` and `src/data/mock/index.ts`. Where they disagree, the spec wins; differences found while writing this plan are listed in section 11.

## 1. What gets built

- One repository, one Vite project with the Cloudflare Vite plugin. `vite dev` runs the React app and the Worker API together.
- API: Hono on Workers under `/api/v1/*`, one route group per repository namespace. Request and response bodies are validated with the zod schemas in `src/domain/schemas.ts`, the same ones the mock already applies at the repository boundary.
- Data: D1 with Drizzle ORM (`drizzle-kit generate`, then migrations applied from CI or by the owner's approved command). The draft schema is `docs/backend/schema-draft.sql`.
- Files: R2 through a Worker binding; the bucket is never public.
- Auth: Better Auth with the Drizzle adapter and the Google provider only.
- The frontend switches by setting `VITE_DATA_SOURCE=api`. The API implementation of `Repositories` is a thin `fetch` client; no screen changes. The offline queue (U17) already sends each queued write with an idempotency key, so it works unchanged against the API.
- Shared code the Worker imports unchanged: `src/domain/rules.ts`, `policy.ts`, `metrics.ts`, `schemas.ts`, `errors.ts`, `types.ts`. The mock and the API must enforce exactly the same rules.

## 2. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1`. Routes mirror the repository: namespace, id, then an action verb for state changes (`POST /tasks/:id/submit`). |
| Auth | Session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, same origin), rolling 30 days. No allowlisted membership: every call returns `403 ACCESS_PENDING`. |
| Request context | Middleware loads the active membership on every request and injects `orgId`, `role`, `clientIds`. A revoked membership (`active = 0`) is treated as no membership for client data. |
| Writes | `Idempotency-Key` header (UUIDv7, stored 7 days in `idempotency_keys`; a repeated key returns the first response and applies nothing). `If-Match: <version>` on updates; a stale version returns `409 VERSION_CONFLICT` with the current record. |
| Errors | `{ "error": { "code", "message", "fields" } }`. Codes match the typed errors in `src/domain/errors.ts`: `VALIDATION` (422), `FORBIDDEN` (403), `NOT_FOUND` (404), `RULE_VIOLATION` (409), `VERSION_CONFLICT` (409), `ACCESS_PENDING` (403), `RATE_LIMITED` (429). |
| Lists | Cursor pagination, `limit` at most 100. |
| Batches | `openPeriod`, `recordOutcome`, `markCompleted`, `importCommit` and every write that also logs activity run in one `db.batch` so a partial write cannot happen. Inserts are chunked to D1's 100 bound parameters per statement. |
| Activity | Every write inserts one `activity` row in the same batch. Never store a revealed TIN or any secret in `before` / `after`. |
| Soft delete | `deleted_at`, `deleted_reason`; nothing is removed except by the retention job. |
| Dates and money | `YYYY-MM-DD` text and ISO 8601 timestamps with `+08:00`; money as integer centavos. |
| Rate limit | Per user, for example 600 requests per 10 minutes, to protect the free daily allowance. |

## 3. Permission rules

These are the rule codes used in the route table. Each one already exists as a pure function the Worker reuses.

| Code | Rule | Source |
|---|---|---|
| M | An active membership (owner or helper). | `PolicyActor.active` |
| O | Owner only. | `requireOwner` |
| C | The record's own client is reachable: the owner reaches every client, a helper only clients in `membership_clients`, a revoked membership none. Checked against the stored record's client, never only the one the caller supplies. | `canAccessClient`, `requireClientAccess` |
| V | The visit is reachable: the owner always; a helper if assigned to it or it holds an item for an assigned client. | `canReachVisit` |
| F | A list or aggregate filtered to what the caller reaches (`client_id IN membership_clients`, or `canReachVisit`). Counts, search, calendar, Insights and notifications use the same filter. | `scopedInsightData`, `isVisitListable` |
| R | May review lines: the owner always; a helper only while `org_settings.helpers_can_accept`. | `canReviewLines` |
| A | A helper may send only the fields on the allowlist for that method; every other field is `403 FORBIDDEN`. The owner is not restricted. | `HELPER_FIELDS` |
| U | Own data only (the signed-in user's rows). | |
| X | References in the body (`*Id`, `*Ids`) are checked: each must exist, be reachable and belong to the same client as the record; the stored `clientId`, `taskId`, `visitId` and `id` cannot change. | `assertReferences`, `rejectIdentityChange` |

A visit whose items all belong to unassigned clients is not listed for a helper (it would read "0 of 0 ready"): `isVisitListable`.

## 4. Route map

One row per `Repositories` method. The Tables column uses the names in `schema-draft.sql`; `activity` is written by every write and is left out of the column except where it is the subject.

### 4.1 Session, settings, people

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `session.me` | GET `/api/v1/session` | M (S: also answers for a revoked or pending user so the app can show `/access-pending`) | users, memberships, orgs, org_settings, user_prefs | Returns user, membership, org, settings, prefs in one call. |
| `session.signOut` | POST `/api/auth/sign-out` | U | sessions (Better Auth) | "Sign out everywhere" deletes all of the user's sessions; the client clears caches and the offline queue after warning when it is not empty. |
| `prefs.save` | PUT `/api/v1/prefs` | U | user_prefs | None. |
| `settings.save` | PUT `/api/v1/settings` | O | org_settings | Includes first-run `onboarding` progress. |
| `memberships.list` | GET `/api/v1/memberships` | O | memberships, membership_clients, users | None. |
| `memberships.invite` | POST `/api/v1/memberships` | O | memberships, membership_clients | Email is the allowlist key; first sign-in links `user_id`. |
| `memberships.update` | PATCH `/api/v1/memberships/:id` | O | memberships, membership_clients | Role, assigned clients, active. |
| `memberships.revoke` | POST `/api/v1/memberships/:id/revoke` | O | memberships | Sets `revoked_at`, `active = 0`; sessions of that user are deleted. |

### 4.2 Today, calendar, search, insights

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `today.queue` | GET `/api/v1/today?scope=mine\|everyone` | M, F | tasks, task_lines, clients, documents, follow_ups, follow_up_attempts, visits, visit_items, authorizations, activity | Page-level read: one endpoint, batched queries (under 50 per request). Statistics use the same scoped data as Insights. |
| `calendar.range` | GET `/api/v1/calendar?from=&to=` | M, F | tasks, visits, visit_items, follow_ups, authorizations, holidays | A revoked membership gets an empty list. |
| `search.query` | GET `/api/v1/search?q=` | M, F | search_index (FTS5), clients, tasks, documents, visits, follow_ups, payments, offices | Falls back to `LIKE` on indexed columns if FTS5 is unavailable on D1. |
| `insights.get` | GET `/api/v1/insights/:tab?from=&to=&clientId=&assignedUserId=&templateId=` | M, F | tasks, task_lines, visits, visit_items, follow_ups, follow_up_attempts, deadline_moves, pulses, baselines, task_templates, clients | Runs `computeInsights` from `src/domain/metrics.ts` over the scoped rows (the same function the mock calls). |
| `baseline.get` | GET `/api/v1/baseline` | M | baselines | None. |
| `baseline.save` | PUT `/api/v1/baseline` | O | baselines | None. |
| `pulses.list` | GET `/api/v1/pulses` | M | pulses | None. |
| `pulses.save` | POST `/api/v1/pulses` | O | pulses | None. |

### 4.3 Clients, contacts, authorizations

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `clients.list` | GET `/api/v1/clients` | M, F | clients, client_assigned_users, tasks, task_lines, authorizations | Filters as in `Repositories`; summary counts in one batch. |
| `clients.get` | GET `/api/v1/clients/:id` | C | clients, client_assigned_users, tasks, task_lines, authorizations | Returns the masked TIN only. |
| `clients.upsert` | POST `/api/v1/clients` and PATCH `/api/v1/clients/:id` | create: O; update: C, A, X | clients, client_assigned_users | Full TIN is encrypted with the application key (AES-GCM) into `tin_encrypted`; `tin_masked` is stored for display. |
| `clients.archive` | POST `/api/v1/clients/:id/archive` | C | clients | Needs a reason; soft only. |
| `clients.restore` | POST `/api/v1/clients/:id/restore` | C | clients | Needs a reason. |
| `clients.revealTin` | POST `/api/v1/clients/:id/reveal-tin` | C | clients, activity | Decrypts server-side, logs a `tin_revealed` event without the value, returns the value once. |
| `clients.findDuplicates` | POST `/api/v1/clients/duplicates` | O | clients | By code, TIN hash or name. |
| `clients.importPreview` | POST `/api/v1/clients/import/preview` | O | import_batches | Validates rows; nothing written to `clients`. |
| `clients.importCommit` | POST `/api/v1/clients/import/commit` | O | clients, import_batches | One batch; returns the batch id. |
| `clients.importUndo` | POST `/api/v1/clients/import/:batchId/undo` | O | clients, import_batches | Soft-deletes the batch's clients. |
| `contacts.listByClient` | GET `/api/v1/clients/:clientId/contacts` | C | contacts | None. |
| `contacts.upsert` | POST `/api/v1/contacts` and PATCH `/api/v1/contacts/:id` | C, A, X | contacts | `client_id` cannot change. |
| `contacts.remove` | DELETE `/api/v1/contacts/:id` | C | contacts | Needs a reason; soft only. |
| `authorizations.listByClient` | GET `/api/v1/clients/:clientId/authorizations` | C | authorizations | None. |
| `authorizations.upsert` | POST `/api/v1/authorizations` and PATCH `/api/v1/authorizations/:id` | C, A, X | authorizations | `client_id` cannot change. |
| `authorizations.replace` | POST `/api/v1/authorizations/:id/replace` | C | authorizations | New row; the old one gets `replaced_by_id`. |

### 4.4 Templates, deadlines, holidays, messages

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `templates.list` | GET `/api/v1/templates?active=` | M | task_templates | Practice configuration, not client data. |
| `templates.get` | GET `/api/v1/templates/:id` | M | task_templates, requirement_templates | None. |
| `templates.save` | PUT `/api/v1/templates/:id` and POST `/api/v1/templates` | O | task_templates, requirement_templates | Replaces the requirement lines only when `lines` is sent. |
| `templates.markVerified` | POST `/api/v1/templates/:id/verify` | O | task_templates | Source reference required; a template is never shown as verified without it. |
| `deadlineMoves.list` | GET `/api/v1/deadline-moves` | M | deadline_moves | None. |
| `deadlineMoves.unreadCount` | GET `/api/v1/deadline-moves/unread-count` | M, U | deadline_moves | In the interface; the mock does not implement it yet (section 11). |
| `deadlineMoves.save` | POST `/api/v1/deadline-moves` | O | deadline_moves, tasks | `applyToOpenTasks` updates matching open tasks in the same batch and returns their ids. |
| `deadlineMoves.remove` | DELETE `/api/v1/deadline-moves/:id` | O | deadline_moves | Needs a reason. |
| `holidays.list` | GET `/api/v1/holidays?year=` | M | holidays | None. |
| `holidays.save` | POST `/api/v1/holidays` | O | holidays | None. |
| `holidays.remove` | DELETE `/api/v1/holidays/:id` | O | holidays | None. |
| `messages.list` | GET `/api/v1/messages` | M | message_templates | None. |
| `messages.save` | PUT `/api/v1/messages/:id` and POST `/api/v1/messages` | O | message_templates | None. |

### 4.5 Tasks and lines

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `tasks.list` | GET `/api/v1/tasks` | M, F | tasks, task_lines, clients, visits, visit_items | None. |
| `tasks.board` | GET `/api/v1/tasks/board` | M, F | tasks, task_lines, clients | None. |
| `tasks.get` | GET `/api/v1/tasks/:id` | C | tasks, task_lines, line_documents, documents, notes, follow_ups, payments, visit_items | Page-level read. |
| `tasks.create` | POST `/api/v1/tasks` | C, A, X | tasks, task_lines | Task and lines in one batch. |
| `tasks.update` | PATCH `/api/v1/tasks/:id` | C, A, X | tasks | None. |
| `tasks.setStatus` | POST `/api/v1/tasks/:id/status` | C | tasks | Operator-set transitions only (`rules.ts`); a blocked task changes status only through `override`. |
| `tasks.markSubmitted` | POST `/api/v1/tasks/:id/submit` | C | tasks, documents | None. |
| `tasks.markCompleted` | POST `/api/v1/tasks/:id/complete` | C | tasks | One batch; needs evidence or a reason. |
| `tasks.override` | POST `/api/v1/tasks/:id/override` | O | tasks | Reason required. |
| `tasks.clearOverride` | POST `/api/v1/tasks/:id/clear-override` | O | tasks | Reason required. |
| `tasks.changeDue` | POST `/api/v1/tasks/:id/due` | O | tasks | Reference and reason required. |
| `tasks.setNextAction` | PUT `/api/v1/tasks/:id/next-action` | C | tasks | None. |
| `tasks.archive` | POST `/api/v1/tasks/:id/archive` | C | tasks | Reason required. |
| `tasks.restore` | POST `/api/v1/tasks/:id/restore` | C | tasks | Reason required. |
| `tasks.duplicateForNextPeriod` | POST `/api/v1/tasks/:id/duplicate` | C | tasks, task_lines | None. |
| `tasks.previewOpenPeriod` | POST `/api/v1/tasks/open-period/preview` | O | clients, task_templates, tasks | Writes nothing. |
| `tasks.openPeriod` | POST `/api/v1/tasks/open-period` | O | tasks, task_lines | One batch, chunked inserts; idempotent per client, template and period. |
| `lines.setStatus` | POST `/api/v1/lines/:id/status` | C, R | task_lines, tasks | Received is not accepted: only an explicit review accepts. Queueable offline. |
| `lines.addAdHoc` | POST `/api/v1/tasks/:taskId/lines` | C, A, X | task_lines | None. |
| `lines.update` | PATCH `/api/v1/lines/:id` | C, A, X | task_lines | None. |
| `lines.reorder` | PUT `/api/v1/tasks/:taskId/lines/order` | C | task_lines | None. |
| `lines.history` | GET `/api/v1/lines/:id/history` | C | activity | None. |

### 4.6 Documents and files

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `documents.list` | GET `/api/v1/documents` | M, F | documents, clients | None. |
| `documents.upload` | POST `/api/v1/documents` (multipart) | C, A, X | documents, line_documents, R2 | Type by magic bytes, size at most 15 MB; the display name follows spec 9.9; the client compresses images first. |
| `documents.replace` | POST `/api/v1/documents/:id/replace` (multipart) | C | documents, R2 | New version row and new object key; keys are never reused. |
| `documents.update` | PATCH `/api/v1/documents/:id` | C, A, X | documents, line_documents | None. |
| `documents.remove` | DELETE `/api/v1/documents/:id` | C | documents | Reason required; the object stays in R2 until the retention job. |
| `documents.getUrl` | GET `/api/v1/files/:id?purpose=view\|download\|thumb` | C | documents, activity, R2 | Logs the event; returns a 5-minute HMAC-signed URL for `<img>` tags or streams with `Cache-Control: private, max-age=0`. |
| `documents.findBySha` | GET `/api/v1/documents/by-sha?sha256=&clientId=` | C | documents | Duplicate check. |

### 4.7 Follow-ups

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `followUps.list` | GET `/api/v1/follow-ups` | M, F | follow_ups, follow_up_lines, follow_up_attempts, clients, task_lines | State (due, overdue, waiting) is derived in the query. |
| `followUps.get` | GET `/api/v1/follow-ups/:id` | C | follow_ups, follow_up_lines, follow_up_attempts, contacts | None. |
| `followUps.create` | POST `/api/v1/follow-ups` | C, A, X | follow_ups, follow_up_lines | None. |
| `followUps.markSent` | POST `/api/v1/follow-ups/:id/sent` | C | follow_ups, follow_up_attempts | None. |
| `followUps.logResponse` | POST `/api/v1/follow-ups/:id/response` | C, X | follow_ups, task_lines | Every received line must belong to the follow-up's own client; one batch. |
| `followUps.escalate` | POST `/api/v1/follow-ups/:id/escalate` | C | follow_ups | Reason required. |
| `followUps.resolve` | POST `/api/v1/follow-ups/:id/resolve` | C | follow_ups | None. |

### 4.8 Offices and visits

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `offices.list` | GET `/api/v1/offices` | M | offices | Practice-wide reference data. |
| `offices.get` | GET `/api/v1/offices/:id` | M, F | offices, visits, visit_items | Statistics cover only the visits and clients the caller reaches. |
| `offices.save` | PUT `/api/v1/offices/:id` and POST `/api/v1/offices` | O | offices | None. |
| `visits.list` | GET `/api/v1/visits` | M, V, F | visits, visit_items | None. |
| `visits.get` | GET `/api/v1/visits/:id` | V | visits, visit_items, visit_packed, visit_kit_items, task_lines, documents | Page-level read; items of unassigned clients are hidden from a helper. |
| `visits.create` | POST `/api/v1/visits` | C (every item's task), A, X | visits, visit_items | None. |
| `visits.update` | PATCH `/api/v1/visits/:id` | V, A, X | visits | None. |
| `visits.suggestTasks` | GET `/api/v1/visits/:id/suggestions` | V, F | tasks | None. |
| `visits.addItem` | POST `/api/v1/visits/:id/items` | V, C | visit_items | None. |
| `visits.updateItem` | PATCH `/api/v1/visits/:id/items/:itemId` | V, C, A | visit_items | None. |
| `visits.removeItem` | DELETE `/api/v1/visits/:id/items/:itemId` | V, C | visit_items | None. |
| `visits.setPacked` | PUT `/api/v1/visits/:id/packed` | V, C | visit_packed | Queueable offline. |
| `visits.start` | POST `/api/v1/visits/:id/start` | V | visits | Leaving not ready needs a reason. |
| `visits.recordOutcome` | POST `/api/v1/visits/:id/items/:itemId/outcome` | V, C, R (when it flags lines), X | visit_items, visit_item_evidence, tasks, task_lines, follow_ups | One batch applies the outcome mapping (spec 16.6). Affected lines and evidence documents must belong to the item's client. Queueable offline. |
| `visits.finish` | POST `/api/v1/visits/:id/finish` | V | visits | Every item must have a saved outcome. |
| `visits.cancel` | POST `/api/v1/visits/:id/cancel` | V | visits | Reason required. |
| `visitKit.list` | GET `/api/v1/visit-kit` | M | visit_kit_items | None. |
| `visitKit.save` | PUT `/api/v1/visit-kit/:id` and POST `/api/v1/visit-kit` | O | visit_kit_items | None. |

### 4.9 Payments, notes, saved views, notifications, push

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `payments.list` | GET `/api/v1/payments` | M, F | payments, payment_proofs | None. |
| `payments.save` | POST `/api/v1/payments` and PATCH `/api/v1/payments/:id` | C, A, X | payments, payment_proofs | Proof documents are checked against the stored payment's client; `client_id` cannot change. |
| `payments.remove` | DELETE `/api/v1/payments/:id` | C | payments | Reason required. |
| `notes.list` | GET `/api/v1/notes?entity=&entityId=` | C (the target's client) | notes | None. |
| `notes.save` | POST `/api/v1/notes` and PATCH `/api/v1/notes/:id` | C, A | notes | Queueable offline. |
| `savedViews.list` | GET `/api/v1/saved-views?page=` | U | saved_views | Shared views of other users are listed read-only. |
| `savedViews.save` | PUT `/api/v1/saved-views/:id` and POST `/api/v1/saved-views` | U | saved_views | None. |
| `savedViews.remove` | DELETE `/api/v1/saved-views/:id` | U | saved_views | None. |
| `notifications.list` | GET `/api/v1/notifications` | U, F | notifications | Links pointing at an unreachable record are dropped for a helper. |
| `notifications.markRead` | POST `/api/v1/notifications/read` | U | notifications | `ids` or `all`. |
| `notifications.unreadCount` | GET `/api/v1/notifications/unread-count` | U | notifications | None. |
| `push.subscribe` | POST `/api/v1/push/subscriptions` | U | push_subscriptions | Asked only after a tap on "Turn on reminders". |
| `push.unsubscribe` | DELETE `/api/v1/push/subscriptions?endpoint=` | U | push_subscriptions | None. |
| `push.test` | POST `/api/v1/push/test` | U | push_subscriptions | None. |

### 4.10 Reports, activity

| Method | Route | Permission | Tables | Notes |
|---|---|---|---|---|
| `reports.clientChecklist` | GET `/api/v1/reports/client-checklist/:clientId` | C | clients, tasks, task_lines | None. |
| `reports.clientHistory` | GET `/api/v1/reports/client-history/:clientId?year=` | C | clients, tasks, payments | None. |
| `reports.monthlySummary` | GET `/api/v1/reports/monthly-summary?month=` | O | tasks, visits, visit_items, payments | None. |
| `reports.exportCsv` | GET `/api/v1/reports/export/:entity.csv` | O | by entity | UTF-8 with a byte order mark. Logged as an `exported` event. |
| `reports.fullBackup` | GET `/api/v1/reports/backup` | O | all | JSON of every table except secrets and encrypted TINs; logged. |
| `activity.list` | GET `/api/v1/activity` | owner: all; helper: C on `clientId` or reachable `entityId` | activity | Practice-wide events (no client) are the owner's. A revoked membership gets `403`. Insert-only table. |

## 5. Page-level reads

Today, the task page, the visit page and each Insights tab are single endpoints running `db.batch` so a page costs one request and stays under D1's free-plan limit of 50 queries per request. The queries are the ones the mock builds in memory; the Worker runs them with `org_id` and the helper's client filter in every `WHERE`.

## 6. Database

Draft: `docs/backend/schema-draft.sql` (not applied anywhere). Rules:

- One table per interface in `src/domain/types.ts`, `snake_case` columns, `org_id` first in every composite index.
- Arrays that are queried become join tables: `membership_clients`, `client_assigned_users`, `line_documents`, `follow_up_lines`, `visit_item_evidence`, `visit_packed`, `payment_proofs`. Display-only arrays (tags) stay JSON text.
- Optimistic concurrency: every table that has a `version` in the types has `version INTEGER NOT NULL DEFAULT 1`, bumped on every update.
- Full TINs: `tin_encrypted` (AES-GCM through Web Crypto, key from a secret) plus `tin_masked`. No plain TIN column exists.
- Activity is insert-only: the repository layer writes it in the same batch as the change; no update or delete route exists.
- Search: an FTS5 virtual table (`search_index`) over client names and codes, contacts, task labels and periods, document names and payment references. Confirm FTS5 support on D1 when building; fall back to `LIKE` on indexed columns.

## 7. Files in R2

- Key: `org/{orgId}/client/{clientId}/{yyyy}/{taskId|misc}/{documentId}-v{n}.{ext}`; thumbnails under `.../thumbs/`. Keys are never reused or overwritten.
- Upload through the Worker (`POST /api/v1/documents`, multipart): magic-byte type check, size at most 15 MB, access check, SHA-256 stored.
- Soft-deleted files stay in R2 until the retention job removes them after the retention period.
- Viewing and downloading are logged. `<img>` tags use a 5-minute HMAC-signed URL (`FILE_URL_SIGNING_KEY`).

## 7a. Scheduled jobs, notifications and push

- Cron triggers (UTC): `0 23 * * *` is 7:00 AM Manila (digest, overdue, expiry checks); `0 9 * * *` is 5:00 PM Manila (visit-tomorrow check). Also a daily retention job for soft-deleted files and idempotency keys older than 7 days.
- Notifications are rows written by the cron jobs and by write handlers (spec section 14), always with a link to a record that exists.
- Web Push with VAPID keys as secrets, sent from the Worker with a Web Crypto based library (check compatibility with `nodejs_compat`, or use a Workers-native library). Subscriptions that return `404` or `410` are removed. Quiet hours and lock-screen privacy are respected.

## 8. Security

- Every query filters by `org_id`; every query that touches client data for a helper also filters by `client_id IN membership_clients`. Counts, search, calendar, Insights and notifications use the same filter.
- Owner-only routes check the role in middleware, not in the handler body.
- Security headers on every response: `Content-Security-Policy` (default `'self'`; `img-src 'self' blob: data:`; `frame-src 'self' blob:`; `connect-src 'self'`), `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(self), geolocation=()`, `frame-ancestors 'none'`.
- Never store BIR portal credentials. Never log a revealed TIN. Sample data only in the preview environment.

## 9. Environments, backups, deployment

| Item | Plan |
|---|---|
| Workers | `ordinovix-preview` (Demo organization, sample data) and `ordinovix` (live, empty at start); separate D1 databases and R2 buckets. |
| CI | On pull request: type-check, Vitest, build, Playwright acceptance against the mock. On merge to `main`: deploy preview. Production: manual approval. |
| Backups | D1 Time Travel (7 days free, 30 paid); weekly `d1 export` from GitHub Actions to R2 `backups/db/YYYY-MM-DD.sql` (12 weeks); files are immutable and soft-deleted. |
| Restore drill | Before go-live and every quarter: restore the latest export into a fresh D1 database and open the app against it; record the result in the audit log. |

## 10. Build sequence (later, each step its own reviewed change)

1. **Shape**: add `worker/`, the Cloudflare Vite plugin, Hono app and error mapper; a health route; CI. No data yet. (Needs the owner decisions below.)
2. **Schema and auth**: turn `schema-draft.sql` into Drizzle migrations; Better Auth with Google; membership middleware; `session.me`; the first-owner setup command.
3. **Read paths**: clients, tasks, templates, visits, documents (metadata) behind the permission middleware, with the scoped-filter helper; run `permissions-table.test.ts`-style checks against the Worker.
4. **Write paths**: the remaining namespaces with idempotency keys, `If-Match`, batches and activity.
5. **Files**: R2 upload, signed URLs, retention job.
6. **Notifications and push**: cron jobs, VAPID push.
7. **API data source**: implement `Repositories` over `fetch`, switch with `VITE_DATA_SOURCE=api`, run the whole acceptance suite against the preview Worker.
8. **Go-live checklist** (spec 21.11): restore drill, access test as Ben, OAuth in production, empty live organization, weekly export, push on her phone, privacy notice, usage dashboard.

## 11. Differences between the mock and the API to settle

| Finding | Plan |
|---|---|
| `deadlineMoves.unreadCount` is in the interface but the mock does not implement it. | Implement in the mock first (or drop it from the interface) before step 3. |
| The mock does not enforce `If-Match` / version conflicts and does not return `409` for stale writes. | Add version checks to the mock so the UI's conflict handling is exercised before the API exists. |
| The mock applies idempotency only for keyed calls (`src/data/mock/idempotency.ts`); the API stores keys 7 days. | Keep the same rule; same key twice applies once. |
| Offline queued writes (U17) resolve to nothing in the mock and in the client; the API returns the record on replay. | Screens already take the entity from what they sent; invalidate queries after replay (done). |
| `settings.save` does not write an activity event in the mock. | The API must; add it to the mock. |
| `notes.save` can create a duplicate-id note, and a helper who is the assignee of a mixed visit can cancel it (open items in QUEUE.md). | Fix before the API copies the behaviour. |
| File bytes live in IndexedDB in the mock; the API streams from R2. | `documents.getUrl` already returns a URL, so screens do not change. |
| Derived fields (displayed status, due state, follow-up state, readiness) are computed in the mock. | Compute them in the Worker with `src/domain/rules.ts`; never store them. |
| Offline cache of query data (spec 19.3 "Offline data") is not persisted yet. | Needs a persisted-cache package that is not on the approved list. |

## 12. Test plan

- Reuse the unit tables: every method has a policy decision (`permissions-table.test.ts`) and a revoked-membership outcome (`permissions-gaps.test.ts`); run the same tables against the Worker.
- Access test as Ben on every page, count, search result, file URL and export; and as a revoked member.
- Acceptance suite (`tests/acceptance`) against the preview Worker with the Demo organization.
- Restore drill, weekly export opened, usage dashboard after the first week.

## 13. Owner decisions and accounts needed

These are also in `docs/state/QUEUE.md` (Open). Nothing below has been done.

1. **Cloudflare account** (Free plan to start), with Workers, D1 and R2 enabled, and permission for Claude Code to run `wrangler` in a later, approved unit. R2 may ask for a payment card even on the free tier.
2. **Google OAuth client** (web) in a Google Cloud project: basic scopes only, the exact `workers.dev` origin and redirect URI, publishing status In production.
3. **Secrets** to be created by the owner with `wrangler secret put` (never committed): `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `FILE_URL_SIGNING_KEY`, and the TIN encryption key.
4. **The first owner's Google email** for the one-time setup command.
5. **Names and domain**: the Worker name and account subdomain (`ordinovix.<account>.workers.dev`), and whether she wants a custom domain and email provider now or later.
6. **Approvals**: the new dependencies (Hono, Drizzle ORM and drizzle-kit, Better Auth, `@cloudflare/vite-plugin`, `wrangler`, a Web Push library) are not on `docs/adr/approved-deps.json`; each needs the owner's approval. Editing `.github/**` for the deploy workflow is also owner work.
7. **Decisions**: retention period for files and records; whether helpers may see Operator Confidence and Hours Finding Records (pulses); whether a failed offline write should hold later writes; production deploys by manual approval.
