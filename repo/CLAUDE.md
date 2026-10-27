@AGENTS.md

# Claude Code operating notes

These add to `AGENTS.md`. When they conflict, `AGENTS.md` wins.

## Mode and guardrails

- You run in auto mode with project guardrails: deny rules in `.claude/settings.json` and a guard hook
  (`.claude/hooks/guard.mjs`) that blocks pushes to `main`, force pushes, commits on `main`, destructive git,
  unapproved dependency installs, deploys, and edits to protected paths.
- When a guardrail blocks you, read its message and follow it. Never retry the same action another way
  (different flags, `git -C`, a script, a subshell). If the blocked action was genuinely needed, it is T3:
  write it to `docs/state/QUEUE.md` and move on.
- Never pass `--dangerously-skip-permissions`, never change permission modes, never edit settings or hooks.

## Your workflow tools

| Tool | Use |
|---|---|
| `/next-unit` | Run exactly one backlog unit end to end, including PR and merge |
| `/run-backlog` | Keep running `/next-unit` until the backlog's stop point or until every remaining unit is blocked |
| `/ship` | The commit → push → PR → CI → merge procedure (used by `/next-unit`) |
| `verifier` subagent | Independent grader with a fresh context. Required before merging any T2 unit; optional for T1 |

Path-specific rules load automatically from `.claude/rules/` when you touch matching files.

## Working style

- State lives in files, not in this conversation: `backlog.json`, `PROGRESS.md`, `QUEUE.md`, git history.
  After a context compaction or a new session, re-read them before acting.
- Read before you write. Before editing a file over 300 lines, read the region you are changing plus its callers.
- Prefer small, surgical diffs. The UI look is approved by the owner: preserve layout, colors, spacing, and copy
  unless the unit says otherwise.
- Run the narrowest check while iterating (one Vitest file, one Playwright test with `-g`), then the full gate
  once before pushing.
- Shell is Git Bash on Windows: use forward slashes and `npm`/`npx`/`node`; no PowerShell-only syntax.
- Keep the user-facing summary at the end of each unit to 5 lines: what changed, evidence, PR link, next unit.

## Stop conditions (end the run and report)

- The backlog's `stop_after` unit is done, or no pending unit has its dependencies satisfied.
- The gate fails on `main` itself (broken base) after U00 is done: fixing it becomes the only task; if you cannot,
  stop and report.
- `gh` is not authenticated, the remote rejects pushes, or CI is unavailable for more than 30 minutes.
