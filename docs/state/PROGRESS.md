# Progress Log

## Session 2026-10-25 (M0 Bootstrap & Verification)
- Bootstrapped Factory Build Protocol harness and governance policies (`AGENTS.md`, `PREVIEW.md`, `policy/`, `docs/`, `scripts/`).
- Implemented full design tokens (`src/styles/tokens.css`, `base.css`, `print.css`) supporting both light mode (`--paper: #EEF1F4`, `--stamp: #5A3DB8`) and dark mode (`--paper: #0E131C`, `--stamp: #A794F5`) with zero-flash pre-paint script.
- Bundled variable Archivo typography with tabular figures (`tnum`) enabled.
- Defined domain layer: `types.ts`, `labels.ts`, `schemas.ts`, pure functions in `rules.ts` (14 unit tests) and `metrics.ts` (4 unit tests) with 100% Vitest pass rate.
- Implemented mock repositories (`src/data/mock/index.ts`) with deterministic Mulberry32 seed (`20261024`), supporting Ana Santos (Owner) and Ben Morales (Helper with client-scoped queries).
- Created responsive application shell (`src/app/shell.tsx`) with collapsible desktop sidebar (248px -> 72px), tablet rail, mobile bottom bar, and top bar.
- Implemented developer drawer (`src/app/dev-menu.tsx`) for live persona switching, sample data resets, network failure simulation, offline simulation, and time-travel dates.
- Scaffolded all 22 routing endpoints defined in Section 10.2 of `Ordinovix_Build_Spec_v2.md`.
- Executed production build (`npm.cmd run build`) with zero errors in 4.34s.
- Launched Vite development server on `http://localhost:5173/` and verified full browser rendering, theme switching, Dev Menu drawer, and the design token catalog (`/dev/tokens`).
- Upgraded export engine (`src/lib/export.ts`) to support Microsoft Excel (.xls), printable PDF document views, and CSV with UTF-8 BOM.
- Built Section 9.6 custom date picker (`src/components/inputs/date-field.tsx`) with natural language parsing (`chrono-node`), quick preset chips, month/year navigation, and relative date cues.
- Replaced top and bottom sidebar collapse chevron buttons with a centered border notch handle (`src/app/shell.tsx`) featuring `<` and `>` directional chevrons, position sync between 248px and 72px, `Ctrl+[` keyboard shortcut, and `localStorage` state persistence.
