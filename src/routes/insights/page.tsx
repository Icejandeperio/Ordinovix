import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Clock,
  Filter,
  CheckCircle2,
  FileText,
  User,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { useInsights, useClients, useTemplates, useSession } from '@/hooks/useData';
import { Select } from '@/components/ui/select';
import { ChartFrame } from '@/components/insights/chart-frame';
import {
  SvgLineChart,
  SvgBarChart,
  SvgStackedBarChart,
  SvgHorizontalBarChart,
  SvgHeatCalendar,
} from '@/components/insights/svg-charts';
import type { InsightsTab } from '@/domain/types';
import { QueryState } from '@/components/ui/query-state';

export function InsightsPage() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const isOwner = session?.membership?.role === 'owner';

  const [tab, setTab] = useState<InsightsTab>('overview');
  const [dateRange, setDateRange] = useState<string>('last_6_months');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');

  const { data: clientsData } = useClients();
  const { data: templatesData } = useTemplates();
  const { data, isLoading, isError, error, refetch } = useInsights(tab, {
    clientId: clientFilter !== 'all' ? clientFilter : undefined,
    assignedUserId: ownerFilter !== 'all' ? ownerFilter : undefined,
  });

  const clients = clientsData?.items?.map((i) => i.client) || [];
  const templates = templatesData || [];

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
        <Select
          value={dateRange}
          onChange={setDateRange}
          className="w-auto"
        >
          <option value="last_6_months">Last 6 Months (May–Oct 2026)</option>
          <option value="q3_2026">Q3 2026 (Jul–Sep 2026)</option>
          <option value="ytd">Year to Date (2026)</option>
        </Select>

        {/* Owner switcher (Owner only) */}
        {isOwner && (
          <Select
            value={ownerFilter}
            onChange={setOwnerFilter}
            className="w-auto"
          >
            <option value="all">Assignee: Everyone</option>
            <option value="user-ana">Ana Santos (Owner)</option>
            <option value="user-ben">Ben Morales (Helper)</option>
          </Select>
        )}

        {/* Client filter */}
        <Select
          value={clientFilter}
          onChange={setClientFilter}
          className="max-w-[220px]"
        >
          <option value="all">Client: All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.displayName}
            </option>
          ))}
        </Select>

        {/* Template filter */}
        <Select
          value={templateFilter}
          onChange={setTemplateFilter}
          className="max-w-[220px]"
        >
          <option value="all">Template: All Templates</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} — {t.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-1.5 border-b border-[var(--rule)] pb-2 overflow-x-auto">
        {(['overview', 'trips', 'chasing', 'deadlines', 'workload', 'clients'] as InsightsTab[]).map(
          (t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-chip capitalize transition-colors shrink-0 cursor-pointer ${
                tab === t
                  ? 'bg-[var(--stamp)] text-[var(--on-stamp)]'
                  : 'bg-[var(--sheet)] text-[var(--ink-2)] border border-[var(--rule)] hover:bg-[var(--sheet-2)]'
              }`}
            >
              {t}
            </button>
          )
        )}
      </div>

      {/* TAB CONTENT */}
      {isError ? (
        <QueryState isLoading={false} isError error={error} onRetry={() => refetch()} subject="insights">
          {null}
        </QueryState>
      ) : isLoading ? (
        <div className="h-72 bg-[var(--sheet-2)] rounded-panel animate-pulse flex items-center justify-center text-xs text-[var(--ink-3)]">
          Loading metrics and computing aggregations...
        </div>
      ) : tab === 'overview' ? (
        <OverviewTabContent navigate={navigate} />
      ) : tab === 'trips' ? (
        <TripsTabContent />
      ) : tab === 'chasing' ? (
        <ChasingTabContent />
      ) : tab === 'deadlines' ? (
        <DeadlinesTabContent navigate={navigate} />
      ) : tab === 'workload' ? (
        <WorkloadTabContent navigate={navigate} />
      ) : (
        <ClientsTabContent navigate={navigate} />
      )}
    </div>
  );
}

// =========================================================================
// 1. OVERVIEW TAB
// =========================================================================
function OverviewTabContent({ navigate }: { navigate: (path: string) => void }) {
  // 6 KPI Tiles (Section 13.2)
  const kpis = [
    {
      title: 'First-Pass Completion',
      value: '86%',
      comparison: 'up 9 pts vs Sep',
      isUp: true,
      baseline: 'baseline ~55%',
    },
    {
      title: 'Avoidable Repeat Trips (Oct)',
      value: '1',
      comparison: 'down 2 vs Sep',
      isUp: false,
      baseline: 'baseline 4/month',
    },
    {
      title: 'Visits That Left Ready',
      value: '92%',
      comparison: 'up 15 pts',
      isUp: true,
      baseline: 'zero departure overrides',
    },
    {
      title: 'Follow-ups Per Task (Median)',
      value: '1.5',
      comparison: 'down 0.5 vs Aug',
      isUp: false,
      baseline: 'baseline 3.2 / task',
    },
    {
      title: 'On-Time Filing Rate',
      value: '94%',
      comparison: 'above 90% SLA',
      isUp: true,
      baseline: '1 late filing this quarter',
    },
    {
      title: 'Tasks With Owner & Next Action',
      value: '97%',
      comparison: 'up 4 pts vs Sep',
      isUp: true,
      baseline: 'target 100% accountability',
    },
  ];

  const firstPassMonthly = [
    { x: 'Jun', y: 58 },
    { x: 'Jul', y: 65 },
    { x: 'Aug', y: 72 },
    { x: 'Sep', y: 77 },
    { x: 'Oct', y: 86 },
  ];

  const tripsStacked = [
    {
      category: 'Jun',
      segments: [
        { label: 'Avoidable', value: 5, color: 'var(--series-1)' },
        { label: 'Not avoidable', value: 2, color: 'var(--series-2)' },
      ],
    },
    {
      category: 'Jul',
      segments: [
        { label: 'Avoidable', value: 4, color: 'var(--series-1)' },
        { label: 'Not avoidable', value: 1, color: 'var(--series-2)' },
      ],
    },
    {
      category: 'Aug',
      segments: [
        { label: 'Avoidable', value: 3, color: 'var(--series-1)' },
        { label: 'Not avoidable', value: 3, color: 'var(--series-2)' },
      ],
    },
    {
      category: 'Sep',
      segments: [
        { label: 'Avoidable', value: 3, color: 'var(--series-1)' },
        { label: 'Not avoidable', value: 2, color: 'var(--series-2)' },
      ],
    },
    {
      category: 'Oct',
      segments: [
        { label: 'Avoidable', value: 1, color: 'var(--series-1)' },
        { label: 'Not avoidable', value: 1, color: 'var(--series-2)' },
      ],
    },
  ];

  const confidenceMonthly = [
    { x: 'Jun', y: 2.5 },
    { x: 'Jul', y: 3.0 },
    { x: 'Aug', y: 3.5 },
    { x: 'Sep', y: 4.0 },
    { x: 'Oct', y: 4.5 },
  ];

  const hoursFindingRecords = [
    { x: 'Jun', y: 7.5 },
    { x: 'Jul', y: 6.0 },
    { x: 'Aug', y: 4.5 },
    { x: 'Sep', y: 3.0 },
    { x: 'Oct', y: 1.5 },
  ];

  return (
    <div className="space-y-6">
      {/* 6 KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="p-4 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-1.5 min-w-0 overflow-hidden"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] truncate">
              {kpi.title}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-extrabold text-[var(--ink)] font-sans tabular-nums">
                {kpi.value}
              </span>
              <div className="flex items-center gap-1 text-xs text-[var(--ink-2)]">
                {kpi.isUp ? (
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--good-fg)]" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-[var(--good-fg)]" />
                )}
                <span>{kpi.comparison}</span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--ink-3)] truncate">{kpi.baseline}</p>
          </div>
        ))}
      </div>

      {/* Primary Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <ChartFrame
          title="First-Pass Completion Rate by Month"
          takeaway="First-pass counter success climbed from 58% in June to 86% in October, exceeding the baseline by 31 points."
          legend={[
            { label: 'First-Pass Rate', color: 'var(--series-1)' },
            { label: 'Baseline (55%)', color: 'var(--rule-strong)', dashed: true },
          ]}
          tableHeaders={['Month', 'First-Pass Rate (%)']}
          tableRows={firstPassMonthly.map((m) => [m.x, `${m.y}%`])}
          csvFilename="insights-first-pass-rate"
        >
          <SvgLineChart
            series={[{ name: 'First-Pass Rate', color: 'var(--series-1)', points: firstPassMonthly }]}
            baseline={{ value: 55, label: 'Baseline' }}
            unit="%"
            maxY={100}
          />
        </ChartFrame>

        <ChartFrame
          title="Trips Needing a Return by Month"
          takeaway="Avoidable repeat trips fell from 5 in June to 1 in October as checklist completeness reached 100%."
          legend={[
            { label: 'Avoidable', color: 'var(--series-1)' },
            { label: 'Not avoidable', color: 'var(--series-2)' },
          ]}
          tableHeaders={['Month', 'Avoidable Trips', 'Not Avoidable Trips']}
          tableRows={tripsStacked.map((t) => [t.category, t.segments[0].value, t.segments[1].value])}
          csvFilename="insights-trips-needing-return"
        >
          <SvgStackedBarChart groups={tripsStacked} />
        </ChartFrame>
      </div>

      {/* Monthly Check-in Section: Two small line charts (never dual-axis) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartFrame
          title="Operator Confidence by Month"
          takeaway="Subjective confidence in compliance status rose from 2.5/5 in June to 4.5/5 in October."
          tableHeaders={['Month', 'Confidence (1–5)']}
          tableRows={confidenceMonthly.map((c) => [c.x, c.y])}
          csvFilename="insights-confidence-trend"
        >
          <SvgLineChart
            series={[{ name: 'Confidence', color: 'var(--series-1)', points: confidenceMonthly }]}
            minY={1}
            maxY={5}
            height={140}
          />
        </ChartFrame>

        <ChartFrame
          title="Hours Spent Finding Records per Week"
          takeaway="Weekly hours searching for client files decreased from 7.5 hrs to 1.5 hrs with centralized document tagging."
          tableHeaders={['Month', 'Hours / Week']}
          tableRows={hoursFindingRecords.map((h) => [h.x, `${h.y} hrs`])}
          csvFilename="insights-hours-finding-records"
        >
          <SvgLineChart
            series={[{ name: 'Hours', color: 'var(--series-1)', points: hoursFindingRecords }]}
            unit="h"
            maxY={10}
            height={140}
          />
        </ChartFrame>
      </div>
    </div>
  );
}

// =========================================================================
// 2. TRIPS TAB
// =========================================================================
function TripsTabContent() {
  const visitsPerMonth = [
    { label: 'Jun', value: 14 },
    { label: 'Jul', value: 16 },
    { label: 'Aug', value: 15 },
    { label: 'Sep', value: 18 },
    { label: 'Oct', value: 12 },
  ];

  const itemsPerVisit = [
    { x: 'Jun', y: 1.4 },
    { x: 'Jul', y: 1.8 },
    { x: 'Aug', y: 2.1 },
    { x: 'Sep', y: 2.4 },
    { x: 'Oct', y: 2.8 },
  ];

  const outcomesStacked = [
    {
      category: 'Jun',
      segments: [
        { label: 'Completed', value: 8, color: 'var(--good-solid)' },
        { label: 'Submitted / Paid', value: 4, color: 'var(--info-solid)' },
        { label: 'More Docs / Fix', value: 6, color: 'var(--warn-solid)' },
        { label: 'Not Accepted', value: 2, color: 'var(--critical-solid)' },
      ],
    },
    {
      category: 'Jul',
      segments: [
        { label: 'Completed', value: 11, color: 'var(--good-solid)' },
        { label: 'Submitted / Paid', value: 5, color: 'var(--info-solid)' },
        { label: 'More Docs / Fix', value: 4, color: 'var(--warn-solid)' },
        { label: 'Not Accepted', value: 1, color: 'var(--critical-solid)' },
      ],
    },
    {
      category: 'Aug',
      segments: [
        { label: 'Completed', value: 14, color: 'var(--good-solid)' },
        { label: 'Submitted / Paid', value: 6, color: 'var(--info-solid)' },
        { label: 'More Docs / Fix', value: 3, color: 'var(--warn-solid)' },
        { label: 'Not Accepted', value: 1, color: 'var(--critical-solid)' },
      ],
    },
    {
      category: 'Sep',
      segments: [
        { label: 'Completed', value: 16, color: 'var(--good-solid)' },
        { label: 'Submitted / Paid', value: 7, color: 'var(--info-solid)' },
        { label: 'More Docs / Fix', value: 3, color: 'var(--warn-solid)' },
        { label: 'Not Accepted', value: 0, color: 'var(--critical-solid)' },
      ],
    },
    {
      category: 'Oct',
      segments: [
        { label: 'Completed', value: 15, color: 'var(--good-solid)' },
        { label: 'Submitted / Paid', value: 4, color: 'var(--info-solid)' },
        { label: 'More Docs / Fix', value: 1, color: 'var(--warn-solid)' },
        { label: 'Not Accepted', value: 0, color: 'var(--critical-solid)' },
      ],
    },
  ];

  const whyTripsNeededReturn = [
    { label: 'Missing document', value: 5, isAvoidable: true },
    { label: 'Wrong copy form', value: 3, isAvoidable: true },
    { label: 'Office system offline', value: 3, isAvoidable: false },
    { label: 'Officer unavailable', value: 2, isAvoidable: false },
    { label: 'Unsigned / Unnotarized', value: 2, isAvoidable: true },
  ];

  const costsPerMonth = [
    { label: 'Jun', value: 4200 },
    { label: 'Jul', value: 4800 },
    { label: 'Aug', value: 4100 },
    { label: 'Sep', value: 5100 },
    { label: 'Oct', value: 3200 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Total Office Visits per Month"
          takeaway="Consolidation reduced required field visits while increasing errands handled per trip."
          tableHeaders={['Month', 'Visits']}
          tableRows={visitsPerMonth.map((v) => [v.label, v.value])}
          csvFilename="insights-visits-per-month"
        >
          <SvgBarChart data={visitsPerMonth} />
        </ChartFrame>

        <ChartFrame
          title="Errand Items per Visit by Month"
          takeaway="Consolidation rate increased from 1.4 items/visit to 2.8 items/visit in October."
          tableHeaders={['Month', 'Items / Visit']}
          tableRows={itemsPerVisit.map((i) => [i.x, i.y])}
          csvFilename="insights-items-per-visit"
        >
          <SvgLineChart
            series={[{ name: 'Items / Visit', color: 'var(--series-1)', points: itemsPerVisit }]}
            minY={1}
            maxY={4}
          />
        </ChartFrame>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Counter Outcomes by Month"
          takeaway="Over 95% of counter encounters now result in completed tasks or submitted processing."
          legend={[
            { label: 'Completed', color: 'var(--good-solid)' },
            { label: 'Submitted / Paid', color: 'var(--info-solid)' },
            { label: 'More Docs / Fix', color: 'var(--warn-solid)' },
            { label: 'Not Accepted', color: 'var(--critical-solid)' },
          ]}
          tableHeaders={['Month', 'Completed', 'Submitted/Paid', 'More Docs', 'Not Accepted']}
          tableRows={outcomesStacked.map((o) => [
            o.category,
            o.segments[0].value,
            o.segments[1].value,
            o.segments[2].value,
            o.segments[3].value,
          ])}
          csvFilename="insights-counter-outcomes"
        >
          <SvgStackedBarChart groups={outcomesStacked} isPercent />
        </ChartFrame>

        <ChartFrame
          title="Why Trips Needed a Return"
          takeaway="Missing documents accounted for 5 historical repeat trips; pre-trip pack verification eliminated this cause in October."
          tableHeaders={['Cause', 'Occurrences', 'Avoidable']}
          tableRows={whyTripsNeededReturn.map((w) => [w.label, w.value, w.isAvoidable ? 'Yes' : 'No'])}
          csvFilename="insights-trip-rejection-causes"
        >
          <SvgHorizontalBarChart data={whyTripsNeededReturn} />
        </ChartFrame>
      </div>

      <ChartFrame
        title="Visit Out-of-Pocket Expenses by Month"
        takeaway="Monthly transit and parking expenditures fell to ₱3,200 as trips became consolidated."
        tableHeaders={['Month', 'Expense (PHP)']}
        tableRows={costsPerMonth.map((c) => [c.label, `₱${c.value.toLocaleString()}`])}
        csvFilename="insights-visit-expenses"
      >
        <SvgBarChart
          data={costsPerMonth.map((c) => ({ label: c.label, value: c.value }))}
          unit="₱"
        />
      </ChartFrame>

      {/* Offices Table (Section 13.4) */}
      <div className="p-5 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">Office Counter Performance</h3>
            <p className="text-xs text-[var(--ink-2)]">Historical performance and duration by tax office.</p>
          </div>
        </div>
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--sheet-2)] text-[var(--ink-3)] uppercase font-semibold text-[10px] tracking-wider border-b border-[var(--rule)]">
              <tr>
                <th className="px-4 py-2.5">Office Name</th>
                <th className="px-4 py-2.5 text-right">Total Visits</th>
                <th className="px-4 py-2.5 text-right">First-Pass Rate</th>
                <th className="px-4 py-2.5 text-right">Median Duration</th>
                <th className="px-4 py-2.5 text-right">Last Visited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              <tr className="hover:bg-[var(--sheet-2)]">
                <td className="px-4 py-2 font-medium">BIR RDO 39 — South Quezon City</td>
                <td className="px-4 py-2 text-right font-mono">18</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--good-fg)] font-bold">89%</td>
                <td className="px-4 py-2 text-right font-mono">1 h 45 m</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--ink-3)]">Oct 24, 2026</td>
              </tr>
              <tr className="hover:bg-[var(--sheet-2)]">
                <td className="px-4 py-2 font-medium">Land Bank of the Philippines — QC Circle</td>
                <td className="px-4 py-2 text-right font-mono">12</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--good-fg)] font-bold">100%</td>
                <td className="px-4 py-2 text-right font-mono">40 m</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--ink-3)]">Oct 25, 2026</td>
              </tr>
              <tr className="hover:bg-[var(--sheet-2)]">
                <td className="px-4 py-2 font-medium">Quezon City Hall — Business Permits & Licensing</td>
                <td className="px-4 py-2 text-right font-mono">6</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--good-fg)] font-bold">83%</td>
                <td className="px-4 py-2 text-right font-mono">2 h 15 m</td>
                <td className="px-4 py-2 text-right font-mono text-[var(--ink-3)]">Oct 14, 2026</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 3. CHASING TAB
// =========================================================================
function ChasingTabContent() {
  const messagesPerWeek = [
    { label: 'W36', value: 18 },
    { label: 'W37', value: 24 },
    { label: 'W38', value: 21 },
    { label: 'W39', value: 19 },
    { label: 'W40', value: 14 },
    { label: 'W41', value: 11 },
  ];

  const chasesNeededPerTask = [
    { label: '0 Chases', value: 8 },
    { label: '1 Chase', value: 14 },
    { label: '2 Chases', value: 5 },
    { label: '3+ Chases', value: 2 },
  ];

  const responseDays = [
    { x: 'Jun', y: 5.4 },
    { x: 'Jul', y: 4.8 },
    { x: 'Aug', y: 3.6 },
    { x: 'Sep', y: 2.8 },
    { x: 'Oct', y: 1.8 },
  ];

  const lateBlockers = [
    { label: 'Jun', value: 6 },
    { label: 'Jul', value: 4 },
    { label: 'Aug', value: 3 },
    { label: 'Sep', value: 2 },
    { label: 'Oct', value: 1 },
  ];

  const mostMissingItems = [
    { item: 'Signed BIR Form 2307 (Certificate of Creditable Tax Withheld)', requested: 24, avgAttempts: 1.8 },
    { item: 'Summary List of Sales & Purchases (SLSP DAT file)', requested: 18, avgAttempts: 2.1 },
    { item: 'Official Receipts & Invoices for Input VAT claims', requested: 16, avgAttempts: 1.6 },
    { item: 'Updated General Information Sheet (GIS)', requested: 8, avgAttempts: 1.2 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Follow-Up Messages Sent per Week"
          takeaway="Weekly chasing messages dropped by 54% over the last 6 weeks due to structured request checklists."
          tableHeaders={['Week', 'Messages Sent']}
          tableRows={messagesPerWeek.map((m) => [m.label, m.value])}
          csvFilename="insights-messages-per-week"
        >
          <SvgBarChart data={messagesPerWeek} />
        </ChartFrame>

        <ChartFrame
          title="Follow-Ups Needed per Completed Task"
          takeaway="70% of filing obligations are fulfilled with 1 or zero reminders."
          tableHeaders={['Follow-up Count', 'Tasks']}
          tableRows={chasesNeededPerTask.map((c) => [c.label, c.value])}
          csvFilename="insights-chases-per-task"
        >
          <SvgBarChart data={chasesNeededPerTask} />
        </ChartFrame>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Median Days for Clients to Send Documents"
          takeaway="Client turnaround time improved from 5.4 days in June to 1.8 days in October."
          tableHeaders={['Month', 'Days to Respond']}
          tableRows={responseDays.map((r) => [r.x, `${r.y} days`])}
          csvFilename="insights-client-response-days"
        >
          <SvgLineChart
            series={[{ name: 'Response Days', color: 'var(--series-1)', points: responseDays }]}
            unit="d"
            maxY={8}
          />
        </ChartFrame>

        <ChartFrame
          title="Late-Discovered Blockers by Month"
          takeaway="Items flagged within 3 days of filing dropped to just 1 in October."
          tableHeaders={['Month', 'Late Blockers']}
          tableRows={lateBlockers.map((l) => [l.label, l.value])}
          csvFilename="insights-late-blockers"
        >
          <SvgBarChart data={lateBlockers} />
        </ChartFrame>
      </div>

      {/* Items Most Often Missing Table */}
      <div className="p-5 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">Items Most Frequently Missing</h3>
            <p className="text-xs text-[var(--ink-2)]">Frequent bottleneck checklist requirements across all clients.</p>
          </div>
        </div>
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--sheet-2)] text-[var(--ink-3)] uppercase font-semibold text-[10px] tracking-wider border-b border-[var(--rule)]">
              <tr>
                <th className="px-4 py-2.5">Document Requirement</th>
                <th className="px-4 py-2.5 text-right">Times Requested</th>
                <th className="px-4 py-2.5 text-right">Average Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              {mostMissingItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-[var(--sheet-2)]">
                  <td className="px-4 py-2 font-medium">{item.item}</td>
                  <td className="px-4 py-2 text-right font-mono">{item.requested}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold">{item.avgAttempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 4. DEADLINES TAB
// =========================================================================
function DeadlinesTabContent({ navigate }: { navigate: (path: string) => void }) {
  const onTimeTrend = [
    { x: 'Jun', y: 88 },
    { x: 'Jul', y: 91 },
    { x: 'Aug', y: 92 },
    { x: 'Sep', y: 94 },
    { x: 'Oct', y: 96 },
  ];

  const overdueByAge = [
    { label: '1–3 Days', value: 1 },
    { label: '4–7 Days', value: 0 },
    { label: '8–14 Days', value: 0 },
    { label: '15+ Days', value: 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="On-Time Filing Rate by Month"
          takeaway="On-time tax filing compliance has held steadily above the 90% benchmark target."
          legend={[
            { label: 'On-Time Rate', color: 'var(--series-1)' },
            { label: 'Target (90%)', color: 'var(--rule-strong)', dashed: true },
          ]}
          tableHeaders={['Month', 'On-Time Rate (%)']}
          tableRows={onTimeTrend.map((o) => [o.x, `${o.y}%`])}
          csvFilename="insights-ontime-rate-trend"
        >
          <SvgLineChart
            series={[{ name: 'On-Time Rate', color: 'var(--series-1)', points: onTimeTrend }]}
            baseline={{ value: 90, label: 'Target' }}
            unit="%"
            maxY={100}
          />
        </ChartFrame>

        <ChartFrame
          title="Overdue Filings by Age"
          takeaway="Only 1 task is currently overdue by 1–3 days; zero severe aged backlogs."
          tableHeaders={['Age Bracket', 'Overdue Count']}
          tableRows={overdueByAge.map((o) => [o.label, o.value])}
          csvFilename="insights-overdue-by-age"
        >
          <SvgBarChart data={overdueByAge} />
        </ChartFrame>
      </div>

      {/* Heat Calendar (Section 13.4) */}
      <div className="p-5 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">Upcoming Filings Density (Next 8 Weeks)</h3>
            <p className="text-xs text-[var(--ink-2)]">Heat calendar showing task concentration across weekdays. Click any cell to open Calendar.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/calendar')}
            className="text-xs font-semibold text-[var(--stamp)] hover:underline self-start sm:self-auto flex items-center gap-1 cursor-pointer"
          >
            <span>Open Calendar</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <SvgHeatCalendar
          weeks={8}
          data={[]}
          onSelectDate={() => navigate('/calendar')}
        />
      </div>

      {/* Deadline Moves Table */}
      <div className="p-5 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">Statutory Deadline Extensions (RMCs & Circulars)</h3>
            <p className="text-xs text-[var(--ink-2)]">Administrative deadline postponements applied across client schedules.</p>
          </div>
        </div>
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--sheet-2)] text-[var(--ink-3)] uppercase font-semibold text-[10px] tracking-wider border-b border-[var(--rule)]">
              <tr>
                <th className="px-4 py-2.5">Template</th>
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5">Original Due Date</th>
                <th className="px-4 py-2.5">Extended Due Date</th>
                <th className="px-4 py-2.5">Statutory Source Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              <tr className="hover:bg-[var(--sheet-2)]">
                <td className="px-4 py-2 font-medium">1701Q — Quarterly Income Tax</td>
                <td className="px-4 py-2 font-mono">Q3 2026</td>
                <td className="px-4 py-2 font-mono line-through text-[var(--ink-3)]">Nov 15, 2026</td>
                <td className="px-4 py-2 font-mono font-bold text-[var(--good-fg)]">Nov 20, 2026</td>
                <td className="px-4 py-2 text-[var(--ink-2)]">BIR RMC No. 112-2026</td>
              </tr>
              <tr className="hover:bg-[var(--sheet-2)]">
                <td className="px-4 py-2 font-medium">1702-RT — Annual Corporate ITR</td>
                <td className="px-4 py-2 font-mono">FY 2025</td>
                <td className="px-4 py-2 font-mono line-through text-[var(--ink-3)]">Apr 15, 2026</td>
                <td className="px-4 py-2 font-mono font-bold text-[var(--good-fg)]">May 15, 2026</td>
                <td className="px-4 py-2 text-[var(--ink-2)]">BIR RMC No. 30-2026</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 5. WORKLOAD TAB
// =========================================================================
function WorkloadTabContent({ navigate }: { navigate: (path: string) => void }) {
  const tasksPerPerson = [
    { label: 'Ana Santos (Owner)', value: 18 },
    { label: 'Ben Morales (Helper)', value: 6 },
  ];

  const tasksByStatusGroup = [
    {
      category: 'Status Breakdown',
      segments: [
        { label: 'Ready', value: 8, color: 'var(--good-solid)' },
        { label: 'In Progress', value: 10, color: 'var(--info-solid)' },
        { label: 'Blocked by Client', value: 4, color: 'var(--warn-solid)' },
        { label: 'Review Needed', value: 2, color: 'var(--serious-solid)' },
      ],
    },
  ];

  const daysToCollectByTemplate = [
    { label: '1601-C (Withholding Comp)', value: 2.2 },
    { label: '1601-EQ (Withholding Expanded)', value: 3.4 },
    { label: '2550Q (Quarterly VAT)', value: 4.1 },
    { label: '1701Q (Quarterly ITR)', value: 5.2 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartFrame
          title="Open Tasks by Assigned Operator"
          takeaway="Workload distribution reflects client delegation between Owner and Helper."
          tableHeaders={['Operator', 'Active Tasks']}
          tableRows={tasksPerPerson.map((t) => [t.label, t.value])}
          csvFilename="insights-workload-per-person"
        >
          <SvgHorizontalBarChart data={tasksPerPerson} />
        </ChartFrame>

        <ChartFrame
          title="Open Tasks by Operational Status"
          takeaway="33% of open tasks are ready for submission or office action; 17% are blocked by missing client items."
          legend={[
            { label: 'Ready', color: 'var(--good-solid)' },
            { label: 'In Progress', color: 'var(--info-solid)' },
            { label: 'Blocked by Client', color: 'var(--warn-solid)' },
            { label: 'Review Needed', color: 'var(--serious-solid)' },
          ]}
          tableHeaders={['Category', 'Ready', 'In Progress', 'Blocked', 'Review Needed']}
          tableRows={[['All Active Tasks', 8, 10, 4, 2]]}
          csvFilename="insights-tasks-by-status"
        >
          <SvgStackedBarChart groups={tasksByStatusGroup} isPercent />
        </ChartFrame>
      </div>

      <ChartFrame
        title="Median Days to Collect by Template"
        takeaway="Monthly payroll withholding (1601-C) resolves fastest (2.2 days), while Quarterly VAT requires 4.1 days."
        tableHeaders={['Template Obligation', 'Median Days to Collect']}
        tableRows={daysToCollectByTemplate.map((d) => [d.label, `${d.value} days`])}
        csvFilename="insights-collection-days-by-template"
      >
        <SvgHorizontalBarChart data={daysToCollectByTemplate} />
      </ChartFrame>

      {/* Tasks Missing a Next Action Table (Section 13.4) */}
      <div className="p-5 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">Active Tasks Missing Next Action</h3>
            <p className="text-xs text-[var(--ink-2)]">Every active obligation should have a designated next step to prevent stalls.</p>
          </div>
        </div>
        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--sheet-2)] text-[var(--ink-3)] uppercase font-semibold text-[10px] tracking-wider border-b border-[var(--rule)]">
              <tr>
                <th className="px-4 py-2.5">Client Code</th>
                <th className="px-4 py-2.5">Task Title</th>
                <th className="px-4 py-2.5">Due Date</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              <tr className="hover:bg-[var(--sheet-2)]">
                <td className="px-4 py-2 font-bold font-mono">DCL</td>
                <td className="px-4 py-2 font-medium">Form 2551Q — Percentage Tax (Q3 2026)</td>
                <td className="px-4 py-2 font-mono text-[var(--critical-fg)] font-semibold">Oct 25, 2026</td>
                <td className="px-4 py-2">Ana Santos</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => navigate('/tasks/t-dcl-2551q')}
                    className="text-xs font-semibold text-[var(--stamp)] hover:underline cursor-pointer"
                  >
                    Set Next Action
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 6. CLIENTS TAB
// =========================================================================
function ClientsTabContent({ navigate }: { navigate: (path: string) => void }) {
  const clientRows = [
    {
      code: 'RSP',
      name: 'Rivera Salonga & Partners Law Offices',
      openTasks: 3,
      avgDaysToSend: 1.8,
      followUpsQuarter: 4,
      repeatTripsLinked: 0,
      lastCompleted: 'Oct 20, 2026',
      clientId: 'client-rsp',
    },
    {
      code: 'CRUZ',
      name: 'Cruz & Associates Legal Consultants',
      openTasks: 2,
      avgDaysToSend: 2.4,
      followUpsQuarter: 6,
      repeatTripsLinked: 1,
      lastCompleted: 'Oct 15, 2026',
      clientId: 'client-cruz',
    },
    {
      code: 'VTL',
      name: 'Vanguard Tech Logistics Inc.',
      openTasks: 2,
      avgDaysToSend: 3.1,
      followUpsQuarter: 5,
      repeatTripsLinked: 0,
      lastCompleted: 'Oct 18, 2026',
      clientId: 'client-vtl',
    },
    {
      code: 'MARIA',
      name: 'Maria Santos Trading & Wholesale',
      openTasks: 1,
      avgDaysToSend: 2.1,
      followUpsQuarter: 2,
      repeatTripsLinked: 0,
      lastCompleted: 'Sep 30, 2026',
      clientId: 'client-maria',
    },
    {
      code: 'BOL',
      name: 'Brightline Optical Labs Corporation',
      openTasks: 2,
      avgDaysToSend: 4.8,
      followUpsQuarter: 8,
      repeatTripsLinked: 2,
      lastCompleted: 'Oct 12, 2026',
      clientId: 'client-bol',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Neutral client operational metrics table (Section 13.4) */}
      <div className="p-5 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">Client Response & Chasing Profile</h3>
            <p className="text-xs text-[var(--ink-2)]">
              Objective turnaround statistics used for early scheduling and communication planning.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-[var(--rule)] rounded-control">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--sheet-2)] text-[var(--ink-3)] uppercase font-semibold text-[10px] tracking-wider border-b border-[var(--rule)]">
              <tr>
                <th className="px-4 py-2.5">Client Code</th>
                <th className="px-4 py-2.5">Client Legal Name</th>
                <th className="px-4 py-2.5 text-right">Open Tasks</th>
                <th className="px-4 py-2.5 text-right">Avg Response Time</th>
                <th className="px-4 py-2.5 text-right">Follow-ups (Q3)</th>
                <th className="px-4 py-2.5 text-right">Repeat Trips Linked</th>
                <th className="px-4 py-2.5 text-right">Last Completed</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
              {clientRows.map((c) => (
                <tr key={c.code} className="hover:bg-[var(--sheet-2)]">
                  <td className="px-4 py-2.5">
                    <span className="font-bold font-mono px-2 py-0.5 rounded-chip bg-[var(--sheet-2)] border border-[var(--rule)] text-[var(--stamp)]">
                      {c.code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[var(--ink)]">{c.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">{c.openTasks}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{c.avgDaysToSend} days</td>
                  <td className="px-4 py-2.5 text-right font-mono">{c.followUpsQuarter}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">
                    {c.repeatTripsLinked > 0 ? (
                      <span className="text-[var(--warn-fg)]">{c.repeatTripsLinked}</span>
                    ) : (
                      <span className="text-[var(--ink-3)]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--ink-3)]">{c.lastCompleted}</td>
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
      </div>
    </div>
  );
}
