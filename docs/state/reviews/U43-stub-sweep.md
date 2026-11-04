# U43 stub sweep (2026-11-05, main 524ed93)

Searched `src/` and `worker/` (not tests, not `src/data/mock/`, not `src/routes/dev/`) for `Date.now()`, `Math.random`, `doc-`, `fake-`, `sample`, `sim`, `mock`, `stub`.

## Fabricated data sent to the API (fixed)
| Where | What | Fix |
|---|---|---|
| `src/routes/visits/record.tsx` (`handleSimulateEvidenceUpload`) | "Take Photo / Upload" attached `doc-<Date.now()>` and a fake `counter_receipt_N.jpg`; the id went into the outcome's `evidenceDocumentIds` | Opens the shared `FileDrop`; only the saved document's id is used. `FileDrop` now passes `visitItemId` |
| `src/data/commands.ts` `recordOutcome` | An evidence id with no document was silently skipped (`if (!doc) continue`) | 422 `evidenceDocumentIds`: "Counter evidence must be an uploaded file" |
| `src/data/commands.ts` `documents.upload` / `replace` | `sha256: info?.sha256 \|\| 'fake-hash-' + Date.now()` | Real SHA-256 of the bytes |
| `src/routes/visits/record.tsx` | An item with saved evidence showed a made-up name `stamped_copy.pdf` | Shows the count of saved files |

## Dates that were wrong for 8 hours a day (fixed)
| Where | What |
|---|---|
| `src/components/tasks/open-period-modal.tsx` | Default due date `new Date(y, m+1, 20).toISOString().slice(0,10)` was the 19th in Manila |
| `src/data/commands.ts` (visit start, outcome time) | `new Date().toTimeString()` is the machine's clock (UTC on the Worker) under a `+08:00` suffix; now `nowInManila()` |
| `src/routes/visits/record.tsx` | Finish-visit default time from the device clock; now Manila |

## Not fabricated data, left as is
- `file-drop.tsx` `Math.random()` is a React list key for upload rows. `error-buffer.ts` and `error-page.tsx` ids label local error reports. `src/data/api/http.ts` `crypto.randomUUID()` is the Idempotency-Key. `Math.random() < failureRate` in `http.ts` is the dev-only failure switch (dev server only).
- `src/routes/tasks/detail.tsx` "Mark Received" (title "Simulate client uploading document"): sends only a line status change with a note, no id or file. It is the explicit "client brought it" action, not a fake upload; the title text still says "Simulate". Proposed, not changed (copy): rename the title to "Mark as received".
- Welcome page "sample data" wording and Settings "Last automated export" fixed text were already queued (U39 proposal 3).
