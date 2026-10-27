---
name: run-backlog
description: Autopilot. Repeatedly execute the next eligible Ordinovix backlog unit with the /next-unit procedure until the stop point, a stop condition, or no eligible units remain.
disable-model-invocation: true
---

## Preflight (once per session, before the loop)

1. Guardrails loaded: your context must contain "Ordinovix work state" (from the SessionStart hook), and
   `git push --dry-run origin main` must be refused with "Blocked by Ordinovix guard". That block is the expected
   result of this self-test; do not retry it or try another route. If either check fails, the project settings did
   not load: stop and tell the owner to restart Claude Code from the project root.
2. `gh auth status` succeeds. `git switch main && git pull --ff-only` succeeds.
3. If `node_modules/` is missing, run `npm ci`. Once `@playwright/test` is installed (U00), run
   `npx playwright install chromium` if Playwright reports a missing browser.
4. Do not ask the owner questions during the run. Take the reading closest to the audit and spec, record the
   assumption in the PR, and continue. Decisions only the owner can make go to `docs/state/QUEUE.md` (T3).

## Loop

1. Re-read `docs/state/backlog.json`, the top of `docs/state/PROGRESS.md`, and `docs/state/QUEUE.md`
   (state lives in files; do not rely on memory of earlier units).
2. Stop when any is true, and give the final report below:
   - the unit named in `stop_after` is `done`;
   - no unit is `pending` with all `depends_on` done;
   - a stop condition from `CLAUDE.md` occurred.
3. Otherwise run the full `/next-unit` procedure (`.claude/skills/next-unit/SKILL.md`) for the next eligible unit.
4. A unit that ends `blocked` does not stop the run; continue with the next eligible unit.
5. Between units, keep only a two-line summary of the finished unit in mind; everything else is in the files.

Final report (max 12 lines): units done this run with PR numbers, units blocked with one-line reasons, open QUEUE
items that need the owner, the state of `main` (last commit, gate result), and the next step for the owner.
