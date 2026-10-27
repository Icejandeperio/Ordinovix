## Unit

U<NN>: <plain-language outcome> · Bugs: B<NN>, B<NN> · Tier: T1 | T2

## Contract

- Expected to change: <files/areas>
- Not touched: <files/areas deliberately left alone>
- Success shown by: <test IDs and commands>

## What changed

- <one line per logical change>

## Evidence

```text
<paste the GATE SUMMARY lines from `node scripts/verify.mjs`>
```

- Tests turned green: <IDs>; red before: <command and failing line>
- IDs removed from `tests/acceptance/known-failures.json`: <IDs or "none">
- Screens checked (light, dark, 390 px): <list or "no UI change">
- Verifier (T2): PASS, `docs/state/reviews/U<NN>.md` | not required (T1)

## Assumptions

- <anything the spec or audit left open, and the reading taken>

## Risk and rollback

- Risk: <what could break and where>
- Rollback: `git revert <squash sha>`
