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

