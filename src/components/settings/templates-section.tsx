import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, FileCheck2, X } from 'lucide-react';
import { useTemplates, useTemplateLines, useMarkTemplateVerified } from '@/hooks/useData';
import { FREQUENCY_LABELS } from '@/domain/labels';
import { todayInManila } from '@/lib/dates';
import { DateField } from '@/components/inputs/date-field';
import type { TaskTemplate } from '@/domain/types';

interface TemplatesSectionProps {
  isOwner: boolean;
}

function TemplateRow({
  template,
  isOwner,
  onVerify,
}: {
  template: TaskTemplate;
  isOwner: boolean;
  onVerify: (t: TaskTemplate) => void;
}) {
  const { data: detail } = useTemplateLines(template.id);
  const lineCount = detail ? detail.lines.length : null;

  return (
    <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] flex items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)]">
            {template.code}
          </span>
          <span className="text-sm font-semibold text-[var(--ink)]">{template.name}</span>
        </div>
        <div className="text-xs text-[var(--ink-3)] flex items-center gap-2">
          <span>
            {FREQUENCY_LABELS[template.frequency]} schedule · {lineCount ?? '…'} requirement lines
          </span>
          {template.sourceRef && (
            <span className="font-mono text-[11px] text-[var(--ink-2)]">
              &middot; Ref: {template.sourceRef}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {template.verified ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--good-fg)] bg-[var(--good-bg)] px-2.5 py-1 rounded border border-[var(--good-bd)]">
            <Check className="w-3 h-3" /> Verified
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--warn-fg)] bg-[var(--warn-bg)] px-2.5 py-1 rounded border border-[var(--warn-bd)]">
              <AlertTriangle className="w-3 h-3" /> Unverified
            </span>
            {isOwner && (
              <button
                type="button"
                onClick={() => onVerify(template)}
                className="px-2.5 py-1 rounded bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors"
              >
                Mark Verified
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TemplatesSection({ isOwner }: TemplatesSectionProps) {
  const { data: templates, isLoading, isError, error, refetch } = useTemplates();
  const markVerified = useMarkTemplateVerified();

  const [verifying, setVerifying] = useState<TaskTemplate | null>(null);
  const [sourceRef, setSourceRef] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [verifyDate, setVerifyDate] = useState(todayInManila());
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const openVerify = (t: TaskTemplate) => {
    setVerifying(t);
    setSourceRef('');
    setSourceLink('');
    setVerifyDate(todayInManila());
    setVerifyError(null);
  };

  const confirmVerify = () => {
    if (!verifying) return;
    if (!sourceRef.trim()) {
      setVerifyError('Statutory source reference is required to certify template.');
      return;
    }
    markVerified.mutate(
      {
        id: verifying.id,
        verification: {
          sourceRef: sourceRef.trim(),
          sourceUrl: sourceLink.trim() || undefined,
          verifiedOn: verifyDate || todayInManila(),
        },
      },
      {
        onSuccess: () => {
          toast.success(`${verifying.code} marked verified`);
          setVerifying(null);
        },
        onError: (err: any) => {
          setVerifyError(err?.message || 'Could not mark the template verified');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)]">Obligation Templates</h2>
          <p className="text-xs text-[var(--ink-3)] mt-0.5">Standard obligation requirement checklists and schedule rules.</p>
        </div>
        {!isOwner && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)] uppercase">
            Read-only (Helper)
          </span>
        )}
      </div>

      {!isOwner && (
        <div className="p-3 bg-[var(--sheet-2)] border border-[var(--rule)] rounded-lg text-xs text-[var(--ink-2)]">
          You are viewing templates with helper permissions. Only the practice owner can edit requirement lines or certify statutory verification.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          <div className="h-16 bg-sheet-3 rounded-lg" />
          <div className="h-16 bg-sheet-3 rounded-lg" />
        </div>
      ) : isError ? (
        <div className="p-3.5 rounded-lg border border-[var(--critical-bd)] bg-[var(--critical-bg)] text-xs text-[var(--critical-fg)] flex items-center justify-between gap-3">
          <span>{(error as Error)?.message || 'Could not load templates.'}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-2.5 py-1 rounded border border-[var(--critical-bd)] font-semibold hover:bg-[var(--sheet)]"
          >
            Retry
          </button>
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="p-3.5 rounded-lg border border-dashed border-[var(--rule)] text-xs text-[var(--ink-3)]">
          No obligation templates yet.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} isOwner={isOwner} onVerify={openVerify} />
          ))}
        </div>
      )}

      {/* Template Verification Dialog */}
      {verifying && isOwner && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--sheet)] border border-[var(--rule)] rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[var(--stamp)]" />
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  Certify Template Verification ({verifying.code})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVerifying(null)}
                aria-label="Close"
                className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[var(--ink-2)]">
                Section 12.10 requires a statutory or circular reference before any obligation template can be marked verified.
              </p>

              <div>
                <label htmlFor="verify-source-ref" className="block font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                  Source Reference (Required) *
                </label>
                <input
                  id="verify-source-ref"
                  type="text"
                  value={sourceRef}
                  onChange={(e) => {
                    setSourceRef(e.target.value);
                    if (verifyError) setVerifyError(null);
                  }}
                  placeholder="e.g. NIRC Sec. 116 / RR 8-2018"
                  className="w-full h-9 px-3 rounded border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs focus:ring-2 focus:ring-[var(--stamp)] focus:outline-none"
                />
                {verifyError && (
                  <p className="text-[var(--critical-fg)] text-[11px] mt-1">{verifyError}</p>
                )}
              </div>

              <div>
                <label htmlFor="verify-source-link" className="block font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                  Source Link (Optional)
                </label>
                <input
                  id="verify-source-link"
                  type="url"
                  value={sourceLink}
                  onChange={(e) => setSourceLink(e.target.value)}
                  placeholder="https://www.bir.gov.ph/revenue-regulations/..."
                  className="w-full h-9 px-3 rounded border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs focus:ring-2 focus:ring-[var(--stamp)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--ink-3)] uppercase tracking-wider mb-1">
                  Verified Date
                </label>
                <DateField value={verifyDate} onChange={(val) => setVerifyDate(val || '')} placeholder="YYYY-MM-DD" />
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--rule)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVerifying(null)}
                className="px-3 py-1.5 rounded border border-[var(--rule)] bg-[var(--sheet)] text-xs font-medium text-[var(--ink-2)] hover:bg-[var(--sheet-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmVerify}
                disabled={markVerified.isPending}
                className="px-3 py-1.5 rounded bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] disabled:opacity-60"
              >
                Confirm Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
