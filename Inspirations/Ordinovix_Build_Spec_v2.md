# Ordinovix — Build Spec v2

**For:** Antigravity (frontend build on sample data), then Claude Code (backend and hosting)
**Version:** 2.0 · October 24, 2026
**Replaces:** Frontend Build Spec v1 (all sections) and Blueprint section 8 (technology)
**Companion:** Ordinovix — Discovery & MVP Blueprint (workflow, acceptance tests, discovery questions)

---

## 0. Read me first

### 0.1 For you (the builder)

This file is the single source of truth for the Ordinovix frontend. It has three kinds of content:

| Kind | Sections | Who uses it |
|---|---|---|
| What to build and why | 1–5 | You, and Antigravity as background |
| How it must look and behave | 6–19 | Antigravity, milestone by milestone |
| Build order and QA | 20 | You, to run each milestone |
| What happens after the frontend | 21 | You and Claude Code in the backend phase |
| Checklists, questions, sources | 22–24 | You |

Feed it to Antigravity in this order: the whole file once as context for milestone M0, then point it at the sections listed for each milestone in section 20. Run the QA checklist at the end of each milestone before starting the next.

### 0.2 Standing instructions for the coding agent

Paste this block at the top of every Antigravity session.

```text
You are building the Ordinovix frontend described in Ordinovix_Build_Spec_v2.md.

Hard rules:
1. Screens never import sample data. Screens call hooks; hooks call the Repositories
   interface (section 17); the mock implementation is one of two implementations.
2. Every status, readiness, due state, and KPI comes from src/domain/rules.ts or
   src/domain/metrics.ts. No component computes them inline.
3. Use only the design tokens in section 8. No raw hex values, no raw pixel font sizes,
   no new colours. If a token is missing, stop and list it instead of inventing one.
4. Every screen ships four states: loading skeleton, empty, error with retry, populated.
5. Every form uses react-hook-form + a zod schema from src/domain/schemas.ts.
6. Dates are 'YYYY-MM-DD' strings in Asia/Manila. Never create a JS Date at UTC midnight
   for a calendar date. Use the helpers in src/lib/dates.ts.
7. Money is an integer number of centavos. Never store pesos as floats.
8. Nothing is hard-deleted. Archive, cancel, or soft-delete with a reason.
9. Never invent BIR rules, forms, deadlines, or office procedures. Sample templates are
   marked unverified. If a requirement is unclear, leave a TODO and list it.
10. Never add a field that stores a BIR portal password (eFPS, eBIRForms, ORUS) or any
    other credential.
11. Light and dark mode for every screen. Check both before marking a milestone done.
12. Keyboard: everything reachable, visible focus, no traps. Touch targets at least 44 px.
```

### 0.3 What "done" means for the frontend phase

The whole operator loop works in the browser on sample data: open a period, collect and review documents, chase missing items, plan a visit that refuses to call itself ready until it is, record what happened at the counter, and see the results in Insights. Data survives a refresh (localStorage). The data layer can be swapped for the real API without touching a screen.

---

## 1. Ordinovix in one page

**Who it is for.** One trusted tax preparer (the operator) who handles BIR filings and errands for law firms and lawyers, plus an optional helper she authorizes. Her clients do not log in.

**The job.** At any moment, show her what each client and filing period needs, what has arrived, what has actually been checked, who must act next, and what to bring to the next office visit. Then record what happened and surface what is left.

**The north star.** First-pass completion rate: the share of office-visit items completed on the first trip. Every screen should push this up by catching missing, expired, or unchecked items before she leaves.

**What it is not.** Not a tax calculator, not a filing or payment channel, not a tax adviser, not a client portal, not accounting software. It organizes work she already does.

**Five ideas the product is built on**

1. **Received is not accepted.** A file arriving never satisfies a requirement. A person reviews it and stamps it accepted.
2. **Every blocked task says why and who acts next.** A red badge alone is a bug.
3. **A visit is not ready until every item is.** The visit planner names each unresolved item and the person it waits on.
4. **Outcomes create the next action.** Anything not completed at the counter becomes a follow-up or next action before she leaves the building.
5. **Nothing is lost.** Every change is recorded with who, when, and why. Archive instead of delete.

---

## 2. What changed since v1

| Area | v1 | v2 | Why |
|---|---|---|---|
| Domain | Buy one domain | **No domain.** App runs at `https://<name>.<account>.workers.dev` | No budget for a domain |
| Database | Supabase Free, then Pro | **Cloudflare D1** (SQLite) | Supabase Free pauses after a week of low activity; D1 does not pause |
| Files | Supabase Storage | **Cloudflare R2** | 10 GB free, no egress fees, no pausing |
| Hosting | Cloudflare Pages | **One Cloudflare Worker** serves the app and the API from the same address | Same origin keeps sign-in cookies simple and avoids cross-site issues |
| Sign-in | Email magic link via Resend | **Google sign-in only**, owner-managed allowlist | Magic links need email sending, and email sending needs a domain |
| Email | Resend | **None in v2.** In-app notifications plus phone push notifications | No domain means no trustworthy sending address |
| Messages to clients | Copy and paste | Copy and paste, plus open-in-SMS, open-in-email, open-in-Viber shortcuts | Still uses her existing channels |
| Design | Inter, deep teal, no charts, no dark mode | **Archivo, stamp violet, full dark mode, Insights dashboards** | Distinct identity; she asked for dashboards and tracking |
| Modules | Today, Clients, Task, Follow-ups, Visits, Settings | Adds **Tasks list and board, Documents, Calendar, Payments, Offices, Insights, Reports, Notifications, Audit log, Onboarding, Help** | Covers the whole loop and proves value |
| Tracking | Statuses only | Adds outcome causes, visit costs and times, submit and complete dates, payments, baseline numbers | Needed to show fewer repeat trips and less chasing |
| Records | Plain IDs | Every record has `orgId`, UUIDv7 `id`, `createdAt`, `updatedAt`, `version`, soft delete | Ready for paid scale-up and multiple preparers |
| Copy form label | "CTC" | **"Certified copy"** | In the Philippines "CTC" usually means the Community Tax Certificate (cedula) |

If Antigravity already built M0 from v1: keep the folder structure and repository pattern, replace the tokens file (section 8), add the base record fields (section 15), and continue from M1.

---

## 3. Hosting and platform decision

### 3.1 The decision

**Everything runs on Cloudflare's free plan, on a `workers.dev` address, with no domain, no email service, and no computer of yours involved.**

```text
Browser (phone or laptop, installed as an app)
   │  https://ordinovix.<account>.workers.dev
   ▼
Cloudflare Worker  ──  static app files (React build)       free and unlimited
   │                └─ /api/*  Hono API + Better Auth        100,000 requests/day free
   ├── D1 database (SQLite)  records, activity log           500 MB per database free
   ├── R2 bucket             photos, PDFs, thumbnails        10 GB free, no egress fees
   └── Cron Triggers         reminders, daily digest, expiry checks
Google sign-in (OAuth)       identity only; no Google data is read
GitHub Actions               weekly database export to R2 (backup)
```

### 3.2 Why not Supabase, and what else was considered

| Option | Verdict | Reason |
|---|---|---|
| Supabase Free | Rejected | Projects pause after about 7 days of low database activity and must be restored before use; free email sending only reaches your own team at a low hourly rate; real use needs Pro at US$25/month |
| Supabase Free with a daily keep-alive ping | Rejected | Works around the pause but depends on a policy that can change; still no backups on Free |
| Neon Postgres Free + R2 + Better Auth | Strong second choice | No pause to restore by hand (it scales to zero after 5 idle minutes and wakes automatically on the next query); 0.5 GB per project; 6-hour restore window. Pick this if you ever need Postgres features |
| Self-hosted (PocketBase, ERPNext) on a free VM | Rejected | You become the system administrator; one bad update takes her offline |
| Your laptop | Rejected | You said no, and it is right: uptime would depend on your laptop being on |
| **Cloudflare Workers + D1 + R2** | **Chosen** | No pausing, 7-day point-in-time restore on Free, 10 GB of files, zero egress, US$5/month to scale, and one vendor to manage |

### 3.3 Free-plan limits and what the frontend must do about them

| Limit (Cloudflare Free, October 2026) | Number | Frontend consequence |
|---|---|---|
| Worker requests | 100,000 per day | Cache with TanStack Query (`staleTime` 30 s for lists, 5 min for templates and offices); no polling faster than 60 s; batch reads into page-level endpoints (one request for Today) |
| Worker CPU | 10 ms per request | No password hashing on the server, so Google sign-in only. Image compression happens in the browser, not the Worker |
| Static asset requests | Free and unlimited | Ship the app as static files; only `/api/*` runs the Worker |
| D1 database size | 500 MB per database (10 GB on paid) | Files never go in the database. Text only |
| D1 queries per request | 50 (1,000 on paid) | Page endpoints use batched queries; the frontend never fires dozens of small requests per screen |
| D1 restore window (Time Travel) | 7 days (30 on paid) | Plus a weekly export to R2 kept for 12 weeks |
| R2 storage | 10 GB per month | Compress photos in the browser to about 300–600 KB; keep PDFs as they are, up to 15 MB |
| R2 writes / reads | 1 million / 10 million per month | Thumbnails are generated in the browser and uploaded once |

Confirm every figure on Cloudflare's pricing and limits pages before go-live; they are stated here as of October 2026.

### 3.4 Consequences of having no domain

- **Sign-in is Google only.** The owner adds each person's Gmail or Google Workspace address to the allowlist. Anyone else who signs in sees "Access pending".
- **No outgoing email.** Reminders come as in-app notifications and as push notifications on phones where the app is installed. Messages to clients still go through her own Viber, Messenger, SMS, or email.
- **The address is public but hidden.** `workers.dev` addresses can be found. The app sends `noindex`, every API call requires a signed-in, allowlisted user, and files are only served through the API after a permission check.
- **Moving to a domain later is a settings change**, not a rebuild: add the domain to the Worker, update the Google OAuth redirect address, and optionally add email sending.

### 3.5 Upgrade path when she pays

| Trigger | Move | Cost (approximate, confirm) |
|---|---|---|
| Real client data goes in | Stay on Free if usage fits; turn on the weekly backup and run a restore test first | US$0 |
| More than 100,000 API requests a day, or a database near 500 MB, or you want 30-day restore | Workers Paid plan | US$5/month base |
| Files near 10 GB | R2 pay-as-you-go | about US$0.015 per GB-month above 10 GB |
| A second preparer or firm signs up | New organization in the same database (`orgId`), or one D1 database per firm | Same plan |
| Heavy reporting or many firms | Move the Drizzle schema to Postgres (Neon or Supabase Pro) behind Cloudflare Hyperdrive | Roughly US$5–25/month to start, depending on the provider; check current pricing |
| She wants a proper address and email reminders | Buy a domain, point it at the Worker, add an email sender | about US$10–15/year plus email plan |

---

## 4. Scale-ready rules (apply from day one, even on sample data)

These cost almost nothing now and remove the rewrite later.

1. **Every record carries `orgId`.** Even with one organization. All queries filter by it.
2. **IDs are UUIDv7** (time-ordered, generated in the browser with `uuid` v7). Offline-created records keep their IDs when synced.
3. **Every record has `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `version`.** The API rejects a save whose `version` is stale and the UI shows "This changed since you opened it" (section 9.13).
4. **Soft delete only:** `deletedAt` and `deletedReason`. Lists hide soft-deleted rows.
5. **Every write sends an `Idempotency-Key`** (a UUIDv7). The offline queue can retry safely and never creates duplicates.
6. **Cursor pagination** on every list (`cursor`, `limit`, default 50). No page numbers.
7. **Files are addressed by ID, never by URL.** `documents.getUrl(id)` returns a short-lived URL. Keys are immutable and versioned.
8. **Money is integer centavos; dates are `YYYY-MM-DD`; times are ISO 8601 with offset.**
9. **Permissions are data, not screens.** A helper's client assignments live in `Membership.clientIds`; the mock enforces them in the repository, and the API will enforce them in every query.
10. **Settings are per organization** (`OrgSettings`) and per user (`UserPrefs`), never hard-coded.
11. **The repository interface is the contract.** Method names never shrink; arguments may only grow.
12. **A separate Demo organization.** Sample data lives in its own organization so real data never mixes with it.

---

## 5. Inspiration review: BetterGov.PH, ERPNext, Ambibuzz

### 5.1 BetterGov.PH and the Kapwa design system — borrow the method, not the look

**What it is.** A volunteer civic-tech group building open alternatives to government sites. Their design system, Kapwa (`@bettergov/kapwa`), is public domain (CC0-1.0), built on Tailwind v4 with Inter and Roboto Mono, ships a shadcn registry and Storybook. In October 2026 the government announced it will adopt BetterGov.PH as the official Gov.PH portal with DICT, with a unified national design system planned.

| Take | Leave |
|---|---|
| Token naming and structure (semantic colour roles, status roles) | The Gov.PH visual identity. Ordinovix is a private practice tool; looking like a government portal could mislead her clients and invites confusion with official BIR services |
| Accessibility habits: visible focus, contrast-checked pairs, plain-language labels | Inter and Roboto Mono (we use Archivo for its width axis and peso sign, section 8.4) |
| A Storybook-style state gallery (our `/dev/states`) | Copying components wholesale; we use shadcn/ui directly |
| PH-specific formatting habits (peso, dates, Filipino copy) | — |

Their other public repositories (transparency dashboard, open-data visualization) are good references for presenting Philippine numbers and peso amounts in charts. Nothing to install.

### 5.2 ERPNext / Frappe — borrow the concepts, never the platform

**What it is.** A full open-source ERP (GPLv3) on the Frappe framework: Python, MariaDB, Redis, background workers. Version 16 is current.

**Do not build on it.** It needs a server you would maintain, its GPLv3 licence attaches to modifications you distribute, and it brings accounting, inventory, HR, and payroll she does not need. The brief rules these out.

**Concepts worth taking, and where they land in Ordinovix**

| ERPNext concept | Ordinovix equivalent |
|---|---|
| DocType (a record type defined by metadata) | Task templates with requirement lines (section 11.17) |
| Workflow (states, allowed transitions, roles) | Line and task transition tables (section 16) |
| Assignment and ToDo | Task owner, next action, next-action due date |
| Comments and timeline on every document | Notes and activity timeline on every client, task, and visit |
| Version (field-level change history) | Activity events with before and after values |
| Notification rules (event, condition, recipients) | Notification rules (section 14) |
| Print formats | Printable trip pack, client checklist, monthly summary (section 11.14) |
| Number cards and dashboard charts | Insights (section 13) |
| Naming series | Document naming convention (section 9.9) |
| Auto Repeat | Open period wizard (section 11.6) |
| Saved list filters | Saved views (section 9.11) |

### 5.3 Ambibuzz — useful as a signal, nothing to reuse

An Indian ERPNext implementation partner. Their public repositories are ERPNext add-ons (the AmPower suite: a form builder, dashboards, a WhatsApp integration, mobile push notifications, an AI assistant connector). None is Philippine or BIR-specific, and all require ERPNext.

The useful signal: the add-ons small businesses ask for first are **push notifications, messaging shortcuts, configurable forms, and simple dashboards**. Ordinovix v2 covers each in a lighter form (push, message composer, templates, Insights).

---

## 6. Tech stack

Use the current stable major version of each package unless noted. Do not add packages outside this list without listing the reason.

| Need | Package | Notes |
|---|---|---|
| App | React 19 + TypeScript (strict) + Vite | Single-page app |
| Styling | Tailwind CSS v4 | Tokens in CSS (`@theme inline`), section 8.10 |
| Components | shadcn/ui (Radix primitives), restyled with our tokens | Copy into `src/components/ui` |
| Icons | lucide-react | Stroke 1.75, sizes 16 / 20 / 24 |
| Font | `@fontsource-variable/archivo` (import `wdth.css`) | Self-hosted; no Google Fonts requests |
| Routing | React Router 7 (data router) | Filters live in the URL |
| Server state | TanStack Query 5 | With persisted cache for offline |
| Forms | react-hook-form + zod 4 + `@hookform/resolvers` | Schemas shared with the backend |
| Formatted inputs | react-number-format | Currency, TIN, phone masks |
| Dates | date-fns 4 + `@date-fns/tz` | Asia/Manila everywhere |
| Natural date typing | chrono-node | "tomorrow", "next fri", "28/10" in date fields |
| Date grid | react-day-picker 9 (headless use) | Restyled into our date pickers |
| Motion | motion (`motion/react`) | Section 8.8 |
| Toasts | sonner | |
| Command palette | cmdk | |
| Mobile sheets | vaul | Bottom sheets on phones |
| Tables | TanStack Table 8 | |
| Drag and drop | dnd-kit | Board, checklist ordering, template lines |
| Charts | Recharts 3 | Lazy-loaded on Insights and Reports only |
| Uploads | react-dropzone + browser-image-compression | Section 9.8 |
| PDF preview | browser built-in viewer in an `iframe`; `pdfjs-dist` only for thumbnails | |
| Offline queue | idb-keyval | IndexedDB key-value store |
| IDs | uuid (v7) | |
| Installable app | vite-plugin-pwa | Section 19.3 |
| Unit tests | Vitest + Testing Library | All of `rules.ts` and `metrics.ts` |
| End-to-end (optional) | Playwright | The main loop in section 20 |
| Utilities | clsx, tailwind-merge | `cn()` helper |

---

## 7. Project structure and build rules

```text
src/
  app/                router, providers, app shell, theme, dev menu
  routes/             one folder per page (section 10.2)
  components/
    ui/               shadcn primitives restyled with tokens
    inputs/           MoneyInput, TinInput, PhoneInput, DateField, TimeField,
                      PeriodPicker, DateRangeField, Combobox, MultiCombobox, FileDrop ...
    domain/           StatusChip, LineChip, ReviewStamp, DueBadge, BlockingBanner,
                      ChecklistRow, NextActionLine, ReadinessMeter, OutcomePicker,
                      MessageComposer, MaskedTin, ClientFlags, AuthorizationCard ...
    charts/           ChartFrame, LineTrend, BarCompare, StackedBars, HeatCalendar, KpiTile
    layout/           Sidebar, BottomNav, TopBar, PageHeader, SplitView, Sheet, EmptyState
  domain/
    types.ts          section 15
    rules.ts          section 16 (pure functions)
    metrics.ts        section 13 (pure functions)
    schemas.ts        zod schemas for every form (section 12)
    labels.ts         every user-facing label for enums, in one place
    *.test.ts
  data/
    repositories.ts   section 17 (interface)
    mock/             in-memory + localStorage implementation, seed generator (section 18)
    api/              empty until the backend phase
    index.ts          picks implementation from VITE_DATA_SOURCE=mock|api
  hooks/              TanStack Query hooks: useToday, useTask, useReviewLine ...
  lib/                dates.ts, money.ts, tin.ts, phone.ts, ids.ts, format.ts, files.ts
  styles/             tokens.css, base.css, print.css
```

**Build rules (carry over from v1, still binding)**

1. Components import hooks, never fixtures or mock functions.
2. Every change goes through a repository method. The mock persists to memory plus localStorage.
3. The mock waits 250–600 ms per call and fails on demand (dev menu), so loading and error states are real.
4. The repository writes an activity event for every change, mock included.
5. A "Sample data" banner shows whenever `VITE_DATA_SOURCE=mock`.
6. Overrides, not-applicable marks, archiving, cancelling, and "leave anyway" require a typed reason of at least 10 characters.
7. Breakpoints: phone below 640 px (bottom navigation), tablet 640–1023 px, desktop 1024 px and up (sidebar), wide 1440 px and up.
8. Personas are mocked: Owner (Ana) and Helper (Ben). Switch in the dev menu.
9. Dev menu (mock mode only): reset sample data, switch persona, simulate offline, set failure rate (0, 10, 50, 100%), set "today" (time travel for demos), open the state gallery, open the token sheet.

---

## 8. Design system

### 8.1 Concept: the long folder and the received stamp

Her world is paper: long brown envelopes, long folders with fasteners, photocopies in twos, and the violet "RECEIVED" stamp a BIR window presses onto your copy. That stamp is the moment a trip pays off. Ordinovix borrows it.

- **Sheets on paper.** Content sits on white sheets laid on a cool grey-blue desk. No heavy shadows; sheets are separated by hairline rules, the way papers sit in a folder.
- **The stamp is the one bold element.** Violet stamp ink marks what has been verified: an accepted checklist line, a visit that is ready to go, a task completed with evidence. It is the only place the interface uses capital letters, rotation, or ink texture. Everything else is quiet.
- **One typeface, three widths.** Archivo's width axis gives expanded headings (like the heading of an official form), normal body text, and slightly condensed chips and dense table cells. One family keeps it calm; the width does the work a second family would.
- **Colour means state.** Violet is the brand and the primary action. Green, amber, orange, red, and blue are reserved for status and always come with an icon and a word.

What was deliberately avoided: warm cream backgrounds, a generic SaaS indigo, a dark sidebar, gradient washes, identical shadowed cards for everything, and all-caps labels everywhere except the stamp.

### 8.2 Colour tokens

All colours were contrast-checked (WCAG 2.2): text pairs reach at least 4.5:1, control borders and focus rings at least 3:1.

**Light mode**

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#EEF1F4` | App background, sidebar background |
| `--sheet` | `#FFFFFF` | Panels, cards, inputs, popovers, dialogs |
| `--sheet-2` | `#F6F7F9` | Sunken areas: table header, hovered row, read-only and disabled fields |
| `--sheet-3` | `#E9EDF2` | Pressed states, neutral selected, skeleton base |
| `--rule` | `#D8DEE6` | Hairline borders and dividers |
| `--rule-strong` | `#848E9E` | Input, checkbox, and radio borders (3.3:1 on white) |
| `--ink` | `#182033` | Primary text, ballpoint blue-black |
| `--ink-2` | `#465065` | Secondary text, labels |
| `--ink-3` | `#5F6879` | Muted text, placeholders, meta (5.6:1 on white) |
| `--stamp` | `#5A3DB8` | Brand, primary buttons, links, focus ring, selected date |
| `--stamp-strong` | `#4A2F9F` | Primary hover and pressed, text on `--stamp-soft` |
| `--stamp-soft` | `#EFEAFB` | Selected rows, active nav item tint, drop-zone hover |
| `--stamp-ink` | `#5A3DB8` | The stamp impression |
| `--on-stamp` | `#FFFFFF` | Text and icons on `--stamp` |

**Dark mode** ("carbon copy": blue-black desk, lavender ink)

| Token | Hex | Note |
|---|---|---|
| `--paper` | `#0E131C` | |
| `--sheet` | `#151B26` | |
| `--sheet-2` | `#1B2230` | |
| `--sheet-3` | `#242C3C` | |
| `--rule` | `#2A3343` | |
| `--rule-strong` | `#67738B` | 3.3:1 on `--sheet-2` |
| `--ink` | `#E7EAF0` | |
| `--ink-2` | `#AEB6C4` | |
| `--ink-3` | `#8A93A3` | |
| `--stamp` | `#A794F5` | Primary buttons use dark text on this lavender |
| `--stamp-strong` | `#BBAAF8` | |
| `--stamp-soft` | `#251E44` | |
| `--stamp-ink` | `#B3A2F7` | |
| `--on-stamp` | `#141022` | |

**Status tones** (fg = text and icon, bg = chip fill, bd = chip border, solid = filled badge)

| Tone | Meaning | Light fg / bg / bd | Light solid / text on solid | Dark fg / bg / bd | Dark solid / text on solid |
|---|---|---|---|---|---|
| `neutral` | Not started, not requested, completed (closed) | `#465065` / `#EEF1F4` / `#D8DEE6` | `#5F6879` / `#FFFFFF` | `#AEB6C4` / `#1F2633` / `#2F384A` | `#8A93A3` / `#0E131C` |
| `info` | Requested, submitted, waiting on others | `#1F5AA6` / `#E6F0FC` / `#B9D3F3` | `#2C6FC9` / `#FFFFFF` | `#8DBBF5` / `#13243C` / `#24416A` | `#4B92E8` / `#0B1526` |
| `warn` | Needs your review, due soon, expiring | `#8A5200` / `#FFF4DC` / `#F2D49A` | `#E9A23B` / `#2A1A00` | `#F3C46B` / `#2C2210` / `#5A4419` | `#E9A23B` / `#2A1A00` |
| `serious` | Incomplete, needs correction | `#A43F0F` / `#FDEBE2` / `#F3C2A8` | `#B5501C` / `#FFFFFF` | `#F5A47C` / `#2E1A12` / `#5E3322` | `#E07A45` / `#1A0C05` |
| `critical` | Overdue, expired, not accepted, blocked visit | `#B4232C` / `#FCE8EA` / `#F1B9BE` | `#B4232C` / `#FFFFFF` | `#F28B92` / `#2F1519` / `#5F2A31` | `#C2343D` / `#FFFFFF` |
| `good` | Ready, done, valid | `#1D6B3F` / `#E5F4EA` / `#AFD9BE` | `#1F7A47` / `#FFFFFF` | `#79D19C` / `#10261A` / `#1F4A31` | `#3FAE6E` / `#08160E` |

**Overlay and elevation**

| Token | Light | Dark |
|---|---|---|
| `--scrim` | `rgba(24,32,51,0.40)` | `rgba(0,0,0,0.60)` |
| `--shadow-float` (popovers, menus) | `0 10px 28px -8px rgba(24,32,51,.22), 0 2px 6px -2px rgba(24,32,51,.12)` | `0 12px 32px -8px rgba(0,0,0,.6)` plus 1 px `--rule` border |
| `--shadow-dialog` | `0 24px 64px -16px rgba(24,32,51,.32), 0 4px 12px -4px rgba(24,32,51,.14)` | `0 24px 64px -12px rgba(0,0,0,.7)` plus 1 px `--rule` border |
| `--focus` | `0 0 0 2px var(--sheet), 0 0 0 4px var(--stamp)` | same tokens |

Cards and panels have **no shadow**; they use a 1 px `--rule` border. Only floating layers (popovers, menus, dialogs, sheets, toasts) cast shadows.

**Documents are never inverted.** In dark mode, image and PDF previews sit on a `#FFFFFF` canvas inside a dark frame. Print is always light.

### 8.3 Chart colours

Validated with the colour-vision checker (lightness band, chroma floor, protanopia and deuteranopia separation, normal-vision separation, contrast) against the chart surface in each mode. All checks pass.

| Slot | Hue | Light (on `#FFFFFF`) | Dark (on `#151B26`) |
|---|---|---|---|
| 1 | violet | `#6C4FD6` | `#9580F0` |
| 2 | teal | `#00928A` | `#14A89E` |
| 3 | orange | `#E2732F` | `#D9702F` |
| 4 | blue | `#2C78D4` | `#4B92E8` |
| 5 | magenta | `#C64B93` | `#D865A8` |
| 6 | olive | `#8F9A1C` | `#8E9A1F` |

Rules:

- Assign slots in order, never cycled. A seventh series folds into "Other" (neutral `--ink-3`).
- Scatter or small-multiple charts may use only slots 1–3 (validated for all pairs).
- Colour follows the entity, not its rank: Ana is always slot 1 and Ben slot 2 on every chart.
- Text in charts uses ink tokens, never series colours.
- Status charts (for example, tasks by status group) use the status tones with icon and label, never series slots.

**Sequential ramp (violet)** for magnitude, such as the deadline heat calendar:

| Step | 100 | 200 | 300 | 400 | 500 | 600 | 700 |
|---|---|---|---|---|---|---|---|
| Light | `#EEEAFC` | `#D6CCF8` | `#A996EF` | `#8A6EE6` | `#6C4FD6` | `#5536B8` | `#3F2593` |
| Dark (low to high) | `#241E45` | `#34296A` | `#4A3A99` | `#6A56CC` | `#8C77EA` | `#B0A1F4` | `#D6CEFA` |

For ordered categories (for example, "0, 1, 2, 3+ chases"), start at step 300 in light and step 400 in dark so every step stays visible.

**Chart chrome**

| Role | Light | Dark |
|---|---|---|
| Gridline | `#E6E9EE` | `#232B39` |
| Axis line | `#B7C0CC` | `#3A4558` |
| Axis and tick labels | `--ink-3` | `--ink-3` |
| Tooltip | `--sheet` with `--shadow-float` | same |

### 8.4 Typography

**One family: Archivo (variable: weight 100–900, width 62–125%).** It is self-hosted through `@fontsource-variable/archivo/wdth.css`, includes the peso sign (₱) and ñ, and has tabular figures. The peso sign lives in the latin-ext file, which loads automatically when a ₱ appears; do not strip that subset.

```css
font-family: 'Archivo Variable', ui-sans-serif, system-ui, sans-serif;
```

| Token | Size / line height | Weight | Width (`font-stretch`) | Use |
|---|---|---|---|---|
| `display` | 40 / 44 | 700 | 118% | Insights hero figure only |
| `title-1` | 28 / 34 | 700 | 118% | Page titles (desktop) |
| `title-2` | 22 / 28 | 650 | 112% | Page titles (phone), dialog titles, client name in profile |
| `title-3` | 18 / 24 | 600 | 108% | Section headings inside a page |
| `body-lg` | 17 / 26 | 400 | 100% | Long reading text (help, notes) |
| `body` | 15 / 22 | 400 | 100% | Default text, table cells |
| `body-strong` | 15 / 22 | 560 | 100% | Row titles, emphasis |
| `label` | 13 / 18 | 560 | 100% | Field labels, table headers |
| `meta` | 13 / 18 | 400 | 100% | Secondary lines, timestamps |
| `chip` | 12.5 / 16 | 560 | 92% | Status chips, badges, tags |
| `caption` | 12 / 16 | 400 | 100% | Axis labels, footnotes |
| `stamp` | 11–22 | 800 | 125% | The stamp only; capitals; letter-spacing 0.06em |

Rules:

- Phones: `body` becomes 16 / 24 and **every input is at least 16 px**, otherwise iOS zooms the page when a field is focused.
- `font-variant-numeric: tabular-nums` on tables, inputs, dates, amounts, counts, and chart axes.
- Headings use `letter-spacing: -0.01em`. Body uses 0.
- No all-caps anywhere except the stamp. Labels are sentence case.
- Line length for reading text: at most 72 characters (`max-width: 68ch`).
- Text size preference (Settings → Appearance): Default 100%, Large 112.5%, Larger 125%, applied to the root font size so everything scales.
- Archivo does not include arrow or check glyphs; use lucide icons, never Unicode arrows.
- Archivo's lowercase l and capital I look alike. Wherever a reference number is shown (TIN, OR number, eFPS reference, eCAR number), add a copy button so it is never retyped.

### 8.5 Spacing, layout, radius, z-index

**Spacing scale (4 px base):** `0.5`=2, `1`=4, `1.5`=6, `2`=8, `3`=12, `4`=16, `5`=20, `6`=24, `8`=32, `10`=40, `12`=48, `16`=64.

**Layout**

| Region | Phone (<640) | Tablet (640–1023) | Desktop (≥1024) | Wide (≥1440) |
|---|---|---|---|---|
| Navigation | Bottom bar 64 px + safe area | Icon rail 72 px | Sidebar 248 px, collapsible to 72 px | Same |
| Top bar | 56 px | 56 px | 56 px | 56 px |
| Page gutter | 16 px | 24 px | 32 px | 40 px |
| Content max width | full | full | 1200 px | 1320 px (tables may go full width) |
| Detail pages | single column | single column | main 2/3 + side panel 1/3 (min 320 px) | main + side 360 px |

Alignment: everything left-aligned. Numbers right-aligned in tables. Centred text only in empty states and the stamp.

**Radius by hierarchy** (not one radius for everything)

| Token | Value | Use |
|---|---|---|
| `--r-stamp` | 3 px | Stamp impression |
| `--r-chip` | 6 px | Chips, badges, tags, folder tab |
| `--r-control` | 8 px | Buttons, inputs, menu items, date cells |
| `--r-panel` | 12 px | Sheets, cards, table containers |
| `--r-overlay` | 16 px | Dialogs, bottom sheets (top corners), command palette |
| `--r-full` | 9999 px | Avatars, switch tracks, counter badges |

**Z-index:** base 0, sticky header 20, sidebar 30, bottom bar 40, popover 50, sheet 60, dialog 70, toast 80, privacy curtain 90, dev menu 100.

### 8.6 Signature details

**The folder tab.** Client panels (client profile header, client group headers in lists, printed trip pack blocks) have a small tab on the top-left edge carrying the client code ("RSP"). Tab: `chip` type at width 112%, `--sheet` fill, `--rule` border on three sides, `--r-chip` top corners, 16 px tall, overlapping the panel border by 1 px.

**The stamp (`ReviewStamp`).**

```text
┌────────────────────┐   2 px border + 1 px outline offset 2 px (double rule)
│     ACCEPTED       │   stamp type, 11 px
│      24 OCT        │   stamp type, 14 px
│      ANA R.        │   stamp type, 11 px
└────────────────────┘   rotated −3°, colour --stamp-ink, opacity 0.9, ink texture mask
```

| Variant | Content | Where |
|---|---|---|
| `line` (compact) | ACCEPTED / date / reviewer initials | Accepted checklist line, replacing the chip in checklist rows only |
| `ready` (large) | VISIT / READY TO GO / office + date | Visit Prepare header when every item is ready |
| `done` (large) | COMPLETED / date / evidence count | Task header when completed with evidence; visit summary |
| `received` (compact) | RECEIVED / date | Evidence file tiles of kind stamped copy |

Rules: never more than one large stamp on screen; never on lists or tables (they show the chip); its rotation is fixed per record (derive −2° to −4° from the record ID) so it does not change between renders. Ink texture: an SVG `feTurbulence` noise mask at 8% that knocks out specks of the ink.

### 8.7 Iconography

lucide-react, stroke 1.75. Sizes: 16 in chips, tables, and inline text; 20 in buttons and navigation; 24 in empty states and page headers.

| Meaning | Icon | Meaning | Icon |
|---|---|---|---|
| Today | `sun` | Not requested | `circle-dashed` |
| Clients | `briefcase` | Requested | `send` |
| Tasks | `list-checks` | Received | `inbox` |
| Follow-ups | `message-circle-more` | Under review | `scan-eye` |
| Visits | `map-pin` | Accepted | `badge-check` |
| Calendar | `calendar-days` | Incomplete | `circle-alert` |
| Documents | `folder-open` | Needs correction | `pencil-line` |
| Payments | `receipt` | Not applicable | `minus-circle` |
| Insights | `chart-column` | Blocked | `lock` |
| Offices | `building-2` | Ready | `circle-check` |
| Reports | `printer` | Overdue | `alarm-clock` |
| Settings | `settings` | Expiring | `hourglass` |
| Notifications | `bell` | Offline | `cloud-off` |
| Search | `search` | Privacy mode | `eye-off` |

### 8.8 Motion

Motion explains what changed. The stamp is the only motion that exists for delight.

**Durations and easing**

| Token | Value | Use |
|---|---|---|
| `--d-instant` | 80 ms | Hover and pressed colours |
| `--d-fast` | 140 ms | Popovers, tooltips, chip changes |
| `--d-base` | 200 ms | Side sheets, dialogs, list reorder |
| `--d-slow` | 280 ms | Progress and readiness meters |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | Most transitions |
| `--ease-enter` | `cubic-bezier(0,0,.2,1)` | Things arriving |
| `--ease-exit` | `cubic-bezier(.4,0,1,1)` | Things leaving (use 75% of the enter duration) |

**Named animations**

| Name | Trigger | What moves | Spec |
|---|---|---|---|
| `stamp-press` | A line is accepted; a visit becomes ready; a task completes with evidence | The stamp | Keyframes over 360 ms: opacity 0→1 in the first 80 ms; scale 1.25→0.94→1; rotate −9°→final angle; blur 1.5 px→0. The parent row shifts down 1 px for 60 ms (the thud). No sound |
| `row-changed` | Any status change on a row | Row background | `--stamp-soft` fades to transparent over 900 ms, so the eye finds what changed |
| `popover-in` | Menus, popovers, date pickers | Panel | Opacity 0→1, scale 0.98→1, 140 ms, origin at trigger |
| `sheet-in` | Side sheet opens | Panel | Translate x 24 px→0, opacity 0→1, 200 ms; scrim fades 200 ms |
| `dialog-in` | Dialog opens | Panel | Translate y 8 px→0, opacity, 200 ms |
| `bottom-sheet` | Phone sheets | Panel | vaul defaults; drag to dismiss |
| `check-draw` | Checkbox ticked | Tick path | Stroke draws in 120 ms |
| `pack-tick` | Pack list item packed | Row | Tick draws, label turns `--ink-3` with a 1 px line-through over 200 ms |
| `meter-fill` | Readiness or progress changes | Segments | Width 280 ms `--ease-standard`; a newly ready segment flashes `--good` once |
| `list-reorder` | Rows move between Today sections | Rows | Layout animation 200 ms |
| `toast` | Saved, undo | Toast | sonner default (slide and fade) |
| `skeleton` | Loading | Blocks | Opacity pulse 0.55→1 over 1.4 s; no shimmer gradient |
| `sync-spin` | Saving | Icon | 900 ms rotation while saving |

No page-transition animations; route changes swap instantly with the top progress bar (2 px `--stamp`) shown after 200 ms if data is still loading. No animations on scroll. No hover lift on cards.

**Reduced motion.** When `prefers-reduced-motion: reduce` is set, or the user picks "Reduce motion" in Settings: no transforms or blurs; fades of 120 ms or less; the stamp appears at its final angle with a 120 ms fade; skeletons are static.

### 8.9 Effects

| Effect | Spec |
|---|---|
| Focus ring | `--focus` (2 px sheet gap, 2 px stamp ring) on every focusable element, `:focus-visible` only |
| Text selection | `::selection { background: var(--stamp-soft); color: var(--ink) }` |
| Sticky headers | Table headers and the top bar use `--sheet` at 92% opacity with `backdrop-filter: blur(8px)` and a bottom `--rule` line once scrolled |
| Scrollbars | Thin (8 px), thumb `--rule-strong` at 50%, track transparent |
| Hover rows | `--sheet-2` |
| Selected rows | `--stamp-soft` with a 2 px `--stamp` bar on the left edge |
| Disabled | 50% opacity on the control content, not on the label; cursor `not-allowed` |
| Drop zone active | Dashed 1.5 px `--stamp` border, `--stamp-soft` fill |
| Privacy mode | Client names, amounts, TINs, and file thumbnails get `filter: blur(6px)` until hovered or focused; a persistent "Privacy mode on" pill shows in the top bar |
| Privacy curtain | After idle timeout, a full-screen `--paper` layer with the logomark and "Ordinovix is locked for privacy — Continue" covers the app |

### 8.10 Tokens file

Antigravity creates `src/styles/tokens.css` exactly like this. shadcn/ui component colours map onto these roles.

```css
@import "tailwindcss";
@import "@fontsource-variable/archivo/wdth.css";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  color-scheme: light;
  --paper:#EEF1F4; --sheet:#FFFFFF; --sheet-2:#F6F7F9; --sheet-3:#E9EDF2;
  --rule:#D8DEE6; --rule-strong:#848E9E;
  --ink:#182033; --ink-2:#465065; --ink-3:#5F6879;
  --stamp:#5A3DB8; --stamp-strong:#4A2F9F; --stamp-soft:#EFEAFB; --stamp-ink:#5A3DB8; --on-stamp:#FFFFFF;

  --neutral-fg:#465065; --neutral-bg:#EEF1F4; --neutral-bd:#D8DEE6; --neutral-solid:#5F6879; --on-neutral-solid:#FFFFFF;
  --info-fg:#1F5AA6; --info-bg:#E6F0FC; --info-bd:#B9D3F3; --info-solid:#2C6FC9; --on-info-solid:#FFFFFF;
  --warn-fg:#8A5200; --warn-bg:#FFF4DC; --warn-bd:#F2D49A; --warn-solid:#E9A23B; --on-warn-solid:#2A1A00;
  --serious-fg:#A43F0F; --serious-bg:#FDEBE2; --serious-bd:#F3C2A8; --serious-solid:#B5501C; --on-serious-solid:#FFFFFF;
  --critical-fg:#B4232C; --critical-bg:#FCE8EA; --critical-bd:#F1B9BE; --critical-solid:#B4232C; --on-critical-solid:#FFFFFF;
  --good-fg:#1D6B3F; --good-bg:#E5F4EA; --good-bd:#AFD9BE; --good-solid:#1F7A47; --on-good-solid:#FFFFFF;

  --series-1:#6C4FD6; --series-2:#00928A; --series-3:#E2732F; --series-4:#2C78D4; --series-5:#C64B93; --series-6:#8F9A1C;
  --seq-100:#EEEAFC; --seq-200:#D6CCF8; --seq-300:#A996EF; --seq-400:#8A6EE6; --seq-500:#6C4FD6; --seq-600:#5536B8; --seq-700:#3F2593;
  --chart-grid:#E6E9EE; --chart-axis:#B7C0CC;

  --scrim:rgba(24,32,51,.40);
  --shadow-float:0 10px 28px -8px rgba(24,32,51,.22),0 2px 6px -2px rgba(24,32,51,.12);
  --shadow-dialog:0 24px 64px -16px rgba(24,32,51,.32),0 4px 12px -4px rgba(24,32,51,.14);
  --focus:0 0 0 2px var(--sheet),0 0 0 4px var(--stamp);

  --r-stamp:3px; --r-chip:6px; --r-control:8px; --r-panel:12px; --r-overlay:16px;
  --d-instant:80ms; --d-fast:140ms; --d-base:200ms; --d-slow:280ms;
  --ease-standard:cubic-bezier(.2,0,0,1); --ease-enter:cubic-bezier(0,0,.2,1); --ease-exit:cubic-bezier(.4,0,1,1);

  /* shadcn/ui role mapping */
  --background:var(--paper); --foreground:var(--ink);
  --card:var(--sheet); --card-foreground:var(--ink);
  --popover:var(--sheet); --popover-foreground:var(--ink);
  --primary:var(--stamp); --primary-foreground:var(--on-stamp);
  --secondary:var(--sheet-2); --secondary-foreground:var(--ink);
  --muted:var(--sheet-2); --muted-foreground:var(--ink-3);
  --accent:var(--stamp-soft); --accent-foreground:var(--stamp-strong);
  --destructive:var(--critical-solid); --destructive-foreground:var(--on-critical-solid);
  --border:var(--rule); --input:var(--rule-strong); --ring:var(--stamp);
  --radius:var(--r-control);
}

.dark {
  color-scheme: dark;
  --paper:#0E131C; --sheet:#151B26; --sheet-2:#1B2230; --sheet-3:#242C3C;
  --rule:#2A3343; --rule-strong:#67738B;
  --ink:#E7EAF0; --ink-2:#AEB6C4; --ink-3:#8A93A3;
  --stamp:#A794F5; --stamp-strong:#BBAAF8; --stamp-soft:#251E44; --stamp-ink:#B3A2F7; --on-stamp:#141022;

  --neutral-fg:#AEB6C4; --neutral-bg:#1F2633; --neutral-bd:#2F384A; --neutral-solid:#8A93A3; --on-neutral-solid:#0E131C;
  --info-fg:#8DBBF5; --info-bg:#13243C; --info-bd:#24416A; --info-solid:#4B92E8; --on-info-solid:#0B1526;
  --warn-fg:#F3C46B; --warn-bg:#2C2210; --warn-bd:#5A4419; --warn-solid:#E9A23B; --on-warn-solid:#2A1A00;
  --serious-fg:#F5A47C; --serious-bg:#2E1A12; --serious-bd:#5E3322; --serious-solid:#E07A45; --on-serious-solid:#1A0C05;
  --critical-fg:#F28B92; --critical-bg:#2F1519; --critical-bd:#5F2A31; --critical-solid:#C2343D; --on-critical-solid:#FFFFFF;
  --good-fg:#79D19C; --good-bg:#10261A; --good-bd:#1F4A31; --good-solid:#3FAE6E; --on-good-solid:#08160E;

  --series-1:#9580F0; --series-2:#14A89E; --series-3:#D9702F; --series-4:#4B92E8; --series-5:#D865A8; --series-6:#8E9A1F;
  --seq-100:#241E45; --seq-200:#34296A; --seq-300:#4A3A99; --seq-400:#6A56CC; --seq-500:#8C77EA; --seq-600:#B0A1F4; --seq-700:#D6CEFA;
  --chart-grid:#232B39; --chart-axis:#3A4558;

  --scrim:rgba(0,0,0,.60);
  --shadow-float:0 12px 32px -8px rgba(0,0,0,.6);
  --shadow-dialog:0 24px 64px -12px rgba(0,0,0,.7);
}

@theme inline {
  --font-sans: 'Archivo Variable', ui-sans-serif, system-ui, sans-serif;
  --color-paper:var(--paper); --color-sheet:var(--sheet); --color-sheet-2:var(--sheet-2); --color-sheet-3:var(--sheet-3);
  --color-rule:var(--rule); --color-rule-strong:var(--rule-strong);
  --color-ink:var(--ink); --color-ink-2:var(--ink-2); --color-ink-3:var(--ink-3);
  --color-stamp:var(--stamp); --color-stamp-strong:var(--stamp-strong); --color-stamp-soft:var(--stamp-soft);
  --color-stamp-ink:var(--stamp-ink); --color-on-stamp:var(--on-stamp);
  --color-background:var(--background); --color-foreground:var(--foreground);
  --color-card:var(--card); --color-card-foreground:var(--card-foreground);
  --color-popover:var(--popover); --color-popover-foreground:var(--popover-foreground);
  --color-primary:var(--primary); --color-primary-foreground:var(--primary-foreground);
  --color-secondary:var(--secondary); --color-secondary-foreground:var(--secondary-foreground);
  --color-muted:var(--muted); --color-muted-foreground:var(--muted-foreground);
  --color-accent:var(--accent); --color-accent-foreground:var(--accent-foreground);
  --color-destructive:var(--destructive); --color-border:var(--border); --color-input:var(--input); --color-ring:var(--ring);
  /* status tones: generate utilities like text-good-fg, bg-good-bg, border-good-bd for each tone */
  --color-good-fg:var(--good-fg); --color-good-bg:var(--good-bg); --color-good-bd:var(--good-bd);
  --color-warn-fg:var(--warn-fg); --color-warn-bg:var(--warn-bg); --color-warn-bd:var(--warn-bd);
  --color-serious-fg:var(--serious-fg); --color-serious-bg:var(--serious-bg); --color-serious-bd:var(--serious-bd);
  --color-critical-fg:var(--critical-fg); --color-critical-bg:var(--critical-bg); --color-critical-bd:var(--critical-bd);
  --color-info-fg:var(--info-fg); --color-info-bg:var(--info-bg); --color-info-bd:var(--info-bd);
  --color-neutral-fg:var(--neutral-fg); --color-neutral-bg:var(--neutral-bg); --color-neutral-bd:var(--neutral-bd);
  --radius-chip:var(--r-chip); --radius-control:var(--r-control); --radius-panel:var(--r-panel); --radius-overlay:var(--r-overlay);
}

html { font-family: var(--font-sans); background: var(--paper); color: var(--ink); }
.tnum { font-variant-numeric: tabular-nums; }
```

**Theme switching.** Settings → Appearance offers System, Light, Dark (default System). Store the choice in `localStorage['ox-theme']`. An inline script in `index.html` sets the `dark` class on `<html>` before the first paint, so there is no flash. Update `<meta name="theme-color">` to `--paper` of the active mode. Charts read colours from CSS variables at render time, so they switch with the theme.

### 8.11 Logo

**Wordmark:** "Ordinovix" in Archivo, weight 700, width 125%, letter-spacing −0.01em, colour `--ink`.

**Logomark:** a stamp frame around a bold O. Use this SVG (it inherits `currentColor`, so it works in both modes).

```svg
<svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" aria-hidden="true">
  <rect x="1.5" y="1.5" width="29" height="29" rx="6" stroke-width="2"/>
  <rect x="5" y="5" width="22" height="22" rx="3.5" stroke-width="1"/>
  <circle cx="16" cy="16" r="6" stroke-width="3.2"/>
</svg>
```

| Asset | Spec |
|---|---|
| Sidebar | Logomark 28 px in `--stamp` + wordmark 18 px |
| Collapsed rail and phone top bar | Logomark only, 28 px |
| Favicon and app icon | Logomark in `#FFFFFF` on a `#5A3DB8` rounded square (radius 22%), exported at 192, 512 and maskable 512 (safe zone 80%); `apple-touch-icon` 180 |
| Sign-in page | Logomark 48 px + wordmark 28 px |
| Print | Wordmark in black, 12 pt |

### 8.12 Voice and words

- Plain English, sentence case, active verbs. A button says what happens: "Mark accepted", "Request missing", "Start visit". The toast repeats the verb: "Marked accepted".
- Name things by her work, not by the system: "Follow-ups", not "Requests queue"; "Visit", not "Errand batch".
- Errors say what happened and what to do. They never apologize and never say "Something went wrong" alone.
- Empty screens point to the next action.
- Dates: "Oct 28" in the current year, "Oct 28, 2026" otherwise; "Today", "Tomorrow", "Yesterday" within a day. Times: "3:12 PM". Hover or long-press shows the full date and time.
- Peso: "₱12,345.50"; in tables and tiles over ₱1,000,000 use "₱1.2M" with the full amount in the tooltip.
- Filipino is available for message templates. The app interface is English in v2.

**Glossary used in the interface** (also shown on the Help page)

| Term | Meaning in Ordinovix |
|---|---|
| Client | A law firm or lawyer she serves |
| Task | One obligation for one client and period, such as "1601-EQ · Q3 2026" |
| Line | One requirement on a task's checklist |
| Received | A file or paper has arrived; not yet checked |
| Accepted | Checked by the operator and good to use |
| Blocked | At least one required line is not accepted |
| Follow-up | A request to a client for missing items, with its reminders |
| Visit | A planned trip to an office, covering one or more tasks |
| Outcome | What happened to a task at the counter |
| Certified copy | A certified true copy (never abbreviated to "CTC", which usually means the cedula) |
| RDO | Revenue District Office |
| AAB | Authorized agent bank |
| RCO | Revenue collection officer |
| SPA | Special power of attorney |

---

## 9. Component library

Every component below appears in the state gallery (`/dev/states`) with all of its variants and states, in both themes, before any page uses it.

### 9.1 Buttons

| Variant | Look | Use |
|---|---|---|
| Primary | `--stamp` fill, `--on-stamp` text | The one action that moves the page forward. At most one per view |
| Secondary | `--sheet` fill, 1 px `--rule-strong` border, `--ink` text | Supporting actions |
| Ghost | No fill, `--stamp` text; hover `--stamp-soft` | Tertiary actions, toolbar actions |
| Danger | `--critical-solid` fill, white text | Archive, cancel visit, revoke access. Always behind a confirm or reason dialog |
| Icon | 40 × 40 (44 × 44 on touch), ghost style | Toolbars; always with `aria-label` and a tooltip |
| Split | Primary + attached chevron menu | "Mark submitted ▾" with alternatives |

Sizes: small 32 px (tables only, desktop), default 40 px, large 48 px (phone primary actions, visit screens). Padding 16 px; icon gap 8 px; `label` type at 15 px, weight 560.

States: default, hover (`--stamp-strong` for primary; `--sheet-2` for secondary), pressed (scale 0.98 for 80 ms), focus (`--focus`), disabled, loading (spinner replaces the leading icon; label stays; width does not change; the button ignores clicks).

On phones, a page's primary action sits in a sticky footer bar above the bottom navigation, full width, 48 px.

### 9.2 Field anatomy (all inputs)

```text
Label                                   Optional
┌────────────────────────────────────────────┐
│ [icon] Value or placeholder        [action]│  40 px desktop, 48 px phone
└────────────────────────────────────────────┘
Hint text or error message (with icon)
```

| Part | Spec |
|---|---|
| Label | Above the field, `label` type, `--ink-2`. Never only a placeholder |
| Optional marker | "Optional" in `meta`, `--ink-3`, right side of the label row. Required fields carry no marker (most fields are required) |
| Box | `--sheet` fill (dark: `--sheet-2`), 1 px `--rule-strong` border, `--r-control`, 12 px horizontal padding |
| Hover | Border `--ink-3` |
| Focus | Border `--stamp` + `0 0 0 3px` ring of `--stamp` at 22% |
| Error | Border `--critical-fg`; message below with `circle-alert` icon in `--critical-fg`; `aria-invalid` and `aria-describedby` set |
| Disabled | `--sheet-2` fill, `--ink-3` text |
| Read-only | No border, no fill, with a copy button where the value is a reference |
| Hint | `meta`, `--ink-3`, below the box |
| Leading or trailing | 16 px icons in `--ink-3`; prefixes such as ₱ in `--ink-3`; suffixes such as "days" |

Validation timing: validate a field when it loses focus, then live as the user corrects it. Validate everything on submit, move focus to the first invalid field, and show a summary at the top of long forms ("2 fields need attention").

Text areas grow with content from 3 to 10 rows, with a character counter when a limit applies ("132 / 500").

### 9.3 Number and money inputs

**`MoneyInput`** (react-number-format `NumericFormat`)

- Leading "₱" adornment, value right-aligned, tabular figures.
- Typing accepts digits and one decimal point; pasting accepts "₱12,345.50", "12345.5", "12 345,50" is rejected with a hint.
- Shows thousands separators while typing; always two decimals on blur ("12,345.50").
- Stores an integer number of centavos (`1234550`). Empty is `null`, not 0.
- `inputMode="decimal"`; no spinner; mouse wheel never changes the value.
- Limits: 0 to 999,999,999.99 by default; negative values only where the schema allows.
- Optional quick-fill chips below for repeating amounts (for example, last amount paid for the same task template).

**`NumberStepper`** for small counts (copies, days)

- Value centred between − and + buttons (32 px, 44 px on touch), tabular.
- Holding a button repeats after 400 ms, every 80 ms.
- Arrow up and down change by the step; Page Up and Page Down by 10.
- `min`, `max`, `step` respected; out-of-range typing clamps on blur with a hint.

**`PercentInput`**: as NumberStepper with a "%" suffix and one decimal place. (Reserved; no v2 screen needs it yet.)

### 9.4 Identity inputs

**`TinInput`** (react-number-format `PatternFormat`)

- Pattern `###-###-###-#####`: nine digits plus a branch code. A three-digit branch code ("000") is also accepted and padded to five on save ("00000").
- Shows the full value only while editing. Everywhere else, `MaskedTin` shows `•••-•••-789-00000`.
- No checksum validation (none is published by BIR that we have verified); only digit count.
- Warns, but allows saving, when another client already has the same nine digits ("Rivera Salonga & Partners has this TIN. Same client?").

**`PhoneInput`**

- Accepts `09171234567`, `0917 123 4567`, `+63 917 123 4567`, `639171234567`, and Metro Manila landlines such as `(02) 8123 4567`.
- Stores E.164 (`+639171234567`, `+63281234567`).
- Displays mobile numbers as `0917 123 4567` and landlines as `(02) 8123 4567`.
- Trailing action buttons on phones: call (`tel:`), SMS (`sms:`).

**`EmailInput`**: `type="email"`, lowercase on blur, trailing `mailto:` button.

### 9.5 Choice inputs

| Component | When | Spec |
|---|---|---|
| `Select` | 2–7 fixed options | Radix Select restyled; selected item shows a 16 px check; on phones opens as a bottom sheet |
| `Combobox` | Long or searchable lists: clients, offices, templates, contacts, users | cmdk inside a popover; type to filter; recent items first; each option can show a secondary line (client code, RDO code); "Create new…" row at the bottom where creating is allowed; Enter selects; Esc closes |
| `MultiCombobox` | Several values: assignees, filter values, client assignments | Selected values show as removable chips inside the field (max two lines, then "+4 more"); Backspace removes the last chip |
| `Segmented` | 2–4 mutually exclusive views or modes: List / Board, Month / Quarter / Year | Track `--sheet-2`, selected segment `--sheet` with `--shadow-float` at 50% and `--ink` text; 36 px tall; arrow keys move |
| `RadioCards` | A choice that needs explanation: outcome, entity type, office type | Cards in a grid (1 column phone, 2–3 desktop); each has an icon, a title and a one-line description; selected card has a 2 px `--stamp` border and `--stamp-soft` fill |
| `Checkbox` | Binary inline choices | 20 px box, `--r-chip` 4 px radius, `--rule-strong` border; checked `--stamp` fill with white tick (`check-draw`); indeterminate dash |
| `PackCheckbox` | Visit pack list | 28 px box with a 44 px hit area; label strike-through when packed (`pack-tick`) |
| `Switch` | Settings that take effect immediately | 36 × 20 track; on: `--stamp`; label on the left, explanation below |
| `TagInput` | Free tags on clients and tasks | Type and press Enter or comma; suggestions from existing tags |

### 9.6 Date and time pickers

All pickers are built by us on top of react-day-picker's headless grid, styled with our tokens. They work by keyboard, by touch, and by typing.

**`DateField`** — one calendar date

```text
Due date
┌──────────────────────────────┐
│ Oct 28, 2026          [cal]  │  type here or open the calendar
└──────────────────────────────┘
In 4 days · Wednesday
```

Typing accepts (parsed with chrono-node, in Asia/Manila):
`Oct 28`, `28 Oct`, `10/28`, `28/10/2026`, `2026-10-28`, `today`, `tomorrow`, `next fri`, `+3`, `+2w`, `end of month`. Ambiguous numeric dates follow the Settings choice "Day first (28/10)" or "Month first (10/28)"; default month first, matching how the app displays dates. After parsing, the field shows the formatted date and a hint line with the relative day and weekday.

Calendar popover (desktop) or bottom sheet (phone):

```text
┌─────────────────────────────────────┐
│  ‹   October 2026   ›     [Today]   │  click the title to zoom: months, then years
│  Su  Mo  Tu  We  Th  Fr  Sa         │  week start from Settings (default Sunday)
│              1   2   3   4          │
│  5   6   7   8   9  10  11          │  • dot = tasks due that day (max 3 dots)
│ ...                                 │  holiday = small label under the number
│ 25  26  27 [28] 29  30• 31          │  [28] = selected, ◯ = today
├─────────────────────────────────────┤
│ Today  Tomorrow  Next Mon  +7 days  End of month │  quick chips
│ Clear                                Cancel  Done │  phone only shows Done
└─────────────────────────────────────┘
```

| Cell | Spec |
|---|---|
| Size | 40 px desktop, 44 px phone; `--r-control` |
| Today | 1.5 px inset ring `--stamp` |
| Selected | `--stamp` fill, `--on-stamp` text, weight 600 |
| Weekend | `--ink-3` text |
| Holiday | `--ink-3` text, 9 px holiday name under the number (truncated), full name in tooltip |
| Outside month | Hidden (no greyed spill-over days) |
| Disabled (outside min/max) | 40% opacity, not focusable by click, skipped by keyboard |
| Due dots | Up to 3 dots under the number in `--critical-fg` (overdue), `--warn-fg` (due soon), `--ink-3` (other) |

Keyboard: arrows move by day and week; Page Up and Page Down by month; Shift + Page Up and Page Down by year; Home and End to week start and end; Enter selects; Esc closes and returns focus to the field.

Weekend and holiday warning: if a chosen due date falls on a weekend or a holiday in Settings, show a `warn` hint: "Falls on a Saturday. Check whether this deadline moves to the next working day." Never move the date automatically.

**`DateRangeField`** — for filters and reports

- Desktop: two months side by side; phone: one month, scrollable.
- Preset list on the left (desktop) or as chips (phone): Today, This week, Next 7 days, This month, Last month, This quarter, Last quarter, Year to date, Last 12 months, Custom.
- First click sets the start, second click sets the end; hovering previews the range with a `--stamp-soft` band; start and end cells are filled `--stamp`.
- Typing accepts "Oct 1 – Oct 31" or two separate fields.

**`PeriodPicker`** — filing periods

```text
[ Month | Quarter | Year ]          2026  ‹ ›
┌──────┬──────┬──────┬──────┐
│ Jan  │ Feb  │ Mar  │ Apr  │      Month view: 12 cells
│ ...                       │      Quarter view: Q1 Jan–Mar ... Q4 Oct–Dec
└──────┴──────┴──────┴──────┘      Year view: 5 years
Cells show a small count of tasks already open for that period: "Sep · 12 open"
```

Defaults to the period that just ended (on Oct 24, 2026: month Sep 2026, quarter Q3 2026, year 2025). Stores the period key (`2026-09`, `2026-Q3`, `2025`).

**`TimeField`** — visit times

- Typing accepts `9`, `930`, `9:30`, `9:30a`, `930pm`, `14:00`; displays 12-hour "9:30 AM".
- Popover: a scrolling list in 15-minute steps from 6:00 AM to 8:00 PM, centred on the current value, with quick chips "8:00 AM", "Before lunch 11:00 AM", "After lunch 1:00 PM".
- Phone: bottom sheet with the same list (no native wheel).

**`DateTimeField`**: a `DateField` and a `TimeField` side by side, saved together as ISO 8601 with `+08:00`.

**`RelativeDate`** (display only): "Today", "Tomorrow", "In 3 days", "2 days ago", "Oct 28"; tooltip shows "Wednesday, Oct 28, 2026". Overdue uses `--critical-fg`.

### 9.7 Status components

**`StatusChip`** (task status) and **`LineChip`** (line status): 24 px tall, `--r-chip`, tone colours from section 8.2, 16 px icon + label in `chip` type. See the status language table in section 16.1 for every label, tone and icon.

**Line transition popover.** Tapping a `LineChip` opens a popover listing only the allowed next states (section 16.2) as large rows with icon, label and a one-line explanation. Two taps for any change. Choosing Incomplete or Needs correction asks for a one-line note (pre-fills the follow-up message). Choosing Not applicable or reopening asks for a reason (ReasonDialog). The row plays `row-changed`; accepting plays `stamp-press`.

**`ReviewStamp`**: section 8.6.

**`DueBadge`**: "Overdue 3 days" (`critical`, `alarm-clock`), "Due in 2 days" / "Due today" (`warn`), "Due Nov 10" (`neutral`). Completed tasks show "Done Oct 21" instead (`neutral`, `circle-check`).

**`AuthorizationBadge`**: "Valid to Mar 31" (`good`), "Expires in 12 days" (`warn`, `hourglass`), "Expired Oct 15" (`critical`), "No authorization" (`critical`, only where an office action needs one).

**`BlockingBanner`** — one per supplier group on a blocked task

```text
┌ lock  Blocked — waiting on client: 2 items ─────────────── [Request missing] ┐
│  Signed 2307s from payors · Original · requested Oct 14, reminded Oct 21     │
│  Quarterly payee data · Digital · flagged incomplete: "Missing September"    │
└──────────────────────────────────────────────────────────────────────────────┘
```

`critical-bg` fill when the task is overdue, otherwise `warn-bg`; items collapse after three ("+2 more").

**`NextActionLine`**: "Next: client sends signed 2307s · by Oct 28 · Rivera Salonga & Partners". Editable inline (text, who acts, by when). Missing next action on an active task shows "No next action — add one" in `--critical-fg`.

**`ReadinessMeter`** (visits and tasks): a row of segments, one per item, `good-solid` when ready and `--sheet-3` when not, with the label "7 of 9 ready". Screen readers get the same sentence. Uses `meter-fill`.

**`ClientFlags`**: small neutral chips: "GPP" / "Solo", "VAT" / "Non-VAT", "eFPS group C" / "eBIRForms", "ORUS: operator".

**`MaskedTin`**: `•••-•••-789-00000` with an eye button on the client profile only. Reveal needs a click, shows the full TIN for 30 seconds, then masks again, and logs an activity event.

### 9.8 Files: upload, camera, compression, preview

**`FileDrop`** — attach files to a line, task, visit item, payment, or authorization

```text
┌ - - - - - - - - - - - - - - - - - - - - - - - - ┐
   upload-cloud  Drop files here or  [Choose files]
   Photos or PDFs · up to 15 MB each
   [camera  Take photo]      (phones and tablets)
└ - - - - - - - - - - - - - - - - - - - - - - - - ┘
```

- Accepts `image/jpeg`, `image/png`, `image/webp`, `image/heic` (converted where the browser can decode it; otherwise ask for JPEG), and `application/pdf`.
- "Take photo" uses `<input type="file" accept="image/*" capture="environment">`. "Add another page" keeps the camera flow open to capture a multi-page document as one set.
- Dragging a file anywhere over a task page highlights every valid drop target (lines and the evidence area) and labels them ("Drop to attach to Signed 2307s").

**Pipeline per file** (shown as a row in the upload tray)

1. Check type and size. Reject with a reason ("This is a .docx file. Save it as PDF first.").
2. Images: compress in a Web Worker with browser-image-compression: longest side 2000 px, WebP at quality 0.8 (JPEG 0.82 if WebP is unsupported), target at most 600 KB, keep orientation. Show "Optimizing… 3.4 MB → 420 KB".
3. Make a thumbnail: 320 px WebP for images; first page rendered with pdf.js for PDFs.
4. Compute SHA-256 to detect exact duplicates ("This file is already attached to Quarterly payee data. Attach again?").
5. Upload (mock: store an object URL and metadata; real: upload to the API). Progress bar per file; Cancel; Retry on failure.
6. Offline: queue in IndexedDB; the row says "Waiting for connection"; the sync indicator counts it.

Uploading a file to a line moves the line to **Received**, never to Accepted.

**`FileTile`**: 72 px thumbnail (or a type icon), file name (middle-truncated, full name in tooltip), size, kind tag (Source, Filed return, Acknowledgment, Payment proof, Stamped copy, eCAR, Authorization, Other), version ("v2"), uploader and date in `meta`. Overflow menu: Preview, Download, Replace with new version, Change kind, Move to another line, Remove (soft delete with reason).

**Preview drawer**: right sheet 720 px on desktop, full screen on phones. Images: fit to width, pinch and wheel zoom, pan, rotate 90°. PDFs: browser viewer in an `iframe`. Always on a white canvas, even in dark mode. Side details: kind, line, task, versions, activity. Footer actions when opened from a received line: **Mark accepted** (primary) and **Flag** (secondary), so review happens without leaving the preview. Arrow keys move to the previous or next file in the same list.

### 9.9 Document naming convention

Files keep their original name for reference, but display and download use a predictable name:

```text
{CLIENTCODE}_{TEMPLATECODE}_{PERIOD}_{KIND}_v{N}.{ext}
RSP_1601EQ_2026Q3_ack_v1.pdf
BOL_ECARSALE_2026-10-12_stamped_v2.jpg
```

Kind slugs: `src`, `return`, `ack`, `payproof`, `stamped`, `ecar`, `auth`, `other`. Period for one-off tasks is the transaction date.

### 9.10 Tables

Built with TanStack Table. Used on Clients, Tasks (list), Documents, Payments, Audit log, Reports.

| Feature | Spec |
|---|---|
| Container | `--sheet`, 1 px `--rule`, `--r-panel`; horizontal scroll inside the container only, never the page |
| Header | 40 px, `label` type, `--ink-2`, `--sheet-2` fill, sticky (blur effect); sortable headers show a 14 px arrow icon on hover and when active |
| Rows | Comfortable 48 px, compact 36 px (Settings → Density); hairline `--rule` between rows; hover `--sheet-2`; selected `--stamp-soft` + left bar |
| Cells | Text left, numbers and amounts right with tabular figures, dates as `RelativeDate`, statuses as chips |
| First column | Sticky on horizontal scroll (client or task name) |
| Row actions | Visible on hover and focus at the row end (desktop); overflow menu always visible on touch |
| Selection | Checkbox column; Shift-click selects a range; selecting shows the bulk bar |
| Bulk bar | Slides up from the bottom: "3 selected · Assign · Add to visit · Export CSV · Clear"; Esc clears |
| Column menu | Show or hide columns, reset; choices saved per user |
| Loading | 8 skeleton rows matching the column layout |
| Empty | Inside the table: icon, one sentence, one action ("No tasks match these filters. Clear filters") |
| Pagination | "Showing 50 of 132" + "Load 50 more"; cursor-based |
| Keyboard | Up and down move row focus; Enter opens; Space selects; `/` focuses the table search |
| Phone | Tables become stacked cards: title line, two meta lines, chips, and the row action menu |

### 9.11 Filters and saved views

- One filter row above the content: a search field, then filter chips ("Status: Blocked ×", "Owner: Ana ×", "Due: Next 7 days ×"), then "+ Filter", then "Saved views ▾" on the right.
- Every filter, sort and view choice lives in the URL query string, so a refresh or a shared link restores it.
- Saved views: name a filter set ("My overdue", "Ben's eCAR jobs"). Personal by default; the owner can share a view with everyone. Built-in views per page are listed in section 11.
- "Clear all" appears when two or more filters are active.

### 9.12 Overlays

| Overlay | Desktop | Phone | Use |
|---|---|---|---|
| `Dialog` | Centred, 480 / 640 / 800 px widths, `--r-overlay`, `--shadow-dialog`, scrim | Full-height bottom sheet | Confirmations, short forms, wizards |
| `Sheet` | Right side, 480 px (forms) or 720 px (preview), full height | Full screen with a back arrow | Create and edit forms, line detail, file preview |
| `BottomSheet` | — | vaul, drag handle, snap points at 50% and 92% | Pickers, menus, quick actions on phones |
| `Popover` | Anchored, `--shadow-float`, `--r-panel` | Becomes a bottom sheet if taller than 320 px | Date pickers, transition menus, filters |
| `Tooltip` | 300 ms delay, `--ink` fill, `--sheet` text, 12 px | Long-press shows it | Icon buttons, truncated text, full dates |
| `HoverCard` | Client or task preview after 500 ms on a link | Not used | Quick context |

**`ReasonDialog`** (used for overrides, not applicable, reopen, archive, cancel, leave anyway, manual resolve, due-date change):

- Title states the action ("Leave without everything ready?").
- A sentence explaining the consequence.
- Required textarea (at least 10 characters) with up to five recent reasons as chips for one-tap reuse.
- Primary button repeats the action ("Leave anyway"); Danger style when the action closes or archives something.

**`ConfirmDialog`** for irreversible actions only (revoke a user's access, discard unsynced changes). Everything else is undoable and does not ask.

Focus is trapped inside overlays and returns to the trigger on close. Esc closes unless a form has unsaved changes, in which case it asks "Discard changes?".

### 9.13 Feedback

| Component | Spec |
|---|---|
| Toast | sonner; bottom-right on desktop, bottom-centre above the bottom bar on phones; 5 s; success toasts have Undo for reversible changes ("Marked accepted · Undo"); Undo writes a new activity event rather than erasing |
| Inline banner | Full-width strip inside a page: info, warn, critical tones; icon, sentence, optional action, optional dismiss |
| `SyncIndicator` | Top bar: "All changes saved" (`cloud-check`), "Saving…" (`sync-spin`), "Offline — 3 changes waiting" (`cloud-off`, `warn`); clicking opens the queue list with retry and discard per item |
| Offline banner | Top of the page when offline: "You're offline. Changes save on this device and sync when you're back." |
| Conflict dialog | When a save fails on `version`: "Ben changed this task at 3:12 PM." Shows both values side by side; choices "Keep mine", "Use theirs", or "Copy mine and reload" |
| Error state | Inside the failing section only: icon, "Couldn't load follow-ups.", the error code in `meta`, Retry button. The rest of the page keeps working |
| Empty state | 24 px icon in `--ink-3`, one sentence, one primary action. No illustrations |
| Skeletons | Match the final layout; `--sheet-3` blocks; `skeleton` pulse |
| Top progress bar | 2 px `--stamp` bar at the very top during route data loading longer than 200 ms |
| Sample data banner | 32 px strip above the top bar: "Sample data — nothing here is real. Reset in the dev menu." `info` tone |

### 9.14 Navigation components

**Sidebar (desktop)**

```text
[logomark] Ordinovix          [collapse]
─────────────────────────────
Today                    5    ← count of things needing her today
Tasks                         
Clients
Follow-ups               2
Visits                   1
Calendar
Documents
─────────────────────────────
Insights
Payments
Offices
Reports
─────────────────────────────
Settings
Help
[avatar] Ana Reyes  Owner  ▾   ← user menu: theme, privacy mode, sign out
```

Item: 40 px, 20 px icon, `body` text; hover `--sheet-2`; active: `--sheet` fill, `--ink` text weight 600, 3 px `--stamp` bar on the left. Counts are `chip` type in a `--r-full` badge, `--critical-solid` when they include overdue items, otherwise `--neutral-bg`.

**Bottom bar (phone)**: Today, Follow-ups, Visits, Clients, More. "More" opens a bottom sheet with the remaining destinations as a 3-column grid of icon tiles plus the user menu.

**Top bar**: page title (phones) or breadcrumbs (desktop: "Clients / Rivera Salonga & Partners / 1601-EQ Q3 2026"), global search field (desktop) or search icon (phone), "New" split button (New task, New client, Open period, Plan visit, Log follow-up, Record payment), notifications bell with unread count, sync indicator, privacy mode pill when on.

**Command palette** (Ctrl K or ⌘ K, or `/` outside inputs):

- Groups: Recent, Jump to (clients, tasks, visits, pages), Actions (New task, New client, Open period, Plan visit, Log follow-up, Record payment, Toggle theme, Toggle privacy mode, Reset sample data in mock mode).
- Fuzzy search across client names and codes, task codes and periods, visit offices.
- Each result shows its type icon and a secondary line; Enter opens; Ctrl Enter opens in a side sheet where supported.

**Keyboard shortcuts** (listed on the Help page and in a `?` overlay): `g t` Today, `g k` Tasks, `g c` Clients, `g f` Follow-ups, `g v` Visits, `g l` Calendar, `g d` Documents, `g i` Insights, `n` New menu, `/` search, `?` shortcuts, `Shift D` toggle dark mode, `Shift P` toggle privacy mode. Shortcuts never fire while typing in a field.

**Tabs**: underline style; active tab `--ink` weight 600 with a 2 px `--stamp` underline; counts in neutral badges; horizontally scrollable on phones with fade edges; the active tab is in the URL (`?tab=`).

### 9.15 Content components

| Component | Spec |
|---|---|
| `ActivityTimeline` | Vertical list, newest first, grouped by day ("Today", "Oct 21"); each event is a plain sentence ("Ana accepted Signed 2307s"), time in `meta`, actor avatar; status changes show the before and after chips; filter by type; "Show 20 more" |
| `NotesPanel` | Add note (textarea, Enter + Ctrl to save), list with author, time, edit (marked "edited"), pin to top; mentions of a task code link to it |
| `MessageComposer` | Section 11.8 |
| `KpiTile` | Label (`label`), value (`title-1` or `display`), comparison line ("down 3 from September" with an icon and words, never colour alone), optional sparkline (40 px tall, single series, no axes), click opens the detailed chart |
| `UserChip` / `Avatar` | 24 or 32 px circle with initials on `--sheet-3`; name beside it |
| `ClientChip` | Folder-tab style mini badge with the client code + name; links to the client |
| `BoardColumn` | Kanban column (Tasks board): header with status chip and count; cards 8 px apart; drop zones highlight with `--stamp-soft`; columns that cannot accept a drop show `lock` and a reason on hover |
| `TaskCard` | Client code tab, task name and period, DueBadge, StatusChip, NextActionLine (one line, truncated), owner avatar, readiness "3 of 5 accepted" |
| `ChecklistRow` | Required mark, label, copy form tag (Original / Certified copy / Photocopy ×2 / Digital), supplier tag (Client / Operator / Third party), LineChip or ReviewStamp, file tiles (up to 3, "+2"), received date and channel in `meta`, overflow (upload, mark not applicable, history, edit line). Drag handle for reordering in edit mode |

---

## 10. Navigation, routes and roles

### 10.1 Roles and permissions

Two roles in v2. "Support" (our team helping maintain her setup) is a planned third role; until then we use a Helper account with the clients she chooses.

| Capability | Owner | Helper |
|---|---|---|
| See clients | All | Only assigned clients, everywhere: lists, counts, search, calendar, Insights, notifications |
| Create clients | Yes | No |
| Edit client details | Yes | Contacts and notes only, on assigned clients |
| Reveal TIN | Yes (logged) | Yes on assigned clients (logged) |
| Create and edit tasks | Yes | On assigned clients |
| Review lines (accept, flag) | Yes | Yes on assigned clients; owner may turn this off in Settings ("Helpers can accept lines") |
| Override task status | Yes (reason) | No |
| Change due dates | Yes (source + reason) | No |
| Plan and run visits | Yes | Visits assigned to them; only tasks of assigned clients |
| Record payments | Yes | On assigned clients |
| Templates, message templates, holidays, offices | Edit | View |
| Users and access | Yes | No |
| Insights | All data | Assigned clients only |
| Reports and exports | All | Assigned clients; no full backup export |
| Audit log | Yes | No |
| Settings | All | Own profile, appearance, notifications |

A helper opening a link to a client they are not assigned to sees the no-access page (section 11.20), not an empty page.

### 10.2 Routes

| Route | Page | Section | Roles |
|---|---|---|---|
| `/sign-in` | Sign in | 11.1 | Public |
| `/access-pending` | Signed in but not on the allowlist | 11.1 | Signed in |
| `/welcome` | First-run setup | 11.2 | Owner, first sign-in |
| `/` | Today | 11.3 | All |
| `/tasks` | Tasks: list, board (`?view=list\|board`) | 11.4 | All |
| `/tasks/:taskId` | Task | 11.5 | All (scoped) |
| `/tasks/new` | New task (sheet over the previous page) | 11.5.6 | All (scoped) |
| `/open-period` | Open period wizard (dialog route) | 11.6 | Owner |
| `/clients` | Clients | 11.7.1 | All (scoped) |
| `/clients/new` | New client (sheet) | 11.7.3 | Owner |
| `/clients/:clientId` | Client profile (`?tab=overview\|tasks\|history\|documents\|follow-ups\|payments\|authorizations\|contacts\|notes`) | 11.7.2 | All (scoped) |
| `/clients/import` | Import clients from CSV | 11.7.4 | Owner |
| `/follow-ups` | Follow-ups (`?tab=due\|overdue\|waiting\|resolved`) | 11.8 | All (scoped) |
| `/follow-ups/run` | Clear due today (walk-through) | 11.8 | All |
| `/visits` | Visits (`?tab=upcoming\|done\|cancelled`) | 11.9.1 | All (scoped) |
| `/visits/new` | Plan a visit (sheet) | 11.9.2 | All |
| `/visits/:visitId` | Visit — prepare | 11.9.3 | All (scoped) |
| `/visits/:visitId/record` | Visit — record outcomes | 11.9.5 | All (scoped) |
| `/visits/:visitId/summary` | Visit summary (after finishing) | 11.9.6 | All (scoped) |
| `/visits/:visitId/print` | Printable trip pack | 11.9.4 | All (scoped) |
| `/calendar` | Calendar (`?view=month\|week\|agenda`) | 11.10 | All (scoped) |
| `/documents` | Documents library | 11.11 | All (scoped) |
| `/payments` | Payments | 11.12 | All (scoped) |
| `/offices` and `/offices/:officeId` | Offices directory | 11.13 | All |
| `/insights` | Insights (`?tab=overview\|trips\|chasing\|deadlines\|workload\|clients`) | 13 | All (scoped) |
| `/reports` | Reports and exports | 11.14 | All (scoped) |
| `/notifications` | Notification centre | 11.15 | All |
| `/search?q=` | Search results | 11.16 | All (scoped) |
| `/settings/*` | Settings (section 11.17 lists every sub-route) | 11.17 | Mixed |
| `/audit` | Audit log | 11.18 | Owner |
| `/help` | Help, glossary, shortcuts | 11.19 | All |
| `/dev/states`, `/dev/tokens` | State gallery and token sheet (mock mode only) | 20 | Dev |
| `*` | Not found | 11.20 | All |

---

## 11. Page specifications

Each page lists its purpose, layout, contents, actions, states, and QA checks. Form fields and validation for every form are in section 12. Every page needs the four states (loading, empty, error, populated) even where not repeated here.

### 11.1 Sign in and access pending

**Sign in (`/sign-in`)**: centred on `--paper`, max width 400 px.

```text
        [logomark 48]
        Ordinovix                      title-1, width 125%
        Client work, documents and BIR visits in one place.

        [ G  Continue with Google ]    secondary button, full width, 48 px

        Only people the owner has added can sign in.
        ─────────────── mock mode only ───────────────
        [ Continue as Ana — Owner ]  [ Continue as Ben — Helper ]
```

- Google button follows Google's sign-in button branding rules (white button, Google "G" logo, "Continue with Google").
- No email or password fields.
- After sign-in: allowlisted → `/` (or `/welcome` on the owner's first sign-in); not allowlisted → `/access-pending`.

**Access pending (`/access-pending`)**: "You're signed in as maria@gmail.com, but this account hasn't been added to Ordinovix. Ask the owner to add this email address." Buttons: "Use a different Google account", "Sign out". No app data is loaded.

QA: the mock personas appear only in mock mode; the access-pending page loads no client data.

### 11.2 First-run setup (`/welcome`)

A five-step wizard in a centred 640 px panel; progress shown as "Step 2 of 5" with a thin `--stamp` bar. Every step can be skipped and finished later from the "Getting started" card on Today.

| Step | Title | Content |
|---|---|---|
| 1 | Your details | Display name used in messages ({{operator}}), practice name, mobile number; optional tax agent accreditation number and validity date |
| 2 | Add your clients | Three choices as RadioCards: Import a spreadsheet (goes to `/clients/import`), Add one at a time, Do this later |
| 3 | Choose task types | Template list grouped by kind with toggles; every sample is marked "Unverified — confirm requirements before relying on it" |
| 4 | Invite a helper | Optional: email address, which clients they handle; can skip |
| 5 | Put Ordinovix on your phone | Install instructions for Android (Install button when available) and iPhone (Share → Add to Home Screen, with screenshots described in text); "Turn on reminders" button (asks for notification permission) |

Finish: lands on Today with a toast "Setup saved. You can change any of this in Settings."

### 11.3 Today (`/`)

**Purpose.** Answer "what needs me now" in ten seconds. Action first; no charts.

**Layout (desktop ≥1280)**

```text
┌ Today ──────────────────────────────────────────────────────────── [Mine | Everyone] ┐
│ Saturday, October 24 · 5 need you · 2 visits this week                               │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ [Overdue 2] [Due this week 3] [Blocked by client 4] [Awaiting my review 3]           │
│ [Follow-ups due 2] [Visits this week 2]                    ← count strip (buttons)   │
├───────────────────────────────────────────────────────┬──────────────────────────────┤
│ Overdue and due within 7 days                          │ Next visits                  │
│  task rows ...                                         │  Bank · Mon Oct 26 · Ready   │
│ Received, awaiting my review                           │  RDO 0XX · Tue Oct 27        │
│  line rows with Accept / Flag ...                      │  ▮▯▯ 1 of 3 ready            │
│ Blocked by client                                      │ Follow-ups due today         │
│  grouped by client ...                                 │  2 to send · [Start]         │
│ Ready for my action                                    │ Authorizations expiring      │
│  task rows with Mark submitted / Add to visit          │  VTL SPA expired Oct 15      │
│                                                        │ Next 14 days (mini calendar) │
│                                                        │ Recent activity (5)          │
└───────────────────────────────────────────────────────┴──────────────────────────────┘
```

Tablet and phone: single column; the right-rail sections follow the main sections; each section is a collapsible panel, open by default only when it has items.

**Sections**

| Section | Rows show | Sort | Inline actions |
|---|---|---|---|
| Getting started (until finished or dismissed) | Checklist of the five setup steps | Fixed | Continue |
| Overdue and due within 7 days | DueBadge, client tab, task and period, StatusChip, NextActionLine | Due date, oldest first | Open |
| Received, awaiting my review | Line label, client and task, file tiles, received date and channel | Received date, oldest first | Accept (plays `stamp-press`), Flag (note), Preview |
| Blocked by client | Grouped by client: missing items (first two named, "+3 more"), last request date, attempt count | Longest waiting first | Request missing (composer pre-filled) |
| Ready for my action | Tasks with every required line accepted | Due date | Mark submitted (desk work), Add to visit (office work) |
| Next visits | Office, date, assignee, ReadinessMeter, READY chip or "Not ready — 2 items" | Date | Open |
| Follow-ups due today | Count, first three clients | Expected date | Start (opens `/follow-ups/run`) |
| Authorizations expiring | AuthorizationBadge, client, type | Expiry date | Open client |
| Next 14 days | Mini month strip with due dots and visit markers | — | Click a day opens Calendar on that day |
| Recent activity | Last 5 events across clients | Newest | Open |

**Behaviour**

- "Mine / Everyone" (owner only) filters by task owner; remembered per user.
- The count strip buttons scroll to their section and move focus to its heading.
- Accepting the last blocking line moves the task from "Blocked by client" or review into "Ready for my action" without a refresh (`list-reorder`).
- Empty (nothing in any section): "Nothing needs you today." with buttons "Open a period" and "Plan a visit".
- On phones, an "Install Ordinovix on this phone" card appears once until installed or dismissed.

**QA**

1. Every count equals the number of rows in its section.
2. Accepting the last blocking line moves the task to "Ready for my action" without a refresh.
3. As Ben (Helper), only Villanueva Tan Law and Dela Cruz Law Office appear anywhere on the page, including counts.
4. With the failure rate at 100%, each section shows its own error and Retry; navigation still works.
5. Every row and action works by keyboard alone.

### 11.4 Tasks (`/tasks`)

**Purpose.** Find, sort, and move any task. Brief requirement B: filter by due date, client, owner, status, and type.

**List view** (table, section 9.10)

| Column | Content |
|---|---|
| Client | Client tab + name |
| Task | Template code + name, or the one-off title |
| Period | "Q3 2026", "Sep 2026", "2025", or the transaction date |
| Status | StatusChip (override marker if overridden) |
| Due | DueBadge |
| Ready | "3 of 5 accepted" with a 40 px mini meter |
| Next action | NextActionLine, truncated |
| Owner | UserChip |
| Visit | Visit date chip if attached |
| Updated | RelativeDate |

Filters: status group (Blocked, In progress, Ready, Submitted, Done), status, client, template, kind, owner, due range, period, office action needed, attached to a visit, from an unverified template, archived.

Built-in saved views: All open (default), My tasks, Overdue, Blocked by client, Needs my review, Ready for a visit (office action, every line accepted, not on a visit), Ready for desk filing, Submitted — awaiting confirmation, Completed this month.

Bulk actions: assign owner, add to visit (only tasks that need an office), change next action, export CSV.

**Board view** (`?view=board`)

Columns follow the task statuses in order. Columns for derived statuses (Not started, Waiting on client, Needs your review, Needs correction) are computed from lines and show a `lock` icon: cards can be dragged out of them only by fixing lines, so they accept no drops ("Moves here automatically when lines change"). Columns the operator controls (In preparation, Ready for review, Ready for next step, Submitted, Awaiting follow-up, Completed) accept drops when `rules.canSetStatus` allows it; otherwise the card snaps back and a toast explains why ("2 lines still block this task"). Dropping into Submitted opens the Mark submitted dialog; into Completed opens Mark completed. Every card also has a "Move to…" menu so the board works without dragging. Completed shows the last 30 days only.

QA: dragging a blocked task into Ready snaps back with the reason; the "Move to…" menu offers exactly the statuses `canSetStatus` allows; filters survive a refresh.

### 11.5 Task (`/tasks/:taskId`)

**Purpose.** Move one obligation forward. It always shows why the task is where it is and the one button that moves it next.

```text
┌[RSP] Rivera Salonga & Partners ─────────────────────────────────────────────────────┐
│ 1601-EQ · Quarterly expanded withholding · Q3 2026                    [Primary ▾] [⋯]│
│ [Waiting on client] [Overdue 2 days]  Due Oct 31 · template default                   │
│ Next: client sends signed 2307s · by Oct 28 · Rivera Salonga & Partners  [edit]       │
├───────────────────────────────────────────────────────────┬──────────────────────────┤
│ ! Unverified requirements — confirm with BIR before relying│ Details                  │
│ [BlockingBanner: waiting on client · 2 items]              │  Client, period, channel │
│                                                            │  Owner, created, template│
│ Checklist                     3 of 5 accepted  [+ Add line]│  Authorization: SPA valid│
│  ChecklistRow ...                                          │ Visits for this task     │
│  ChecklistRow ...  [ACCEPTED stamp]                        │  Oct 18 · More documents │
│ Evidence                                                   │ Payments                 │
│  [Filed return] [Acknowledgment] [Payment proof missing]   │  ₱12,345.50 · proof ✓    │
│ Notes                                                      │ Follow-ups (open 1)      │
│                                                            │ Activity                 │
└───────────────────────────────────────────────────────────┴──────────────────────────┘
```

#### 11.5.1 Header

- Client tab and name (link), template code and name (or one-off title), period.
- StatusChip (override shows a small marker; hover or tap shows "Overridden by Ana: Payroll unchanged — confirmed by phone").
- DueBadge and the due source: "Due Oct 31 · template default", or "Moved to May 15 · RMC 30-2026".
- NextActionLine (editable).
- When completed with evidence: the large `done` ReviewStamp at the header's right edge.

#### 11.5.2 The primary button changes with state

| Task state (from rules) | Primary button | Opens |
|---|---|---|
| Lines waiting on the client | Request missing | Composer pre-filled with exactly the missing lines |
| Lines received, not reviewed | Review lines | Scrolls to the first received line with Accept focused |
| Lines incomplete or needing correction | Request corrections | Composer with the flagged lines and their notes |
| All accepted, office action needed, not on a visit | Add to visit | Upcoming visits list (warns if the office differs) or Plan a new visit |
| All accepted, on a visit | Open visit | The visit's Prepare page |
| All accepted, desk work | Mark submitted | Dialog: date, channel, reference number, acknowledgment upload (optional) |
| Submitted | Mark completed | Dialog requiring evidence (filed return and acknowledgment; payment proof when a payment was expected) or a reason for none |
| Awaiting follow-up | Resolve follow-up | The next-action editor with "Done" |
| Completed | Reopen | ReasonDialog |

Overflow menu: Override status (reason, owner only), Change due date (new date + source reference + reason, owner only), Reassign owner, Duplicate for next period, Print client checklist, Archive (reason).

#### 11.5.3 Checklist

- Required lines first, then optional; within each, template order.
- Each line is a ChecklistRow (section 9.15). Accepted lines show the compact stamp in place of the chip.
- "Add line" opens a small form: label, required, copy form, copies, supplied by, note. A line added after the task was ready, or within 3 days of the due date, is marked "Added late" (feeds the late-blocker metric).
- Uploading to a line moves it to Received.
- Clicking a line label opens the line detail sheet: status history, files with versions, review note, follow-ups that requested it, and its template source.

#### 11.5.4 Evidence

Tiles under their own heading for kinds Filed return, Acknowledgment, Payment proof, Stamped copy, eCAR. Missing expected evidence shows an empty dashed tile with "Payment proof missing — Upload".

#### 11.5.5 Side panel

Details (client, period, channel, owner, created, template with verification badge), the authorization covering this task kind (AuthorizationBadge; "No valid authorization" in `critical` when the task needs an office), visits for this task with outcomes ("Visit 2 for this task" when it has been to an office before), payments, open follow-ups with "New follow-up", activity timeline. On phones these become collapsible sections below the checklist.

#### 11.5.6 New task (`/tasks/new`, sheet)

Choose a client and a template (or "One-off task"); the period picker matches the template frequency; the due date pre-fills from the template default and any deadline move, with its source shown; lines preview from the template with optional lines untickable. If the same client, template and period already exists: "Already open — Open that task" and Create is disabled. Fields in section 12.4.

**QA**

1. Uploading a file to a line sets it to Received, never Accepted.
2. Accepting the last blocking line changes the primary button without a refresh, and the accept plays the stamp.
3. Mark completed cannot be saved without evidence or a reason.
4. A due-date change without a source reference cannot be saved; the new source shows on the due line.
5. An override shows its marker and reason wherever the chip appears (Today, Tasks, Client, Board).
6. On a phone, the camera upload works and the checklist is usable with one thumb.
7. A line added within 3 days of the due date shows "Added late".

### 11.6 Open period wizard (`/open-period`, dialog 800 px)

Three steps, as in v1, with these additions:

1. **Period**: PeriodPicker (Month, Quarter, Year), defaulting to the period that just ended.
2. **Clients**: active clients with checkboxes, Select all, and a count of templates that apply to each for the chosen period type. Clients with none are listed last and unticked.
3. **Review**: a client × template grid, pre-ticked where the template's `appliesTo` and frequency match. Due dates pre-fill per template from its default and any deadline move for that period, editable per template column. Combinations already open show "Already open" and are skipped. Owner per client defaults to the client's assigned user. Footer: "18 tasks and 74 checklist lines will be created."

Create runs as one operation; the toast offers "View 18 new tasks", which opens Tasks filtered to them.

QA: running it twice for the same period creates nothing new; the footer numbers match what is created.

### 11.7 Clients

#### 11.7.1 Clients list (`/clients`)

Columns (desktop): code (tab style), name, flags, open tasks, blocked tasks, next due, missing items, last visit, authorization (badge), owner. Phone: cards with name, flags, "3 open · 1 blocked · next due Oct 28".

Filters: entity type, VAT status, filing channel, eFPS group, has blocked tasks, authorization expiring within 30 days or expired, assigned user, tags, active or archived. Search by name, code, or contact name; instant.

Built-in views: Active (default), Has blocked tasks, Authorization needs attention, Archived.

Actions: New client (sheet), Import (CSV), Open period for selected clients, Export CSV.

#### 11.7.2 Client profile (`/clients/:clientId`)

**Header**: folder tab with the code, name (`title-2`), ClientFlags, MaskedTin with reveal, RDO (linked to the office), filing channel and eFPS group, ORUS access holder, summary line ("4 open · 1 blocked · next due Oct 28"), buttons: New task, Request missing (all blocked lines for this client in one message), Edit, overflow (Archive with reason, Print client history).

**Warnings strip** (only when relevant): authorization expired or expiring within 30 days; no signatory contact; ORUS access holder unknown; no assigned user.

| Tab | Contents | Actions |
|---|---|---|
| Overview (default) | Open tasks by status group (small status bars with labels), next three due tasks, missing items count, last and next visit, average days this client takes to send requested documents, last completed task per template | Jump links |
| Tasks | Open tasks grouped by period, newest period first | Open, New task |
| History | Closed tasks by year and period, each with its evidence files | Open task, open file |
| Documents | All files; filter by kind, task, period, line status | Upload (choose task and line), preview |
| Follow-ups | Open and past follow-ups with attempts and responses | Log response, resolve |
| Payments | Payments for this client with totals per year | Record payment |
| Authorizations | AuthorizationCard per document, history of replaced ones | Add, replace (keeps the old one as history) |
| Contacts | People, role, preferred channel and language, signatory flag | Add, edit |
| Notes | Notes with author and date, pinned first | Add note |

#### 11.7.3 New and edit client (sheet)

Required: name, code, entity type, RDO. Everything else optional and grouped in collapsible sections ("Registration", "Filing", "Contacts", "Notes"). Fields in section 12.2. A notice above the Notes field: "Don't store eFPS, eBIRForms or ORUS passwords here." If a note contains text like "password" or "pw:", show a `warn` hint: "This looks like a password. Store passwords in a password manager, not in Ordinovix."

#### 11.7.4 Import clients (`/clients/import`)

1. **Upload** a CSV (download the template CSV from this page).
2. **Match columns**: each CSV column mapped to a client field with a Select; auto-matched by header name.
3. **Check**: a preview table with a status per row: Ready, Warning (for example, duplicate code), Error (missing name). Errors must be fixed or the row skipped.
4. **Import**: summary "24 clients added, 2 skipped". Undo within 5 minutes removes the imported batch.

**QA**

1. Filtering "has blocked tasks" plus "eFPS" returns exactly the matching sample clients.
2. Revealing the TIN writes an activity event and re-masks after 30 seconds.
3. An authorization within 30 days of expiry shows amber on the card, the warnings strip, and the list column.
4. Archiving needs a reason; the client leaves Today and lists but its History tab still opens.
5. On a phone, every tab is reachable without horizontal page scroll.
6. Importing the sample CSV twice flags every row as a duplicate on the second run.

### 11.8 Follow-ups (`/follow-ups`)

**Purpose.** Clear the day's chasing in one sitting: copy, send in her usual app, mark as sent, next.

Tabs: Due today · Overdue · Waiting (sent, not yet due) · Resolved (last 30 days). Each follow-up shows client, contact with channel icon, outstanding items with copy form, attempt number ("2nd reminder"), last sent, expected by.

| Action | Behaviour |
|---|---|
| Compose | Opens the MessageComposer for this follow-up |
| Mark as sent | Records channel, time and the exact message (as an attempt); increments the attempt; sets expected-by (default from Settings, 3 days); moves to Waiting |
| Log response | Free text plus checkboxes for lines now received; ticked lines become Received on their task |
| Escalate | Reason required ("calling the managing partner"); moves to the top of Overdue with a marker |
| Resolve | Automatic when every line in it is received or not applicable; manual resolve needs a reason |
| Clear due today | `/follow-ups/run`: one follow-up at a time, Previous and Next, progress "3 of 7", ends on a summary ("5 sent, 1 escalated, 1 skipped") |

A follow-up whose expected-by date passes with lines still outstanding returns to Due today with the reminder template and the next attempt number.

**MessageComposer** (sheet on desktop, full screen on phones)

```text
To:        [Combobox: Maria Santos · Viber · Filipino]
Template:  [Paalala (Filipino) ▾]          Language: [English | Filipino]
Items:     [x] Signed 2307s from payors (original)
           [x] Quarterly payee data — September missing
Send by:   [DateField: Oct 28]
┌ Preview (editable) ─────────────────────────────────────────────┐
│ Magandang araw po, Maria. Follow-up lang po sa:                 │
│ 1) Signed 2307s from payors (original)                          │
│ 2) Quarterly payee data — September missing                     │
│ para sa 1601-EQ (Q3 2026). ...                                  │
└─────────────────────────────────────────── 412 characters · 3 SMS┘
[ Copy message ]   [SMS] [Email] [Viber]          then: [ Mark as sent ]
```

- Placeholders are filled from the selected contact, client, task, items and dates (`{{contact}}`, `{{client}}`, `{{task}}`, `{{period}}`, `{{items}}`, `{{due}}`, `{{deadline}}`, `{{operator}}`).
- `{{items}}` renders as a numbered list with copy form and any flag note.
- Editing the preview changes only this message, not the template.
- Copy puts exactly the preview text on the clipboard; toast "Message copied".
- Shortcuts: SMS opens `sms:` with the body; Email opens `mailto:` with subject and body; Viber opens `viber://forward?text=` (phones with Viber installed). Messenger has no reliable way to pre-fill text, so it uses Copy.
- After any copy or shortcut, "Mark as sent" becomes the primary button, with the channel pre-selected from the shortcut used.
- SMS length estimate shown for SMS: 160 characters fit one message, longer texts split into parts of 153; if the text contains characters outside the SMS alphabet, the limits drop to 70 and 67.

**QA**

1. The clipboard holds exactly the previewed text with placeholders filled.
2. Mark as sent stores the message text in the attempt and moves the follow-up to Waiting.
3. Ticking lines in Log response updates that task's blocking banner and Today's counts.
4. The walk-through never skips an item and its summary is correct.
5. The contact's preferred language is pre-selected and can be switched.

### 11.9 Visits

**Purpose.** The product's signature. A visit refuses to call itself ready until every item is, and turns what happened at the counter into next actions before she leaves the building. Prepare and Record are designed phone-first.

#### 11.9.1 Visits list (`/visits`)

Tabs: Upcoming · Done · Cancelled. Card per visit: office (with type icon), date and time, assignee, item count, ReadinessMeter, READY chip or "Not ready — 2 items". Done cards show the outcome summary ("3 done · 1 needs documents") and duration. Actions: Plan a visit.

#### 11.9.2 Plan a visit (`/visits/new`, sheet)

Office (Combobox from the Offices directory, with "Add office"), date (DateField; warns on weekends and holidays), arrival time (optional TimeField), assignee, purpose (optional). Then "Add tasks": a picker listing ready tasks that need an office, ranked by same office or RDO, then due date; each with its intended action (Submit, Pay, Claim, Inquire, Follow up). Tasks that are not ready can be added with a warning chip ("Not ready — will block the visit").

#### 11.9.3 Prepare (`/visits/:visitId`)

```text
┌ RDO 0XX — Sample District A · Tue Oct 27, 9:00 AM · Ben ────────── [Print] [Start] ┐
│ ▮▯▯  1 of 3 items ready                                        or the READY TO GO   │
│                                                                    stamp when 3 of 3 │
├ Not ready — 2 items ────────────────────────────────────────────────────────────────┤
│  lock Title (certified copy) not yet accepted — Bautista Ocampo Legal  [Open task]   │
│  lock SPA expired Oct 15 — Villanueva Tan Law                          [Open client] │
├ Items (3 tasks) ─────────────────────────────────────────────────────────────────────┤
│ [BOL] eCAR — sale of real property · Submit                                          │
│      Readiness reasons, authorization to bring (SPA valid to Mar 31)                 │
│      Questions to raise: [textarea]                                                  │
│ [VTL] Registration update · Submit          Not ready: SPA expired                   │
│ [RSP] 0619-E payment · Pay                  Ready                                    │
├ Pack list (12) ────────────────────────────────── [Packed 4 of 12] ─────────────────┤
│ [BOL] [ ] Deed of absolute sale — Certified copy ×2                                  │
│       [ ] Transfer certificate of title — Certified copy                             │
│ [VTL] [x] Secretary's certificate — Original                                         │
│ Always bring: [ ] Valid ID  [ ] Authorization letter originals  [ ] Long brown       │
│               envelope  [ ] Pen                         ← from Settings → Visit kit  │
├ Office notes ────────────────────────────────────────────────────────────────────────┤
│ "Window 5 for ONETT. Arrive before 9 for a queue number." [Open in Maps]             │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- Readiness comes only from `rules.visitReadiness` (section 16). Reasons are sentences naming the item and the client.
- When every item becomes ready, the large `ready` stamp lands on the header (`stamp-press`) and the meter turns fully green.
- Pack list: every physical item across all tasks (copy form Original, Certified copy, Photocopy), grouped by client, with copies count; large PackCheckbox; packed state saved per visit. Digital items are not in the pack list unless marked "print and bring".
- Start visit: if not ready, opens ReasonDialog ("Leave without everything ready?"); records `readyAtDeparture` per item and `startedAt`; status becomes In progress and the page switches to Record.

#### 11.9.4 Printable trip pack (`/visits/:visitId/print`)

Paper size from Settings (A4, Letter, or Long 8.5 × 13 in, the common Philippine legal size), portrait, black-and-white safe. Header: office, date, time, assignee. One block per client (with the folder tab drawn as an outline): task, action, items with drawn checkboxes and copy counts, authorization details, questions, three blank lines for notes. Masked TINs only. Footer: page "1 of 2" and "Printed Oct 24, 2026, 3:12 PM". Uses `print.css`: no navigation, no colours except black and grey, page breaks never split a client block.

#### 11.9.5 Record (`/visits/:visitId/record`)

One card per item, phone-first, large targets:

```text
[BOL] eCAR — sale of real property · Submit
What happened?
 ( ) Completed                         ( ) Submitted, waiting for processing
 ( ) Paid, proof to follow             ( ) More documents requested
 ( ) Correction required               ( ) Not accepted
 ( ) Follow-up visit needed
Why? (shown for anything except Completed)
 [Combobox: Missing document ▾]        Avoidable? [Yes] (pre-set from the cause)
 Note: [textarea]
Next action: [text]   Due: [DateField]   Who: [Client | Me | Third party]
Window or officer (optional): [text]
Evidence: [Take photo] [Upload]  → stamped copy, receipt
```

- Outcome causes (section 15) are grouped as **Avoidable** (missing document, wrong copy form, wrong number of copies, expired or missing authorization, error in the documents, unsigned or unnotarized) and **Not avoidable** (office system down, officer unavailable, new or changed requirement, processing time, cut-off time reached, other). The avoidable toggle defaults from the cause and can be changed.
- Saving applies the outcome mapping (section 16.6) and creates follow-ups or next actions in the same operation.
- Works offline: outcomes and photos queue locally; the sync indicator shows the count.
- Finish visit is enabled when every item has an outcome. It asks for the end time (defaults to now) and optional costs: transport, parking, other (MoneyInputs), then shows the summary.

#### 11.9.6 Visit summary (`/visits/:visitId/summary`)

The large `done` stamp, outcome per item, follow-ups and next actions created (links), duration ("2 h 15 min"), costs total, and "Repeat trips this visit created: 1 avoidable (missing document), 0 not avoidable". Button: "Back to Today".

**QA**

1. A visit containing a task with an unaccepted original shows Not ready and names the item and client.
2. Accepting that line on the Task page turns the visit Ready without a refresh, and the ready stamp lands.
3. Leave anyway cannot proceed without a reason; the reason appears in the activity log and in Insights.
4. The trip pack prints on A4 and on Long 8.5 × 13 with nothing cut off and every pack item present.
5. "More documents requested" creates the follow-up and next action in one save.
6. Offline: record two outcomes with photos, reconnect, and both appear with no loss and no duplicates.
7. Finishing records duration and costs, and the summary totals match.

### 11.10 Calendar (`/calendar`)

Views: Month (default desktop), Week, Agenda (default phone). Built with our own grid on date-fns, not a calendar library.

| Item | Look | Click |
|---|---|---|
| Task due | Chip with client code and template code, tone by due state, `lock` if blocked | Opens the task in a side sheet |
| Visit | Chip with `map-pin`, office short name, READY or "Not ready" | Opens Prepare |
| Follow-up expected | Small `message-circle-more` marker | Opens the follow-up |
| Authorization expiry | `hourglass` marker | Opens the client |
| Holiday | Label under the date number, `--ink-3` | Tooltip with the name and type |
| Deadline move | `info` marker on the original and new date | Shows the source reference |

- Month cells show up to 3 items and "+4 more" (opens the day in a popover).
- Filters: client, owner, item type, template.
- Drag a visit to another day to reschedule it (Undo toast). Dragging a task due date opens the Change due date dialog (source and reason required). Keyboard alternative: each item's menu has "Move to date…".
- Header: Today button, previous and next, month title, view switcher, filters.

### 11.11 Documents (`/documents`)

All files across clients the user can see. Toggle between table (default) and grid (thumbnails). Columns: thumbnail, display name (section 9.9), client, task, line, kind, line status (Received or Accepted), uploaded by, uploaded at, size. Filters: client, task, kind, line status, uploader, date range, file type. Built-in views: Needs review (files on lines in Received), Evidence (filed returns, acknowledgments, payment proofs, stamped copies, eCARs), Recently added. Preview drawer with review actions. Bulk: download (backend phase), change kind, export list.

### 11.12 Payments (`/payments`)

Records payments made for tasks. Ordinovix never computes taxes; the operator enters what was paid.

Columns: paid on, client, task, amount (right-aligned), channel, provider, reference number (copy button), paid by (client or operator), reimbursement status, proof (file tile or "Proof missing" in `warn`). A totals row sums the filtered rows. Filters: client, channel, paid by, reimbursement status, proof missing, date range. Built-in views: All, Proof missing, To be reimbursed. Action: Record payment (sheet, fields in section 12.8). Recording a payment with proof on a task whose outcome was "Paid, proof to follow" clears that next action.

### 11.13 Offices (`/offices`)

A directory she maintains: name, type (RDO, AAB, LGU, SEC, client office, other), RDO code, address, map link, hours, phone, and tips ("Window 5 for ONETT"). Office detail shows the tips prominently, visits to this office with outcomes, average visit duration, and the first-pass completion rate at this office. Sample offices are labelled "Sample — replace with real details".

### 11.14 Reports and exports (`/reports`)

| Report | For | Output |
|---|---|---|
| Client checklist | Sending to a client: what is needed, by when, in what form | Print or PDF (browser print); English or Filipino headings |
| Client history | One client, one year: every task, outcome, evidence list | Print |
| Trip pack | A visit | Print (same as 11.9.4) |
| Monthly operations summary | The operator (and us): KPIs, trips, chases, on-time rate vs baseline | Print |
| CSV exports | Clients, tasks, lines, follow-ups and attempts, visits and outcomes, payments, activity | CSV download (UTF-8 with BOM so Excel shows ñ and ₱ correctly) |
| Full backup | Owner only | Backend phase: zip of all records (JSON) and files. Mock: JSON only |

Print settings on each report: paper size (A4, Letter, Long), include notes, include masked TIN (never the full TIN).

### 11.15 Notifications (`/notifications`)

List grouped by day, unread in `--ink` weight 600 with a 6 px `--stamp` dot, read in `--ink-2`. Filters: All, Unread. "Mark all as read". Each notification links to its record. The bell in the top bar opens a 400 px popover with the latest 10 and "See all". Notification types and rules are in section 14.

### 11.16 Search (`/search?q=`)

Results grouped as Clients, Tasks, Documents, Visits, Follow-ups, Payments, Offices, each showing the top 5 with "Show all". Matches client name, code and contacts; task code, name and period ("Q3 2026", "2026-Q3"); document display name; visit office; payment reference number. Matched text highlighted with `--stamp-soft`. Recent searches stored per user.

### 11.17 Settings (`/settings/*`)

Two-column layout on desktop: settings navigation on the left (240 px), the form on the right (max 720 px). On phones, the navigation is a list that opens each page. Changes save per section with a "Save changes" button and a toast "Settings saved", except switches, which apply immediately.

| Route | Page | Who | Contents |
|---|---|---|---|
| `/settings/profile` | Profile | All | Name, display name for messages, mobile number, initials |
| `/settings/appearance` | Appearance | All | Theme (System, Light, Dark), density (Comfortable, Compact), text size (100, 112.5, 125%), reduce motion, week starts on (Sunday, Monday), typed dates (Month first, Day first) |
| `/settings/notifications` | Notifications | All | Push on this device (button and status), per-type switches (section 14), quiet hours (default 8:00 PM–7:00 AM), daily digest time (default 7:00 AM) |
| `/settings/practice` | Practice | Owner | Practice name, default operator name, tax agent accreditation number and validity (reminders before expiry), default paper size |
| `/settings/users` | Users and access | Owner | Allowlist and invitations (email, role, assigned clients), "Helpers can accept lines" switch, revoke access (ConfirmDialog), last sign-in per user |
| `/settings/templates` | Task templates | Owner edits, Helper views | List: code, name, kind, frequency, office action, verification badge, active switch |
| `/settings/templates/:id` | Template editor | Owner | Template fields (section 12.10) and requirement lines (add, edit, drag to reorder); "Mark verified" requires a source reference and date |
| `/settings/messages` | Message templates | Owner | List and editor with placeholder chips and live preview against a sample client |
| `/settings/calendar` | Deadlines and holidays | Owner | Holidays (date, name, type), deadline moves (template, period, new date, source reference, source link), due-soon window (default 7 days), follow-up wait (default 3 days), authorization warning (default 30 days) |
| `/settings/visit-kit` | Visit kit | Owner | "Always bring" items added to every pack list |
| `/settings/baseline` | Before Ordinovix | Owner | Baseline numbers from discovery (section 13.3) |
| `/settings/data` | Data | Owner | Export everything, import, backup status (backend: last weekly export, restore window), retention period, reset sample data (Demo organization only) |
| `/settings/security` | Security and privacy | All (own); Owner (org) | Idle lock (Off, 5, 15, 30 minutes; default 15), privacy mode on start, signed-in devices with "Sign out", sign out everywhere |
| `/settings/about` | About | All | Version, privacy notice, what Ordinovix does not do, open-source licences |

QA: a template cannot be marked verified without a source reference; tasks from an unverified template show the amber note; as Ben, Settings shows only Profile, Appearance, Notifications, Security and About, plus read-only templates.

### 11.18 Audit log (`/audit`, owner)

Every activity event across the organization in a table: time, actor, record (link), action, before → after, device. Filters: actor, record type, action, date range; built-in views: Sensitive (TIN reveals, file downloads, access changes), Overrides and reasons. Export CSV. Read-only.

### 11.19 Help (`/help`)

Glossary (section 8.12), how statuses work (the line and task flow as a simple diagram), keyboard shortcuts, "What Ordinovix doesn't do" (no tax computation, no filing, no tax advice; templates are unverified until she verifies them), and a support contact (configurable).

### 11.20 Error and system pages

| Page | Copy | Actions |
|---|---|---|
| Not found (404) | "This page doesn't exist. It may have been moved or the link is incomplete." | Go to Today, Search |
| No access (403) | "You don't have access to this client. Ask the owner to assign it to you." | Go to Today |
| Offline (no cached page) | "You're offline and this page hasn't been opened on this device before." | Retry, Go to Today |
| Error boundary | "This page stopped working. Your saved changes are safe." + error ID | Reload, Go to Today |
| Update ready (banner) | "A new version of Ordinovix is ready." | Reload |
| Signed out (session expired) | "You were signed out. Sign in again to continue; unsynced changes are kept on this device." | Continue with Google |

---

## 12. Forms and fields

Every form has a zod schema in `src/domain/schemas.ts` with the same name as its heading (for example `clientFormSchema`). The backend will reuse these schemas. "Req" = required.

### 12.1 Shared validation rules

| Rule | Spec |
|---|---|
| Reason fields | Trimmed, at least 10 characters, at most 500 |
| Short notes (flags) | At least 3, at most 200 |
| Names and labels | At least 2, at most 120; no leading or trailing spaces |
| Codes | Uppercase letters, digits and hyphens, 2–12 characters, unique within the organization |
| Dates | `YYYY-MM-DD`; "paid on" and "received on" dates cannot be in the future |
| Money | Integer centavos, at least 1 unless stated |
| URLs | `https://` only |
| Email | Lowercased; one address |
| Free text | Strip control characters; never render as HTML |

### 12.2 Client

| Field | Component | Req | Validation and notes |
|---|---|---|---|
| Name | Text | Req | 2–120; shown everywhere |
| Code | Text (uppercase) | Req | 2–6 characters, unique; suggested from initials ("Rivera Salonga & Partners" → "RSP") |
| Entity type | RadioCards | Req | General professional partnership (GPP), Sole practitioner, Other |
| RDO | Combobox (Offices of type RDO) or a code | Req | "Add office" allowed |
| Registered name | Text | | If different from the name |
| TIN | TinInput | | Missing TIN shows a "TIN missing" chip on the profile |
| VAT status | Select | | VAT; Non-VAT, percentage tax; Non-VAT, 8% option; Not sure yet. "Not sure yet" excludes the client from VAT-specific templates and shows a hint in Open period |
| Taxpayer size | Select | | Micro, Small, Medium, Large, Not sure yet. Hint: "Confirm with the client's BIR records" |
| Filing channel | Select | | eFPS, eBIRForms, Manual |
| eFPS group | Select | | A–E; shown only when channel is eFPS |
| ORUS enrolled | Switch | | |
| ORUS access held by | Select | | Client, Me, Someone else, Unknown |
| Uses invoicing software | Switch | | |
| Accounting year ends | Select (month) | | Default December. Informational in v2 |
| Preferred language | Segmented | | English, Filipino; default for message templates |
| How they send documents | Textarea | | ≤300, for example "PDFs by email; originals by courier on Fridays" |
| Address | Textarea | | ≤300 |
| Assigned to | MultiCombobox (users) | | Helpers see only clients assigned to them |
| Tags | TagInput | | |
| Notes | Textarea | | ≤2000; password warning (section 11.7.3) |

### 12.3 Contact

| Field | Component | Req | Validation and notes |
|---|---|---|---|
| Name | Text | Req | |
| Title | Select | | Atty., Mr., Ms., none |
| Role | Text with suggestions | | Managing partner, Accountant, Secretary, Bookkeeper |
| Mobile | PhoneInput | | One of mobile or email is required |
| Email | EmailInput | | |
| Preferred channel | Select | Req | Viber, Messenger, SMS, Email, Phone call, In person |
| Language | Segmented | | Defaults to the client's |
| Signs documents | Switch | | At least one signatory per client is recommended (warning strip) |
| Notes | Textarea | | ≤500 |

### 12.4 Task (new and edit)

| Field | Component | Req | Validation and notes |
|---|---|---|---|
| Client | Combobox | Req | Scoped to the user's clients |
| Template | Combobox | Req unless one-off | Shows code, name, frequency and a verification badge |
| Title | Text | Req if one-off | |
| Kind | Select | Req if one-off | Filing, Payment, Registration update, One-time transaction, Local government, Other |
| Period | PeriodPicker | Req for recurring | Month, quarter or year per template frequency |
| Transaction date | DateField | Req for one-off | |
| Due date | DateField | Req | Pre-filled from the template rule and deadline moves; shows its source |
| Owner | Combobox (users) | Req | Defaults to the client's assigned user, else the creator |
| Channel | Select | | Defaults from the client |
| Payment expected | Switch | | Defaults from the template; when on, completion asks for payment proof |
| Office action needed | Switch | | Defaults from the template; enables "Add to visit" |
| Lines | Checklist preview | | From the template; optional lines can be unticked; ad hoc lines can be added |
| Next action | Text + who (Client, Me, Third party) + DateField | | |
| Tags | TagInput | | |
| Notes | Textarea | | ≤2000 |

Duplicate rule: one open task per client + template + period. The form shows a link to the existing task instead of saving.

### 12.5 Checklist line (ad hoc add and edit)

| Field | Component | Req | Validation and notes |
|---|---|---|---|
| Label | Text | Req | 2–120 |
| Required | Switch | | Default on |
| Form of copy | Select | Req | Original, Certified copy, Photocopy, Digital |
| Copies | NumberStepper | | 1–10; shown for Photocopy and Certified copy |
| Supplied by | Select | Req | Client, Me, Third party |
| Needed from client by | DateField | | Pre-fills follow-up due dates |
| Print and bring | Switch | | For Digital lines that must be printed for an office visit; adds them to the pack list |
| Note | Textarea | | ≤300 |

### 12.6 Line review actions

| Action | Fields | Rules |
|---|---|---|
| Mark requested | Channel (optional), date (default today) | Usually set by "Mark as sent" on a follow-up |
| Mark received | Received on (default today), via channel, files (optional) | Uploading sets this automatically |
| Start review | — | |
| Mark accepted | Note (optional) | Stamps reviewer and time; plays the stamp |
| Mark incomplete / Needs correction | Note (Req, 3–200) | Note pre-fills the next follow-up |
| Not applicable | Reason (Req, ≥10) | Removes the line from blocking |
| Reopen | Reason (Req, ≥10) | From Accepted or Not applicable |

### 12.7 Task status actions

| Action | Fields | Rules |
|---|---|---|
| Mark submitted | Submitted on (DateField, default today, not future), channel (eFPS, eBIRForms, Manual, At an office), reference number (optional, copy-friendly), acknowledgment file (optional), note | Sets `submittedAt` |
| Mark completed | Completed on (default today), evidence (checklist of attached evidence kinds), reason if evidence is missing (≥10) | Sets `completedAt`; plays the `done` stamp when evidence exists |
| Override status | New status (Select), reason (≥10) | Owner only; marker everywhere |
| Change due date | New date, source reference (Req, for example "RMC 30-2026"), source link (optional URL), reason (≥10) | Owner only; `dueSource.kind = 'override'` |
| Reassign | Owner (Combobox), note | Notifies the new owner |
| Archive | Reason (≥10) | Hidden from active lists; History keeps it |

### 12.8 Payment

| Field | Component | Req | Validation and notes |
|---|---|---|---|
| Client | Combobox | Req | |
| Task | Combobox (client's tasks) | Req | |
| Amount | MoneyInput | Req | > 0 |
| Paid on | DateField | Req | Not in the future |
| Channel | Select | Req | Authorized agent bank (over the counter), Revenue collection officer, Online payment, Other |
| Provider | Text with suggestions | | The bank or online channel used; free text so the list never goes stale |
| Reference number | Text | | Copy button wherever shown |
| Paid by | Segmented | Req | Client, Me (advanced) |
| Reimbursement | Select + DateField | When paid by Me | Not needed, Waiting, Reimbursed (with date) |
| Proof | FileDrop | | Missing proof shows "Proof missing" and a next action |
| Note | Textarea | | ≤300 |

### 12.9 Visits

**Plan a visit**

| Field | Component | Req | Notes |
|---|---|---|---|
| Office | Combobox (Offices) | Req | "Add office" inline |
| Date | DateField | Req | Weekend and holiday warning |
| Arrive by | TimeField | | |
| Assignee | Combobox (users) | Req | |
| Purpose | Text | | ≤200 |
| Tasks | Picker | | Each with an intended action: Submit, Pay, Claim, Inquire, Follow up |

**Visit item**: intended action (Req), questions to raise (≤500).

**Record outcome**

| Field | Component | Req | Notes |
|---|---|---|---|
| Outcome | RadioCards | Req | Seven outcomes (section 16.6) |
| Cause | Combobox | Req unless Completed | Grouped Avoidable / Not avoidable |
| Avoidable | Switch | | Defaults from the cause |
| Note | Textarea | Req when cause is Other | ≤500 |
| Next action | Text | Req unless Completed with evidence | |
| Next action due | DateField | Req unless Completed with evidence | |
| Who acts next | Segmented | Req unless Completed with evidence | Client, Me, Third party |
| Documents requested | List of text rows ("+ Add document") | Req for More documents requested | Each row becomes a new checklist line |
| Lines affected | Checkbox list of the task's lines | Req for Correction required; optional for Not accepted | Chosen lines become Needs correction with the note |
| Window or officer | Text | | ≤80 |
| Evidence | FileDrop with camera | | Stamped copy, receipt, eCAR |

**Finish visit**: ended at (TimeField, default now), transport, parking, other costs (MoneyInput, optional), cost note.

### 12.10 Task template and requirement lines

| Field | Component | Req | Notes |
|---|---|---|---|
| Code | Text | Req | Unique, for example "1601-EQ" |
| Name | Text | Req | |
| Kind | Select | Req | |
| Frequency | Select | Req | Monthly, Quarterly, Annual, One-off |
| Applies to entity types | MultiCombobox | | Empty = all |
| Applies to VAT statuses | MultiCombobox | | Empty = all |
| Office action needed | Switch | | |
| Default office type | Select | | When office action is on |
| Default intended action | Select | | |
| Payment expected | Switch | | |
| Default due rule | Select + NumberStepper | | "Day N of the next month", "N days after the period ends", or None |
| Source reference | Text | | Required to mark verified |
| Source link | URL | | |
| Description | Textarea | | Shown on tasks |
| Active | Switch | | |

Requirement line: label (Req), description, required, form of copy, copies, supplied by, valid for (days, for items that expire), source reference, verified. Lines reorder by drag (dnd-kit) or with "Move up / Move down".

**Mark verified** (dialog): source reference (Req), source link, verified on (default today), note. Editing any requirement of a verified template sets it back to unverified with a notice.

### 12.11 Message template

Name (Req), language (Req), used for (First request, Reminder, Correction request, Outcome update, Other), body (Req, ≤1500) with placeholder chips that insert at the cursor, live preview against a sample client. Unknown placeholders are flagged ("{{amount}} isn't a placeholder Ordinovix knows").

### 12.12 Authorization

| Field | Component | Req | Notes |
|---|---|---|---|
| Type | Select | Req | Special power of attorney, Authorization letter, Secretary's certificate, Partnership resolution, Other |
| Authorized person | Combobox (users) | Req | |
| Covers | MultiCombobox (task kinds) | Req | |
| Issued on | DateField | Req | |
| Valid until | DateField | | Empty = no stated expiry |
| Notarized | Switch | | |
| Document | FileDrop | | Recommended |
| Note | Textarea | | |

### 12.13 Follow-ups

| Form | Fields |
|---|---|
| New follow-up | Client (Req), task, lines (multi), contact (Req), channel (Req), expected by (default today + follow-up wait), note |
| Mark as sent | Channel (Req), sent at (default now), expected by (Req), message (captured from the composer) |
| Log response | Response (Req, ≤1000), lines now received (checkboxes), received via |
| Escalate | Reason (≥10) |
| Resolve manually | Reason (≥10) |

### 12.14 Office, holiday, deadline move, visit kit

| Form | Fields |
|---|---|
| Office | Type (Req), name (Req), RDO code (when RDO), address, map link (auto-built from the address, editable), hours, phone, tips (≤1000) |
| Holiday | Date (Req), name (Req), type (Regular holiday, Special non-working day, Local holiday, Office closure), source reference |
| Deadline move | Template (or all templates), period, new due date (Req), source reference (Req), source link, note. Applies to existing open tasks of that template and period after a confirmation listing them |
| Visit kit item | Label (Req), note, active |

### 12.15 Baseline and monthly check-in

**Before Ordinovix** (Settings → Baseline): period covered (DateRangeField), office trips per month, repeat trips per month, follow-up messages per week, hours per week spent finding records or checking status (step 0.5), filings late or missed per quarter, confidence about what is outstanding (1–5 RadioCards: "Not sure at all" to "Completely sure"), note.

**Monthly check-in** (prompt on Today on the first working day of each month, owner only, dismissible): hours spent last week finding records or checking status, confidence (1–5), one optional note. Feeds Insights.

### 12.16 Users and practice

| Form | Fields |
|---|---|
| Invite person | Google account email (Req), role (Owner, Helper), assigned clients (helpers), note |
| Practice | Practice name, display name for messages, mobile, tax agent accreditation number, accreditation valid until, default paper size, support contact |
| Profile | Name, display name, mobile |

---

## 13. Insights: dashboards, KPIs and charts

### 13.1 Principles

- Today stays action-first with no charts. Insights is where she, and we, see whether Ordinovix is working.
- Every metric maps to a measure in the brief (section 12 of the brief) and has an exact definition in `src/domain/metrics.ts` with unit tests.
- Every chart has a title, a one-sentence takeaway computed from the data ("Avoidable repeat trips fell from 5 in June to 1 in October."), a "Show table" toggle, and "Download CSV".
- One y-axis per chart, always. Two measures of different scale get two charts.
- Charts are lazy-loaded; Insights must not slow down Today.

### 13.2 Layout

Filter row (one line above everything): date range (default last 6 months), owner (owner only), client, template. Filters apply to every chart on the tab and live in the URL.

Tabs: Overview · Trips · Chasing · Deadlines · Workload · Clients.

**Overview**

```text
┌ KPI ─────────────┬ KPI ─────────────┬ KPI ─────────────┐
│ First-pass       │ Avoidable repeat │ Visits that left │
│ completion       │ trips (Oct)      │ ready            │
│ 86%              │ 1                │ 92%              │
│ up 9 pts vs Sep  │ down 2 vs Sep    │ up 15 pts        │
│ baseline ~55%    │ baseline 4/month │                  │
├──────────────────┼──────────────────┼──────────────────┤
│ Follow-ups per   │ On-time rate     │ Tasks with owner │
│ task (median)    │                  │ and next action  │
│ 1.5              │ 94%              │ 97%              │
└──────────────────┴──────────────────┴──────────────────┘
[ First-pass completion rate by month — line ]
[ Trips that needed a return, by month — stacked bars: Avoidable / Not avoidable ]
[ Monthly check-in: confidence and hours finding records — two small line charts ]
```

KPI tiles: 3 columns desktop, 2 tablet, 1 phone (horizontal scroll strip on phones). The comparison line uses an arrow icon and words in `--ink-2` ("up 9 points from September"). It is not coloured, because for some metrics a drop is the good news; the words carry the meaning.

### 13.3 Metric definitions

| Metric | Definition | Data used | Brief measure |
|---|---|---|---|
| First-pass completion rate | Of tasks whose first office visit happened in the period, the share whose first visit outcome was Completed, Submitted (waiting), or Paid (proof to follow) | VisitItem.outcome, Visit.startedAt, earliest visit per task | Avoidable repeat trips |
| Trips needing a return | Visit items in the period with outcome More documents requested, Correction required, Not accepted, or Follow-up visit needed | VisitItem.outcome | Repeat trips |
| Avoidable repeat trips | Trips needing a return where `avoidable = true` | VisitItem.outcomeCause, avoidable | Avoidable repeat trips |
| Visits that left ready | Visits started in the period without a leave-anyway reason ÷ visits started | Visit.departureOverrideReason | Visits prepared in advance |
| Follow-ups per task | For tasks completed in the period: number of follow-up attempts linked to the task; show the median (and mean in the table) | FollowUpAttempt, Task.completedAt | Missing-document follow-ups |
| Days to collect | For tasks that became ready in the period: days from created to all required lines accepted; median | Task.createdAt, Task.readyAt | Time to collect and review |
| Late-discovered blockers | Lines created or flagged after the task was ready, or within 3 days of its due date | TaskLine.lateDiscovered | Tasks blocked late |
| On-time rate | Of tasks due in the period: share submitted (or completed, if never submitted) on or before the due date; tasks still open past due count as late | Task.dueDate, submittedAt, completedAt | Deadline pressure |
| Ownership coverage | Active tasks with an owner and a next action ÷ active tasks | Task.ownerUserId, nextAction | Clear owner and next action |
| Client response time | For lines requested and received: days from first request to received; median per client | TaskLine.requestedAt, receivedAt | Follow-up burden |
| Items per visit | Visit items ÷ finished visits | VisitItem, Visit | Consolidated trips |
| Visit cost | Sum of transport, parking and other costs; cost per completed item | Visit.costs | Money saved |
| Visit time | Finished minus started, per visit; median | Visit.startedAt, finishedAt | Time saved |
| Confidence and hours | Monthly check-in answers vs baseline | Pulse, Baseline | Workload and confidence |

Baseline comparisons appear only when Settings → Baseline has values. Every baseline figure is labelled "self-reported before Ordinovix".

### 13.4 Chart catalogue

| Tab | Chart | Form | Colour | Notes |
|---|---|---|---|---|
| Overview | First-pass completion rate by month | Line, 2 px, 8 px markers | series-1 | Y axis 0–100%; dashed `--ink-3` reference line at the baseline with a direct label |
| Overview | Trips needing a return by month | Stacked bars, 2 px gap between segments, 4 px rounded top | series-1 Avoidable, series-2 Not avoidable | Legend + direct labels on the last bar |
| Overview | Confidence (1–5) by month; hours finding records by month | Two small lines | series-1 each | Two charts, never one dual-axis chart |
| Trips | Visits per month | Bars | series-1 | |
| Trips | Items per visit by month | Line | series-1 | Separate chart |
| Trips | Outcomes by month | 100% stacked bars | Status tones: good (Completed), info (Submitted or paid, waiting), warn (More documents, correction, follow-up), critical (Not accepted) | Legend with icons; status, not series colours |
| Trips | Why trips needed a return | Horizontal bars, sorted | series-1 for every bar | Avoidable causes carry an "Avoidable" tag in the label |
| Trips | Visit cost by month | Bars, ₱ axis | series-1 | |
| Trips | Offices | Table | — | Visits, first-pass rate, median duration, last visit |
| Trips | Left without everything ready | Table | — | Visit, reasons, items that then failed |
| Chasing | Follow-up messages sent per week | Bars | series-1 | |
| Chasing | Follow-ups needed per completed task | Bars for 0, 1, 2, 3+ | Ordinal ramp from seq-300 | |
| Chasing | Median days for clients to send documents | Line | series-1 | |
| Chasing | Late-discovered blockers by month | Bars | series-1 | |
| Chasing | Items most often missing | Table | — | Line label, times requested, average attempts |
| Deadlines | On-time rate by month | Line | series-1 | |
| Deadlines | Due in the next 8 weeks | Heat calendar (weeks × weekdays) | Sequential violet ramp, 0 = `--sheet-2` | Cell tooltip lists tasks; click opens Calendar |
| Deadlines | Overdue now by age | Bars: 1–3, 4–7, 8–14, 15+ days | Ordinal ramp from seq-300 | |
| Deadlines | Deadline moves | Table | — | Template, period, from → to, source |
| Workload | Open tasks per person | Horizontal bars | series by person (Ana slot 1, Ben slot 2) | |
| Workload | Open tasks by status group | One horizontal stacked bar | Status tones with icons | |
| Workload | Tasks completed per month per person | Lines | series by person | Legend + direct labels |
| Workload | Days to collect by template | Horizontal bars (median) | series-1 | |
| Workload | Tasks missing a next action | Table | — | Link to fix |
| Clients | Client table | Table | — | Open tasks, median days to send, follow-ups this quarter, trips needing a return linked to the client, last completed. Neutral wording; for planning earlier requests |

### 13.5 Chart anatomy and interaction

- `ChartFrame`: `--sheet` panel, title (`title-3`), takeaway (`body`, `--ink-2`), the plot, footer with "Show table" and "Download CSV".
- Marks: lines 2 px; markers 8 px with a 2 px `--sheet` ring; bars with 4 px rounded data ends anchored to the baseline; 2 px `--sheet` gap between stacked segments and adjacent bars.
- Gridlines: horizontal only, `--chart-grid` hairline; axis line `--chart-axis`; tick labels `caption` in `--ink-3`, tabular.
- Legend: always present for two or more series, above the plot, left-aligned; up to four series are also direct-labelled at the line end or the last bar.
- Hover: line charts get a vertical crosshair and a tooltip listing every series at that point; bar charts get a per-bar tooltip; hit areas are larger than the marks. Tooltip: `--sheet`, `--shadow-float`, `--r-control`, values tabular, series identified by a 10 px swatch + name (text in ink).
- Keyboard: the chart is focusable; left and right arrows move between points and announce the tooltip text to screen readers.
- Table view: the same data as an accessible table (section 9.10 styles).
- Print and forced colours: bars use a 45° line texture to separate series; lines get distinct markers (circle, square).
- Empty: "Not enough data yet. Insights fill in after your first month with Ordinovix."

---

## 14. Notifications and reminders

In-app notifications are always created. Push notifications go to devices where the person turned them on (installed app; on iPhone this needs iOS 16.4 or later and the app added to the Home Screen). No email in v2.

| Type | When (Asia/Manila) | Who | Push default | Text (in-app; push uses the same, shortened) |
|---|---|---|---|---|
| Daily digest | 7:00 AM daily (Settings) | Each user | On | "Today: 2 overdue, 3 to review, 2 follow-ups to send, visit tomorrow not ready." |
| Due soon and blocked | In the digest and at 7:00 AM | Task owner | On | "RSP 1601-EQ Q3 is due in 3 days and still waiting on 2 items." |
| Newly overdue | 7:00 AM | Task owner, organization owner | On | "DCL 2551Q Q3 is overdue." |
| Follow-ups due | In the digest | Follow-up owner | On | "2 follow-ups to send today." |
| Received, needs review | When a helper marks a line received or uploads | Task owner (or organization owner if helpers can't accept) | Off | "Ben added Quarterly payee data for RSP 1601-EQ. Needs review." |
| Visit tomorrow not ready | 5:00 PM the day before | Assignee, organization owner | On | "Tomorrow's RDO visit is not ready: 2 items." |
| Visit ready | When a visit becomes ready | Assignee | Off | "Monday's RDO visit is ready to go." |
| Left without everything ready | When a visit starts with a reason | Organization owner | On | "Ben started the RDO visit with 1 item not ready: SPA expired." |
| Outcome recorded | When a helper records an outcome | Organization owner | Off | "BOL eCAR: more documents requested. Follow-up created." |
| Authorization expiring | 30 days, 7 days, and on the expiry date | Organization owner | On | "VTL's SPA expires in 7 days." |
| Accreditation expiring | 60 and 30 days before | Organization owner | On | "Your tax agent accreditation expires on Jan 15." |
| Assigned to you | When a task or visit is assigned | Assignee | On | "Ana assigned you the BOL eCAR visit on Oct 26." |
| Monthly check-in | 9:00 AM on the first working day | Organization owner | Off | "Two quick questions about last month." |

Rules:

- **Lock-screen privacy:** push text uses client codes and task codes only. Never names, TINs, amounts or document contents.
- Quiet hours (default 8:00 PM–7:00 AM) hold pushes until they end; in-app notifications still appear.
- Each notification links to its record; opening it marks it read.
- Duplicates collapse: one notification per type, record and day.
- In mock mode, notifications are generated by the seed and by actions; a push is simulated with a toast labelled "Push preview".

---

## 15. Data: what Ordinovix records

### 15.1 Entity map

```text
Org ─┬─ OrgSettings, Baseline, Pulse, VisitKitItem, Holiday, DeadlineMove, MessageTemplate, Office
     ├─ Membership (email, role, assigned clientIds) ── User ── UserPrefs, Notification, SavedView
     ├─ TaskTemplate ── RequirementTemplate
     └─ Client ─┬─ Contact
                ├─ Authorization ── DocumentFile
                ├─ Task ─┬─ TaskLine ── DocumentFile (versions)
                │        ├─ Payment ── DocumentFile (proof)
                │        ├─ FollowUp ── FollowUpAttempt
                │        └─ VisitItem ── Visit ── Office
                └─ Note (also on Task and Visit)
ActivityEvent: append-only log for every change to any of the above
```

### 15.2 Domain contract (`src/domain/types.ts`)

Field names here are final unless the operator preview changes them. The backend turns each interface into a table.

```ts
// ===== Primitives =====
export type ID = string;            // UUIDv7, generated client-side
export type ISODate = string;       // 'YYYY-MM-DD', an Asia/Manila calendar date
export type ISODateTime = string;   // ISO 8601 with offset, e.g. '2026-10-24T15:12:00+08:00'
export type HHmm = string;          // '09:30'
export type Centavos = number;      // integer; ₱12,345.50 === 1234550
export type PeriodKey = string;     // '2026-09' (month) | '2026-Q3' (quarter) | '2026' (year)

export interface BaseRecord {
  id: ID;
  orgId: ID;
  createdAt: ISODateTime; createdBy: ID;
  updatedAt: ISODateTime; updatedBy: ID;
  version: number;                  // 1 on create, +1 on every update; stale saves are rejected
  deletedAt?: ISODateTime; deletedReason?: string; // soft delete only
}

// ===== Enums =====
export type Role = 'owner' | 'helper';
export type EntityType = 'gpp' | 'solo' | 'other';
export type VatStatus = 'vat' | 'non_vat_percentage' | 'non_vat_8pct' | 'unknown';
export type SizeClass = 'micro' | 'small' | 'medium' | 'large' | 'unknown';
export type FilingChannel = 'efps' | 'ebirforms' | 'manual';
export type EfpsGroup = 'A' | 'B' | 'C' | 'D' | 'E';
export type AccessHolder = 'client' | 'operator' | 'other' | 'unknown';
export type Channel = 'viber' | 'messenger' | 'sms' | 'email' | 'phone' | 'in_person';
export type Language = 'en' | 'fil';
export type TaskKind = 'filing' | 'payment' | 'registration' | 'one_time_transaction' | 'lgu' | 'other';
export type Frequency = 'monthly' | 'quarterly' | 'annual' | 'one_off';
export type Supplier = 'client' | 'operator' | 'third_party';
export type CopyForm = 'original' | 'certified_true_copy' | 'photocopy' | 'digital'; // label: "Certified copy"
export type OfficeType = 'rdo' | 'bank' | 'lgu' | 'sec' | 'client_office' | 'other';
export type VisitAction = 'submit' | 'pay' | 'claim' | 'inquire' | 'follow_up';
export type DocumentKind =
  | 'source' | 'filed_return' | 'acknowledgment' | 'payment_proof'
  | 'stamped_copy' | 'ecar' | 'authorization' | 'other';
export type PaymentChannel = 'aab_otc' | 'rco' | 'online' | 'other';

export type TaskStatus =
  | 'intake' | 'waiting_on_client' | 'review_required' | 'needs_correction'   // derived from lines
  | 'in_preparation' | 'ready_for_review' | 'ready_next_step'                 // operator-set
  | 'submitted' | 'awaiting_follow_up' | 'completed' | 'archived';            // operator-set

export type LineStatus =
  | 'not_requested' | 'requested' | 'received' | 'under_review'
  | 'accepted' | 'incomplete' | 'needs_correction' | 'not_applicable';

export type Outcome =
  | 'completed' | 'submitted_pending' | 'paid_proof_pending' | 'more_documents_requested'
  | 'correction_required' | 'not_accepted' | 'follow_up_required';

export type OutcomeCause =
  // avoidable by default
  | 'missing_document' | 'wrong_copy_form' | 'wrong_copy_count' | 'authorization_problem'
  | 'document_error' | 'unsigned_or_unnotarized'
  // not avoidable by default
  | 'office_system_down' | 'officer_unavailable' | 'new_requirement'
  | 'processing_time' | 'cutoff_reached' | 'other';

export type VisitStatus = 'planned' | 'in_progress' | 'done' | 'cancelled'; // Ready / Not ready is derived

// Derived, never stored
export type DueState = 'closed' | 'overdue' | 'due_today' | 'due_soon' | 'ok';
export type FollowUpState = 'not_sent' | 'due_today' | 'overdue' | 'waiting' | 'escalated' | 'resolved';
export type AuthorizationState = 'valid' | 'expiring' | 'expired';
export type StatusGroup = 'blocked' | 'in_progress' | 'ready' | 'submitted' | 'done';

// ===== Organization, people, settings =====
export interface Org { id: ID; name: string; isDemo: boolean; createdAt: ISODateTime }

export interface OrgSettings {
  orgId: ID;
  practiceName: string;
  operatorDisplayName: string;          // {{operator}} in messages
  mobileE164?: string;
  accreditation?: { number: string; validUntil?: ISODate };
  dueSoonDays: number;                  // default 7
  followUpWaitDays: number;             // default 3
  authWarnDays: number;                 // default 30
  helpersCanAccept: boolean;            // default true
  idleLockMinutes: 0 | 5 | 15 | 30;     // default 15
  quietHours: { start: HHmm; end: HHmm }; // default 20:00–07:00
  digestTime: HHmm;                     // default 07:00
  paperSize: 'a4' | 'letter' | 'long';  // long = 8.5 x 13 in
  weekStartsOn: 0 | 1;                  // 0 = Sunday (default)
  retentionYears: number;               // confirm with the operator
  supportContact?: string;
  updatedAt: ISODateTime; version: number;
}

export interface User { id: ID; name: string; displayName?: string; email: string; initials: string;
  mobileE164?: string; lastSignInAt?: ISODateTime }

export interface Membership extends BaseRecord {
  email: string;                        // the allowlist entry (Google account)
  userId?: ID;                          // set on first sign-in
  role: Role;
  clientIds: ID[];                      // helpers: assigned clients; owners: ignored (all)
  active: boolean;
  invitedAt: ISODateTime; acceptedAt?: ISODateTime; revokedAt?: ISODateTime;
}

export interface UserPrefs {
  userId: ID;
  theme: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  textScale: 1 | 1.125 | 1.25;
  reduceMotion: boolean | null;         // null = follow the device
  dateOrder: 'mdy' | 'dmy';             // for typed dates
  privacyModeOnStart: boolean;
  todayScope: 'mine' | 'everyone';
  pushTypes: NotificationType[];
  tableColumns: Record<string, string[]>;
}

// ===== Clients =====
export interface Client extends BaseRecord {
  code: string;                         // 'RSP'
  displayName: string;
  registeredName?: string;
  entityType: EntityType;
  hasTin: boolean;
  tinMasked?: string;                   // '•••-•••-789-00000'; full TIN only via clients.revealTin
  rdoCode: string; rdoOfficeId?: ID;
  vatStatus: VatStatus;
  sizeClass: SizeClass;
  filingChannel?: FilingChannel; efpsGroup?: EfpsGroup;
  orusEnrolled: boolean; accessHolder: AccessHolder;
  usesInvoicingSoftware: boolean;
  fiscalYearEndMonth: number;           // 1–12, default 12 (informational in v2)
  preferredLanguage: Language;
  deliveryPreference?: string;
  address?: string;
  assignedUserIds: ID[];
  tags: string[];
  notes?: string;
  status: 'active' | 'archived'; archivedReason?: string;
}

export interface Contact extends BaseRecord {
  clientId: ID; name: string; title?: 'Atty.' | 'Mr.' | 'Ms.'; role?: string;
  phoneE164?: string; email?: string; preferredChannel: Channel; language: Language;
  isSignatory: boolean; notes?: string;
}

export interface Authorization extends BaseRecord {
  clientId: ID;
  type: 'spa' | 'authorization_letter' | 'secretary_certificate' | 'partnership_resolution' | 'other';
  scope: TaskKind[]; granteeUserId: ID;
  issuedOn: ISODate; validUntil?: ISODate; notarized: boolean;
  documentId?: ID; replacedById?: ID; notes?: string;
}

// ===== Templates and calendar =====
export interface TaskTemplate extends BaseRecord {
  code: string; name: string; kind: TaskKind; frequency: Frequency;
  appliesTo: { entityTypes?: EntityType[]; vatStatuses?: VatStatus[] };
  officeAction: boolean; defaultOfficeType?: OfficeType; defaultAction?: VisitAction;
  paymentExpected: boolean;
  defaultDue?: { kind: 'day_of_next_month' | 'days_after_period_end'; value: number };
  description?: string;
  sourceRef?: string; sourceUrl?: string;
  verified: boolean; verifiedOn?: ISODate; verifiedBy?: ID;
  active: boolean;
}

export interface RequirementTemplate extends BaseRecord {
  taskTemplateId: ID; label: string; description?: string; required: boolean;
  copyForm: CopyForm; copies?: number; suppliedBy: Supplier; validityDays?: number;
  sortOrder: number; sourceRef?: string; verified: boolean;
}

export interface DeadlineMove extends BaseRecord {
  templateId?: ID;                      // undefined = all templates
  period: PeriodKey; newDueDate: ISODate;
  sourceRef: string; sourceUrl?: string; note?: string;
}

export interface Holiday extends BaseRecord {
  date: ISODate; name: string;
  type: 'regular' | 'special_non_working' | 'local' | 'office_closure';
  sourceRef?: string;
}

export interface MessageTemplate extends BaseRecord {
  name: string; language: Language;
  purpose: 'first_request' | 'reminder' | 'correction' | 'outcome_update' | 'other';
  body: string;                         // placeholders: {{contact}} {{client}} {{task}} {{period}}
  active: boolean;                      //   {{items}} {{due}} {{deadline}} {{operator}}
}

export interface Office extends BaseRecord {
  type: OfficeType; name: string; rdoCode?: string; address?: string; mapUrl?: string;
  hours?: string; phoneE164?: string; tips?: string; isSample: boolean;
}

export interface VisitKitItem extends BaseRecord { label: string; note?: string; active: boolean; sortOrder: number }

// ===== Work =====
export interface NextAction { text: string; owner: Supplier; due?: ISODate }

export interface Task extends BaseRecord {
  clientId: ID; templateId?: ID; title?: string;   // title for one-off tasks
  kind: TaskKind;
  period?: PeriodKey; transactionDate?: ISODate;   // one of the two
  dueDate: ISODate;
  dueSource: { kind: 'template' | 'deadline_move' | 'override' | 'manual'; ref?: string; url?: string };
  channel?: FilingChannel;
  ownerUserId: ID;
  officeAction: boolean; paymentExpected: boolean;
  status: TaskStatus;                   // the stored, operator-set status; display uses rules.derivedStatus
  statusOverride?: { status: TaskStatus; reason: string; by: ID; at: ISODateTime };
  nextAction?: NextAction;
  readyAt?: ISODateTime;                // first time every required line was accepted (metrics)
  submittedAt?: ISODateTime; submittedVia?: FilingChannel | 'office'; submissionRef?: string;
  completedAt?: ISODateTime; completionNoEvidenceReason?: string;
  archivedReason?: string;
  tags: string[]; notes?: string;
}

export interface TaskLine extends BaseRecord {
  taskId: ID; clientId: ID;             // clientId copied for permission scoping
  requirementTemplateId?: ID;
  label: string; required: boolean;
  copyForm: CopyForm; copies?: number; suppliedBy: Supplier; printAndBring: boolean;
  status: LineStatus; sortOrder: number;
  neededBy?: ISODate;
  requestedAt?: ISODateTime;            // first request (metrics)
  receivedAt?: ISODateTime; receivedVia?: Channel;
  reviewedBy?: ID; reviewedAt?: ISODateTime; reviewNote?: string;
  flagNote?: string;                    // incomplete / needs correction note
  naReason?: string;
  lateDiscovered: boolean;              // rules.isLateDiscovered at creation or flagging
  documentIds: ID[];
}

export interface DocumentFile extends BaseRecord {
  clientId: ID; taskId?: ID; lineId?: ID; visitItemId?: ID; paymentId?: ID; authorizationId?: ID;
  kind: DocumentKind;
  displayName: string;                  // section 9.9 convention
  originalName: string; mimeType: string;
  sizeBytes: number; originalSizeBytes: number; compressed: boolean; pageCount?: number;
  sha256: string;
  storageKey: string;                   // immutable; mock: object URL key
  thumbnailKey?: string;
  versionNo: number; replacesId?: ID;
  source: 'upload' | 'camera' | 'import';
  retainUntil?: ISODate;
}

export interface FollowUp extends BaseRecord {
  clientId: ID; taskId?: ID; lineIds: ID[]; contactId?: ID;
  channel: Channel; language: Language; templateId?: ID;
  expectedBy?: ISODate;
  attemptCount: number;
  status: 'open' | 'sent' | 'answered' | 'escalated' | 'resolved'; // due/overdue/waiting are derived
  escalatedReason?: string;
  response?: string; respondedAt?: ISODateTime;
  resolvedAt?: ISODateTime; resolvedReason?: string;
}

export interface FollowUpAttempt extends BaseRecord {
  followUpId: ID; attemptNo: number; channel: Channel;
  sentAt: ISODateTime; sentBy: ID; messageSnapshot: string; expectedBy: ISODate;
}

export interface Visit extends BaseRecord {
  officeId?: ID; officeType: OfficeType; officeName: string; rdoCode?: string;
  plannedDate: ISODate; arriveBy?: HHmm;
  assigneeUserId: ID; purpose?: string;
  status: VisitStatus;
  packedLineIds: ID[]; packedKitItemIds: ID[];
  startedAt?: ISODateTime; departureOverrideReason?: string;
  finishedAt?: ISODateTime;
  costs?: { transport?: Centavos; parking?: Centavos; other?: Centavos; note?: string };
  cancelledReason?: string;
}

export interface VisitItem extends BaseRecord {
  visitId: ID; taskId: ID; clientId: ID;
  intendedAction: VisitAction; questions?: string;
  readyAtDeparture?: boolean;
  isFirstVisitForTask: boolean;         // set when the outcome is recorded (metrics)
  outcome?: Outcome; outcomeCause?: OutcomeCause; avoidable?: boolean; outcomeNote?: string;
  windowOrOfficer?: string;
  nextAction?: NextAction;
  evidenceDocumentIds: ID[];
  outcomeAt?: ISODateTime; recordedBy?: ID;
  followUpId?: ID;                      // created by the outcome mapping
}

export interface Payment extends BaseRecord {
  clientId: ID; taskId: ID;
  amount: Centavos; paidOn: ISODate;
  channel: PaymentChannel; provider?: string; referenceNo?: string;
  paidBy: 'client' | 'operator';
  reimbursement?: { status: 'not_needed' | 'waiting' | 'reimbursed'; reimbursedOn?: ISODate };
  proofDocumentIds: ID[]; note?: string;
}

// ===== Collaboration, tracking, system =====
export interface Note extends BaseRecord {
  entity: 'client' | 'task' | 'visit'; entityId: ID; body: string; pinned: boolean; editedAt?: ISODateTime;
}

export interface SavedView extends BaseRecord {
  userId: ID; page: 'tasks' | 'clients' | 'documents' | 'payments' | 'follow_ups' | 'audit';
  name: string; query: string;          // URL query string
  shared: boolean;
}

export type NotificationType =
  | 'daily_digest' | 'due_soon_blocked' | 'overdue' | 'follow_ups_due' | 'received_needs_review'
  | 'visit_not_ready_tomorrow' | 'visit_ready' | 'left_not_ready' | 'outcome_recorded'
  | 'authorization_expiring' | 'accreditation_expiring' | 'assigned' | 'monthly_check_in';

export interface Notification extends BaseRecord {
  userId: ID; type: NotificationType; title: string; body: string; link: string;
  entity?: ActivityEntity; entityId?: ID; readAt?: ISODateTime; pushedAt?: ISODateTime;
}

export interface Baseline extends BaseRecord {
  periodStart: ISODate; periodEnd: ISODate;
  tripsPerMonth?: number; repeatTripsPerMonth?: number; followUpsPerWeek?: number;
  hoursFindingPerWeek?: number; lateFilingsPerQuarter?: number;
  confidence?: 1 | 2 | 3 | 4 | 5; note?: string;
}

export interface Pulse extends BaseRecord {
  month: string;                        // '2026-10'
  hoursFindingLastWeek?: number; confidence?: 1 | 2 | 3 | 4 | 5; note?: string;
}

export type ActivityEntity =
  | 'client' | 'contact' | 'authorization' | 'task' | 'line' | 'document' | 'follow_up'
  | 'visit' | 'visit_item' | 'payment' | 'template' | 'office' | 'settings' | 'membership' | 'note';

export type ActivityAction =
  | 'created' | 'updated' | 'status_changed' | 'overridden' | 'due_changed' | 'reassigned'
  | 'archived' | 'restored' | 'deleted'
  | 'file_uploaded' | 'file_replaced' | 'file_viewed' | 'file_downloaded' | 'tin_revealed'
  | 'follow_up_sent' | 'response_logged' | 'escalated' | 'resolved'
  | 'visit_started' | 'outcome_recorded' | 'visit_finished' | 'visit_cancelled'
  | 'access_granted' | 'access_revoked' | 'signed_in' | 'exported' | 'imported' | 'verified';

export interface ActivityEvent {
  id: ID; orgId: ID; at: ISODateTime; actorId: ID;
  entity: ActivityEntity; entityId: ID; clientId?: ID;
  action: ActivityAction;
  summary: string;                      // plain sentence: "Ana accepted Signed 2307s"
  before?: unknown; after?: unknown; reason?: string; device?: string;
}
```

**View models** (returned by repositories, defined in `src/domain/views.ts`): `TaskSummary` (task + derived status, due state, accepted/required counts, blocking reason, attached visit), `ClientSummary`, `TodayQueue`, `VisitSummary`, `VisitDetail` (visit, items with readiness, pack list), `FollowUpView` (follow-up + derived state + lines + contact + attempts), `OpenPeriodPreview`, `OpenPeriodPlan`, `SearchResults`, `CalendarItem`, `OfficeStats`, `ImportPreview`, report shapes (`ClientChecklistReport`, `ClientHistoryReport`, `MonthlySummaryReport`), Insights types (`InsightsTab`, `InsightsFilter`, and `InsightsData`, a map from each tab to its data shape), and `Page<T> = { items: T[]; nextCursor?: string; total?: number }`. Antigravity defines these shapes from the page specs; field names follow section 15.2.

### 15.3 Tracking fields and what they prove

| Field | Captured when | Feeds |
|---|---|---|
| `TaskLine.requestedAt`, `receivedAt` | Follow-up marked sent; line received | Client response time |
| `TaskLine.lateDiscovered` | Line added or flagged | Late-discovered blockers |
| `Task.readyAt` | Every required line accepted for the first time | Days to collect |
| `Task.submittedAt`, `completedAt` | Mark submitted, Mark completed, visit outcome | On-time rate |
| `FollowUpAttempt` | Mark as sent | Follow-ups per task, messages per week |
| `Visit.startedAt`, `finishedAt` | Start visit, Finish visit | Visit time |
| `Visit.departureOverrideReason`, `VisitItem.readyAtDeparture` | Start visit | Visits that left ready |
| `VisitItem.outcome`, `outcomeCause`, `avoidable`, `isFirstVisitForTask` | Record outcome | First-pass rate, repeat trips, causes |
| `Visit.costs` | Finish visit | Visit cost |
| `Payment.*` | Record payment | Proof tracking, money she advanced |
| `Baseline`, `Pulse` | Settings, monthly check-in | Before and after comparison, confidence |

---

## 16. Business rules (`src/domain/rules.ts`)

Pure functions, no I/O, each with Vitest tests covering every row of its table. The backend reuses them as the reference implementation.

### 16.1 Status language

Every status has one label, one tone, one icon. Labels live in `src/domain/labels.ts` and nowhere else.

**Line status**

| Value | Label | Tone | Icon |
|---|---|---|---|
| `not_requested` | Not requested | neutral | `circle-dashed` |
| `requested` | Requested · Oct 20 | info | `send` |
| `received` | Received — needs review | warn | `inbox` |
| `under_review` | Under review | warn (solid) | `scan-eye` |
| `accepted` | Accepted (checklist rows show the stamp instead) | good | `badge-check` |
| `incomplete` | Incomplete | serious | `circle-alert` |
| `needs_correction` | Needs correction | serious | `pencil-line` |
| `not_applicable` | Not applicable (label struck through, reason on hover) | neutral | `minus-circle` |

**Task status** (as displayed, from `derivedStatus`)

| Value | Label | Tone | Icon | Blocked |
|---|---|---|---|---|
| `intake` | Not started | neutral | `circle-dot` | yes |
| `waiting_on_client` | Waiting on client | warn | `lock` | yes |
| `review_required` | Needs your review | warn | `lock` | yes |
| `needs_correction` | Needs correction | serious | `lock` | yes |
| `in_preparation` | In preparation | info | `pencil` | no |
| `ready_for_review` | Ready for review | info | `user-check` | no |
| `ready_next_step` | Ready for next step | good | `circle-check` | no |
| `submitted` | Submitted | info | `send` | no |
| `awaiting_follow_up` | Awaiting follow-up | info | `clock` | no |
| `completed` | Completed | neutral | `circle-check-big` | no |
| `archived` | Archived | neutral | `archive` | no |

**Status groups** (filters, board headers, Insights): Blocked = Not started, Waiting on client, Needs your review, Needs correction · In progress = In preparation, Ready for review · Ready = Ready for next step · Submitted = Submitted, Awaiting follow-up · Done = Completed, Archived.

**Visit (as displayed)**: Ready (good, `circle-check`), Not ready — 2 items (critical, `lock`), In progress (info, `map-pin`), Done (neutral, `badge-check`), Cancelled (neutral, `circle-slash`).

**Follow-up (as displayed)**: Not sent (neutral), Due today (warn), Overdue (critical), Waiting (info), Escalated (serious, `flag`), Resolved (neutral).

**Outcome**

| Value | Label | Tone |
|---|---|---|
| `completed` | Completed | good |
| `submitted_pending` | Submitted, waiting for processing | info |
| `paid_proof_pending` | Paid, proof to follow | info |
| `more_documents_requested` | More documents requested | serious |
| `correction_required` | Correction required | serious |
| `not_accepted` | Not accepted | critical |
| `follow_up_required` | Follow-up visit needed | warn |

**Outcome cause** (label, default avoidable): Missing document (yes), Wrong form of copy (yes), Wrong number of copies (yes), Authorization problem (yes), Error in the documents (yes), Unsigned or not notarized (yes), Office system down (no), Officer unavailable (no), New or changed requirement (no), Processing time (no), Cut-off time reached (no), Other (no).

### 16.2 Line transitions (`canTransitionLine(from, to)`)

| From | Allowed to |
|---|---|
| Not requested | Requested, Received, Not applicable (reason) |
| Requested | Received, Not applicable (reason) |
| Received | Under review, Accepted, Incomplete (note), Needs correction (note) |
| Under review | Accepted, Incomplete (note), Needs correction (note) |
| Incomplete, Needs correction | Requested, Received |
| Accepted | Under review (reopen, reason) |
| Not applicable | Not requested (reopen, reason) |

Side effects: Accepted stamps `reviewedBy` and `reviewedAt` and may set `Task.readyAt`; Requested sets `requestedAt` if empty; Received sets `receivedAt`; Incomplete and Needs correction set `flagNote` and evaluate `isLateDiscovered`.

### 16.3 Displayed task status (`derivedStatus(task, lines)`)

Evaluate in order; the first match wins.

1. `task.status` is `completed` or `archived` → that status.
2. `task.statusOverride` exists → the override's status (shown with its marker).
3. Let *required* = lines that are required and not `not_applicable`.
4. Any required line is `incomplete` or `needs_correction` → `needs_correction`.
5. Any required line is `not_requested` or `requested` → `intake` if every required line is `not_requested`, else `waiting_on_client`.
6. Any required line is `received` or `under_review` → `review_required`.
7. Otherwise (no required lines, or all accepted) → `task.status` if it is one of `in_preparation`, `ready_for_review`, `ready_next_step`, `submitted`, `awaiting_follow_up`; else `in_preparation`.

`isBlocked(task, lines)` is true for steps 4–6. `blockingLines(lines)` returns required lines not `accepted` and not `not_applicable`. `blockingReason(lines)` groups them by supplier and returns a sentence: "Waiting on client: 2 items — Signed 2307s, Quarterly payee data".

### 16.4 Operator-set task transitions (`canSetStatus(task, lines, to, role)`)

Only when the task is not blocked (overrides excepted).

| Current (displayed) | Allowed manual targets |
|---|---|
| In preparation | Ready for review, Ready for next step |
| Ready for review | In preparation, Ready for next step |
| Ready for next step | In preparation, Submitted (Mark submitted), Completed (Mark completed) |
| Submitted | Awaiting follow-up, Completed (Mark completed) |
| Awaiting follow-up | Submitted, Completed (Mark completed) |
| Completed | In preparation (reopen, reason) |
| Archived | Previous status (restore, owner, reason) |
| Any blocked status | None; owner may override with a reason |

### 16.5 Dates and validity

| Function | Returns | Rule |
|---|---|---|
| `dueState(task, today, dueSoonDays)` | `'closed' \| 'overdue' \| 'due_today' \| 'due_soon' \| 'ok'` | Closed if completed or archived; overdue if due < today; due today; due soon if due ≤ today + dueSoonDays |
| `authorizationState(auth, onDate, warnDays)` | `'valid' \| 'expiring' \| 'expired'` | Expired if validUntil < onDate; expiring if validUntil ≤ onDate + warnDays |
| `validAuthorization(auths, clientId, kind, onDate)` | `Authorization \| null` | Not deleted, not replaced, scope includes kind, validUntil empty or ≥ onDate |
| `followUpState(fu, today)` | `'not_sent' \| 'due_today' \| 'overdue' \| 'waiting' \| 'escalated' \| 'resolved'` | Escalated and resolved from status; open → not sent (due today); sent → overdue if expectedBy < today, due today if equal, else waiting |
| `isLateDiscovered(task, today, dueSoonWindow = 3)` | `boolean` | True if `task.readyAt` is set, or today ≥ dueDate − 3 days |
| `nonWorkingDayNote(date, holidays)` | `string \| null` | "Falls on a Saturday" or "Falls on Rizal Day (regular holiday)" |

### 16.6 Visit outcome mapping (`applyOutcome`)

Saving an outcome applies this in one operation.

Because the displayed status of a blocked task always comes from its lines (16.3), outcomes that block the task do it by changing lines.

| Outcome | Stored status set to | Lines | Also |
|---|---|---|---|
| Completed, with evidence | Completed (`completedAt`) | — | Done stamp on the task |
| Completed, no evidence yet | Awaiting follow-up | — | Next action "Attach evidence" (Me), due in 2 days |
| Submitted, waiting for processing | Submitted (`submittedAt` if empty) | — | Next action from the form |
| Paid, proof to follow | Awaiting follow-up | — | Next action "Attach payment proof"; a draft Payment if none exists |
| More documents requested | In preparation | One new required line per requested document (supplied by client, `lateDiscovered: true`, status Not requested) → displays **Waiting on client** | A follow-up to the client listing them (not yet sent); next action |
| Correction required | In preparation | The affected lines chosen in the form set to Needs correction with the note → displays **Needs correction** | Next action |
| Not accepted | In preparation | Affected lines, if chosen, set to Needs correction | Reason saved on the item and in the activity log; next action |
| Follow-up visit needed | Awaiting follow-up | — | Next action with due date |

`isFirstVisitForTask` is true when no earlier visit item for the same task has an outcome.

### 16.7 Visit readiness

`visitItemReadiness(item, task, lines, auths, visitDate)` returns `{ ready: boolean; reasons: string[] }`. Not ready when any of these is true, each adding one sentence:

1. A required line is not accepted: "{label} not yet accepted — {client name}" (or "…requested from client Oct 14").
2. The task needs an office and `validAuthorization` returns null for the visit date: "SPA expired Oct 15 — {client}" or "No authorization for registration updates — {client}".
3. An Original or Certified copy line that is required and marked for bringing has not been accepted (covered by 1, but the sentence says "Original …" so she knows it is a physical item).

`visitReadiness(items)` returns `{ ready, readyCount, total, blockingItems }`; ready only when every item is ready and the visit has at least one item.

`packList(visit, items, linesByTask, kit)` returns the physical items (Original, Certified copy, Photocopy, and Digital lines with `printAndBring`) grouped by client, with copies, plus active kit items.

### 16.8 Periods and default due dates

| Function | Rule |
|---|---|
| `periodKey(type, year, index)` | `'2026-09'`, `'2026-Q3'`, `'2026'` |
| `periodLabel(key)` | "Sep 2026", "Q3 2026", "2026" |
| `periodRange(key)` | First and last date of the period |
| `previousPeriod(type, today)` | The period that most recently ended |
| `defaultDue(template, period, moves)` | A matching deadline move wins (`dueSource.kind = 'deadline_move'`). Otherwise `day_of_next_month` N → day N of the month after the period end (clamped to month end); `days_after_period_end` N → period end + N days. Otherwise none (the form asks) |
| `templateApplies(template, client, periodType)` | Frequency matches the period type and the client's entity type and VAT status are allowed; `unknown` VAT status never matches a VAT-specific template |

Default due rules in sample templates illustrate the mechanism only. They are not verified BIR deadlines (section 18.4).

### 16.9 Formatting helpers (`src/lib`)

| Helper | Example |
|---|---|
| `formatPeso(1234550)` | "₱12,345.50" |
| `formatPesoShort(123456789)` | "₱1.2M" |
| `formatDate('2026-10-28', today)` | "Oct 28" (same year), "Oct 28, 2025" (other year) |
| `formatRelative('2026-10-25', today)` | "Tomorrow" |
| `formatTime('2026-10-24T15:12:00+08:00')` | "3:12 PM" |
| `maskTin('123456789', '00000')` | "•••-•••-789-00000" |
| `formatPhone('+639171234567')` | "0917 123 4567" |
| `todayInManila()` | `'2026-10-24'` from the device clock, or the dev menu override |

---

## 17. Repository contract (`src/data/repositories.ts`)

Antigravity builds the mock implementation in M0. Claude Code later writes the API implementation of the same interface. Method names are final; arguments may grow, never shrink. Every write takes an optional `opts?: { idempotencyKey?: ID; expectedVersion?: number }` (omitted below for brevity).

```ts
export interface Repositories {
  session: {
    me(): Promise<{ user: User; membership: Membership; org: Org; settings: OrgSettings; prefs: UserPrefs }>;
    signOut(): Promise<void>;
  };
  prefs: { save(p: Partial<UserPrefs>): Promise<UserPrefs> };
  settings: { save(s: Partial<OrgSettings>): Promise<OrgSettings> };
  memberships: {
    list(): Promise<Membership[]>;
    invite(m: { email: string; role: Role; clientIds: ID[] }): Promise<Membership>;
    update(id: ID, m: Partial<Pick<Membership, 'role' | 'clientIds' | 'active'>>): Promise<Membership>;
    revoke(id: ID): Promise<void>;
  };

  today: { queue(scope: 'mine' | 'everyone'): Promise<TodayQueue> };

  clients: {
    list(f?: { search?: string; status?: 'active' | 'archived'; hasBlocked?: boolean; authAttention?: boolean;
               entityType?: EntityType; vatStatus?: VatStatus; channel?: FilingChannel; efpsGroup?: EfpsGroup;
               assignedUserId?: ID; tags?: string[]; cursor?: string; limit?: number }): Promise<Page<ClientSummary>>;
    get(id: ID): Promise<{ client: Client; summary: ClientSummary }>;
    upsert(c: Partial<Client>): Promise<Client>;
    archive(id: ID, reason: string): Promise<void>;
    restore(id: ID, reason: string): Promise<void>;
    revealTin(id: ID): Promise<string>;                       // logs tin_revealed
    findDuplicates(c: { code?: string; tin?: string; name?: string }): Promise<ClientSummary[]>;
    importPreview(rows: Record<string, string>[], mapping: Record<string, keyof Client>): Promise<ImportPreview>;
    importCommit(preview: ImportPreview): Promise<{ created: ID[]; skipped: number; batchId: ID }>;
    importUndo(batchId: ID): Promise<void>;
  };
  contacts: { listByClient(clientId: ID): Promise<Contact[]>; upsert(c: Partial<Contact>): Promise<Contact>;
              remove(id: ID, reason: string): Promise<void> };
  authorizations: { listByClient(clientId: ID): Promise<Authorization[]>; upsert(a: Partial<Authorization>): Promise<Authorization>;
                    replace(oldId: ID, next: Partial<Authorization>): Promise<Authorization> };

  templates: {
    list(f?: { active?: boolean }): Promise<TaskTemplate[]>;
    get(id: ID): Promise<{ template: TaskTemplate; lines: RequirementTemplate[] }>;
    save(t: Partial<TaskTemplate>, lines: Partial<RequirementTemplate>[]): Promise<TaskTemplate>;
    markVerified(id: ID, v: { sourceRef: string; sourceUrl?: string; verifiedOn: ISODate; note?: string }): Promise<TaskTemplate>;
  };
  deadlineMoves: { list(): Promise<DeadlineMove[]>; save(m: Partial<DeadlineMove>, applyToOpenTasks: boolean): Promise<{ move: DeadlineMove; updatedTaskIds: ID[] }>;
                   remove(id: ID, reason: string): Promise<void> };
  holidays: { list(year: number): Promise<Holiday[]>; save(h: Partial<Holiday>): Promise<Holiday>; remove(id: ID): Promise<void> };

  tasks: {
    list(f?: { clientId?: ID; statuses?: TaskStatus[]; statusGroup?: 'blocked' | 'in_progress' | 'ready' | 'submitted' | 'done';
               templateIds?: ID[]; kinds?: TaskKind[]; ownerUserId?: ID; dueFrom?: ISODate; dueTo?: ISODate; period?: PeriodKey;
               officeAction?: boolean; onVisit?: boolean; unverified?: boolean; ids?: ID[]; search?: string;
               sort?: string; cursor?: string; limit?: number }): Promise<Page<TaskSummary>>;
    get(id: ID): Promise<{ task: Task; summary: TaskSummary; lines: TaskLine[]; documents: DocumentFile[];
                           visits: { visit: VisitSummary; item: VisitItem }[]; payments: Payment[]; followUps: FollowUpView[] }>;
    create(t: Partial<Task>, lines: Partial<TaskLine>[]): Promise<Task>;
    update(id: ID, t: Partial<Pick<Task, 'ownerUserId' | 'channel' | 'tags' | 'notes' | 'officeAction' | 'paymentExpected'>>): Promise<Task>;
    setStatus(id: ID, to: TaskStatus, reason?: string): Promise<Task>;           // enforces canSetStatus
    markSubmitted(id: ID, s: { on: ISODate; via: FilingChannel | 'office'; ref?: string; ackDocumentId?: ID; note?: string }): Promise<Task>;
    markCompleted(id: ID, c: { on: ISODate; noEvidenceReason?: string }): Promise<Task>;
    override(id: ID, status: TaskStatus, reason: string): Promise<Task>;
    clearOverride(id: ID, reason: string): Promise<Task>;
    changeDue(id: ID, dueDate: ISODate, ref: string, reason: string, url?: string): Promise<Task>;
    setNextAction(id: ID, next: NextAction | null): Promise<Task>;
    archive(id: ID, reason: string): Promise<void>;
    restore(id: ID, reason: string): Promise<void>;
    duplicateForNextPeriod(id: ID): Promise<Task>;
    previewOpenPeriod(period: PeriodKey, clientIds: ID[]): Promise<OpenPeriodPreview>;
    openPeriod(plan: OpenPeriodPlan): Promise<{ created: ID[]; skipped: number; lines: number }>; // one operation
    board(f?: Parameters<Repositories['tasks']['list']>[0]): Promise<Record<TaskStatus, TaskSummary[]>>;
  };
  lines: {
    setStatus(id: ID, to: LineStatus, extra?: { note?: string; reason?: string; via?: Channel; on?: ISODate }): Promise<TaskLine>; // enforces canTransitionLine
    addAdHoc(taskId: ID, line: Partial<TaskLine>): Promise<TaskLine>;
    update(id: ID, line: Partial<Pick<TaskLine, 'label' | 'required' | 'copyForm' | 'copies' | 'suppliedBy' | 'printAndBring' | 'neededBy'>>): Promise<TaskLine>;
    reorder(taskId: ID, orderedIds: ID[]): Promise<void>;
    history(id: ID): Promise<ActivityEvent[]>;
  };
  documents: {
    list(f: { clientId?: ID; taskId?: ID; lineId?: ID; kind?: DocumentKind[]; lineStatus?: LineStatus[];
              uploadedBy?: ID; from?: ISODate; to?: ISODate; search?: string; cursor?: string; limit?: number }): Promise<Page<DocumentFile>>;
    upload(meta: { clientId: ID; taskId?: ID; lineId?: ID; visitItemId?: ID; paymentId?: ID; authorizationId?: ID;
                   kind: DocumentKind; source: DocumentFile['source'] },
           file: Blob, thumb?: Blob, info?: { originalName: string; originalSizeBytes: number; sha256: string; pageCount?: number }): Promise<DocumentFile>;
    replace(id: ID, file: Blob, thumb?: Blob, info?: { originalName: string; originalSizeBytes: number; sha256: string }): Promise<DocumentFile>; // new version
    update(id: ID, d: Partial<Pick<DocumentFile, 'kind' | 'lineId' | 'taskId'>>): Promise<DocumentFile>;
    remove(id: ID, reason: string): Promise<void>;
    getUrl(id: ID, purpose: 'view' | 'download' | 'thumb'): Promise<string>;      // logs file_viewed / file_downloaded
    findBySha(sha256: string, clientId: ID): Promise<DocumentFile[]>;
  };
  followUps: {
    list(f?: { state?: FollowUpState[]; clientId?: ID; taskId?: ID; cursor?: string; limit?: number }): Promise<Page<FollowUpView>>;
    get(id: ID): Promise<FollowUpView>;
    create(f: Partial<FollowUp>): Promise<FollowUp>;
    markSent(id: ID, a: { channel: Channel; sentAt: ISODateTime; expectedBy: ISODate; message: string }): Promise<FollowUpView>;
    logResponse(id: ID, r: { text: string; receivedLineIds: ID[]; via?: Channel }): Promise<FollowUpView>;
    escalate(id: ID, reason: string): Promise<FollowUpView>;
    resolve(id: ID, reason?: string): Promise<FollowUpView>;
  };
  messages: { list(): Promise<MessageTemplate[]>; save(m: Partial<MessageTemplate>): Promise<MessageTemplate> };

  offices: { list(f?: { type?: OfficeType; search?: string }): Promise<Office[]>; get(id: ID): Promise<{ office: Office; stats: OfficeStats }>;
             save(o: Partial<Office>): Promise<Office> };
  visits: {
    list(f?: { status?: VisitStatus[]; from?: ISODate; to?: ISODate; assigneeUserId?: ID; cursor?: string; limit?: number }): Promise<Page<VisitSummary>>;
    get(id: ID): Promise<VisitDetail>;
    create(v: Partial<Visit>, items?: { taskId: ID; action: VisitAction }[]): Promise<Visit>;
    update(id: ID, v: Partial<Pick<Visit, 'plannedDate' | 'arriveBy' | 'assigneeUserId' | 'purpose' | 'officeId'>>): Promise<Visit>;
    suggestTasks(visitId: ID): Promise<TaskSummary[]>;                             // ready, office needed, ranked
    addItem(visitId: ID, taskId: ID, action: VisitAction): Promise<VisitItem>;
    updateItem(itemId: ID, i: Partial<Pick<VisitItem, 'intendedAction' | 'questions'>>): Promise<VisitItem>;
    removeItem(itemId: ID): Promise<void>;
    setPacked(visitId: ID, ref: { lineId?: ID; kitItemId?: ID }, packed: boolean): Promise<void>;
    start(id: ID, leaveAnywayReason?: string): Promise<Visit>;
    recordOutcome(itemId: ID, o: { outcome: Outcome; cause?: OutcomeCause; avoidable?: boolean; note?: string;
                                  windowOrOfficer?: string; nextAction?: NextAction; evidenceDocumentIds: ID[];
                                  requestedDocuments?: string[]; affectedLineIds?: ID[] }): Promise<VisitItem>; // applies 16.6
    finish(id: ID, f: { finishedAt: ISODateTime; costs?: Visit['costs'] }): Promise<Visit>;
    cancel(id: ID, reason: string): Promise<void>;
  };
  visitKit: { list(): Promise<VisitKitItem[]>; save(i: Partial<VisitKitItem>): Promise<VisitKitItem> };

  payments: {
    list(f?: { clientId?: ID; taskId?: ID; channel?: PaymentChannel; paidBy?: 'client' | 'operator';
               reimbursement?: 'waiting' | 'reimbursed'; proofMissing?: boolean; from?: ISODate; to?: ISODate;
               cursor?: string; limit?: number }): Promise<Page<Payment> & { totalAmount: Centavos }>;
    save(p: Partial<Payment>): Promise<Payment>;
    remove(id: ID, reason: string): Promise<void>;
  };

  notes: { list(entity: Note['entity'], entityId: ID): Promise<Note[]>; save(n: Partial<Note>): Promise<Note> };
  savedViews: { list(page: SavedView['page']): Promise<SavedView[]>; save(v: Partial<SavedView>): Promise<SavedView>; remove(id: ID): Promise<void> };
  notifications: { list(f?: { unread?: boolean; cursor?: string }): Promise<Page<Notification>>; markRead(ids: ID[] | 'all'): Promise<void>;
                   unreadCount(): Promise<number> };
  push: { subscribe(sub: PushSubscriptionJSON): Promise<void>; unsubscribe(endpoint: string): Promise<void>; test(): Promise<void> };

  calendar: { range(from: ISODate, to: ISODate, f?: { clientId?: ID; ownerUserId?: ID; types?: CalendarItem['type'][] }): Promise<CalendarItem[]> };
  insights: { get<T extends InsightsTab>(tab: T, f: InsightsFilter): Promise<InsightsData[T]> };
  baseline: { get(): Promise<Baseline | null>; save(b: Partial<Baseline>): Promise<Baseline> };
  pulses: { list(): Promise<Pulse[]>; save(p: Partial<Pulse>): Promise<Pulse> };

  reports: {
    clientChecklist(clientId: ID, taskIds?: ID[]): Promise<ClientChecklistReport>;
    clientHistory(clientId: ID, year: number): Promise<ClientHistoryReport>;
    monthlySummary(month: string): Promise<MonthlySummaryReport>;
    exportCsv(kind: 'clients' | 'tasks' | 'lines' | 'follow_ups' | 'visits' | 'payments' | 'activity', f?: Record<string, unknown>): Promise<Blob>;
    fullBackup(): Promise<Blob>;                                                    // owner only
  };
  activity: {
    list(f: { entity?: ActivityEntity; entityId?: ID; clientId?: ID; actorId?: ID; actions?: ActivityAction[];
              from?: ISODate; to?: ISODate; cursor?: string; limit?: number }): Promise<Page<ActivityEvent>>;
  };
  search: { query(q: string, f?: { types?: Array<keyof SearchResults> }): Promise<SearchResults> };
}
```

Mock-only additions (not part of the contract): `dev.reset()`, `dev.setPersona('owner' | 'helper')`, `dev.setOffline(boolean)`, `dev.setFailureRate(0 | 0.1 | 0.5 | 1)`, `dev.setToday(ISODate | null)`.

---

## 18. Sample data

All names, codes, TINs, offices and numbers are fictional. Every sample template is unverified. All dates are computed relative to the seed day ("D", which is today, or the dev-menu date), so overdue and due-soon states never go stale. The seed is deterministic: use a seeded random generator (mulberry32 with seed `20261024`) so every reset produces the same data.

### 18.1 Organizations and people

| Org | Purpose |
|---|---|
| Demo — Reyes Tax Services | All sample data; `isDemo: true` |
| (Live) | Created empty at go-live; sample data never enters it |

| User | Role | Assigned clients | Email (mock) |
|---|---|---|---|
| Ana Reyes | Owner | All | ana@example.com |
| Ben Cruz | Helper | VTL, DCL | ben@example.com |

### 18.2 Clients

| Code | Name | Type | VAT | Channel | Notable for the demo |
|---|---|---|---|---|---|
| RSP | Rivera Salonga & Partners | GPP | VAT | eFPS, group C | Most active; ORUS held by the operator; uses invoicing software |
| DCL | Dela Cruz Law Office | Solo | Non-VAT, 8% | eBIRForms | Micro; one task ready for desk filing |
| VTL | Villanueva Tan Law | GPP | Non-VAT, percentage tax | eBIRForms | SPA expired 9 days ago; blocks a visit |
| MLA | Atty. Marisol Lim | Solo | VAT | eFPS, group E | Has a status override with a reason |
| BOL | Bautista Ocampo Legal | GPP | VAT | eFPS, group A | eCAR job; the visit-planner showcase |
| SCL | Santos Cruz Legal | GPP | VAT | eFPS, group D | Slow to send documents; drives the Chasing tab |
| AMD | Atty. Andrea Mendoza | Solo | Not sure yet | eBIRForms | New client from import; TIN missing; VAT status unknown warning |
| JRA | Atty. Jose Ramos | Solo | Non-VAT | eBIRForms | Archived; history only |

Each active client has 1–3 contacts (one signatory, preferred channels mixed: Viber, Messenger, Email, SMS; two with Filipino as preferred language), at least one authorization (VTL's expired 9 days ago; MLA's expiring in 12 days), and a masked sample TIN (except AMD).

### 18.3 Offices (all marked sample)

| Office | Type | Notes |
|---|---|---|
| RDO 0XX — Sample District A | RDO | Tips: "Window 5 for ONETT. Arrive before 9 for a queue number." |
| RDO 0YY — Sample District B | RDO | |
| Sample Bank — Makati branch | Bank (AAB) | |
| City Treasurer's Office (sample) | LGU | |
| SEC Satellite Office (sample) | SEC | |

### 18.4 Task templates (all unverified samples)

| Code | Name | Frequency | Office | Payment | Sample due rule | Requirement lines (supplier · form) |
|---|---|---|---|---|---|---|
| 0619-E | Monthly expanded withholding remittance | Monthly | No | Yes | Day 10 of next month | Payee list with amounts (client · digital); payment records (client · photocopy) |
| 1601-C | Monthly compensation withholding | Monthly | No | Yes | Day 10 of next month | Payroll register (client · digital); hires and separations (client · digital) |
| 1601-EQ | Quarterly expanded withholding with payee list | Quarterly | No | Yes | 30 days after period end | Quarterly payee data (client · digital); monthly confirmations (operator · digital) |
| 2551Q | Quarterly percentage tax | Quarterly | No | Yes | 25 days after period end | Sales summary (client · digital) |
| 2550Q | Quarterly VAT with sales and purchase lists | Quarterly | No | Yes | 25 days after period end | Sales list, purchase list (client · digital); input VAT invoices (client · photocopy ×1) |
| 2307-COL | Collect certificates of tax withheld | Quarterly | No | No | 20 days after period end | 2307s from the firm's payors (client · original) |
| 1702-EX | Annual information return (GPP) | Annual | No | No | None (set manually) | Audited statements (third party · digital); partners' share schedule (client · digital) |
| ECAR-SALE | eCAR — sale of real property | One-off | Yes (RDO) | Yes | None | Deed of sale (client · certified copy ×2); title (client · certified copy); tax declaration (client · certified copy); IDs of parties (client · photocopy ×2); authority to transact (operator · original); tax payment proof (operator · original) |
| PTR-BATCH | PTR renewal for the firm's lawyers | Annual | Yes (LGU) | Yes | None | List of practicing lawyers (client · digital); prior PTR numbers (client · digital) |

The due rules above exist only to exercise `defaultDue`. Before go-live, each template's lines and due rule must be checked against current BIR issuances and marked verified by the operator.

**Sample deadline move** (illustrates the feature only; check whether the issuance covers this form before using it for real): template 1702-EX, period 2025, new due date May 15, 2026, source "RMC 30-2026". **Sample holidays** for the seed year: include only fixed-date holidays and mark each "Sample — replace with the official proclamation".

### 18.5 Current work (relative to D)

About 26 open tasks covering:

- At least one task in each of the 11 task statuses, and at least one line in each of the 8 line statuses (including one Not applicable with a reason).
- Two overdue tasks (D−2 and D−5), three due within 7 days, the rest later.
- One status override (MLA 1601-C: "Payroll unchanged — confirmed by phone").
- One task from each template.
- Three lines in Received waiting for review (so Today's review section has rows), one of them uploaded by Ben.
- One line flagged "Added late".
- AMD has one task from an unverified template with VAT status unknown.

**Visits**

| Visit | Office | Date | State | Why it exists |
|---|---|---|---|---|
| V1 | RDO 0XX | Second working day after D, 9:00 AM | Not ready | BOL eCAR has the title received but not accepted; VTL registration update blocked by the expired SPA; RSP item ready |
| V2 | Sample Bank | Next working day after D | Ready | Payment-only item; shows the ready stamp |
| V3 | RDO 0XX | About a week before D (a weekday) | Done | One item completed with a stamped-copy photo; one "More documents requested" (cause: missing document, avoidable) that created an RSP follow-up |

Seeded visit dates never fall on a weekend or a seeded holiday.

**Follow-ups**: seven (two due today, one overdue and escalated, two waiting, one not yet sent, one resolved), with 1–3 attempts each and message snapshots in English and Filipino.

**Payments**: eight in the last 60 days, including one with proof missing and one advanced by the operator waiting for reimbursement.

**Documents**: about 30 placeholder files (generated blank PDFs and PNG images with the file's display name drawn on them), named by convention, including two versions of one file.

**Notifications**: twelve across types, five unread. **Notes**: six. **Activity**: about 120 events so every timeline has content.

### 18.6 History for Insights (six months before D)

Generate finished tasks, visits, outcomes, follow-ups and payments for the six full months before D, shaped so the demo tells an honest improvement story that the operator can recognise or correct. Targets per month (M−6 is the oldest):

| Month | Visits | Items per visit | First-pass rate | Trips needing a return | Avoidable | Follow-ups per task (median) | On-time rate | Visits left ready |
|---|---|---|---|---|---|---|---|---|
| M−6 | 9 | 1.4 | 58% | 6 | 5 | 3 | 78% | 40% |
| M−5 | 8 | 1.6 | 63% | 5 | 4 | 3 | 82% | 55% |
| M−4 | 7 | 1.9 | 70% | 4 | 3 | 2.5 | 86% | 70% |
| M−3 | 6 | 2.2 | 76% | 3 | 2 | 2 | 90% | 80% |
| M−2 | 6 | 2.4 | 81% | 2 | 2 | 2 | 92% | 85% |
| M−1 | 5 | 2.6 | 86% | 2 | 1 | 1.5 | 94% | 92% |

Also: visit costs ₱150–₱450 each; durations 1.5–4 hours; client SCL consistently slowest to send documents (median 6 days vs 2–3 for others); Ben handling about a third of visits.

**Baseline** (Settings → Before Ordinovix, sample): 9 office trips a month, 4 repeat trips a month, 25 follow-up messages a week, 5 hours a week finding records or checking status, 1 late filing a quarter, confidence 2 of 5. **Pulses**: one per history month, confidence rising from 2 to 4, hours falling from 5 to 2.

### 18.7 Message templates (sample)

| Name | Language | Purpose | Body |
|---|---|---|---|
| First request | English | First request | Hi {{contact}}, good day. For {{client}}'s {{task}} ({{period}}), I still need:\n{{items}}\nCould you send these by {{due}}? Thank you. — {{operator}} |
| Reminder | English | Reminder | Hi {{contact}}, following up on these for {{task}} ({{period}}):\n{{items}}\nThe filing deadline is {{deadline}}, so I need them by {{due}}. Thank you. — {{operator}} |
| Correction request | English | Correction | Hi {{contact}}, I checked the documents for {{task}} ({{period}}). These need to be corrected or replaced:\n{{items}}\nCould you send the corrected copies by {{due}}? Thank you. — {{operator}} |
| Unang hiling | Filipino | First request | Magandang araw po, {{contact}}. Para sa {{task}} ({{period}}) ng {{client}}, kailangan ko pa po ang:\n{{items}}\nMaaari po bang maipadala bago ang {{due}}? Salamat po. — {{operator}} |
| Paalala | Filipino | Reminder | Magandang araw po, {{contact}}. Follow-up lang po sa mga ito para sa {{task}} ({{period}}):\n{{items}}\nAng deadline po ng filing ay {{deadline}}, kaya kailangan ko po ito bago ang {{due}}. Salamat po. — {{operator}} |

Have the operator rewrite these in her own words during the preview.

---

## 19. Cross-cutting requirements

### 19.1 Accessibility (WCAG 2.2 AA)

| Requirement | How |
|---|---|
| Contrast | Token pairs in section 8.2 are pre-checked; never put text on series colours |
| Focus visible and not hidden | `--focus` ring; sticky headers and the bottom bar must not cover the focused element (scroll padding 72 px) |
| Status not by colour alone | Every chip, badge and chart series has an icon and a word |
| Target size | 44 × 44 px on touch, 24 × 24 px minimum on desktop |
| Dragging alternatives | Board, calendar and reorder all have a "Move to…" menu or Move up and Move down buttons |
| Forms | Labels on every field, errors linked with `aria-describedby`, focus moves to the first error on submit |
| Live updates | Toasts and sync status announced with `aria-live="polite"`; errors with `assertive` |
| Headings and landmarks | One `h1` per page, ordered headings, `nav`, `main`, `aside` landmarks; skip link "Skip to content" |
| Motion | Reduced-motion rules in section 8.8 |
| Zoom | Usable at 200% browser zoom and at the 125% text-size setting with no horizontal page scroll |
| Screen readers | Charts have table views; the stamp has `aria-label` "Accepted by Ana Reyes on October 24, 2026" |
| Redundant entry | Forms pre-fill anything already known (client defaults, last values) |
| Accessible sign-in | Google sign-in; no puzzles or memorised codes |

Check with axe in the browser on every page in both themes during M11.

### 19.2 Locale and formatting

- Language `en-PH`; time zone `Asia/Manila` for every date calculation, regardless of the device's zone.
- Calendar dates are `YYYY-MM-DD` strings. Use `@date-fns/tz` (`TZDate`) for "today" and for timestamps; never `new Date('2026-10-28')` (that is UTC midnight and shows as the previous day in some zones).
- Sorting names uses `Intl.Collator('en-PH', { sensitivity: 'base' })` so "Ñ" sorts with "N" and case is ignored.
- Names keep suffixes and titles as typed (Jr., III, Atty.).
- Peso amounts: `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })` gives "₱12,345.50".
- CSV exports are UTF-8 with a byte-order mark so Excel shows ñ and ₱ correctly.

### 19.3 Installable app and offline

| Item | Spec |
|---|---|
| Manifest | Name "Ordinovix", short name "Ordinovix", `display: standalone`, `start_url: /`, theme colour `#EEF1F4`, background `#EEF1F4`, icons from section 8.11 |
| Service worker | vite-plugin-pwa (`generateSW`); precache the app shell, fonts and icons; network-first for `/api/*` with no API caching in the service worker (TanStack Query persists data instead) |
| Update flow | When a new version is waiting, show the "A new version of Ordinovix is ready. Reload" banner; never reload by itself while a form is dirty |
| Offline data | TanStack Query cache persisted to IndexedDB for the last opened Today, tasks, visits and clients (24 hours) |
| Offline writes | Mutations queue in IndexedDB with their idempotency keys; replay in order on reconnect; failed items stay in the queue with Retry and Discard |
| What works offline | Viewing cached pages, line status changes, notes, recording visit outcomes with photos, packing; creating clients and opening periods require a connection (buttons disabled with a hint) |
| Install prompts | Android/desktop: use `beforeinstallprompt` behind an "Install app" button; iPhone: instructions card (Share → Add to Home Screen) |
| Push | Ask for permission only after a tap on "Turn on reminders", never on page load |

### 19.4 Performance budgets

| Metric | Budget |
|---|---|
| JavaScript for the first page (gzip) | ≤ 220 KB; Insights, Reports, charts and the PDF thumbnailer are separate lazy chunks |
| Fonts | Two Archivo files (latin, latin-ext), the latin file preloaded, `font-display: swap` |
| Largest contentful paint | ≤ 2.5 s on a mid-range Android phone over 4G |
| Interaction to next paint | ≤ 200 ms |
| Today data | One request (page-level endpoint) |
| Lists | Virtualize any list over 100 rows |
| Images | Thumbnails only in lists; full images load in the preview drawer |

### 19.5 Privacy and security in the frontend

- `<meta name="robots" content="noindex, nofollow">` on every page (the backend also sends `X-Robots-Tag`).
- No third-party scripts, analytics, fonts or CDNs at runtime. Everything is self-hosted.
- TINs masked everywhere except the deliberate reveal; never in push text, exports (masked column only), print, or page titles.
- Privacy mode (top bar and Shift P): blurs client names, amounts, TINs and thumbnails until hovered or focused. Useful when showing the app to others or working at a counter.
- Idle lock (Settings → Security, default 15 minutes): the privacy curtain covers the app; "Continue" removes it if the session is still valid, otherwise it goes to sign-in. Unsynced changes are kept.
- No credential fields anywhere; the password-pattern warning on notes (section 11.7.3).
- Files open through `documents.getUrl`, never through guessable paths.
- `localStorage` holds only preferences and mock data; real records live in IndexedDB caches that are cleared on sign-out.
- Sign out clears caches, the offline queue (after warning if it is not empty), and push subscriptions for that device.
- Privacy notice (Settings → About) states what is collected, why, who can see it, and how long it is kept. The operator confirms the wording; under the Data Privacy Act, tax returns and TINs are sensitive personal information.

### 19.6 Print

`print.css` applies to the trip pack, client checklist, client history and monthly summary: black text on white, no navigation, no shadows, 11 pt body, 9 pt meta, the wordmark at the top left, page numbers and print time in the footer, `break-inside: avoid` on client blocks, checkboxes drawn as 4 mm bordered squares (not Unicode characters). Paper size from Settings: A4, Letter, or Long (8.5 × 13 in) via `@page { size: … }`. Masked TINs only.

### 19.7 Browsers and devices

Last two versions of Chrome, Edge, Safari (macOS and iOS 16.4 or later for push), Samsung Internet and Firefox. Test devices: a mid-range Android phone (360–412 px wide), an iPhone (390 px), a laptop (1366 × 768), and a desktop (1920 × 1080).

### 19.8 Error logging

No third-party error service in v2. In the frontend, errors caught by boundaries and failed requests are kept in a local ring buffer (last 50) shown in the dev menu and Settings → About ("Copy diagnostic report"). In the backend phase, the API gets a `/api/v1/log` endpoint that records errors without personal data.

---

## 20. Milestones and QA

Each milestone is small enough to QA in one sitting. Nothing moves on while a blocking defect is open.

| Milestone | Scope | Give Antigravity | Done when |
|---|---|---|---|
| M0 Foundation | Scaffold, tokens (light and dark), fonts, theme switch, app shell (sidebar, rail, bottom bar, top bar), routes, mock repository with v2 types, seed generator, rules and metrics with tests, dev menu, `/dev/tokens` | Sections 0, 4, 6, 7, 8, 15–18 | Every route renders a placeholder; rule and metric tests pass; reset, persona switch and "set today" work; both themes render with no flash |
| M1 Components | Every component in section 9 in `/dev/states` with all variants and states, both themes | Section 9 | Every input works by keyboard, touch and typing; date and time pickers parse the listed inputs; MoneyInput stores centavos; the stamp animates and respects reduced motion |
| M2 Today, search, notifications | Today, command palette, search page, notification popover and page | 11.3, 11.15, 11.16, 14 | Today's QA list passes |
| M3 Clients | List, profile with all tabs, client form, contacts, authorizations, import | 11.7, 12.2, 12.3, 12.12 | Clients QA list passes |
| M4 Tasks | Tasks list and board, task page, line sheet, new task, open period | 11.4–11.6, 12.4–12.7 | Task and Open period QA lists pass |
| M5 Documents | Upload pipeline, camera, compression, preview drawer, Documents library | 9.8, 9.9, 11.11 | A 4 MB phone photo uploads as ≤ 600 KB with a thumbnail; duplicates are detected; preview supports Accept and Flag |
| M6 Follow-ups | Follow-ups tabs, composer, walk-through | 11.8, 12.13 | Follow-ups QA list passes |
| M7 Visits and offices | Visits list, plan, prepare, print, record, summary, offices directory | 11.9, 11.13, 12.9, 12.14 | Visits QA list passes → **operator preview** |
| M8 Calendar and payments | Calendar views, payments page and form | 11.10, 11.12, 12.8 | Rescheduling by drag and by menu both work; payment totals match the filtered rows |
| M9 Insights and reports | Insights tabs, charts, KPI tiles, reports, CSV exports | 13, 11.14 | Every KPI matches a hand count on the seed data; every chart has a table view and CSV; no dual axes |
| M10 Settings and the rest | All settings pages, onboarding, audit log, help, error pages | 11.1, 11.2, 11.17–11.20, 12.10, 12.11, 12.15, 12.16 | Settings QA list passes; the helper sees only allowed pages |
| M11 Polish | Installable app, offline queue, accessibility pass, print check, performance, privacy mode, idle lock | 19 | Section 19 budgets met; axe clean in both themes; no horizontal scroll at 360 px; installs on a phone |

### 20.1 Your QA routine for every milestone

1. Run the milestone's QA checks.
2. Check at 360, 390, 768, 1280 and 1440 px widths.
3. Check light and dark mode.
4. Set the failure rate to 50%, then simulate offline; every section must fail politely and recover.
5. Switch to Ben (Helper) and confirm scoping everywhere, including counts and search.
6. Turn on reduced motion and the 125% text size once.
7. Reset sample data and repeat the main path once.
8. Log defects as one list (page, steps, expected, actual, blocking or not) and give them to Antigravity in one batch.

### 20.2 The operator preview (after M7)

Sixty minutes, on her phone and a laptop. Let her drive:

1. Open Today and say what she would do first.
2. Open a period for October.
3. Review a received line and accept it (watch her reaction to the stamp).
4. Request missing items from a client and copy the message into her own Viber.
5. Open V1 and explain why it is not ready; fix it.
6. Record V3's outcomes on her phone.
7. Look at Insights and say whether the numbers would convince her.

Then ask the questions in section 23. Record every label she renames, every field she asks for, and every step she skips. Those become spec v2.1 before the backend starts.

---

## 21. Backend and hosting handoff (Claude Code phase)

This section is for later. Antigravity does not build any of it.

### 21.1 Architecture

- One repository, one Vite project with the Cloudflare Vite plugin (`@cloudflare/vite-plugin`), so `vite dev` runs the React app and the Worker API together, and `wrangler deploy` ships both.
- API: Hono on Workers under `/api/v1/*`, one route group per repository namespace, request and response bodies validated with the shared zod schemas.
- Data: D1 with Drizzle ORM (`drizzle-kit generate`, then `wrangler d1 migrations apply`).
- Files: R2 through a Worker binding; the bucket is never public.
- Auth: Better Auth with the Drizzle adapter and the Google provider.
- The frontend switches by setting `VITE_DATA_SOURCE=api`; no screen changes.

### 21.2 Worker configuration (shape)

```jsonc
// wrangler.jsonc (shape only; fill names and IDs)
{
  "name": "ordinovix",
  "main": "worker/index.ts",
  "compatibility_date": "2026-10-01",
  "assets": {
    "directory": "./dist/client",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [{ "binding": "DB", "database_name": "ordinovix", "database_id": "<id>" }],
  "r2_buckets": [{ "binding": "FILES", "bucket_name": "ordinovix-files" }],
  "triggers": { "crons": ["0 23 * * *", "0 9 * * *"] },
  "vars": { "APP_ORIGIN": "https://ordinovix.<account>.workers.dev" }
  // secrets (wrangler secret put): BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
  //   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, FILE_URL_SIGNING_KEY
}
```

Cron expressions are in UTC: `0 23 * * *` is 7:00 AM Manila (digest, overdue, expiry checks); `0 9 * * *` is 5:00 PM Manila (visit-tomorrow check). Requests to static assets are free; only `/api/*` invokes the Worker.

### 21.3 API rules

- Routes mirror the repository: `GET /api/v1/tasks`, `GET /api/v1/tasks/:id`, `POST /api/v1/tasks/:id/submit`, `POST /api/v1/visits/:id/items/:itemId/outcome`, and so on.
- Page-level reads (Today, task page, visit page, Insights tab) are single endpoints that run batched D1 queries (`db.batch`), staying under 50 queries per request on the free plan.
- Writes carry `Idempotency-Key` (stored 7 days) and `If-Match: <version>`; stale versions return `409` with the current record.
- Errors: `{ "error": { "code": "LINE_TRANSITION_NOT_ALLOWED", "message": "…", "fields": { … } } }` with matching HTTP status.
- Lists use cursor pagination; maximum `limit` 100.
- Inserts are chunked to respect D1's 100 bound parameters per statement.
- `openPeriod`, `recordOutcome`, `markCompleted`, `importCommit` run as one batch so partial writes cannot happen.
- Rate limit per user (for example 600 requests per 10 minutes) to protect the free daily allowance.

### 21.4 Sign-in and access

1. Google Cloud Console: create an OAuth client (web), consent screen with only the basic scopes (`openid`, `email`, `profile`); add the exact `workers.dev` origin and the redirect `https://ordinovix.<account>.workers.dev/api/auth/callback/google`; set the publishing status to In production (basic scopes do not need Google's verification review; confirm at setup time).
2. Better Auth: Google provider only; session cookie `HttpOnly`, `Secure`, `SameSite=Lax`, same origin; sessions rolling 30 days; "sign out everywhere" deletes all sessions for the user.
3. Allowlist: on sign-in, look up an active `Membership` by email for the organization. None → session allowed but every API call returns `403 ACCESS_PENDING` and the app shows `/access-pending`. Found → link `userId`, set `acceptedAt`.
4. The first owner is seeded by a one-time setup command with her Google email.

### 21.5 Permissions

- Middleware loads the membership on every request and injects `orgId`, `role` and `clientIds`.
- Every query filters by `orgId`; for helpers, every query touching client data also filters by `clientId IN membership.clientIds` (join table `membership_clients`). Counts, search, calendar, Insights and notifications use the same filter.
- Owner-only routes (users, templates edit, settings, audit, full backup, overrides, due changes) check the role.
- Files: `GET /api/v1/files/:id?purpose=view|download|thumb` checks access, logs the event, and streams from R2 with `Cache-Control: private, max-age=0`. For `<img>` tags, the API returns a URL signed with HMAC that expires in 5 minutes.

### 21.6 Database notes

- One table per interface in section 15.2, `snake_case` columns, `org_id` first in every composite index.
- Arrays become join tables where they are queried (`membership_clients`, `client_assigned_users`, `line_documents`, `visit_item_evidence`, `payment_proofs`); small display-only arrays (tags) may be JSON text.
- Indexes: tasks (`org_id, client_id, status`), (`org_id, due_date`), (`org_id, owner_user_id`); lines (`org_id, task_id`), (`org_id, status`); follow-ups (`org_id, status, expected_by`); visits (`org_id, planned_date`); activity (`org_id, entity, entity_id, at`), (`org_id, at`); documents (`org_id, client_id`), (`org_id, sha256`).
- Search: SQLite FTS5 virtual table over client names and codes, contacts, task labels and periods, document names, payment references (confirm FTS5 support on D1 at build time; fall back to `LIKE` on indexed columns).
- Activity log is insert-only; triggers or the repository layer write it in the same batch as the change.
- Full TINs stored encrypted with an application key (AES-GCM via Web Crypto); `tin_masked` stored separately for display.

### 21.7 Files in R2

- Key: `org/{orgId}/client/{clientId}/{yyyy}/{taskId|misc}/{documentId}-v{n}.{ext}`; thumbnails under `…/thumbs/`. Keys are never reused or overwritten.
- Upload through the Worker (`POST /api/v1/documents`, multipart), checking type by magic bytes, size (≤ 15 MB), and access.
- Soft-deleted files stay in R2 until the retention job removes them after the retention period.

### 21.8 Notifications and push

- Notifications are rows created by the cron jobs and by write handlers (section 14).
- Web Push with VAPID keys stored as secrets, sent from the Worker with a Web Crypto based library (the Node `web-push` package depends on Node crypto; check compatibility with `nodejs_compat` or use a Workers-native library).
- Remove subscriptions that return `404` or `410`. Respect quiet hours and lock-screen privacy.

### 21.9 Backups and restore

| Layer | How | Kept |
|---|---|---|
| D1 point-in-time restore | Built in (Time Travel) | 7 days on Free, 30 on Paid |
| Weekly database export | GitHub Actions (Sundays): `wrangler d1 export` → upload the SQL file to R2 `backups/db/YYYY-MM-DD.sql` | 12 weeks |
| Files | Immutable keys and soft delete; optional monthly copy of R2 to a second location (for example the owner's Google Drive via rclone) | Per retention setting |
| Restore drill | Before go-live and every quarter: restore the latest export into a fresh D1 database and open the app against it | Record the result in the audit log |

### 21.10 Environments and deployment

- Two Workers: `ordinovix-preview` (Demo organization, sample data) and `ordinovix` (live, empty at start). Separate D1 databases and R2 buckets.
- GitHub Actions: on pull request run type-check, Vitest and a build; on merge to `main` deploy preview; production deploys by manual approval.
- Security headers on every response: `Content-Security-Policy` (default `'self'`; `img-src 'self' blob: data:`; `frame-src 'self' blob:` for PDF preview; `connect-src 'self'`), `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(self), geolocation=()`, `frame-ancestors 'none'`.

### 21.11 Go-live checklist

1. Restore drill passed.
2. Access test: Ben sees only his clients in every page, count, search result, file URL and export.
3. Google OAuth client in production with the live redirect address; allowlist contains only the intended people.
4. Live organization empty of sample data; the Demo organization lives only on the preview Worker.
5. Weekly export ran at least once and the file opens.
6. Push tested on her phone (installed app).
7. Privacy notice reviewed with her; templates she relies on are marked verified with sources.
8. Free-plan usage dashboard checked after the first week (requests per day, D1 size, R2 size).

### 21.12 Scaling paths

| Situation | Path |
|---|---|
| Usage grows | Workers Paid (US$5/month): higher request limits, 1,000 queries per request, 10 GB per database, 30-day restore |
| Several preparers | More organizations in the same database (already supported by `orgId`), or one D1 database per organization for isolation |
| Heavy reporting or many organizations | Port the Drizzle schema to Postgres (Neon or Supabase Pro) and connect through Cloudflare Hyperdrive; the repository contract does not change |
| She wants a domain and email | Add the domain to the Worker, update the OAuth redirect, add an email provider for reminders and invites |
| Clients want to upload directly | A no-login upload link per follow-up (signed, expiring, one-way into R2), as a later feature |

---

## 22. Things that are easy to miss (already folded into this spec)

| # | Item | Where |
|---|---|---|
| 1 | "CTC" means the cedula to most Filipinos; the UI says "Certified copy" | 8.12, 15.2 |
| 2 | The ₱ sign is in the latin-ext font subset; stripping it shows a fallback glyph | 8.4 |
| 3 | iOS zooms into inputs smaller than 16 px | 8.4 |
| 4 | Calendar dates parsed as UTC midnight show the wrong day | 0.2, 19.2 |
| 5 | Long bond paper (8.5 × 13 in) is the common office size; trip packs must print on it | 11.9.4, 19.6 |
| 6 | Deadlines on weekends and holidays: warn, never auto-move without a source | 9.6, 16.5 |
| 7 | Phone numbers arrive as 09…, +63…, 63…; store one format | 9.4 |
| 8 | Duplicate clients from import or typing (same TIN or code) | 9.4, 11.7.4, 17 |
| 9 | Duplicate uploads (same file sent twice by a client) | 9.8 |
| 10 | Lock screens show push text: codes only, no names or amounts | 14 |
| 11 | Weak signal at BIR offices: record outcomes offline | 11.9.5, 19.3 |
| 12 | She may advance payments for clients and need to be reimbursed | 11.12, 12.8 |
| 13 | Authorization and accreditation expiry reminders | 14 |
| 14 | Passwords pasted into notes | 11.7.3 |
| 15 | Showing the app to someone else: privacy mode | 8.9, 19.5 |
| 16 | Two people editing the same task | 4, 9.13 |
| 17 | Proving value needs a baseline captured before go-live | 12.15, 13.3 |
| 18 | Sample data must never mix with real data | 4, 18.1, 21.10 |
| 19 | Excel mangles ñ and ₱ in CSV without a byte-order mark | 11.14, 19.2 |
| 20 | Larger text option for long days of reading | 8.4 |
| 21 | Every filter in the URL, so the back button and refresh behave | 9.11 |
| 22 | Documents are never colour-inverted in dark mode | 8.2 |
| 23 | Archivo's l and I look alike; copy buttons on reference numbers | 8.4 |
| 24 | E-invoicing: clients using invoicing software may face the e-invoicing deadline of December 31, 2026 (RR 11-2025 and RR 26-2025, per the blueprint research); add a template once verified | 18.4 (add when verified) |
| 25 | A future client upload link would remove most chasing; planned, not built | 21.12 |

---

## 23. Questions for the operator preview

Ask only after she has driven the app (section 20.2).

1. Which messaging app do most clients answer fastest on, and do you send from your phone or a computer?
2. Do any clients use a fiscal year that does not end in December?
3. Do you ever pay taxes or fees for a client from your own money? How do you track getting it back today?
4. Which offices do you visit most, and what do you always bring?
5. What paper size do you print on?
6. Will a helper use this? Which clients would they handle, and should they be able to accept documents?
7. Which three task types take most of your month? Let's verify those templates first.
8. Would you send clients a printed or PDF checklist of what you need from them?
9. Roughly how many trips a month, how many repeat trips, and how many reminder messages a week did you have before? (baseline)
10. Anything on screen you'd rename?

---

## 24. Sources

Figures as of October 24, 2026. Confirm each vendor's limits and prices on its own page before go-live.

**Platform**

- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1 Time Travel (point-in-time restore): https://developers.cloudflare.com/d1/reference/time-travel/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare R2 limits: https://developers.cloudflare.com/r2/platform/limits/
- Workers static assets (SPA mode, `run_worker_first`): https://developers.cloudflare.com/workers/static-assets/
- Static asset billing ("Requests to static assets are free and unlimited"): https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Cloudflare free-tier summary including R2 (Easton, May 2026): https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/
- Supabase free project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase custom SMTP requirement: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase pricing: https://supabase.com/pricing
- Neon plans: https://neon.com/docs/introduction/plans
- Resend domains (why email needs a domain): https://resend.com/docs/dashboard/domains/introduction

**Inspiration**

- BetterGov.PH on GitHub: https://github.com/bettergovph
- Kapwa design system: https://github.com/bettergovph/kapwa
- Philippines to adopt BetterGov.ph as official government portal (NewsBytes.PH, October 18, 2026): https://newsbytes.ph/2026/10/18/philippines-to-adopt-bettergov-ph-as-official-govt-portal/
- ERPNext: https://github.com/frappe/erpnext
- Ambibuzz on GitHub: https://github.com/Ambibuzz

**Domain references used in the blueprint** (verify before encoding as rules)

- RMC 30-2026 (annual ITR deadline moved to May 15, 2026): https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2030-2026.pdf
- RMC 75-2026 (ONETT and eCAR processing): https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2075-2026_Redacted.pdf
- Data Privacy Act of 2012: https://privacy.gov.ph/data-privacy-act/

**Design validation**

- Colour contrast checked to WCAG 2.2 ratios; chart palette validated for lightness band, chroma, colour-vision-deficiency separation (Machado 2009 simulation), normal-vision separation and contrast, in both modes.
- Font coverage (₱, ñ, tabular figures, width axis) checked against the `@fontsource-variable/archivo` package files.

*End of spec.*

