import React, { useState, useMemo } from 'react';
import type { Payment, PaymentChannel, ID, Centavos } from '@/domain/types';
import { useClients, useTasks, useSavePayment } from '@/hooks/useData';
import { MoneyInput } from '@/components/inputs/money-input';
import { DateField } from '@/components/inputs/date-field';
import { todayInManila } from '@/lib/dates';
import {
  X,
  DollarSign,
  Building2,
  Calendar,
  FileCheck,
  CreditCard,
  User,
  Upload,
  Camera,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { ModalDialog } from '@/components/ui/modal-dialog';

interface RecordPaymentSheetProps {
  payment?: Payment | null;
  isOpen: boolean;
  onClose: () => void;
  defaultClientId?: string;
  defaultTaskId?: string;
}

export function RecordPaymentSheet({
  payment,
  isOpen,
  onClose,
  defaultClientId,
  defaultTaskId,
}: RecordPaymentSheetProps) {
  const { data: clientsRes } = useClients();
  const clients = clientsRes?.items || [];
  const { data: tasksRes } = useTasks();
  const tasks = tasksRes?.items || [];

  const saveMutation = useSavePayment();

  const [clientId, setClientId] = useState<ID>(
    payment?.clientId || defaultClientId || clients[0]?.client.id || ''
  );
  const [taskId, setTaskId] = useState<ID>(
    payment?.taskId || defaultTaskId || ''
  );
  const [amountCentavos, setAmountCentavos] = useState<Centavos | null>(
    payment?.amount || 0
  );
  const [paidOn, setPaidOn] = useState<string>(
    payment?.paidOn || todayInManila()
  );
  const [channel, setChannel] = useState<PaymentChannel>(
    payment?.channel || 'aab_otc'
  );
  const [provider, setProvider] = useState<string>(
    payment?.provider || 'Land Bank of the Philippines'
  );
  const [referenceNo, setReferenceNo] = useState<string>(
    payment?.referenceNo || ''
  );
  const [paidBy, setPaidBy] = useState<'client' | 'operator'>(
    payment?.paidBy || 'operator'
  );
  const [reimbursementStatus, setReimbursementStatus] = useState<
    'not_needed' | 'waiting' | 'reimbursed'
  >(payment?.reimbursement?.status || 'waiting');
  const [reimbursedOn, setReimbursedOn] = useState<string>(
    payment?.reimbursement?.reimbursedOn || todayInManila()
  );
  const [proofIds, setProofIds] = useState<ID[]>(
    payment?.proofDocumentIds || []
  );
  const [proofName, setProofName] = useState<string>(
    payment?.proofDocumentIds?.length ? 'validated_teller_receipt.pdf' : ''
  );
  const [note, setNote] = useState<string>(payment?.note || '');

  // Filter tasks belonging to selected client
  const clientTasks = useMemo(() => {
    return tasks.filter((t) => t.task.clientId === clientId);
  }, [tasks, clientId]);


  const handleSimulateProofUpload = () => {
    const mockId = `doc-proof-${Date.now()}`;
    setProofIds([mockId]);
    setProofName('AAB_teller_stamped_deposit_receipt.jpg');
    toast.success('Payment receipt attached');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      toast.error('Please select a client');
      return;
    }
    if (!taskId) {
      toast.error('Please select a task for this payment');
      return;
    }
    if (!amountCentavos || amountCentavos <= 0) {
      toast.error('Amount must be greater than ₱0.00');
      return;
    }
    if (!paidOn) {
      toast.error('Payment date is required');
      return;
    }
    if (paidOn > todayInManila()) {
      toast.error('Payment date cannot be in the future');
      return;
    }

    try {
      await saveMutation.mutateAsync({
        id: payment?.id,
        clientId,
        taskId,
        amount: amountCentavos,
        paidOn,
        channel,
        provider: provider.trim() || undefined,
        referenceNo: referenceNo.trim() || undefined,
        paidBy,
        reimbursement:
          paidBy === 'operator'
            ? {
                status: reimbursementStatus,
                reimbursedOn:
                  reimbursementStatus === 'reimbursed' ? reimbursedOn : undefined,
              }
            : { status: 'not_needed' },
        proofDocumentIds: proofIds,
        note: note.trim() || undefined,
      });

      toast.success(payment ? 'Payment updated' : 'Payment recorded successfully');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save payment');
    }
  };

  const providerSuggestions = [
    'Land Bank of the Philippines',
    'Development Bank of the Philippines (DBP)',
    'BDO Unibank',
    'Bank of the Philippine Islands (BPI)',
    'Metropolitan Bank & Trust Co. (Metrobank)',
    'Union Bank of the Philippines',
    'Rizal Commercial Banking Corp (RCBC)',
    'Security Bank',
    'Maya / PayMaya',
    'GCash',
  ];

  return (
    <ModalDialog
      open={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
      zIndex="z-50"
      ariaLabel={payment ? 'Edit Payment Record' : 'Record Tax Payment'}
      panelClassName="flex flex-col max-h-[calc(100vh-3rem)]"
    >
      {/* Pinned Header */}
      <div className="flex items-center justify-between border-b border-rule p-4 sm:p-5 shrink-0 bg-sheet">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-stamp" />
          <h2 className="text-base font-bold text-ink font-sans">
            {payment ? 'Edit Payment Record' : 'Record Tax Payment'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-ink-3 hover:text-ink cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-4">
          {/* Client Selection */}
          <div className="space-y-1">
            <label className="font-bold text-ink">Client (Required)</label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setTaskId('');
              }}
              className="w-full bg-sheet border border-rule rounded-control px-3 py-2 text-ink text-xs focus:outline-none focus:border-stamp"
            >
              <option value="" disabled>-- Select Client --</option>
              {clients.map(({ client }) => (
                <option key={client.id} value={client.id}>
                  [{client.code}] {client.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Task Selection */}
          <div className="space-y-1">
            <label className="font-bold text-ink">Tax Task (Required)</label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="w-full bg-sheet border border-rule rounded-control px-3 py-2 text-ink text-xs focus:outline-none focus:border-stamp"
            >
              <option value="" disabled>-- Select Task --</option>
              {clientTasks.map(({ task }) => (
                <option key={task.id} value={task.id}>
                  {task.title || 'Tax filing task'} ({task.period || task.dueDate})
                </option>
              ))}
            </select>
            {clientTasks.length === 0 && (
              <p className="text-[11px] text-ink-3 italic">
                No active tasks found for this client.
              </p>
            )}
          </div>

          {/* Amount (MoneyInput integer centavos) & Paid On */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <MoneyInput
                label="Amount Paid (PHP)"
                centavos={amountCentavos}
                onChangeCentavos={setAmountCentavos}
                quickChips={[
                  { label: '₱500', centavos: 50000 },
                  { label: '₱1,000', centavos: 100000 },
                  { label: '₱5,000', centavos: 500000 },
                  { label: '₱25,000', centavos: 2500000 },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-2">Paid On (Required)</label>
              <DateField
                value={paidOn}
                onChange={(val) => setPaidOn(val || '')}
              />
            </div>
          </div>

          {/* Payment Channel & Provider */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-ink">Payment Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as PaymentChannel)}
                className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
              >
                <option value="aab_otc">AAB Over-the-Counter</option>
                <option value="rco">Revenue Collection Officer (RCO)</option>
                <option value="online">Online / ePayment</option>
                <option value="other">Other Payment Channel</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-ink">Bank / Provider</label>
              <input
                type="text"
                list="provider-suggestions"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. Land Bank, GCash..."
                className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
              />
              <datalist id="provider-suggestions">
                {providerSuggestions.map((prov) => (
                  <option key={prov} value={prov} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Reference Number */}
          <div className="space-y-1">
            <label className="font-bold text-ink">Reference / Machine Validation Number</label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. LBP-TXN-2026-998812"
              className="w-full bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-xs text-ink font-mono focus:outline-none focus:border-stamp"
            />
          </div>

          {/* Paid By & Reimbursement Section */}
          <div className="space-y-2 p-3 rounded-control bg-sheet border border-rule">
            <div className="space-y-1">
              <label className="font-bold text-ink block">Paid By</label>
              <div className="flex rounded-control border border-rule overflow-hidden bg-sheet-2">
                <button
                  type="button"
                  onClick={() => setPaidBy('client')}
                  className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                    paidBy === 'client'
                      ? 'bg-stamp text-on-stamp font-bold'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  Direct by Client
                </button>
                <button
                  type="button"
                  onClick={() => setPaidBy('operator')}
                  className={`flex-1 py-1.5 text-xs font-semibold cursor-pointer ${
                    paidBy === 'operator'
                      ? 'bg-stamp text-on-stamp font-bold'
                      : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  Me (Advanced / Out of Pocket)
                </button>
              </div>
            </div>

            {/* If paid by Me: Reimbursement Status */}
            {paidBy === 'operator' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-rule animate-in fade-in-50 duration-150">
                <div className="space-y-1">
                  <label className="font-bold text-ink">Reimbursement Status</label>
                  <select
                    value={reimbursementStatus}
                    onChange={(e) =>
                      setReimbursementStatus(
                        e.target.value as 'not_needed' | 'waiting' | 'reimbursed'
                      )
                    }
                    className="w-full bg-sheet-2 border border-rule rounded-control px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-stamp"
                  >
                    <option value="waiting">Waiting for Client Reimbursement</option>
                    <option value="reimbursed">Already Reimbursed</option>
                    <option value="not_needed">Not Needed / Absorbed</option>
                  </select>
                </div>

                {reimbursementStatus === 'reimbursed' && (
                  <div className="space-y-1">
                    <label className="font-bold text-ink">Reimbursed On</label>
                    <DateField
                      value={reimbursedOn}
                      onChange={(v) => setReimbursedOn(v || '')}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Proof Attachment */}
          <div className="space-y-2 p-3 rounded-control bg-sheet border border-rule">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink">Payment Proof / Stamped Slip</span>
              <button
                type="button"
                onClick={handleSimulateProofUpload}
                className="text-xs font-bold text-stamp hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Upload Proof</span>
              </button>
            </div>

            {proofName ? (
              <div className="flex items-center gap-2 p-2 rounded bg-good-bg text-good-fg border border-good-bd text-xs font-semibold">
                <FileCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">{proofName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setProofIds([]);
                    setProofName('');
                  }}
                  className="ml-auto text-ink-3 hover:text-critical-fg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-warn-fg font-medium">
                Missing proof will flag this payment as "Proof missing" and prompt a follow-up action.
              </p>
            )}
          </div>

          {/* Optional Note */}
          <div className="space-y-1">
            <label className="font-bold text-ink">Internal Note (Optional)</label>
            <textarea
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Deposit slip handed to client messenger..."
              className="w-full bg-sheet border border-rule rounded-control p-2 text-xs text-ink focus:outline-none focus:border-stamp"
            />
          </div>

        </div>

        {/* Pinned Action Buttons Footer */}
        <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-rule shrink-0 bg-sheet">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold rounded-control bg-sheet border border-rule text-ink hover:bg-sheet-2 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="px-4 py-2 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{payment ? 'Update Payment' : 'Save Payment Record'}</span>
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
