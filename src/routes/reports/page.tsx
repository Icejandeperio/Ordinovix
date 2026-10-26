import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Users,
  CheckSquare,
  DollarSign,
  ShieldAlert,
  Database,
  ArrowRight,
  ListTodo,
  MessageSquare,
  Briefcase,
  History,
  FileCheck,
} from 'lucide-react';
import { useClients, useTasks, useSession } from '@/hooks/useData';
import { repositories } from '@/data';
import { ExportMenu } from '@/components/export-menu';
import { exportToPdf, type ExportData } from '@/lib/export';
import { formatPeso, formatDate } from '@/lib/format';

export function ReportsPage() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: clientsData } = useClients();
  const { data: tasksData } = useTasks();

  const [selectedClientId, setSelectedClientId] = useState<string>('client-rsp');
  const [reportLanguage, setReportLanguage] = useState<'en' | 'fil'>('en');
  const [paperSize, setPaperSize] = useState<'a4' | 'letter' | 'long'>('long');
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);
  const [includeMaskedTin, setIncludeMaskedTin] = useState<boolean>(true);

  const clientSummaries = clientsData?.items ?? [];
  const taskSummaries = tasksData?.items ?? [];
  const isOwner = session?.membership?.role === 'owner';

  // 1. Clients CSV
  const getClientsExportData = (): ExportData => {
    return {
      filename: `ordinovix-clients-registry-${new Date().toISOString().slice(0, 10)}`,
      title: 'Clients Registry',
      subtitle: `${session?.org?.name ?? 'Santos Tax Advisory'} · Total Records: ${clientSummaries.length}`,
      headers: ['Client Code', 'Practice Name', 'Registered Entity Name', 'Entity Type', 'RDO', 'VAT Status', 'Status'],
      rows: clientSummaries.map(({ client: c }) => [
        c.code,
        c.displayName,
        c.registeredName || '—',
        c.entityType.toUpperCase(),
        `RDO ${c.rdoCode}`,
        c.vatStatus.replace(/_/g, ' ').toUpperCase(),
        c.status.toUpperCase(),
      ]),
    };
  };

  // 2. Tasks CSV
  const getTasksExportData = (): ExportData => {
    return {
      filename: `ordinovix-tasks-log-${new Date().toISOString().slice(0, 10)}`,
      title: 'Statutory Obligation Tasks Log',
      subtitle: `${session?.org?.name ?? 'Santos Tax Advisory'} · Total Tasks: ${taskSummaries.length}`,
      headers: ['Task Code / Title', 'Client Code', 'Period', 'Due Date', 'Status', 'Office Action', 'Payment Expected'],
      rows: taskSummaries.map(({ task: t, client: c, displayedStatus }) => [
        t.title || t.templateId || 'Task',
        c.code,
        t.period || '—',
        formatDate(t.dueDate),
        displayedStatus.replace(/_/g, ' ').toUpperCase(),
        t.officeAction ? 'YES' : 'NO',
        t.paymentExpected ? 'YES' : 'NO',
      ]),
    };
  };

  // 3. Checklist Lines CSV (Section 11.14)
  const getLinesExportData = async (): Promise<ExportData> => {
    const tasksRes = await repositories.tasks.list({ limit: 50 });
    const lineRows: string[][] = [];

    for (const t of tasksRes.items) {
      const taskDetail = await repositories.tasks.get(t.task.id);
      taskDetail.lines.forEach((l) => {
        lineRows.push([
          t.client.code,
          t.task.title || t.task.templateId || 'Task',
          l.label,
          l.copyForm.toUpperCase(),
          l.suppliedBy.toUpperCase(),
          l.status.toUpperCase(),
          l.lateDiscovered ? 'YES' : 'NO',
        ]);
      });
    }

    return {
      filename: `ordinovix-checklist-lines-${new Date().toISOString().slice(0, 10)}`,
      title: 'Document Checklist Requirements & Verification Log',
      subtitle: `Total Lines Tracked: ${lineRows.length}`,
      headers: ['Client', 'Task', 'Line Requirement', 'Copy Form', 'Supplied By', 'Status', 'Late Discovered'],
      rows: lineRows.length > 0 ? lineRows : [['—', '—', 'No active lines recorded', '—', '—', '—', '—']],
    };
  };

  // 4. Follow-ups CSV (Section 11.14)
  const getFollowUpsExportData = async (): Promise<ExportData> => {
    const fuRes = await repositories.followUps.list();
    return {
      filename: `ordinovix-follow-ups-log-${new Date().toISOString().slice(0, 10)}`,
      title: 'Client Chasing & Follow-up Communications Log',
      subtitle: `Total Follow-ups: ${fuRes.items.length}`,
      headers: ['Client', 'Channel', 'Attempts', 'Status', 'Expected By', 'Last Message Snapshot'],
      rows: fuRes.items.map((fu) => [
        fu.client.code,
        fu.followUp.channel.toUpperCase(),
        fu.followUp.attemptCount,
        fu.state.toUpperCase(),
        fu.followUp.expectedBy ? formatDate(fu.followUp.expectedBy) : '—',
        fu.attempts[0]?.messageSnapshot || '—',
      ]),
    };
  };

  // 5. Visits & Outcomes CSV (Section 11.14)
  const getVisitsExportData = async (): Promise<ExportData> => {
    const visitsRes = await repositories.visits.list();
    return {
      filename: `ordinovix-visits-outcomes-${new Date().toISOString().slice(0, 10)}`,
      title: 'Office Counter Visits & Trip Outcomes',
      subtitle: `Total Visits: ${visitsRes.items.length}`,
      headers: ['Office', 'Planned Date', 'Status', 'Items Count', 'Ready to Go', 'Departure Override'],
      rows: visitsRes.items.map((v) => [
        v.visit.officeName,
        formatDate(v.visit.plannedDate),
        v.visit.status.toUpperCase(),
        v.itemCount,
        v.isReady ? 'READY' : 'NOT READY',
        v.visit.departureOverrideReason || 'NONE',
      ]),
    };
  };

  // 6. Payments CSV
  const getPaymentsExportData = async (): Promise<ExportData> => {
    const paymentsRes = await repositories.payments.list();
    return {
      filename: `ordinovix-payments-summary-${new Date().toISOString().slice(0, 10)}`,
      title: 'Tax Payments & Remittances Summary',
      subtitle: `Total Remitted: ${formatPeso(paymentsRes.totalAmount)} · Transactions: ${paymentsRes.items.length}`,
      headers: ['Paid On', 'Client', 'Channel', 'Reference No.', 'Paid By', 'Amount (PHP)', 'Reimbursement Status'],
      rows: paymentsRes.items.map((p) => [
        formatDate(p.paidOn),
        p.clientId,
        p.channel.toUpperCase(),
        p.referenceNo || 'NO-REF',
        p.paidBy.toUpperCase(),
        (p.amount / 100).toFixed(2),
        p.reimbursement?.status ? p.reimbursement.status.toUpperCase() : 'NONE',
      ]),
    };
  };

  // 7. Audit Activity CSV
  const getAuditExportData = async (): Promise<ExportData> => {
    const activityRes = await repositories.activity.list({ limit: 100 });
    return {
      filename: `ordinovix-audit-activity-${new Date().toISOString().slice(0, 10)}`,
      title: 'Practice Activity & Audit Log',
      subtitle: 'Immutable Sequential Event Trail',
      headers: ['Timestamp (PHT)', 'Actor', 'Entity', 'Action', 'Entity ID', 'Summary'],
      rows: activityRes.items.map((a) => [
        a.at,
        a.actorId,
        a.entity.toUpperCase(),
        a.action.toUpperCase(),
        a.entityId,
        a.summary,
      ]),
    };
  };

  // Client Requirement Checklist PDF (Section 11.14)
  const handleGenerateChecklist = () => {
    const activeSummary = clientSummaries.find((cs) => cs.client.id === selectedClientId) ?? clientSummaries[0];
    const client = activeSummary?.client;
    const clientTasks = taskSummaries.filter((ts) => ts.task.clientId === client?.id);

    const isFil = reportLanguage === 'fil';
    const title = isFil ? 'Listahan ng mga Kinakailangang Dokumento' : 'Client Tax Requirement Checklist';
    const subtitle = `${client?.displayName ?? 'Client'} (${includeMaskedTin ? `TIN: ${client?.tinMasked ?? '•••-•••-000-000'}` : 'Confidential'}) · RDO ${client?.rdoCode ?? '—'} · Paper: ${paperSize.toUpperCase()}`;

    const headers = isFil
      ? ['Obligasyon', 'Petsa ng Deadline', 'Kailangan Dalhin / Ihanda', 'Katayuan']
      : ['Obligation Task', 'Statutory Due Date', 'Requirement / Form', 'Status'];

    const rows = clientTasks.map(({ task: t, displayedStatus }) => [
      t.title || t.templateId || 'Task',
      formatDate(t.dueDate),
      t.officeAction ? 'Original with Wet Signature + Photocopies' : 'Digital Filing DAT Schedule',
      displayedStatus.replace(/_/g, ' ').toUpperCase(),
    ]);

    exportToPdf({
      filename: `checklist-${client?.code ?? 'client'}`,
      title,
      subtitle,
      headers,
      rows: rows.length > 0 ? rows : [['No active pending tasks recorded for this client', '—', '—', 'OK']],
    });
  };

  // Client History Report (Section 11.14: "One client, one year: every task, outcome, evidence list")
  const handleGenerateClientHistory = async () => {
    const history = await repositories.reports.clientHistory(selectedClientId, 2026);
    const client = history.client;

    exportToPdf({
      filename: `client-history-${client.code}-2026`,
      title: `Client Annual Filing History — ${client.displayName}`,
      subtitle: `${client.code} · Year 2026 · Total Tax Payments: ${formatPeso(history.totalPayments)} · Paper: ${paperSize.toUpperCase()}`,
      headers: ['Task / Obligation', 'Due Date', 'Status', 'Filing Channel', 'Payment Handled'],
      rows: history.tasks.map((t) => [
        t.task.title || t.task.templateId || 'Task',
        formatDate(t.task.dueDate),
        t.displayedStatus.replace(/_/g, ' ').toUpperCase(),
        t.task.channel?.toUpperCase() || 'MANUAL',
        t.task.paymentExpected ? 'YES' : 'NO',
      ]),
    });
  };

  // Monthly Operations Summary PDF (Section 11.14 & 13)
  const handleGenerateMonthlySummary = () => {
    exportToPdf({
      filename: `ordinovix-monthly-summary-october-2026`,
      title: 'Monthly Operations & Compliance Summary',
      subtitle: `Period: October 2026 · Operator: Ana Santos (Owner) · Paper: ${paperSize.toUpperCase()}`,
      headers: ['Operational Metric', 'Current Month Result', 'Baseline Benchmark', 'Variance'],
      rows: [
        ['First-Pass Completion Rate', '86.0%', '55.0% (Self-reported)', '+31.0 pts (Exceeding target)'],
        ['Avoidable Repeat Counter Trips', '1 trip', '4 trips / month', '-3 trips (75% Reduction)'],
        ['On-Time Return Filing Compliance', '94.0%', '90.0% SLA', '+4.0 pts (Compliant)'],
        ['Average Days to Collect Documents', '1.8 days', '6.8 days', '5.0 days faster turnaround'],
        ['Total Processed Tax Remittances', '₱1,450,000.00', '—', '100% reconciled proof'],
      ],
    });
  };

  // Full Database Backup JSON (Section 11.14)
  const handleFullBackup = async () => {
    const blob = await repositories.reports.fullBackup();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordinovix-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Title */}
      <div className="border-b border-[var(--rule)] pb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-[var(--stamp)]" />
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Reports & Data Exports</h1>
        </div>
        <p className="text-sm text-[var(--ink-2)] mt-0.5">
          Generate client-facing checklists, compliance history retrospectives, and 7 registry export streams (Excel, PDF, CSV).
        </p>
      </div>

      {/* Print Configuration Controls (Section 11.14) */}
      <div className="p-4 rounded-panel bg-[var(--sheet)] border border-[var(--rule)] shadow-xs flex flex-wrap items-center gap-4 text-xs no-print">
        <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-3)] uppercase text-[11px]">
          <Printer className="w-3.5 h-3.5 text-[var(--stamp)]" />
          <span>Print Format Settings:</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[var(--ink-2)]">Paper Size:</span>
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value as any)}
            className="h-8 px-2.5 rounded-control border border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink)] font-medium cursor-pointer"
          >
            <option value="long">Long (8.5 × 13 in / PH Legal)</option>
            <option value="a4">A4 (210 × 297 mm)</option>
            <option value="letter">Letter (8.5 × 11 in)</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-[var(--ink-2)] cursor-pointer">
          <input
            type="checkbox"
            checked={includeMaskedTin}
            onChange={(e) => setIncludeMaskedTin(e.target.checked)}
            className="rounded border-[var(--rule)] text-[var(--stamp)] cursor-pointer"
          />
          <span>Include Masked TIN</span>
        </label>

        <label className="flex items-center gap-2 text-[var(--ink-2)] cursor-pointer">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(e) => setIncludeNotes(e.target.checked)}
            className="rounded border-[var(--rule)] text-[var(--stamp)] cursor-pointer"
          />
          <span>Include Rule Lines for Notes</span>
        </label>
      </div>

      {/* SECTION 1: Practice Reports */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)]">1. Printable & PDF Client Reports</h2>
          <p className="text-xs text-[var(--ink-3)]">
            Formatted documents prepared for client delivery, physical counter trips, and operator compliance reviews.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Client Checklist */}
          <div className="p-5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">Client Requirement Checklist</div>
                  <div className="text-xs text-[var(--ink-3)] mt-0.5">
                    Itemized list of missing documents and copy forms to send via messaging or email.
                  </div>
                </div>
                <span className="p-2 rounded-md bg-[var(--stamp-soft)] text-[var(--stamp-ink)]">
                  <Printer className="w-4 h-4" />
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--rule)]">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                    Target Client
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-xs text-[var(--ink)] cursor-pointer"
                  >
                    {clientSummaries.map(({ client: c }) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                    Language
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReportLanguage('en')}
                      className={`flex-1 py-1 rounded text-xs font-semibold border cursor-pointer ${
                        reportLanguage === 'en'
                          ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)]'
                          : 'border-[var(--rule)] text-[var(--ink-2)]'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportLanguage('fil')}
                      className={`flex-1 py-1 rounded text-xs font-semibold border cursor-pointer ${
                        reportLanguage === 'fil'
                          ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)]'
                          : 'border-[var(--rule)] text-[var(--ink-2)]'
                      }`}
                    >
                      Filipino
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateChecklist}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Checklist</span>
            </button>
          </div>

          {/* Card 2: Client Annual History */}
          <div className="p-5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">Client Annual History</div>
                  <div className="text-xs text-[var(--ink-3)] mt-0.5">
                    One-year retrospective of filings, counter outcomes, evidence records, and remittances.
                  </div>
                </div>
                <span className="p-2 rounded-md bg-[var(--info-bg)] text-[var(--info-fg)]">
                  <History className="w-4 h-4" />
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--rule)]">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                    Select Client
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-xs text-[var(--ink)] cursor-pointer"
                  >
                    {clientSummaries.map(({ client: c }) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-[var(--ink-3)]">
                  Reporting Year: <strong className="text-[var(--ink)]">2026</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateClientHistory}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs font-semibold hover:bg-[var(--sheet-2)] transition-colors cursor-pointer"
            >
              <FileCheck className="w-4 h-4 text-[var(--stamp)]" />
              <span>Print Client History</span>
            </button>
          </div>

          {/* Card 3: Monthly Operations Summary */}
          <div className="p-5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">Monthly Operations Summary</div>
                  <div className="text-xs text-[var(--ink-3)] mt-0.5">
                    Executive overview of first-pass rates, avoided trips, and compliance variances.
                  </div>
                </div>
                <span className="p-2 rounded-md bg-[var(--good-bg)] text-[var(--good-fg)]">
                  <Calendar className="w-4 h-4" />
                </span>
              </div>

              <div className="p-3 rounded-md bg-[var(--sheet-2)] border border-[var(--rule)] space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Month:</span>
                  <span className="font-semibold text-[var(--ink)]">October 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Operator:</span>
                  <span className="font-semibold text-[var(--ink)]">Ana Santos (Owner)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Status:</span>
                  <span className="font-semibold text-[var(--good-fg)]">Verified</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateMonthlySummary}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs font-semibold hover:bg-[var(--sheet-2)] transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[var(--ink-2)]" />
              <span>Print Operations PDF</span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: 7 Data Registry Exports (Section 11.14) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)]">2. Practice Registry Data Exports</h2>
          <p className="text-xs text-[var(--ink-3)]">
            All 7 core registries exported in CSV (with UTF-8 BOM encoding for ₱ and ñ) and formatted Microsoft Excel.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Clients */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--stamp)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Clients Registry</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">Profiles, registered names, masked TINs, and RDOs.</p>
            </div>
            <ExportMenu label="Export Clients" getData={getClientsExportData} variant="compact" className="w-full" />
          </div>

          {/* 2. Tasks */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[var(--info-solid)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Filing Tasks Log</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">Obligation schedules, statutory due dates, and status.</p>
            </div>
            <ExportMenu label="Export Tasks" getData={getTasksExportData} variant="compact" className="w-full" />
          </div>

          {/* 3. Lines */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-[var(--series-1)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Checklist Requirements</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">Document lines, copy forms, and verification status.</p>
            </div>
            <ExportMenu label="Export Lines" getData={getLinesExportData} variant="compact" className="w-full" />
          </div>

          {/* 4. Follow-ups */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--series-3)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Follow-ups & Chasing</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">Attempt counters, channels, and message snapshots.</p>
            </div>
            <ExportMenu label="Export Follow-ups" getData={getFollowUpsExportData} variant="compact" className="w-full" />
          </div>

          {/* 5. Visits */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[var(--series-2)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Visits & Outcomes</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">Office field visits, counter results, and overrides.</p>
            </div>
            <ExportMenu label="Export Visits" getData={getVisitsExportData} variant="compact" className="w-full" />
          </div>

          {/* 6. Payments */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[var(--good-solid)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Payments Summary</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">AAB slips, online remittances, and reimbursements.</p>
            </div>
            <ExportMenu label="Export Payments" getData={getPaymentsExportData} variant="compact" className="w-full" />
          </div>

          {/* 7. Audit Activity */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[var(--critical-solid)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Audit Activity Log</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">Immutable sequential event trail of sensitive actions.</p>
            </div>
            <ExportMenu label="Export Audit" getData={getAuditExportData} variant="compact" className="w-full" />
          </div>
        </div>
      </section>

      {/* SECTION 3: Full Backup (Owner Only) */}
      {isOwner && (
        <section className="space-y-3 pt-4 border-t border-[var(--rule)]">
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet-2)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-[var(--stamp)] shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-[var(--ink)]">Full Practice Database Backup (JSON)</div>
                <div className="text-xs text-[var(--ink-3)] mt-0.5">
                  Download complete raw snapshot of all clients, tasks, visits, payments, authorizations, and activity history.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFullBackup}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--sheet)] border border-[var(--rule-strong)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--sheet-3)] transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
            >
              <span>Download JSON Backup</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
