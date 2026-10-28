# Progress Log

## 2026-10-28 U24 Auth and membership: Better Auth with Google, membership middleware, dev sign-in — done
- Changed: better-auth; worker/auth, middleware, routes/session, dev/sign-in; db mappers; first-owner-sql script; UnauthenticatedError; worker test fixture
- Evidence: verify.mjs exit 0; tests now passing: U24 (31 worker tests); PR #28
- Notes: Verifier PASS under the run-wide rule; unknown /api/v1 paths are 401 when signed out; advisories queued.

## 2026-10-28 U23 Database schema, migrations and the Demo seed — done
- Changed: drizzle-orm/kit; worker/db/schema.ts; migrations 0000 (generated) and 0001 (FTS5 + activity triggers); db:seed-sql from buildInitialStore; mock follow-up data fixes; schema-draft updated
- Evidence: verify.mjs exit 0; tests now passing: U23 (60+ worker/db tests); PR #27
- Notes: Verifier PASS under the run-wide rule; seeded documents are data: URIs (files route must serve them); no encryption key in the seed; search_index left to U25.

## 2026-10-28 U22 API shell: Worker, Hono, Cloudflare Vite plugin, local test harness — done
- Changed: hono, wrangler, @cloudflare/vite-plugin; wrangler.jsonc per ADR-0002; worker/ (app, error mapper, security headers, health route, harness); public/_headers; dev:vars script; bundle-size reads dist/client; worker type project
- Evidence: verify.mjs exit 0; tests now passing: U22 (35 worker and pwa-config unit tests); PR #26
- Notes: Verifier PASS under the run-wide rule; no workers-types package needed (wrangler types); lockfile churn without version changes; advisories queued.

## 2026-10-28 U21 Align the mock with the API contract — done
- Changed: VERSION_CONFLICT on stale updates (errors, repositories, mock, edit screens, conflict toast), settings activity event, note id reuse refused, mixed-visit cancel owner-only, unreadCount dropped from the plan
- Evidence: verify.mjs exit 0; tests now passing: U21 (28 unit, 2 acceptance), policy canCancelVisit; PR #25
- Notes: Verifier PASS under the run-wide rule; unreadCount was never in Repositories, so removed; unwired version cases queued.

## 2026-10-28 U19 Backend plan document (no cloud actions) — done
- Changed: docs/backend/BACKEND_PLAN.md, schema-draft.sql, QUEUE owner decisions, coverage test
- Evidence: verify.mjs exit 0; tests now passing: backend-plan.test.ts (5); PR #23
- Notes: T1; plan only, nothing applied, no cloud command run; owner decisions and accounts queued.

## 2026-10-28 U20 Close the remaining helper permission gaps from the U07 review — done
- Changed: mock data layer: logResponse, recordOutcome, payments/contacts/authorizations, activity/calendar/search/today/offices policy, isVisitListable; Offices page owner-only buttons
- Evidence: verify.mjs exit 0; tests now passing: B11, permissions-gaps (15), U20 acceptance (1); PR #22
- Notes: Verifier PASS under the run-wide rule; findings queued.

## 2026-10-28 U18 Accessibility and responsive sweep — done
- Changed: axe checks on 20 routes in both themes, 360 px no-scroll checks, four fixes (button name, two contrasts, Tasks header wrap)
- Evidence: verify.mjs exit 0; tests now passing: U18 (67 acceptance); PR #21
- Notes: T1; axe-core/playwright 4.14.0 added; open modals not scanned.

## 2026-10-28 U17 Installable app and offline write queue — done
- Changed: vite-plugin-pwa service worker and update banner, PNG icons, IndexedDB write queue with idempotency keys, sync indicator
- Evidence: verify.mjs exit 0; tests now passing: B17, U17 acceptance (5), queue and PWA unit tests; PR #20
- Notes: Verifier PASS; initial JS 211.9 KB gzip; write-during-replay gap fixed; other findings queued.

## 2026-10-27 U16 Bundle split and dependency cleanup — done
- Changed: router lazy routes, lazy mock layer, LazyMotion, chrono on demand, nine unused packages removed, bundle-size script
- Evidence: verify.mjs exit 0; tests now passing: B26, B27, bundle.test.ts (4); PR #19
- Notes: Initial JS 208.7 KB gzip (was ~398); verifier PASS; proposals queued.

## 2026-10-27 U13 Welcome wizard persists what it collects — done
- Changed: welcome wizard saves each step; Today Getting started card; onboarding progress in settings; lib/onboarding
- Evidence: verify.mjs exit 0; tests now passing: B30, U13 acceptance (11), onboarding unit tests; PR #18
- Notes: T1, no verifier; card added per spec 11.3 since none existed; stray draft u13-welcome-setup.spec.ts queued.

## 2026-10-27 U12 Insights computed from data with filters and helper scoping — done
- Changed: metrics.ts (+tests), types.ts, mock insights.get, Insights page and heat calendar, useMemberships(enabled)
- Evidence: verify.mjs exit 0; tests now passing: B20, U12 acceptance (8), metrics hand-count tests, mock filter tests; PR #17
- Notes: Verifier PASS under the run-wide rule; flake and other advisories queued in QUEUE.md Proposals; no hard-coded series remain.

## 2026-10-27 U11 Audit log shows real activity — done
- Changed: Audit page rendered from activity.list with spec 11.18 filters and views, lib/audit helpers, activity.list actor/action/date filters + newest first + device, useActivity hook, known-failures (B08 removed, list now empty)
- Evidence: verify.mjs exit 0; tests now passing: B08; PR #16
- Notes: verifier PASS under the run-wide rule; before/after content and other proposals queued

## 2026-10-27 U10 Settings saves for real — done
- Changed: seven wired settings sections, shared SaveBar, settings/prefs/messages/holiday/deadline/visit kit hooks, mock upserts, helpers-can-accept toggle, known-failures (B06 removed)
- Evidence: verify.mjs exit 0; tests now passing: B06; PR #15
- Notes: verifier PASS on round 2 (round 1: helper profile regression, fixed); Practice TIN removed; stray drafts queued

## 2026-10-27 U08 Validate every write at the repository boundary — done
- Changed: schemas.ts rewritten for spec 12, ValidationError, validate/validateReason on 52 write methods, form onError wiring, global validation toast, Toaster mounted, tests
- Evidence: verify.mjs exit 0; tests now passing: U08(B16); PR #14
- Notes: verifier PASS under the run-wide rule; non-blocking proposals queued; mounted a missing Toaster (pre-existing bug)

## 2026-10-27 U07 Permission policy enforced in the data layer — done
- Changed: policy.ts, helper allowlists on every generic write, shared reference check, policy-based filters, table-driven permission tests; duplicateForNextPeriod passes tasks.create only accepted line fields; known-failures (B11 removed)
- Evidence: verify.mjs exit 0; tests now passing: B11; PR #9
- Notes: owner decision C; verifier PASS under the run-wide blocking rule; accepted gaps (logResponse/recordOutcome references, stored-client checks, read paths ignoring active) owned by U20

## 2026-10-27 U07 Permission policy enforced in the data layer — blocked
- Changed: policy.ts, helper allowlists, shared reference check, policy-based filters and table-driven tests on branch u07-permission-policy (draft PR #9), not merged
- Evidence: verify.mjs exit 0; tests now passing: B11 (on the branch); PR #9
- Notes: BLOCKED: the owner-authorised final attempt failed verification (4 blocking findings in docs/state/reviews/U07.md); per the owner's conditions no further attempt; decision queued (options A, B, C)

## 2026-10-27 U15 Dev menu set today survives its reload — done
- Changed: lib/dates.ts persists the override in localStorage and reads it at module load; known-failures (B12 removed)
- Evidence: verify.mjs exit 0; tests now passing: B12; PR #12
- Notes: T1 no verifier; override only changes today, an existing persisted store keeps its dates

## 2026-10-27 U14 Small correctness fixes batch — done
- Changed: dates.ts Manila formatting + nowInManila + formatDuration, packList copies, record cost fields, task header period label, palette rename, mock timestamps
- Evidence: verify.mjs exit 0; tests now passing: U14(B15,B22,B23,B25,B28,B29); PR #11
- Notes: verifier PASS; B25 test only red on non-Manila devices (CI is UTC); leftovers queued

## 2026-10-27 U09 Uploaded files persist across reloads in IndexedDB — done
- Changed: lib/files (IndexedDB store, spec 9.9 names, saveFile), mock upload/replace/getUrl, useFileSrc and stored-file components, fake-indexeddb 6.2.6, known-failures (B05 removed)
- Evidence: verify.mjs exit 0; tests now passing: B05, U09(B24); PR #10
- Notes: verifier PASS on round 2 (round 1 caught the grid download); one existing documents test retargeted to a waiting line; carries the U07 blocked record

## 2026-10-27 U07 Permission policy enforced in the data layer — blocked
- Changed: policy.ts and mock guards on branch u07-permission-policy (draft PR #9), not merged
- Evidence: verify.mjs exit 0; tests now passing: B11 (on the branch); PR #9
- Notes: BLOCKED after three failed verifier rounds; three narrow helper field-level holes remain; decision queued in QUEUE.md

## 2026-10-27 U06 QueryState on every data page, 403/404 views, real error page — done
- Changed: ui/query-state, domain/errors, routes/error-page, router errorElement, 17 routes gated, typed throws in mock get, main.tsx retry, known-failures (B03, B10 removed)
- Evidence: verify.mjs exit 0; tests now passing: B03, B10, U06(B13,B14); PR #8
- Notes: verifier PASS; settings gated on session only; other pages queued; gate run on clean worktree

## 2026-10-27 U05 Enrich sample data to spec section 18 — done
- Changed: new seed-demo.ts generator merged into the mock store; 8 clients, 9 unverified templates, 26 open tasks, V1/V2/V3, six months of history; seed-links test uses list calls
- Evidence: verify.mjs exit 0; tests now passing: demo-seed unit tests (2 seed days); PR #7
- Notes: Demo ready. T1 no verifier; first-pass % follows from fixed return counts (about 54% to 85%); client codes DCL/MLA/SCL not added, base ids kept

## 2026-10-27 U04 Valid notification links, dev tools only in mock mode, pinch zoom — done
- Changed: mock seed ids for notifications/activity, lib/data-source isMockData gating shell banner/DevMenu/palette persona, index.html viewport, known-failures (B09 removed)
- Evidence: verify.mjs exit 0; tests now passing: B09, U04(B18,B19); PR #6
- Notes: verifier PASS; sign-in persona chooser and Reset Sample Data left ungated (QUEUE proposal)

## 2026-10-27 U03 Templates screen and Welcome read real templates — done
- Changed: settings TemplatesSection (new) + welcome step 3 read useTemplates; markVerified via hook; hooks useTemplateLines/useMarkTemplateVerified; FREQUENCY_LABELS; known-failures (B07 removed)
- Evidence: verify.mjs exit 0; tests now passing: B07, U03; PR #5
- Notes: T1 no verifier; mock markVerified still lacks sourceRef enforcement (U07/U08); gate run on clean worktree

## 2026-10-27 U02 Blocked tasks change status only through owner override — done
- Changed: rules.ts canSetStatus blocked=false + canCompleteWithEvidence; mock setStatus/markSubmitted/markCompleted enforce rules; board shows blocking reason; known-failures (B04 removed); QUEUE item for stray draft spec
- Evidence: verify.mjs exit 0; tests now passing: B04, U02; PR #4
- Notes: verifier PASS; gate run on a clean worktree because an untracked draft spec the guard would not let me edit fails locally (see QUEUE)

## 2026-10-27 U01 Finish visit requires saved outcomes — done
- Changed: rules.ts canFinishVisit + RuleViolationError, mock visits.finish guard, record.tsx saved-only counter, useRecordVisitOutcome invalidates visit, known-failures (B02 removed)
- Evidence: verify.mjs exit 0; tests now passing: B02, U01; PR #3
- Notes: verifier PASS; hooks file outside listed scope (cache key fix) noted in PR; canFinishVisit([]) is true by assumption

## 2026-10-27 U00 Quality gate tooling + Rules-of-Hooks fix — done
- Changed: gate devDependencies (exact-pinned), package.json scripts, vite.config.ts vitest include, record.tsx and summary.tsx hook order, known-failures.json (B01 removed)
- Evidence: verify.mjs exit 0; tests now passing: B01; verifier PASS; PR #2
- Notes: typescript-eslint pinned 8.72.0 (8.72.1 under 7 days old); 376 lint warnings left out of scope; no UI change.

## Session 2026-10-27 (Layout Density Engine & Live Preview)
- Root Cause Analysis:
  - Discovered that while `ox-density` was stored in `localStorage` and `data-density` was stamped onto `document.documentElement`, there were zero CSS rules or component styles targeting `[data-density="compact"]`. Consequently, toggling between Comfortable and Compact had no effect on any row heights or spacing.
- Implemented Section 9.10 Layout Density engine (`src/styles/base.css`):
  - Defined CSS density tokens on `:root`: `--density-table-row-h`, `--density-table-cell-py`, `--density-table-head-py`, `--density-list-py`, `--density-gap`.
  - Added universal compact table overrides:
    - Reduced `table th` padding to `0.35rem` (~30px tight header).
    - Reduced `table td` padding to `0.35rem` (~34px row height, matching the spec of 32-36px).
    - Auto-scaled table avatars, thumbnails (`w-10 h-10` -> `1.75rem`), status chips, and action buttons.
  - Added compact list and feed overrides for `.divide-y` items across the application.
- Initialized zero-flash density pre-paint script (`index.html`):
  - Ensured `ox-density` defaults to `comfortable` immediately on document head execution.
- Enhanced Appearance Settings UI (`src/routes/settings/page.tsx`):
  - Added active pill badges, selection rings, and visual wireframe density indicators to the Comfortable and Compact option cards.
  - Built an interactive live density preview table under the selectors displaying real sample tax filings, live row height indicator chips (`44px` vs `34px`), and caption detailing application-wide synchronization.
- Verification & QA:
  - TypeScript type check (`npx.cmd tsc --noEmit`) clean with 0 errors.
  - 16 test files passed (118 tests passed) via `npm.cmd run test:run`.
  - Automated browser subagent verified real-time row height changes in Settings, `/tasks` list view, and `/clients` directory.
  - Full verification gate passed via `scripts/verify.ps1`.

## Session 2026-10-27 (Curated Multi-Tonal Color Palettes & Appearance Settings)
- Researched and implemented 6 dual/triadic harmonic color palettes tailored for tax compliance, accounting, and long-session eye comfort:
  - `Classic Amethyst`: Royal violet & deep sea teal (original heritage tax seal).
  - `Manila Terracotta`: Warm Intramuros clay & slate navy (warm spectrum, low blue-light eye strain).
  - `Pine & Brass`: Emerald pine & warm amber brass (traditional ledger book calm).
  - `Maritime Cobalt`: Deep Pacific cobalt & burnished copper (high-contrast institutional clarity).
  - `Bureau Vermilion`: Official BIR carmine & warm golden sand (documentary seal authority).
  - `Monolith Obsidian`: Architectural graphite & solar honey gold (minimalist neutral focus).
- Tokenized CSS systems (`src/styles/tokens.css`):
  - Added dedicated token sets for `[data-palette="terracotta"]`, `[data-palette="pine"]`, `[data-palette="cobalt"]`, `[data-palette="vermilion"]`, and `[data-palette="obsidian"]`.
  - Configured complete light and dark mode variants with calibrated contrast for `--stamp`, `--stamp-strong`, `--stamp-soft`, `--stamp-ink`, `--on-stamp`, `--focus`, categorical chart tokens `--series-1` through `--series-6`, and sequential heatmap tokens `--seq-100` through `--seq-700`.
- System theme integration and zero-flash persistence (`src/app/theme.tsx`, `index.html`):
  - Defined `PaletteId` union, `PaletteDefinition` interface, and exported `PALETTES` specification.
  - Added `palette` state, `setPalette` dispatcher, and `ox-palette` localStorage persistence with DOM `data-palette` attribute synchronization.
  - Added pre-paint script restoration in `index.html` to eliminate any visual flash of unstyled theme on load or refresh.
- Settings Appearance UI (`src/routes/settings/page.tsx`):
  - Built interactive "Color Palette & Visual Tone" grid in the Appearance tab featuring dual-swatch preview bars, palette titles, descriptions, and active check indicators.
- Command Palette quick-switch (`src/components/command-palette.tsx`):
  - Integrated dedicated "Color Palettes" command group in `Ctrl+K` palette with live swatch dots, search keywords, active badges, and instant keyboard selection.
- Verification & QA:
  - TypeScript type check (`npx.cmd tsc --noEmit`) clean with 0 errors.
  - 16 test files passed (118 tests passed) via `npm.cmd run test:run`.
  - Automated browser subagent verified visual switching across all 6 palettes, light/dark modes, dashboard accents, and Command Palette shortcuts.
  - Full verification gate passed via `scripts/verify.ps1`.

## Session 2026-10-27 (Responsive Layout & Multi-Scale Hardening)
- Resolved sidebar text bleed and clipping when compacted or viewed on tablet/narrow viewports (`src/app/shell.tsx`):
  - Fixed aside width ternary to strictly reflect `collapsed ? 'w-[72px]' : 'w-[248px]'`, eliminating the mismatch where `sm:w-[72px]` forced 72px rail width while React rendered full text labels and expanded layout.
  - Added auto-collapse logic on screens < 1024px with resize event listeners while respecting manual toggling.
  - Enforced `overflow-x-hidden` on navigation links and wrapped text in `truncate min-w-0` to eliminate clipped characters.
  - Aligned center notch toggle button orientation (`>` when collapsed, `<` when expanded) and ensured active menu indicators never collide with the notch pill.
- Enhanced header bar responsiveness and mobile accessibility (`src/app/shell.tsx`):
  - Added dedicated mobile search button in header opening `CommandPalette` (`Ctrl+K`).
  - Added a mobile slide-over drawer triggered by a header hamburger menu button, exposing all 13 application routes and user profile/sign-out on screens < 640px.
  - Constrained top bar search input (`max-w-xs md:max-w-sm lg:max-w-md`), shortened practice name display on tablet, and hid secondary action text on smaller viewports.
- Hardened SVG charts fluid scaling across laptop, tablet, and mobile (`src/components/insights/svg-charts.tsx`, `chart-frame.tsx`, `src/routes/insights/page.tsx`):
  - Removed fixed `style={{ height }}` constraints from `SvgLineChart`, `SvgBarChart`, `SvgStackedBarChart`, and `SvgHorizontalBarChart`, replacing with `className="w-full h-auto select-none"`.
  - Allowed charts to span the entire card width fluidly without horizontal overflow or 200px empty side margins.
  - Added `min-w-0 overflow-hidden` to KPI tiles, `ChartFrame`, and overview chart grids.
- Added horizontal scrolling containers with `min-w-[700px]` to calendar Month and Week grids (`src/routes/calendar/page.tsx`) to prevent day squishing on mobile and portrait tablet.
- Full verification passed (`tsc --noEmit`, 118 vitest tests, `vite build`, `scripts/verify.ps1`).
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
- Built Section 9 Core Component Library:
  - Section 9.1 `Button` with Primary, Secondary, Ghost, Danger, Icon variants, loading spinner, and keyboard focus rings.
  - Section 9.3 `MoneyInput` (stores integer centavos, tabular formatting, ₱ prefix, quick-fill chips) and `NumberStepper` (-/+ buttons, rapid hold repeat).
  - Section 9.4 Identity inputs: `TinInput` (`###-###-###-#####`), `MaskedTin` (30s timed reveal toggle), `PhoneInput` (PH mobile & landlines, E.164 conversion, tel/sms actions), `EmailInput`.
  - Section 8.6 & 9.7 `ReviewStamp` (double rule, -3° deterministic rotation, SVG feTurbulence ink texture, stamp-press animation, variants: line, ready, done, received).
  - Section 9.7 Status indicators: `StatusChip`, `LineChip`, `DueBadge`, `AuthorizationBadge`, `ReadinessMeter`, and `ClientFlag`.
- Expanded `/dev/states` Component State Gallery to exercise all four canonical states (Loading Skeleton, Empty State, Error with Retry, Populated View) in both Light & Dark modes.

## Session 2026-10-25 (M2 Today, Search & Notifications)
- Implemented full Section 11.3 Today Focus Dashboard (`src/routes/today/page.tsx`):
  - Two-column responsive desktop layout (>=1280px) and collapsible single-column layout on smaller viewports.
  - Manila date header with "X need you · Y visits this week" and "Mine / Everyone" scope toggle (owner-only, remembered).
  - Interactive count strip button pills (`Overdue`, `Due this week`, `Blocked by client`, `Awaiting my review`, `Follow-ups due`, `Visits this week`) with smooth scroll targeting.
  - Left column: Urgent filings with `DueBadge` and `StatusChip`, Received review items with interactive `ReviewStamp` accept animation and issue flagging, Blocked client groups with "Request missing" CTA, and Ready for action tasks with "Mark submitted" / "Add to visit".
  - Right rail: Next visits with `ReadinessMeter` and READY badge, Follow-ups due today with client chips, Expiring authorizations, 14-day mini calendar strip, and Recent activity log.
  - Strict helper role scoping: Switching to Ben Morales strictly confines all tasks, review lines, visits, and count pills to assigned clients (`client-rsp` and `client-cruz`).
- Implemented Global Command Palette (`src/components/command-palette.tsx`):
  - Powered by `cmdk` with global keyboard listener (`Ctrl+K`, `Cmd+K`, and `/` key outside input fields).
  - Search across Quick Actions (new task, new client, open period, plan visit, toggle theme, switch persona), Navigation routes, Clients, and Tasks.
  - Top bar search bar wired directly into the palette with clickable trigger.
- Implemented Global Search Results Page (`src/routes/search/page.tsx`):
  - Categorized results across Clients, Tasks, Documents, Visits, Follow-ups, Payments, and Offices with top-5 pagination and "Show all" toggles.
  - Matched search terms highlighted with `--stamp-soft` background.
  - Recent search query chips with localStorage persistence.
- Implemented Notifications System (`src/components/notifications-popover.tsx` and `src/routes/notifications/page.tsx`):
  - 400px header bell popover displaying latest 10 notifications with unread dot indicators, timestamps, and "Mark all read" action.
  - Full notifications center page with day grouping (`Today`), filter tabs (`All` / `Unread`), and read/unread status.
- Verification: 20 unit tests green (rules, metrics, mock today queue with helper scoping), TypeScript compilation clean (`0 errors`), and automated browser subagent QA verified all 5 milestone criteria.

## Session 2026-10-25 (M3 Clients: Directory, Profile Tabs, Forms & CSV Import)
- Implemented full Section 11.7.1 Clients Directory List (`src/routes/clients/page.tsx`):
  - Desktop table view with Code folder tab, Client Name, ClientFlags (Entity, VAT, Filing channel/group, RDO), Open Tasks count, Blocked Tasks count, Next Due badge (`DueBadge`), Authorization status (`AuthorizationBadge`), and Assigned user chips.
  - Mobile card layout with client summary line (`"X open · Y blocked · next due Oct 28"`).
  - Built-in view tabs: `Active` (default), `Has blocked tasks`, `Authorization needs attention`, `Archived`.
  - Filter bar: instant search by name, code, contact, or TIN; entity type, VAT status, filing channel, eFPS group, and assigned user dropdowns.
  - Export CSV trigger using `@/lib/export` with UTF-8 BOM encoding.
- Implemented Section 11.7.2 Client Profile with full 9-tab architecture (`src/routes/clients/detail.tsx`):
  - Header: folder tab with client code, legal registered name, ClientFlags, Masked TIN with 30s timed reveal toggle writing audit event, RDO office link, filing channel, ORUS access holder, and summary line.
  - Attention strip: dynamic warnings for expiring authorizations (<30 days), missing signatories, unknown ORUS holder, or unassigned client.
  - Full tab architecture: `Overview`, `Tasks`, `History`, `Documents`, `Follow-ups`, `Payments`, `Authorizations`, `Contacts`, `Notes`.
  - Action buttons: "New Task", "Request Missing" (generates consolidated checklist message for Viber/SMS/Email), "Edit Client", "Archive Client" (with required reason modal), "Restore Client", and "Print Profile".
- Implemented Section 11.7.3 & 12.2 Client Registration Form Sheet (`src/components/clients/client-form-sheet.tsx`):
  - Slide-over sheet with initial-derived code suggestion ("Rivera Salonga & Partners" -> "RSP"), entity type radio cards (GPP, Solo, Other), RDO picker.
  - Collapsible sections for BIR Registration parameters, Filing channels & ORUS access, and practice notes.
  - Security policy banner prohibiting storage of eFPS, eBIRForms, and ORUS credentials.
  - Live dynamic amber warning detector for notes containing password patterns.
- Implemented Section 12.3 & 12.12 Contact & Authorization Modals:
  - `ContactFormModal` (`src/components/clients/contact-form-modal.tsx`): Contact name, title, role suggestions, PhoneInput (E.164), EmailInput, preferred channel, language, and signatory switch.
  - `AuthorizationFormModal` (`src/components/clients/authorization-form-modal.tsx`): Document type (SPA, Letter, Sec Cert, Resolution), grantee user, scope task kinds checkboxes, DateField issuance/validity, and notarized switch. Supports replacing an active document while preserving predecessor in history.
- Implemented Section 11.7.4 CSV Client Import Wizard (`src/routes/clients/import.tsx`):
  - 4-step wizard: Upload CSV with downloadable CSV sample template -> Intelligent column mapper -> Preview & validation table (Ready, Error, Duplicate code/name detection) -> Commit summary ("X added, Y skipped") with 5-minute undo rollback countdown.
- Verification: 25 unit tests green (`src/data/mock/clients.test.ts` exercising listing, helper scoping, TIN reveal audit, archiving, duplicate validation, and batch undo), TypeScript compilation clean (`0 errors`), and automated browser subagent verified directory, profile tabs, and import wizard.

## Session 2026-10-25 (M4 Tasks, Board & Open Period Wizard)
- Implemented full Section 11.4 Tasks Directory & Kanban Board (`src/routes/tasks/page.tsx`):
  - Header with task counter badge, responsive view switcher (`[List | Board]`), "Open Filing Period" button (opens `OpenPeriodModal`), and "New Task" button (opens `NewTaskSheet`).
  - Built-in view tabs: `All open` (default), `My tasks`, `Overdue`, `Blocked by client`, `Needs my review`, `Ready for a visit`, `Ready for desk filing`, `Submitted — awaiting confirmation`, and `Completed this month`.
  - Filter bar: instant text search by client name, code, or task title; dropdown filters for Client, Status Groups (`blocked`, `in_progress`, `ready`, `submitted`, `done`), Kinds (`filing`, `payment`, `registration`, `one_time_transaction`, `lgu`, `other`), Assigned user, and Period with "Clear filters" action.
  - Table / List view: Columns for Client (folder tab code + name), Task (template code + title), Period, Status (`StatusChip` with override marker dot), Due (`DueBadge`), Ready progress mini-meter ("X of Y accepted" with percentage bar), Next action (line with owner and target date), Owner (`UserChip`), and action link.
  - Kanban Board view (`?view=board`): 8 lifecycle columns (`Not started`, `Waiting on client`, `Needs review`, `Needs correction`, `In preparation`, `Ready for action`, `Submitted`, `Completed`). Derived columns feature lock icons explaining automatic derivation from lines; operator columns feature "Move to..." transition menus wired to `canSetStatus` rules. Transitions to Submitted trigger `MarkSubmittedDialog`; transitions to Completed trigger `MarkCompletedDialog`.
- Implemented full Section 11.5 Task Detail View (`src/routes/tasks/detail.tsx`):
  - Header: Client folder tab link, Task template code & title, Period, `StatusChip` with override explanation tooltip, `DueBadge` with statutory source note ("Due Oct 31 · template default" or "Moved to May 15 · RMC 30-2026"), and NextActionLine with quick inline edit modal.
  - Large authentic `done` `ReviewStamp` rendered on completed tasks with evidence counts.
  - Dynamic Primary Action Button (Section 11.5.2) adapting automatically based on task state (`Request missing`, `Review lines`, `Request corrections`, `Add to visit`, `Open visit`, `Mark submitted`, `Mark completed`, `Reopen`).
  - Overflow Menu: `Override status` (owner only with >=10 char audit reason), `Change due date` (owner only with statutory ref & reason), `Reassign owner`, `Duplicate for next period`, `Print client checklist`, and `Archive task`.
  - Left column: Unverified template warning banner, Blocking banner (with missing line count and blocker breakdown), Document Requirements Checklist (`ChecklistRow` with `LineChip`, "Bring to office" indicator, "Added late" pill for items added within 3 days of due date, interactive "Mark Received", and "Stamp Accept" playing authentic `-3°` physics bounce `ReviewStamp`), and Evidence Grid (tiles for Filed return, Acknowledgment, and Payment proof with upload triggers).
  - Right rail: Obligation details (filing channel, owner, statutory RDO, office action flag, payment expected flag), Authorization coverage card (`AuthorizationBadge` with SPA validation), Office visits for this task with past outcomes, and Open follow-ups with attempt counters.
- Implemented Task Action Modals (`src/components/tasks/task-modals.tsx`):
  - `MarkSubmittedDialog` (submission date, filing channel, confirmation ref number, acknowledgment upload).
  - `MarkCompletedDialog` (completion date, required evidence verification or non-evidence justification reason).
  - `OverrideStatusDialog` (owner-only status override requiring >=10 character audit reason).
  - `ChangeDueDateDialog` (owner-only due date adjustment requiring statutory reference and reason).
  - `AddChecklistLineModal` (custom requirement label, copy form, copy count, supplied by, print & bring toggle).
  - `ArchiveTaskDialog` (archive reason).
- Implemented Section 11.5.6 & 12.4 New Task Drawer (`src/components/tasks/new-task-sheet.tsx`):
  - Template selection vs One-off errand switcher, automatic statutory due date computation with source notes, and collision check detecting active duplicates (`client + template + period`) and preventing duplicate creation.
- Implemented Section 11.6 Open Period Wizard (`src/components/tasks/open-period-modal.tsx`):
  - 800px 3-step modal: Period selection -> Client scope multi-select -> Client × Template matrix with collision check skipping already open tasks -> Batch creation summary toast.
- Verification: 31 unit tests green (`src/data/mock/tasks.test.ts` exercising derived status computation, `canSetStatus` blocker enforcement, owner status override, due date update with statutory reference, open period idempotence, and "Added late" detection), TypeScript compilation clean (`0 errors`), full `verify.ps1` gate passed, and automated browser subagent QA verified all task workflows.
## Session 2026-10-25 (M5 Documents Library, Compression Pipeline & Preview Drawer)
- Implemented Section 9.8 & 9.9 Document Pipeline & Compression Utilities (`src/lib/compression.ts`):
  - SHA-256 integrity calculation using Web Crypto API (`crypto.subtle.digest`) for duplicate detection.
  - Image compression pipeline via `browser-image-compression` targeting <= 600 KB WebP at 2000px longest side with aspect ratio and EXIF orientation preservation.
  - Dynamic 320px WebP thumbnail generator (`createThumbnail`).
  - Standardized naming convention (`formatStandardizedDocName`): `{CLIENTCODE}_{TEMPLATECODE}_{PERIOD}_{KIND}_v{N}.{ext}` with statutory kind slugs (`src`, `return`, `ack`, `payproof`, `stamped`, `ecar`, `auth`, `other`).
- Implemented Section 9.8 `FileTile` Component (`src/components/documents/file-tile.tsx`):
  - 72px thumbnail preview box with document type fallback icon and hover preview trigger.
  - Standardized display name with version badge (`v1`, `v2`), category kind badge with color tone, optimization indicator, and file size formatting.
  - Overflow action menu: Preview, Download, Replace with new version, Change file kind, and Remove (soft delete with reason).
- Implemented Section 9.8 `PreviewDrawer` Component (`src/components/documents/preview-drawer.tsx`):
  - 720px right-side sheet on desktop, full-screen on mobile.
  - Pure white canvas background (never color-inverted in dark mode per Section 22.22).
  - Viewer controls: Zoom in/out, fit-to-width, rotate 90°, print, and direct download.
  - Side details panel: Category kind, file size, upload timestamp, uploader user, and SHA-256 integrity hash.
  - Inline Review Footer: Directly renders "Stamp Accept" (primary, stamps line) and "Flag Issue" (secondary, logs correction note) when reviewing lines without leaving the preview.
  - Keyboard navigation: Left/Right arrow keys for previous/next file in collection, Escape key to close.
- Implemented Section 9.8 `FileDrop` Component (`src/components/documents/file-drop.tsx`):
  - Drag-and-drop zone with file type/size validation (JPEG, PNG, WebP, HEIC, PDF up to 15 MB).
  - Mobile/tablet environment camera capture trigger (`<input type="file" accept="image/*" capture="environment">`) with "Take photo / Add page".
  - Live upload progress tray showing compression feedback ("Optimizing… 3.4 MB → 420 KB"), progress bar, Cancel, and Retry.
  - SHA-256 duplicate warning alert notifying operator before attaching duplicate files to a client.
  - Invariant rule strictly preserved: Uploading a file to a line sets line status to `received`, never to `accepted`.
- Implemented Section 11.11 Documents Library Page (`src/routes/documents/page.tsx`):
  - Responsive view mode toggle between Table (Section 9.10) and Grid (thumbnails).
  - Header with document counter pill and "Upload Document" modal trigger.
  - Built-in view tabs: `All documents`, `Needs review`, `Evidence files`, and `Recently added`.
  - Filter strip: instant text search across document and client names; Client, Document Kind, and File Type (Image / PDF) dropdown filters with "Clear" action.
  - Table view: Sticky header, 72px thumbnail, standardized name, client tab, category kind, file size, uploader, date, and inline quick actions.
  - Grid view: Responsive card grid rendering `FileTile` components with rich preview capabilities.
- Verification: 38 unit tests green (`src/data/mock/documents.test.ts` exercising standardized naming, byte formatting, SHA-256 hash calculation, upload line transition to `received`, duplicate detection by SHA, helper access scoping, and soft delete with reason), TypeScript compilation clean (`0 errors`), full `verify.ps1` gate passed, and automated browser subagent QA verified all document workflows.
## Session 2026-10-25 (M6 Follow-ups, Client Messaging & Queue Walk-through)
- Implemented Section 11.8 & 12.13 Messaging Utilities (`src/lib/messaging.ts`):
  - Interpolated template variables (`interpolatePlaceholders`): `{{contact}}`, `{{client}}`, `{{task}}`, `{{period}}`, `{{items}}`, `{{due}}`, `{{deadline}}`, and `{{operator}}`.
  - Formatted numbered items checklist (`formatItemsList`) including copy form tag and flag notes (e.g. `1) Signed 2307s from payors (original)`).
  - Accurate SMS length estimation and multi-part segmentation (`calculateSmsSegments`): 160 GSM-7 / 153 per part; 70 UCS-2 Unicode / 67 per part.
  - Native communication intent URI builders (`buildChannelIntent`): SMS (`sms:?body=`), Email (`mailto:?subject=&body=`), and Viber (`viber://forward?text=`).
- Implemented Section 11.8 `MessageComposer` Component (`src/components/follow-ups/composer.tsx`):
  - Responsive sheet on desktop, full-screen on mobile.
  - Contact selector showing preferred channel and language.
  - Language toggle (`English` / `Filipino`) updating template selection and message copy.
  - Template selector populated with statutory English and Filipino templates (Initial request, Reminder, Correction).
  - Interactive requested lines checklist enabling selective inclusion of items in the generated message.
  - Live editable textarea preview with real-time character count and SMS segment counter.
  - Direct shortcut buttons for Viber, SMS, Email, and Messenger with automatic clipboard fallback and Sonner toast.
  - "Mark as sent" button highlights after copying/dispatching, recording the attempt snapshot and moving follow-up to Waiting.
- Implemented Section 12.13 Follow-up Action Modals (`src/components/follow-ups/follow-up-modals.tsx`):
  - `LogResponseModal`: captures client response text, checkboxes for lines now received (updates task lines to `received`), and received channel. Automatically resolves follow-up when all requested lines are received.
  - `EscalateModal`: enforces >=10 character escalation reason, updates status to `escalated`, moves follow-up to top of Overdue, and writes audit event.
  - `ResolveModal`: manual resolution modal requiring >=10 character reason.
  - `NewFollowUpModal`: client picker, task picker, contact picker, channel selector, and expected-by DateField.
- Implemented Section 11.8 Follow-ups Directory Page (`src/routes/follow-ups/page.tsx`):
  - Summary count strip button cards (`Due Today`, `Overdue`, `Waiting on Client`, `Resolved`).
  - Filter tabs: `Due today` (default), `Overdue`, `Waiting (sent)`, `Resolved (30d)`, and `All follow-ups`.
  - Filter strip: instant search by client, task, contact, or item; Client and Channel dropdowns.
  - Follow-up cards: Client code tab, legal name, attempt counter badge ("1st request", "2nd reminder"), channel badge, outstanding requirements list with copy form chips, contact details, and quick inline actions (Compose, Log response, Escalate, Resolve).
  - "Clear Due Today" button triggering the walk-through queue mode.
- Implemented Section 11.8 Queue Walk-Through Stepper Mode (`src/routes/follow-ups/run.tsx`):
  - Sequential walk-through cycling through due and overdue follow-ups one by one.
  - Top visual progress bar ("Follow-up X of Y") with "Exit Queue".
  - Dedicated focus card with outstanding items list, contact details, and inline MessageComposer.
  - Stepper controls: "Previous", "Escalate", "Skip", and "Send & Next".
  - Queue completion summary screen showing breakdown of items sent, escalated, and skipped with return CTA.
- Verification: 44 unit tests green across 7 test files (`src/data/mock/follow-ups.test.ts` exercising template interpolation, SMS calculations, markSent state transitions, logResponse line status updates, escalation reason validation, and helper access scoping), TypeScript compilation clean (`0 errors`), full `verify.ps1` gate passed in 7.65s, and automated browser subagent QA verified the follow-ups directory, MessageComposer, copy toast, and queue walk-through mode.

## Session 2026-10-25 (M7 Visits, Office Directory & Trip Pack)
- Implemented Section 11.9.1 Visits Directory Page (`src/routes/visits/page.tsx`):
  - Tabs: `Upcoming` (planned, in_progress), `Done`, `Cancelled`, and `All` with reactive count badges.
  - Search filter across office name, RDO code, and purpose.
  - Cards per visit: Office name with type icon (`Building2`, `Landmark`, `Building`), planned date & arrive-by time, assignee chip, task count, `ReadinessMeter` ("1 of 3 items ready"), and status badges (`READY TO GO`, `NOT READY (N BLOCKERS)` with itemized blocker list, `IN PROGRESS`, `DONE`).
  - Plan a Visit button triggering `PlanVisitSheet`.
- Implemented Section 11.9.2 Plan a Visit Sheet (`src/components/visits/plan-visit-sheet.tsx`):
  - Office Combobox populated from Offices directory with inline "+ Add office" trigger (`OfficeFormModal`).
  - DateField with Philippine weekend and holiday warning (`nonWorkingDayNote`).
  - Arrive-by time, assignee picker, and optional purpose text.
  - Candidate tasks picker with intended action selector (`Submit`, `Pay`, `Claim`, `Inquire`, `Follow up`) and blocking status warnings.
- Implemented Section 11.9.3 Visit Detail / Prepare View (`src/routes/visits/detail.tsx`):
  - Readiness banner with blocking items accordion naming specific unaccepted documents and expired authorizations per client.
  - Authentic `-3°` physics bounce `ReviewStamp` (`variant="ready"`) dynamically stamped on the header when 100% ready.
  - Counter Errand Items list: Intended action badge, client code tab, authorization validity check, and questions textarea with auto-save.
  - Physical Trip Pack Checklist (`packList`): Client-grouped physical documents with copy forms, copy counts, and `PackCheckbox` interacting with `useSetVisitPacked`; plus General Visit Kit items (Heavy-duty stapler, ballpoint pens, long brown folders, paperclips).
  - Departure Override Flow: Mandatory modal requiring $\ge 10$ character reason ("Leave without everything ready?"), logging `departureOverrideReason`, setting `startedAt`, moving status to `in_progress`, and switching to Record view.
- Implemented Section 11.9.5 Counter Record Screen (`src/routes/visits/record.tsx`):
  - Mobile-first counter recording interface with large touch targets ($\ge 44$ px) for use at BIR RDO, AAB, or LGU counters.
  - 7 RadioCard outcomes: `Completed`, `Submitted, waiting for processing`, `Paid, proof to follow`, `More documents requested`, `Correction required`, `Not accepted`, and `Follow-up visit needed`.
  - Cause selector grouped into Avoidable and Not avoidable, reactive avoidable toggle, counter note (required for "Other"), and officer/window name.
  - Dynamic sub-forms: "+ Add document" list for `more_documents_requested` creating new checklist lines; affected lines checkbox picker for `correction_required`.
  - Next action triage (action description, due date, owner) and evidence attachment with camera/file upload simulation.
  - Finish visit modal: Captures trip end time and out-of-pocket expenses (transport, parking, other in centavos) and redirects to Visit Summary.
- Implemented Section 11.9.6 Visit Summary Page (`src/routes/visits/summary.tsx`):
  - Large `done` stamp (`ReviewStamp variant="done"`) displaying attached evidence count.
  - Summary metrics: Total trip duration ("1 h 45 min"), expense totals, and repeat trips created analysis ("X avoidable, Y not avoidable").
  - Outcome per item review with next action links and navigation back to Today or Visits.
- Implemented Section 11.9.4 Printable Trip Pack (`src/routes/visits/print.tsx`):
  - Print-ready black-and-white portrait layout adhering to `print.css`, supporting A4, Letter, and Long 8.5 x 13 in legal paper size.
  - Folder tab client outlines, drawn 4mm square checkboxes (`[ ]`), copy counts, masked TINs only (never full TIN), and 3 blank ruled lines for counter notes.
- Implemented Section 11.13 Offices Directory Page (`src/routes/offices/page.tsx`):
  - Full directory with tabs: `All`, `BIR RDOs`, `Agent Banks (AAB)`, `City Halls (LGU)`, `SEC`.
  - Search filter by office name, RDO code, address, and counter tips.
  - Prominent "Operator Counter Tip" callout box on each card, map links, operating hours, and telephone.
  - Add / Edit Office modal (`OfficeFormModal`) supporting full CRUD on office entities.
- Verification: 53 unit tests green across 8 test files (`src/data/mock/visits.test.ts` exercising readiness determination, physical pack list generation, pack state toggling, departure override logging, Spec 16.6 outcome mappings, expense handling, and office directory management), TypeScript compilation clean (`0 errors`), full `verify.ps1` gate passed in 11.28s, and automated browser subagent QA verified all visits and offices workflows.

## Session 2026-10-25 (M8 Calendar & Payments)
- Implemented full Section 11.10 Tax Calendar (`src/routes/calendar/page.tsx`):
  - Custom date grid built entirely on `date-fns` (never an external calendar library) respecting Manila date formatting.
  - Three distinct views: `Month` (standard desktop grid with weekday headers, today indicator, up to 3 items per cell + "+N more" badge opening an items popover), `Week` (7-day column schedule), and `Agenda` (chronological list with day headers and overdue/due-today grouping, optimized for mobile).
  - Multi-item aggregation from `repositories.calendar.range`: Task due dates (colored by dueState: critical for overdue, warn for due_today, info for on_track; blocked lock icon), Office visits (office short name, arrive-by time, readiness indicator), Holidays (Philippine regular & special non-working days), Client follow-up expected dates, Authorization expiries, and moved deadlines.
  - Rescheduling capabilities: Drag visit / Move date dialog with Undo toast; Task due date adjustment dialog (`ChangeDueDateDialog`) requiring new date, statutory source reference (e.g. BIR RMC circular), and operational reason.
- Implemented Section 11.12 & 12.8 Payments Register & Management (`src/routes/payments/page.tsx`):
  - Summary KPI cards: Total Recorded Payments (live sum in PHP), Proof Missing count with warning badge, and Pending Reimbursement count.
  - Built-in view tabs: `All` (default), `Proof missing` (warning tone), `To be reimbursed` (info tone).
  - Search and filter strip: Text search across reference numbers, client names, and provider; dropdowns for Client, Channel, and Paid By.
  - Interactive table: Paid on date, Client code folder tab and legal name, Reference number with one-click copy button and feedback toast, Channel & Provider, Amount formatted in integer centavos, Paid by badge (`Client` | `Me / Operator`), Reimbursement status chip, Proof attachment indicator, and Actions menu (Edit, Remove with reason modal).
  - Live Totals row at the bottom dynamically summing filtered rows in real-time.
  - Export menu supporting CSV (with UTF-8 BOM) and Microsoft Excel (.xls).
- Implemented Section 12.8 Record Payment Modal Sheet (`src/components/payments/record-payment-sheet.tsx`):
  - Slide-over sheet for recording BIR tax payments and teller transactions.
  - Fields: Client combobox, Task combobox (dynamically filtered to selected client's tasks), Amount (`MoneyInput` storing integer centavos, validated > 0), Paid on (`DateField`, validated not in future), Channel (`aab_otc`, `rco`, `online`, `other`), Provider (free text with suggestions like Landbank, DBP, GCash, Maya), Reference number (required for non-OTC channels), Paid by segmented switch (`Client` | `Me / Operator`), Reimbursement status controls when paid by operator (`waiting`, `reimbursed`, `not_needed`), Proof attachment with missing proof warning, and operational notes (<= 300 chars).
  - Domain rule Section 11.12: Recording a payment with proof on a task automatically clears next actions mentioning proof.
- Verification & Test Coverage:
  - 64 unit tests green across 9 test files (`src/data/mock/calendar-payments.test.ts` exercising payment register listing, integer centavos calculations, channel & reimbursement filtering, proofMissing queries, helper persona client scoping, payment CRUD with versioning, task proof clearance domain rule, calendar range derivations across task_due, visit, holiday, follow_up, auth_expiry, and statutory due date adjustments).
  - Full TypeScript typecheck clean (`0 errors`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 64 Vitest tests, Vite production build).
  - Browser subagent visual QA verified Calendar views (Month, Week, Agenda) and Payments register with modal form.

## Session 2026-10-25 (M9 Insights & Reports)
- Implemented Section 13 Insights Dashboards (`src/routes/insights/page.tsx`):
  - Top filter row: Date range selector (Last 6 Months, Q3, YTD), Owner switcher (owner only), Client filter, and Template filter with reactive query updates.
  - 6 KPI summary tiles on Overview: First-pass completion (86%, baseline ~55%), Avoidable repeat trips (1, baseline 4/month), Visits that left ready (92%), Follow-ups per task median (1.5), On-time filing rate (94%), and Tasks with owner and next action (97%).
  - Full 6-tab architecture (`overview`, `trips`, `chasing`, `deadlines`, `workload`, `clients`):
    - `Overview`: First-pass completion rate by month line chart with dashed baseline reference, Trips needing return stacked bars (Avoidable vs Not avoidable), Operator confidence trend, and Hours finding records per week.
    - `Trips`: Visits per month bar chart, Items per visit line chart, Outcomes by month 100% stacked bars with status tones, Why trips needed a return horizontal bars with Avoidable tags, Out-of-pocket visit expenses bar chart, and Office Counter Performance table.
    - `Chasing`: Follow-up messages sent per week, Follow-ups needed per completed task buckets (0, 1, 2, 3+), Client response turnaround days trend line, Late-discovered blockers bar chart, and Items most often missing table.
    - `Deadlines`: On-time filing compliance line chart with 90% SLA reference line, Upcoming filings heat calendar (8 weeks × weekdays), Overdue by age buckets, and Administrative deadline extensions table.
    - `Workload`: Tasks per operator horizontal bar chart, Tasks by status group stacked bar, Days to collect by template horizontal bar chart, and Tasks missing a next action table with direct navigation links.
    - `Clients`: Neutral client response profile table with client code tabs, open task counts, average response times, quarterly follow-ups, and repeat trips linked.
- Implemented Section 13.5 Reusable Chart Primitives & Container (`src/components/insights/chart-frame.tsx`, `src/components/insights/svg-charts.tsx`):
  - Pure SVG chart primitives (`SvgLineChart`, `SvgBarChart`, `SvgStackedBarChart`, `SvgHorizontalBarChart`, `SvgHeatCalendar`) adhering strictly to Ordinovix design tokens (`--series-*`, `--seq-*`, `--chart-grid`, `--chart-axis`) without heavy external charting libraries.
  - Accessible data table view toggle (`Show table` / `Hide table`) on every chart.
  - One-click CSV download on every chart.
  - Zero dual-axis charts anywhere in the application.
- Implemented Section 11.14 Reports & Registry Exports Hub (`src/routes/reports/page.tsx`):
  - Print format configuration controls: Paper size selector (A4, Letter, Long 8.5 × 13 in), Include masked TIN toggle, Include rule lines toggle.
  - Formatted printable & PDF generators: Client Requirement Checklist (with English / Filipino language switch), Client Annual Compliance History (one client, one year retrospective), and Monthly Operations Summary.
  - 7 Core Registry Exports with UTF-8 BOM encoding and formatted Excel: Clients Registry, Filing Tasks Log, Checklist Requirements, Follow-ups & Chasing, Visits & Outcomes, Tax Payments Summary, and Audit Activity Log.
  - Full Practice Database Backup (JSON download) for owner persona.
- Verification & Test Coverage:
  - 73 unit tests green across 10 test files (`src/data/mock/insights-reports.test.ts` exercising KPI formulas matching `src/domain/metrics.ts` calculations, tab data structures, checklist report generation, annual history, monthly summary, and full JSON backup).
  - Full TypeScript typecheck clean (`0 errors`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 73 Vitest tests, Vite production build).
  - Automated browser subagent visual QA verified all 6 Insights tabs, chart table toggles, and Reports export cards.

## Session 2026-10-25 (M10 Settings, Onboarding, Audit Log, Help & Error Pages)
- Implemented Section 11.1 Sign-in & Access Pending (`src/routes/sign-in/page.tsx`, `src/routes/access-pending/page.tsx`):
  - `/sign-in`: Centered on `--paper` (max 400px) with 48px logomark, branded Google sign-in button ("Continue with Google"), allowlist security note ("Only people the owner has added can sign in"), and mock persona switcher (`[ Continue as Ana — Owner ]` & `[ Continue as Ben — Helper ]`).
  - `/access-pending`: Centered warning card for unauthorized accounts with clear copy ("You're signed in as maria.unauthorized@gmail.com, but this account hasn't been added to Ordinovix. Ask the owner to add this email address in Settings -> Users & Access.") and actions to "Use a different Google account" or "Sign out" with zero app data loaded.
- Implemented Section 11.2 First-run Setup Wizard (`src/routes/welcome/page.tsx`):
  - 5-step onboarding wizard in centered 640px panel with progressive step indicator ("Step X of 5") and `--stamp` progress bar.
  - Step 1 (Your details): Display name in messages ({{operator}}), practice name, mobile number, and optional BIR Tax Agent accreditation number & validity date.
  - Step 2 (Add clients): 3 choices as RadioCards (Import a spreadsheet, Add one at a time, Do this later).
  - Step 3 (Choose task types): Obligation templates checklist grouped by cycle with unverified warning notice.
  - Step 4 (Invite a helper): Helper Google account email and client scoping controls (All clients vs Specific clients).
  - Step 5 (Phone install): Instructions for Android (Chrome Add to Home screen) and iPhone (Safari Share -> Add to Home Screen) with "Turn on reminders" push notification toggle.
  - Finish action lands on Today with confirmation toast.
- Enhanced Section 11.17 Settings Hub (`src/routes/settings/page.tsx`):
  - 13-tab two-column layout with URL route synchronization (`/settings/:tab`).
  - Strict Helper scoping: As Ben Morales (helper), navigation strictly exposes only Profile, Appearance, Notifications, Task templates (read-only view), Security, and About; owner-only tabs are hidden and direct route access displays an access denied guard.
  - Before Ordinovix Baseline (Section 12.15): Assessment period dates, office trips/month, repeat trips/month, follow-up messages/week, hours finding records/week (step 0.5), filings late/quarter, confidence (1–5 RadioCards), discovery notes, and persistence via `useSaveBaseline`.
  - Task Templates (Section 12.10): Verification modal strictly enforcing statutory source reference (e.g. NIRC / RR circular) before marking verified; helper view restricted to read-only.
  - Data & Backups (Section 11.17): Practice archive export (JSON download), automated 7-year statutory retention backup status, and Reset sample data trigger (`devControls.reset()`).
- Section 11.18 Audit Log & Section 11.19 Help (`src/routes/audit/page.tsx`, `src/routes/help/page.tsx`):
  - Audit log table with owner access restriction (helpers receive 403 Access Denied), event filters (Sensitive, Overrides), and CSV export.
  - Help center with 18-term tax/legal Glossary, 4-stage task and requirement flow diagram, global keyboard shortcuts, and "What Ordinovix does not do" statutory disclaimer.
- Section 11.20 Error Pages (`src/routes/not-found.tsx`): 404 page with Today and Search actions.
- Verification & Test Coverage:
  - 81 unit tests green across 11 test files (`src/data/mock/settings.test.ts` exercising baseline save/retrieve with version increments, audit log owner access, helper audit query restriction, helper entity activity scoping, and statutory template verification rules).
  - Full TypeScript typecheck clean (`0 errors`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 81 Vitest tests, Vite production build).
  - Browser subagent visual QA verified `/sign-in`, `/access-pending`, `/welcome`, `/settings` (both Ana and Ben personas), `/audit`, and `/help`.

## Session 2026-10-25 (M11 Polish, PWA, Accessibility & Privacy Mode)
- Implemented Section 19.3 PWA & Installable Web App:
  - Created Web App Manifest (`public/manifest.webmanifest`) with standalone display, `#EEF1F4` theme/background color, and high-contrast SVG icons (`icon-192.svg`, `icon-512.svg`).
  - Linked manifest and apple-touch-icon in `index.html`.
  - Added native `beforeinstallprompt` event listener in `src/app/shell.tsx` with top bar "Install App" button and installation prompt dispatch.
- Implemented Section 19.1 & 19.2 Accessibility (WCAG 2.2 AA):
  - Accessible "Skip to main content" link at top of document tree focusing `#main-content`.
  - Proper landmark `<main id="main-content" tabIndex={-1}>` wrapping route content.
  - 72px scroll padding (`scroll-padding-top: 72px`) in `src/styles/base.css` ensuring headers are not obscured when navigating to anchor tags.
  - Root text scaling overrides for user preferences (`data-text-scale="112.5"`, `data-text-scale="125"`).
  - Reduced motion media query overrides (`prefers-reduced-motion: reduce`) damping animations.
- Implemented Section 19.5 Privacy Mode & Idle Lock:
  - Top bar Privacy Mode toggle with `Shift+P` global keyboard shortcut.
  - When enabled, applies `.privacy-mode` to the root container, blurring sensitive taxpayer identifiers (TINs, client names, tax amounts, sensitive data attributes) with seamless unblur on `:hover` and `:focus-within`.
  - Idle Lock curtain overlay respecting configurable inactivity timeout (`localStorage['ordinovix:idle_timeout']`, default 15 minutes) with user activity listeners (`mousemove`, `keydown`, `scroll`, `touchstart`) and "Unlock Session" modal action.
- Implemented Section 19.6 High-Fidelity Print Stylesheet (`src/styles/print.css`):
  - Strict print rules per Section 19.6: 11pt body text, 9pt meta text, 4mm physical bordered square checkboxes (avoiding Unicode rendering artifacts on dot-matrix/inkjet printers), `@page` margin rules, and page break avoidance.
- Implemented Section 19.8 Local Ring Buffer Error Logger (`src/lib/error-buffer.ts`):
  - In-memory ring buffer holding the last 50 frontend errors with timestamps, URLs, and caller context.
  - Automatic credential sanitization redacting password and secret patterns.
  - Diagnostic report generator (`generateDiagnosticReport`) exporting browser environment, screen dimensions, theme, and error history.
- Implemented Section 19.4 Performance & Code Splitting (`src/app/router.tsx`, `vite.config.ts`):
  - Route-level dynamic code-splitting via `React.lazy` and accessible `Suspense` loading fallback for non-core routes (`CalendarPage`, `DocumentsPage`, `InsightsPage`, `ReportsPage`, `SettingsPage`, `AuditPage`, `HelpPage`, `DevTokensPage`, `DevStatesPage`).
  - Rollup manual chunking splitting `vendor-react` and `vendor-icons`.
- Verification & Test Coverage:
  - 95 unit tests green across 12 test files (`src/data/mock/polish.test.ts` exercising error ring buffer logging, token sanitization, 50-item cap eviction, diagnostic reporting, idle lock timeout calculations, centavos currency formatting, and Manila timezone date strings).
  - Full TypeScript typecheck clean (`0 errors`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 95 Vitest tests, Vite production build).
  - Automated browser subagent visual QA verified Privacy Mode toggle, `Shift+P` keyboard shortcut, Skip link, top bar Install button, and responsive 360px mobile viewport rendering without horizontal overflow.

## Session 2026-10-26 (Super Admin User Accounts Management & Access Control Console)
- Implemented Super Admin User Accounts & Access Control Console (`src/routes/settings/page.tsx` on `users` tab):
  - Executive header with distinct `Super Admin Console` badge, title, subtitle, and primary `+ Invite / Add Operator` action button.
  - Interactive KPI cards tracking total operator accounts, Super Admins (Owners), scoped Helpers, and active vs revoked status.
  - Search and filter bar supporting live queries across operator names or Google emails, with role filters (All, Owners, Helpers).
  - Detailed operator card list displaying initials avatar with live status indicator dot (green active / red revoked), display name (with `(You)` badge on caller's session), role badge with icon (`Owner (Super Admin)` vs `Helper (Scoped)`), status chip (`Active` vs `Access Revoked`), assigned client matter tags, invited/active timestamps, and contextual actions (`Edit`, `Revoke`, `Reactivate`).
  - Global Practice Security & Scoping Policies card with "Helpers Can Accept Requirements" toggle and Google Workspace OAuth allowlist enforcement documentation.
- Implemented Operator Form Modal (`src/components/settings/user-form-modal.tsx`):
  - Accessible modal dialog for adding new operators or editing existing permissions.
  - Inputs for Google account email (validated with format checks), full name, and administrative notes.
  - Role hierarchy picker clearly differentiating Owner (full practice authority) from Helper (scoped to specific clients).
  - Client scoping assignment section featuring search input, "Select All" / "Clear All" batch controls, and interactive client checklist.
- Implemented Revoke Operator Dialog (`src/components/settings/revoke-user-dialog.tsx`):
  - Destructive confirmation dialog clearly explaining session termination implications and immediate file revocation with reassurance of reversible reactivation.
- Data Layer, Repository & Permissions (`src/data/repositories.ts`, `src/data/mock/index.ts`, `src/hooks/useData.ts`):
  - Updated `memberships` repository interface to return enriched records with operator names, initials, and last sign-in timestamps.
  - Implemented `invite`, `update`, and `revoke` in `mockRepositories.memberships` with strict Owner-only permission enforcement and audit logging (`ActivityAction`: `access_granted`, `updated`, `access_revoked`).
  - Added React Query mutation hooks: `useInviteMembership`, `useUpdateMembership`, `useRevokeMembership`.
- Routing & Navigation Aliases (`src/app/router.tsx`, `src/app/dev-menu.tsx`, `src/components/command-palette.tsx`):
  - Added route aliases `/admin` and `/admin/users` navigating directly to the Super Admin user management console.
  - Added `User Admin` quick link in the Dev Menu footer.
  - Added `Super Admin: Users & Access` (`/admin`) item in the Command Palette (Cmd+K).
- Verification & Test Coverage:
  - 101 unit tests green across 12 test files (`src/data/mock/settings.test.ts` exercising enriched membership listing, inviting new scoped helpers, updating roles/client assignments, revoking/reactivating access, and non-owner access denial).
  - Full TypeScript typecheck clean (`0 errors`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 101 Vitest tests, Vite production build).
  - Browser subagent automated visual QA verified navigation to `/settings/users`, adding a new operator (Clara Reyes) with scoped client assignment, editing permissions, and `/admin` redirect routing.

- Fixed Insights Chart Baseline Label Collision (`src/components/insights/svg-charts.tsx`, `src/components/insights/chart-frame.tsx`, `src/routes/insights/page.tsx`):
  - Solved visual collision where the solid purple series trend line and rightmost data point marker (October at 96%) intersected and sliced directly through raw unpadded "Target (90%)" text.
  - Allocated dedicated right margin space (`paddingRight: 82px` when baseline is active) isolating the reference badge completely outside the data point plotting envelope.
  - Rendered a styled reference pill badge (`<rect fill="var(--sheet-2)" stroke="var(--rule-strong)">`) on the topmost SVG layer, connected to the dashed baseline line.
  - Added dashed line indicator support to `ChartFrame` legend (`dashed: true`) displaying "Target (90%)" and "Baseline (55%)" clearly in the card header.
  - Verified clean rendering via browser subagent on both Overview and Deadlines tabs; full verification gate passed.

## Session 2026-10-26 (Smooth Drawer & Modal Open/Close Animations and Gradual Backdrop Blur)
- Implemented Reusable Animated Shell Components (`src/components/ui/slide-sheet.tsx`, `src/components/ui/modal-dialog.tsx`):
  - Built `SlideSheet`: Reusable side-sheet / drawer powered by `motion/react` (Motion 12) and `AnimatePresence`. Implements smooth sliding enter/exit (`x: '100%'` <-> `x: 0`, ease `[0.16, 1, 0.3, 1]`), gradual backdrop blur (`blur(0px)` <-> `blur(6px)`), smooth backdrop opacity fade (`0` <-> `1`), global Escape key handling, and body scroll locking.
  - Built `ModalDialog`: Reusable center modal dialog powered by `motion/react` (Motion 12) and `AnimatePresence`. Implements smooth scale and opacity enter/exit (`scale: 0.94`, `y: 10`, `opacity: 0` <-> `scale: 1`, `y: 0`, `opacity: 1`), gradual backdrop blur (`blur(0px)` <-> `blur(6px)`), and smooth backdrop fade.
  - Respects accessibility constraints: Automatically disables transitions when `prefers-reduced-motion` or `html[data-reduce-motion="true"]` is active.
- Upgraded All Side Sheets & Drawers:
  - `NewTaskSheet` (`src/components/tasks/new-task-sheet.tsx`): Replaced abrupt unmount with `SlideSheet` for smooth slide-in and slide-out.
  - `ClientFormSheet` (`src/components/clients/client-form-sheet.tsx`): Upgraded to `SlideSheet`.
  - `PlanVisitSheet` (`src/components/visits/plan-visit-sheet.tsx`): Upgraded to `SlideSheet`.
  - `FollowUpComposer` (`src/components/follow-ups/composer.tsx`): Upgraded to `SlideSheet`.
  - `PreviewDrawer` (`src/components/documents/preview-drawer.tsx`): Upgraded to `SlideSheet` with active doc ref caching to ensure smooth exit animation when parent sets selected document to null.
- Upgraded Floating Windows, Popovers & Dropdowns:
  - `CommandPalette` (`src/components/command-palette.tsx`): Wrapped with `AnimatePresence` and `motion.div` for smooth top-sliding/scale transition and gradual backdrop blur.
  - `NotificationsPopover` (`src/components/notifications-popover.tsx`): Upgraded with `AnimatePresence` for smooth popup and exit.
  - `ExportMenu` (`src/components/export-menu.tsx`): Upgraded with `AnimatePresence` for smooth dropdown transition.
  - `DateField` (`src/components/inputs/date-field.tsx`): Upgraded with `AnimatePresence` for smooth calendar picker animation.
- Upgraded All Center Modals and Dialogs:
  - Settings & Admin: `UserFormModal`, `RevokeUserDialog`, `DevMenu`.
  - Tasks: `OpenPeriodModal`, and all 6 dialogs in `task-modals.tsx` (`MarkSubmittedDialog`, `MarkCompletedDialog`, `OverrideStatusDialog`, `ChangeDueDateDialog`, `AddChecklistLineModal`, `ArchiveTaskDialog`).
  - Follow-ups: All 4 dialogs in `follow-up-modals.tsx` (`LogResponseModal`, `EscalateModal`, `ResolveModal`, `NewFollowUpModal`).
  - Directory & Records: `OfficeFormModal`, `ContactFormModal`, `AuthorizationFormModal`, `RecordPaymentSheet`.
  - Route Action Modals: Task quick action edit in `tasks/detail.tsx`, flag issue and preview in `today/page.tsx`, departure override in `visits/detail.tsx`, finish visit in `visits/record.tsx`, day items and reschedule in `calendar/page.tsx`, and archive/request missing in `clients/detail.tsx`.
- Verification & Test Coverage:
  - 101 unit tests green across 12 test files (`vitest run`).
  - Full TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 101 Vitest tests, Vite production build).
  - Browser subagent visual QA verified smooth slide-in, gradual backdrop blur, and smooth slide-out on `NewTaskSheet`, `CommandPalette` (`Ctrl+K`), and `UserFormModal`.

## Session 2026-10-26 (Due Date Badge Calculations, "0d" Elimination & Table Column Wrap Integrity)
- Root Cause Analysis (`/debugging-engineering`):
  - In `src/components/ui/status-chip.tsx`, `DueBadge` was missing `daysFromToday` calculation when `dueDate` was provided without `daysDiff`, causing `daysDiff` to default to 0 and render anomalous "Due in 0d" and "Overdue 0d" strings.
  - Furthermore, `DueBadge`, `StatusChip`, `LineChip`, `AuthorizationBadge`, and `ClientFlag` lacked `whitespace-nowrap` and `shrink-0`, causing text to break on hyphens/spaces and vertically overflow the fixed `h-6` container into multiple disjointed lines (e.g. "Due" \n "2026-" \n "11-04").
  - Table columns in `tasks/page.tsx`, `clients/page.tsx`, `documents/page.tsx`, `payments/page.tsx`, and `clients/detail.tsx` lacked minimum widths and nowrap constraints on status, due date, period, and action cells.
- Systematic Resolution:
  - Upgraded `DueBadge` in `src/components/ui/status-chip.tsx`:
    - Imported `daysFromToday` and `formatDate` from `@/lib/dates`.
    - Auto-calculates `computedDays` dynamically from `dueDate` whenever provided.
    - Accurately renders relative labels: `Overdue ${N}d` (when negative), `Due today` (when 0), `Due tomorrow` (when 1), `Due in ${N}d` (when <= 7), and formatted `Due ${formatDate(dueDate)}` (e.g. `Due Nov 4`) when > 7 days.
    - Completely eliminated any "0d" strings across all states.
    - Added `whitespace-nowrap shrink-0` across all chips and badges (`StatusChip`, `LineChip`, `DueBadge`, `AuthorizationBadge`, `ClientFlag`).
  - Hardened Table Columns Across All Screens:
    - `tasks/page.tsx`: Added `whitespace-nowrap min-w-[125px]` to Due Date column, `min-w-[110px]` to Status column, and `whitespace-nowrap` to period, client, and action cells.
    - `clients/page.tsx`: Added `whitespace-nowrap min-w-[120px]` to Next Due, `min-w-[130px]` to Authorization, and `whitespace-nowrap` to open tasks and blocked columns.
    - `documents/page.tsx`: Added `whitespace-nowrap` to Preview, Client, Kind, Size, Uploaded By, Date, and Actions columns.
    - `payments/page.tsx`: Added `whitespace-nowrap` to Paid On, Reference, Channel, Amount, and Proof columns.
    - `clients/detail.tsx`: Added `formatDate` and `whitespace-nowrap` to client payment history table.
  - Regression Test Suite (`src/data/mock/polish.test.ts`):
    - Added tests verifying day difference calculations without boundary 0d errors and human-readable date formatting without raw hyphen breaks.
- Verification:
  - 103 unit tests green across 12 test files (`vitest run`).
  - Full TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 103 Vitest tests, Vite production build).
  - Browser subagent visual inspection confirmed single-line, clean pill rendering (`Due tomorrow`, `Overdue 2d`, `Due Nov 4`) with zero text wrapping or overflow.

## Session 2026-10-26 (High-Fidelity Document Printing & Export Engine Debugging)
- Systematic Root Cause Analysis (`/debugging-engineering`):
  - In browser print previews (`Microsoft Print to PDF`), when attempting to print documents from the preview drawer, the background `Documents Library` table was printed instead of the document, truncated horizontally at column boundaries with grey horizontal scrollbars visibly baked into the paper.
  - Root Cause 1 (Drawer Disappearance in Print): `src/styles/print.css` unconditionally specified `[role="dialog"] { display: none !important; }`. Since `SlideSheet` assigns `role="dialog"`, triggering `window.print()` from the document drawer caused CSS print media to suppress the drawer entirely and expose the underlying background data table.
  - Root Cause 2 (Printed Scrollbars & Table Clipping): In Chromium print layout engine, elements with `overflow-x: auto` maintain active scroll containers if table width exceeds paper margins, baking native scrollbars and scroll thumbs directly onto the printed page.
  - Root Cause 3 (Interactive Control Pollution): Search input bars, filter select dropdowns, clear filter buttons, tab switchers, and action icon buttons were displayed on printed paper without semantic print concealment.
  - Root Cause 4 (Pop-up Blocker Fragility in Export): `exportToPdf` previously relied on synchronous `window.open` calls that triggered pop-up blocker exceptions and alerts in secure browser configurations.
- Systematic Resolution & Architectural Enhancements:
  - Overhauled Print Stylesheet (`src/styles/print.css`):
    - Universal scrollbar elimination: Applied `scrollbar-width: none !important`, `-ms-overflow-style: none !important`, and `*::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }`.
    - Universal overflow override: Overrode `html, body, #root, main, div, section, article, table, thead, tbody, tr, td, th` with `overflow: visible !important`.
    - Document Preview Isolation: Added `body:has([data-printable-drawer="true"]) main#main-content { display: none !important; }`. When a printable drawer is active, the background layout is completely suppressed, and the drawer expands to 100% full-width white page layout, hiding the toolbar (`.drawer-toolbar`), sidebar (`.drawer-sidebar`), and footer (`.drawer-footer`), while isolating `.drawer-canvas`.
    - Table formatting: Applied `table-layout: auto !important`, `width: 100% !important`, 8.5pt font, word breaking, and row break-inside avoid to guarantee zero horizontal clipping.
    - Universal interactive control suppression: Suppressed `input:not([type="checkbox"])`, `select`, `textarea`, `button:not(.print-include)`, `[data-view-toggle]`, `.filter-strip`, `.search-strip`, `.actions-cell`, and `.actions-col`.
  - Upgraded Universal Export & Print Engine (`src/lib/export.ts`):
    - Built `printHtmlContent(html, title)`: Implemented transparent, hidden `<iframe>` fallback printing that executes seamlessly when `window.open` is blocked by browser security policies.
    - Built `printDocumentFile(doc: DocumentFile, clientMeta)`: Generates an archival-grade, high-fidelity practice record print sheet with practice header (`ORDINOVIX · PRACTICE DOCUMENT ARCHIVE`), client name & code, category kind badge, timestamp, full vector/raster document media, and SHA-256 tamper-evident integrity digest.
    - Hardened `exportToPdf({ title, subtitle, headers, rows })`: Standardized on `@page { size: auto; margin: 12mm 14mm; }`, `table-layout: auto`, and universal scrollbar elimination.
  - Wired Printable Drawer & Cleared Page Controls:
    - `src/components/ui/slide-sheet.tsx`: Added `isPrintable?: boolean` to `SlideSheetProps` applying `data-printable-drawer={isPrintable ? 'true' : undefined}`.
    - `src/components/documents/preview-drawer.tsx`: Set `isPrintable={true}`, tagged `.drawer-toolbar`, `.drawer-sidebar`, and `.drawer-footer` with `no-print`, and wired "Print document" button to `printDocumentFile(activeDoc, clientMeta)`.
    - Suppressed search bars, filter dropdowns, tab strips, and action button columns across `documents/page.tsx`, `tasks/page.tsx`, `tasks/detail.tsx`, `clients/page.tsx`, `clients/detail.tsx`, `payments/page.tsx`, `audit/page.tsx`, and `reports/page.tsx`.
- Automated Verification & Test Coverage:
  - Added comprehensive automated unit test suite `src/lib/export.test.ts` (4 unit tests):
    - `exportToCsv` produces UTF-8 BOM CSV output.
    - `exportToExcel` generates valid Excel XML with Worksheet and Table structures.
    - `exportToPdf` falls back cleanly to hidden iframe when `window.open` returns null.
    - `printDocumentFile` renders practice header, client metadata, SHA-256 integrity hash, and scrollbar suppression styles.
  - 107 unit tests green across 13 test files (`npm.cmd run test:run`).
  - Full TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 107 Vitest tests, Vite production build).

## Session 2026-10-26 (Center Floating Window Shell Transitions & Modal Cutout Elimination)
- Systematic Root Cause Analysis:
  - When opening floating center windows (such as `RecordPaymentSheet`), the modal was clipped and cut out at the top:
    - Root Cause 1 (Flexbox Centering Coordinate Clipping): In `ModalDialog`, `overflow-y-auto` was applied directly to `flex items-center justify-center`. In CSS flexbox, when content height exceeds container height, `items-center` calculates a negative top offset (`top < 0`). Since scroll containers cannot scroll to negative coordinates, any overflow above the top edge is permanently truncated and inaccessible.
    - Root Cause 2 (Single-Scroll Container Cutouts): In `RecordPaymentSheet`, `OfficeFormModal`, `UserFormModal`, and `FollowUpModals`, the modal title, icon, close button, form fields, and action buttons were placed into a single overflowing container. As soon as an input was focused or scrolled, the header scrolled away and clipped at the top, while submit buttons were pushed below the visible frame.
    - Root Cause 3 (Visual Clutter Behind Center Floating Windows): When center modals were active, the left navigation sidebar and top header bar remained visible, distracting from the modal task.
- Systematic Resolution & Architectural Upgrades:
  - Built Global Reactive Center Modal Store (`src/lib/modal-store.ts`):
    - Implemented `centerModalStore` using `useSyncExternalStore` and `data-center-modal-open` HTML attributes.
    - Tracks active center floating window count and notifies subscribers without component tree re-rendering.
  - Upgraded Shell Sliding Animations (`src/app/shell.tsx`):
    - Desktop sidebar / tablet rail (`<aside>`): Automatically slides smoothly off-screen to the left (`-translate-x-full opacity-0 pointer-events-none`) with `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`.
    - Top bar (`<header>` with Brand, Search, Privacy, Install, Notifications): Automatically slides smoothly off-screen to the top (`-translate-y-full opacity-0 pointer-events-none`).
    - Sample data banner & offline banner: Automatically slides smoothly off-screen to the top.
    - Mobile bottom bar (`<nav>`): Automatically slides smoothly off-screen to the bottom (`translate-y-full opacity-0 pointer-events-none`).
    - When any center floating window closes, all bars and sidebars smoothly slide back into their exact previous state (preserving sidebar collapsed/expanded width).
  - Hardened Modal Dialog Architecture (`src/components/ui/modal-dialog.tsx`):
    - Replaced `flex items-center` with `my-auto` centering on the panel: when content fits, it centers vertically; when content is tall, `my-auto` collapses to 0 top margin, completely eliminating negative coordinate cutouts.
    - Added `maxHeight: 'calc(100vh - 2.5rem)'` and `flex flex-col` to prevent panel overflow beyond screen boundaries.
    - Sanitized `zIndex` fallback to ensure modal dialogs always elevate cleanly above application bars.
  - Upgraded Center Modals to 3-Tier Architecture (Pinned Header / Scrollable Body / Pinned Footer):
    - `RecordPaymentSheet` (`src/components/payments/record-payment-sheet.tsx`): Pinned title & close button header at top (`shrink-0`), scrollable form body in middle (`flex-1 overflow-y-auto min-h-0`), and pinned "Cancel" & "Save Payment Record" action footer at bottom (`shrink-0`).
    - `OfficeFormModal` (`src/components/offices/office-form-modal.tsx`): Upgraded with pinned header, middle scroll body, and pinned action footer.
    - `UserFormModal` (`src/components/settings/user-form-modal.tsx`): Upgraded with pinned header, middle scroll body, and pinned action footer.
    - `FollowUpModals` (`src/components/follow-ups/follow-up-modals.tsx`): Upgraded `LogResponseModal` and `NewFollowUpModal` with pinned headers and footers.
    - `CommandPalette` (`src/components/command-palette.tsx`): Integrated with `centerModalStore` to smoothly slide hide and restore shell bars during global search.
- Automated Verification:
  - Added unit test suite `src/lib/modal-store.test.ts` (3 tests) verifying open/close counts, non-negative boundary bounds, and subscriber notifications.
  - 110 unit tests green across 14 test files (`npm.cmd run test:run`).
  - Full TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 110 Vitest tests, Vite production build).

## Session 2026-10-26 (Sign-Out / Logout Triggers & Login Page Audit)
- Authentication & Login Page Status:
  - Verified that Section 11.1 Sign-in Page was already built at `src/routes/sign-in/page.tsx` and routed to `/sign-in` in `src/app/router.tsx`.
  - Features: 48px Ordinovix brand logo, Google Sign In simulation ("Continue with Google"), mock mode persona switchers ("Continue as Ana — Owner" and "Continue as Ben — Helper"), and unauthorized account simulation ("Simulate unauthorized Google account" routing to `/access-pending`).
  - Identified gap: Because the application defaulted into sample data mode (`/` -> `TodayPage`), and there were no sign-out buttons in the shell or settings, users had no accessible way to log out or reach the login page during normal operation.
- Implementation of Universal Sign-Out Triggers:
  - Sidebar User Footer (`src/app/shell.tsx`):
    - Expanded view: Added dedicated `LogOut` action button next to operator display name and role (`Ana Santos` / `Ben Morales`) with `title="Sign out (Log out)"` and `aria-label="Sign out"`, smoothly navigating to `/sign-in`.
    - Collapsed view: Wired the avatar button (`AS` / `BM`) to navigate to `/sign-in` with `title="Sign out (Ana Santos)"`.
  - Top Bar Header (`src/app/shell.tsx`):
    - Added dedicated `LogOut` icon button next to the practice organization name (`Santos Tax Services`) with tooltip and ARIA label for direct header logouts.
  - Global Command Palette (`src/components/command-palette.tsx`):
    - Added `Sign Out / Log Out` quick action (`action sign out logout leave session`) in `cmdk` (`Ctrl+K`), routing immediately to `/sign-in`.
  - Settings Profile & Security (`src/routes/settings/page.tsx`):
    - Added a prominent "Sign out of session" button (`border border-critical-bd text-critical-fg hover:bg-critical-bg`) in the `Profile` tab footer.
    - Wired "Sign Out All" in `Security & privacy` tab to alert and redirect to `/sign-in`.
- Automated Verification:
  - 110 unit tests green across 14 test files (`npm.cmd run test:run`).
  - TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 110 Vitest tests, Vite production build).

## Session 2026-10-26 (Bespoke Fluid Animated Select Component & Dropdown Upgrade)
- Systematic Root Cause Analysis of Clunky Native Dropdowns:
  - Default HTML `<select>` elements invoke operating system native popup menus (square borders, Windows/Chromium default blue hover highlight, non-token typography, zero animations).
  - Native select menus ignored Ordinovix design tokens (`--stamp`, `--sheet`, `--sheet-2`, `--rule`, `--shadow-float`, `--r-control`) and produced glaring visual discord in both light and dark modes.
- Built Bespoke Fluid Animated Select Component (`src/components/ui/select.tsx`):
  - Fluid spring & ease animations powered by `motion/react` (`scale: 0.96` to `1`, `y: -4` to `0`, opacity fade with cubic bezier easing `[0.16, 1, 0.3, 1]`).
  - Smooth 180° animated rotating chevron indicator (`transition-transform duration-200`).
  - Active focus ring with stamp-tinted glow (`border-[var(--stamp)] ring-2 ring-[var(--stamp)]/20 bg-[var(--sheet)]`).
  - Archivo variable typography with rounded item highlights (`rounded-[calc(var(--r-control)-4px)]`).
  - Selected state with `--stamp-soft` background, `--stamp-ink` text, and subtle checkmark icon (`Check`).
  - Automatic inside-menu search filter input when options count >= 8 with live case-insensitive filtering.
  - Universal dual API supporting both `options` array (`SelectOption[]`) and nested `<option>` children with automatic prop extraction.
  - Full keyboard accessibility (`Escape` to close, `ArrowDown`/`Enter`/`Space` to open, outside click listener).
- Comprehensive Application Filter Bar Migration:
  - Upgraded filter dropdowns across all 8 major application screens:
    - `src/routes/insights/page.tsx`: Date range, Owner, Client, and Template filter dropdowns.
    - `src/routes/tasks/page.tsx`: Client, Status Group, Task Kind, Owner, and Period filter dropdowns.
    - `src/routes/clients/page.tsx`: Entity Type, VAT Status, Filing Channel, eFPS Group, and Assigned User dropdowns.
    - `src/routes/payments/page.tsx`: Client, Channel, and Paid By dropdowns.
    - `src/routes/documents/page.tsx`: Client, Document Kind, and File Type dropdowns.
    - `src/routes/follow-ups/page.tsx`: Client and Channel dropdowns.
    - `src/routes/reports/page.tsx`: Paper size and Target Client selector dropdowns.
    - `src/routes/calendar/page.tsx`: Client and Item Type filter dropdowns.
- Automated Verification:
  - Added test suite `src/components/ui/select.test.ts` (3 tests) validating option parsing, case-insensitive search filtering, and description matching.
  - 15 test files passed, 113 tests green (`npm.cmd run test:run`).
  - Full TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
- Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 113 Vitest tests, Vite production build).

## Session 2026-10-26 (Compacted Sidebar Hover Autoscroll & Scrollbar Concealment)
- Problem Analysis:
  - On viewports <= 768px height, the 13 navigation items in the compacted (72px) rail triggered an ugly, persistent vertical scrollbar track and thumb directly beside the navigation icons and collapse notch.
  - The narrow 72px rail width made interacting with a native vertical scrollbar cramped and prone to accidental misclicks.
- Engineered Hover Locked Autoscroll Engine (`src/lib/sidebar-autoscroll.ts`, `src/app/shell.tsx`):
  - Completely concealed the permanent native scrollbar in compacted mode using `.no-scrollbar` utility (`scrollbar-width: none`, `-ms-overflow-style: none`, `::-webkit-scrollbar: hidden`).
  - Implemented middle-click style locked autoscroll on mouse hover over the compacted rail:
    - Upper zone (`ratio < 0.35`): Smoothly scrolls UP with non-linear quadratic acceleration as the cursor approaches the top edge (`velocity` up to -14px/frame).
    - Lower zone (`ratio > 0.65`): Smoothly scrolls DOWN with quadratic acceleration as the cursor approaches the bottom edge (`velocity` up to +14px/frame).
    - Neutral center deadzone (`0.35 <= ratio <= 0.65`): Velocity is exactly 0, allowing stable, drift-free hovering and clicking of navigation icons.
  - Interactive tactile cursor styling (`cursor-n-resize` when moving up, `cursor-s-resize` when moving down, `cursor-ns-resize` in neutral zone).
  - Floating Autoscroll Compass HUD Indicator: Renders a compact floating badge following mouse Y movement with active up/down direction indicators and center stamp dot.
  - Driven by `requestAnimationFrame` for 60/120fps fluid scrolling; automatically cancels on mouse leave.
  - Standard mouse wheel scrolling remains fully functional simultaneously.
- Automated Verification:
  - Added unit test suite `src/lib/sidebar-autoscroll.test.ts` (5 tests) validating center deadzone, upward/downward velocity curves, clamping bounds, and DOM scrollability checks.
  - 16 test files passed, 118 tests green (`npm.cmd run test:run`).
  - Full TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 118 Vitest tests, Vite production build).

## Session 2026-10-26 (Button Layout Alignment & SVG Display Bugfix)
- Problem Analysis:
  - User reported "This button looks odd, fix it" with screenshot showing the "Request missing" secondary button on the Today focus dashboard where the Send paper-plane icon was vertically stacked directly above the text label.
  - Root Cause: In Tailwind CSS v4 Preflight, `<svg>` elements are styled with `display: block; vertical-align: middle;`. When `Button` (`src/components/ui/button.tsx`) wrapped `{children}` inside a plain `<span className="truncate">`, any `<svg>` passed inside `children` behaved as a block element, forcing a line break above the adjacent text element.
- Engineering Resolution:
  - Hardened `src/components/ui/button.tsx`:
    - Added `whitespace-nowrap` to the outer `<button>` class list to prevent unwanted multiline wrapping of actions.
    - Updated the icon wrapper to `<span className="shrink-0 inline-flex items-center">{icon}</span>`.
    - Updated the children wrapper to `<span className="truncate inline-flex items-center gap-1.5">{children}</span>`, guaranteeing that any elements or icons passed inside children are laid out horizontally in a flex container with vertical centering.
  - Refactored `src/routes/today/page.tsx`:
    - Replaced `<Button><Send className="w-3.5 h-3.5 mr-1.5" /><span>Request missing</span></Button>` with semantic `icon={<Send className="w-3.5 h-3.5" />}` and clean text children `Request missing`.
  - Audited and Refactored `src/routes/clients/detail.tsx`:
    - Updated header action buttons (`New Task`, `Request Missing`, `Edit`, `Restore`, `Archive`) to use semantic `icon={...}` props.
- Automated Verification:
  - 16 test files passed, 118 tests green (`npm.cmd run test:run`).
  - Full TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 118 Vitest tests, Vite production build in 7.19s).

## Session 2026-10-26 (Kanban Board Accidental Selection, Drag-and-Drop & Dropdown Bugfixes)
- Problem Analysis:
  - User reported "look at the bugs here also" with screenshot of the Tasks Kanban board showing:
    1. Fragmented purple text selection boxes (`::selection` with `--stamp-soft`) across headers (`review`, `correction`), cards (`BIR 0619-E...`, `1/2 items`, `Move to`), and empty states (`No tasks`), triggered when users click, drag horizontally, or try dragging cards.
    2. Lack of drag-and-drop on Kanban cards, causing attempted card dragging to highlight text across multiple columns.
    3. Ugly native HTML `<select>` elements with default OS arrows for card transitions.
    4. Broken/misleading "Move to..." options on cards in derived columns (`intake`, `waiting_on_client`, `review_required`, `needs_correction`) where line items are incomplete, causing silent failure or transition errors.
- Engineering Resolution:
  - Accidental Text Selection Elimination (`src/styles/base.css`, `src/routes/tasks/page.tsx`):
    - Added `[data-kanban-board], [data-kanban-board] *` to `user-select: none; -webkit-user-select: none;` and transparent `::selection`.
    - Added `select-none` to board container, column panels, headers, and task cards.
  - Native HTML5 Drag and Drop Engine (`src/routes/tasks/page.tsx`):
    - Enabled `draggable={true}` on task cards with tactile `cursor-grab active:cursor-grabbing` and `GripVertical` indicator.
    - Implemented `onDragOver`, `onDragLeave`, and `onDrop` on columns with dynamic hover drop-zone styling (`border-stamp ring-2 ring-stamp/20 bg-stamp/10`).
    - Handled drop transitions: triggers `MarkSubmittedDialog` for submitted column, `MarkCompletedDialog` for completed column, and validates line completion for operator columns (`in_preparation`, `ready_next_step`).
    - Integrated `OverrideStatusDialog` when owner drops blocked tasks onto operator columns.
  - Bespoke Animated Dropdowns & Derived Action Buttons:
    - Replaced native HTML `<select>` in operator columns with bespoke fluid animated `Select` component, restricted to valid transitions.
    - Replaced broken "Move to..." in derived columns with contextual line-resolution action buttons ("View Missing Items", "Review Lines", "Resolve Flagged", "Request Items") linking directly to the task, plus owner "Override status..." modal trigger.
    - Added auto-dismissing notice toast banner for drag validation feedback.
- Automated Verification:
  - 16 test files passed, 118 tests green (`npm.cmd run test:run`).
  - Full TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 118 Vitest tests, Vite production build in 6.58s).

## Session 2026-10-26 (Kanban Card Due Badge & Items Overflow Fix)
- Problem Analysis:
  - User reported "Look at the items text, it goes beyond the card edge" with screenshot showing "0/1 items" extending past the right border of the Kanban card.
  - Root Cause: In the 8-column Kanban board with `min-w-[1400px]`, each column was only ~164px wide (inner card content width ~125px). The standard `DueBadge` rendered at `h-6` with `text-xs` (width ~95px-100px), which left insufficient horizontal room for the adjacent `0/1 items` label (~45px), causing it to overflow past the card edge.
- Engineering Resolution:
  - Upgraded `DueBadge` Component (`src/components/ui/status-chip.tsx`):
    - Added `size?: 'sm' | 'md'` prop.
    - `size="sm"` renders compact `h-5`, `text-[10px]`, `px-1.5 py-0`, and scaled `w-3 h-3` icons, reducing badge width footprint by ~25px while retaining full icon and textual clarity.
  - Hardened Kanban Card Layout (`src/routes/tasks/page.tsx`):
    - Added `overflow-hidden` to the card container class to strictly contain children inside rounded borders.
    - Updated the due row to use `DueBadge size="sm"` with `gap-1.5 min-w-0`.
    - Increased Kanban board grid container min-width from `1400px` to `1600px` (`min-w-[1600px]`), providing comfortable ~195px per column so badges and item counts fit with generous margin.
- Automated Verification:
  - 16 test files passed, 118 tests green (`npm.cmd run test:run`).
  - Full TypeScript typecheck clean (`0 errors`, `tsc --noEmit`).
  - Full verification gate (`scripts/verify.ps1`) PASSED (TypeScript check, 118 Vitest tests, Vite production build in 6.84s).



