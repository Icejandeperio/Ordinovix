# U38 follow-up review: next action requires the task version

Verdict: PASS (independent verifier, 2026-11-03). No blocking findings.

Checks run: `npx vitest run worker/routes/if-match.test.ts worker/offline-stale.test.ts src/data/mock/next-action-version.test.ts` (11 passed). The full gate was run by the author (exit 0).

Criteria: 422 without a version and 409 when stale (per environment, `worker/routes/if-match.test.ts`); the only caller (`src/routes/tasks/detail.tsx`) sends `task.version` on both mutate calls; removed from EXEMPT; a stale next-action edit in the offline queue replays to 409, stays failed, holds the later write and never overwrites the newer next action (`worker/offline-stale.test.ts`).

Non-blocking: make `version` required in the `setNextAction` contract (the API client falls back to `*` today); a comment tying EXEMPT to the "no record version" rule.
