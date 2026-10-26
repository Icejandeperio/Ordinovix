import React, { useState } from 'react';
import type { FollowUpView, Channel } from '@/domain/types';
import { useLogFollowUpResponse, useEscalateFollowUp, useResolveFollowUp, useCreateFollowUp, useClients, useTasks, useContacts } from '@/hooks/useData';
import { copyFormLabel } from '@/domain/labels';
import { DateField } from '@/components/inputs/date-field';
import { todayInManila, addDaysToDate } from '@/lib/dates';
import { toast } from 'sonner';
import { X, CheckCircle2, AlertOctagon, CheckCheck, Plus } from 'lucide-react';
import { ModalDialog } from '@/components/ui/modal-dialog';

interface LogResponseModalProps {
  followUpView: FollowUpView;
  isOpen: boolean;
  onClose: () => void;
}

export function LogResponseModal({ followUpView, isOpen, onClose }: LogResponseModalProps) {
  const { followUp, client, lines } = followUpView;
  const [responseText, setResponseText] = useState('');
  const [receivedLineIds, setReceivedLineIds] = useState<string[]>([]);
  const [receivedVia, setReceivedVia] = useState<Channel>(followUp.channel);
  const logMutation = useLogFollowUpResponse();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseText.trim()) {
      toast.error('Please enter the client response notes');
      return;
    }
    try {
      await logMutation.mutateAsync({
        id: followUp.id,
        response: {
          text: responseText.trim(),
          receivedLineIds,
          via: receivedVia,
        },
      });
      toast.success(
        receivedLineIds.length > 0
          ? `Response logged and ${receivedLineIds.length} item(s) marked as Received`
          : 'Response logged'
      );
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log response');
    }
  };

  return (
    <ModalDialog
      open={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      zIndex="z-modal"
      ariaLabel="Log Client Response"
      panelClassName="p-5 space-y-4"
    >
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div>
            <h3 className="text-base font-bold text-ink">Log Client Response</h3>
            <p className="text-xs text-ink-2">{client.displayName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">What did the client say / provide?</label>
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="e.g. Sent signed 2307s via Viber, will email payroll sheet by Monday..."
              className="w-full text-xs p-2.5 bg-sheet border border-rule rounded-control text-ink focus:outline-none focus:border-stamp"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-ink">Lines Now Received (Check all that arrived)</label>
            <p className="text-[11px] text-ink-3">
              Ticking an item sets its line status on the task to <strong className="text-ink">Received</strong>.
            </p>
            <div className="bg-sheet p-3 rounded-control border border-rule space-y-2 max-h-48 overflow-y-auto">
              {lines.map((l) => {
                const checked = receivedLineIds.includes(l.id);
                return (
                  <label key={l.id} className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setReceivedLineIds([...receivedLineIds, l.id]);
                        } else {
                          setReceivedLineIds(receivedLineIds.filter((id) => id !== l.id));
                        }
                      }}
                      className="mt-0.5 rounded text-stamp focus:ring-stamp"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-ink">{l.label}</span>
                      {l.copyForm && (
                        <span className="ml-1.5 text-[10px] uppercase font-bold text-ink-3 bg-sheet px-1.5 py-0.5 rounded border border-rule">
                          {copyFormLabel(l.copyForm)}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">Received Via</label>
            <select
              value={receivedVia}
              onChange={(e) => setReceivedVia(e.target.value as Channel)}
              className="w-full text-xs bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
            >
              <option value="viber">Viber</option>
              <option value="messenger">Messenger</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="in_person">In Person / Courier</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={logMutation.isPending}
              className="px-4 py-1.5 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {logMutation.isPending ? 'Saving…' : 'Record Response'}
            </button>
          </div>
        </form>
    </ModalDialog>
  );
}

interface EscalateModalProps {
  followUpView: FollowUpView;
  isOpen: boolean;
  onClose: () => void;
}

export function EscalateModal({ followUpView, isOpen, onClose }: EscalateModalProps) {
  const { followUp, client } = followUpView;
  const [reason, setReason] = useState('');
  const escalateMutation = useEscalateFollowUp();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      toast.error('Escalation reason must be at least 10 characters');
      return;
    }
    try {
      await escalateMutation.mutateAsync({
        id: followUp.id,
        reason: reason.trim(),
      });
      toast.success('Follow-up escalated to top of overdue list');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to escalate');
    }
  };

  return (
    <ModalDialog
      open={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      zIndex="z-modal"
      ariaLabel="Escalate Follow-up"
      panelClassName="p-5 space-y-4"
    >
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertOctagon className="w-5 h-5" />
            <h3 className="text-base font-bold text-ink">Escalate Follow-up</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-ink-2">
            Escalating will move this follow-up for <strong className="text-ink">{client.displayName}</strong> to the very top of Overdue with an escalated highlight marker.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">Escalation Reason (Required, min 10 characters)</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Unresponsive after 3 attempts, calling managing partner directly..."
              className="w-full text-xs p-2.5 bg-sheet border border-rule rounded-control text-ink focus:outline-none focus:border-stamp"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={escalateMutation.isPending || reason.trim().length < 10}
              className="px-4 py-1.5 text-xs font-bold rounded-control bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {escalateMutation.isPending ? 'Escalating…' : 'Escalate Follow-up'}
            </button>
          </div>
        </form>
    </ModalDialog>
  );
}

interface ResolveModalProps {
  followUpView: FollowUpView;
  isOpen: boolean;
  onClose: () => void;
}

export function ResolveModal({ followUpView, isOpen, onClose }: ResolveModalProps) {
  const { followUp, client } = followUpView;
  const [reason, setReason] = useState('');
  const resolveMutation = useResolveFollowUp();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      toast.error('Resolution reason must be at least 10 characters');
      return;
    }
    try {
      await resolveMutation.mutateAsync({
        id: followUp.id,
        reason: reason.trim(),
      });
      toast.success('Follow-up marked as resolved');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve');
    }
  };

  return (
    <ModalDialog
      open={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      zIndex="z-modal"
      ariaLabel="Resolve Follow-up Manually"
      panelClassName="p-5 space-y-4"
    >
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCheck className="w-5 h-5" />
            <h3 className="text-base font-bold text-ink">Resolve Follow-up Manually</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-ink-2">
            Manually resolving will close this follow-up for <strong className="text-ink">{client.displayName}</strong>.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">Resolution Reason (Required, min 10 characters)</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Requirement waived by RDO officer, or client brought physical documents directly..."
              className="w-full text-xs p-2.5 bg-sheet border border-rule rounded-control text-ink focus:outline-none focus:border-stamp"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resolveMutation.isPending || reason.trim().length < 10}
              className="px-4 py-1.5 text-xs font-bold rounded-control bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {resolveMutation.isPending ? 'Resolving…' : 'Resolve Follow-up'}
            </button>
          </div>
        </form>
    </ModalDialog>
  );
}

interface NewFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClientId?: string;
}

export function NewFollowUpModal({ isOpen, onClose, defaultClientId }: NewFollowUpModalProps) {
  const { data: clientsRes } = useClients();
  const clients = clientsRes?.items || [];
  const [clientId, setClientId] = useState(defaultClientId || (clients[0]?.client.id ?? ''));

  const { data: tasksRes } = useTasks({ clientId });
  const tasks = tasksRes?.items || [];
  const [taskId, setTaskId] = useState('');

  const { data: contacts = [] } = useContacts(clientId);
  const [contactId, setContactId] = useState('');

  const [channel, setChannel] = useState<Channel>('viber');
  const [expectedBy, setExpectedBy] = useState(addDaysToDate(todayInManila(), 3));
  const [note, setNote] = useState('');

  const createMutation = useCreateFollowUp();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error('Please select a client');
      return;
    }
    try {
      await createMutation.mutateAsync({
        clientId,
        taskId: taskId || undefined,
        contactId: contactId || undefined,
        channel,
        expectedBy,
        lineIds: [],
      });
      toast.success('Follow-up created');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create follow-up');
    }
  };

  return (
    <ModalDialog
      open={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      zIndex="z-modal"
      ariaLabel="New Client Follow-up"
      panelClassName="p-5 space-y-4"
    >
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-stamp" />
            <h3 className="text-base font-bold text-ink">New Client Follow-up</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">Client (Required)</label>
            <select
              required
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setTaskId('');
                setContactId('');
              }}
              className="w-full text-xs bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
            >
              {clients.map((c) => (
                <option key={c.client.id} value={c.client.id}>
                  {c.client.displayName} ({c.client.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">Task Obligation (Optional)</label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="w-full text-xs bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
            >
              <option value="">General document follow-up</option>
              {tasks.map((t) => (
                <option key={t.task.id} value={t.task.id}>
                  {t.task.title || 'Filing'} ({t.task.period || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-ink">Contact Person</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full text-xs bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
            >
              <option value="">Primary client contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.preferredChannel.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className="w-full text-xs bg-sheet border border-rule rounded-control px-2.5 py-1.5 text-ink focus:outline-none focus:border-stamp"
              >
                <option value="viber">Viber</option>
                <option value="messenger">Messenger</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-ink">Expected By</label>
              <DateField value={expectedBy} onChange={(val) => setExpectedBy(val || '')} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-1.5 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Follow-up'}
            </button>
          </div>
        </form>
    </ModalDialog>
  );
}
