---
name: next-unit
description: Execute exactly one Ordinovix backlog unit end to end — pick, branch, test first, implement, verify, independent review, PR, CI, merge, record. Use when asked to do the next unit or a named unit (pass the ID).
argument-hint: "[unit-id, optional]"
disable-model-invocation: true
---

Run one unit. If an ID was given ($ARGUMENTS), use it; otherwise pick the first unit in
`docs/state/backlog.json` with `"status": "pending"` whose `depends_on` units are all `done`.

## 1. Prepare
1. `git status` must be clean. If not, and the changes belong to an `in_progress` unit, finish that unit
   instead; if they are unexplained, stash them with a message and note it in PROGRESS.md.
2. `git switch main && git pull --ff-only`. Run `node scripts/verify.mjs --fast`. If main itself is red,
   stop and report (broken base). Exception: U00 installs the gate, so main is expected to be red until it merges.
3. Read the unit, every bug it references in `docs/state/QA_AUDIT_2026-10-27.md`, and the spec sections it cites.
4. `git switch -c u<NN>-<slug>`. Set the unit's `status` to `in_progress` in `backlog.json`.

## 2. Contract (write it in the PR body later; keep it short)
- Files you expect to change, files you will not touch, how success is shown (test IDs and commands).
- If the unit is T3 by the rules in `AGENTS.md`, do only safe preparatory work, write the decision to
  `docs/state/QUEUE.md`, set `status: blocked` with the reason, commit on the branch, push, open a draft PR,
  and return. Do not merge.

## 3. Tests first
- For each acceptance criterion without a test, write one (Vitest for pure logic in `src/**`, Playwright for
  behavior in a NEW file under `tests/acceptance/`). Run it and confirm it fails for the right reason.

## 4. Implement
- Smallest change that satisfies the criteria. Follow `.claude/rules/*`. Commit in logical steps with
  Conventional Commits tagged `[U<NN>][B<NN>]`.
- Iterate with narrow checks (`npx vitest run <file>`, `npx playwright test -g "<ID>"`).

## 5. Gate
- `node scripts/verify.mjs` must exit 0. Remove the unit's bug IDs from `tests/acceptance/known-failures.json`
  when their tests pass (the gate fails if you forget).
- For any screen you touched: check light and dark themes and 390 px width (Playwright screenshot is enough).

## 6. Independent review
- T2 units: invoke the `verifier` subagent with the unit ID and branch. Fix every blocking finding, rerun the
  gate, and re-invoke until PASS. T1 units: run the verifier if the diff touches more than 8 files.

## 7. Ship and record
- Follow `/ship` (`.claude/skills/ship/SKILL.md`). It opens the PR first, then records the unit in
  `backlog.json` (`status: "done"`, `pr`, `evidence`) and at the top of PROGRESS.md with the real PR number,
  then waits for CI and merges. If CI fails, fix on the branch; after three failed attempts set
  `status: "blocked"`, record the evidence, push, and return without merging.

## 8. Report
Five lines max: unit, outcome, evidence, PR link, next eligible unit.
