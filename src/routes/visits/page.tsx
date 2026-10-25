import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useVisits, useMemberships } from '@/hooks/useData';
import type { VisitStatus, OfficeType } from '@/domain/types';
import { formatDate } from '@/lib/format';
import { ReadinessMeter } from '@/components/ui/status-chip';
import { PlanVisitSheet } from '@/components/visits/plan-visit-sheet';
import {
  MapPin,
  Plus,
  ArrowRight,
  Clock,
  User as UserIcon,
  Building2,
  Landmark,
  Building,
  CheckCircle2,
  AlertTriangle,
  Search,
  CheckCheck,
} from 'lucide-react';

type VisitTab = 'upcoming' | 'done' | 'cancelled' | 'all';

function getOfficeIcon(type: OfficeType) {
  switch (type) {
    case 'rdo':
      return <Building2 className="w-4 h-4 text-stamp" />;
    case 'bank':
      return <Landmark className="w-4 h-4 text-stamp" />;
    case 'lgu':
      return <Building className="w-4 h-4 text-stamp" />;
    case 'sec':
      return <Building2 className="w-4 h-4 text-stamp" />;
    default:
      return <MapPin className="w-4 h-4 text-stamp" />;
  }
}

export function VisitsPage() {
  const { data, isLoading } = useVisits();
  const visits = data?.items || [];
  const { data: memberships = [] } = useMemberships();

  const [activeTab, setActiveTab] = useState<VisitTab>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlanSheetOpen, setIsPlanSheetOpen] = useState(false);

  // Grouped tab counts
  const counts = useMemo(() => {
    return {
      upcoming: visits.filter((v) => v.visit.status === 'planned' || v.visit.status === 'in_progress').length,
      done: visits.filter((v) => v.visit.status === 'done').length,
      cancelled: visits.filter((v) => v.visit.status === 'cancelled').length,
      all: visits.length,
    };
  }, [visits]);

  // Filtered visits
  const filteredVisits = useMemo(() => {
    return visits.filter(({ visit }) => {
      // Tab filter
      if (activeTab === 'upcoming' && visit.status !== 'planned' && visit.status !== 'in_progress') {
        return false;
      }
      if (activeTab === 'done' && visit.status !== 'done') {
        return false;
      }
      if (activeTab === 'cancelled' && visit.status !== 'cancelled') {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = visit.officeName.toLowerCase().includes(q);
        const matchPurpose = visit.purpose?.toLowerCase().includes(q);
        const matchRdo = visit.rdoCode?.toLowerCase().includes(q);
        if (!matchName && !matchPurpose && !matchRdo) return false;
      }

      return true;
    });
  }, [visits, activeTab, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Office Visits</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Plan, prepare, and record airtight trips to BIR RDOs, Authorized Agent Banks, and city halls
          </p>
        </div>
        <button
          onClick={() => setIsPlanSheetOpen(true)}
          className="px-3.5 py-2 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Plan a Visit</span>
        </button>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-rule pb-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors flex items-center gap-1.5 ${
              activeTab === 'upcoming'
                ? 'bg-sheet-3 text-ink shadow-2xs font-bold'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            <span>Upcoming</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'upcoming' ? 'bg-stamp text-on-stamp' : 'bg-sheet-2 text-ink-3'
              }`}
            >
              {counts.upcoming}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('done')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors flex items-center gap-1.5 ${
              activeTab === 'done'
                ? 'bg-sheet-3 text-ink shadow-2xs font-bold'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            <span>Done</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'done' ? 'bg-stamp text-on-stamp' : 'bg-sheet-2 text-ink-3'
              }`}
            >
              {counts.done}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cancelled')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors flex items-center gap-1.5 ${
              activeTab === 'cancelled'
                ? 'bg-sheet-3 text-ink shadow-2xs font-bold'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            <span>Cancelled</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'cancelled' ? 'bg-stamp text-on-stamp' : 'bg-sheet-2 text-ink-3'
              }`}
            >
              {counts.cancelled}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-sheet-3 text-ink shadow-2xs font-bold'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-stamp text-on-stamp' : 'bg-sheet-2 text-ink-3'
              }`}
            >
              {counts.all}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search office or purpose..."
            className="w-full bg-sheet border border-rule rounded-control pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-stamp"
          />
        </div>
      </div>

      {/* Main Content List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-28 bg-sheet-3 rounded-panel" />
          <div className="h-28 bg-sheet-3 rounded-panel" />
          <div className="h-28 bg-sheet-3 rounded-panel" />
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3 space-y-3">
          <MapPin className="w-9 h-9 text-ink-3 mx-auto opacity-70" />
          <div>
            <p className="text-sm font-bold text-ink">
              {searchQuery ? 'No visits match your search' : `No ${activeTab} visits`}
            </p>
            <p className="text-xs text-ink-2 mt-1">
              {searchQuery
                ? 'Try clearing the search term or switching tabs'
                : 'Plan your next tax office trip with counter-ready checklists and SPAs'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={() => setIsPlanSheetOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Plan an office visit</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredVisits.map(({ visit, itemCount, readyItemCount, isReady, blockingReasons }) => {
            const isDone = visit.status === 'done';
            const isInProgress = visit.status === 'in_progress';
            const isCancelled = visit.status === 'cancelled';
            const targetLink = isDone ? `/visits/${visit.id}/summary` : `/visits/${visit.id}`;

            return (
              <Link
                key={visit.id}
                to={targetLink}
                className="bg-sheet border border-rule rounded-panel p-5 space-y-4 hover:border-stamp-strong hover:shadow-xs transition-all group block"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-rule pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="p-1 rounded bg-sheet-2 border border-rule">
                      {getOfficeIcon(visit.officeType)}
                    </span>
                    <span className="text-sm font-bold text-ink">{visit.officeName}</span>
                    {visit.rdoCode && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sheet-2 text-ink-2 border border-rule">
                        RDO {visit.rdoCode}
                      </span>
                    )}

                    {/* Status badge */}
                    {isDone ? (
                      <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-sheet-2 text-ink-2 border border-rule flex items-center gap-1">
                        <CheckCheck className="w-3 h-3 text-good-fg" />
                        <span>DONE</span>
                      </span>
                    ) : isInProgress ? (
                      <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-stamp-soft text-stamp border border-stamp/20 animate-pulse">
                        IN PROGRESS
                      </span>
                    ) : isCancelled ? (
                      <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-critical-bg text-critical-fg border border-critical-bd">
                        CANCELLED
                      </span>
                    ) : isReady ? (
                      <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-good-bg text-good-fg border border-good-bd flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>READY TO GO</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-critical-bg text-critical-fg border border-critical-bd flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>NOT READY ({blockingReasons.length} BLOCKERS)</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-ink-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-ink-3" />
                      <span>{formatDate(visit.plannedDate)}</span>
                      {visit.arriveBy && <span className="font-medium text-ink-2">(arrive by {visit.arriveBy})</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5 text-ink-3" />
                      <span>{visit.assigneeUserId === 'user-ana' ? 'Ana' : 'Ben'}</span>
                    </span>
                  </div>
                </div>

                {/* Purpose and Readiness section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="md:col-span-2 space-y-2">
                    <h3 className="text-sm font-bold text-ink">
                      {visit.purpose || 'Filing and counter submission trip'}
                    </h3>

                    {/* Blocker breakdown when not ready */}
                    {!isReady && !isDone && !isCancelled && blockingReasons.length > 0 && (
                      <div className="p-2.5 rounded-control bg-critical-bg/40 border border-critical-bd/50 space-y-1">
                        <span className="text-[11px] font-bold text-critical-fg block">
                          Unresolved Counter Blockers:
                        </span>
                        <ul className="text-xs text-critical-fg list-disc pl-4 space-y-0.5">
                          {blockingReasons.slice(0, 3).map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                          {blockingReasons.length > 3 && (
                            <li className="list-none text-[11px] font-semibold text-critical-fg/80 pt-0.5">
                              +{blockingReasons.length - 3} more blockers
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {isDone && (
                      <p className="text-xs text-ink-2">
                        Trip completed with all counter outcomes logged and next actions queued.
                      </p>
                    )}

                    {isCancelled && visit.cancelledReason && (
                      <p className="text-xs text-critical-fg italic">Reason: {visit.cancelledReason}</p>
                    )}
                  </div>

                  {/* Readiness Meter */}
                  <div className="bg-sheet-2 border border-rule rounded-control p-3 space-y-1">
                    <ReadinessMeter
                      total={itemCount}
                      ready={readyItemCount}
                      label="Counter items ready"
                    />
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-rule text-xs">
                  <span className="text-ink-3">
                    {itemCount} errand task{itemCount !== 1 ? 's' : ''} in trip pack
                  </span>
                  <span className="text-stamp font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>{isDone ? 'View Visit Summary' : 'Prepare Trip Pack'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Plan Visit Sheet */}
      <PlanVisitSheet isOpen={isPlanSheetOpen} onClose={() => setIsPlanSheetOpen(false)} />
    </div>
  );
}
