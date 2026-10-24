import React from 'react';
import { useToday, useSetLineStatus } from '@/hooks/useData';
import { TASK_STATUS_META, LINE_STATUS_META } from '@/domain/labels';
import { formatDate, formatPeso } from '@/lib/format';
import { AlertCircle, Clock, CheckCircle2, Lock, ArrowRight, ShieldAlert, Stamp } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TodayPage() {
  const { data: queue, isLoading, error } = useToday();
  const setLineStatus = useSetLineStatus();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-sheet-3 rounded-control" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-24 bg-sheet-3 rounded-panel" />
          <div className="h-24 bg-sheet-3 rounded-panel" />
          <div className="h-24 bg-sheet-3 rounded-panel" />
        </div>
        <div className="h-64 bg-sheet-3 rounded-panel" />
      </div>
    );
  }

  if (error || !queue) {
    return (
      <div className="p-8 text-center bg-sheet rounded-panel border border-rule space-y-3">
        <AlertCircle className="w-10 h-10 text-critical-solid mx-auto" />
        <h3 className="text-base font-bold text-ink">Failed to load Today queue</h3>
        <p className="text-xs text-ink-3">Check simulated network settings or dev menu.</p>
      </div>
    );
  }

  const { overdueTasks, dueTodayTasks, dueSoonTasks, reviewRequiredLines, visitsToday, kpiStats } = queue;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Today's Focus</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            {formatDate(queue.focusDate)} · Manage immediate deadlines, document reviews, and counter visits
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/visits"
            className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5"
          >
            <span>Plan Office Trip</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-sheet border border-rule rounded-panel p-4 space-y-1">
          <span className="text-xs font-medium text-ink-3 uppercase tracking-wider">First-Pass Completion</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink font-sans">{kpiStats.firstPassRate}%</span>
            <span className="text-xs text-good-fg font-semibold">Target: &ge;85%</span>
          </div>
          <p className="text-[11px] text-ink-2">Completed visits on initial attempt</p>
        </div>

        <div className="bg-sheet border border-rule rounded-panel p-4 space-y-1">
          <span className="text-xs font-medium text-ink-3 uppercase tracking-wider">Actionable Open Tasks</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-ink font-sans">{kpiStats.openTasksCount}</span>
            <span className="text-xs text-ink-3">in progress</span>
          </div>
          <p className="text-[11px] text-ink-2">Across all active filing periods</p>
        </div>

        <div className="bg-sheet border border-rule rounded-panel p-4 space-y-1">
          <span className="text-xs font-medium text-ink-3 uppercase tracking-wider">Blocked Filing Tasks</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold font-sans ${kpiStats.blockedCount > 0 ? 'text-serious-solid' : 'text-good-fg'}`}>
              {kpiStats.blockedCount}
            </span>
            <span className="text-xs text-ink-3">awaiting items</span>
          </div>
          <p className="text-[11px] text-ink-2">Tasks requiring client or review action</p>
        </div>
      </div>

      {/* Immediate Attention: Overdue & Due Today */}
      {(overdueTasks.length > 0 || dueTodayTasks.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-critical-solid" />
            <h2 className="text-sm font-bold tracking-tight text-ink uppercase">Urgent Filings</h2>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {overdueTasks.map((t) => (
              <div
                key={t.task.id}
                className="bg-sheet border border-critical-bd rounded-panel p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-critical-bg text-critical-fg border border-critical-bd">
                      OVERDUE
                    </span>
                    <span className="text-xs font-bold text-ink">{t.client.displayName}</span>
                    <span className="text-xs text-ink-3">({t.client.code})</span>
                  </div>
                  <div className="text-sm font-semibold text-ink">{t.task.title || 'Filing Task'}</div>
                  {t.blockingReason && (
                    <div className="text-xs text-serious-fg font-medium flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{t.blockingReason}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-critical-fg">Due {formatDate(t.task.dueDate)}</span>
                  <Link
                    to={`/tasks/${t.task.id}`}
                    className="px-3 py-1 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3"
                  >
                    View Task
                  </Link>
                </div>
              </div>
            ))}

            {dueTodayTasks.map((t) => (
              <div
                key={t.task.id}
                className="bg-sheet border border-warn-bd rounded-panel p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-warn-bg text-warn-fg border border-warn-bd">
                      DUE TODAY
                    </span>
                    <span className="text-xs font-bold text-ink">{t.client.displayName}</span>
                  </div>
                  <div className="text-sm font-semibold text-ink">{t.task.title || 'Filing Task'}</div>
                  {t.blockingReason && (
                    <div className="text-xs text-serious-fg font-medium flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{t.blockingReason}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/tasks/${t.task.id}`}
                    className="px-3 py-1 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong"
                  >
                    Take Action
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents Awaiting Verification ("Received is not accepted") */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stamp className="w-4 h-4 text-stamp" />
            <h2 className="text-sm font-bold tracking-tight text-ink uppercase">
              Received Documents Requiring Review ({reviewRequiredLines.length})
            </h2>
          </div>
          <span className="text-xs text-ink-3">Received &ne; Accepted</span>
        </div>

        {reviewRequiredLines.length === 0 ? (
          <div className="p-6 text-center bg-sheet border border-rule rounded-panel">
            <CheckCircle2 className="w-8 h-8 text-good-fg mx-auto mb-2" />
            <p className="text-xs font-semibold text-ink">All received client documents have been reviewed.</p>
          </div>
        ) : (
          <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule">
            {reviewRequiredLines.map(({ line, task, client }) => (
              <div key={line.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sheet-2 transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-chip text-[10px] font-semibold bg-warn-bg text-warn-fg border border-warn-bd">
                      Needs Review
                    </span>
                    <span className="text-xs font-bold text-ink">{client.displayName}</span>
                    <span className="text-xs text-ink-3">· {task.title}</span>
                  </div>
                  <div className="text-sm font-semibold text-ink">{line.label}</div>
                  <div className="text-[11px] text-ink-3">
                    Form: {line.copyForm} · Copies: {line.copies || 1} · Received: {formatDate(line.receivedAt)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setLineStatus.mutate({ id: line.id, to: 'accepted', extra: { note: 'Verified by operator' } });
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-control bg-good-solid text-on-good-solid hover:opacity-90 flex items-center gap-1 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept (Stamp)</span>
                  </button>
                  <button
                    onClick={() => {
                      const note = prompt('Enter correction note for client:');
                      if (note) {
                        setLineStatus.mutate({ id: line.id, to: 'needs_correction', extra: { note } });
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-serious-fg hover:bg-sheet-3"
                  >
                    Flag Issue
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Planned Visits for Today */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-stamp" />
            <h2 className="text-sm font-bold tracking-tight text-ink uppercase">Tax Office Visits Today</h2>
          </div>
          <Link to="/visits" className="text-xs text-stamp hover:underline font-semibold">
            All visits &rarr;
          </Link>
        </div>

        {visitsToday.length === 0 ? (
          <div className="p-6 text-center bg-sheet border border-rule rounded-panel text-xs text-ink-3">
            No office visits scheduled for today.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {visitsToday.map((v) => (
              <div
                key={v.visit.id}
                className="bg-sheet border border-rule rounded-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-chip text-[11px] font-bold border ${
                        v.isReady
                          ? 'bg-good-bg text-good-fg border-good-bd'
                          : 'bg-critical-bg text-critical-fg border-critical-bd'
                      }`}
                    >
                      {v.isReady ? 'READY TO DEPART' : `NOT READY (${v.blockingReasons.length} BLOCKERS)`}
                    </span>
                    <span className="text-xs text-ink-3">{v.visit.arriveBy ? `Arrive by ${v.visit.arriveBy}` : 'Anytime'}</span>
                  </div>
                  <h3 className="text-sm font-bold text-ink">{v.visit.officeName}</h3>
                  <p className="text-xs text-ink-2">{v.visit.purpose || 'Filing and counter errand'}</p>
                  {!v.isReady && (
                    <ul className="text-xs text-critical-fg list-disc pl-4 space-y-0.5 pt-1">
                      {v.blockingReasons.slice(0, 2).map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/visits/${v.visit.id}`}
                    className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong"
                  >
                    Open Trip Pack
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
