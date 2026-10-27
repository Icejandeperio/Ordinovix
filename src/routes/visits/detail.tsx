import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useVisit,
  useSetVisitPacked,
  useStartVisit,
  useUpdateVisit,
} from '@/hooks/useData';
import { formatDate } from '@/lib/format';
import { ReadinessMeter } from '@/components/ui/status-chip';
import { ReviewStamp } from '@/components/ui/stamp';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { repositories } from '@/data';
import {
  ArrowLeft,
  MapPin,
  Printer,
  Play,
  Lock,
  Clock,
  User as UserIcon,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Briefcase,
  HelpCircle,
  Save,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { QueryState } from '@/components/ui/query-state';

export function VisitDetailPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useVisit(visitId || '');

  const setPackedMutation = useSetVisitPacked();
  const startVisitMutation = useStartVisit();
  const updateVisitMutation = useUpdateVisit();

  // State for Departure Override Dialog
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');

  // Questions to raise edited state per item
  const [itemQuestions, setItemQuestions] = useState<Record<string, string>>({});

  if (isError) {
    return <QueryState isLoading={false} isError error={error} onRetry={() => refetch()} subject="this visit">{null}</QueryState>;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-sheet-3 rounded" />
        <div className="h-32 bg-sheet-3 rounded-panel" />
        <div className="h-64 bg-sheet-3 rounded-panel" />
      </div>
    );
  }

  const { visit, office, items, readiness, packList: clientPacks, kitItems } = data;

  // Calculate total packed items vs total physical items
  const totalPhysicalItems =
    clientPacks.reduce((acc, p) => acc + p.items.length, 0) + kitItems.length;
  const packedCount =
    clientPacks.reduce(
      (acc, p) => acc + p.items.filter((i) => i.packed).length,
      0
    ) + kitItems.filter((k) => k.packed).length;

  const handleTogglePack = (ref: { lineId?: string; kitItemId?: string }, packed: boolean) => {
    setPackedMutation.mutate({
      visitId: visit.id,
      ref,
      packed,
    });
  };

  const handleSaveQuestions = async (itemId: string) => {
    const questions = itemQuestions[itemId];
    if (questions === undefined) return;
    try {
      await repositories.visits.updateItem(itemId, { questions });
      toast.success('Questions saved');
    } catch (err: any) {
      toast.error('Failed to save questions');
    }
  };

  const handleStartTripClick = () => {
    if (visit.status === 'in_progress') {
      navigate(`/visits/${visit.id}/record`);
      return;
    }
    if (visit.status === 'done') {
      navigate(`/visits/${visit.id}/summary`);
      return;
    }

    if (!readiness.ready) {
      setOverrideReason('');
      setOverrideError('');
      setIsOverrideModalOpen(true);
    } else {
      executeStartTrip();
    }
  };

  const executeStartTrip = async (leaveReason?: string) => {
    try {
      await startVisitMutation.mutateAsync({
        id: visit.id,
        leaveAnywayReason: leaveReason,
      });
      toast.success(leaveReason ? 'Trip started with departure override' : 'Trip started! Have a productive counter visit');
      navigate(`/visits/${visit.id}/record`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start trip');
    }
  };

  const handleConfirmOverride = () => {
    if (overrideReason.trim().length < 10) {
      setOverrideError('A valid reason of at least 10 characters is mandatory to leave with unresolved items.');
      return;
    }
    setIsOverrideModalOpen(false);
    executeStartTrip(overrideReason.trim());
  };

  const isDone = visit.status === 'done';
  const isInProgress = visit.status === 'in_progress';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/visits"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Visits</span>
        </Link>
        <span className="text-xs text-ink-3 font-mono">Visit ID: {visit.id}</span>
      </div>

      {/* Main Header Card with Ready Stamp */}
      <div className="relative bg-sheet border border-rule rounded-panel p-5 sm:p-6 shadow-xs overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-sheet-2 text-ink-2 border border-rule uppercase">
                {visit.officeType}
              </span>
              {visit.rdoCode && (
                <span className="px-2 py-0.5 rounded-chip text-[11px] font-mono font-bold bg-sheet-2 text-ink-2 border border-rule">
                  RDO {visit.rdoCode}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-ink-3 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>Planned: {formatDate(visit.plannedDate)}</span>
                {visit.arriveBy && <span>(arrive by {visit.arriveBy})</span>}
              </span>
              <span className="flex items-center gap-1 text-xs text-ink-3 font-semibold">
                <UserIcon className="w-3.5 h-3.5" />
                <span>{visit.assigneeUserId === 'user-ana' ? 'Ana' : 'Ben'}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight font-sans">
              {visit.officeName}
            </h1>

            {office?.address && (
              <p className="text-xs text-ink-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                <span>{office.address}</span>
                {office.mapUrl && (
                  <a
                    href={office.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-stamp hover:underline inline-flex items-center gap-0.5 font-semibold ml-1"
                  >
                    <span>Open in Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </p>
            )}

            {office?.tips && (
              <div className="p-3 rounded-control bg-warn-bg/50 border border-warn-bd text-xs text-warn-fg">
                <span className="font-bold text-ink block mb-0.5">Operator Counter Tip:</span>
                {office.tips}
              </div>
            )}
          </div>

          {/* Header Action Buttons & Stamp */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Link
                to={`/visits/${visit.id}/print`}
                className="px-3.5 py-2 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Trip Pack</span>
              </Link>

              <button
                onClick={handleStartTripClick}
                className="px-4 py-2 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {isDone
                    ? 'View Summary'
                    : isInProgress
                    ? 'Continue Recording'
                    : 'Start Trip'}
                </span>
              </button>
            </div>

            {/* Stamp display if 100% ready */}
            {readiness.ready && !isDone && (
              <div className="pt-2">
                <ReviewStamp
                  id={`ready-${visit.id}`}
                  variant="ready"
                  office={visit.rdoCode ? `RDO ${visit.rdoCode}` : visit.officeName.slice(0, 10)}
                  date={formatDate(visit.plannedDate)}
                  animate={true}
                />
              </div>
            )}

            {isDone && (
              <div className="pt-2">
                <ReviewStamp
                  id={`done-${visit.id}`}
                  variant="done"
                  date={formatDate(visit.plannedDate)}
                  evidenceCount={items.reduce((acc, i) => acc + (i.item.evidenceDocumentIds?.length || 0), 0)}
                  animate={false}
                />
              </div>
            )}
          </div>
        </div>

        {/* Readiness Bar in Header */}
        <div className="mt-5 pt-4 border-t border-rule grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <ReadinessMeter
              total={readiness.total}
              ready={readiness.readyCount}
              label="Counter Errand Readiness"
            />
          </div>
          <div className="text-right text-xs">
            {readiness.ready ? (
              <span className="font-bold text-good-fg inline-flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>All documents accepted and valid authorizations confirmed</span>
              </span>
            ) : (
              <span className="font-bold text-critical-fg inline-flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                <span>{readiness.blockingItems.length} task(s) currently blocked from departure</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Blocking Items Breakdown (If Not Ready) */}
      {!readiness.ready && readiness.blockingItems.length > 0 && (
        <div className="bg-critical-bg/40 border border-critical-bd rounded-panel p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-critical-fg">
            <Lock className="w-4 h-4" />
            <h2 className="text-sm font-bold tracking-tight uppercase">
              Not Ready — {readiness.blockingItems.length} Blocking Issue{readiness.blockingItems.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <p className="text-xs text-critical-fg">
            Ordinovix refuses to call a trip ready until every line has been reviewed and accepted, and valid authorizations are on hand.
          </p>
          <div className="space-y-2 pt-1">
            {readiness.blockingItems.map((blocker, idx) => (
              <div
                key={idx}
                className="bg-sheet/80 border border-critical-bd/40 rounded-control p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1">
                  <span className="font-bold text-ink">{blocker.clientName}</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-critical-fg font-medium">
                    {blocker.reasons.map((r, rIdx) => (
                      <li key={rIdx}>{r}</li>
                    ))}
                  </ul>
                </div>
                <Link
                  to={`/tasks/${blocker.taskId}`}
                  className="px-2.5 py-1 text-xs font-semibold rounded-control bg-sheet border border-rule text-ink hover:bg-sheet-3 self-start sm:self-auto shrink-0"
                >
                  Open Task Checklist
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counter Errand Items Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-ink uppercase flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-stamp" />
            <span>Counter Errand Items ({items.length})</span>
          </h2>
        </div>

        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {items.map(({ item, task, client, lines, isReady, reasons }) => {
            const currentQuestions =
              itemQuestions[item.id] !== undefined
                ? itemQuestions[item.id]
                : item.questions || '';

            return (
              <div key={item.id} className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black px-1.5 py-0.5 rounded bg-stamp-soft text-stamp font-mono">
                      {client.code}
                    </span>
                    <span className="text-sm font-bold text-ink">{client.displayName}</span>
                    <span className="text-ink-3">·</span>
                    <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-sheet-2 text-ink-2 border border-rule uppercase">
                      Action: {item.intendedAction}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-chip text-[10px] font-bold border ${
                        isReady
                          ? 'bg-good-bg text-good-fg border-good-bd'
                          : 'bg-critical-bg text-critical-fg border-critical-bd'
                      }`}
                    >
                      {isReady ? 'READY' : 'BLOCKED'}
                    </span>
                    <Link
                      to={`/tasks/${task.id}`}
                      className="px-2.5 py-1 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3"
                    >
                      View Task
                    </Link>
                  </div>
                </div>

                <div className="text-xs text-ink font-semibold">
                  <span>Task: </span>
                  <span className="font-bold text-ink">{task.title || 'Tax filing errand'}</span>
                </div>

                {/* Readiness reasons or blockers */}
                {!isReady && reasons.length > 0 && (
                  <ul className="text-xs text-critical-fg list-disc pl-4 space-y-0.5">
                    {reasons.map((r, rIdx) => (
                      <li key={rIdx}>{r}</li>
                    ))}
                  </ul>
                )}

                {/* Questions to raise at counter */}
                <div className="pt-2 space-y-1.5">
                  <label className="text-[11px] font-bold text-ink-2 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-ink-3" />
                    <span>Questions or specific matters to raise with the counter officer:</span>
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      value={currentQuestions}
                      onChange={(e) =>
                        setItemQuestions({
                          ...itemQuestions,
                          [item.id]: e.target.value,
                        })
                      }
                      placeholder="e.g. Inquire on missing assessment notice or check on certified copy endorsement..."
                      className="w-full bg-sheet-2 border border-rule rounded-control p-2 text-xs text-ink focus:outline-none focus:border-stamp"
                    />
                    {itemQuestions[item.id] !== undefined &&
                      itemQuestions[item.id] !== (item.questions || '') && (
                        <button
                          onClick={() => handleSaveQuestions(item.id)}
                          className="px-3 py-1.5 rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong text-xs font-semibold self-end flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Physical Trip Pack Checklist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-ink uppercase flex items-center gap-2">
              <FileText className="w-4 h-4 text-stamp" />
              <span>Physical Trip Pack Checklist</span>
            </h2>
            <p className="text-xs text-ink-3">
              Only physical documents (Original, Certified copy, Photocopy) and print-marked items to pack in brown envelopes
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-chip text-xs font-bold bg-sheet-2 border border-rule text-ink tabular-nums">
            Packed {packedCount} of {totalPhysicalItems}
          </span>
        </div>

        <div className="bg-sheet border border-rule rounded-panel p-5 space-y-5 shadow-xs">
          {clientPacks.map((pack) => (
            <div
              key={pack.clientId}
              className="border border-rule rounded-control p-4 space-y-3 bg-sheet-2/40"
            >
              <div className="flex items-center justify-between border-b border-rule pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-stamp" />
                  <h3 className="text-xs font-bold text-stamp uppercase tracking-wider">
                    {pack.clientName} Folder Tab
                  </h3>
                </div>
                <span className="text-[11px] text-ink-3">
                  {pack.items.length} document item{pack.items.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2 pl-1">
                {pack.items.map((pi, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-3 text-xs text-ink cursor-pointer hover:bg-sheet-3/50 p-1.5 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={pi.packed}
                      onChange={(e) =>
                        handleTogglePack({ lineId: pi.refId }, e.target.checked)
                      }
                      className="w-4 h-4 rounded text-stamp focus:ring-stamp cursor-pointer"
                    />
                    <span className={`font-semibold ${pi.packed ? 'line-through text-ink-3' : 'text-ink'}`}>
                      {pi.label}
                    </span>
                    <span className="text-ink-3">
                      ({pi.form.replace(/_/g, ' ')}, {pi.copies} {pi.copies === 1 ? 'copy' : 'copies'})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Visit Kit Items */}
          <div className="border border-rule rounded-control p-4 space-y-3 bg-sheet-2/40">
            <div className="flex items-center justify-between border-b border-rule pb-2">
              <h3 className="text-xs font-bold text-ink-2 uppercase tracking-wider">
                Visit Kit — Always Bring to Counter
              </h3>
              <span className="text-[11px] text-ink-3">from Settings · Visit Kit</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
              {kitItems.map((k) => (
                <label
                  key={k.kitItem.id}
                  className="flex items-center gap-3 text-xs text-ink cursor-pointer hover:bg-sheet-3/50 p-1.5 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={k.packed}
                    onChange={(e) =>
                      handleTogglePack({ kitItemId: k.kitItem.id }, e.target.checked)
                    }
                    className="w-4 h-4 rounded text-stamp focus:ring-stamp cursor-pointer"
                  />
                  <span className={`font-semibold ${k.packed ? 'line-through text-ink-3' : 'text-ink'}`}>
                    {k.kitItem.label}
                  </span>
                  {k.kitItem.note && (
                    <span className="text-[10px] text-ink-3 italic">({k.kitItem.note})</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Departure Override Reason Modal */}
      <ModalDialog
        open={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        maxWidth="max-w-md"
        zIndex="z-modal"
        ariaLabel="Leave Without Everything Ready?"
        panelClassName="p-5 space-y-4"
      >
            <div className="flex items-center gap-2 text-critical-fg border-b border-rule pb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-ink font-sans">
                Leave Without Everything Ready?
              </h3>
            </div>

            <div className="space-y-2 text-xs text-ink-2">
              <p>
                This trip has <strong>{readiness.blockingItems.length} unresolved blocker(s)</strong>. Ordinovix requires an explicit audit justification before departing with incomplete items.
              </p>
              <p className="font-semibold text-critical-fg">
                The reason will be permanently recorded in the audit trail and factored into Insights repeat trip metrics.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">
                Mandatory Departure Reason (at least 10 characters):
              </label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={(e) => {
                  setOverrideReason(e.target.value);
                  if (overrideError) setOverrideError('');
                }}
                placeholder="e.g. Officer agreed to preliminary intake while client is delivering notarized SPA to window..."
                className="w-full bg-sheet border border-rule rounded-control p-2.5 text-xs text-ink focus:outline-none focus:border-stamp"
              />
              {overrideError && (
                <p className="text-[11px] font-semibold text-critical-fg">{overrideError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-rule">
              <button
                type="button"
                onClick={() => setIsOverrideModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-control bg-sheet border border-rule text-ink hover:bg-sheet-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOverride}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-control bg-critical-solid text-on-critical hover:opacity-95 shadow-xs cursor-pointer"
              >
                Depart Anyway
              </button>
            </div>
          </ModalDialog>
    </div>
  );
}
