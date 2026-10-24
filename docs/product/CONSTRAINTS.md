# Technical & Operational Constraints

1. **Platform:** Static single-page application built with React 19 + TypeScript + Vite + Tailwind CSS v4. Designed for Cloudflare Workers/Pages deployment.
2. **Domain:** No custom domain required for v2; operates on `workers.dev`.
3. **No Credential Storage:** Strictly prohibited from storing BIR portal credentials (eFPS, eBIRForms, ORUS).
4. **Timezone:** Asia/Manila (`+08:00`) for all calendar dates (`YYYY-MM-DD`).
5. **Currency:** Philippine Peso stored as integer centavos (`₱1.00` = `100`).
6. **Data Privacy:** Philippine Data Privacy Act of 2012 (RA 10173). Privacy masking for TIN, client names, and financial amounts.
7. **Accessibility:** WCAG 2.2 AA compliance; touch targets >= 44px; minimum 16px input font size to avoid iOS zoom.
8. **No Third-Party Backend during Frontend Phase:** All persistence implemented via client-side in-memory and `localStorage` mock repository.
