import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useVisit,
  useRecordVisitOutcome,
  useFinishVisit,
} from '@/hooks/useData';
import type {
  Outcome,
  OutcomeCause,
  Supplier,
  ID,
} from '@/domain/types';
import {
  OUTCOME_META,
  OUTCOME_CAUSE_META,
  SUPPLIER_LABELS,
} from '@/domain/labels';
import { DateField } from '@/components/inputs/date-field';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { canFinishVisit } from '@/domain/rules';
import { todayInManila, addDaysToDate } from '@/lib/dates';
import { formatPeso } from '@/lib/format';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Camera,
  Upload,
  Plus,
  Trash2,
  FileCheck,
  Building2,
  CheckCheck,
  AlertCircle,
  HelpCircle,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { QueryState } from '@/components/ui/query-state';

export function VisitRecordPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useVisit(visitId || '');

  const recordOutcomeMutation = useRecordVisitOutcome();
  const finishVisitMutation = useFinishVisit();

  // Active item tab index
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  // Form state per item: keyed by itemId
  const [itemForms, setItemForms] = useState<
    Record<
      ID,
      {
        outcome?: Outcome;
        cause?: OutcomeCause;
        avoidable: boolean;
        note: string;
        windowOrOfficer: string;
        nextActionText: string;
        nextActionDue: string;
        nextActionOwner: Supplier;
        requestedDocs: string[];
        affectedLines: ID[];
        evidenceIds: ID[];
        evidenceNames: string[];
      }
    >
  >({});

  // Finish visit modal state
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishedTime, setFinishedTime] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  // Costs start empty: a pre-filled amount would be saved as a real cost if she never clears it (B15)
  const [transportPeso, setTransportPeso] = useState('');
  const [parkingPeso, setParkingPeso] = useState('');
  const [otherPeso, setOtherPeso] = useState('');
  const [costNote, setCostNote] = useState('');

  // Only SAVED outcomes count (product rule 3); a selected-but-unsaved form does not.
  // Not memoized: the mock mutates records in place, so the query data keeps its identity after a save.
  const allRecorded = canFinishVisit((data?.items ?? []).map((i) => i.item));

  if (isError) {
    return <QueryState isLoading={false} isError error={error} onRetry={() => refetch()} subject="this visit">{null}</QueryState>;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-sheet-3 rounded" />
        <div className="h-48 bg-sheet-3 rounded-panel" />
      </div>
    );
  }

  const { visit, items } = data;
  const currentItemDetail = items[activeItemIndex] || items[0];

  // Helper to get or initialize form state for an item
  const getFormState = (itemId: string) => {
    if (itemForms[itemId]) return itemForms[itemId];
    const existing = items.find((i) => i.item.id === itemId)?.item;
    return {
      outcome: existing?.outcome,
      cause: existing?.outcomeCause,
      avoidable: existing?.avoidable !== undefined ? existing.avoidable : true,
      note: existing?.outcomeNote || '',
      windowOrOfficer: existing?.windowOrOfficer || '',
      nextActionText: existing?.nextAction?.text || '',
      nextActionDue: existing?.nextAction?.due || addDaysToDate(todayInManila(), 3),
      nextActionOwner: existing?.nextAction?.owner || 'client',
      requestedDocs: [],
      affectedLines: [],
      evidenceIds: existing?.evidenceDocumentIds || [],
      evidenceNames: existing?.evidenceDocumentIds?.length ? ['stamped_copy.pdf'] : [],
    };
  };

  const currentForm = currentItemDetail ? getFormState(currentItemDetail.item.id) : null;

  const updateCurrentForm = (updates: Partial<ReturnType<typeof getFormState>>) => {
    if (!currentItemDetail) return;
    setItemForms((prev) => ({
      ...prev,
      [currentItemDetail.item.id]: {
        ...getFormState(currentItemDetail.item.id),
        ...updates,
      },
    }));
  };

  const handleSelectOutcome = (outcome: Outcome) => {
    const isCompleted = outcome === 'completed';
    updateCurrentForm({
      outcome,
      // If completed with evidence, next action can be cleared, else preset next action
      nextActionText:
        outcome === 'completed'
          ? ''
          : outcome === 'more_documents_requested'
          ? 'Collect requested documents from client'
          : outcome === 'correction_required'
          ? 'Correct defective paperwork'
          : outcome === 'paid_proof_pending'
          ? 'Obtain proof of payment'
          : 'Follow up at counter',
    });
  };

  const handleSelectCause = (cause: OutcomeCause) => {
    const isAvoidable = OUTCOME_CAUSE_META[cause]?.avoidable ?? false;
    updateCurrentForm({
      cause,
      avoidable: isAvoidable,
    });
  };

  const handleAddRequestedDoc = () => {
    if (!currentForm) return;
    updateCurrentForm({
      requestedDocs: [...currentForm.requestedDocs, ''],
    });
  };

  const handleUpdateRequestedDoc = (index: number, val: string) => {
    if (!currentForm) return;
    const docs = [...currentForm.requestedDocs];
    docs[index] = val;
    updateCurrentForm({ requestedDocs: docs });
  };

  const handleRemoveRequestedDoc = (index: number) => {
    if (!currentForm) return;
    const docs = currentForm.requestedDocs.filter((_, i) => i !== index);
    updateCurrentForm({ requestedDocs: docs });
  };

  const handleToggleAffectedLine = (lineId: ID) => {
    if (!currentForm) return;
    const exists = currentForm.affectedLines.includes(lineId);
    const affected = exists
      ? currentForm.affectedLines.filter((id) => id !== lineId)
      : [...currentForm.affectedLines, lineId];
    updateCurrentForm({ affectedLines: affected });
  };

  const handleSimulateEvidenceUpload = () => {
    if (!currentForm) return;
    const mockDocId = `doc-${Date.now()}`;
    updateCurrentForm({
      evidenceIds: [...currentForm.evidenceIds, mockDocId],
      evidenceNames: [
        ...currentForm.evidenceNames,
        `counter_receipt_${currentForm.evidenceNames.length + 1}.jpg`,
      ],
    });
    toast.success('Evidence photo attached');
  };

  const handleSaveCurrentItem = async () => {
    if (!currentItemDetail || !currentForm) return;

    if (!currentForm.outcome) {
      toast.error('Please select what happened at the counter');
      return;
    }

    if (currentForm.outcome !== 'completed' && !currentForm.cause) {
      toast.error('Please specify the cause/reason');
      return;
    }

    if (currentForm.cause === 'other' && !currentForm.note.trim()) {
      toast.error('Note is required when cause is "Other"');
      return;
    }

    if (
      currentForm.outcome === 'more_documents_requested' &&
      currentForm.requestedDocs.filter((d) => d.trim()).length === 0
    ) {
      toast.error('Please add at least one requested document');
      return;
    }

    if (
      currentForm.outcome === 'correction_required' &&
      currentForm.affectedLines.length === 0
    ) {
      toast.error('Please select which checklist line requires correction');
      return;
    }

    // Next action validation
    const needsNextAction =
      currentForm.outcome !== 'completed' || currentForm.evidenceIds.length === 0;
    if (needsNextAction && !currentForm.nextActionText.trim()) {
      toast.error('Next action description is required');
      return;
    }

    try {
      await recordOutcomeMutation.mutateAsync({
        itemId: currentItemDetail.item.id,
        outcome: {
          outcome: currentForm.outcome,
          cause: currentForm.cause,
          avoidable: currentForm.avoidable,
          note: currentForm.note.trim() || undefined,
          windowOrOfficer: currentForm.windowOrOfficer.trim() || undefined,
          nextAction: needsNextAction
            ? {
                text: currentForm.nextActionText.trim(),
                due: currentForm.nextActionDue,
                owner: currentForm.nextActionOwner,
              }
            : undefined,
          evidenceDocumentIds: currentForm.evidenceIds,
          requestedDocuments: currentForm.requestedDocs.filter((d) => d.trim()),
          affectedLineIds: currentForm.affectedLines,
        },
      });

      toast.success(`Outcome saved for ${currentItemDetail.client.displayName}`);

      // Auto advance to next unfinished item
      if (activeItemIndex < items.length - 1) {
        setActiveItemIndex(activeItemIndex + 1);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save outcome');
    }
  };

  const handleFinishVisit = async () => {
    try {
      const transportCentavos = Math.round((parseFloat(transportPeso) || 0) * 100);
      const parkingCentavos = Math.round((parseFloat(parkingPeso) || 0) * 100);
      const otherCentavos = Math.round((parseFloat(otherPeso) || 0) * 100);

      await finishVisitMutation.mutateAsync({
        id: visit.id,
        data: {
          finishedAt:
            todayInManila() +
            'T' +
            finishedTime +
            ':00+08:00',
          costs: {
            transport: transportCentavos,
            parking: parkingCentavos,
            other: otherCentavos,
            note: costNote.trim() || undefined,
          },
        },
      });

      toast.success('Visit completed! Summary generated');
      navigate(`/visits/${visit.id}/summary`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to finish visit');
    }
  };

  const outcomeList: Outcome[] = [
    'completed',
    'submitted_pending',
    'paid_proof_pending',
    'more_documents_requested',
    'correction_required',
    'not_accepted',
    'follow_up_required',
  ];

  const avoidableCauses: OutcomeCause[] = [
    'missing_document',
    'wrong_copy_form',
    'wrong_copy_count',
    'authorization_problem',
    'document_error',
    'unsigned_or_unnotarized',
  ];

  const unavoidableCauses: OutcomeCause[] = [
    'office_system_down',
    'officer_unavailable',
    'new_requirement',
    'processing_time',
    'cutoff_reached',
    'other',
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={`/visits/${visit.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Prepare</span>
        </Link>
        <span className="text-xs font-bold text-stamp uppercase tracking-wider">
          Counter Recording Mode
        </span>
      </div>

      {/* Header Banner */}
      <div className="bg-sheet border border-rule rounded-panel p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-stamp" />
            <span className="text-base font-bold text-ink">{visit.officeName}</span>
          </div>
          <p className="text-xs text-ink-3 mt-0.5">
            Log results before leaving counter to guarantee immediate next action triage
          </p>
        </div>

        <button
          disabled={!allRecorded}
          onClick={() => setIsFinishModalOpen(true)}
          className={`px-4 py-2.5 rounded-control text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer ${
            allRecorded
              ? 'bg-good-solid text-on-good hover:opacity-95'
              : 'bg-sheet-3 text-ink-3 cursor-not-allowed border border-rule'
          }`}
        >
          <CheckCheck className="w-4 h-4" />
          <span>Finish Visit ({items.filter((i) => i.item.outcome).length}/{items.length})</span>
        </button>
      </div>

      {/* Item Switcher Tabs (Large touch targets for phone) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {items.map(({ item, client, task }, idx) => {
          const isCurrent = idx === activeItemIndex;
          const isDone = Boolean(item.outcome);

          return (
            <button
              key={item.id}
              onClick={() => setActiveItemIndex(idx)}
              className={`min-h-[44px] px-3.5 py-2 rounded-control text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border cursor-pointer ${
                isCurrent
                  ? 'bg-stamp text-on-stamp border-stamp shadow-xs'
                  : isDone
                  ? 'bg-sheet text-ink border-good-bd hover:bg-sheet-2'
                  : 'bg-sheet text-ink-3 border-rule hover:text-ink'
              }`}
            >
              {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-good-fg" />}
              <span>{client.code}: {task.title ? task.title.slice(0, 18) : 'Task'}</span>
            </button>
          );
        })}
      </div>

      {/* Current Errand Item Outcome Form */}
      {currentItemDetail && currentForm && (
        <div className="bg-sheet border border-rule rounded-panel p-5 sm:p-6 space-y-6 shadow-xs">
          {/* Item Meta */}
          <div className="border-b border-rule pb-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-stamp uppercase">
                {currentItemDetail.client.displayName} ({currentItemDetail.client.code})
              </span>
              <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-sheet-2 text-ink-2 border uppercase">
                Intended: {currentItemDetail.item.intendedAction}
              </span>
            </div>
            <h2 className="text-lg font-bold text-ink">
              {currentItemDetail.task.title || 'Tax filing errand'}
            </h2>
            {currentItemDetail.item.questions && (
              <p className="text-xs text-warn-fg bg-warn-bg/40 p-2 rounded border border-warn-bd mt-2">
                <strong>Questions to raise:</strong> {currentItemDetail.item.questions}
              </p>
            )}
          </div>

          {/* Question 1: What happened? (7 Radio Cards with >=44px touch targets) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-ink uppercase tracking-wider block">
              What happened at the counter? (Required)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {outcomeList.map((outcomeKey) => {
                const meta = OUTCOME_META[outcomeKey];
                const isSelected = currentForm.outcome === outcomeKey;

                return (
                  <button
                    key={outcomeKey}
                    type="button"
                    onClick={() => handleSelectOutcome(outcomeKey)}
                    className={`min-h-[46px] p-3 text-left rounded-control border text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-stamp bg-stamp-soft text-ink font-bold shadow-2xs ring-1 ring-stamp'
                        : 'border-rule bg-sheet-2/60 text-ink-2 hover:bg-sheet-3 hover:text-ink'
                    }`}
                  >
                    <span>{meta.label}</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-stamp bg-stamp' : 'border-ink-3'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional: Why? (Shown for anything except Completed) */}
          {currentForm.outcome && currentForm.outcome !== 'completed' && (
            <div className="space-y-4 pt-4 border-t border-rule animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-ink">Why? Select Cause (Required)</label>
                  <select
                    value={currentForm.cause || ''}
                    onChange={(e) => handleSelectCause(e.target.value as OutcomeCause)}
                    className="w-full bg-sheet-2 border border-rule rounded-control px-3 py-2 text-xs text-ink focus:outline-none focus:border-stamp min-h-[40px]"
                  >
                    <option value="" disabled>-- Select Counter Cause --</option>
                    <optgroup label="Avoidable Causes (Process/Prep Defects)">
                      {avoidableCauses.map((c) => (
                        <option key={c} value={c}>
                          {OUTCOME_CAUSE_META[c].label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Not Avoidable Causes (Bureaucracy/System)">
                      {unavoidableCauses.map((c) => (
                        <option key={c} value={c}>
                          {OUTCOME_CAUSE_META[c].label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Avoidable Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-control bg-sheet-2 border border-rule min-h-[40px]">
                  <span className="text-xs font-bold text-ink">Avoidable defect?</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentForm.avoidable}
                      onChange={(e) => updateCurrentForm({ avoidable: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-sheet-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-stamp" />
                  </label>
                </div>
              </div>

              {/* Note / Counter observation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-ink">
                  Note / Officer Explanation {currentForm.cause === 'other' && '(Required for Other)'}:
                </label>
                <textarea
                  rows={2}
                  value={currentForm.note}
                  onChange={(e) => updateCurrentForm({ note: e.target.value })}
                  placeholder="Record officer remarks, window guidance, or required revisions..."
                  className="w-full bg-sheet-2 border border-rule rounded-control p-2.5 text-xs text-ink focus:outline-none focus:border-stamp"
                />
              </div>

              {/* If More Documents Requested: Document rows */}
              {currentForm.outcome === 'more_documents_requested' && (
                <div className="p-3.5 rounded-control bg-sheet-2/80 border border-rule space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">
                      Requested Documents (Each will become a new task line):
                    </span>
                    <button
                      type="button"
                      onClick={handleAddRequestedDoc}
                      className="text-xs font-bold text-stamp hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add document</span>
                    </button>
                  </div>

                  {currentForm.requestedDocs.length === 0 ? (
                    <p className="text-xs text-ink-3 italic">
                      Click "+ Add document" to name what the officer asked for.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {currentForm.requestedDocs.map((doc, dIdx) => (
                        <div key={dIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={doc}
                            onChange={(e) => handleUpdateRequestedDoc(dIdx, e.target.value)}
                            placeholder="e.g. Certified CTC of 2025 Mayor's Permit..."
                            className="flex-1 bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveRequestedDoc(dIdx)}
                            className="p-1.5 text-ink-3 hover:text-critical-fg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* If Correction Required or Not Accepted: Checkbox list of lines */}
              {(currentForm.outcome === 'correction_required' || currentForm.outcome === 'not_accepted') && (
                <div className="p-3.5 rounded-control bg-sheet-2/80 border border-rule space-y-2">
                  <span className="text-xs font-bold text-ink block">
                    Choose Checklist Line(s) Needing Correction:
                  </span>
                  <div className="space-y-1.5">
                    {currentItemDetail.lines.map((l) => (
                      <label key={l.id} className="flex items-center gap-2.5 text-xs text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentForm.affectedLines.includes(l.id)}
                          onChange={() => handleToggleAffectedLine(l.id)}
                          className="rounded text-stamp focus:ring-stamp"
                        />
                        <span className="font-semibold">{l.label}</span>
                        <span className="text-ink-3">({l.copyForm})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Next Action & Due Date */}
          <div className="space-y-3 pt-4 border-t border-rule">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
              Immediate Next Action
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-ink">Action Description</label>
                <input
                  type="text"
                  value={currentForm.nextActionText}
                  onChange={(e) => updateCurrentForm({ nextActionText: e.target.value })}
                  placeholder="e.g. Follow up on certified copy release..."
                  className="w-full bg-sheet-2 border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-ink">Due Date</label>
                <DateField
                  value={currentForm.nextActionDue}
                  onChange={(v) => updateCurrentForm({ nextActionDue: v || '' })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-ink">Who Acts Next?</label>
                <div className="flex rounded-control border border-rule overflow-hidden bg-sheet-2">
                  {(['client', 'operator', 'third_party'] as Supplier[]).map((sup) => (
                    <button
                      key={sup}
                      type="button"
                      onClick={() => updateCurrentForm({ nextActionOwner: sup })}
                      className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                        currentForm.nextActionOwner === sup
                          ? 'bg-stamp text-on-stamp font-bold'
                          : 'text-ink-3 hover:text-ink'
                      }`}
                    >
                      {SUPPLIER_LABELS[sup]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-ink">Window or Counter Officer</label>
                <input
                  type="text"
                  value={currentForm.windowOrOfficer}
                  onChange={(e) => updateCurrentForm({ windowOrOfficer: e.target.value })}
                  placeholder="e.g. Window 4 - Officer Santos"
                  className="w-full bg-sheet-2 border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
                />
              </div>
            </div>
          </div>

          {/* Evidence Upload (Camera / Document) */}
          <div className="space-y-2 pt-4 border-t border-rule">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                Counter Evidence / Stamped Copy
              </span>
              <button
                type="button"
                onClick={handleSimulateEvidenceUpload}
                className="text-xs font-bold text-stamp hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Take Photo / Upload</span>
              </button>
            </div>

            {currentForm.evidenceNames.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {currentForm.evidenceNames.map((name, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-good-bg text-good-fg border border-good-bd text-xs font-semibold"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>{name}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-3 italic">
                No receipt or stamped copy attached yet.
              </p>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-4 border-t border-rule">
            <span className="text-xs text-ink-3 font-mono">
              Item {activeItemIndex + 1} of {items.length}
            </span>
            <button
              type="button"
              onClick={handleSaveCurrentItem}
              className="px-4 py-2 rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong text-xs font-bold shadow-xs cursor-pointer"
            >
              Save Item Outcome
            </button>
          </div>
        </div>
      )}

      {/* Finish Visit Modal */}
      <ModalDialog
        open={isFinishModalOpen}
        onClose={() => setIsFinishModalOpen(false)}
        maxWidth="max-w-md"
        zIndex="z-modal"
        ariaLabel="Finish Office Trip"
        panelClassName="p-5 space-y-4"
      >
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-5 h-5 text-good-fg" />
                <h3 className="text-base font-bold text-ink font-sans">
                  Finish Office Trip
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-ink">Trip Ended At (Time)</label>
                <input
                  type="time"
                  value={finishedTime}
                  onChange={(e) => setFinishedTime(e.target.value)}
                  className="w-full bg-sheet border border-rule rounded-control px-3 py-2 text-ink text-xs focus:outline-none focus:border-stamp"
                />
              </div>

              <div className="space-y-2">
                <label className="font-bold text-ink block">Trip Out-of-Pocket Costs (₱)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-ink-3">Transport (₱)</span>
                    <input
                      type="number"
                      value={transportPeso}
                      placeholder="0"
                      onChange={(e) => setTransportPeso(e.target.value)}
                      className="w-full bg-sheet border border-rule rounded-control px-2 py-1.5 text-xs text-ink"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-ink-3">Parking (₱)</span>
                    <input
                      type="number"
                      value={parkingPeso}
                      placeholder="0"
                      onChange={(e) => setParkingPeso(e.target.value)}
                      className="w-full bg-sheet border border-rule rounded-control px-2 py-1.5 text-xs text-ink"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-ink-3">Other (₱)</span>
                    <input
                      type="number"
                      value={otherPeso}
                      placeholder="0"
                      onChange={(e) => setOtherPeso(e.target.value)}
                      className="w-full bg-sheet border border-rule rounded-control px-2 py-1.5 text-xs text-ink"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink">Cost Note (Optional)</label>
                <input
                  type="text"
                  value={costNote}
                  onChange={(e) => setCostNote(e.target.value)}
                  placeholder="e.g. Grab to RDO and meter parking"
                  className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-rule">
              <button
                type="button"
                onClick={() => setIsFinishModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-control bg-sheet border border-rule text-ink hover:bg-sheet-2 cursor-pointer"
              >
                Back to recording
              </button>
              <button
                type="button"
                onClick={handleFinishVisit}
                className="px-4 py-1.5 text-xs font-bold rounded-control bg-good-solid text-on-good hover:opacity-95 shadow-xs cursor-pointer"
              >
                Complete Visit
              </button>
            </div>
          </ModalDialog>
    </div>
  );
}
