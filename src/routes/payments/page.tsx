import React from 'react';
import { usePayments } from '@/hooks/useData';
import { formatPeso, formatDate } from '@/lib/format';
import { DollarSign, Plus, CheckCircle2, Clock } from 'lucide-react';
import { ExportMenu } from '@/components/export-menu';

export function PaymentsPage() {
  const { data, isLoading } = usePayments();
  const payments = data?.items || [];
  const totalAmount = data?.totalAmount || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Payments</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Log BIR return tax payments, AAB teller deposits, and client reimbursements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-sheet border border-rule px-3 py-1.5 rounded-control text-xs">
            <span className="text-ink-3">Total Handled: </span>
            <span className="font-bold text-ink">{formatPeso(totalAmount)}</span>
          </div>
          <ExportMenu
            label="Export Payments"
            getData={() => ({
              filename: `ordinovix-payments-${new Date().toISOString().slice(0, 10)}`,
              title: 'Tax Payments & Remittances',
              subtitle: `Total Handled: ${formatPeso(totalAmount)} · ${payments.length} transactions`,
              headers: ['Reference No', 'Channel', 'Paid On', 'Paid By', 'Amount (PHP)', 'Provider', 'Reimbursement Status'],
              rows: payments.map((p) => [
                p.referenceNo || 'NO-REF',
                p.channel.replace(/_/g, ' ').toUpperCase(),
                formatDate(p.paidOn),
                p.paidBy.toUpperCase(),
                (p.amount / 100).toFixed(2),
                p.provider || 'Authorized Agent Bank',
                p.reimbursement?.status ? p.reimbursement.status.toUpperCase() : 'NONE',
              ]),
            })}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 bg-sheet-3 rounded-panel animate-pulse" />
      ) : payments.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3">
          <DollarSign className="w-8 h-8 text-ink-3 mx-auto mb-2" />
          <p className="text-sm font-semibold text-ink">No payment records logged</p>
        </div>
      ) : (
        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {payments.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between hover:bg-sheet-2 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink font-mono">{p.referenceNo || 'NO-REF'}</span>
                  <span className="px-2 py-0.5 rounded-chip text-[10px] font-semibold bg-sheet-2 text-ink-2 uppercase border">
                    {p.channel.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-ink-2">Paid on: {formatDate(p.paidOn)} · By: {p.paidBy}</div>
                {p.reimbursement?.status === 'waiting' && (
                  <span className="text-[11px] text-warn-fg font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Awaiting Client Reimbursement</span>
                  </span>
                )}
              </div>

              <div className="text-right">
                <div className="text-base font-extrabold text-ink font-sans">{formatPeso(p.amount)}</div>
                <div className="text-xs text-ink-3">{p.provider || 'Authorized Agent Bank'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
