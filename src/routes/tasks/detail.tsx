import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTask, useSetLineStatus, useSetTaskStatus } from '@/hooks/useData';
import { TASK_STATUS_META, LINE_STATUS_META } from '@/domain/labels';
import { formatDate } from '@/lib/format';
import {
  ArrowLeft,
  Stamp,
  CheckCircle2,
  AlertCircle,
  Lock,
  Plus,
  Send,
  Calendar,
  FileText,
  User,
  Clock,
  Printer,
} from 'lucide-react';
import type { LineStatus } from '@/domain/types';

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { data, isLoading, error } = useTask(taskId || '');
  const setLineStatus = useSetLineStatus();
  const setTaskStatus = useSetTaskStatus();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-sheet-3 rounded" />
        <div className="h-20 bg-sheet-3 rounded-panel" />
        <div className="h-64 bg-sheet-3 rounded-panel" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-sheet rounded-panel border border-rule space-y-3">
        <AlertCircle className="w-8 h-8 text-critical-solid mx-auto" />
        <h3 className="text-sm font-bold text-ink">Task not found or access restricted</h3>
        <Link to="/tasks" className="text-xs text-stamp hover:underline font-semibold">
          &larr; Back to tasks
        </Link>
      </div>
    );
  }

  const { task, summary, lines, documents, visits, payments } = data;
  const statusMeta = TASK_STATUS_META[summary.displayedStatus];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tasks</span>
        </Link>
      </div>

      {/* Task Header Card */}
      <div className="bg-sheet border border-rule rounded-panel p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-stamp bg-stamp-soft px-2 py-0.5 rounded-chip">
                {summary.client.displayName} ({summary.client.code})
              </span>
              <span
                className={`px-2 py-0.5 rounded-chip text-xs font-bold border ${
                  statusMeta.tone === 'good'
                    ? 'bg-good-bg text-good-fg border-good-bd'
                    : statusMeta.tone === 'warn'
                    ? 'bg-warn-bg text-warn-fg border-warn-bd'
                    : statusMeta.tone === 'serious'
                    ? 'bg-serious-bg text-serious-fg border-serious-bd'
                    : 'bg-sheet-2 text-ink-2 border-rule'
                }`}
              >
                {statusMeta.label}
              </span>
              {task.period && (
                <span className="text-xs font-medium text-ink-3 bg-sheet-2 px-2 py-0.5 rounded">
                  Period: {task.period}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-sans">
              {task.title || 'Filing Task'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {summary.displayedStatus === 'ready_next_step' && (
              <button
                onClick={() => {
                  const ref = prompt('Enter submission confirmation number / acknowledgment ref:');
                  if (ref) {
                    setTaskStatus.mutate({ id: task.id, to: 'submitted', reason: `Submitted: ${ref}` });
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Mark Submitted</span>
              </button>
            )}

            {summary.displayedStatus === 'submitted' && (
              <button
                onClick={() => {
                  if (confirm('Mark this task as fully completed?')) {
                    setTaskStatus.mutate({ id: task.id, to: 'completed' });
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-control bg-good-solid text-on-good-solid hover:opacity-90 shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Completed</span>
              </button>
            )}
          </div>
        </div>

        {/* Task Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-rule text-xs">
          <div>
            <span className="text-ink-3 block">Due Date</span>
            <span className="font-semibold text-ink">{formatDate(task.dueDate)}</span>
          </div>
          <div>
            <span className="text-ink-3 block">RDO Office</span>
            <span className="font-semibold text-ink">{summary.client.rdoCode ? `RDO ${summary.client.rdoCode}` : '—'}</span>
          </div>
          <div>
            <span className="text-ink-3 block">Next Action</span>
            <span className="font-semibold text-ink">{task.nextAction?.text || 'None scheduled'}</span>
          </div>
          <div>
            <span className="text-ink-3 block">Acceptance Progress</span>
            <span className="font-semibold text-ink">
              {summary.acceptedLineCount} of {summary.requiredLineCount} items
            </span>
          </div>
        </div>
      </div>

      {/* Checklist Lines Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stamp className="w-4 h-4 text-stamp" />
            <h2 className="text-sm font-bold tracking-tight text-ink uppercase">Document Requirements Checklist</h2>
          </div>
        </div>

        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {lines.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-3">No requirement lines defined for this task.</div>
          ) : (
            lines.map((line) => {
              const meta = LINE_STATUS_META[line.status];
              const isAccepted = line.status === 'accepted';
              return (
                <div
                  key={line.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isAccepted ? 'bg-good-bg/10' : 'hover:bg-sheet-2'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAccepted ? (
                        <div className="border-2 border-stamp text-stamp px-2 py-0.5 rounded-stamp font-black text-[10px] tracking-wider uppercase flex items-center gap-1 shadow-xs transform -rotate-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ACCEPTED</span>
                        </div>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-chip text-[11px] font-semibold border ${
                            meta.tone === 'good'
                              ? 'bg-good-bg text-good-fg border-good-bd'
                              : meta.tone === 'warn'
                              ? 'bg-warn-bg text-warn-fg border-warn-bd'
                              : meta.tone === 'serious'
                              ? 'bg-serious-bg text-serious-fg border-serious-bd'
                              : 'bg-sheet-2 text-ink-2 border-rule'
                          }`}
                        >
                          {meta.label}
                        </span>
                      )}

                      <span className="text-xs text-ink-3 capitalize">
                        Form: {line.copyForm.replace(/_/g, ' ')}
                      </span>
                      {line.copies && <span className="text-xs text-ink-3">({line.copies} copies)</span>}
                      {line.printAndBring && (
                        <span className="text-[10px] bg-stamp-soft text-stamp font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Printer className="w-3 h-3" />
                          <span>Bring to Office</span>
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-bold text-ink">{line.label}</div>

                    {line.flagNote && (
                      <p className="text-xs text-serious-fg font-medium">Issue Note: {line.flagNote}</p>
                    )}
                    {line.reviewNote && (
                      <p className="text-xs text-good-fg font-medium">Review Note: {line.reviewNote}</p>
                    )}
                  </div>

                  {/* Actions per line */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isAccepted && (
                      <button
                        onClick={() => {
                          setLineStatus.mutate({
                            id: line.id,
                            to: 'accepted',
                            extra: { note: 'Verified by operator' },
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-control bg-good-solid text-on-good-solid hover:opacity-90 flex items-center gap-1 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept (Stamp)</span>
                      </button>
                    )}

                    {line.status !== 'needs_correction' && (
                      <button
                        onClick={() => {
                          const note = prompt('Enter flag/correction details:');
                          if (note) {
                            setLineStatus.mutate({ id: line.id, to: 'needs_correction', extra: { note } });
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-control bg-sheet-2 border border-rule text-serious-fg hover:bg-sheet-3"
                      >
                        Flag Issue
                      </button>
                    )}

                    {isAccepted && (
                      <button
                        onClick={() => {
                          const reason = prompt('Reason to reopen accepted item:');
                          if (reason) {
                            setLineStatus.mutate({ id: line.id, to: 'under_review', extra: { reason } });
                          }
                        }}
                        className="px-2 py-1 text-xs text-ink-3 hover:text-ink"
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
    </div>
  );
}
