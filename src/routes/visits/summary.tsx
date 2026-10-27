import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVisit } from '@/hooks/useData';
import { formatDate, formatPeso } from '@/lib/format';
import { ReviewStamp } from '@/components/ui/stamp';
import { OUTCOME_META, OUTCOME_CAUSE_META } from '@/domain/labels';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  Building2,
  DollarSign,
  AlertTriangle,
  FileText,
  ArrowRight,
  Home,
} from 'lucide-react';

export function VisitSummaryPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const { data, isLoading } = useVisit(visitId || '');

  const startedAt = data?.visit.startedAt;
  const finishedAt = data?.visit.finishedAt;
  const allItems = data?.items;

  // Compute duration (hooks run before the loading return)
  const durationText = useMemo(() => {
    if (!startedAt || !finishedAt) return '1 h 30 min';
    const start = new Date(startedAt).getTime();
    const end = new Date(finishedAt).getTime();
    const diffMinutes = Math.max(1, Math.round((end - start) / (1000 * 60)));
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hours === 0) return `${mins} min`;
    return `${hours} h ${mins} min`;
  }, [startedAt, finishedAt]);

  // Compute repeat trips analysis
  const repeatAnalysis = useMemo(() => {
    let avoidableCount = 0;
    let unavoidableCount = 0;
    const avoidableCausesList: string[] = [];

    for (const item of allItems ?? []) {
      const outcome = item.item.outcome;
      if (
        outcome === 'more_documents_requested' ||
        outcome === 'correction_required' ||
        outcome === 'not_accepted' ||
        outcome === 'follow_up_required'
      ) {
        if (item.item.avoidable) {
          avoidableCount++;
          if (item.item.outcomeCause) {
            avoidableCausesList.push(OUTCOME_CAUSE_META[item.item.outcomeCause]?.label || item.item.outcomeCause);
          }
        } else {
          unavoidableCount++;
        }
      }
    }

    return {
      avoidableCount,
      unavoidableCount,
      primaryCause: avoidableCausesList[0],
    };
  }, [allItems]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-sheet-3 rounded" />
        <div className="h-48 bg-sheet-3 rounded-panel" />
      </div>
    );
  }

  const { visit, items, office } = data;

  // Compute costs total
  const costTotalCentavos =
    (visit.costs?.transport || 0) +
    (visit.costs?.parking || 0) +
    (visit.costs?.other || 0);

  const totalEvidenceCount = items.reduce(
    (acc, i) => acc + (i.item.evidenceDocumentIds?.length || 0),
    0
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/visits"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Visits</span>
        </Link>
        <span className="text-xs text-ink-3 font-mono">Completed Trip</span>
      </div>

      {/* Main Done Banner with ReviewStamp */}
      <div className="relative bg-sheet border border-rule rounded-panel p-6 shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-good-bg text-good-fg border border-good-bd">
                VISIT COMPLETED
              </span>
              <span className="text-xs text-ink-3 font-semibold">
                {formatDate(visit.plannedDate)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight font-sans">
              {visit.officeName}
            </h1>

            {office?.address && (
              <p className="text-xs text-ink-2 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-ink-3" />
                <span>{office.address}</span>
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-ink-3 pt-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-ink-2" />
                <span>Trip Duration: <strong>{durationText}</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-ink-2" />
                <span>Total Costs: <strong>{formatPeso(costTotalCentavos)}</strong></span>
              </span>
            </div>
          </div>

          {/* Large Done Stamp */}
          <div className="pt-2 sm:pt-0 self-center sm:self-auto">
            <ReviewStamp
              id={`done-summary-${visit.id}`}
              variant="done"
              date={formatDate(visit.plannedDate)}
              evidenceCount={totalEvidenceCount}
              animate={true}
            />
          </div>
        </div>

        {/* Repeat Trips Created Box */}
        <div className="mt-5 pt-4 border-t border-rule bg-sheet-2/60 -mx-6 -mb-6 p-5 rounded-b-panel border-b-0 space-y-1 text-xs">
          <div className="flex items-center gap-2 font-bold text-ink">
            <AlertTriangle className="w-4 h-4 text-warn-fg" />
            <span>Repeat Trips Analysis:</span>
          </div>
          <p className="text-ink-2">
            Repeat trips this visit created:{' '}
            <strong className={repeatAnalysis.avoidableCount > 0 ? 'text-critical-fg' : 'text-good-fg'}>
              {repeatAnalysis.avoidableCount} avoidable
            </strong>{' '}
            {repeatAnalysis.primaryCause && `(${repeatAnalysis.primaryCause})`},{' '}
            <strong>{repeatAnalysis.unavoidableCount} not avoidable</strong>.
          </p>
        </div>
      </div>

      {/* Outcome Per Item */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-tight text-ink uppercase">
          Outcome per Errand Item ({items.length})
        </h2>

        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {items.map(({ item, task, client }) => {
            const outcomeMeta = item.outcome ? OUTCOME_META[item.outcome] : null;
            const causeMeta = item.outcomeCause ? OUTCOME_CAUSE_META[item.outcomeCause] : null;

            return (
              <div key={item.id} className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-stamp bg-stamp-soft px-1.5 py-0.5 rounded">
                      {client.code}
                    </span>
                    <span className="text-sm font-bold text-ink">{client.displayName}</span>
                    <span className="text-ink-3">·</span>
                    <span className="text-xs text-ink-2">{task.title}</span>
                  </div>

                  {outcomeMeta && (
                    <span
                      className={`px-2 py-0.5 rounded-chip text-[11px] font-bold border ${
                        item.outcome === 'completed'
                          ? 'bg-good-bg text-good-fg border-good-bd'
                          : item.outcome === 'not_accepted'
                          ? 'bg-critical-bg text-critical-fg border-critical-bd'
                          : 'bg-sheet-2 text-ink border-rule'
                      }`}
                    >
                      {outcomeMeta.label}
                    </span>
                  )}
                </div>

                {/* Details on why / cause */}
                {causeMeta && (
                  <div className="text-xs text-ink-2 flex items-center gap-2">
                    <span className="font-semibold text-ink">Cause:</span>
                    <span>{causeMeta.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        item.avoidable ? 'bg-critical-bg text-critical-fg' : 'bg-sheet-3 text-ink-3'
                      }`}
                    >
                      {item.avoidable ? 'Avoidable defect' : 'Not avoidable'}
                    </span>
                  </div>
                )}

                {item.outcomeNote && (
                  <p className="text-xs text-ink-3 italic bg-sheet-2 p-2 rounded border border-rule">
                    "{item.outcomeNote}"
                  </p>
                )}

                {/* Next action created */}
                {item.nextAction && (
                  <div className="flex items-center justify-between bg-sheet-2/60 p-2.5 rounded border border-rule text-xs">
                    <div>
                      <span className="font-bold text-ink">Next Action: </span>
                      <span className="text-ink-2">{item.nextAction.text}</span>
                      {item.nextAction.due && (
                        <span className="text-ink-3 ml-2">(due {formatDate(item.nextAction.due)})</span>
                      )}
                    </div>
                    <Link
                      to={`/tasks/${task.id}`}
                      className="text-xs font-semibold text-stamp hover:underline"
                    >
                      Open Task
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Out of Pocket Costs Breakdown */}
      {costTotalCentavos > 0 && (
        <div className="bg-sheet border border-rule rounded-panel p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
            Trip Expense Breakdown
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-control bg-sheet-2 border border-rule">
              <span className="text-[11px] text-ink-3 block">Transport</span>
              <span className="text-sm font-bold text-ink">{formatPeso(visit.costs?.transport || 0)}</span>
            </div>
            <div className="p-3 rounded-control bg-sheet-2 border border-rule">
              <span className="text-[11px] text-ink-3 block">Parking</span>
              <span className="text-sm font-bold text-ink">{formatPeso(visit.costs?.parking || 0)}</span>
            </div>
            <div className="p-3 rounded-control bg-sheet-2 border border-rule">
              <span className="text-[11px] text-ink-3 block">Other</span>
              <span className="text-sm font-bold text-ink">{formatPeso(visit.costs?.other || 0)}</span>
            </div>
          </div>
          {visit.costs?.note && (
            <p className="text-xs text-ink-3 italic pt-1">Note: {visit.costs.note}</p>
          )}
        </div>
      )}

      {/* Action Footer Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Link
          to="/visits"
          className="px-4 py-2 rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Visits</span>
        </Link>
        <Link
          to="/"
          className="px-4 py-2 rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Back to Today</span>
        </Link>
      </div>
    </div>
  );
}
