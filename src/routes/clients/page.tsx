import React, { useState, useMemo } from 'react';
import { useClients, useMemberships } from '@/hooks/useData';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Download,
  Upload,
  Filter,
  X,
  ChevronRight,
  ShieldAlert,
  Building2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ClientFormSheet } from '@/components/clients/client-form-sheet';
import { AuthorizationBadge, DueBadge, ClientFlag } from '@/components/ui/status-chip';
import { exportToCsv } from '@/lib/export';
import type { EntityType, VatStatus, FilingChannel, EfpsGroup } from '@/domain/types';
import { QueryState } from '@/components/ui/query-state';

type ViewTab = 'active' | 'blocked' | 'auth_attention' | 'archived';

export function ClientsPage() {
  const navigate = useNavigate();
  const { data: clientsData, isLoading, isError, error, refetch } = useClients();
  const { data: memberships } = useMemberships();

  // View tabs
  const [activeTab, setActiveTab] = useState<ViewTab>('active');

  // Filter states
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState<EntityType | 'all'>('all');
  const [vatStatus, setVatStatus] = useState<VatStatus | 'all'>('all');
  const [filingChannel, setFilingChannel] = useState<FilingChannel | 'all'>('all');
  const [efpsGroup, setEfpsGroup] = useState<EfpsGroup | 'all'>('all');
  const [assignedUserId, setAssignedUserId] = useState<string>('all');

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);

  const rawSummaries = clientsData?.items || [];

  // Filtered client summaries
  const filteredSummaries = useMemo(() => {
    return rawSummaries.filter(({ client, activeTaskCount, blockedTaskCount, authAttention, assignedUsers }) => {
      // Tab filter
      if (activeTab === 'active' && client.status === 'archived') return false;
      if (activeTab === 'archived' && client.status !== 'archived') return false;
      if (activeTab === 'blocked' && blockedTaskCount === 0) return false;
      if (activeTab === 'auth_attention' && !authAttention) return false;

      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = client.displayName.toLowerCase().includes(q);
        const matchesCode = client.code.toLowerCase().includes(q);
        const matchesRegName = client.registeredName?.toLowerCase().includes(q);
        const matchesTin = client.tinMasked?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesRegName && !matchesTin) {
          return false;
        }
      }

      // Entity type
      if (entityType !== 'all' && client.entityType !== entityType) return false;

      // VAT status
      if (vatStatus !== 'all' && client.vatStatus !== vatStatus) return false;

      // Filing channel
      if (filingChannel !== 'all' && client.filingChannel !== filingChannel) return false;

      // eFPS group
      if (efpsGroup !== 'all' && client.efpsGroup !== efpsGroup) return false;

      // Assigned user
      if (assignedUserId !== 'all') {
        const hasUser = client.assignedUserIds?.includes(assignedUserId);
        if (!hasUser) return false;
      }

      return true;
    });
  }, [rawSummaries, activeTab, search, entityType, vatStatus, filingChannel, efpsGroup, assignedUserId]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    entityType !== 'all' ||
    vatStatus !== 'all' ||
    filingChannel !== 'all' ||
    efpsGroup !== 'all' ||
    assignedUserId !== 'all';

  const resetFilters = () => {
    setSearch('');
    setEntityType('all');
    setVatStatus('all');
    setFilingChannel('all');
    setEfpsGroup('all');
    setAssignedUserId('all');
  };

  const handleExportCsv = () => {
    const headers = [
      'Code',
      'Client Name',
      'Registered Name',
      'Entity Type',
      'TIN',
      'RDO',
      'VAT Status',
      'Filing Channel',
      'eFPS Group',
      'Status',
      'Open Tasks',
      'Blocked Tasks',
      'Auth Attention',
    ];

    const rows = filteredSummaries.map(({ client, activeTaskCount, blockedTaskCount, authAttention }) => [
      client.code,
      client.displayName,
      client.registeredName || '',
      client.entityType,
      client.tinMasked || '',
      client.rdoCode,
      client.vatStatus,
      client.filingChannel,
      client.efpsGroup || '',
      client.status,
      activeTaskCount,
      blockedTaskCount,
      authAttention ? 'Yes' : 'No',
    ]);

    exportToCsv({
      filename: `ordinovix-clients-${new Date().toISOString().slice(0, 10)}.csv`,
      title: 'Ordinovix Client Directory Export',
      headers,
      rows,
    });
  };

  // View counts
  const tabCounts = useMemo(() => {
    const active = rawSummaries.filter((s) => s.client.status !== 'archived').length;
    const blocked = rawSummaries.filter((s) => s.blockedTaskCount > 0).length;
    const authAttn = rawSummaries.filter((s) => s.authAttention).length;
    const archived = rawSummaries.filter((s) => s.client.status === 'archived').length;
    return { active, blocked, authAttn, archived };
  }, [rawSummaries]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-rule">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink font-sans">
              Clients
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sheet-2 border border-rule text-ink-2">
              {filteredSummaries.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Retainer and corporate directory, BIR tax registration parameters, authorizations, and compliance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredSummaries.length === 0}
            className="flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>

          <Link
            to="/clients/import"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </Link>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Client</span>
          </Button>
        </div>
      </div>

      {/* Built-in View Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-rule pb-px no-print">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'active'
              ? 'border-stamp text-stamp font-bold'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-rule-strong'
          }`}
        >
          <span>Active</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sheet-2 border border-rule">
            {tabCounts.active}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('blocked')}
          className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'blocked'
              ? 'border-warn-solid text-warn-fg font-bold'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-rule-strong'
          }`}
        >
          <span>Has Blocked Tasks</span>
          {tabCounts.blocked > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-warn-bg text-warn-fg border border-warn-bd font-bold">
              {tabCounts.blocked}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('auth_attention')}
          className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'auth_attention'
              ? 'border-critical-solid text-critical font-bold'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-rule-strong'
          }`}
        >
          <span>Authorization Needs Attention</span>
          {tabCounts.authAttn > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-critical-bg text-critical border border-critical-bd font-bold">
              {tabCounts.authAttn}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('archived')}
          className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'archived'
              ? 'border-stamp text-stamp font-bold'
              : 'border-transparent text-ink-3 hover:text-ink hover:border-rule-strong'
          }`}
        >
          <span>Archived</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sheet-2 border border-rule text-ink-3">
            {tabCounts.archived}
          </span>
        </button>
      </div>

      {/* Instant Filter Controls */}
      <div className="bg-sheet rounded-panel border border-rule p-3 space-y-3 shadow-2xs no-print">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Instant Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Instant search by client name, code, registered name, or masked TIN..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-control bg-sheet-2 border border-rule text-ink placeholder:text-ink-3 focus:border-stamp focus:outline-none focus:ring-1 focus:ring-stamp/20"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Entity Type */}
            <Select
              value={entityType}
              onChange={(val) => setEntityType(val as any)}
              className="w-auto min-w-[110px]"
            >
              <option value="all">Entity: All</option>
              <option value="gpp">GPP</option>
              <option value="solo">Solo Practitioner</option>
              <option value="other">Other Corporation</option>
            </Select>

            {/* VAT Status */}
            <Select
              value={vatStatus}
              onChange={(val) => setVatStatus(val as any)}
              className="w-auto min-w-[110px]"
            >
              <option value="all">VAT: All</option>
              <option value="vat">VAT Registered</option>
              <option value="non_vat_percentage">Non-VAT (Percentage)</option>
              <option value="non_vat_8_percent">Non-VAT (8% Flat)</option>
              <option value="not_sure">Not Sure Yet</option>
            </Select>

            {/* Filing Channel */}
            <Select
              value={filingChannel}
              onChange={(val) => setFilingChannel(val as any)}
              className="w-auto min-w-[115px]"
            >
              <option value="all">Channel: All</option>
              <option value="efps">eFPS</option>
              <option value="ebirforms">eBIRForms</option>
              <option value="manual">Manual</option>
            </Select>

            {/* eFPS Group (conditional or visible) */}
            {(filingChannel === 'efps' || filingChannel === 'all') && (
              <Select
                value={efpsGroup}
                onChange={(val) => setEfpsGroup(val as any)}
                className="w-auto min-w-[110px]"
              >
                <option value="all">Group: All</option>
                <option value="A">Grp A</option>
                <option value="B">Grp B</option>
                <option value="C">Grp C</option>
                <option value="D">Grp D</option>
                <option value="E">Grp E</option>
              </Select>
            )}

            {/* Assigned User */}
            <Select
              value={assignedUserId}
              onChange={setAssignedUserId}
              className="w-auto min-w-[140px]"
            >
              <option value="all">Assigned: Everyone</option>
              {memberships?.map((m) => {
                const label = m.userId === 'user-ana' ? 'Ana Santos (Owner)' : m.userId === 'user-ben' ? 'Ben Morales (Helper)' : m.email;
                return (
                  <option key={m.id} value={m.userId || ''}>
                    {label}
                  </option>
                );
              })}
            </Select>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-2 py-1.5 text-xs text-ink-3 hover:text-ink flex items-center gap-1"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Clients Directory List */}
      {isError ? (
        <QueryState isLoading={false} isError error={error} onRetry={() => refetch()} subject="clients">
          {null}
        </QueryState>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-sheet rounded-panel border border-rule animate-pulse" />
          ))}
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div className="py-16 text-center bg-sheet border border-rule rounded-panel p-8">
          <Users className="w-10 h-10 text-ink-3/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-ink">No clients match this view or filter</h3>
          <p className="text-xs text-ink-2 max-w-sm mx-auto mt-1">
            Try adjusting your search criteria or reset filters to display registered taxpayers.
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="mt-4">
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-hidden bg-sheet border border-rule rounded-panel shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-rule bg-sheet-2/60 text-ink-2 font-semibold select-none">
                    <th className="py-2.5 px-3 w-16 whitespace-nowrap">Code</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Client / Firm Name</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Open Tasks</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Blocked</th>
                    <th className="py-2.5 px-3 whitespace-nowrap min-w-[120px]">Next Due</th>
                    <th className="py-2.5 px-3 whitespace-nowrap min-w-[130px]">Authorization</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Assigned</th>
                    <th className="py-2.5 px-2 w-8 actions-col no-print"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule font-sans">
                  {filteredSummaries.map(({ client, activeTaskCount, blockedTaskCount, urgentDueState, authAttention, assignedUsers }) => (
                    <tr
                      key={client.id}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className="hover:bg-sheet-2 cursor-pointer transition-colors group"
                    >
                      {/* Code (Tab Style) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-mono font-black text-xs px-2 py-1 rounded bg-stamp-soft text-stamp border border-stamp/20 tracking-wider">
                          {client.code}
                        </span>
                      </td>

                      {/* Client Name & Flags */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-ink group-hover:text-stamp transition-colors flex items-center gap-1.5">
                          <span>{client.displayName}</span>
                          {client.status === 'archived' && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-sheet-3 text-ink-3 rounded border border-rule">
                              Archived
                            </span>
                          )}
                        </div>

                        {client.registeredName && client.registeredName !== client.displayName && (
                          <div className="text-[11px] text-ink-3 truncate max-w-xs">
                            {client.registeredName}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <ClientFlag label={client.entityType === 'gpp' ? 'GPP' : client.entityType === 'solo' ? 'Solo' : 'Corp'} />
                          <ClientFlag label={client.vatStatus === 'vat' ? 'VAT' : 'Non-VAT'} />
                          <ClientFlag label={client.filingChannel === 'efps' ? `eFPS Grp ${client.efpsGroup || 'A'}` : client.filingChannel || 'Manual'} />
                          <span className="text-[10px] text-ink-3 font-mono">RDO {client.rdoCode}</span>
                        </div>
                      </td>

                      {/* Open Tasks Count */}
                      <td className="py-3 px-3 text-center font-bold text-ink">
                        <span className="tabular-nums px-2 py-0.5 rounded-full bg-sheet-2 border border-rule">
                          {activeTaskCount}
                        </span>
                      </td>

                      {/* Blocked Tasks */}
                      <td className="py-3 px-3 text-center">
                        {blockedTaskCount > 0 ? (
                          <span className="tabular-nums px-2 py-0.5 rounded-full bg-warn-bg text-warn-fg border border-warn-bd font-bold">
                            {blockedTaskCount} blocked
                          </span>
                        ) : (
                          <span className="text-ink-3 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Next Due State */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {urgentDueState ? (
                          <DueBadge state={urgentDueState} />
                        ) : (
                          <span className="text-ink-3 text-[11px]">No urgent due</span>
                        )}
                      </td>

                      {/* Authorization Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <AuthorizationBadge state={authAttention ? 'expiring' : 'valid'} />
                      </td>

                      {/* Assigned User */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {assignedUsers.length > 0 ? (
                            assignedUsers.map((u) => (
                              <span
                                key={u.id}
                                className="px-1.5 py-0.5 text-[10px] rounded font-semibold bg-sheet-2 border border-rule text-ink-2"
                                title={u.displayName || u.id}
                              >
                                {u.displayName ? u.displayName.split(' ')[0] : 'User'}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-critical">Unassigned</span>
                          )}
                        </div>
                      </td>

                      {/* Chevron Action */}
                      <td className="py-3 px-2 text-right text-ink-3 group-hover:text-stamp transition-colors actions-cell no-print">
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="md:hidden space-y-3 no-print">
            {filteredSummaries.map(({ client, activeTaskCount, blockedTaskCount, urgentDueState, authAttention }) => (
              <div
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="bg-sheet border border-rule rounded-panel p-4 space-y-2.5 active:bg-sheet-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-stamp-soft text-stamp border border-stamp/20">
                      {client.code}
                    </span>
                    <h3 className="font-bold text-xs text-ink">{client.displayName}</h3>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-3" />
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  <ClientFlag label={client.entityType} />
                  <ClientFlag label={client.filingChannel || 'Manual'} />
                  <span className="text-[10px] text-ink-3 font-mono">RDO {client.rdoCode}</span>
                </div>

                {/* Summary line per Spec 11.7.1 */}
                <div className="text-xs text-ink-2 pt-1 border-t border-rule flex items-center justify-between">
                  <span>
                    {activeTaskCount} open · {blockedTaskCount > 0 ? `${blockedTaskCount} blocked` : 'none blocked'}
                  </span>
                  <AuthorizationBadge state={authAttention ? 'expiring' : 'valid'} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Client Form Slide-over Sheet */}
      <ClientFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
