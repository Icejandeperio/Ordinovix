# Go-live checklist

Tracks spec 21.11. Updated 2026-10-28 (U32). "Done" means there is evidence in the repository or from a check; "owner-pending" means a
step only the owner (or the owner with the client) can do, with the steps. Production stays empty and undeployed until the owner
releases it after the client accepts the MVP (ADR-0002, section 5). The setup and release steps are in `DEPLOY.md`.

## Where things stand

| Stage | State |
|---|---|
| Backend built and tested locally (U21 to U30) | Done |
| Owner setup script and runbook (U31) | Done |
| Owner runs the setup script (phase 1, then merge the database ids) | Done 2026-10-29 |
| Preview deployed by CI and smoke-tested | Done 2026-10-29: deploy-preview green; the read-only checks below all passed on https://ordinovix-preview.ordinovix.workers.dev (results in PROGRESS.md) |
| Secrets, first owner, reseed of the preview | Owner-pending (QUEUE.md, Open) |
| Production released | Not started on purpose |

## The eight items

| # | Spec 21.11 item | State | Evidence or what is left |
|---|---|---|---|
| 1 | Restore drill passed | Owner-pending | Needs a production backup to exist (item 5). Steps: `DEPLOY.md`, "Backups and the restore drill". Record the date and the row counts here when done. |
| 2 | Access test: Ben sees only his clients in every page, count, search result, file URL and export | Automated part done; live check owner-pending | Done in code: permission tables for every route with owner, helper on an assigned client, helper on an unassigned client, revoked membership and no membership (`worker/routes/reads.permissions.test.ts`, `writes.permissions.test.ts`, `writes2.permissions.test.ts`, `documents.test.ts`, `push.test.ts`), the same rules in the mock (`src/data/mock/permissions*.test.ts`), and the helper acceptance tests (U20, U30). Left: sign in to the preview as a helper and click through once (steps below). |
| 3 | Google OAuth client in production with the live redirect address; allowlist only the intended people | Owner-pending | The exact origins and redirect URIs are printed by `setup-cloudflare.mjs` phase 1 (`https://ordinovix.<subdomain>.workers.dev/api/auth/callback/google`). Production sign-in works only for people with a membership; check the member list on the first day (Settings, Users & access). |
| 4 | Live organization empty of sample data; the Demo organization only on the preview Worker | Done by construction; confirm at release | Only `deploy-preview` ever runs `db:seed-sql` (the reseed option); `deploy-production` and `backup-production` never do. The production first owner is made with `--org <id>`, a non-demo organization. Confirm after the release: Today shows no sample clients. |
| 5 | Weekly export ran at least once and the file opens | Owner-pending | `backup-production.yml` runs Sundays 18:07 UTC and can be dispatched by hand once production exists. Open the file from `ordinovix-files/backups/db/` with the restore drill (item 1). |
| 6 | Push tested on her phone (installed app) | Owner-pending, and a client-side piece is missing | The Worker side is done (VAPID, subscriptions, the 07:00 and 17:00 jobs, `worker/routes/push.ts`). The app has no "Turn on reminders" button and no service-worker push handler yet (queued in QUEUE.md, proposals from U29). Until then a push can be sent and no device receives it. Needs a unit before this can be ticked. |
| 7 | Privacy notice reviewed with her; templates she relies on marked verified with sources | Owner-pending | A walkthrough with the client. The notice text lives in Settings, Security & privacy (RA 10173). Templates: an unverified BIR requirement is never shown as verified (rule 7); verifying one records the source and date in the app. |
| 8 | Free-plan usage dashboard checked after the first week (requests per day, D1 size, R2 size) | Owner-pending | One week after the production release: Cloudflare dashboard, Workers and Pages (requests), D1 (storage and rows read), R2 (storage). Note the numbers here. Free limits: 100,000 requests a day, 5 GB D1 storage, 10 GB R2. |

## Access test as a helper on the preview (item 2, about ten minutes)

1. As the owner, Settings, Users & access: invite a second Google account as a helper and assign two sample clients (for example RSP and Cruz).
2. Sign in with that account in a private window and check: Clients, Tasks, Follow-ups, Visits, Calendar, Documents, Payments and Search show only the two clients; the Today counts match; Search for a name of an unassigned client finds nothing; opening a link to an unassigned client says you do not have access; a document link of an assigned client opens, the same link after signing out does not once it has expired (five minutes); Reports and Insights export only the two clients.
3. As the owner, revoke the helper; the helper's next click shows the access screen.

## Read-only smoke checks of a deployed preview

Claude Code runs these against the preview URL once deploy-preview has succeeded (they call nothing that changes data). `URL` is
`https://ordinovix-preview.<subdomain>.workers.dev`.

| Check | Command | Expected |
|---|---|---|
| Health | `curl -s $URL/api/v1/health` | `{"ok":true,"env":"preview"}` |
| No cookie, no data | `curl -s -o /dev/null -w "%{http_code}" $URL/api/v1/session/me` | `401` (or `403`) |
| Deep link serves the app | `curl -s $URL/tasks` | HTML that contains `<div id="root"` |
| Security headers | `curl -sI $URL/` | `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `X-Robots-Tag: noindex, nofollow` |
| Dev sign-in is off | `curl -s -o /dev/null -w "%{http_code}" -X POST $URL/api/v1/dev/sign-in -H "content-type: application/json" -d "{\"persona\":\"owner\"}"` | `404` |
| Dev reset is off | `curl -s -o /dev/null -w "%{http_code}" -X POST $URL/api/v1/dev/reset -H "content-type: application/json" -d "{}"` | `404` |
| A file link without a signature | `curl -s -o /dev/null -w "%{http_code}" $URL/api/v1/files/x/content` | `403` |

Results are recorded in `docs/state/PROGRESS.md` under the U32 entry when they have been run.

## Before releasing production

- Items 1 to 8 above, with 6 needing its own unit.
- The client has accepted the MVP on the preview.
- A decision on keeping a recovery copy of `TIN_ENCRYPTION_KEY` (QUEUE.md, proposals).
- The retention period for files and records is chosen (nothing is deleted until it is).
