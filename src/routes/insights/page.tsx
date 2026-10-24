import { useState } from 'react';
import { useInsights } from '@/hooks/useData';
import { BarChart3 } from 'lucide-react';
import type { InsightsTab, InsightsData } from '@/domain/types';

export function InsightsPage() {
  const [tab, setTab] = useState<InsightsTab>('overview');
  const { data, isLoading } = useInsights(tab);
  const overviewData = tab === 'overview' && data ? (data as InsightsData['overview']) : null;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Insights & Analytics</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Measure first-pass completion, avoid repeat trips, and track document chasing velocity
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-rule pb-2 overflow-x-auto">
        {(['overview', 'trips', 'chasing', 'deadlines', 'workload', 'clients'] as InsightsTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-chip capitalize transition-colors shrink-0 ${
              tab === t
                ? 'bg-stamp text-on-stamp'
                : 'bg-sheet text-ink-2 border border-rule hover:bg-sheet-2'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Insights Content */}
      {isLoading || !data ? (
        <div className="h-64 bg-sheet-3 rounded-panel animate-pulse" />
      ) : tab === 'overview' && overviewData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-sheet border border-rule rounded-panel p-5 space-y-1">
              <span className="text-xs font-medium text-ink-3 uppercase">First-Pass Completion</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-ink font-sans">{overviewData.firstPassRate}%</span>
                <span className="text-xs text-good-fg font-bold">&uarr; +9 pts</span>
              </div>
              <p className="text-[11px] text-ink-2">Self-reported baseline: ~55%</p>
            </div>

            <div className="bg-sheet border border-rule rounded-panel p-5 space-y-1">
              <span className="text-xs font-medium text-ink-3 uppercase">Avoidable Repeat Trips</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-ink font-sans">{overviewData.repeatTripRate}%</span>
                <span className="text-xs text-good-fg font-bold">&darr; Down from 4/mo</span>
              </div>
              <p className="text-[11px] text-ink-2">Prevented by pre-departure checklist checks</p>
            </div>

            <div className="bg-sheet border border-rule rounded-panel p-5 space-y-1">
              <span className="text-xs font-medium text-ink-3 uppercase">On-Time Filing Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-ink font-sans">{overviewData.onTimeFilingRate}%</span>
                <span className="text-xs text-good-fg font-bold">&uarr; On target</span>
              </div>
              <p className="text-[11px] text-ink-2">Returns submitted on or before BIR due date</p>
            </div>
          </div>

          <div className="bg-sheet border border-rule rounded-panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">First-Pass Completion Trend by Month</h3>
                <p className="text-xs text-ink-2">Takeaway: Repeat counter trips dropped significantly since implementing verified checklists.</p>
              </div>
            </div>

            {/* Visual Bar representation */}
            <div className="grid grid-cols-5 gap-3 pt-4 border-t border-rule text-center">
              {overviewData.monthlyTrends?.map((item) => (
                <div key={item.month} className="space-y-1">
                  <div className="h-28 bg-sheet-2 rounded-control flex items-end justify-center p-2">
                    <div
                      style={{ height: `${item.firstPassRate}%` }}
                      className="w-full bg-stamp rounded-t-xs transition-all flex items-start justify-center pt-1"
                    >
                      <span className="text-[10px] font-bold text-on-stamp">{item.firstPassRate}%</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-ink">{item.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3 space-y-2">
          <BarChart3 className="w-8 h-8 text-stamp mx-auto" />
          <h3 className="text-sm font-bold text-ink capitalize">{tab} Analytics View</h3>
          <p className="text-xs">Detailed trends, cause breakdowns, and performance filters for {tab}.</p>
        </div>
      )}
    </div>
  );
}
