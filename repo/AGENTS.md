# Ordinovix — agent guide

Ordinovix is a private workflow web app for one Philippine tax preparer (the operator, persona Ana) and an
optional helper (persona Ben): clients, BIR filing tasks, document checklists, follow-ups, office visits,
outcomes, insights. Frontend only for now: React 19 + TypeScript + Vite + Tailwind v4 on a mock data layer.

**Sources of truth, in order:** `docs/state/backlog.json` (what to do next) → `docs/state/QA_AUDIT_2026-10-27.md`
(confirmed bugs, root causes, fixes) → `Inspirations/Ordinovix_Build_Spec_v2.md` (product and design spec).
If they disagree, the earlier one wins. If something is still unclear, take the reading closest to the spec,
note the assumption in the PR, and keep going.

## Commands (cross-platform: Windows Git Bash, macOS, Linux, CI)

| Purpose | Command |
|---|---|
| Install | `npm ci` |
| Dev server | `npm run dev` → http://localhost:5173 |
| **Full gate** (typecheck, lint, unit, build, e2e + ratchet) | `node scripts/verify.mjs` |
| Fast gate (no build, no e2e) | `node scripts/verify.mjs --fast` |
| One unit test file | `npx vitest run src/domain/rules.test.ts` |
| One acceptance test | `npx playwright test -g "B02"` |
| Install e2e browser (once per machine) | `npx playwright install chromium` |

## Architecture map

- `src/routes/*` pages · `src/components/*` UI · `src/app/*` shell, router, theme, dev menu
- `src/hooks/useData.ts` TanStack Query hooks. **Screens call hooks; hooks call `Repositories`.**
- `src/data/repositories.ts` the contract · `src/data/mock/*` the mock implementation (localStorage)
- `src/domain/types.ts` entities · `rules.ts` pure rules · `metrics.ts` KPIs · `schemas.ts` zod · `labels.ts` copy
- `tests/acceptance/*` Playwright acceptance tests (the oracle) · `src/**/*.test.ts` Vitest unit tests
- `docs/product/*` product brief and constraints (read-only) · `docs/state/*` backlog, progress, queue, reviews
- `AI Assist/` and `.agents/` are Antigravity-era files: ignore them.

## Product rules that never bend

1. Received is not accepted. Only an explicit review accepts a checklist line.
2. A blocked task always says why and who acts next. Blocked tasks change status only through an owner
   override with a reason.
3. A visit is ready only when every item is ready. A visit is finished only when every item has a saved outcome.
4. Permissions are enforced in the data layer, not only in screens. A helper sees and touches only assigned clients.
5. Dates are `YYYY-MM-DD` in Asia/Manila; never build a UTC-midnight `Date` for a calendar date.
   Money is integer centavos.
6. Soft delete only (`deletedAt`, `deletedReason`). Every change writes an activity event.
   Never store revealed values (full TIN) in activity `before`/`after`.
7. Never store BIR portal credentials. Never present an unverified BIR requirement as verified.
8. Sample data only. Never add real names, TINs, or documents. Never add network calls to third parties.

## How work happens

- Work comes **only** from `docs/state/backlog.json`, one unit at a time, in order, respecting `depends_on`.
  Do not start work that is not in a unit. Ideas go to `docs/state/QUEUE.md` under "Proposals".
- **One unit = one branch = one PR = one squash merge.** Branch: `u<NN>-<short-slug>` (e.g. `u01-finish-visit-guard`).
- Tests first: for every acceptance criterion without a test, add a failing test (new file), then make it pass.
- Keep PRs reviewable (aim ≤ 400 changed lines excluding lockfile; split the unit if it exceeds ~800).
- Never refactor and change behavior in the same commit. Never "fix" tests to make them pass.

## Autonomy levels

| Level | Examples | What you do |
|---|---|---|
| **Auto** (T1) | Units marked `"tier": "T1"`: UI, hooks, lib, docs, seed data | Build → gate green → PR → CI green → squash-merge yourself |
| **Auto + verifier** (T2) | Units marked `"tier": "T2"`: `src/domain/**`, `src/data/**`, permissions, persistence, dependencies | Same, plus an independent verifier PASS before merging |
| **Stop and queue** (T3) | Anything below | Do the safe preparatory work, write the decision to `docs/state/QUEUE.md`, mark the unit `blocked`, move to the next unblocked unit |

T3 always includes: editing protected paths; adding a dependency that is not in `docs/adr/approved-deps.json`;
upgrading a major version of any dependency; removing a user-facing feature; renaming fields in `types.ts`
beyond what the unit states; any backend or cloud action (Cloudflare, Wrangler, D1, R2, OAuth, secrets, deploys);
changing repository settings or visibility; anything involving real client data.

## Protected paths (human-owned; never edit)

`AGENTS.md`, `CLAUDE.md`, `.claude/**`, `.github/**`, `scripts/verify.mjs`, `scripts/verify.ps1`,
`eslint.config.js`, `playwright.config.ts`, `docs/product/**`, `docs/adr/**`, `Inspirations/**`,
`docs/state/QA_AUDIT_2026-10-27.md`, `.env*`, and **existing** files in `tests/acceptance/`
(new test files there are allowed; `known-failures.json` may only shrink).
Need a change in one of them? Write it to `docs/state/QUEUE.md` with the exact diff you propose.

## Git and PR workflow

1. `git switch main && git pull --ff-only`, then `git switch -c u<NN>-<slug>`. Never commit on `main`.
2. Conventional Commits with the unit and bug IDs: `fix(visits): block finish until outcomes are saved [U01][B02]`.
   Types: `feat` `fix` `refactor` `test` `chore` `docs` `perf`. One logical change per commit.
3. Before pushing: `node scripts/verify.mjs` must exit 0. Paste its summary into the PR.
4. `git push -u origin <branch>`; open the PR with `gh pr create` using `.github/pull_request_template.md`.
   Title: `U<NN>: <outcome in plain words> (<bug IDs>)`.
5. Wait for CI: `gh pr checks <number> --watch`. Red → fix on the same branch. Never bypass checks.
6. Merge: `gh pr merge <number> --squash --delete-branch`. Then `git switch main && git pull --ff-only`.
7. Never force-push, never push to `main`, never rewrite published history, never use `--no-verify` or `--admin`.

## Definition of done (per unit)

- Every acceptance criterion in the unit is met and covered by a test that would fail without the change.
- `node scripts/verify.mjs` exits 0; the unit's bug IDs are removed from `tests/acceptance/known-failures.json`.
- Both themes and a 390 px phone width checked for any screen the unit touched (screenshot in the PR when visual).
- `docs/state/backlog.json` updated in the same PR: `status`, `pr`, `evidence` (record after `gh pr create`).
- One entry added at the **top** of `docs/state/PROGRESS.md`, directly under its title (newest first; format below).
  CI green. PR merged.

## When something fails

Reproduce → minimize → one hypothesis → one change → failing regression test → root-cause fix.
A test that passes only on retry is flaky: record it in QUEUE, do not retry-until-green.
Three failed attempts at the same unit → mark it `blocked` with the evidence, move on.

## PROGRESS.md entry format (directly under the title, newest first)

```text
## <YYYY-MM-DD> U<NN> <title> — <done|blocked>
- Changed: <files/areas, one line>
- Evidence: verify.mjs exit 0; tests now passing: <IDs>; PR #<n>
- Notes: <assumptions, follow-ups, or blocker with evidence>
```
