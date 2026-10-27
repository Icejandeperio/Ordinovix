# ADR-0001: Quality gate, ratchet, and pre-approved dependencies

**Status:** Accepted · **Date:** 2026-10-27 · **Owner:** Icejan (human-owned; agents may not edit)

## Context

The frontend built with Antigravity passes typecheck, unit tests and build, yet the QA audit of 2026-10-27 found a
crash and a data-loss bug in the visit flow, facade screens, and permissions enforced only in the UI. None of the
existing gates renders a page, and the existing gate scripts are Windows-only. The project is moving to Claude Code
with maximum automation, so the gate must be strong enough to let the agent merge its own work.

## Decision

1. **One gate, cross-platform:** `node scripts/verify.mjs` runs typecheck, ESLint (Rules of Hooks as an error),
   Vitest, production build, and the Playwright acceptance suite. CI runs the same script on every PR and on `main`.
2. **Ratchet for known bugs:** `tests/acceptance/known-failures.json` lists bug IDs whose acceptance tests are
   allowed to fail until their unit lands. The gate fails if (a) any test outside that list fails, (b) every test of
   a listed ID passes but the ID is still listed, or (c) a branch adds an ID that `origin/main` does not list.
   The list can only shrink.
3. **Agent merges its own PRs** when the gate is green locally, CI is green, and (for T2 units) the verifier
   subagent returns PASS. Branch protection on `main` requires the `verify` check.
4. **Pre-approved dependencies** are listed in `docs/adr/approved-deps.json` and enforced by the guard hook:
   - gate: `@playwright/test`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`
   - test: `fake-indexeddb` (IndexedDB in Vitest), `@axe-core/playwright` (accessibility checks)
   - pwa: `vite-plugin-pwa` (service worker per spec 19.3)
   - already present (may be re-installed or pinned): `idb-keyval`, `zod`, `@date-fns/tz`
   Policy: latest stable at least 7 days old (`npm view <pkg> time --json`), `--save-exact`, permissive licence,
   no major upgrades of existing packages.
5. **Approved removals** (U16, after confirming zero imports): `recharts`, `react-hook-form`, `@hookform/resolvers`,
   `@tanstack/react-table`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-day-picker`, `vaul`.

## Consequences

- The gate is slower (about 2–3 minutes with e2e) but catches render-time crashes and flow regressions.
- Adding any other package, upgrading a major version, or changing the gate requires the owner (QUEUE.md).
- Superseded: `policy/tiers.yaml`, `policy/gates.yaml`, `policy/dependencies.yaml`, `docs/state/features.json`.
