import React, { useState } from 'react';
import { useTasks } from '@/hooks/useData';
import { TASK_STATUS_META } from '@/domain/labels';
import { formatDate } from '@/lib/format';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckSquare, Filter, Plus, Lock, Calendar, Layers, LayoutList } from 'lucide-react';
import type { StatusGroup } from '@/domain/types';

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentGroup = (searchParams.get('group') as StatusGroup) || undefined;
  const viewMode = searchParams.get('view') || 'list';
  const [search, setSearch] = useState('');

  const { data, isLoading } = useTasks({
    statusGroup: currentGroup,
    search: search || undefined,
  });

  const tasks = data?.items || [];

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Tasks</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Monitor filing deadlines, required client documents, and preparation states
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/open-period"
            className="px-3 py-1.5 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3"
          >
            Open Filing Period
          </Link>
          <Link
            to="/tasks/new"
            className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </Link>
        </div>
      </div>

      {/* Filter Chips & View Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { label: 'All Tasks', value: undefined },
            { label: 'Blocked', value: 'blocked' },
            { label: 'In Progress', value: 'in_progress' },
            { label: 'Ready', value: 'ready' },
            { label: 'Submitted', value: 'submitted' },
            { label: 'Completed', value: 'done' },
          ].map((tab) => {
            const isSelected = currentGroup === tab.value;
            return (
              <button
                key={tab.label}
                onClick={() => {
                  if (tab.value) searchParams.set('group', tab.value);
                  else searchParams.delete('group');
                  setSearchParams(searchParams);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-chip border transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-stamp text-on-stamp border-stamp'
                    : 'bg-sheet text-ink-2 border-rule hover:bg-sheet-2'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-control bg-sheet border border-rule text-ink placeholder:text-ink-3 w-48"
          />
        </div>
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-16 bg-sheet-3 rounded-panel animate-pulse" />
          <div className="h-16 bg-sheet-3 rounded-panel animate-pulse" />
          <div className="h-16 bg-sheet-3 rounded-panel animate-pulse" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3 space-y-2">
          <CheckSquare className="w-8 h-8 text-ink-3 mx-auto" />
          <p className="text-sm font-semibold text-ink">No tasks match current filter</p>
          <p className="text-xs">Adjust your status filter or create a new filing task.</p>
        </div>
      ) : (
        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {tasks.map((summary) => {
            const statusMeta = TASK_STATUS_META[summary.displayedStatus];
            return (
              <Link
                key={summary.task.id}
                to={`/tasks/${summary.task.id}`}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sheet-2 transition-colors group"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-ink truncate group-hover:text-stamp transition-colors">
                      {summary.client.displayName}
                    </span>
                    <span className="text-[11px] font-semibold text-ink-3">({summary.client.code})</span>
                    <span
                      className={`px-2 py-0.5 rounded-chip text-[11px] font-semibold border ${
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
                    {summary.task.period && (
                      <span className="text-[11px] text-ink-3 bg-sheet-2 px-1.5 py-0.5 rounded">
                        {summary.task.period}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-ink">{summary.task.title || 'Filing Return Task'}</h3>

                  {summary.blockingReason && (
                    <div className="text-xs text-serious-fg font-medium flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{summary.blockingReason}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0 sm:text-right">
                  <div className="text-xs">
                    <div className="font-semibold text-ink">
                      {summary.acceptedLineCount} / {summary.requiredLineCount} items accepted
                    </div>
                    <div
                      className={`text-[11px] font-medium ${
                        summary.dueState === 'overdue'
                          ? 'text-critical-fg font-bold'
                          : summary.dueState === 'due_today'
                          ? 'text-warn-fg font-bold'
                          : 'text-ink-3'
                      }`}
                    >
                      Due {formatDate(summary.task.dueDate)}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
