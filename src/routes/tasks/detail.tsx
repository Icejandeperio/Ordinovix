import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useTask,
  useSetLineStatus,
  useSetTaskStatus,
  useSession,
  useUpdateTask,
  useDuplicateTaskForNextPeriod,
  useSetTaskNextAction,
  useClearTaskOverride,
} from '@/hooks/useData';
import { StatusChip, DueBadge, LineChip } from '@/components/ui/status-chip';
import { ReviewStamp } from '@/components/ui/stamp';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { formatDate } from '@/lib/format';
import { isLateDiscovered, validAuthorization, authorizationState, periodLabel } from '@/domain/rules';
import { TASK_STATUS_META } from '@/domain/labels';
import {
  MarkSubmittedDialog,
  MarkCompletedDialog,
  OverrideStatusDialog,
  ChangeDueDateDialog,
  AddChecklistLineModal,
  ArchiveTaskDialog,
} from '@/components/tasks/task-modals';
import type { LineStatus, NextAction } from '@/domain/types';
import {
  ArrowLeft,
  Stamp,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lock,
  Plus,
  Send,
  Calendar,
  FileText,
  User,
  Clock,
  Printer,
  Upload,
  MoreVertical,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Building2,
  CreditCard,
  MessageSquare,
  History,
  RotateCcw,
  Check,
  Copy,
  ChevronRight,
} from 'lucide-react';

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data, isLoading, error } = useTask(taskId || '');

  const setLineStatus = useSetLineStatus();
  const setTaskStatus = useSetTaskStatus();
  const updateTask = useUpdateTask();
  const duplicateTask = useDuplicateTaskForNextPeriod();
  const setNextAction = useSetTaskNextAction();
  const clearOverride = useClearTaskOverride();

  // Modals state
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [isChangeDueOpen, setIsChangeDueOpen] = useState(false);
  const [isAddLineOpen, setIsAddLineOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  // Quick edit next action modal/prompt
  const [isEditingNextAction, setIsEditingNextAction] = useState(false);
  const [nextActionText, setNextActionText] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');

  // Local simulated file upload feedback
  const [recentStampedLineId, setRecentStampedLineId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-6 w-32 bg-sheet-3 rounded" />
        <div className="h-28 bg-sheet-3 rounded-panel" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-sheet-3 rounded-panel" />
          <div className="h-96 bg-sheet-3 rounded-panel" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-12 text-center bg-sheet rounded-panel border border-rule space-y-4 shadow-xs">
        <AlertCircle className="w-10 h-10 text-critical-solid mx-auto" />
        <h3 className="text-base font-bold text-ink">Task not found or access restricted</h3>
        <p className="text-xs text-ink-3">
          This task may have been archived or belongs to a client outside your authorized scope.
        </p>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-stamp text-on-stamp text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tasks</span>
        </Link>
      </div>
    );
  }

  const { task, summary, lines, documents, visits, payments, followUps } = data;
  const isOwner = session?.membership.role === 'owner';
  const isCompleted = summary.displayedStatus === 'completed';

  // Sort lines: required first, then sortOrder
  const sortedLines = [...lines].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  // Calculate evidence presence
  const hasFiledReturn = documents.some((d) => d.kind === 'filed_return');
  const hasAcknowledgment = documents.some((d) => d.kind === 'acknowledgment');
  const hasPaymentProof = documents.some((d) => d.kind === 'payment_proof');
  const hasSufficientEvidence = hasFiledReturn || hasAcknowledgment;

  // Determine dynamic primary action button (Spec 11.5.2)
  const primaryActionConfig = (() => {
    const hasWaitingLines = lines.some((l) => l.status === 'requested' || l.status === 'not_requested');
    const hasReviewLines = lines.some((l) => l.status === 'received' || l.status === 'under_review');
    const hasCorrectionLines = lines.some((l) => l.status === 'incomplete' || l.status === 'needs_correction');

    if (hasWaitingLines) {
      return {
        label: 'Request Missing Items',
        action: () => {
          const missing = lines
            .filter((l) => l.status === 'requested' || l.status === 'not_requested')
            .map((l) => `• ${l.label} (${l.copyForm})`)
            .join('\n');
          const msg = `Good day ${summary.client.displayName}. To proceed with your ${task.title || 'BIR filing'}, please provide:\n${missing}\nThank you!`;
          navigator.clipboard?.writeText(msg);
          alert(`Draft request copied to clipboard!\n\n${msg}`);
        },
        icon: <Send className="w-3.5 h-3.5" />,
      };
    }

    if (hasReviewLines) {
      return {
        label: 'Review Received Lines',
        action: () => {
          const el = document.getElementById('checklist-section');
          el?.scrollIntoView({ behavior: 'smooth' });
        },
        icon: <Stamp className="w-3.5 h-3.5" />,
      };
    }

    if (hasCorrectionLines) {
      return {
        label: 'Request Corrections',
        action: () => {
          const corrections = lines
            .filter((l) => l.status === 'incomplete' || l.status === 'needs_correction')
            .map((l) => `• ${l.label}: ${l.flagNote || 'Needs updated copy'}`)
            .join('\n');
          const msg = `Attention ${summary.client.displayName}: corrections needed for:\n${corrections}`;
          navigator.clipboard?.writeText(msg);
          alert(`Correction request copied to clipboard:\n\n${msg}`);
        },
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    }

    // All accepted desk filing
    if (!task.officeAction && summary.displayedStatus !== 'submitted' && !isCompleted) {
      return {
        label: 'Mark Submitted',
        action: () => setIsSubmitOpen(true),
        icon: <Send className="w-3.5 h-3.5" />,
      };
    }

    // All accepted office action needed
    if (task.officeAction && summary.displayedStatus !== 'submitted' && !isCompleted) {
      if (visits.length > 0) {
        return {
          label: 'Open Planned Visit',
          action: () => navigate(`/visits/${visits[0].visit.visit.id}`),
          icon: <Building2 className="w-3.5 h-3.5" />,
        };
      }
      return {
        label: 'Add to Office Visit',
        action: () => navigate('/visits/plan'),
        icon: <Building2 className="w-3.5 h-3.5" />,
      };
    }

    if (summary.displayedStatus === 'submitted') {
      return {
        label: 'Mark Completed',
        action: () => setIsCompleteOpen(true),
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    }

    if (isCompleted) {
      return {
        label: 'Reopen Task',
        action: () => {
          if (confirm('Reopen this completed obligation back to in preparation?')) {
            setTaskStatus.mutate({ id: task.id, to: 'in_preparation', reason: 'Reopened by operator' });
          }
        },
        icon: <RotateCcw className="w-3.5 h-3.5" />,
      };
    }

    return null;
  })();

  // Format due source display note
  const dueSourceNote = (() => {
    if (task.dueSource.kind === 'deadline_move') {
      return `Moved deadline · ${task.dueSource.ref || 'BIR Advisory'}`;
    }
    if (task.dueSource.kind === 'override') {
      return `Overridden · ${task.dueSource.ref || 'Operator'}`;
    }
    if (task.dueSource.kind === 'manual') {
      return 'Manual schedule';
    }
    return 'Template default statutory schedule';
  })();

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Navigation Top Bar */}
      <div className="flex items-center justify-between no-print">
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tasks</span>
        </Link>

        {/* Task Actions Overflow Menu */}
        <div className="flex items-center gap-2">
          {primaryActionConfig && (
            <Button
              variant="primary"
              size="sm"
              onClick={primaryActionConfig.action}
              icon={primaryActionConfig.icon}
              className="text-xs font-bold"
            >
              {primaryActionConfig.label}
            </Button>
          )}

          {/* Action dropdown */}
          <div className="relative group">
            <button type="button" aria-label="More actions" aria-haspopup="menu" className="p-1.5 text-ink-3 hover:text-ink rounded-control bg-sheet-2 border border-rule hover:bg-sheet-3">
              <MoreVertical className="w-4 h-4" />
            </button>
            <div className="absolute right-0 mt-1 w-52 bg-sheet border border-rule rounded-panel shadow-md py-1 z-30 hidden group-hover:block group-focus-within:block hover:block">
              {isOwner && (
                <>
                  <button
                    onClick={() => setIsOverrideOpen(true)}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-sheet-2 font-medium flex items-center justify-between"
                  >
                    <span>Override Status</span>
                    <Lock className="w-3 h-3 text-ink-3" />
                  </button>
                  <button
                    onClick={() => setIsChangeDueOpen(true)}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-sheet-2 font-medium flex items-center justify-between"
                  >
                    <span>Change Due Date</span>
                    <Calendar className="w-3 h-3 text-ink-3" />
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  const targetUser = task.ownerUserId === 'user-ana' ? 'user-ben' : 'user-ana';
                  const name = targetUser === 'user-ana' ? 'Ana Santos' : 'Ben Morales';
                  if (confirm(`Reassign this task to ${name}?`)) {
                    updateTask.mutate({ id: task.id, updates: { version: task.version, ownerUserId: targetUser } });
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-sheet-2 font-medium"
              >
                Reassign to {task.ownerUserId === 'user-ana' ? 'Ben Morales' : 'Ana Santos'}
              </button>
              <button
                onClick={() => {
                  duplicateTask.mutate(task.id, {
                    onSuccess: (newT: { id: string }) => {
                      alert('Task duplicated for next period!');
                      navigate(`/tasks/${newT.id}`);
                    },
                  });
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-sheet-2 font-medium"
              >
                Duplicate for Next Period
              </button>
              <button
                onClick={() => window.print()}
                className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-sheet-2 font-medium"
              >
                Print Client Checklist
              </button>
              <div className="border-t border-rule my-1" />
              <button
                onClick={() => setIsArchiveOpen(true)}
                className="w-full text-left px-3 py-1.5 text-xs text-critical-fg hover:bg-critical-bg font-semibold"
              >
                Archive Task
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Header Card */}
      <div className="bg-sheet border border-rule rounded-panel p-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            {/* Client folder tab & code */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/clients/${summary.client.id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sheet-2 border border-rule hover:bg-sheet-3 transition-colors text-xs font-bold text-ink"
              >
                <span className="font-mono text-stamp font-black">[{summary.client.code}]</span>
                <span>{summary.client.displayName}</span>
                <ChevronRight className="w-3 h-3 text-ink-3" />
              </Link>

              {task.period && (
                <span className="px-2 py-0.5 rounded bg-sheet-3 border border-rule text-xs font-semibold text-ink-2">
                  Period: {periodLabel(task.period)}
                </span>
              )}

              <div className="flex items-center gap-1.5">
                <StatusChip status={summary.displayedStatus} />
                {task.statusOverride && (
                  <span
                    title={`Overridden by ${task.statusOverride.by}: ${task.statusOverride.reason}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-warn-fg bg-warn-bg px-2 py-0.5 rounded-chip border border-warn-bd"
                  >
                    <span>Overridden</span>
                    {isOwner && (
                      <button
                        onClick={() => clearOverride.mutate({ id: task.id, reason: 'Cleared by owner' })}
                        className="hover:underline ml-1 text-ink-3"
                        title="Clear override"
                      >
                        (Clear)
                      </button>
                    )}
                  </span>
                )}
              </div>

              <DueBadge
                state={summary.dueState}
                dueDate={task.dueDate}
                isCompleted={isCompleted}
                completedDate={task.completedAt ? task.completedAt.slice(0, 10) : undefined}
              />
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-black text-ink tracking-tight font-sans">
              {task.title || (task.templateId ? `Obligation ${task.templateId}` : 'Tax Filing')}
            </h1>

            {/* Due Source note */}
            <p className="text-xs text-ink-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-ink-3" />
              <span>Due {formatDate(task.dueDate)} · {dueSourceNote}</span>
            </p>

            {/* Next Action Line (Section 11.5.1) */}
            <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-ink uppercase tracking-wider text-[10px]">Next:</span>
              {task.nextAction ? (
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-sheet-2 border border-rule text-ink">
                  <span className="font-semibold">{task.nextAction.text}</span>
                  {task.nextAction.due && (
                    <span className="text-ink-3 font-medium">· by {formatDate(task.nextAction.due)}</span>
                  )}
                  <span className="text-[10px] uppercase font-bold text-stamp bg-stamp-soft px-1.5 py-0.2 rounded">
                    {task.nextAction.owner}
                  </span>
                </div>
              ) : (
                <span className="text-ink-3 italic">None scheduled</span>
              )}

              <button
                onClick={() => {
                  setNextActionText(task.nextAction?.text || '');
                  setNextActionDue(task.nextAction?.due || '');
                  setIsEditingNextAction(true);
                }}
                className="text-xs font-bold text-stamp hover:underline"
              >
                [edit next action]
              </button>
            </div>
          </div>

          {/* Large Done Stamp if Completed with evidence */}
          {isCompleted && (
            <div className="shrink-0 p-2">
              <ReviewStamp
                variant="done"
                id={task.id}
                date={task.completedAt ? formatDate(task.completedAt.slice(0, 10)) : 'COMPLETED'}
                evidenceCount={documents.length}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Warnings, Checklists, Evidence, Notes (2 Cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Unverified template warning */}
          {task.templateId && summary.task.dueSource.ref?.includes('Unverified') && (
            <div className="p-3.5 rounded-panel bg-warn-bg border border-warn-bd text-warn-fg flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Unverified requirements</p>
                <p className="text-[11px] mt-0.5">
                  Confirm statutory forms and attachments with BIR RDO before relying on this checklist.
                </p>
              </div>
            </div>
          )}

          {/* Blocking banner */}
          {summary.blockingReason && (
            <div className="p-3.5 rounded-panel bg-serious-bg border border-serious-bd text-serious-fg flex items-start gap-2.5 text-xs">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Task is currently blocked</p>
                <p className="text-[11px] mt-0.5">{summary.blockingReason}</p>
              </div>
            </div>
          )}

          {/* Checklist Section (11.5.3) */}
          <div id="checklist-section" className="bg-sheet border border-rule rounded-panel shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-rule flex items-center justify-between bg-sheet-2">
              <div className="flex items-center gap-2">
                <Stamp className="w-4 h-4 text-stamp" />
                <h2 className="text-xs font-black uppercase tracking-wider text-ink font-sans">
                  Requirements Checklist
                </h2>
                <span className="text-xs font-bold text-ink-3">
                  ({summary.acceptedLineCount} of {summary.requiredLineCount} accepted)
                </span>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAddLineOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs no-print"
              >
                Add line
              </Button>
            </div>

            <div className="divide-y divide-rule">
              {sortedLines.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-3">
                  No requirements listed. Click &quot;Add line&quot; to define a document or form.
                </div>
              ) : (
                sortedLines.map((line) => {
                  const isAccepted = line.status === 'accepted';
                  const isAddedLate =
                    line.lateDiscovered || isLateDiscovered(task, new Date().toISOString().slice(0, 10));

                  return (
                    <div
                      key={line.id}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isAccepted ? 'bg-good-bg/10' : 'hover:bg-sheet-2/60'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isAccepted ? (
                            <ReviewStamp
                              variant="line"
                              id={line.id}
                              initials={line.reviewedBy === 'user-ben' ? 'BEN M.' : 'ANA S.'}
                              date={line.reviewedAt ? formatDate(line.reviewedAt.slice(0, 10)) : 'ACCEPTED'}
                            />
                          ) : (
                            <LineChip status={line.status} />
                          )}

                          {line.required ? (
                            <span className="text-[10px] font-bold text-stamp uppercase bg-stamp-soft px-1.5 py-0.2 rounded">
                              Required
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-ink-3 bg-sheet-3 px-1.5 py-0.2 rounded">
                              Optional
                            </span>
                          )}

                          <span className="text-[11px] text-ink-3 capitalize font-mono">
                            {line.copyForm.replace(/_/g, ' ')}
                            {line.copies && line.copies > 1 ? ` · ${line.copies} copies` : ''}
                          </span>

                          {line.printAndBring && (
                            <span className="text-[10px] font-bold text-stamp bg-stamp-soft px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Printer className="w-3 h-3" />
                              <span>Bring to Office</span>
                            </span>
                          )}

                          {isAddedLate && (
                            <span className="text-[10px] font-bold text-warn-fg bg-warn-bg px-1.5 py-0.5 rounded border border-warn-bd">
                              Added late
                            </span>
                          )}
                        </div>

                        <div className="text-sm font-bold text-ink">{line.label}</div>

                        {line.flagNote && (
                          <p className="text-xs font-semibold text-serious-fg">
                            Correction note: {line.flagNote}
                          </p>
                        )}
                        {line.reviewNote && (
                          <p className="text-xs font-medium text-good-fg">
                            Review note: {line.reviewNote}
                          </p>
                        )}
                      </div>

                      {/* Line Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* 1. Upload simulation (Section 11.5.3 QA: Sets to Received, never Accepted) */}
                        {!isAccepted && line.status !== 'received' && (
                          <button
                            onClick={() => {
                              setLineStatus.mutate({
                                id: line.id,
                                to: 'received',
                                extra: { note: 'Client document received' },
                              });
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-sheet-2 border border-rule text-ink hover:bg-sheet-3 flex items-center gap-1"
                            title="Simulate client uploading document"
                          >
                            <Upload className="w-3 h-3 text-ink-3" />
                            <span>Mark Received</span>
                          </button>
                        )}

                        {/* 2. Accept (Stamp) */}
                        {!isAccepted && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setRecentStampedLineId(line.id);
                              setLineStatus.mutate({
                                id: line.id,
                                to: 'accepted',
                                extra: { note: 'Accepted and verified' },
                              });
                            }}
                            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            className="text-xs font-bold bg-good-solid hover:bg-good-solid/90 text-on-good-solid"
                          >
                            Stamp Accept
                          </Button>
                        )}

                        {/* 3. Flag / Correction */}
                        {line.status !== 'needs_correction' && !isAccepted && (
                          <button
                            onClick={() => {
                              const note = prompt('Specify what needs correction:');
                              if (note) {
                                setLineStatus.mutate({
                                  id: line.id,
                                  to: 'needs_correction',
                                  extra: { note },
                                });
                              }
                            }}
                            className="px-2 py-1 text-xs font-semibold rounded bg-sheet-2 border border-rule text-serious-fg hover:bg-sheet-3"
                          >
                            Flag Issue
                          </button>
                        )}

                        {/* 4. Not Applicable */}
                        {line.status !== 'not_applicable' && !isAccepted && (
                          <button
                            onClick={() => {
                              setLineStatus.mutate({ id: line.id, to: 'not_applicable' });
                            }}
                            className="px-2 py-1 text-xs font-medium text-ink-3 hover:text-ink"
                          >
                            N/A
                          </button>
                        )}

                        {/* 5. Reopen */}
                        {isAccepted && (
                          <button
                            onClick={() => {
                              const reason = prompt('Reason to reopen accepted item:');
                              if (reason) {
                                setLineStatus.mutate({
                                  id: line.id,
                                  to: 'under_review',
                                  extra: { reason },
                                });
                              }
                            }}
                            className="px-2 py-1 text-xs font-semibold text-ink-3 hover:text-ink"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Evidence Grid (11.5.4) */}
          <div className="bg-sheet border border-rule rounded-panel p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-ink font-sans">
                Statutory Evidence Files
              </h2>
              <span className="text-xs text-ink-3">
                {documents.length} files attached
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Filed return tile */}
              <div
                className={`p-3 rounded-control border text-xs flex flex-col justify-between min-h-[90px] ${
                  hasFiledReturn
                    ? 'bg-good-bg/20 border-good-bd text-good-fg'
                    : 'bg-sheet-2 border-dashed border-rule text-ink-3'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center justify-between">
                    <span>Filed Return</span>
                    {hasFiledReturn && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-[11px] mt-1 opacity-90">
                    {hasFiledReturn ? 'Bir return uploaded' : 'Missing return copy'}
                  </p>
                </div>
                {!hasFiledReturn && (
                  <button
                    onClick={() => alert('Simulated return upload attached!')}
                    className="mt-2 text-xs font-bold text-stamp hover:underline text-left"
                  >
                    + Upload Return
                  </button>
                )}
              </div>

              {/* Acknowledgment tile */}
              <div
                className={`p-3 rounded-control border text-xs flex flex-col justify-between min-h-[90px] ${
                  hasAcknowledgment
                    ? 'bg-good-bg/20 border-good-bd text-good-fg'
                    : 'bg-sheet-2 border-dashed border-rule text-ink-3'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center justify-between">
                    <span>Acknowledgment Receipt</span>
                    {hasAcknowledgment && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-[11px] mt-1 opacity-90">
                    {hasAcknowledgment ? 'eFPS confirmation attached' : 'Pending BIR confirmation'}
                  </p>
                </div>
                {!hasAcknowledgment && (
                  <button
                    onClick={() => alert('Simulated acknowledgment uploaded!')}
                    className="mt-2 text-xs font-bold text-stamp hover:underline text-left"
                  >
                    + Upload Acknowledgment
                  </button>
                )}
              </div>

              {/* Payment proof tile (if payment expected) */}
              <div
                className={`p-3 rounded-control border text-xs flex flex-col justify-between min-h-[90px] ${
                  hasPaymentProof
                    ? 'bg-good-bg/20 border-good-bd text-good-fg'
                    : 'bg-sheet-2 border-dashed border-rule text-ink-3'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center justify-between">
                    <span>Payment Proof</span>
                    {hasPaymentProof && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-[11px] mt-1 opacity-90">
                    {hasPaymentProof ? 'Bank deposit validated' : 'Payment receipt missing'}
                  </p>
                </div>
                {!hasPaymentProof && (
                  <button
                    onClick={() => alert('Simulated bank payment proof uploaded!')}
                    className="mt-2 text-xs font-bold text-stamp hover:underline text-left"
                  >
                    + Upload Payment Proof
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Rail: Details, Authorizations, Visits, Payments (11.5.5) */}
        <div className="space-y-5">
          {/* Details Card */}
          <div className="bg-sheet border border-rule rounded-panel p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-ink font-sans">
              Obligation Details
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-rule">
                <span className="text-ink-3">Filing Channel</span>
                <span className="font-semibold text-ink uppercase font-mono">
                  {task.channel || 'eBIRForms / Desk'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-rule">
                <span className="text-ink-3">Assigned Owner</span>
                <span className="font-semibold text-ink">
                  {task.ownerUserId === 'user-ana' ? 'Ana Santos (Owner)' : 'Ben Morales (Helper)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-rule">
                <span className="text-ink-3">Statutory RDO</span>
                <span className="font-semibold text-ink">
                  {summary.client.rdoCode ? `RDO ${summary.client.rdoCode}` : 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-rule">
                <span className="text-ink-3">Office Action Needed</span>
                <span className="font-semibold text-ink">
                  {task.officeAction ? 'Yes (Requires RDO Visit)' : 'No (Desk Filing)'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-3">Payment Expected</span>
                <span className="font-semibold text-ink">
                  {task.paymentExpected ? 'Yes (Tax Due)' : 'No (Zero / Pure Filing)'}
                </span>
              </div>
            </div>
          </div>

          {/* Authorization Card (11.5.5) */}
          <div className="bg-sheet border border-rule rounded-panel p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-ink font-sans">
                Authorization Coverage
              </h3>
              <ShieldCheck className="w-4 h-4 text-stamp" />
            </div>

            {task.officeAction ? (
              <div className="p-3 rounded-control bg-good-bg/15 border border-good-bd text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-good-fg">
                  <span>Special Power of Attorney (SPA)</span>
                  <span className="text-[10px] bg-good-bg text-good-fg px-1.5 py-0.2 rounded font-mono">
                    VALID
                  </span>
                </div>
                <p className="text-[11px] text-ink-2">
                  Covers filing and claims for {summary.client.displayName}
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-3">
                Desk filing — no office SPA required for digital submission.
              </p>
            )}
          </div>

          {/* Visits for this task */}
          <div className="bg-sheet border border-rule rounded-panel p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-ink font-sans">
                Office Visits
              </h3>
              <Building2 className="w-4 h-4 text-ink-3" />
            </div>

            {visits.length === 0 ? (
              <p className="text-xs text-ink-3">
                No office visit scheduled for this task.
              </p>
            ) : (
              <div className="space-y-2">
                {visits.map((v, idx) => (
                  <Link
                    key={v.item.id}
                    to={`/visits/${v.visit.visit.id}`}
                    className="p-2.5 rounded-control bg-sheet-2 border border-rule hover:bg-sheet-3 block text-xs space-y-1 transition-colors"
                  >
                    <div className="flex items-center justify-between font-bold text-ink">
                      <span>Visit #{idx + 1}</span>
                      <span className="text-[11px] text-ink-3">
                        {formatDate(v.visit.visit.plannedDate)}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-3">
                      Target Office: {v.visit.visit.officeType.toUpperCase()}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Open Follow-Ups */}
          <div className="bg-sheet border border-rule rounded-panel p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-ink font-sans">
                Follow-ups ({followUps.length})
              </h3>
              <MessageSquare className="w-4 h-4 text-ink-3" />
            </div>

            {followUps.length === 0 ? (
              <p className="text-xs text-ink-3">No active client reminders sent.</p>
            ) : (
              <div className="space-y-2">
                {followUps.map((fu) => (
                  <div
                    key={fu.followUp.id}
                    className="p-2.5 rounded-control bg-sheet-2 border border-rule text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-ink">
                      <span className="capitalize">{fu.followUp.channel}</span>
                      <span className="text-[10px] text-ink-3">
                        {fu.attempts.length} attempts
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-2 truncate">
                      {fu.lines.map((l) => l.label).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Action Modals */}
      <MarkSubmittedDialog
        open={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        task={task}
      />

      <MarkCompletedDialog
        open={isCompleteOpen}
        onClose={() => setIsCompleteOpen(false)}
        task={task}
        hasEvidence={hasSufficientEvidence}
      />

      <OverrideStatusDialog
        open={isOverrideOpen}
        onClose={() => setIsOverrideOpen(false)}
        task={task}
      />

      <ChangeDueDateDialog
        open={isChangeDueOpen}
        onClose={() => setIsChangeDueOpen(false)}
        task={task}
      />

      <AddChecklistLineModal
        open={isAddLineOpen}
        onClose={() => setIsAddLineOpen(false)}
        taskId={task.id}
      />

      <ArchiveTaskDialog
        open={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        task={task}
      />

      {/* Quick Edit Next Action Modal */}
      <ModalDialog
        open={isEditingNextAction}
        onClose={() => setIsEditingNextAction(false)}
        maxWidth="max-w-sm"
        ariaLabel="Update Next Action"
        panelClassName="p-5 space-y-4"
      >
            <h3 className="text-sm font-bold text-ink font-sans">Update Next Action</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Action Description</label>
                <input
                  type="text"
                  value={nextActionText}
                  onChange={(e) => setNextActionText(e.target.value)}
                  placeholder="e.g. Call client for signed 2307"
                  className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-focus"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Target Due Date</label>
                <input
                  type="date"
                  value={nextActionDue}
                  onChange={(e) => setNextActionDue(e.target.value)}
                  className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-focus"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-rule">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingNextAction(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (nextActionText.trim()) {
                    setNextAction.mutate({
                      id: task.id,
                      next: {
                        text: nextActionText.trim(),
                        owner: 'operator',
                        due: nextActionDue || undefined,
                      },
                    });
                  } else {
                    setNextAction.mutate({ id: task.id, next: null });
                  }
                  setIsEditingNextAction(false);
                }}
              >
                Save
              </Button>
            </div>
          </ModalDialog>
    </div>
  );
}
