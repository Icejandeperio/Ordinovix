import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, Filter, ChevronRight } from 'lucide-react';
import { useInsights, useClients, useTemplates, useSession, useMemberships } from '@/hooks/useData';
import { Select } from '@/components/ui/select';
import { ChartFrame } from '@/components/insights/chart-frame';
import {
  SvgLineChart,
  SvgBarChart,
  SvgStackedBarChart,
  SvgHorizontalBarChart,
  SvgHeatCalendar,
} from '@/components/insights/svg-charts';
import type { InsightsData, InsightsKpi, InsightsMonthPoint, InsightsTab } from '@/domain/types';
import { monthLabel, presetRange, type RangePreset } from '@/domain/metrics';
import { formatDate, todayInManila } from '@/lib/dates';
import { QueryState } from '@/components/ui/query-state';

const TABS: InsightsTab[] = ['overview', 'trips', 'chasing', 'deadlines', 'workload', 'clients'];
const RANGES: RangePreset[] = ['last_6_months', 'last_quarter', 'ytd'];
const PERSON_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

function rangeLabel(preset: RangePreset, today: string): string {
  const { from, to } = presetRange(preset, today);
  const year = to.slice(0, 4);
  if (preset === 'ytd') return `Year to Date (${year})`;
  const span = `${monthLabel(from.slice(0, 7))}–${monthLabel(to.slice(0, 7))} ${year}`;
  return preset === 'last_quarter' ? `Last Quarter (${span})` : `Last 6 Months (${span})`;
}

// Chart and table inputs, from the computed series
const linePoints = (series: InsightsMonthPoint[]) =>
  series.filter((p) => p.value !== null).map((p) => ({ x: monthLabel(p.month), y: p.value as number }));
const seriesRows = (series: InsightsMonthPoint[], fmt: (v: number) => string | number = (v) => v): Array<Array<string | number>> =>
  series.map((p) => [monthLabel(p.month), p.value === null ? '—' : fmt(p.value)]);
const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;
const sentenceCase = (code: string) => {
  const text = code.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const duration = (minutes: number | null) => {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`;
};

export function InsightsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: session } = useSession();
  const isOwner = session?.membership?.role === 'owner';
  const today = todayInManila();

  // Filters live in the URL so a view can be shared and survives a reload
  const tab = TABS.find((t) => t === params.get('tab')) ?? 'overview';
  const preset = RANGES.find((r) => r === params.get('range')) ?? 'last_6_months';
  const ownerFilter = isOwner ? params.get('owner') ?? 'all' : 'all';
  const clientFilter = params.get('client') ?? 'all';
  const templateFilter = params.get('template') ?? 'all';

  const setParam = (key: string, value: string, fallback: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const { data: clientsData } = useClients();
  const { data: templatesData } = useTemplates();
  const { data: memberships } = useMemberships(Boolean(isOwner));

  const range = presetRange(preset, today);
  const filters = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      clientId: clientFilter !== 'all' ? clientFilter : undefined,
      assignedUserId: ownerFilter !== 'all' ? ownerFilter : undefined,
      templateId: templateFilter !== 'all' ? templateFilter : undefined,
    }),
    [range.from, range.to, clientFilter, ownerFilter, templateFilter],
  );
  const query = useInsights(tab, filters);

  const clients = clientsData?.items?.map((i) => i.client) || [];
  const templates = templatesData || [];
  const people = (memberships ?? []).filter((m) => m.userId && m.active);
  const data = query.data as unknown;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--rule)] pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)] font-sans">
            Insights & Operations
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-2)] mt-0.5">
            Measure first-pass completion, prevent avoidable repeat trips, and monitor filing velocity against baseline.
          </p>
        </div>
      </div>

      {/* Filter Row (Section 13.2) */}
      <div className="p-3 rounded-panel bg-[var(--sheet)] border border-[var(--rule)] shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-[var(--ink-3)] font-semibold uppercase tracking-wider text-[11px] mr-1">
          <Filter className="w-3.5 h-3.5 text-[var(--stamp)]" />
          <span>Filters:</span>
        </div>

        {/* Date Range */}
        <Select value={preset} onChange={(v) => setParam('range', v, 'last_6_months')} className="w-auto">
          {RANGES.map((r) => (
            <option key={r} value={r}>
              {rangeLabel(r, today)}
            </option>
          ))}
        </Select>

        {/* Owner switcher (Owner only) */}
        {isOwner && (
          <Select value={ownerFilter} onChange={(v) => setParam('owner', v, 'all')} className="w-auto">
            <option value="all">Assignee: Everyone</option>
            {people.map((m) => (
              <option key={m.id} value={m.userId}>
                {`${m.name ?? m.email} (${m.role === 'owner' ? 'Owner' : 'Helper'})`}
              </option>
            ))}
          </Select>
        )}

        {/* Client filter */}
        <Select value={clientFilter} onChange={(v) => setParam('client', v, 'all')} className="max-w-[220px]">
          <option value="all">Client: All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {`${c.code} — ${c.displayName}`}
            </option>
          ))}
        </Select>

        {/* Template filter */}
        <Select value={templateFilter} onChange={(v) => setParam('template', v, 'all')} className="max-w-[220px]">
          <option value="all">Template: All Templates</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {`${t.code} — ${t.name}`}
            </option>
          ))}
        </Select>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-1.5 border-b border-[var(--rule)] pb-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setParam('tab', t, 'overview')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-chip capitalize transition-colors shrink-0 cursor-pointer ${
              tab === t
                ? 'bg-[var(--stamp)] text-[var(--on-stamp)]'
                : 'bg-[var(--sheet)] text-[var(--ink-2)] border border-[var(--rule)] hover:bg-[var(--sheet-2)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        subject="insights"
        loading={
          <div className="relative h-72 rounded-panel flex items-center justify-center text-xs text-[var(--ink-2)]">
            <span aria-hidden className="absolute inset-0 rounded-panel bg-[var(--sheet-2)] animate-pulse" />
            <span className="relative">Loading metrics and computing aggregations...</span>
          </div>
        }
        isEmpty={Boolean((data as { isEmpty?: boolean } | undefined)?.isEmpty)}
        empty={
          <div className="p-10 text-center rounded-panel border border-[var(--rule)] bg-[var(--sheet)] text-sm text-[var(--ink-3)]">
            Not enough data yet for these filters. Record visits and finish tasks, or widen the date range.
          </div>
        }
      >
        {!data ? null : (
          <div aria-busy={query.isPlaceholderData} className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {tab === 'overview' ? (
              <OverviewTabContent data={data as InsightsData['overview']} />
            ) : tab === 'trips' ? (
              <TripsTabContent data={data as InsightsData['trips']} />
            ) : tab === 'chasing' ? (
              <ChasingTabContent data={data as InsightsData['chasing']} />
            ) : tab === 'deadlines' ? (
              <DeadlinesTabContent data={data as InsightsData['deadlines']} navigate={navigate} />
            ) : tab === 'workload' ? (
              <WorkloadTabContent data={data as InsightsData['workload']} navigate={navigate} />
            ) : (
              <ClientsTabContent data={data as InsightsData['clients']} navigate={navigate} />
            )}
          </div>
        )}
      </QueryState>
    </div>
  );
}

function TablePanel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--ink)]">{title}</h3>
          <p className="text-xs text-[var(--ink-2)]">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const TH = 'px-4 py-2.5';
const THEAD = 'bg-[var(--sheet-2)] text-[var(--ink-3)] uppercase font-semibold text-[10px] tracking-wider border-b border-[var(--rule)]';

function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-6 text-center text-[var(--ink-3)]">
        {children}
      </td>
    </tr>
  );
}

// =========================================================================
// 1. OVERVIEW TAB
// =========================================================================
function KpiTile({ kpi }: { kpi: InsightsKpi }) {
  const tone = kpi.improved === null ? 'text-[var(--ink-3)]' : kpi.improved ? 'text-[var(--good-fg)]' : 'text-[var(--serious-fg)]';
  const Icon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;
  return (
    <div className="p-4 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-1.5 min-w-0 overflow-hidden">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] truncate">{kpi.title}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-3xl font-extrabold text-[var(--ink)] font-sans tabular-nums">{kpi.value}</span>
        <div className="flex items-center gap-1 text-xs text-[var(--ink-2)]">
          {kpi.trend !== 'none' && <Icon className={`w-3.5 h-3.5 ${tone}`} />}
          <span>{kpi.comparison}</span>
        </div>
      </div>
      <p className="text-[11px] text-[var(--ink-3)] truncate">{kpi.note}</p>
    </div>
  );
}

function OverviewTabContent({ data }: { data: InsightsData['overview'] }) {
  const firstPass = linePoints(data.firstPassByMonth);
  const confidence = linePoints(data.confidenceByMonth);
  const hours = linePoints(data.hoursFindingByMonth);
  const tripsStacked = data.tripsByMonth.map((t) => ({
    category: monthLabel(t.month),
    segments: [
      { label: 'Avoidable', value: t.avoidable, color: 'var(--series-1)' },
      { label: 'Not avoidable', value: t.notAvoidable, color: 'var(--series-2)' },
    ],
  }));

  return (
    <div className="space-y-6">
      {/* 6 KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.kpis.map((kpi) => (
          <KpiTile key={kpi.key} kpi={kpi} />
        ))}
      </div>

      {/* Primary Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <ChartFrame
          title="First-Pass Completion Rate by Month"
          takeaway={data.takeaways.firstPass}
          legend={[
            { label: 'First-Pass Rate', color: 'var(--series-1)' },
            ...(data.firstPassBaseline !== null
              ? [{ label: `Baseline (~${data.firstPassBaseline}%, self-reported before Ordinovix)`, color: 'var(--rule-strong)', dashed: true }]
              : []),
          ]}
          tableHeaders={['Month', 'First-Pass Rate (%)']}
          tableRows={seriesRows(data.firstPassByMonth, (v) => `${v}%`)}
          csvFilename="insights-first-pass-rate"
        >
          <SvgLineChart
            series={[{ name: 'First-Pass Rate', color: 'var(--series-1)', points: firstPass }]}
            baseline={data.firstPassBaseline !== null ? { value: data.firstPassBaseline, label: 'Baseline' } : undefined}
            unit="%"
            maxY={100}
          />
        </ChartFrame>

        <ChartFrame
          title="Trips Needing a Return by Month"
          takeaway={data.takeaways.trips}
          legend={[
            { label: 'Avoidable', color: 'var(--series-1)' },
            { label: 'Not avoidable', color: 'var(--series-2)' },
          ]}
          tableHeaders={['Month', 'Avoidable Trips', 'Not Avoidable Trips']}
          tableRows={data.tripsByMonth.map((t) => [monthLabel(t.month), t.avoidable, t.notAvoidable])}
          csvFilename="insights-trips-needing-return"
        >
          <SvgStackedBarChart groups={tripsStacked} />
        </ChartFrame>
      </div>

      {/* Monthly Check-in Section: Two small line charts (never dual-axis) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartFrame
          title="Operator Confidence by Month"
          takeaway={data.takeaways.confidence}
          tableHeaders={['Month', 'Confidence (1–5)']}
          tableRows={seriesRows(data.confidenceByMonth)}
          csvFilename="insights-confidence-trend"
        >
          <SvgLineChart series={[{ name: 'Confidence', color: 'var(--series-1)', points: confidence }]} minY={1} maxY={5} height={140} />
        </ChartFrame>

        <ChartFrame
          title="Hours Spent Finding Records per Week"
          takeaway={data.takeaways.hours}
          tableHeaders={['Month', 'Hours / Week']}
          tableRows={seriesRows(data.hoursFindingByMonth, (v) => `${v} hrs`)}
          csvFilename="insights-hours-finding-records"
        >
          <SvgLineChart series={[{ name: 'Hours', color: 'var(--series-1)', points: hours }]} unit="h" height={140} />
        </ChartFrame>
      </div>
    </div>
  );
}

// =========================================================================
// 2. TRIPS TAB
// =========================================================================
function TripsTabContent({ data }: { data: InsightsData['trips'] }) {
  const itemsPerVisit = linePoints(data.itemsPerVisitByMonth);
  const outcomesStacked = data.outcomesByMonth.map((o) => {
    const total = o.completed + o.submittedPaid + o.moreDocs + o.notAccepted;
    return {
      category: monthLabel(o.month),
      segments: [
        { label: 'Completed', value: share(o.completed, total), color: 'var(--good-solid)' },
        { label: 'Submitted / Paid', value: share(o.submittedPaid, total), color: 'var(--info-solid)' },
        { label: 'More Docs / Fix', value: share(o.moreDocs, total), color: 'var(--warn-solid)' },
        { label: 'Not Accepted', value: share(o.notAccepted, total), color: 'var(--critical-solid)' },
      ],
    };
  });
  const causes = data.topRejectionCauses.map((c) => ({ label: sentenceCase(c.cause), value: c.count, isAvoidable: c.avoidable }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Total Office Visits per Month"
          takeaway={data.takeaways.visits}
          tableHeaders={['Month', 'Visits']}
          tableRows={data.visitsByMonth.map((v) => [monthLabel(v.month), v.count])}
          csvFilename="insights-visits-per-month"
        >
          <SvgBarChart data={data.visitsByMonth.map((v) => ({ label: monthLabel(v.month), value: v.count }))} />
        </ChartFrame>

        <ChartFrame
          title="Errand Items per Visit by Month"
          takeaway={data.takeaways.itemsPerVisit}
          tableHeaders={['Month', 'Items / Visit']}
          tableRows={seriesRows(data.itemsPerVisitByMonth)}
          csvFilename="insights-items-per-visit"
        >
          <SvgLineChart series={[{ name: 'Items / Visit', color: 'var(--series-1)', points: itemsPerVisit }]} minY={0} />
        </ChartFrame>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Counter Outcomes by Month"
          takeaway={data.takeaways.outcomes}
          legend={[
            { label: 'Completed', color: 'var(--good-solid)' },
            { label: 'Submitted / Paid', color: 'var(--info-solid)' },
            { label: 'More Docs / Fix', color: 'var(--warn-solid)' },
            { label: 'Not Accepted', color: 'var(--critical-solid)' },
          ]}
          tableHeaders={['Month', 'Completed', 'Submitted/Paid', 'More Docs', 'Not Accepted']}
          tableRows={data.outcomesByMonth.map((o) => [monthLabel(o.month), o.completed, o.submittedPaid, o.moreDocs, o.notAccepted])}
          csvFilename="insights-counter-outcomes"
        >
          <SvgStackedBarChart groups={outcomesStacked} isPercent />
        </ChartFrame>

        <ChartFrame
          title="Why Trips Needed a Return"
          takeaway={data.takeaways.causes}
          tableHeaders={['Cause', 'Occurrences', 'Avoidable']}
          tableRows={causes.map((w) => [w.label, w.value, w.isAvoidable ? 'Yes' : 'No'])}
          csvFilename="insights-trip-rejection-causes"
        >
          <SvgHorizontalBarChart data={causes} />
        </ChartFrame>
      </div>

      <ChartFrame
        title="Visit Out-of-Pocket Expenses by Month"
        takeaway={data.takeaways.costs}
        tableHeaders={['Month', 'Expense (PHP)']}
        tableRows={data.costsByMonth.map((c) => [monthLabel(c.month), peso(c.pesos)])}
        csvFilename="insights-visit-expenses"
      >
        <SvgBarChart data={data.costsByMonth.map((c) => ({ label: monthLabel(c.month), value: c.pesos }))} unit="₱" />
      </ChartFrame>

      {/* Offices Table (Section 13.4) */}
      <TablePanel title="Office Counter Performance" subtitle="Performance and duration by office, for the visits in this period.">
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Office Name</th>
                <th className={`${TH} text-right`}>Total Visits</th>
                <th className={`${TH} text-right`}>First-Pass Rate</th>
                <th className={`${TH} text-right`}>Median Duration</th>
                <th className={`${TH} text-right`}>Last Visited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              {data.offices.length === 0 && <EmptyRow cols={5}>No office visits in this period.</EmptyRow>}
              {data.offices.map((o) => (
                <tr key={o.officeName} className="hover:bg-[var(--sheet-2)]">
                  <td className="px-4 py-2 font-medium">{o.officeName}</td>
                  <td className="px-4 py-2 text-right font-mono">{o.visits}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold">{o.firstPassRate}%</td>
                  <td className="px-4 py-2 text-right font-mono">{duration(o.medianMinutes)}</td>
                  <td className="px-4 py-2 text-right font-mono text-[var(--ink-3)]">{formatDate(o.lastVisited)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TablePanel>

      {/* Visits that left without being ready (Section 13.4) */}
      <TablePanel title="Visits That Left Not Ready" subtitle="Each departure override, with the reason given when the visit started.">
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>Office</th>
                <th className={TH}>Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              {data.leftNotReady.length === 0 && <EmptyRow cols={3}>Every visit in this period left ready.</EmptyRow>}
              {data.leftNotReady.map((v) => (
                <tr key={v.visitId} className="hover:bg-[var(--sheet-2)]">
                  <td className="px-4 py-2 font-mono">{formatDate(v.date)}</td>
                  <td className="px-4 py-2 font-medium">{v.officeName}</td>
                  <td className="px-4 py-2 text-[var(--ink-2)]">{v.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TablePanel>
    </div>
  );
}

// =========================================================================
// 3. CHASING TAB
// =========================================================================
function ChasingTabContent({ data }: { data: InsightsData['chasing'] }) {
  const responseDays = linePoints(data.responseDaysByMonth);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Follow-Up Messages Sent per Week"
          takeaway={data.takeaways.followUps}
          tableHeaders={['Week', 'Messages Sent']}
          tableRows={data.followUpsPerWeek.map((m) => [m.label, m.count])}
          csvFilename="insights-messages-per-week"
        >
          <SvgBarChart data={data.followUpsPerWeek.map((m) => ({ label: m.label, value: m.count }))} />
        </ChartFrame>

        <ChartFrame
          title="Follow-Ups Needed per Completed Task"
          takeaway={data.takeaways.chases}
          tableHeaders={['Follow-up Count', 'Tasks']}
          tableRows={data.chasesPerCompletedTask.map((c) => [`${c.bucket} ${c.bucket === '1' ? 'Chase' : 'Chases'}`, c.tasks])}
          csvFilename="insights-chases-per-task"
        >
          <SvgBarChart data={data.chasesPerCompletedTask.map((c) => ({ label: `${c.bucket} ${c.bucket === '1' ? 'Chase' : 'Chases'}`, value: c.tasks }))} />
        </ChartFrame>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Median Days for Clients to Send Documents"
          takeaway={data.takeaways.responseDays}
          tableHeaders={['Month', 'Days to Respond']}
          tableRows={seriesRows(data.responseDaysByMonth, (v) => `${v} days`)}
          csvFilename="insights-client-response-days"
        >
          <SvgLineChart series={[{ name: 'Response Days', color: 'var(--series-1)', points: responseDays }]} unit="d" />
        </ChartFrame>

        <ChartFrame
          title="Late-Discovered Blockers by Month"
          takeaway={data.takeaways.lateBlockers}
          tableHeaders={['Month', 'Late Blockers']}
          tableRows={data.lateBlockersByMonth.map((l) => [monthLabel(l.month), l.count])}
          csvFilename="insights-late-blockers"
        >
          <SvgBarChart data={data.lateBlockersByMonth.map((l) => ({ label: monthLabel(l.month), value: l.count }))} />
        </ChartFrame>
      </div>

      {/* Items Most Often Missing Table */}
      <TablePanel title="Items Most Frequently Missing" subtitle="Checklist items still outstanding or flagged late, across the clients in view.">
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Document Requirement</th>
                <th className={`${TH} text-right`}>Times Missing</th>
                <th className={`${TH} text-right`}>Average Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              {data.itemsMissing.length === 0 && <EmptyRow cols={3}>Nothing is missing right now.</EmptyRow>}
              {data.itemsMissing.map((item) => (
                <tr key={item.label} className="hover:bg-[var(--sheet-2)]">
                  <td className="px-4 py-2 font-medium">{item.label}</td>
                  <td className="px-4 py-2 text-right font-mono">{item.times}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold">{item.avgAttempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TablePanel>
    </div>
  );
}

// =========================================================================
// 4. DEADLINES TAB
// =========================================================================
function DeadlinesTabContent({ data, navigate }: { data: InsightsData['deadlines']; navigate: (path: string) => void }) {
  const onTime = data.onTimeByMonth.filter((o) => o.rate !== null).map((o) => ({ x: monthLabel(o.month), y: o.rate as number }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="On-Time Filing Rate by Month"
          takeaway={data.takeaways.onTime}
          legend={[
            { label: 'On-Time Rate', color: 'var(--series-1)' },
            { label: 'Target (90%)', color: 'var(--rule-strong)', dashed: true },
          ]}
          tableHeaders={['Month', 'On-Time Rate (%)']}
          tableRows={data.onTimeByMonth.map((o) => [monthLabel(o.month), o.rate === null ? '—' : `${o.rate}%`])}
          csvFilename="insights-ontime-rate-trend"
        >
          <SvgLineChart
            series={[{ name: 'On-Time Rate', color: 'var(--series-1)', points: onTime }]}
            baseline={{ value: 90, label: 'Target' }}
            unit="%"
            maxY={100}
          />
        </ChartFrame>

        <ChartFrame
          title="Overdue Filings by Age"
          takeaway={data.takeaways.overdue}
          tableHeaders={['Age Bracket', 'Overdue Count']}
          tableRows={data.overdueByAge.map((o) => [o.label, o.value])}
          csvFilename="insights-overdue-by-age"
        >
          <SvgBarChart data={data.overdueByAge} />
        </ChartFrame>
      </div>

      {/* Heat Calendar (Section 13.4) */}
      <TablePanel
        title="Upcoming Filings Density (Next 8 Weeks)"
        subtitle="Heat calendar showing task concentration across weekdays. Click any cell to open Calendar."
        action={
          <button
            type="button"
            onClick={() => navigate('/calendar')}
            className="text-xs font-semibold text-[var(--stamp)] hover:underline self-start sm:self-auto flex items-center gap-1 cursor-pointer"
          >
            <span>Open Calendar</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        <SvgHeatCalendar
          weeks={8}
          startDate={data.heatStart}
          data={data.heatCalendar.map((h) => ({ date: h.date, count: h.taskCount }))}
          onSelectDate={() => navigate('/calendar')}
        />
      </TablePanel>

      {/* Deadline Moves Table */}
      <TablePanel title="Statutory Deadline Extensions (RMCs & Circulars)" subtitle="Administrative deadline postponements applied across client schedules.">
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Template</th>
                <th className={TH}>Period</th>
                <th className={TH}>Extended Due Date</th>
                <th className={TH}>Statutory Source Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              {data.deadlineMoves.length === 0 && <EmptyRow cols={4}>No deadline extensions recorded.</EmptyRow>}
              {data.deadlineMoves.map((m) => (
                <tr key={m.id} className="hover:bg-[var(--sheet-2)]">
                  <td className="px-4 py-2 font-medium">{m.template}</td>
                  <td className="px-4 py-2 font-mono">{m.period}</td>
                  <td className="px-4 py-2 font-mono font-bold">{formatDate(m.newDueDate)}</td>
                  <td className="px-4 py-2 text-[var(--ink-2)]">
                    {m.sourceUrl ? (
                      <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--stamp)] hover:underline">
                        {m.sourceRef}
                      </a>
                    ) : (
                      m.sourceRef
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TablePanel>
    </div>
  );
}

// =========================================================================
// 5. WORKLOAD TAB
// =========================================================================
function WorkloadTabContent({ data, navigate }: { data: InsightsData['workload']; navigate: (path: string) => void }) {
  const g = data.tasksByStatusGroup;
  const open = g.ready + g.in_progress + g.blocked + g.submitted;
  const statusGroups = [
    {
      category: 'Open Tasks',
      segments: [
        { label: 'Ready', value: share(g.ready, open), color: 'var(--good-solid)' },
        { label: 'In Progress', value: share(g.in_progress, open), color: 'var(--info-solid)' },
        { label: 'Blocked by Client', value: share(g.blocked, open), color: 'var(--warn-solid)' },
        { label: 'Submitted', value: share(g.submitted, open), color: 'var(--serious-solid)' },
      ],
    },
  ];
  const completedGroups = data.completedByMonth.map((c) => ({
    category: monthLabel(c.month),
    segments: data.people.map((p, i) => ({ label: p.label, value: c.byUser[p.userId] ?? 0, color: PERSON_COLORS[i % PERSON_COLORS.length] })),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Open Tasks by Assigned Operator"
          takeaway={data.takeaways.people}
          tableHeaders={['Operator', 'Active Tasks']}
          tableRows={data.openByPerson.map((t) => [t.label, t.value])}
          csvFilename="insights-workload-per-person"
        >
          <SvgHorizontalBarChart data={data.openByPerson.map((t) => ({ label: t.label, value: t.value }))} />
        </ChartFrame>

        <ChartFrame
          title="Open Tasks by Operational Status"
          takeaway={data.takeaways.status}
          legend={[
            { label: 'Ready', color: 'var(--good-solid)' },
            { label: 'In Progress', color: 'var(--info-solid)' },
            { label: 'Blocked by Client', color: 'var(--warn-solid)' },
            { label: 'Submitted', color: 'var(--serious-solid)' },
          ]}
          tableHeaders={['Category', 'Ready', 'In Progress', 'Blocked', 'Submitted']}
          tableRows={[['All Open Tasks', g.ready, g.in_progress, g.blocked, g.submitted]]}
          csvFilename="insights-tasks-by-status"
        >
          <SvgStackedBarChart groups={statusGroups} isPercent />
        </ChartFrame>
      </div>

      <ChartFrame
        title="Tasks Completed per Month by Person"
        takeaway={data.completedByMonth.some((c) => Object.keys(c.byUser).length) ? 'Completed tasks per month, stacked by the person who owns them.' : 'Not enough data yet.'}
        legend={data.people.map((p, i) => ({ label: p.label, color: PERSON_COLORS[i % PERSON_COLORS.length] }))}
        tableHeaders={['Month', ...data.people.map((p) => p.label)]}
        tableRows={data.completedByMonth.map((c) => [monthLabel(c.month), ...data.people.map((p) => c.byUser[p.userId] ?? 0)])}
        csvFilename="insights-completed-per-person"
      >
        <SvgStackedBarChart groups={completedGroups} />
      </ChartFrame>

      <ChartFrame
        title="Median Days to Collect by Template"
        takeaway={data.takeaways.collect}
        tableHeaders={['Template Obligation', 'Median Days to Collect']}
        tableRows={data.daysToCollectByTemplate.map((d) => [d.label, `${d.days} days`])}
        csvFilename="insights-collection-days-by-template"
      >
        <SvgHorizontalBarChart data={data.daysToCollectByTemplate.map((d) => ({ label: d.label, value: d.days }))} />
      </ChartFrame>

      {/* Tasks Missing a Next Action Table (Section 13.4) */}
      <TablePanel title="Active Tasks Missing Next Action" subtitle="Every active obligation should have a designated next step to prevent stalls.">
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Client Code</th>
                <th className={TH}>Task Title</th>
                <th className={TH}>Due Date</th>
                <th className={TH}>Owner</th>
                <th className={`${TH} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              {data.missingNextAction.length === 0 && <EmptyRow cols={5}>Every active task has a next action.</EmptyRow>}
              {data.missingNextAction.map((t) => (
                <tr key={t.taskId} className="hover:bg-[var(--sheet-2)]">
                  <td className="px-4 py-2 font-bold font-mono">{t.clientCode}</td>
                  <td className="px-4 py-2 font-medium">{t.title}</td>
                  <td className="px-4 py-2 font-mono">{formatDate(t.dueDate)}</td>
                  <td className="px-4 py-2">{t.ownerName}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/tasks/${t.taskId}`)}
                      className="text-xs font-semibold text-[var(--stamp)] hover:underline cursor-pointer"
                    >
                      Set Next Action
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TablePanel>
    </div>
  );
}

// =========================================================================
// 6. CLIENTS TAB
// =========================================================================
function ClientsTabContent({ data, navigate }: { data: InsightsData['clients']; navigate: (path: string) => void }) {
  return (
    <div className="space-y-6">
      {/* Neutral client operational metrics table (Section 13.4) */}
      <TablePanel title="Client Response & Chasing Profile" subtitle="Objective turnaround statistics used for early scheduling and communication planning.">
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Client Code</th>
                <th className={TH}>Client Legal Name</th>
                <th className={`${TH} text-right`}>Open Tasks</th>
                <th className={`${TH} text-right`}>Avg Response Time</th>
                <th className={`${TH} text-right`}>Follow-ups</th>
                <th className={`${TH} text-right`}>Repeat Trips Linked</th>
                <th className={`${TH} text-right`}>Last Completed</th>
                <th className={`${TH} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              {data.rows.map((c) => (
                <tr key={c.clientId} className="hover:bg-[var(--sheet-2)]">
                  <td className="px-4 py-2.5">
                    <span className="font-bold font-mono px-2 py-0.5 rounded-chip bg-[var(--sheet-2)] border border-[var(--rule)] text-[var(--stamp)]">
                      {c.code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[var(--ink)]">{c.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">{c.openTasks}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{c.avgResponseDays > 0 ? `${c.avgResponseDays} days` : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{c.followUps}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">
                    {c.repeatTrips > 0 ? <span className="text-[var(--warn-fg)]">{c.repeatTrips}</span> : <span className="text-[var(--ink-3)]">0</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--ink-3)]">{c.lastCompleted ? formatDate(c.lastCompleted) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/clients/${c.clientId}`)}
                      className="text-xs font-semibold text-[var(--stamp)] hover:underline cursor-pointer"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TablePanel>
    </div>
  );
}
