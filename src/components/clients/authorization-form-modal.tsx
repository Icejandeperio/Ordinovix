import React, { useState, useEffect } from 'react';
import { useMemberships, useUpsertAuthorization, useReplaceAuthorization } from '@/hooks/useData';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/inputs/date-field';
import { X, FileCheck2, Stamp, Calendar, AlertCircle } from 'lucide-react';
import type { Authorization, TaskKind } from '@/domain/types';

interface AuthorizationFormModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  authorization?: Authorization | null;
  replaceTargetId?: string | null;
}

const TASK_KINDS: { id: TaskKind; label: string }[] = [
  { id: 'filing', label: 'BIR Tax Filings (eFPS / eBIRForms)' },
  { id: 'payment', label: 'Authorized Bank & ePayment Processing' },
  { id: 'registration', label: 'BIR Registration & COR Updates' },
  { id: 'one_time_transaction', label: 'One-Time Transactions (ONETT / CAR)' },
  { id: 'lgu', label: 'LGU Mayor’s Permits & Local Taxes' },
  { id: 'other', label: 'Other Errand & Office Submissions' },
];

export function AuthorizationFormModal({
  open,
  onClose,
  clientId,
  authorization,
  replaceTargetId,
}: AuthorizationFormModalProps) {
  const { data: memberships } = useMemberships();
  const upsertAuth = useUpsertAuthorization();
  const replaceAuth = useReplaceAuthorization();

  const isEditing = Boolean(authorization);
  const isReplacing = Boolean(replaceTargetId);

  const [type, setType] = useState<Authorization['type']>('spa');
  const [granteeUserId, setGranteeUserId] = useState<string>('user-ana');
  const [scope, setScope] = useState<TaskKind[]>(['filing', 'payment']);
  const [issuedOn, setIssuedOn] = useState<string>('2026-01-15');
  const [validUntil, setValidUntil] = useState<string>('2026-12-31');
  const [noExpiry, setNoExpiry] = useState<boolean>(false);
  const [notarized, setNotarized] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authorization) {
      setType(authorization.type);
      setGranteeUserId(authorization.granteeUserId || 'user-ana');
      setScope(authorization.scope || ['filing']);
      setIssuedOn(authorization.issuedOn || '2026-01-15');
      setValidUntil(authorization.validUntil || '');
      setNoExpiry(!authorization.validUntil);
      setNotarized(Boolean(authorization.notarized));
    } else {
      setType('spa');
      setGranteeUserId(memberships?.[0]?.userId || 'user-ana');
      setScope(['filing', 'payment']);
      setIssuedOn(new Date().toISOString().slice(0, 10));
      setValidUntil('');
      setNoExpiry(false);
      setNotarized(true);
    }
    setError(null);
  }, [authorization, open, memberships]);

  if (!open) return null;

  const toggleScope = (kind: TaskKind) => {
    if (scope.includes(kind)) {
      if (scope.length === 1) return; // Keep at least one
      setScope(scope.filter((k) => k !== kind));
    } else {
      setScope([...scope, kind]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!granteeUserId) {
      setError('Authorized representative is required');
      return;
    }
    if (!issuedOn) {
      setError('Date of issuance is required');
      return;
    }
    if (scope.length === 0) {
      setError('Select at least one covered authorization scope');
      return;
    }

    const payload = {
      id: authorization?.id,
      clientId,
      type,
      granteeUserId,
      scope,
      issuedOn,
      validUntil: noExpiry || !validUntil ? undefined : validUntil,
      notarized,
    };

    if (isReplacing && replaceTargetId) {
      replaceAuth.mutate(
        {
          oldId: replaceTargetId,
          next: payload,
        },
        {
          onSuccess: () => onClose(),
        }
      );
    } else {
      upsertAuth.mutate(payload, {
        onSuccess: () => onClose(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-sheet rounded-modal border border-rule shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-rule flex items-center justify-between shrink-0 bg-sheet">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stamp-soft text-stamp flex items-center justify-center">
              <Stamp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink font-sans">
                {isReplacing
                  ? 'Replace Authorization (Archive Previous)'
                  : isEditing
                  ? 'Edit Authorization Document'
                  : 'Grant New Authorization'}
              </h3>
              <p className="text-[11px] text-ink-3">
                Legal power of attorney or authority letter for BIR submissions
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-control bg-critical-bg border border-critical-bd text-critical text-xs font-medium">
              {error}
            </div>
          )}

          {isReplacing && (
            <div className="p-2.5 rounded-control bg-warn-bg border border-warn-bd text-warn-fg text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Replacing active document</p>
                <p className="text-[11px]">
                  The existing authorization will be archived into document history and replaced by this new document.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1">
              Document Type <span className="text-critical">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus font-medium"
            >
              <option value="spa">Special Power of Attorney (SPA)</option>
              <option value="authorization_letter">Letter of Authorization</option>
              <option value="secretary_certificate">Secretary's Certificate</option>
              <option value="partnership_resolution">Partnership Resolution</option>
              <option value="other">Other Official Authorization</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1">
              Authorized Representative (Grantee) <span className="text-critical">*</span>
            </label>
            <select
              value={granteeUserId}
              onChange={(e) => setGranteeUserId(e.target.value)}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            >
              {memberships?.map((m) => {
                const name = m.userId === 'user-ana' ? 'Ana Santos (Owner)' : m.userId === 'user-ben' ? 'Ben Morales (Helper)' : m.email;
                return (
                  <option key={m.id} value={m.userId || 'user-ana'}>
                    {name}
                  </option>
                );
              }) || (
                <>
                  <option value="user-ana">Ana Santos (Owner / Preparer)</option>
                  <option value="user-ben">Ben Morales (Authorized Helper)</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">
              Authorized Scope (Covered BIR &amp; LGU Actions) <span className="text-critical">*</span>
            </label>
            <div className="space-y-1.5 bg-sheet-2 p-2.5 rounded-control border border-rule">
              {TASK_KINDS.map((k) => {
                const checked = scope.includes(k.id);
                return (
                  <label
                    key={k.id}
                    className="flex items-center gap-2 text-xs text-ink cursor-pointer hover:text-stamp"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleScope(k.id)}
                      className="rounded border-rule text-stamp focus:ring-stamp"
                    />
                    <span>{k.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1">
                Issued On <span className="text-critical">*</span>
              </label>
              <DateField
                value={issuedOn}
                onChange={(val) => setIssuedOn(val || '')}
                placeholder="YYYY-MM-DD"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-ink-2">Valid Until</label>
                <label className="text-[11px] text-ink-3 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noExpiry}
                    onChange={(e) => {
                      setNoExpiry(e.target.checked);
                      if (e.target.checked) setValidUntil('');
                    }}
                    className="rounded text-stamp focus:ring-stamp"
                  />
                  No stated expiry
                </label>
              </div>
              <DateField
                value={validUntil}
                onChange={(val) => setValidUntil(val || '')}
                disabled={noExpiry}
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>

          {/* Notarized switch */}
          <div className="p-3 bg-sheet-2 border border-rule rounded-control flex items-center justify-between">
            <div className="flex items-start gap-2.5">
              <FileCheck2 className="w-4 h-4 text-stamp shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-ink">Notarized Instrument</p>
                <p className="text-[11px] text-ink-3">Document bears notary seal, Doc. No., Page No., Book No.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notarized}
                onChange={(e) => setNotarized(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-rule peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-stamp"></div>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-rule">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={upsertAuth.isPending || replaceAuth.isPending}
            >
              {isReplacing ? 'Replace & Archive' : isEditing ? 'Save Changes' : 'Grant Authorization'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
