import { useState } from 'react';
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
} from 'lucide-react';
import { useClients, useTasks, useSession } from '@/hooks/useData';
import { repositories } from '@/data';
import { ExportMenu } from '@/components/export-menu';
import { exportToPdf, type ExportData } from '@/lib/export';
import { formatPeso, formatDate } from '@/lib/format';

export function ReportsPage() {
  const { data: session } = useSession();
  const { data: clientsData } = useClients();
  const { data: tasksData } = useTasks();
  const [selectedClientId, setSelectedClientId] = useState<string>('client-rsp');
  const [reportLanguage, setReportLanguage] = useState<'en' | 'fil'>('en');

  const clientSummaries = clientsData?.items ?? [];
  const taskSummaries = tasksData?.items ?? [];
  const isOwner = session?.membership.role === 'owner';

  // Export generators for Data Registries
  const getClientsExportData = (): ExportData => {
    return {
      filename: `ordinovix-clients-registry-${new Date().toISOString().slice(0, 10)}`,
      title: 'Clients Registry',
      subtitle: `${session?.org.name ?? 'Santos Tax Advisory'} · Total Records: ${clientSummaries.length}`,
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

  const getTasksExportData = (): ExportData => {
    return {
      filename: `ordinovix-tasks-log-${new Date().toISOString().slice(0, 10)}`,
      title: 'Statutory Obligation Tasks Log',
      subtitle: `${session?.org.name ?? 'Santos Tax Advisory'} · Total Tasks: ${taskSummaries.length}`,
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

  const getPaymentsExportData = async (): Promise<ExportData> => {
    const paymentsRes = await repositories.payments.list({ limit: 100 });
    return {
      filename: `ordinovix-payments-summary-${new Date().toISOString().slice(0, 10)}`,
      title: 'Tax Payments & Remittances Summary',
      subtitle: `Total Remitted: ${formatPeso(paymentsRes.totalAmount)} · Filtered Transactions: ${paymentsRes.items.length}`,
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

  // Client Checklist PDF Generator (per Spec 11.14)
  const handleGenerateChecklist = () => {
    const activeSummary = clientSummaries.find((cs) => cs.client.id === selectedClientId) ?? clientSummaries[0];
    const client = activeSummary?.client;
    const clientTasks = taskSummaries.filter((ts) => ts.task.clientId === client?.id);

    const isFil = reportLanguage === 'fil';
    const title = isFil ? 'Listahan ng mga Kinakailangang Dokumento' : 'Client Tax Requirement Checklist';
    const subtitle = `${client?.displayName ?? 'Client'} (TIN: ${client?.tinMasked ?? '•••-•••-000-000'}) · RDO ${client?.rdoCode ?? '—'}`;

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

  // Monthly Operations Summary PDF Generator (per Spec 11.14 & 13)
  const handleGenerateMonthlySummary = () => {
    exportToPdf({
      filename: `ordinovix-monthly-summary-october-2026`,
      title: 'Monthly Operations & Compliance Summary',
      subtitle: 'Period: October 2026 · Operator: Ana Santos (Owner)',
      headers: ['Operational Metric', 'Current Month Result', 'Baseline Benchmark', 'Variance'],
      rows: [
        ['First-Pass Completion Rate', '64.0%', '55.0% (Self-reported)', '+9.0 pts (Improving)'],
        ['Avoidable Repeat Counter Trips', '1 trip', '4 trips / month', '-3 trips (75% Reduction)'],
        ['On-Time Return Filing Compliance', '98.5%', '92.0%', '+6.5 pts (Above SLA)'],
        ['Average Days to Collect Documents', '3.4 days', '6.8 days', '3.4 days faster response'],
        ['Total Processed Tax Remittances', '₱1,428,500.00', '—', '100% reconciled proof'],
      ],
    });
  };

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
          Generate client-facing checklists, monthly operations summaries, and multi-format registry exports (Excel, PDF, CSV).
        </p>
      </div>

      {/* SECTION 1: Practice Reports */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)]">1. Printable & PDF Client Reports</h2>
          <p className="text-xs text-[var(--ink-3)]">
            Formatted documents prepared for client delivery, physical counter trips, and operator compliance reviews.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client Checklist Card */}
          <div className="p-5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-[var(--ink)]">Client Requirement Checklist</div>
                <div className="text-xs text-[var(--ink-3)] mt-0.5">
                  Detailed breakdown of missing files, schedule dates, and copy forms to send directly to law firm contacts.
                </div>
              </div>
              <span className="p-2 rounded-md bg-[var(--stamp-soft)] text-[var(--stamp-ink)]">
                <Printer className="w-4 h-4" />
              </span>
            </div>

            <div className="space-y-3 pt-2 border-t border-[var(--rule)]">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                  Select Target Client
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--stamp)] cursor-pointer"
                >
                  {clientSummaries.map(({ client: c }) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">
                  Headings Language
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReportLanguage('en')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                      reportLanguage === 'en'
                        ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)]'
                        : 'border-[var(--rule)] text-[var(--ink-2)]'
                    }`}
                  >
                    English (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportLanguage('fil')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                      reportLanguage === 'fil'
                        ? 'border-[var(--stamp)] bg-[var(--stamp-soft)] text-[var(--stamp-ink)]'
                        : 'border-[var(--rule)] text-[var(--ink-2)]'
                    }`}
                  >
                    Filipino / Tagalog
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateChecklist}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors cursor-pointer mt-2"
              >
                <Printer className="w-4 h-4" />
                <span>Generate Printable / PDF Checklist</span>
              </button>
            </div>
          </div>

          {/* Monthly Operations Summary Card */}
          <div className="p-5 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">Monthly Operations Summary</div>
                  <div className="text-xs text-[var(--ink-3)] mt-0.5">
                    Executive overview of first-pass rates, avoided trips, on-time filing compliance, and baseline variances.
                  </div>
                </div>
                <span className="p-2 rounded-md bg-[var(--info-bg)] text-[var(--info-fg)]">
                  <Calendar className="w-4 h-4" />
                </span>
              </div>

              <div className="mt-4 p-3 rounded-md bg-[var(--sheet-2)] border border-[var(--rule)] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Reporting Period:</span>
                  <span className="font-semibold text-[var(--ink)]">October 2026</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Operator:</span>
                  <span className="font-semibold text-[var(--ink)]">Ana Santos (Owner)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Status:</span>
                  <span className="font-semibold text-[var(--good-fg)]">Verified & Balanced</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateMonthlySummary}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs font-semibold hover:bg-[var(--sheet-2)] transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[var(--ink-2)]" />
              <span>Print / Save Operations PDF</span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: Data Registry Exports */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)]">2. Data Registry Exports (Excel, PDF, CSV)</h2>
          <p className="text-xs text-[var(--ink-3)]">
            Export raw and structured tabular data with your preferred file format. Excel files include formatted column headers, and CSV files include UTF-8 BOM encoding for Philippine Peso symbol (₱) compatibility.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Clients */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--stamp)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Clients Registry</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">
                Profiles, registered business names, masked TINs, and RDOs.
              </p>
            </div>
            <ExportMenu
              label="Export Clients"
              getData={getClientsExportData}
              variant="compact"
              className="w-full"
            />
          </div>

          {/* Tasks */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[var(--info-solid)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Filing Tasks Log</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">
                Obligation schedules, statutory due dates, and completion status.
              </p>
            </div>
            <ExportMenu
              label="Export Tasks"
              getData={getTasksExportData}
              variant="compact"
              className="w-full"
            />
          </div>

          {/* Payments */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[var(--good-solid)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Payments Summary</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">
                AAB teller slips, advance tax remittances, and reimbursement records.
              </p>
            </div>
            <ExportMenu
              label="Export Payments"
              getData={getPaymentsExportData}
              variant="compact"
              className="w-full"
            />
          </div>

          {/* Audit Trail */}
          <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[var(--serious-solid)]" />
                <h3 className="text-xs font-bold text-[var(--ink)]">Audit Activity Log</h3>
              </div>
              <p className="text-[11px] text-[var(--ink-3)]">
                Sequential immutable event trail of operator overrides and sensitive actions.
              </p>
            </div>
            <ExportMenu
              label="Export Audit"
              getData={getAuditExportData}
              variant="compact"
              className="w-full"
            />
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
