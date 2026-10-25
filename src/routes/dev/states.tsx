import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Inbox,
  CheckCircle2,
  Send,
  Lock,
  Plus,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput, NumberStepper } from '@/components/inputs/money-input';
import { TinInput, MaskedTin, PhoneInput, EmailInput } from '@/components/inputs/identity-inputs';
import { DateField } from '@/components/inputs/date-field';
import { ReviewStamp } from '@/components/ui/stamp';
import {
  StatusChip,
  LineChip,
  DueBadge,
  AuthorizationBadge,
  ReadinessMeter,
  ClientFlag,
} from '@/components/ui/status-chip';
import type { Centavos } from '@/domain/types';

export function DevStatesPage() {
  // State for interactive inputs
  const [btnLoading, setBtnLoading] = useState(false);
  const [moneyVal, setMoneyVal] = useState<Centavos | null>(1234550); // ₱12,345.50
  const [stepperVal, setStepperVal] = useState(2);
  const [tinVal, setTinVal] = useState('123456789000');
  const [phoneVal, setPhoneVal] = useState('+639171234567');
  const [emailVal, setEmailVal] = useState('ana.santos@ordinovix.ph');
  const [dateVal, setDateVal] = useState<string | null>('2026-10-28');
  const [readyCount, setReadyCount] = useState(6);
  const [stampKey, setStampKey] = useState(0);

  // Four canonical states simulator tab
  const [activeTab, setActiveTab] = useState<'populated' | 'loading' | 'empty' | 'error'>('populated');

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8 pb-28">
      {/* Header */}
      <div className="border-b border-rule pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-stamp" />
            <h1 className="text-2xl font-bold text-ink tracking-tight">Component State Gallery</h1>
          </div>
          <p className="text-xs text-ink-2 mt-1">
            Section 9 Component Library exercising the four canonical states (Loading, Empty, Error, Populated) in both Light & Dark modes.
          </p>
        </div>

        {/* Canonical States Switcher */}
        <div className="flex items-center p-1 rounded-control bg-sheet-2 border border-rule self-start">
          {(['populated', 'loading', 'empty', 'error'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs font-semibold rounded-chip transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-sheet text-ink shadow-xs'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* CANONICAL STATE VIEWER */}
      {activeTab === 'loading' && (
        <section className="p-6 rounded-panel border border-rule bg-sheet space-y-6">
          <div className="flex items-center gap-2 text-xs font-bold text-ink-3">
            <RefreshCw className="w-4 h-4 animate-spin text-stamp" />
            <span>State: Loading Skeleton (Spec 8.8 & 9.13: Pulse without gradient)</span>
          </div>

          <div className="space-y-4 animate-pulse">
            <div className="h-6 w-1/3 bg-sheet-3 rounded-control" />
            <div className="h-10 w-full bg-sheet-3 rounded-control" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-24 bg-sheet-3 rounded-panel" />
              <div className="h-24 bg-sheet-3 rounded-panel" />
              <div className="h-24 bg-sheet-3 rounded-panel" />
            </div>
            <div className="h-40 w-full bg-sheet-3 rounded-panel" />
          </div>
        </section>
      )}

      {activeTab === 'empty' && (
        <section className="p-12 rounded-panel border border-rule bg-sheet text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-sheet-2 border border-rule flex items-center justify-center mx-auto text-ink-3">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-ink">No tasks match these filters</h3>
            <p className="text-xs text-ink-3 max-w-sm mx-auto">
              Every empty screen in Ordinovix points directly to the single next action.
            </p>
          </div>
          <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            Open New Period
          </Button>
        </section>
      )}

      {activeTab === 'error' && (
        <section className="p-8 rounded-panel border border-critical-bd bg-critical-bg text-critical-fg space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-critical-solid" />
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-bold text-critical-fg">
                Couldn't load client records
              </h3>
              <p className="text-xs text-critical-fg/80">
                Network connection dropped or request timed out after 10000ms. The rest of the practice workspace remains operational.
              </p>
              <div className="text-[11px] font-mono text-critical-solid pt-1">
                Error Code: E_MOCK_NETWORK_TIMEOUT (504)
              </div>
            </div>
          </div>
          <div className="pt-2 flex gap-3">
            <Button
              variant="danger"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => setActiveTab('populated')}
            >
              Retry Connection
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setActiveTab('populated')}>
              Work Offline
            </Button>
          </div>
        </section>
      )}

      {/* POPULATED FULL SPEC SHOWCASE */}
      {activeTab === 'populated' && (
        <div className="space-y-8">
          {/* SECTION 9.1: BUTTONS */}
          <section className="p-6 rounded-panel border border-rule bg-sheet space-y-5">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div>
                <h2 className="text-sm font-bold text-ink">9.1 Buttons & Actions</h2>
                <p className="text-xs text-ink-3">Variants, sizes, loading feedback, and keyboard focus rings.</p>
              </div>
              <button
                type="button"
                onClick={() => setBtnLoading(!btnLoading)}
                className="px-2.5 py-1 text-xs font-semibold rounded-chip bg-sheet-2 border border-rule hover:bg-stamp-soft text-ink-2 hover:text-stamp transition-colors cursor-pointer"
              >
                Toggle Loading: {btnLoading ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" loading={btnLoading} icon={<Plus className="w-4 h-4" />}>
                Primary Action
              </Button>
              <Button variant="secondary" loading={btnLoading}>
                Secondary Action
              </Button>
              <Button variant="ghost" loading={btnLoading}>
                Ghost Action
              </Button>
              <Button variant="danger" loading={btnLoading} icon={<ShieldAlert className="w-4 h-4" />}>
                Danger Action
              </Button>
              <Button variant="primary" size="sm">
                Small (32px)
              </Button>
              <Button variant="primary" size="lg">
                Large (48px)
              </Button>
              <Button variant="secondary" disabled>
                Disabled State
              </Button>
            </div>
          </section>

          {/* SECTION 8.6 & 9.7: REVIEW STAMP & DELIGHTS */}
          <section className="p-6 rounded-panel border border-rule bg-sheet space-y-5">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div>
                <h2 className="text-sm font-bold text-ink">8.6 & 9.7 Review Stamp (Accepted · Ready · Done)</h2>
                <p className="text-xs text-ink-3">Double-rule outline, -3° record rotation, SVG feTurbulence ink texture, and stamp-press animation.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => setStampKey((k) => k + 1)}
              >
                Replay Stamp Motion
              </Button>
            </div>

            <div key={stampKey} className="grid grid-cols-1 sm:grid-cols-4 gap-6 items-center pt-2">
              <div className="p-4 rounded-control bg-sheet-2 border border-rule flex flex-col items-center justify-center gap-2">
                <span className="text-[10px] font-mono uppercase text-ink-3 font-bold">Line Variant</span>
                <ReviewStamp id="stamp-1" variant="line" date="24 OCT" initials="ANA S." />
              </div>

              <div className="p-4 rounded-control bg-sheet-2 border border-rule flex flex-col items-center justify-center gap-2">
                <span className="text-[10px] font-mono uppercase text-ink-3 font-bold">Ready Variant</span>
                <ReviewStamp id="stamp-2" variant="ready" office="RDO 39" date="OCT 28" />
              </div>

              <div className="p-4 rounded-control bg-sheet-2 border border-rule flex flex-col items-center justify-center gap-2">
                <span className="text-[10px] font-mono uppercase text-ink-3 font-bold">Done Variant</span>
                <ReviewStamp id="stamp-3" variant="done" date="OCT 21" evidenceCount={3} />
              </div>

              <div className="p-4 rounded-control bg-sheet-2 border border-rule flex flex-col items-center justify-center gap-2">
                <span className="text-[10px] font-mono uppercase text-ink-3 font-bold">Received Variant</span>
                <ReviewStamp id="stamp-4" variant="received" date="24 OCT" />
              </div>
            </div>
          </section>

          {/* SECTION 9.3: MONEY & NUMBERS */}
          <section className="p-6 rounded-panel border border-rule bg-sheet space-y-5">
            <div className="border-b border-rule pb-3">
              <h2 className="text-sm font-bold text-ink">9.3 Number & Money Inputs</h2>
              <p className="text-xs text-ink-3">Integer centavos storage, tabular figures, ₱ adornment, and NumberStepper.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 rounded-control bg-sheet-2 border border-rule space-y-3">
                <MoneyInput
                  label="Tax Remittance / Filing Fee"
                  centavos={moneyVal}
                  onChangeCentavos={setMoneyVal}
                  quickChips={[
                    { label: '₱500.00 (Annual)', centavos: 50000 },
                    { label: '₱12,345.50 (Last)', centavos: 1234550 },
                    { label: '₱50,000.00', centavos: 5000000 },
                  ]}
                  hint="Stores as integer centavos without float rounding errors."
                />
                <div className="text-[11px] font-mono text-ink-3 pt-1">
                  Stored Integer: <strong className="text-ink">{moneyVal !== null ? `${moneyVal} centavos` : 'null'}</strong>
                </div>
              </div>

              <div className="p-4 rounded-control bg-sheet-2 border border-rule space-y-4">
                <NumberStepper
                  label="Physical Hard Copies Required"
                  value={stepperVal}
                  onChange={setStepperVal}
                  min={1}
                  max={10}
                  unit="copies"
                  hint="Keyboard arrows or -/+ buttons with rapid hold repeat."
                />
                <div className="pt-2">
                  <ReadinessMeter
                    total={8}
                    ready={readyCount}
                    label="Trip Pack Readiness"
                  />
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReadyCount((c) => Math.max(0, c - 1))}
                    >
                      -1 Ready
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReadyCount((c) => Math.min(8, c + 1))}
                    >
                      +1 Ready
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 9.4: IDENTITY INPUTS & TIN */}
          <section className="p-6 rounded-panel border border-rule bg-sheet space-y-5">
            <div className="border-b border-rule pb-3">
              <h2 className="text-sm font-bold text-ink">9.4 Identity Inputs & Masked TIN</h2>
              <p className="text-xs text-ink-3">TIN pattern formatting, 30s timed reveal toggle, and E.164 phone actions.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-4 rounded-control bg-sheet-2 border border-rule space-y-3">
                <TinInput
                  value={tinVal}
                  onChange={setTinVal}
                  duplicateWarning={tinVal.startsWith('999') ? 'Rivera Salonga & Partners has this TIN. Same client?' : undefined}
                  hint="Type 999 to preview duplicate warning."
                />
                <div className="pt-2 border-t border-rule">
                  <span className="text-[11px] text-ink-3 block mb-1">Masked Display (Default):</span>
                  <MaskedTin tin={tinVal} />
                </div>
              </div>

              <div className="p-4 rounded-control bg-sheet-2 border border-rule space-y-3">
                <PhoneInput
                  value={phoneVal}
                  onChange={setPhoneVal}
                  hint="Supports mobile 0917... and landlines (02)..."
                />
                <div className="text-[11px] font-mono text-ink-3 pt-1">
                  E.164: <strong className="text-ink">{phoneVal}</strong>
                </div>
              </div>

              <div className="p-4 rounded-control bg-sheet-2 border border-rule space-y-3">
                <EmailInput
                  value={emailVal}
                  onChange={setEmailVal}
                  hint="Lowercases automatically on blur."
                />
                <DateField
                  label="Statutory Due Date (9.6)"
                  value={dateVal}
                  onChange={setDateVal}
                />
              </div>
            </div>
          </section>

          {/* SECTION 9.7: STATUS CHIPS & BADGES */}
          <section className="p-6 rounded-panel border border-rule bg-sheet space-y-5">
            <div className="border-b border-rule pb-3">
              <h2 className="text-sm font-bold text-ink">9.7 Status Chips, Due Badges & Entity Flags</h2>
              <p className="text-xs text-ink-3">Tone-checked token colors from tokens.css paired with 16px Lucide iconography.</p>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-ink-2 block mb-2">Task Statuses:</span>
                <div className="flex flex-wrap gap-2">
                  <StatusChip status="waiting_on_client" />
                  <StatusChip status="review_required" />
                  <StatusChip status="needs_correction" />
                  <StatusChip status="in_preparation" />
                  <StatusChip status="ready_next_step" />
                  <StatusChip status="submitted" />
                  <StatusChip status="completed" />
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-ink-2 block mb-2">Line Statuses:</span>
                <div className="flex flex-wrap gap-2">
                  <LineChip status="not_requested" />
                  <LineChip status="requested" />
                  <LineChip status="received" />
                  <LineChip status="accepted" />
                  <LineChip status="incomplete" />
                  <LineChip status="needs_correction" />
                  <LineChip status="not_applicable" />
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-ink-2 block mb-2">Due & Authorization Badges:</span>
                <div className="flex flex-wrap gap-2 items-center">
                  <DueBadge state="overdue" daysDiff={-3} />
                  <DueBadge state="due_today" />
                  <DueBadge state="due_soon" daysDiff={4} />
                  <DueBadge isCompleted completedDate="Oct 24" />
                  <AuthorizationBadge state="valid" detail="Mar 31, 2027" />
                  <AuthorizationBadge state="expiring" detail="12 days" />
                  <AuthorizationBadge state="expired" detail="Oct 15" />
                  <AuthorizationBadge state="none" />
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-ink-2 block mb-2">Client Flags:</span>
                <div className="flex flex-wrap gap-2">
                  <ClientFlag label="GPP" />
                  <ClientFlag label="Solo" />
                  <ClientFlag label="VAT" />
                  <ClientFlag label="Non-VAT (8%)" />
                  <ClientFlag label="eFPS: Group C" />
                  <ClientFlag label="ORUS: Operator" />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
