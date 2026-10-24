import { useState } from 'react';
import { useSession } from '@/hooks/useData';
import { Shield, Filter, Download, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ExportMenu } from '@/components/export-menu';

interface AuditEvent {
  id: string;
  time: string;
  actor: string;
  recordType: 'client' | 'task' | 'visit' | 'payment' | 'system';
  recordName: string;
  action: string;
  beforeAfter: string;
  device: string;
  isSensitive: boolean;
  isOverride: boolean;
}

const mockEvents: AuditEvent[] = [
  {
    id: 'evt-001',
    time: '2026-10-24 14:32:10',
    actor: 'Ana Santos',
    recordType: 'client',
    recordName: 'RSP Law Firm',
    action: 'TIN Revealed',
    beforeAfter: 'Masked ***-***-***-000 -> 123-456-789-000',
    device: 'Desktop Chrome 130 (Windows)',
    isSensitive: true,
    isOverride: false,
  },
  {
    id: 'evt-002',
    time: '2026-10-24 11:15:42',
    actor: 'Ben Morales',
    recordType: 'task',
    recordName: '1601-EQ Q3 2026 (RSP Law)',
    action: 'Line Marked Received',
    beforeAfter: 'Missing -> Received (Quarterly Summary)',
    device: 'Mobile Safari 18 (iOS)',
    isSensitive: false,
    isOverride: false,
  },
  {
    id: 'evt-003',
    time: '2026-10-23 16:50:00',
    actor: 'Ana Santos',
    recordType: 'task',
    recordName: '0619-E Sep 2026 (Cruz Litigation)',
    action: 'Override Task Status',
    beforeAfter: 'Blocked -> Ready to File (Reason: Client signed wet copy in office)',
    device: 'Desktop Chrome 130 (Windows)',
    isSensitive: false,
    isOverride: true,
  },
  {
    id: 'evt-004',
    time: '2026-10-23 09:20:15',
    actor: 'Ana Santos',
    recordType: 'system',
    recordName: 'Organization Security',
    action: 'Role Assignment Changed',
    beforeAfter: 'Ben Morales assigned to Cruz Litigation',
    device: 'Desktop Chrome 130 (Windows)',
    isSensitive: true,
    isOverride: false,
  },
  {
    id: 'evt-005',
    time: '2026-10-22 17:05:30',
    actor: 'Ben Morales',
    recordType: 'visit',
    recordName: 'Visit to RDO 048',
    action: 'Trip Outcome Recorded',
    beforeAfter: 'Pending -> Completed (DST stamps applied)',
    device: 'Mobile Chrome 130 (Android)',
    isSensitive: false,
    isOverride: false,
  },
];

export function AuditPage() {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<'all' | 'sensitive' | 'overrides'>('all');

  const isOwner = session?.membership.role === 'owner';

  if (!isOwner) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="w-12 h-12 rounded-full bg-[var(--critical-bg)] text-[var(--critical-fg)] flex items-center justify-center mx-auto border border-[var(--critical-bd)]">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Access Denied</h1>
        <p className="text-sm text-[var(--ink-2)]">
          You do not have administrative permission to view the immutable practice audit log. Ask the practice owner to review these records.
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-sm font-semibold hover:bg-[var(--stamp-strong)] transition-colors"
        >
          Return to Today
        </Link>
      </div>
    );
  }

  const filteredEvents = mockEvents.filter((evt) => {
    if (filter === 'sensitive') return evt.isSensitive;
    if (filter === 'overrides') return evt.isOverride;
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--rule)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[var(--stamp)]" />
            <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Audit Log</h1>
          </div>
          <p className="text-sm text-[var(--ink-2)] mt-0.5">
            Immutable, sequential activity trail of all operator actions, TIN reveals, status overrides, and system events.
          </p>
        </div>

        <ExportMenu
          label="Export Audit Log"
          getData={() => ({
            filename: `ordinovix-audit-log-${new Date().toISOString().slice(0, 10)}`,
            title: 'Practice Activity Audit Trail',
            subtitle: `Filter: ${filter.toUpperCase()} · Total Events: ${filteredEvents.length}`,
            headers: ['Timestamp (PHT)', 'Actor', 'Target Record', 'Action', 'Details / Delta', 'Client Device'],
            rows: filteredEvents.map((e) => [
              e.time,
              e.actor,
              e.recordName,
              e.action,
              e.beforeAfter,
              e.device,
            ]),
          })}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--rule)] pb-2 text-sm">
        <Filter className="w-4 h-4 text-[var(--ink-3)] mr-1" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mr-2">Views:</span>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-md font-medium text-xs transition-colors ${
            filter === 'all'
              ? 'bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-bold'
              : 'text-[var(--ink-2)] hover:bg-[var(--sheet-2)]'
          }`}
        >
          All Activity ({mockEvents.length})
        </button>
        <button
          onClick={() => setFilter('sensitive')}
          className={`px-3 py-1 rounded-md font-medium text-xs transition-colors ${
            filter === 'sensitive'
              ? 'bg-[var(--warn-bg)] text-[var(--warn-fg)] border border-[var(--warn-bd)] font-bold'
              : 'text-[var(--ink-2)] hover:bg-[var(--sheet-2)]'
          }`}
        >
          Sensitive Events (TIN & Access)
        </button>
        <button
          onClick={() => setFilter('overrides')}
          className={`px-3 py-1 rounded-md font-medium text-xs transition-colors ${
            filter === 'overrides'
              ? 'bg-[var(--serious-bg)] text-[var(--serious-fg)] border border-[var(--serious-bd)] font-bold'
              : 'text-[var(--ink-2)] hover:bg-[var(--sheet-2)]'
          }`}
        >
          Manual Overrides & Reasons
        </button>
      </div>

      {/* Audit Table */}
      <div className="bg-[var(--sheet)] border border-[var(--rule)] rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-3)] font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Timestamp (PHT)</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Target Record</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Details / Delta</th>
              <th className="py-3 px-4">Client Device</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--rule)] font-normal text-[var(--ink)]">
            {filteredEvents.map((evt) => (
              <tr key={evt.id} className="hover:bg-[var(--sheet-2)] transition-colors">
                <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-[var(--ink-2)]">
                  {evt.time}
                </td>
                <td className="py-3 px-4 font-medium whitespace-nowrap">
                  {evt.actor}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="font-semibold text-[var(--stamp)]">{evt.recordName}</span>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      evt.isSensitive
                        ? 'bg-[var(--warn-bg)] text-[var(--warn-fg)] border border-[var(--warn-bd)]'
                        : evt.isOverride
                        ? 'bg-[var(--serious-bg)] text-[var(--serious-fg)] border border-[var(--serious-bd)]'
                        : 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)]'
                    }`}
                  >
                    {evt.action}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-[11px] max-w-xs truncate text-[var(--ink-2)]" title={evt.beforeAfter}>
                  {evt.beforeAfter}
                </td>
                <td className="py-3 px-4 text-[11px] text-[var(--ink-3)] whitespace-nowrap">
                  {evt.device}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
