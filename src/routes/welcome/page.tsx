import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Bell,
  Sparkles,
} from 'lucide-react';
import { DateField } from '@/components/inputs/date-field';

export function WelcomePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Step 1: Operator & Practice details
  const [displayName, setDisplayName] = useState('Ana Santos');
  const [practiceName, setPracticeName] = useState('Santos Tax Advisory');
  const [mobile, setMobile] = useState('+63 917 555 0101');
  const [accreditationNo, setAccreditationNo] = useState('BIR-TA-2024-009182');
  const [accreditationExpiry, setAccreditationExpiry] = useState('2027-12-31');

  // Step 2: Client addition choice
  const [clientChoice, setClientChoice] = useState<'import' | 'manual' | 'later'>('later');

  // Step 3: Task types
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, boolean>>({
    '1601-EQ': true,
    '0619-E': true,
    '1702-Q': true,
    '2551-Q': true,
    'BOOK-STAMP': true,
  });

  // Step 4: Invite helper
  const [helperEmail, setHelperEmail] = useState('');
  const [helperScope, setHelperScope] = useState<'all' | 'specific'>('all');

  // Step 5: Reminders permission
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  const totalSteps = 5;

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      finishSetup();
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const finishSetup = () => {
    // Navigate to Today and show confirmation
    navigate('/', { state: { toast: 'Setup saved. You can change any of this in Settings.' } });
  };

  const toggleTemplate = (code: string) => {
    setSelectedTemplates((prev) => ({ ...prev, [code]: !prev[code] }));
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
                  <label className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                    Display Name (in messages &#123;&#123;operator&#125;&#125;) *
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    placeholder="e.g. Ana Santos"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                    Practice Name *
                  </label>
                  <input
                    type="text"
                    value={practiceName}
                    onChange={(e) => setPracticeName(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    placeholder="e.g. Santos Tax Advisory Services"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                    Mobile Number (Philippines) *
                  </label>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
                    placeholder="+63 917 555 0101"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--rule)]">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                      BIR Accreditation No. (Optional)
                    </label>
                    <input
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
                {[
                  { code: '1601-EQ', name: 'Quarterly Withholding Tax (Creditable)', freq: 'Quarterly' },
                  { code: '0619-E', name: 'Monthly Remittance Form (Creditable Withholding)', freq: 'Monthly' },
                  { code: '1702-Q', name: 'Quarterly Corporate Income Tax Return', freq: 'Quarterly' },
                  { code: '2551-Q', name: 'Quarterly Percentage Tax Return', freq: 'Quarterly' },
                  { code: 'BOOK-STAMP', name: 'Annual Books of Accounts Inscription & Stamping', freq: 'Annual' },
                ].map((tpl) => (
                  <div
                    key={tpl.code}
                    onClick={() => toggleTemplate(tpl.code)}
                    className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] flex items-center justify-between cursor-pointer hover:border-[var(--rule-strong)]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)]">
                          {tpl.code}
                        </span>
                        <span className="text-xs font-semibold text-[var(--ink)]">{tpl.name}</span>
                      </div>
                      <span className="text-[11px] text-[var(--ink-3)] block mt-0.5">{tpl.freq} cycle</span>
                    </div>

                    <input
                      type="checkbox"
                      checked={Boolean(selectedTemplates[tpl.code])}
                      onChange={() => {}}
                      className="w-4 h-4 accent-[var(--stamp)] rounded cursor-pointer"
                    />
                  </div>
                ))}
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
                  <label className="block text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                    Helper Google Account Email
                  </label>
                  <input
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
              <div className="p-4 rounded-xl border border-[var(--rule)] bg-[var(--sheet)] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">Daily Reminders & Push Alerts</div>
                  <div className="text-xs text-[var(--ink-3)]">Receive notifications for overdue client lines and morning trip alerts.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setRemindersEnabled(!remindersEnabled)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    remindersEnabled
                      ? 'bg-[var(--good-bg)] text-[var(--good-fg)] border border-[var(--good-bd)]'
                      : 'bg-[var(--stamp)] text-[var(--on-stamp)] hover:bg-[var(--stamp-strong)]'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{remindersEnabled ? 'Reminders On' : 'Turn on reminders'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[var(--rule)] bg-[var(--sheet-2)] p-4 px-6 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-3.5 py-2 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--sheet-2)] transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={finishSetup}
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
                onClick={nextStep}
                className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] font-medium transition-colors"
              >
                Skip this step
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              className="px-5 py-2 rounded-lg bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>{step === totalSteps ? 'Complete Setup' : 'Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
