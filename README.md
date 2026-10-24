# Ordinovix

Ordinovix is a private practice workflow web application for trusted Philippine tax preparers managing BIR filings, client errands, document review, and tax office visits.

## Quick Start
```powershell
# 1. Install dependencies
npm.cmd install

# 2. Run unit tests
npm.cmd run test:run

# 3. Start local development server
npm.cmd run dev
```

Then navigate to `http://localhost:5173/` in your browser.

## Core Concepts
1. **Received is not accepted:** An arriving document requires explicit human review and acceptance before satisfying a checklist line.
2. **Every blocked task states cause and owner:** No red indicator without actionable next steps.
3. **Visits require full readiness:** The visit planner enforces prerequisites (accepted physical copies, valid authorisations).
4. **Outcomes generate follow-ups:** Counter outcomes at RDO/offices instantly map to concrete next actions.
5. **Full auditability:** All changes are versioned, timestamped in Asia/Manila, and soft-deleted with stated reasons.

## Build Order
- **M0 Foundation (Active):** Project scaffold, design tokens, theme engine, app shell, route placeholders, mock repository, seed generator, rules and metrics with unit tests, dev menu.
- **M1 Components:** State gallery, input masks, stamp component.
- **M2 Today & Notifications:** Queue, command palette, notification centre.
- **M3 Clients:** Profile tabs, contacts, authorisations, CSV import.
- **M4 Tasks & Open Period:** Tasks list/board, period opening wizard.
- **M5 Documents:** Upload pipeline, camera, preview drawer.
- **M6 Follow-ups:** Walk-through, message composer.
- **M7 Visits & Offices:** Visit preparation, printable trip pack, outcome recording.
- **M8 Calendar & Payments:** Deadlines, scheduling, payment logging.
- **M9 Insights & Reports:** Dashboards, charts, exports.
- **M10 Settings & Access:** Org configuration, roles, audit log.
- **M11 Polish:** Offline queue, PWA manifest, performance and accessibility verification.
