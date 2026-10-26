import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  CheckSquare,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  FileCheck2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SlideSheet } from '@/components/ui/slide-sheet';
import { DateField } from '@/components/inputs/date-field';
import { useClients, useTemplates, useMemberships, useTasks, useCreateTask } from '@/hooks/useData';
import type { TaskKind } from '@/domain/types';

interface NewTaskSheetProps {
  open: boolean;
  onClose: () => void;
  defaultClientId?: string;
}

export function NewTaskSheet({ open, onClose, defaultClientId }: NewTaskSheetProps) {
  const navigate = useNavigate();
  const { data: clientsData } = useClients({ status: 'active' });
  const { data: templates = [] } = useTemplates({ active: true });
  const { data: memberships } = useMemberships();
  const { data: allTasksData } = useTasks();
  const createTask = useCreateTask();

  const clients = clientsData?.items || [];
  const existingTasks = allTasksData?.items || [];

  const [clientId, setClientId] = useState(defaultClientId || '');
  const [templateId, setTemplateId] = useState<string>('');
  const [isOneOff, setIsOneOff] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TaskKind>('filing');
  const [period, setPeriod] = useState('2026-10');
  const [dueDate, setDueDate] = useState('');
  const [dueSourceRef, setDueSourceRef] = useState('template default');
  const [ownerUserId, setOwnerUserId] = useState('user-ana');
  const [officeAction, setOfficeAction] = useState(false);
  const [paymentExpected, setPaymentExpected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize client and template
  useEffect(() => {
    if (defaultClientId) {
      setClientId(defaultClientId);
    } else if (clients.length > 0 && !clientId) {
      setClientId(clients[0].client.id);
    }
  }, [defaultClientId, clients]);

  useEffect(() => {
    if (templates.length > 0 && !templateId && !isOneOff) {
      setTemplateId(templates[0].id);
    }
  }, [templates, isOneOff]);

  // When template changes, auto-fill defaults
  const selectedTemplate = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (!isOneOff && selectedTemplate) {
      setTitle(`${selectedTemplate.code} — ${selectedTemplate.name}`);
      setKind(selectedTemplate.kind);
      setOfficeAction(Boolean(selectedTemplate.officeAction));
      setPaymentExpected(Boolean(selectedTemplate.paymentExpected));

      // Calculate sample due date (e.g. 20th or 30th of following month)
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 20);
      setDueDate(nextMonth.toISOString().slice(0, 10));
      setDueSourceRef('template default (20th of next month)');
    }
  }, [selectedTemplate, isOneOff]);

  // Duplicate check: client + template + period per Spec 11.5.6 & 12.4
  const existingDuplicate = useMemo(() => {
    if (!clientId || !period) return null;
    return existingTasks.find(
      (t) =>
        t.task.clientId === clientId &&
        t.task.period === period &&
        ((!isOneOff && t.task.templateId === templateId) ||
          (isOneOff && t.task.title?.toLowerCase() === title.trim().toLowerCase()))
    );
  }, [existingTasks, clientId, templateId, period, isOneOff, title]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError('Please select a client');
      return;
    }
    if (isOneOff && !title.trim()) {
      setError('Task title is required for one-off obligations');
      return;
    }
    if (!dueDate) {
      setError('Due date is required');
      return;
    }
    if (existingDuplicate) {
      setError('This client already has an active task for this template and period');
      return;
    }

    createTask.mutate(
      {
        task: {
          clientId,
          templateId: isOneOff ? undefined : templateId,
          title: title.trim() || undefined,
          kind,
          period,
          dueDate,
          dueSource: { kind: isOneOff ? 'manual' : 'template', ref: dueSourceRef },
          ownerUserId,
          officeAction,
          paymentExpected,
        },
        lines: [
          {
            label: isOneOff ? 'Complete task checklist' : `${selectedTemplate?.code || 'Filing'} Signed Schedules`,
            required: true,
            copyForm: 'digital',
            suppliedBy: 'client',
            printAndBring: officeAction,
          },
          {
            label: 'Confirmation / Signed Approval',
            required: true,
            copyForm: 'digital',
            suppliedBy: 'client',
            printAndBring: false,
          },
        ],
      },
      {
        onSuccess: (created) => {
          onClose();
          navigate(`/tasks/${created.id}`);
        },
      }
    );
  };

  return (
    <SlideSheet
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      ariaLabel="Create New Task"
    >
        {/* Header */}
        <div className="p-4 border-b border-rule flex items-center justify-between shrink-0 bg-sheet">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stamp-soft text-stamp flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-ink font-sans">Create New Task</h2>
              <p className="text-[11px] text-ink-3">New recurring BIR filing return, errand, or one-off task</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-control bg-critical-bg border border-critical-bd text-critical text-xs font-medium">
              {error}
            </div>
          )}

          {/* Duplicate Warning Banner */}
          {existingDuplicate && (
            <div className="p-3 bg-warn-bg border border-warn-bd rounded-control text-xs text-warn-fg space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Already Open</span>
              </div>
              <p className="text-[11px]">
                This client already has an active task for this template and period ({period}).
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/tasks/${existingDuplicate.task.id}`);
                }}
                className="inline-flex items-center gap-1 font-bold text-stamp hover:underline"
              >
                <span>Open that existing task</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Client / Taxpayer <span className="text-critical">*</span>
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus font-bold"
            >
              {clients.map(({ client }) => (
                <option key={client.id} value={client.id}>
                  [{client.code}] {client.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1 pb-1">
            <button
              type="button"
              onClick={() => setIsOneOff(false)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-control border transition-all ${
                !isOneOff ? 'bg-stamp text-on-stamp border-stamp shadow-xs' : 'bg-sheet-2 border-rule text-ink-2'
              }`}
            >
              Template Return
            </button>
            <button
              type="button"
              onClick={() => setIsOneOff(true)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-control border transition-all ${
                isOneOff ? 'bg-stamp text-on-stamp border-stamp shadow-xs' : 'bg-sheet-2 border-rule text-ink-2'
              }`}
            >
              One-Off Errand
            </button>
          </div>

          {!isOneOff ? (
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Filing Template <span className="text-critical">*</span>
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus font-medium"
              >
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.code} — {tmpl.name} ({tmpl.frequency})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Task Title <span className="text-critical">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Authority to Print (ATP) Renewal at RDO 039"
                className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Filing Period <span className="text-critical">*</span>
              </label>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g. 2026-10 or 2026-Q3"
                className="w-full p-2 text-xs font-mono bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Task Kind <span className="text-critical">*</span>
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as TaskKind)}
                className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <option value="filing">BIR Filing</option>
                <option value="payment">Tax Payment</option>
                <option value="registration">Registration / COR</option>
                <option value="one_time_transaction">ONETT / CAR</option>
                <option value="lgu">LGU Permit</option>
                <option value="other">Other Errand</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-ink">
                Filing Deadline <span className="text-critical">*</span>
              </label>
              {dueSourceRef && (
                <span className="text-[10px] text-ink-3 italic">{dueSourceRef}</span>
              )}
            </div>
            <DateField value={dueDate} onChange={(val) => setDueDate(val || '')} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Assignee (Owner) <span className="text-critical">*</span>
            </label>
            <select
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            >
              {memberships?.map((m) => (
                <option key={m.id} value={m.userId || 'user-ana'}>
                  {m.userId === 'user-ana' ? 'Ana Santos (Owner)' : m.userId === 'user-ben' ? 'Ben Morales (Helper)' : m.email}
                </option>
              )) || (
                <>
                  <option value="user-ana">Ana Santos (Owner)</option>
                  <option value="user-ben">Ben Morales (Helper)</option>
                </>
              )}
            </select>
          </div>

          <div className="space-y-2 pt-2 border-t border-rule">
            <label className="flex items-center justify-between p-2.5 rounded-control bg-sheet-2 border border-rule cursor-pointer">
              <div>
                <span className="text-xs font-bold text-ink block">Office Visit Required</span>
                <span className="text-[10px] text-ink-3">Enables adding this task to an upcoming RDO visit plan</span>
              </div>
              <input
                type="checkbox"
                checked={officeAction}
                onChange={(e) => setOfficeAction(e.target.checked)}
                className="rounded text-stamp focus:ring-stamp"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-control bg-sheet-2 border border-rule cursor-pointer">
              <div>
                <span className="text-xs font-bold text-ink block">Tax Payment Expected</span>
                <span className="text-[10px] text-ink-3">Completion requires attaching payment confirmation proof</span>
              </div>
              <input
                type="checkbox"
                checked={paymentExpected}
                onChange={(e) => setPaymentExpected(e.target.checked)}
                className="rounded text-stamp focus:ring-stamp"
              />
            </label>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-rule">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={Boolean(existingDuplicate)}
              loading={createTask.isPending}
            >
              Create Task
            </Button>
          </div>
        </form>
    </SlideSheet>
  );
}
