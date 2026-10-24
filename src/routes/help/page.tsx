import { BookOpen, Command, AlertCircle, ArrowRight, LifeBuoy } from 'lucide-react';

export function HelpPage() {
  const glossary = [
    { term: 'Client', def: 'A law firm, legal practitioner, or retainership served by the preparation practice.' },
    { term: 'Task', def: 'One discrete statutory obligation for one client and tax period (e.g., "1601-EQ — Q3 2026").' },
    { term: 'Line', def: 'One single requirement on a task checklist (e.g., Alphalist DAT file, 2307 certificates).' },
    { term: 'Received', def: 'A source document or schedule has physically or digitally arrived; not yet verified.' },
    { term: 'Accepted', def: 'Checked by the operator and determined complete, correct, and ready for use.' },
    { term: 'Blocked', def: 'At least one mandatory requirement line is not yet accepted, preventing filing/payment.' },
    { term: 'Follow-up', def: 'A structured reminder thread to a client contact for missing items with tracking history.' },
    { term: 'Visit', def: 'A planned physical field run to an external office (RDO, AAB, LGU) covering one or more tasks.' },
    { term: 'Outcome', def: 'The documented result of a counter interaction (Stamped, Paid, Assessed, Rejected).' },
    { term: 'Certified copy', def: 'A certified true copy of a return or clearance (never abbreviated to CTC to avoid confusion with Cedula).' },
    { term: 'RDO', def: 'Revenue District Office (BIR Bureau of Internal Revenue branch).' },
    { term: 'AAB', def: 'Authorized Agent Bank (commercial bank branch authorized to receive BIR tax return payments).' },
    { term: 'RCO', def: 'Revenue Collection Officer (assigned BIR counter staff handling cash/check payments).' },
    { term: 'SPA', def: 'Special Power of Attorney authorizing the tax preparer to represent the taxpayer at the counter.' },
  ];

  const shortcuts = [
    { key: 'Cmd / Ctrl + K', action: 'Open Global Command Palette / Search' },
    { key: 'Cmd / Ctrl + 1', action: 'Navigate to Today queue' },
    { key: 'Cmd / Ctrl + 2', action: 'Navigate to Tasks list' },
    { key: 'Cmd / Ctrl + 3', action: 'Navigate to Clients' },
    { key: 'Cmd / Ctrl + 4', action: 'Navigate to Visits planner' },
    { key: 'N', action: 'Trigger quick create sheet for the active context' },
    { key: 'Esc', action: 'Close active drawer, modal sheet, or command menu' },
    { key: '?', action: 'Open this Help & Keyboard Shortcuts guide' },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="border-b border-[var(--rule)] pb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[var(--stamp)]" />
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Help, Glossary & Operator Guide</h1>
        </div>
        <p className="text-sm text-[var(--ink-2)] mt-0.5">
          Standard definitions, workflow status machines, keyboard shortcuts, and practice guidance.
        </p>
      </div>

      {/* Scope and Boundaries */}
      <div className="p-4 rounded-lg bg-[var(--warn-bg)] border border-[var(--warn-bd)] text-[var(--warn-fg)] flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-sm">What Ordinovix Does Not Do</div>
          <p>
            Ordinovix is a strict private workflow system for operational tracking, document verification, and visit organization.
            It does <strong>not</strong> compute taxes, does <strong>not</strong> provide automated tax advice, and does <strong>not</strong> file electronically without operator discretion.
          </p>
          <p>
            Built-in obligation templates remain labeled <strong>Unverified</strong> until formally confirmed against the client's BIR Form 2303 Certificate of Registration.
          </p>
        </div>
      </div>

      {/* Workflow Diagram */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[var(--ink)]">How Requirements & Tasks Flow</h2>
        <p className="text-xs text-[var(--ink-3)]">
          Every obligation progresses from requirement discovery to counter completion through immutable stages:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] space-y-1.5">
            <div className="font-mono font-bold text-[var(--ink-3)]">STAGE 1</div>
            <div className="font-bold text-sm text-[var(--ink)]">1. Requirement Line</div>
            <div className="text-[var(--ink-2)]">
              Missing <ArrowRight className="inline w-3 h-3 text-[var(--ink-3)]" /> Received <ArrowRight className="inline w-3 h-3 text-[var(--ink-3)]" /> Accepted
            </div>
            <p className="text-[11px] text-[var(--ink-3)] pt-1">
              Documents are checked one by one. If any mandatory line is missing, the task remains Blocked.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] space-y-1.5">
            <div className="font-mono font-bold text-[var(--ink-3)]">STAGE 2</div>
            <div className="font-bold text-sm text-[var(--ink)]">2. Task Readiness</div>
            <div className="text-[var(--ink-2)]">
              Draft / Blocked <ArrowRight className="inline w-3 h-3 text-[var(--ink-3)]" /> Ready to File / Pay
            </div>
            <p className="text-[11px] text-[var(--ink-3)] pt-1">
              Once all lines are Accepted (and authorization valid), the task automatically unblocks.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] space-y-1.5">
            <div className="font-mono font-bold text-[var(--ink-3)]">STAGE 3</div>
            <div className="font-bold text-sm text-[var(--ink)]">3. Field Trip Planning</div>
            <div className="text-[var(--ink-2)]">
              Unassigned <ArrowRight className="inline w-3 h-3 text-[var(--ink-3)]" /> Packed <ArrowRight className="inline w-3 h-3 text-[var(--ink-3)]" /> Trip Run
            </div>
            <p className="text-[11px] text-[var(--ink-3)] pt-1">
              Tasks needing counter presence are grouped into visits with automatic trip pack checklists.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] space-y-1.5">
            <div className="font-mono font-bold text-[var(--ink-3)]">STAGE 4</div>
            <div className="font-bold text-sm text-[var(--ink)]">4. Counter Outcome</div>
            <div className="text-[var(--ink-2)]">
              Field Execution <ArrowRight className="inline w-3 h-3 text-[var(--ink-3)]" /> Stamped / Paid
            </div>
            <p className="text-[11px] text-[var(--ink-3)] pt-1">
              Outcome recorded with counter officer notes, reference numbers, and evidence receipts.
            </p>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Command className="w-5 h-5 text-[var(--ink-3)]" />
          <h2 className="text-base font-bold text-[var(--ink)]">Keyboard Shortcuts</h2>
        </div>
        <div className="bg-[var(--sheet)] border border-[var(--rule)] rounded-lg divide-y divide-[var(--rule)] overflow-hidden shadow-sm">
          {shortcuts.map((sc, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="text-[var(--ink-2)]">{sc.action}</span>
              <kbd className="px-2 py-1 rounded bg-[var(--sheet-2)] border border-[var(--rule-strong)] font-mono text-[11px] text-[var(--ink)] font-semibold shadow-xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      {/* Glossary */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-[var(--ink)]">Practice Glossary</h2>
        <div className="bg-[var(--sheet)] border border-[var(--rule)] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-3)] font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-4 w-40">Term</th>
                <th className="py-2.5 px-4">Standard Definition in Ordinovix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {glossary.map((g) => (
                <tr key={g.term} className="hover:bg-[var(--sheet-2)]">
                  <td className="py-2.5 px-4 font-bold text-[var(--ink)] whitespace-nowrap align-top">
                    {g.term}
                  </td>
                  <td className="py-2.5 px-4 text-[var(--ink-2)] leading-relaxed">
                    {g.def}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Support Contact */}
      <div className="p-4 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy className="w-5 h-5 text-[var(--stamp)]" />
          <div>
            <div className="text-xs font-bold text-[var(--ink)]">Need operational technical support?</div>
            <div className="text-[11px] text-[var(--ink-3)]">Ordinovix Engineering Support · Contact developer via repository dispatch</div>
          </div>
        </div>
        <a
          href="mailto:support@ordinovix.ph"
          className="text-xs font-semibold text-[var(--stamp-ink)] hover:underline"
        >
          support@ordinovix.ph
        </a>
      </div>
    </div>
  );
}
