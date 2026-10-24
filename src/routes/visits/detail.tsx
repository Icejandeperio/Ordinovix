import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVisit } from '@/hooks/useData';
import { formatDate } from '@/lib/format';
import { ArrowLeft, CheckCircle2, Lock, MapPin, Printer, Play, AlertTriangle } from 'lucide-react';
import { repositories } from '@/data';

export function VisitDetailPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const { data, isLoading } = useVisit(visitId || '');

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-sheet-3 rounded" />
        <div className="h-32 bg-sheet-3 rounded-panel" />
      </div>
    );
  }

  const { visit, office, items, readiness, packList: clientPacks, kitItems } = data;

  const handleTogglePack = async (ref: { lineId?: string; kitItemId?: string }, packed: boolean) => {
    await repositories.visits.setPacked(visit.id, ref, packed);
  };

  const handleStartVisit = async () => {
    if (!readiness.ready) {
      const reason = prompt('This visit is NOT fully ready. Enter mandatory departure override reason:');
      if (!reason || reason.trim().length < 10) {
        alert('A valid reason of at least 10 characters is required to leave with unresolved items.');
        return;
      }
      await repositories.visits.start(visit.id, reason);
      alert('Trip started with departure override.');
    } else {
      await repositories.visits.start(visit.id);
      alert('Trip started! Have a productive counter visit.');
    }
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/visits"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Visits</span>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-sheet border border-rule rounded-panel p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-chip text-xs font-bold border ${
                  readiness.ready
                    ? 'bg-good-bg text-good-fg border-good-bd'
                    : 'bg-critical-bg text-critical-fg border-critical-bd'
                }`}
              >
                {readiness.ready ? 'READY TO DEPART' : `NOT READY (${readiness.blockingItems.length} BLOCKERS)`}
              </span>
              <span className="text-xs text-ink-3">Planned: {formatDate(visit.plannedDate)}</span>
            </div>
            <h1 className="text-2xl font-bold text-ink tracking-tight font-sans">
              {visit.officeName}
            </h1>
            {office?.address && <p className="text-xs text-ink-2">{office.address}</p>}
            {office?.tips && <p className="text-xs text-warn-fg font-medium">Tips: {office.tips}</p>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleStartVisit}
              className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Trip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-tight text-ink uppercase">Counter Errand Items ({items.length})</h2>
        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {items.map(({ item, task, client, isReady, reasons }) => (
            <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink">{client.displayName}</span>
                  <span className="px-2 py-0.5 rounded-chip text-[10px] font-semibold bg-sheet-2 text-ink-2 border uppercase">
                    Action: {item.intendedAction}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-ink">{task.title}</h3>
                {!isReady && (
                  <ul className="text-xs text-critical-fg list-disc pl-4 space-y-0.5 pt-0.5">
                    {reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/tasks/${task.id}`}
                  className="px-2.5 py-1 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3"
                >
                  View Checklist
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Packing List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-tight text-ink uppercase">Physical Trip Pack Checklist</h2>
        <div className="bg-sheet border border-rule rounded-panel p-4 space-y-4 shadow-xs">
          {clientPacks.map((pack) => (
            <div key={pack.clientId} className="space-y-2">
              <h3 className="text-xs font-bold text-stamp uppercase tracking-wider">{pack.clientName}</h3>
              <div className="space-y-1.5 pl-2">
                {pack.items.map((pi, idx) => (
                  <label key={idx} className="flex items-center gap-2.5 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={pi.packed}
                      onChange={(e) => handleTogglePack({ lineId: pi.refId }, e.target.checked)}
                      className="rounded text-stamp focus:ring-stamp"
                    />
                    <span className="font-semibold">{pi.label}</span>
                    <span className="text-ink-3">({pi.form}, {pi.copies} copies)</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
