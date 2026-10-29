import { useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Building2,
  Users,
  FileCheck2,
  UserPlus,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  Upload,
  UserPlus2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { DateField } from '@/components/inputs/date-field';
import { PushReminders } from '@/components/push-reminders';
import {
  useTemplates,
  useSession,
  useSaveSettings,
  useSaveTemplate,
  useInviteMembership,
  useClients,
} from '@/hooks/useData';
import { FREQUENCY_LABELS } from '@/domain/labels';
import { withStepDone, firstOpenStep, toE164 } from '@/lib/onboarding';
import type { OnboardingProgress, OnboardingStep } from '@/domain/types';

export function WelcomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: session } = useSession();
  const settings = session?.settings;
  const saveSettings = useSaveSettings();
  const saveTemplate = useSaveTemplate();
  const inviteMember = useInviteMembership();

  const totalSteps = 5;
  const requested = Number(params.get('step'));
  const [step, setStep] = useState<number>(requested >= 1 && requested <= totalSteps ? requested : firstOpenStep(settings?.onboarding));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Operator & Practice details; each field starts from what is saved and only changes once typed in
  const [edits, setEdits] = useState<{ displayName?: string; practiceName?: string; mobile?: string; accreditationNo?: string; accreditationExpiry?: string }>({});
  const displayName = edits.displayName ?? settings?.operatorDisplayName ?? '';
  const practiceName = edits.practiceName ?? settings?.practiceName ?? '';
  const mobile = edits.mobile ?? settings?.mobileE164 ?? '';
  const accreditationNo = edits.accreditationNo ?? settings?.accreditation?.number ?? '';
  const accreditationExpiry = edits.accreditationExpiry ?? settings?.accreditation?.validUntil ?? '';
  const setDisplayName = (v: string) => setEdits((e) => ({ ...e, displayName: v }));
  const setPracticeName = (v: string) => setEdits((e) => ({ ...e, practiceName: v }));
  const setMobile = (v: string) => setEdits((e) => ({ ...e, mobile: v }));
  const setAccreditationNo = (v: string) => setEdits((e) => ({ ...e, accreditationNo: v }));
  const setAccreditationExpiry = (v: string) => setEdits((e) => ({ ...e, accreditationExpiry: v }));

  // Step 2: Client addition choice
  const [clientChoice, setClientChoice] = useState<'import' | 'manual' | 'later'>('later');
  const { data: clientsData } = useClients();

  // Step 3: Task types: every template the repository lists, checked when it is active
  const { data: templates, isLoading: templatesLoading, isError: templatesError, refetch: refetchTemplates } = useTemplates();
  const [templateChoice, setTemplateChoice] = useState<Record<string, boolean>>({});
  const isOn = (id: string, active: boolean) => templateChoice[id] ?? active;

  // Step 4: Invite helper
  const [helperEmail, setHelperEmail] = useState('');
  const [helperScope, setHelperScope] = useState<'all' | 'specific'>('all');

  // Step 5: Reminders permission

  // Nothing can be saved until the saved settings (and, on step 3, the templates) have loaded
  const notReady = !settings || (step === 3 && templatesLoading);

  // Progress comes from what the last save returned, so a step saved a moment ago is never overwritten by a stale read
  const savedProgress = useRef<OnboardingProgress | undefined>(undefined);
  const markDone = (key: OnboardingStep) => withStepDone(savedProgress.current ?? settings?.onboarding, key);
  const saveProgress = async (s: Parameters<typeof saveSettings.mutateAsync>[0]) => {
    const saved = await saveSettings.mutateAsync(s);
    savedProgress.current = saved.onboarding;
  };

  /** Saves what the current step collected through the repository. Returns false when it failed (the error is shown). */
  const saveStep = async (): Promise<boolean> => {
    setError(null);
    try {
      if (step === 1) {
        const e164 = toE164(mobile);
        if (mobile.trim() && !e164) throw new Error('Enter a Philippine mobile number, like +63 917 555 0101');
        await saveProgress({
          practiceName: practiceName.trim(),
          operatorDisplayName: displayName.trim(),
          mobileE164: e164 ?? undefined,
          accreditation: accreditationNo.trim() ? { number: accreditationNo.trim(), validUntil: accreditationExpiry || undefined } : undefined,
          onboarding: markDone('details'),
        });
      } else if (step === 2) {
        if (clientChoice !== 'later') await saveProgress({ onboarding: markDone('clients') });
      } else if (step === 3) {
        for (const t of templates ?? []) {
          if (isOn(t.id, t.active) !== t.active) await saveTemplate.mutateAsync({ template: { id: t.id, active: !t.active } });
        }
        await saveProgress({ onboarding: markDone('templates') });
      } else if (step === 4) {
        const email = helperEmail.trim();
        if (email) {
          const clientIds = helperScope === 'all' ? (clientsData?.items ?? []).map((s) => s.client.id) : [];
          await inviteMember.mutateAsync({ email, role: 'helper', clientIds });
          await saveProgress({ onboarding: markDone('helper') });
        }
      } else if (step === 5) {
        await saveProgress({ onboarding: markDone('phone') });
      }
      return true;
    } catch (err) {
      setError((err as Error).message || 'Could not save this step. Try again.');
      return false;
    }
  };

  const nextStep = async () => {
    setSaving(true);
    const ok = await saveStep();
    setSaving(false);
    if (!ok) return;
    if (step < totalSteps) setStep(step + 1);
    else finishSetup();
  };

  const skipStep = () => {
    setError(null);
    setStep(step + 1);
  };

  const prevStep = () => {
    setError(null);
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const finishSetup = () => {
    toast.success('Setup saved. You can change any of this in Settings.');
    navigate(clientChoice === 'import' ? '/clients/import' : clientChoice === 'manual' ? '/clients' : '/');
  };

  const toggleTemplate = (id: string, active: boolean) => {
    setTemplateChoice((prev) => ({ ...prev, [id]: !isOn(id, active) }));
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-[640px] bg-[var(--sheet)] border border-[var(--rule)] rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Progress Bar & Header */}
        <div className="border-b border-[var(--rule)] bg-[var(--sheet-2)] p-6 pb-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink-3)] mb-2">
            <span className="flex items-center gap-1.5 text-[var(--ink)]">
              <Sparkles className="w-4 h-4 text-[var(--stamp)]" />
              First-run Setup
            </span>
            <span className="font-mono">
              Step {step} of {totalSteps}
            </span>
          </div>

          <div className="w-full h-1 bg-[var(--rule)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--stamp)] transition-all duration-300 ease-out"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Body */}
        <div className="p-6 md:p-8 space-y-6 flex-1">
          {/* STEP 1: Your details */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h2 className="text-xl font-bold text-[var(--ink)] tracking-tight">Your practice details</h2>
                <p className="text-xs text-[var(--ink-2)] mt-1">
                  These details will identify your practice on transmittals, authorizations, and client reminder messages.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="wiz-display-name" className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                    Display Name (in messages &#123;&#123;operator&#125;&#125;) *
                  </label>
                  <input
                    id="wiz-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    placeholder="e.g. Ana Santos"
                  />
                </div>

                <div>
                  <label htmlFor="wiz-practice-name" className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                    Practice Name *
                  </label>
                  <input
                    id="wiz-practice-name"
                    type="text"
                    value={practiceName}
                    onChange={(e) => setPracticeName(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    placeholder="e.g. Santos Tax Advisory Services"
                  />
                </div>

                <div>
                  <label htmlFor="wiz-mobile" className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                    Mobile Number (Philippines) *
                  </label>
                  <input
                    id="wiz-mobile"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    placeholder="+63 917 555 0101"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--rule)]">
                  <div>
                    <label htmlFor="wiz-accreditation" className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                      BIR Accreditation No. (Optional)
                    </label>
                    <input
                      id="wiz-accreditation"
                      type="text"
                      value={accreditationNo}
                      onChange={(e) => setAccreditationNo(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                      placeholder="BIR-TA-2024-XXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                      Accreditation Validity Date
                    </label>
                    <DateField
                      value={accreditationExpiry}
                      onChange={(val) => setAccreditationExpiry(val || '')}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Add your clients */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h2 className="text-xl font-bold text-[var(--ink)] tracking-tight">Add your clients</h2>
                <p className="text-xs text-[var(--ink-2)] mt-1">
                  Choose how you want to bring client records into Ordinovix.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label
                  onClick={() => setClientChoice('import')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 ${
                    clientChoice === 'import'
                      ? 'border-[var(--stamp)] bg-[var(--stamp-soft)]'
                      : 'border-[var(--rule)] bg-[var(--sheet)] hover:border-[var(--rule-strong)]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--stamp)] text-[var(--on-stamp)] flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[var(--ink)] flex items-center justify-between">
                      <span>Import a spreadsheet</span>
                      {clientChoice === 'import' && <Check className="w-4 h-4 text-[var(--stamp-ink)]" />}
                    </div>
                    <p className="text-xs text-[var(--ink-2)] mt-1">
                      Upload an existing client list (CSV / XLSX) with TINs, RDOs, and contacts.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setClientChoice('manual')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 ${
                    clientChoice === 'manual'
                      ? 'border-[var(--stamp)] bg-[var(--stamp-soft)]'
                      : 'border-[var(--rule)] bg-[var(--sheet)] hover:border-[var(--rule-strong)]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)] flex items-center justify-center shrink-0">
                    <UserPlus2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[var(--ink)] flex items-center justify-between">
                      <span>Add clients one at a time</span>
                      {clientChoice === 'manual' && <Check className="w-4 h-4 text-[var(--stamp-ink)]" />}
                    </div>
                    <p className="text-xs text-[var(--ink-2)] mt-1">
                      Key in each client manually as new retainership contracts and SPAs begin.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setClientChoice('later')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-4 ${
                    clientChoice === 'later'
                      ? 'border-[var(--stamp)] bg-[var(--stamp-soft)]'
                      : 'border-[var(--rule)] bg-[var(--sheet)] hover:border-[var(--rule-strong)]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[var(--ink)] flex items-center justify-between">
                      <span>Do this later</span>
                      {clientChoice === 'later' && <Check className="w-4 h-4 text-[var(--stamp-ink)]" />}
                    </div>
                    <p className="text-xs text-[var(--ink-2)] mt-1">
                      Start exploring sample data right away; add your real clients whenever you're ready.
                    </p>
                  </div>
                </label>
              </div>

              {clientChoice === 'import' && (
                <div className="p-3 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] text-xs text-[var(--ink-2)] flex items-center justify-between">
                  <span>Spreadsheet importer will open after completing this setup.</span>
                  <Link to="/clients/import" className="text-[var(--stamp-ink)] font-semibold hover:underline">
                    Go now &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Choose task types */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h2 className="text-xl font-bold text-[var(--ink)] tracking-tight">Choose obligation templates</h2>
                <p className="text-xs text-[var(--ink-2)] mt-1">
                  Select which BIR filings and compliance types your practice regularly handles.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-[var(--warn-bg)] border border-[var(--warn-bd)] text-[var(--warn-fg)] flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Unverified templates:</strong> Built-in sample checklists must be confirmed against each client's BIR Form 2303 Certificate of Registration before relying on them.
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {templatesLoading ? (
                  <div className="space-y-2 animate-pulse" aria-busy="true">
                    <div className="h-14 bg-sheet-3 rounded-lg" />
                    <div className="h-14 bg-sheet-3 rounded-lg" />
                  </div>
                ) : templatesError ? (
                  <div className="p-3 rounded-lg border border-[var(--critical-bd)] bg-[var(--critical-bg)] text-xs text-[var(--critical-fg)] flex items-center justify-between gap-3">
                    <span>Could not load templates.</span>
                    <button
                      type="button"
                      onClick={() => refetchTemplates()}
                      className="px-2.5 py-1 rounded border border-[var(--critical-bd)] font-semibold hover:bg-[var(--sheet)]"
                    >
                      Retry
                    </button>
                  </div>
                ) : !templates || templates.length === 0 ? (
                  <div className="p-3 rounded-lg border border-dashed border-[var(--rule)] text-xs text-[var(--ink-3)]">
                    No obligation templates yet.
                  </div>
                ) : (
                  templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => toggleTemplate(tpl.id, tpl.active)}
                    className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] flex items-center justify-between cursor-pointer hover:border-[var(--rule-strong)]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)]">
                          {tpl.code}
                        </span>
                        <span className="text-xs font-semibold text-[var(--ink)]">{tpl.name}</span>
                      </div>
                      <span className="text-[11px] text-[var(--ink-3)] block mt-0.5">
                        {FREQUENCY_LABELS[tpl.frequency]} cycle · {tpl.verified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      checked={isOn(tpl.id, tpl.active)}
                      onChange={() => {}}
                      aria-label={`Include ${tpl.code}`}
                      className="w-4 h-4 accent-[var(--stamp)] rounded cursor-pointer"
                    />
                  </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Invite a helper */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h2 className="text-xl font-bold text-[var(--ink)] tracking-tight">Invite a helper (Optional)</h2>
                <p className="text-xs text-[var(--ink-2)] mt-1">
                  Add an assistant or liaison officer who can view assigned clients and prepare visit packs.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="wiz-helper-email" className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                    Helper Google Account Email
                  </label>
                  <input
                    id="wiz-helper-email"
                    type="email"
                    value={helperEmail}
                    onChange={(e) => setHelperEmail(e.target.value)}
                    placeholder="e.g. ben.morales@gmail.com"
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-2">
                    Client Scope
                  </label>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setHelperScope('all')}
                      className={`p-3 rounded-lg border text-left font-medium transition-colors ${
                        helperScope === 'all'
                          ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-semibold'
                          : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)]'
                      }`}
                    >
                      <div className="font-bold">All Clients</div>
                      <div className="text-[11px] opacity-80 mt-0.5">Can assist on any client task</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHelperScope('specific')}
                      className={`p-3 rounded-lg border text-left font-medium transition-colors ${
                        helperScope === 'specific'
                          ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-semibold'
                          : 'border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-2)]'
                      }`}
                    >
                      <div className="font-bold">Specific Clients</div>
                      <div className="text-[11px] opacity-80 mt-0.5">Assigned client matters only</div>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] text-xs text-[var(--ink-3)]">
                  You can always invite or revoke helpers later in <em>Settings &rarr; Users & Access</em>.
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Phone install instructions & notifications */}
          {step === 5 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h2 className="text-xl font-bold text-[var(--ink)] tracking-tight">Put Ordinovix on your phone</h2>
                <p className="text-xs text-[var(--ink-2)] mt-1">
                  Access field trip packs and counter outcome logging directly while on the move.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Android Card */}
                <div className="p-4 rounded-xl border border-[var(--rule)] bg-[var(--sheet-2)] space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-[var(--ink)]">
                    <Smartphone className="w-4 h-4 text-[var(--stamp)]" />
                    <span>Android (Chrome)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-[var(--ink-2)] leading-relaxed">
                    <li>Tap the Chrome menu (<strong>&vellip;</strong>) in the top-right corner.</li>
                    <li>Select <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li>
                    <li>Launch anytime directly from your home screen.</li>
                  </ol>
                </div>

                {/* iPhone Card */}
                <div className="p-4 rounded-xl border border-[var(--rule)] bg-[var(--sheet-2)] space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-[var(--ink)]">
                    <Smartphone className="w-4 h-4 text-[var(--stamp)]" />
                    <span>iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-[var(--ink-2)] leading-relaxed">
                    <li>Tap the <strong>Share</strong> icon (square with upward arrow).</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                    <li>Confirm by tapping <strong>Add</strong> in the top right.</li>
                  </ol>
                </div>
              </div>

              {/* Reminders button */}
              <div className="p-4 rounded-xl border border-[var(--rule)] bg-[var(--sheet)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">Daily Reminders & Push Alerts</div>
                  <div className="text-xs text-[var(--ink-3)]">Receive notifications for overdue client lines and morning trip alerts.</div>
                </div>
                <PushReminders />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="mx-6 mb-4 p-3 rounded-lg border border-[var(--critical-bd)] bg-[var(--critical-bg)] text-xs text-[var(--critical-fg)] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="border-t border-[var(--rule)] bg-[var(--sheet-2)] p-4 px-6 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                disabled={saving}
                className="px-3.5 py-2 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--sheet-2)] transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] font-medium transition-colors"
              >
                Skip setup for now
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < totalSteps && (
              <button
                type="button"
                onClick={skipStep}
                disabled={saving}
                className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] font-medium transition-colors"
              >
                Skip this step
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              disabled={saving || notReady}
              className="px-5 py-2 rounded-lg bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>{saving ? 'Saving…' : step === totalSteps ? 'Complete Setup' : 'Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
