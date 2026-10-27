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

## Proposals (ideas outside the backlog; not scheduled)

- 2026-10-27 (from U04 review) Gate the sign-in persona chooser (`src/routes/sign-in/page.tsx`) and Settings "Reset Sample Data / Reset to Seed" with `isMockData` too; both are mock-only controls still shown when `VITE_DATA_SOURCE=api`. Best done with the auth/API unit.

## Decided
