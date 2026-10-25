import React, { useState, useEffect } from 'react';
import { useOffices, useMemberships, useUpsertClient } from '@/hooks/useData';
import { Button } from '@/components/ui/button';
import { TinInput } from '@/components/inputs/identity-inputs';
import {
  X,
  AlertTriangle,
  Building2,
  FileText,
  Users,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Save,
} from 'lucide-react';
import type { Client, EntityType, VatStatus, SizeClass, FilingChannel, EfpsGroup, AccessHolder, Language } from '@/domain/types';

interface ClientFormSheetProps {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
}

export function ClientFormSheet({ open, onClose, client }: ClientFormSheetProps) {
  const isEditing = Boolean(client);
  const { data: officesData } = useOffices();
  const { data: memberships } = useMemberships();
  const upsertClient = useUpsertClient();

  // Basic Details
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('gpp');
  const [rdoCode, setRdoCode] = useState('');

  // Registration Section
  const [registeredName, setRegisteredName] = useState('');
  const [tin, setTin] = useState('');
  const [vatStatus, setVatStatus] = useState<VatStatus>('vat');
  const [sizeClass, setSizeClass] = useState<SizeClass>('small');
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState(12);

  // Filing Section
  const [filingChannel, setFilingChannel] = useState<FilingChannel>('efps');
  const [efpsGroup, setEfpsGroup] = useState<EfpsGroup>('B');
  const [orusEnrolled, setOrusEnrolled] = useState(false);
  const [accessHolder, setAccessHolder] = useState<AccessHolder>('client');
  const [usesInvoicingSoftware, setUsesInvoicingSoftware] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<Language>('en');

  // Collapsible sections
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [filingOpen, setFilingOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  // Notes & Password warning
  const [notes, setNotes] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset or populate state
  useEffect(() => {
    if (client) {
      setDisplayName(client.displayName || '');
      setCode(client.code || '');
      setEntityType(client.entityType || 'gpp');
      setRdoCode(client.rdoCode || '');
      setRegisteredName(client.registeredName || '');
      setTin(client.tinMasked || '');
      setVatStatus(client.vatStatus || 'vat');
      setSizeClass(client.sizeClass || 'small');
      setFiscalYearEndMonth(client.fiscalYearEndMonth || 12);
      setFilingChannel(client.filingChannel || 'efps');
      setEfpsGroup(client.efpsGroup || 'B');
      setOrusEnrolled(Boolean(client.orusEnrolled));
      setAccessHolder(client.accessHolder || 'client');
      setUsesInvoicingSoftware(Boolean(client.usesInvoicingSoftware));
      setPreferredLanguage(client.preferredLanguage || 'en');
      setNotes('');
    } else {
      setDisplayName('');
      setCode('');
      setEntityType('gpp');
      setRdoCode('039');
      setRegisteredName('');
      setTin('');
      setVatStatus('vat');
      setSizeClass('small');
      setFiscalYearEndMonth(12);
      setFilingChannel('efps');
      setEfpsGroup('B');
      setOrusEnrolled(false);
      setAccessHolder('client');
      setUsesInvoicingSoftware(false);
      setPreferredLanguage('en');
      setNotes('');
      setAssignedUserIds([]);
    }
    setErrors({});
  }, [client, open]);

  // Suggest Code from Name initials if code hasn't been manually typed
  const handleNameChange = (name: string) => {
    setDisplayName(name);
    if (!isEditing && (!code || code.length <= 4)) {
      const initials = name
        .split(/\s+/)
        .filter((w) => w.length > 0 && !['and', '&', 'of', 'the'].includes(w.toLowerCase()))
        .map((w) => w[0].toUpperCase())
        .join('')
        .slice(0, 5);
      if (initials) setCode(initials);
    }
  };

  // Check for password keywords in notes per Spec 11.7.3 & 12.2
  const hasPasswordWarning =
    /password|pw:|passwd|secret/i.test(notes);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!displayName.trim() || displayName.trim().length < 2) {
      newErrors.displayName = 'Name must be at least 2 characters';
    }
    if (!code.trim() || code.trim().length < 2 || code.trim().length > 6) {
      newErrors.code = 'Code must be between 2 and 6 uppercase characters';
    }
    if (!rdoCode.trim()) {
      newErrors.rdoCode = 'RDO code is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    upsertClient.mutate(
      {
        id: client?.id,
        displayName: displayName.trim(),
        code: code.trim().toUpperCase(),
        entityType,
        rdoCode: rdoCode.trim(),
        registeredName: registeredName.trim() || undefined,
        tinMasked: tin ? tin : undefined,
        hasTin: Boolean(tin),
        vatStatus,
        sizeClass,
        filingChannel,
        efpsGroup: filingChannel === 'efps' ? efpsGroup : undefined,
        orusEnrolled,
        accessHolder,
        usesInvoicingSoftware,
        fiscalYearEndMonth,
        preferredLanguage,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl bg-sheet border-l border-rule shadow-2xl flex flex-col h-full z-10 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-rule flex items-center justify-between shrink-0 bg-sheet">
          <div>
            <h2 className="text-base font-extrabold text-ink font-sans">
              {isEditing && client ? `Edit Client: ${client.code}` : 'Register New Client'}
            </h2>
            <p className="text-xs text-ink-3">
              Client profile, BIR registration parameters, and tax channel setup
            </p>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-none">
          {/* Required Primary Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Client Name <span className="text-critical">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Rivera Salonga & Partners"
                className={`w-full p-2.5 text-xs bg-sheet-2 border rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus ${
                  errors.displayName ? 'border-critical-bd ring-1 ring-critical-bd' : 'border-rule'
                }`}
              />
              {errors.displayName && (
                <p className="text-[11px] text-critical font-medium mt-1">{errors.displayName}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Client Code <span className="text-critical">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. RSP"
                  maxLength={6}
                  className={`w-full p-2.5 text-xs font-mono font-bold uppercase bg-sheet-2 border rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus ${
                    errors.code ? 'border-critical-bd ring-1 ring-critical-bd' : 'border-rule'
                  }`}
                />
                {errors.code && (
                  <p className="text-[11px] text-critical font-medium mt-1">{errors.code}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  RDO <span className="text-critical">*</span>
                </label>
                <select
                  value={rdoCode}
                  onChange={(e) => setRdoCode(e.target.value)}
                  className="w-full p-2.5 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  <option value="039">RDO 039 - South QC</option>
                  <option value="040">RDO 040 - North QC</option>
                  <option value="044">RDO 044 - Taguig / Pateros</option>
                  <option value="050">RDO 050 - South Makati</option>
                </select>
                {errors.rdoCode && (
                  <p className="text-[11px] text-critical font-medium mt-1">{errors.rdoCode}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                Entity Type <span className="text-critical">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'gpp', label: 'GPP / Partnership' },
                  { value: 'solo', label: 'Sole Practitioner' },
                  { value: 'other', label: 'Corporation / Other' },
                ].map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setEntityType(t.value as EntityType)}
                    className={`p-2.5 text-xs font-semibold rounded-control border text-center transition-colors ${
                      entityType === t.value
                        ? 'border-stamp bg-stamp-soft text-stamp-strong ring-1 ring-stamp'
                        : 'border-rule bg-sheet-2 text-ink hover:bg-sheet-3'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Collapsible: Registration Parameters */}
          <div className="border border-rule rounded-panel overflow-hidden">
            <button
              type="button"
              onClick={() => setRegistrationOpen(!registrationOpen)}
              className="w-full p-3 bg-sheet-2 flex items-center justify-between text-xs font-bold text-ink hover:bg-sheet-3"
            >
              <span>BIR Registration Parameters</span>
              {registrationOpen ? <ChevronUp className="w-4 h-4 text-ink-3" /> : <ChevronDown className="w-4 h-4 text-ink-3" />}
            </button>

            {registrationOpen && (
              <div className="p-4 space-y-4 bg-sheet">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Registered Trade Name (if different)
                  </label>
                  <input
                    type="text"
                    value={registeredName}
                    onChange={(e) => setRegisteredName(e.target.value)}
                    placeholder="Official name on BIR Certificate of Registration"
                    className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Taxpayer Identification Number (TIN)
                  </label>
                  <TinInput value={tin} onChange={setTin} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      VAT Status
                    </label>
                    <select
                      value={vatStatus}
                      onChange={(e) => setVatStatus(e.target.value as VatStatus)}
                      className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none"
                    >
                      <option value="vat">VAT Registered</option>
                      <option value="non_vat_percentage">Non-VAT (Percentage Tax)</option>
                      <option value="non_vat_8pct">Non-VAT (8% Flat Rate)</option>
                      <option value="unknown">Not sure yet</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Taxpayer Size Class
                    </label>
                    <select
                      value={sizeClass}
                      onChange={(e) => setSizeClass(e.target.value as SizeClass)}
                      className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none"
                    >
                      <option value="micro">Micro (&le; ₱3M)</option>
                      <option value="small">Small (₱3M - ₱20M)</option>
                      <option value="medium">Medium (₱20M - ₱1B)</option>
                      <option value="large">Large (&ge; ₱1B)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible: Filing Channels & Access */}
          <div className="border border-rule rounded-panel overflow-hidden">
            <button
              type="button"
              onClick={() => setFilingOpen(!filingOpen)}
              className="w-full p-3 bg-sheet-2 flex items-center justify-between text-xs font-bold text-ink hover:bg-sheet-3"
            >
              <span>Filing Channels & System Access</span>
              {filingOpen ? <ChevronUp className="w-4 h-4 text-ink-3" /> : <ChevronDown className="w-4 h-4 text-ink-3" />}
            </button>

            {filingOpen && (
              <div className="p-4 space-y-4 bg-sheet">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Filing Channel
                    </label>
                    <select
                      value={filingChannel}
                      onChange={(e) => setFilingChannel(e.target.value as FilingChannel)}
                      className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none"
                    >
                      <option value="efps">eFPS</option>
                      <option value="ebirforms">eBIRForms</option>
                      <option value="manual">Manual / Counter</option>
                    </select>
                  </div>

                  {filingChannel === 'efps' && (
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        eFPS Group
                      </label>
                      <select
                        value={efpsGroup}
                        onChange={(e) => setEfpsGroup(e.target.value as EfpsGroup)}
                        className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none"
                      >
                        <option value="A">Group A</option>
                        <option value="B">Group B</option>
                        <option value="C">Group C</option>
                        <option value="D">Group D</option>
                        <option value="E">Group E</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-rule">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orusEnrolled}
                      onChange={(e) => setOrusEnrolled(e.target.checked)}
                      className="rounded border-rule text-stamp focus:ring-stamp"
                    />
                    <span className="text-xs font-semibold text-ink">Enrolled in BIR ORUS Portal</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usesInvoicingSoftware}
                      onChange={(e) => setUsesInvoicingSoftware(e.target.checked)}
                      className="rounded border-rule text-stamp focus:ring-stamp"
                    />
                    <span className="text-xs font-semibold text-ink">Uses Electronic Invoicing Software</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    ORUS Portal Access Held By
                  </label>
                  <select
                    value={accessHolder}
                    onChange={(e) => setAccessHolder(e.target.value as AccessHolder)}
                    className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none"
                  >
                    <option value="client">Client retains credentials</option>
                    <option value="operator">Preparer (Santos Tax Services)</option>
                    <option value="other">Third-party accountant</option>
                    <option value="unknown">Unknown / Not verified</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Notes with Password Warning per Spec 11.7.3 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink">Practice Notes</label>
              <span className="text-[11px] text-ink-3">≤ 2,000 chars</span>
            </div>

            {/* Strict Section 11.7.3 Security Notice */}
            <div className="p-2.5 rounded-control bg-warn-bg border border-warn-bd text-[11px] text-warn-fg flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Security Policy:</strong> Never store eFPS, eBIRForms, or ORUS portal passwords here. Store login credentials in a dedicated password manager.
              </span>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Filing preferences, courier schedule, special instructions..."
              rows={3}
              maxLength={2000}
              className="w-full p-2.5 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            />

            {hasPasswordWarning && (
              <div className="p-2 rounded-control bg-critical-bg border border-critical-bd text-xs font-semibold text-critical flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>This looks like a password. Store passwords in a password manager, not in Ordinovix.</span>
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-rule flex items-center justify-end gap-2 shrink-0">
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={upsertClient.isPending}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              <span>{isEditing ? 'Save Changes' : 'Register Client'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
