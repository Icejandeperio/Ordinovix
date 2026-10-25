import React, { useState } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  FileCheck2,
  Copy,
  Clock,
  Archive,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/inputs/date-field';
import { NumberStepper } from '@/components/inputs/money-input';
import {
  useMarkTaskSubmitted,
  useMarkTaskCompleted,
  useOverrideTaskStatus,
  useChangeTaskDueDate,
  useAddChecklistLine,
  useArchiveTask,
} from '@/hooks/useData';
import type { Task, TaskStatus, TaskLine, CopyForm } from '@/domain/types';

// ==========================================
// 1. Mark Submitted Dialog (Spec 11.5.2 & 12.7)
// ==========================================
interface MarkSubmittedDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task;
}

export function MarkSubmittedDialog({ open, onClose, task }: MarkSubmittedDialogProps) {
  const markSubmitted = useMarkTaskSubmitted();
  const [submittedOn, setSubmittedOn] = useState(new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState<'efps' | 'ebirforms' | 'manual' | 'office'>('efps');
  const [refNo, setRefNo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittedOn) {
      setError('Date of submission is required');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (submittedOn > today) {
      setError('Submission date cannot be in the future');
      return;
    }

    markSubmitted.mutate(
      {
        id: task.id,
        submission: {
          on: submittedOn,
          via: channel,
          ref: refNo.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-sheet rounded-modal border border-rule shadow-2xl p-5 space-y-4 z-10">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stamp-soft text-stamp flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Mark Return as Submitted</h3>
              <p className="text-[11px] text-ink-3">Record official transmission to the BIR</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded-control bg-critical-bg border border-critical-bd text-critical text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Submission Date <span className="text-critical">*</span>
            </label>
            <DateField value={submittedOn} onChange={(val) => setSubmittedOn(val || '')} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Filing Transmission Channel <span className="text-critical">*</span>
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as any)}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <option value="efps">Electronic Filing and Payment System (eFPS)</option>
              <option value="ebirforms">eBIRForms Offline Package</option>
              <option value="manual">Manual Submission at RDO Window</option>
              <option value="office">Filed During Office Visit</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Confirmation / Reference Number
            </label>
            <input
              type="text"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder="e.g. eFPS Ref 2026-98765432"
              className="w-full p-2 text-xs font-mono bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={markSubmitted.isPending}>
              Confirm Submission
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. Mark Completed Dialog (Spec 11.5.2 & 12.7)
// ==========================================
interface MarkCompletedDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  hasEvidence?: boolean;
}

export function MarkCompletedDialog({
  open,
  onClose,
  task,
  hasEvidence = false,
}: MarkCompletedDialogProps) {
  const markCompleted = useMarkTaskCompleted();
  const [completedOn, setCompletedOn] = useState(new Date().toISOString().slice(0, 10));
  const [noEvidenceReason, setNoEvidenceReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completedOn) {
      setError('Completion date is required');
      return;
    }
    if (!hasEvidence && noEvidenceReason.trim().length < 10) {
      setError('When evidence is not attached, a detailed reason of at least 10 characters is mandatory');
      return;
    }

    markCompleted.mutate(
      {
        id: task.id,
        completion: {
          on: completedOn,
          noEvidenceReason: hasEvidence ? undefined : noEvidenceReason.trim(),
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-sheet rounded-modal border border-rule shadow-2xl p-5 space-y-4 z-10">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-good-bg text-good-fg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Mark Task Completed</h3>
              <p className="text-[11px] text-ink-3">Finalize filing obligation and seal review record</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded-control bg-critical-bg border border-critical-bd text-critical text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Date Completed <span className="text-critical">*</span>
            </label>
            <DateField value={completedOn} onChange={(val) => setCompletedOn(val || '')} />
          </div>

          {!hasEvidence ? (
            <div className="p-3 bg-warn-bg border border-warn-bd rounded-control space-y-2">
              <div className="flex items-start gap-2 text-xs text-warn-fg font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Notice: Evidence files are missing</span>
              </div>
              <p className="text-[11px] text-warn-fg">
                Filed returns typically require an acknowledgment receipt or stamped copy. To complete without evidence, provide a reason:
              </p>
              <textarea
                value={noEvidenceReason}
                onChange={(e) => setNoEvidenceReason(e.target.value)}
                placeholder="Reason why proof is not attached (min 10 characters)..."
                rows={3}
                className="w-full p-2 text-xs bg-sheet border border-rule rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-stamp"
              />
            </div>
          ) : (
            <div className="p-3 bg-good-bg border border-good-bd rounded-control text-xs text-good-fg flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 shrink-0" />
              <span>Stamped filing evidence on file. Completing will press the Done stamp.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={markCompleted.isPending}>
              Mark Completed
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 3. Override Status Dialog (Spec 11.5.2 & 12.7)
// ==========================================
interface OverrideStatusDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task;
}

export function OverrideStatusDialog({ open, onClose, task }: OverrideStatusDialogProps) {
  const overrideMutation = useOverrideTaskStatus();
  const [newStatus, setNewStatus] = useState<TaskStatus>('in_preparation');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError('Override reason must be at least 10 characters');
      return;
    }

    overrideMutation.mutate(
      {
        id: task.id,
        status: newStatus,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-sheet rounded-modal border border-rule shadow-2xl p-5 space-y-4 z-10">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-warn-bg text-warn-fg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Override Task Status</h3>
              <p className="text-[11px] text-ink-3">Owner authority to bypass automated rule transitions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded-control bg-critical-bg border border-critical-bd text-critical text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Select Forced Status <span className="text-critical">*</span>
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus font-medium"
            >
              <option value="in_preparation">In Preparation</option>
              <option value="ready_for_review">Ready for Review</option>
              <option value="ready_next_step">Ready for Next Step / Action</option>
              <option value="submitted">Submitted</option>
              <option value="awaiting_follow_up">Awaiting Follow-up</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Reason for Override <span className="text-critical">* (min 10 characters)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Payroll unchanged — confirmed by phone with Managing Partner"
              rows={3}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={overrideMutation.isPending}>
              Apply Override
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 4. Change Due Date Dialog (Spec 11.5.2 & 12.7)
// ==========================================
interface ChangeDueDateDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task;
}

export function ChangeDueDateDialog({ open, onClose, task }: ChangeDueDateDialogProps) {
  const changeDueMutation = useChangeTaskDueDate();
  const [dueDate, setDueDate] = useState(task.dueDate || new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueDate) {
      setError('New due date is required');
      return;
    }
    if (!ref.trim()) {
      setError('Source reference (e.g. RMC 30-2026, Holiday circular) is required');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }

    changeDueMutation.mutate(
      {
        id: task.id,
        dueDate,
        ref: ref.trim(),
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-sheet rounded-modal border border-rule shadow-2xl p-5 space-y-4 z-10">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stamp-soft text-stamp flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Change Filing Deadline</h3>
              <p className="text-[11px] text-ink-3">Official extension per BIR Revenue Memorandum Circular</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded-control bg-critical-bg border border-critical-bd text-critical text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              New Due Date <span className="text-critical">*</span>
            </label>
            <DateField value={dueDate} onChange={(val) => setDueDate(val || '')} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Source Reference <span className="text-critical">*</span>
            </label>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="e.g. RMC 30-2026, Bank holiday circular"
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Reason / Justification <span className="text-critical">* (min 10 characters)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. BIR extended deadline due to severe tropical storm weather suspension"
              rows={3}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={changeDueMutation.isPending}>
              Update Deadline
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 5. Add Checklist Line Modal (Spec 11.5.3 & 12.5)
// ==========================================
interface AddChecklistLineModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
}

export function AddChecklistLineModal({ open, onClose, taskId }: AddChecklistLineModalProps) {
  const addLine = useAddChecklistLine();
  const [label, setLabel] = useState('');
  const [required, setRequired] = useState(true);
  const [copyForm, setCopyForm] = useState<CopyForm>('digital');
  const [copies, setCopies] = useState(1);
  const [suppliedBy, setSuppliedBy] = useState<'client' | 'operator' | 'third_party'>('client');
  const [printAndBring, setPrintAndBring] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || label.trim().length < 2) {
      setError('Requirement label must be at least 2 characters');
      return;
    }

    addLine.mutate(
      {
        taskId,
        line: {
          label: label.trim(),
          required,
          copyForm,
          copies: copyForm === 'photocopy' || copyForm === 'certified_true_copy' ? copies : undefined,
          suppliedBy,
          printAndBring,
          reviewNote: note.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-sheet rounded-modal border border-rule shadow-2xl p-5 space-y-4 z-10">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stamp-soft text-stamp flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Add Requirement Line</h3>
              <p className="text-[11px] text-ink-3">Ad-hoc checklist requirement for this filing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded-control bg-critical-bg border border-critical-bd text-critical text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Requirement Label <span className="text-critical">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Schedule of Expanded Withholding Tax (Form 2307)"
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Form of Copy</label>
              <select
                value={copyForm}
                onChange={(e) => setCopyForm(e.target.value as any)}
                className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <option value="digital">Digital (PDF / Scan)</option>
                <option value="original">Original Hardcopy</option>
                <option value="photocopy">Photocopy</option>
                <option value="certified_true_copy">Certified True Copy</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Supplied By</label>
              <select
                value={suppliedBy}
                onChange={(e) => setSuppliedBy(e.target.value as any)}
                className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <option value="client">Client</option>
                <option value="operator">Preparer (Me)</option>
                <option value="third_party">Third Party / Bank</option>
              </select>
            </div>
          </div>

          {(copyForm === 'photocopy' || copyForm === 'certified_true_copy') && (
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Number of Copies</label>
              <NumberStepper value={copies} onChange={setCopies} min={1} max={10} />
            </div>
          )}

          <div className="space-y-2 pt-1 border-t border-rule">
            <label className="flex items-center justify-between p-2 rounded-control bg-sheet-2 border border-rule cursor-pointer">
              <span className="text-xs font-bold text-ink">Mandatory for Readiness</span>
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="rounded text-stamp focus:ring-stamp"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-control bg-sheet-2 border border-rule cursor-pointer">
              <span className="text-xs font-bold text-ink">Print and Bring for Visit</span>
              <input
                type="checkbox"
                checked={printAndBring}
                onChange={(e) => setPrintAndBring(e.target.checked)}
                className="rounded text-stamp focus:ring-stamp"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Notes / Instructions</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Ensure all signatory boxes on page 2 are signed in blue ink"
              rows={2}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={addLine.isPending}>
              Add Line
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 6. Archive Task Dialog (Spec 11.5.2 & 12.7)
// ==========================================
interface ArchiveTaskDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task;
}

export function ArchiveTaskDialog({ open, onClose, task }: ArchiveTaskDialogProps) {
  const archiveMutation = useArchiveTask();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError('Archive reason must be at least 10 characters');
      return;
    }

    archiveMutation.mutate(
      {
        id: task.id,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-sheet rounded-modal border border-rule shadow-2xl p-5 space-y-4 z-10">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-critical-bg text-critical flex items-center justify-center">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Archive Task</h3>
              <p className="text-[11px] text-ink-3">Remove from active queues while preserving history</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-3 hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded-control bg-critical-bg border border-critical-bd text-critical text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Reason for Archiving <span className="text-critical">* (min 10 characters)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate period created by mistake; filing waived by RMC"
              rows={3}
              className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" type="submit" loading={archiveMutation.isPending}>
              Archive Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
