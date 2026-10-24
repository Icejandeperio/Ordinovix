import { useState } from 'react';
import { Layers, Sparkles, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DateField } from '@/components/inputs/date-field';

export function DevStatesPage() {
  const [demoDate1, setDemoDate1] = useState<string | null>('2026-10-28');
  const [demoDate2, setDemoDate2] = useState<string | null>(null);

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-8 pb-20">
      <div className="border-b border-[var(--rule)] pb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-[var(--stamp)]" />
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Component State Gallery</h1>
        </div>
        <p className="text-sm text-[var(--ink-2)] mt-0.5">
          Interactive catalog of Section 9 components in all four canonical states (loading, empty, error, populated).
        </p>
      </div>

      {/* FEATURED: Custom DateField per Spec 9.6 */}
      <section className="p-6 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--stamp)]" />
            <h2 className="text-base font-bold text-[var(--ink)]">9.6 Custom DateField (Tokens & Natural Language)</h2>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--good-bg)] text-[var(--good-fg)] border border-[var(--good-bd)]">
            Active Component
          </span>
        </div>

        <p className="text-xs text-[var(--ink-2)] leading-relaxed">
          Replaces the generic browser HTML5 <code>input[type="date"]</code> with a custom popover calendar.
          Supports natural typing (<code>Oct 28</code>, <code>tomorrow</code>, <code>+3</code>, <code>next fri</code>, <code>2026-10-28</code>), quick preset chips, and relative date cues.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {/* Populated Variant */}
          <div className="p-4 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--ink-3)]">
              State: Populated with Relative Hint
            </span>
            <DateField
              label="Statutory Return Due Date"
              value={demoDate1}
              onChange={setDemoDate1}
              placeholder="e.g. Oct 28 or +3..."
            />
            <div className="text-[11px] font-mono text-[var(--ink-3)] pt-2">
              Stored ISO value: <span className="font-bold text-[var(--ink)]">{demoDate1 || 'null'}</span>
            </div>
          </div>

          {/* Empty / Interactive Variant */}
          <div className="p-4 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--ink-3)]">
              State: Empty / Type Natural Language
            </span>
            <DateField
              label="Target Field Trip Date"
              value={demoDate2}
              onChange={setDemoDate2}
              placeholder="Type 'tomorrow', 'next mon', or select..."
            />
            <div className="text-[11px] font-mono text-[var(--ink-3)] pt-2">
              Stored ISO value: <span className="font-bold text-[var(--ink)]">{demoDate2 || 'null'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Overview Card */}
      <div className="p-6 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-4">
        <div className="flex items-center gap-3 text-[var(--stamp-ink)]">
          <Sparkles className="w-5 h-5 shrink-0" />
          <div className="text-sm font-bold">Milestone M1 Component Scope</div>
        </div>
        <p className="text-xs text-[var(--ink-2)] leading-relaxed">
          The application foundation, design tokens, mock repositories, routing hierarchy, and pure rule test suites are active.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--ink-2)] pt-2">
          <div className="p-2.5 rounded bg-[var(--sheet-2)] border border-[var(--rule)]">
            • <strong>9.1 Inputs:</strong> TextInput, SearchInput, PasswordInput
          </div>
          <div className="p-2.5 rounded bg-[var(--sheet-2)] border border-[var(--rule)]">
            • <strong>9.2 Masked Inputs:</strong> TinInput, PhoneInput, MoneyInput
          </div>
          <div className="p-2.5 rounded bg-[var(--sheet-2)] border border-[var(--rule)]">
            • <strong>9.3 Dates:</strong> DateField (Completed), TimeField, PeriodPicker
          </div>
          <div className="p-2.5 rounded bg-[var(--sheet-2)] border border-[var(--rule)]">
            • <strong>9.4 Badges:</strong> StatusToneBadge, DueStatePill, Tag
          </div>
          <div className="p-2.5 rounded bg-[var(--sheet-2)] border border-[var(--rule)]">
            • <strong>9.5 Interactive:</strong> StampAnimation, LineRow, TaskRow
          </div>
          <div className="p-2.5 rounded bg-[var(--sheet-2)] border border-[var(--rule)]">
            • <strong>9.6 Feedback:</strong> ConfirmDialog, Toast, ErrorBoundary
          </div>
        </div>

        <div className="pt-4 flex items-center gap-3">
          <Link
            to="/dev/tokens"
            className="px-4 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors"
          >
            Inspect Design Tokens Sheet
          </Link>
          <Link
            to="/"
            className="px-4 py-2 rounded-md border border-[var(--rule)] text-[var(--ink)] text-xs font-semibold hover:bg-[var(--sheet-2)] transition-colors"
          >
            Return to Today
          </Link>
        </div>
      </div>
    </div>
  );
}
