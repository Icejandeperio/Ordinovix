import React from 'react';
import { useVisits } from '@/hooks/useData';
import { formatDate } from '@/lib/format';
import { MapPin, Plus, CheckCircle2, Lock, ArrowRight, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';

export function VisitsPage() {
  const { data, isLoading } = useVisits();
  const visits = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Office Visits</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Plan and prepare airtight trips to BIR RDOs, Authorized Agent Banks, and city halls
          </p>
        </div>
        <Link
          to="/visits/new"
          className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Plan Visit</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-24 bg-sheet-3 rounded-panel" />
          <div className="h-24 bg-sheet-3 rounded-panel" />
        </div>
      ) : visits.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3">
          <MapPin className="w-8 h-8 text-ink-3 mx-auto mb-2" />
          <p className="text-sm font-semibold text-ink">No planned office trips</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {visits.map(({ visit, itemCount, readyItemCount, isReady, blockingReasons }) => (
            <Link
              key={visit.id}
              to={`/visits/${visit.id}`}
              className="bg-sheet border border-rule rounded-panel p-5 space-y-3 hover:border-stamp-strong hover:shadow-xs transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rule pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-chip text-xs font-bold border ${
                      isReady
                        ? 'bg-good-bg text-good-fg border-good-bd'
                        : 'bg-critical-bg text-critical-fg border-critical-bd'
                    }`}
                  >
                    {isReady ? 'READY TO GO' : `NOT READY (${blockingReasons.length} BLOCKERS)`}
                  </span>
                  <span className="text-xs font-semibold text-ink">
                    {visit.officeName}
                  </span>
                </div>

                <div className="text-xs text-ink-3">
                  Planned: <strong>{formatDate(visit.plannedDate)}</strong> {visit.arriveBy && `(by ${visit.arriveBy})`}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-ink">{visit.purpose || 'Filing and submission trip'}</p>
                <p className="text-xs text-ink-3">
                  {readyItemCount} of {itemCount} items ready for counter submission
                </p>
                {!isReady && (
                  <ul className="text-xs text-critical-fg list-disc pl-4 space-y-0.5 pt-1">
                    {blockingReasons.slice(0, 2).map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-rule text-xs">
                <span className="text-ink-3 capitalize">Status: {visit.status}</span>
                <span className="text-stamp font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Prepare Trip Pack</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
