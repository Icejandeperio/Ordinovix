---
paths:
  - "worker/**"
  - "migrations/**"
  - "wrangler.jsonc"
  - "drizzle.config.ts"
  - "src/data/api/**"
  - "scripts/setup-cloudflare.mjs"
  - "scripts/dev-vars.mjs"
---

# Backend rules (Workers, Hono, D1, R2, Better Auth)

Source documents: `docs/backend/BACKEND_PLAN.md` (routes, tables, permission rules) and
`docs/adr/ADR-0002-backend-stack-and-cloud-boundary.md` (names, bindings, environments, the cloud boundary).

## Same rules as the mock
- Import `src/domain/rules.ts`, `policy.ts`, `schemas.ts`, `errors.ts`, `types.ts`, `metrics.ts`; never copy or fork a rule.
- When the API and the mock disagree, fix the side that departs from the spec and make both pass the same tests.

## Every route
- Validate the body and query with the zod schema from `src/domain/schemas.ts`; reject unknown keys.
- Load the membership in middleware (`orgId`, `role`, `clientIds`, `active`). A revoked membership reaches no client
  data. Owner-only routes check the role in middleware, not in the handler.
- Every query filters by `org_id`; every query a helper can reach also filters by the helper's clients, including
  counts, search, calendar, insights, activity and notifications.
- Map domain errors to the JSON error shape and status codes in BACKEND_PLAN section 2; never return a stack trace.

## Every write
- `Idempotency-Key` required (repeat returns the first response and applies nothing); `If-Match` version on updates
  (stale = `409 VERSION_CONFLICT` with the current record).
- The change and its `activity` row go in one `db.batch`. Chunk inserts to stay within D1's bound-parameter limit.
- Soft delete only. Never write a revealed TIN, token or secret into `activity.before/after`, logs or errors.
- Encrypt the full TIN with `TIN_ENCRYPTION_KEY` (AES-GCM, Web Crypto); store only the masked form in clear.

## Data and migrations
- Change `worker/db/schema.ts`, then `npx drizzle-kit generate`, then `npx wrangler d1 migrations apply DB --local`.
- Never edit a migration that is already on `main`; add a new one. Never use `drizzle-kit push` or `migrate`.
- Dates as `YYYY-MM-DD` text, timestamps ISO 8601 with `+08:00`, money as integer centavos.

## Files (R2)
- Bucket is never public. Downloads only through short-lived signed URLs (`FILE_URL_SIGNING_KEY`).
- Enforce the spec's size and type limits on upload; store metadata in D1; soft delete.

## Config and secrets
- Names, bindings and environments in `wrangler.jsonc` follow ADR-0002 exactly; a test asserts them.
- Secrets come from bindings (`c.env`), never from code or committed files. Local values live in `.dev.vars`,
  written by `npm run dev:vars`; never read, print or commit it.
- Only local wrangler commands (`dev`, `types`, `check`, `--local` D1 and R2). Deploys and anything `--remote`
  belong to CI and the owner.

## Tests
- Worker tests run under Vitest with `getPlatformProxy()` from `wrangler` (local D1 and R2) and Hono `app.request()`.
- Every route gets permission cases: owner, helper on an assigned client, helper on an unassigned client, revoked
  membership, no membership (`403 ACCESS_PENDING`).
- No network in tests: stub Google OAuth and push endpoints.
