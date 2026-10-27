---
paths:
  - "src/routes/**/*.{ts,tsx}"
  - "src/components/**/*.{ts,tsx}"
  - "src/app/**/*.{ts,tsx}"
---

# UI rules

- The look is approved by the owner. Fix behavior; do not restyle, re-layout, or rewrite copy unless the unit
  says so. No new UI libraries.
- Screens get data only through hooks in `src/hooks/useData.ts`. No hard-coded records, arrays of fake rows,
  or local-only state pretending to be saved data. A "Saved" message appears only after the repository call succeeds.
- Every data-backed page renders four states: loading skeleton, error with Retry (with 403 and 404 variants),
  empty, populated. Use the shared `QueryState` wrapper once U06 lands.
- All React hooks run before any early `return`. No hooks inside conditions or loops.
- Colors, radii, spacing and type come from tokens in `src/styles/tokens.css` (Tailwind token classes). No raw hex.
- Keep these labels unchanged; acceptance tests click them: "Stamp Accept", "Start Trip", "Finish Visit",
  "Save Item Outcome", "Save changes", "Not accepted", "Completed", "What happened at the counter".
- Accessibility: labels on inputs, visible focus, 44 px touch targets, status never shown by color alone,
  inputs at least 16 px on phones. Do not disable pinch zoom.
- Dev-only UI (dev menu, persona switcher, sample-data banner) renders only when `VITE_DATA_SOURCE` is not `api`.
