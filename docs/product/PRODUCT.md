# Product Overview — Ordinovix

## Problem Statement
A trusted Philippine tax preparer handling BIR filings, client document collection, and tax office visits currently relies on manual tracking, memory, and ad-hoc chat channels, leading to preventable repeat office visits and delayed filing periods.

## Primary User & JTBD
- **Ana (Owner):** Independent tax preparer serving law firms and lawyers. Job: At any moment, see what each client and filing period needs, verify received items, plan watertight office visits, and track follow-ups.
- **Ben (Helper):** Authorized assistant. Job: Perform delegated errands and document verification for assigned clients only.

## North Star Metric
**First-pass completion rate:** Percentage of tax office visits where all planned items are completed on the initial trip without rejection or missing document causes.

## Core Rules
1. **Received is not accepted:** Uploaded files require review before advancing task state.
2. **Blocked tasks must show reason & actor:** Explicit blocker causes and next action owners.
3. **Visits must be strictly ready:** Enforce prerequisites (e.g. valid SPA/authorisation, physical copy availability).
4. **Counter outcomes drive next steps:** Every visit item outcome updates lines or schedules follow-ups.
5. **Soft delete only:** Full auditability across all entities.
