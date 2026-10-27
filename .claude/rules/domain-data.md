---
paths:
  - "src/domain/**/*.ts"
  - "src/data/**/*.ts"
  - "src/hooks/**/*.ts"
  - "src/lib/**/*.ts"
---

# Domain and data-layer rules

- `src/data/repositories.ts` is the contract the future API implements. Method names never shrink;
  arguments may only grow. Field names in `src/domain/types.ts` are final unless the unit says otherwise.
- Business rules live in `src/domain/rules.ts` and `metrics.ts` as pure functions with Vitest tests.
  Permission checks live in `src/domain/policy.ts` (created in U07). Every repository method calls the
  relevant rule and policy functions first and throws typed errors (`FORBIDDEN`, `NOT_FOUND`, `RULE_VIOLATION`,
  `VALIDATION`). The UI never re-implements a rule.
- Validate every write's input with the zod schema from `src/domain/schemas.ts` at the repository boundary (U08).
- Writes: bump `version`, set `updatedAt`/`updatedBy`, soft delete only, and log one activity event with a plain
  sentence. Never put a revealed TIN or any secret in `before`/`after`.
- Dates: `YYYY-MM-DD` strings and `todayInManila()`; timestamps ISO 8601 with `+08:00`. Money: integer centavos.
- Seed data: keep these IDs and their starting states, which acceptance tests depend on:
  users `user-ana`, `user-ben`; membership `mem-ben` (assigned `client-rsp`, `client-cruz` only);
  clients `client-rsp`, `client-cruz`, `client-maria`, `client-horizon`; tasks `task-rsp-0619e`
  (one Received line, one Accepted), `task-cruz-1601c` (Waiting on client), `task-maria-2550q`;
  visit `visit-today` (planned, one RSP item, no other items); template `tmpl-0619e`; office `off-rdo39`.
  Add new records around them; never add items to `visit-today`.
- Every notification link must point at a record that exists in the seed.
