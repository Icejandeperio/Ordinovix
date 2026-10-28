---
paths:
  - "tests/**"
  - "src/**/*.test.{ts,tsx}"
  - "worker/**/*.test.ts"
  - "vite.config.ts"
---

# Testing rules

- `tests/acceptance/` holds Playwright acceptance tests (the oracle). Files committed on `main` are read-only.
  New test files, and your own drafts not yet on `main`, can be edited or deleted (delete a draft you replaced); name them `u<NN>-<topic>.spec.ts` and start each test title with the unit or bug ID
  (`U07 ...`, `B11 ...`) so `scripts/verify.mjs` can track them.
- `tests/acceptance/known-failures.json` lists bug IDs allowed to fail until their unit lands. Remove an ID in the
  same PR that makes its tests pass. Never add IDs; the gate rejects additions.
- Vitest runs `src/**/*.test.{ts,tsx}` and `worker/**/*.test.ts` (Worker tests use `getPlatformProxy()` local D1 and R2);
  Playwright runs only `tests/`. Keep them separate. No network in any test.
- A new test must fail before the fix. Say so in the PR ("red before: <command/output>").
- No retries to hide flakiness, no `test.skip`/`test.fixme` on acceptance tests, no sleeps longer than needed;
  prefer `expect(...).toContainText` with a timeout over fixed waits.
- Use the sample personas: owner `ox-mock-persona=owner`, helper `ox-mock-persona=helper` via `addInitScript`.
