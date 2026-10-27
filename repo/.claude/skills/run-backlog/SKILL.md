---
name: run-backlog
description: Autopilot. Repeatedly execute the next eligible Ordinovix backlog unit with the /next-unit procedure until the stop point, a stop condition, or no eligible units remain.
disable-model-invocation: true
---

Loop:

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
