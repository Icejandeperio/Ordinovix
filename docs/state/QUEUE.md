# Owner decision queue

Items here need the owner (Icejan). The agent adds items and never resolves them itself.
To answer one, tell the agent in a Claude Code session (for example: "Decision for U07: option A"). The agent
records your words under the item, ticks it, moves it to "Decided", and sets the blocked unit back to `pending`
on its next branch. Decisions that change a protected file (for example approving a new package in
`docs/adr/approved-deps.json`) are made by you through a pull request on GitHub, because `main` is protected.

## Open

Entry format: a checkbox line `- [ ] <YYYY-MM-DD> U<NN> <short question> (blocks U<NN>)`, followed by indented
lines for Context (one or two lines, link to the PR or draft PR), Options with a recommendation and its reason,
and, for protected files, the exact change proposed.

- [ ] 2026-10-27 U02 Delete the stray untracked draft tests/acceptance/u02-blocked-task.spec.ts (blocks nothing)
  - Context: I created it during U02, then the guard refused my edit to fix its viewport (any file already in tests/acceptance counts as existing). It is never committed, so CI and main are unaffected. The corrected test is tests/acceptance/u02-board-blocked.spec.ts. Until the draft is deleted, the gate in this working copy reports a REGRESSION for its two U02 tests, so I run the gate on a clean checkout of the committed branch.
  - Options: (A, recommended) delete the file by hand, which needs no protected-file change; (B) change the guard to allow edits to untracked files in tests/acceptance.
  - Update (U06): the same thing happened with a second untracked draft, tests/acceptance/u06-query-state.spec.ts (its last test is a placeholder that does not test a crash). The real spec is tests/acceptance/u06-error-states.spec.ts. Please delete both stray drafts; option B would stop this recurring.

- [ ] 2026-10-27 U07 Permit a fourth attempt at U07 after three failed verifier rounds? (blocks U08, U11, U12 and everything after them)
  - Context: draft PR for branch `u07-permission-policy` (tip bebd87e); verdicts in `docs/state/reviews/U07.md`. Gate passes and B11 turns green. Round 1 found client-less and stored-record write gaps, round 2 found foreign-reference and re-pointing gaps, both fixed with regression tests. Round 3 found three remaining holes, all on the helper persona and each fixable with one guard:
    1. `documents.update` accepts foreign `lineId`, `paymentId`, `visitItemId`, `authorizationId` (run `assertSameClient` on those keys).
    2. `tasks.update` lets a helper change `dueDate`, `dueSource`, `statusOverride`, `status` (require `assertOwner()` when the patch contains them).
    3. `lines.update` lets a helper change `status`, `reviewedBy`, `reviewedAt`, `reviewNote`, `flagNote`, bypassing `helpersCanAccept=false` (call `assertCanReview()` when present).
    Advisory: reference arrays in updates (`documentIds`, `evidenceDocumentIds`, `packedLineIds`), `today.queue` first-pass KPI unscoped, `baseline.get`/`pulses.list` readable by helpers.
  - Options: (A, recommended) tell me "Decision for U07: option A" and I apply the three guards plus the advisory reference-array check, add regression tests, and re-verify; (B) accept the gaps and merge as is; (C) drop the helper field-level scope from U07 and queue it as a follow-up unit.
  - Why blocked now: AGENTS.md says three failed attempts at the same unit mark it blocked.

## Proposals (ideas outside the backlog; not scheduled)

- 2026-10-27 (from U04 review) Gate the sign-in persona chooser (`src/routes/sign-in/page.tsx`) and Settings "Reset Sample Data / Reset to Seed" with `isMockData` too; both are mock-only controls still shown when `VITE_DATA_SOURCE=api`. Best done with the auth/API unit.

- 2026-10-27 (from U06 review) Error handling gaps outside the audit B13 list: Today, tasks/detail, audit, reports and clients/import have no error state; Settings gates only on `useSession` (its memberships, baseline and clients queries have none); Calendar shows the error panel above an empty grid rather than replacing it; `visits.get` has no helper scoping check (covered by U07).

- 2026-10-27 (from U09 review) Flaky test, not retried to green: `src/data/mock/tasks.test.ts` "guarantees open period idempotence" takes 4.0–4.7 s against Vitest's 5 s timeout on `main` too (it failed once in a verifier gate run). Give it a longer timeout or fewer simulated-latency calls.
- 2026-10-27 (from U09 review) `mockDevControls.reset()` leaves orphaned file blobs in IndexedDB (`ordinovix-files`); clear that store on reset.

- 2026-10-27 (from U14 review) More device-time-zone leftovers beyond what audit B25 names: event times labelled `+08:00` but built from the device clock (mock `visits.start` startedAt and recordOutcome outcomeAt, `components/follow-ups/composer.tsx`, the finish-time default in `visits/record.tsx`), "generated/printed" times in `lib/export.ts` and `visits/print.tsx`, and midnight event stamps in `tasks.override`, follow-up respondedAt/resolvedAt and `line.receivedAt`. Use `nowInManila()` and `formatTime`. A B15 test that finishes a visit with empty costs is also missing.

## Decided
