import React, { useState, useMemo } from 'react';
import { usePayments, useClients } from '@/hooks/useData';
import type { Payment, PaymentChannel, ID } from '@/domain/types';
import { formatPeso, formatDate } from '@/lib/format';
import { RecordPaymentSheet } from '@/components/payments/record-payment-sheet';
import { ExportMenu } from '@/components/export-menu';
import {
  DollarSign,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Search,
  Filter,
  FileCheck,
  Building2,
  ExternalLink,
  Edit2,
} from 'lucide-react';
import { toast } from 'sonner';

type PaymentTab = 'all' | 'proof_missing' | 'to_be_reimbursed';

export function PaymentsPage() {
  const { data: clientsRes } = useClients();
  const clients = clientsRes?.items || [];

  const [activeTab, setActiveTab] = useState<PaymentTab>('all');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal state
  const [isRecordSheetOpen, setIsRecordSheetOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  // Copy state tracker for reference numbers
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Fetch payments
  const { data, isLoading } = usePayments({
    clientId: selectedClientId || undefined,
  });
  const allPayments = data?.items || [];

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      // Tab filter
      if (activeTab === 'proof_missing' && p.proofDocumentIds && p.proofDocumentIds.length > 0) {
        return false;
      }
      if (
        activeTab === 'to_be_reimbursed' &&
        (p.paidBy !== 'operator' || p.reimbursement?.status !== 'waiting')
      ) {
        return false;
      }

      // Channel filter
      if (selectedChannel && p.channel !== selectedChannel) {
        return false;
      }

      // Paid By filter
      if (selectedPaidBy && p.paidBy !== selectedPaidBy) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const client = clients.find((c) => c.client.id === p.clientId)?.client;
        const matchRef = p.referenceNo?.toLowerCase().includes(q);
        const matchProvider = p.provider?.toLowerCase().includes(q);
        const matchClient =
          client?.displayName.toLowerCase().includes(q) ||
          client?.code.toLowerCase().includes(q);
        if (!matchRef && !matchProvider && !matchClient) return false;
      }

      return true;
    });
  }, [allPayments, activeTab, selectedChannel, selectedPaidBy, searchQuery, clients]);

  // Sum of filtered payments for the totals row
  const filteredTotal = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + p.amount, 0);
  }, [filteredPayments]);

  const handleCopyRef = (refNo: string) => {
    navigator.clipboard.writeText(refNo);
    setCopiedRef(refNo);
    toast.success(`Copied reference: ${refNo}`);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingPayment(null);
    setIsRecordSheetOpen(true);
  };

  const handleOpenEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setIsRecordSheetOpen(true);
  };

  const proofMissingCount = useMemo(() => {
    return allPayments.filter((p) => !p.proofDocumentIds || p.proofDocumentIds.length === 0).length;
  }, [allPayments]);

  const toBeReimbursedCount = useMemo(() => {
    return allPayments.filter((p) => p.paidBy === 'operator' && p.reimbursement?.status === 'waiting').length;
  }, [allPayments]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">
            Tax Payments
          </h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Log BIR return tax payments, AAB teller deposits, and client reimbursements
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <ExportMenu
            label="Export Payments"
            getData={() => ({
              filename: `ordinovix-payments-${new Date().toISOString().slice(0, 10)}`,
              title: 'Tax Payments & Remittances Register',
              subtitle: `Total Filtered: ${formatPeso(filteredTotal)} · ${filteredPayments.length} transactions`,
              headers: [
                'Reference No',
                'Client Code',
                'Paid On',
                'Amount (PHP)',
                'Channel',
                'Provider',
                'Paid By',
                'Reimbursement',
                'Proof Attached',
              ],
              rows: filteredPayments.map((p) => {
                const client = clients.find((c) => c.client.id === p.clientId)?.client;
                return [
                  p.referenceNo || 'NO-REF',
                  client?.code || 'CLIENT',
                  formatDate(p.paidOn),
                  (p.amount / 100).toFixed(2),
                  p.channel.replace(/_/g, ' ').toUpperCase(),
                  p.provider || 'Authorized Agent Bank',
                  p.paidBy === 'operator' ? 'ME (ADVANCED)' : 'CLIENT',
                  p.reimbursement?.status ? p.reimbursement.status.toUpperCase() : 'N/A',
                  p.proofDocumentIds?.length ? 'YES' : 'NO (MISSING)',
                ];
              }),
            })}
          />

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Tabs and KPI summary */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-rule pb-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-sheet-3 text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            <span>All Payments</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sheet-2 text-ink-3">
              {allPayments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('proof_missing')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors flex items-center gap-1.5 ${
              activeTab === 'proof_missing'
                ? 'bg-warn-bg text-warn-fg font-bold border border-warn-bd'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-warn-fg" />
            <span>Proof Missing</span>
            {proofMissingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-warn-fg text-white">
                {proofMissingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('to_be_reimbursed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors flex items-center gap-1.5 ${
              activeTab === 'to_be_reimbursed'
                ? 'bg-sheet-3 text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            <Clock className="w-3 h-3 text-stamp" />
            <span>To be Reimbursed</span>
            {toBeReimbursedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stamp text-on-stamp">
                {toBeReimbursedCount}
              </span>
            )}
          </button>
        </div>

        {/* Live Filtered Total Badge */}
        <div className="bg-sheet-2 border border-rule px-3 py-1.5 rounded-control text-xs flex items-center gap-2 self-start sm:self-auto">
          <span className="text-ink-3">Filtered Total:</span>
          <span className="font-extrabold text-ink font-mono">{formatPeso(filteredTotal)}</span>
          <span className="text-[11px] text-ink-3">({filteredPayments.length} txns)</span>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-sheet border border-rule rounded-panel p-3 text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reference, client..."
            className="w-full bg-sheet-2 border border-rule rounded-control pl-8 pr-2.5 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-stamp"
          />
        </div>

        {/* Client dropdown */}
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="bg-sheet-2 border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
        >
          <option value="">All Clients</option>
          {clients.map(({ client }) => (
            <option key={client.id} value={client.id}>
              [{client.code}] {client.displayName}
            </option>
          ))}
        </select>

        {/* Channel dropdown */}
        <select
          value={selectedChannel}
          onChange={(e) => setSelectedChannel(e.target.value)}
          className="bg-sheet-2 border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
        >
          <option value="">All Channels</option>
          <option value="aab_otc">AAB Over-the-Counter</option>
          <option value="rco">Revenue Collection Officer</option>
          <option value="online">Online Payment</option>
          <option value="other">Other Channel</option>
        </select>

        {/* Paid By dropdown */}
        <select
          value={selectedPaidBy}
          onChange={(e) => setSelectedPaidBy(e.target.value)}
          className="bg-sheet-2 border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
        >
          <option value="">Paid By: All</option>
          <option value="client">Direct by Client</option>
          <option value="operator">Me (Advanced)</option>
        </select>
      </div>

      {/* Main Payments Register Table */}
      {isLoading ? (
        <div className="h-48 bg-sheet-3 rounded-panel animate-pulse" />
      ) : filteredPayments.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3 space-y-3">
          <DollarSign className="w-8 h-8 text-ink-3 mx-auto opacity-70" />
          <p className="text-sm font-bold text-ink">No payment records found</p>
          <p className="text-xs text-ink-2">
            Log tax remittances with validated bank slips, reference codes, and reimbursement tracking
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record a payment</span>
          </button>
        </div>
      ) : (
        <div className="bg-sheet border border-rule rounded-panel overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-sheet-2 border-b border-rule text-ink-2 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5">Paid On</th>
                  <th className="py-2.5 px-3.5">Client</th>
                  <th className="py-2.5 px-3.5">Reference No</th>
                  <th className="py-2.5 px-3.5">Channel / Provider</th>
                  <th className="py-2.5 px-3.5 text-right">Amount (PHP)</th>
                  <th className="py-2.5 px-3.5">Paid By</th>
                  <th className="py-2.5 px-3.5">Reimbursement</th>
                  <th className="py-2.5 px-3.5">Proof</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule text-ink">
                {filteredPayments.map((p) => {
                  const client = clients.find((c) => c.client.id === p.clientId)?.client;
                  const hasProof = p.proofDocumentIds && p.proofDocumentIds.length > 0;
                  const isCopied = copiedRef === p.referenceNo;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-sheet-2/60 transition-colors group"
                    >
                      {/* Paid On */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-medium text-ink-2">
                        {formatDate(p.paidOn)}
                      </td>

                      {/* Client */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-stamp-soft text-stamp">
                            {client?.code || 'CLIENT'}
                          </span>
                          <span className="font-semibold truncate max-w-[140px]">
                            {client?.displayName || 'Client'}
                          </span>
                        </div>
                      </td>

                      {/* Reference Number with Copy Button */}
                      <td className="py-3 px-3.5 font-mono text-xs">
                        {p.referenceNo ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-ink">{p.referenceNo}</span>
                            <button
                              onClick={() => handleCopyRef(p.referenceNo!)}
                              className="text-ink-3 hover:text-stamp p-1 rounded"
                              title="Copy reference number"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-good-fg" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-ink-3 italic">No Ref</span>
                        )}
                      </td>

                      {/* Channel & Provider */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-sheet-2 border border-rule text-ink-2">
                            {p.channel.replace(/_/g, ' ')}
                          </span>
                          {p.provider && (
                            <p className="text-[11px] text-ink-3 truncate max-w-[150px]">
                              {p.provider}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Amount (right-aligned) */}
                      <td className="py-3 px-3.5 text-right font-mono font-extrabold text-sm text-ink whitespace-nowrap">
                        {formatPeso(p.amount)}
                      </td>

                      {/* Paid By */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-chip text-[10px] font-bold border ${
                            p.paidBy === 'operator'
                              ? 'bg-stamp-soft text-stamp border-stamp/20'
                              : 'bg-sheet-2 text-ink-2 border-rule'
                          }`}
                        >
                          {p.paidBy === 'operator' ? 'Me (Advanced)' : 'Client'}
                        </span>
                      </td>

                      {/* Reimbursement Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {p.paidBy === 'operator' ? (
                          p.reimbursement?.status === 'waiting' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warn-fg bg-warn-bg px-2 py-0.5 rounded border border-warn-bd">
                              <Clock className="w-3 h-3" />
                              <span>Waiting</span>
                            </span>
                          ) : p.reimbursement?.status === 'reimbursed' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-good-fg bg-good-bg px-2 py-0.5 rounded border border-good-bd">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Reimbursed</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-3">Not needed</span>
                          )
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>

                      {/* Proof Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {hasProof ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-good-fg">
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Attached</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warn-fg bg-warn-bg px-2 py-0.5 rounded border border-warn-bd">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Proof missing</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1 rounded text-ink-3 hover:text-stamp hover:bg-sheet-2 transition-colors cursor-pointer"
                          title="Edit Payment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals Row per Section 11.12 */}
              <tfoot>
                <tr className="bg-sheet-2 border-t-2 border-rule font-bold text-ink">
                  <td colSpan={4} className="py-3 px-3.5 uppercase text-xs tracking-wider">
                    Total for Filtered Payments ({filteredPayments.length} records):
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono font-extrabold text-sm text-stamp whitespace-nowrap">
                    {formatPeso(filteredTotal)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Sheet Modal */}
      <RecordPaymentSheet
        payment={editingPayment}
        isOpen={isRecordSheetOpen}
        onClose={() => {
          setIsRecordSheetOpen(false);
          setEditingPayment(null);
        }}
      />
    </div>
  );
}
