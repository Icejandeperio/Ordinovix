import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useTasks,
  useClients,
  useSession,
  useSetTaskStatus,
} from '@/hooks/useData';
import { StatusChip, DueBadge } from '@/components/ui/status-chip';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/format';
import { canSetStatus } from '@/domain/rules';
import { TASK_STATUS_META } from '@/domain/labels';
import { OpenPeriodModal } from '@/components/tasks/open-period-modal';
import { NewTaskSheet } from '@/components/tasks/new-task-sheet';
import {
  MarkSubmittedDialog,
  MarkCompletedDialog,
  OverrideStatusDialog,
} from '@/components/tasks/task-modals';
import type { TaskSummary, TaskStatus, TaskKind, StatusGroup, Task } from '@/domain/types';
import {
  Plus,
  LayoutList,
  Kanban,
  Search,
  Filter,
  Lock,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  MoreVertical,
  Layers,
  Building2,
  User,
  X,
  FileText,
  AlertCircle,
  ExternalLink,
  GripVertical,
} from 'lucide-react';
import { QueryState } from '@/components/ui/query-state';

type TabView =
  | 'all_open'
  | 'my_tasks'
  | 'overdue'
  | 'blocked'
  | 'needs_review'
  | 'ready_visit'
  | 'ready_desk'
  | 'submitted'
  | 'completed';

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: session } = useSession();
  const { data: clientsData } = useClients();
  const setTaskStatus = useSetTaskStatus();

  // URL state
  const viewMode = (searchParams.get('view') as 'list' | 'board') || 'list';
  const activeTab = (searchParams.get('tab') as TabView) || 'all_open';
  const selectedClient = searchParams.get('clientId') || '';
  const selectedGroup = (searchParams.get('group') as StatusGroup) || '';
  const selectedKind = (searchParams.get('kind') as TaskKind) || '';
  const selectedOwner = searchParams.get('owner') || '';
  const selectedPeriod = searchParams.get('period') || '';

  // Local state
  const [search, setSearch] = useState('');
  const [isOpenPeriodOpen, setIsOpenPeriodOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // Modals for board transitions
  const [submittedModalTask, setSubmittedModalTask] = useState<Task | null>(null);
  const [completedModalTask, setCompletedModalTask] = useState<Task | null>(null);
  const [overrideModalTask, setOverrideModalTask] = useState<Task | null>(null);

  // Kanban drag-and-drop & feedback state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [boardNotice, setBoardNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!boardNotice) return;
    const timer = setTimeout(() => setBoardNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [boardNotice]);

  // Load all tasks (we do client-side filtering for ultra-responsive tabs & filters)
  const { data, isLoading, isError, error, refetch } = useTasks();
  const allSummaries = data?.items || [];
  const clients = clientsData?.items || [];

  const updateParam = (key: string, val: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val);
    else next.delete(key);
    setSearchParams(next);
  };

  // Distinct periods for filter dropdown
  const periods = useMemo(() => {
    const set = new Set<string>();
    allSummaries.forEach((s) => {
      if (s.task.period) set.add(s.task.period);
    });
    return Array.from(set).sort().reverse();
  }, [allSummaries]);

  // Tab filtering logic
  const tabFiltered = useMemo(() => {
    const userId = session?.user.id;
    return allSummaries.filter((s) => {
      switch (activeTab) {
        case 'all_open':
          return s.displayedStatus !== 'completed' && s.displayedStatus !== 'archived';
        case 'my_tasks':
          return (
            s.task.ownerUserId === userId &&
            s.displayedStatus !== 'completed' &&
            s.displayedStatus !== 'archived'
          );
        case 'overdue':
          return s.dueState === 'overdue' && s.displayedStatus !== 'completed';
        case 'blocked':
          return s.statusGroup === 'blocked';
        case 'needs_review':
          return s.displayedStatus === 'review_required';
        case 'ready_visit':
          return (
            s.task.officeAction &&
            s.acceptedLineCount >= s.requiredLineCount &&
            s.requiredLineCount > 0 &&
            s.displayedStatus !== 'completed'
          );
        case 'ready_desk':
          return (
            !s.task.officeAction &&
            s.acceptedLineCount >= s.requiredLineCount &&
            s.requiredLineCount > 0 &&
            s.statusGroup === 'ready'
          );
        case 'submitted':
          return s.displayedStatus === 'submitted';
        case 'completed':
          return s.displayedStatus === 'completed';
        default:
          return true;
      }
    });
  }, [allSummaries, activeTab, session?.user.id]);

  // Dropdown & Search filters
  const filtered = useMemo(() => {
    return tabFiltered.filter((s) => {
      if (selectedClient && s.task.clientId !== selectedClient) return false;
      if (selectedGroup && s.statusGroup !== selectedGroup) return false;
      if (selectedKind && s.task.kind !== selectedKind) return false;
      if (selectedOwner && s.task.ownerUserId !== selectedOwner) return false;
      if (selectedPeriod && s.task.period !== selectedPeriod) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const clientMatch =
          s.client.displayName.toLowerCase().includes(q) ||
          s.client.code.toLowerCase().includes(q);
        const taskMatch =
          (s.task.title && s.task.title.toLowerCase().includes(q)) ||
          (s.task.templateId && s.task.templateId.toLowerCase().includes(q));
        if (!clientMatch && !taskMatch) return false;
      }

      return true;
    });
  }, [tabFiltered, selectedClient, selectedGroup, selectedKind, selectedOwner, selectedPeriod, search]);

  const hasActiveFilters = Boolean(
    selectedClient || selectedGroup || selectedKind || selectedOwner || selectedPeriod || search
  );

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('clientId');
    next.delete('group');
    next.delete('kind');
    next.delete('owner');
    next.delete('period');
    setSearchParams(next);
    setSearch('');
  };

  // Board columns
  const boardColumns: Array<{
    status: TaskStatus;
    label: string;
    isDerived: boolean;
    helper: string;
  }> = [
    { status: 'intake', label: 'Not started', isDerived: true, helper: 'Lines not requested' },
    { status: 'waiting_on_client', label: 'Waiting on client', isDerived: true, helper: 'Awaiting client files' },
    { status: 'review_required', label: 'Needs review', isDerived: true, helper: 'Lines ready to accept' },
    { status: 'needs_correction', label: 'Needs correction', isDerived: true, helper: 'Flagged with client' },
    { status: 'in_preparation', label: 'In preparation', isDerived: false, helper: 'Desk preparation' },
    { status: 'ready_next_step', label: 'Ready for action', isDerived: false, helper: 'Ready to submit/visit' },
    { status: 'submitted', label: 'Submitted', isDerived: false, helper: 'Awaiting acknowledgment' },
    { status: 'completed', label: 'Completed', isDerived: false, helper: 'Last 30 days' },
  ];

  const handleDropTask = (
    summary: TaskSummary,
    targetColStatus: TaskStatus,
    targetIsDerived: boolean,
    targetColLabel: string
  ) => {
    if (targetColStatus === summary.displayedStatus) return;

    if (targetIsDerived) {
      setBoardNotice(
        `Status "${targetColLabel}" is computed automatically from line items. Open task to accept or update lines.`
      );
      return;
    }

    // A blocked task moves only through an owner override with a reason (spec 16.4)
    if (summary.statusGroup === 'blocked' && (targetColStatus === 'submitted' || targetColStatus === 'completed')) {
      setBoardNotice(
        `Cannot move to "${targetColLabel}": ${summary.blockingReason || 'the task is blocked'}. Only an owner override with a reason can change it.`
      );
      return;
    }

    if (targetColStatus === 'submitted') {
      setSubmittedModalTask(summary.task);
      return;
    }

    if (targetColStatus === 'completed') {
      setCompletedModalTask(summary.task);
      return;
    }

    // Operator target column (in_preparation, ready_next_step)
    const role = session?.membership.role || 'helper';
    if (summary.requiredLineCount > summary.acceptedLineCount) {
      if (role === 'owner') {
        setOverrideModalTask(summary.task);
        setBoardNotice(
          `Task has ${summary.requiredLineCount - summary.acceptedLineCount} unaccepted lines. As owner, provide an override reason to bypass.`
        );
      } else {
        setBoardNotice(
          `Cannot move to "${targetColLabel}": ${summary.requiredLineCount - summary.acceptedLineCount} required lines are incomplete.`
        );
      }
      return;
    }

    setTaskStatus.mutate(
      { id: summary.task.id, to: targetColStatus },
      {
        onError: (err: any) => {
          setBoardNotice(err?.message || 'Failed to update task status');
        },
      }
    );
  };

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink font-sans">Tasks</h1>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-stamp/10 text-stamp border border-stamp/20">
              {filtered.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Statutory tax filings, registration updates, and client document collection
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-sheet-2 border border-rule rounded-control">
            <button
              onClick={() => updateParam('view', 'list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-sheet text-ink shadow-xs border border-rule/50'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => updateParam('view', 'board')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                viewMode === 'board'
                  ? 'bg-sheet text-ink shadow-xs border border-rule/50'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsOpenPeriodOpen(true)}
            className="text-xs font-semibold"
          >
            Open Filing Period
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewTaskOpen(true)}
            icon={<Plus className="w-4 h-4" />}
            className="text-xs font-bold"
          >
            New Task
          </Button>
        </div>
      </div>

      {/* 2. Built-in View Tabs */}
      <div className="border-b border-rule flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin no-print">
        {[
          { id: 'all_open', label: 'All open' },
          { id: 'my_tasks', label: 'My tasks' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'blocked', label: 'Blocked by client' },
          { id: 'needs_review', label: 'Needs my review' },
          { id: 'ready_visit', label: 'Ready for a visit' },
          { id: 'ready_desk', label: 'Ready for desk filing' },
          { id: 'submitted', label: 'Submitted — awaiting confirmation' },
          { id: 'completed', label: 'Completed this month' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => updateParam('tab', tab.id === 'all_open' ? null : tab.id)}
              className={`px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-stamp text-stamp'
                  : 'border-transparent text-ink-3 hover:text-ink hover:border-rule-2'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-sheet border border-rule rounded-panel p-3 flex flex-wrap items-center gap-2.5 shadow-2xs no-print">
        {/* Instant Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client or task title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-sheet-2 border border-rule rounded-control text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-focus"
          />
        </div>

        {/* Client filter */}
        <Select
          value={selectedClient}
          onChange={(val) => updateParam('clientId', val || null)}
          className="w-auto min-w-[130px] max-w-[200px]"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.client.id} value={c.client.id}>
              {c.client.code} · {c.client.displayName}
            </option>
          ))}
        </Select>

        {/* Status Group Filter */}
        <Select
          value={selectedGroup}
          onChange={(val) => updateParam('group', val || null)}
          className="w-auto min-w-[140px]"
        >
          <option value="">All Status Groups</option>
          <option value="blocked">Blocked</option>
          <option value="in_progress">In Progress</option>
          <option value="ready">Ready</option>
          <option value="submitted">Submitted</option>
          <option value="done">Completed / Done</option>
        </Select>

        {/* Kind filter */}
        <Select
          value={selectedKind}
          onChange={(val) => updateParam('kind', val || null)}
          className="w-auto min-w-[120px]"
        >
          <option value="">All Kinds</option>
          <option value="filing">Filing Return</option>
          <option value="payment">Tax Payment</option>
          <option value="registration">Registration / COR</option>
          <option value="one_time_transaction">One-Time Transaction (ONETT)</option>
          <option value="lgu">LGU / Mayor's Permit</option>
          <option value="other">Other</option>
        </Select>

        {/* Owner filter */}
        <Select
          value={selectedOwner}
          onChange={(val) => updateParam('owner', val || null)}
          className="w-auto min-w-[130px]"
        >
          <option value="">Assigned To: All</option>
          <option value="user-ana">Ana Santos (Owner)</option>
          <option value="user-ben">Ben Morales (Helper)</option>
        </Select>

        {/* Period filter */}
        <Select
          value={selectedPeriod}
          onChange={(val) => updateParam('period', val || null)}
          className="w-auto min-w-[110px]"
        >
          <option value="">All Periods</option>
          {periods.map((p) => (
            <option key={p} value={p}>
              Period {p}
            </option>
          ))}
        </Select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs font-bold text-ink-3 hover:text-ink px-2 py-1 rounded bg-sheet-3 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* 4. Content Views */}
      {isError ? (
        <QueryState isLoading={false} isError error={error} onRetry={() => refetch()} subject="tasks">
          {null}
        </QueryState>
      ) : isLoading ? (
        <div className="space-y-3">
          <div className="h-16 bg-sheet-3 rounded-panel animate-pulse" />
          <div className="h-16 bg-sheet-3 rounded-panel animate-pulse" />
          <div className="h-16 bg-sheet-3 rounded-panel animate-pulse" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3 space-y-3 shadow-xs">
          <CheckCircle2 className="w-8 h-8 text-ink-3 mx-auto" />
          <h3 className="text-sm font-bold text-ink">No tasks match your criteria</h3>
          <p className="text-xs max-w-sm mx-auto">
            Try adjusting your view tab or clearing active filters. You can also open a new period or create a task.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            {hasActiveFilters && (
              <Button variant="secondary" size="sm" onClick={clearFilters} className="text-xs">
                Reset Filters
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNewTaskOpen(true)}
              className="text-xs"
            >
              Create New Task
            </Button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* ================= LIST / TABLE VIEW ================= */
        <div className="bg-sheet border border-rule rounded-panel overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-sheet-2 border-b border-rule text-ink-3 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 whitespace-nowrap">Client</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Task / Obligation</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Period</th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[110px]">Status</th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[125px]">Due Date</th>
                  <th className="py-2.5 px-3 min-w-[130px] whitespace-nowrap">Ready Progress</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Next Action</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Owner</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap actions-col no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {filtered.map((summary) => {
                  const { task, client } = summary;
                  const progressPct =
                    summary.requiredLineCount > 0
                      ? Math.round((summary.acceptedLineCount / summary.requiredLineCount) * 100)
                      : 100;
                  const isOverridden = Boolean(task.statusOverride);

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-sheet-2/80 transition-colors group cursor-pointer"
                    >
                      {/* Client */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <Link
                          to={`/clients/${client.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 group-hover:text-stamp transition-colors"
                        >
                          <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-sheet-3 border border-rule text-ink shrink-0">
                            {client.code}
                          </span>
                          <span className="font-bold text-ink truncate max-w-[150px]">
                            {client.displayName}
                          </span>
                        </Link>
                      </td>

                      {/* Task */}
                      <td className="py-3 px-3">
                        <Link to={`/tasks/${task.id}`} className="block">
                          <div className="font-bold text-ink group-hover:text-stamp transition-colors truncate max-w-[200px]">
                            {task.title || (task.templateId ? `Filing ${task.templateId}` : 'Tax Obligation')}
                          </div>
                          {task.templateId && (
                            <span className="text-[10px] text-ink-3 font-mono uppercase">
                              {task.templateId}
                            </span>
                          )}
                        </Link>
                      </td>

                      {/* Period */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {task.period ? (
                          <span className="px-1.5 py-0.5 rounded bg-sheet-2 border border-rule text-[11px] font-semibold text-ink-2 whitespace-nowrap">
                            {task.period}
                          </span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <StatusChip status={summary.displayedStatus} />
                          {isOverridden && (
                            <span
                              title={`Overridden: ${task.statusOverride?.reason}`}
                              className="w-2 h-2 rounded-full bg-warn-solid shrink-0"
                            />
                          )}
                        </div>
                      </td>

                      {/* Due */}
                      <td className="py-3 px-3 whitespace-nowrap min-w-[125px]">
                        <DueBadge
                          state={summary.dueState}
                          dueDate={task.dueDate}
                          isCompleted={summary.displayedStatus === 'completed'}
                          completedDate={task.completedAt ? task.completedAt.slice(0, 10) : undefined}
                        />
                      </td>

                      {/* Ready progress meter */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-2">
                            <span>
                              {summary.acceptedLineCount} of {summary.requiredLineCount}
                            </span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-sheet-3 rounded-full overflow-hidden border border-rule/50">
                            <div
                              className={`h-full transition-all duration-300 ${
                                progressPct === 100 ? 'bg-good-solid' : 'bg-stamp'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Next action */}
                      <td className="py-3 px-3 text-ink-2 text-xs">
                        {task.nextAction ? (
                          <div className="truncate max-w-[180px]" title={task.nextAction.text}>
                            <span className="font-semibold text-ink">{task.nextAction.text}</span>
                            {task.nextAction.due && (
                              <span className="text-ink-3 block text-[10px]">
                                by {formatDate(task.nextAction.due)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-3 italic">None scheduled</span>
                        )}
                      </td>

                      {/* Owner */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-sheet-2 border border-rule text-ink-2">
                          <User className="w-3 h-3 text-ink-3" />
                          <span>{task.ownerUserId === 'user-ana' ? 'Ana' : 'Ben'}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-right actions-cell no-print">
                        <Link
                          to={`/tasks/${task.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-sheet-2 border border-rule text-ink hover:bg-sheet-3 transition-colors"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= KANBAN BOARD VIEW ================= */
        <div className="space-y-3" data-kanban-board>
          {boardNotice && (
            <div className="flex items-center justify-between px-3 py-2 rounded-control bg-warn-bg border border-warn-bd text-warn-fg text-xs font-medium">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{boardNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setBoardNotice(null)}
                className="p-1 hover:text-ink text-warn-fg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="overflow-x-auto pb-4 select-none">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3 min-w-[1600px]">
              {boardColumns.map((col) => {
                const colSummaries = filtered.filter((s) => s.displayedStatus === col.status);
                const isDragTarget = dragOverColumn === col.status;

                return (
                  <div
                    key={col.status}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverColumn !== col.status) {
                        setDragOverColumn(col.status);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        if (dragOverColumn === col.status) setDragOverColumn(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverColumn(null);
                      const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
                      if (!taskId) return;
                      const targetSummary = allSummaries.find((s) => s.task.id === taskId);
                      if (!targetSummary) return;
                      handleDropTask(targetSummary, col.status, col.isDerived, col.label);
                    }}
                    className={`border rounded-panel p-2.5 flex flex-col min-h-[500px] transition-all select-none ${
                      isDragTarget
                        ? 'bg-stamp/10 border-stamp ring-2 ring-stamp/20 shadow-md'
                        : 'bg-sheet-2/60 border-rule'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="mb-2.5 pb-2 border-b border-rule">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {col.isDerived && (
                            <span title="Computed automatically from line items">
                              <Lock className="w-3 h-3 text-ink-3 shrink-0" />
                            </span>
                          )}
                          <h3 className="text-xs font-bold text-ink truncate font-sans">
                            {col.label}
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 text-[10px] font-black rounded-full bg-sheet-3 border border-rule text-ink">
                          {colSummaries.length}
                        </span>
                      </div>
                      <p className="text-[10px] text-ink-3 mt-0.5 truncate">{col.helper}</p>
                    </div>

                    {/* Cards List */}
                    <div className="space-y-2 flex-1">
                      {colSummaries.length === 0 ? (
                        <div
                          className={`h-24 rounded border border-dashed flex items-center justify-center text-[11px] text-ink-3 text-center p-2 transition-colors select-none ${
                            isDragTarget
                              ? 'border-stamp text-stamp font-bold bg-stamp/5'
                              : 'border-rule'
                          }`}
                        >
                          {isDragTarget ? 'Drop task here' : 'No tasks'}
                        </div>
                      ) : (
                        colSummaries.map((summary) => {
                          const { task, client } = summary;
                          const role = session?.membership.role || 'helper';
                          const isDragging = draggedTaskId === task.id;

                          return (
                            <div
                              key={task.id}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', task.id);
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedTaskId(task.id);
                              }}
                              onDragEnd={() => {
                                setDraggedTaskId(null);
                                setDragOverColumn(null);
                              }}
                              className={`bg-sheet border border-rule rounded-control p-2.5 space-y-2 shadow-2xs hover:shadow-xs transition-all relative group cursor-grab active:cursor-grabbing select-none overflow-hidden ${
                                isDragging ? 'opacity-40 ring-2 ring-stamp/40 scale-[0.98]' : ''
                              }`}
                            >
                              {/* Card Client tab, period & grip */}
                              <div>
                                <div className="flex items-center justify-between text-[10px] text-ink-3 mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <GripVertical className="w-3 h-3 text-ink-3/30 group-hover:text-ink-3 transition-colors shrink-0" />
                                    <span className="font-mono font-bold bg-sheet-2 px-1 rounded border border-rule text-ink">
                                      {client.code}
                                    </span>
                                  </div>
                                  {task.period && (
                                    <span className="font-medium bg-sheet-2 px-1 rounded text-ink-2">
                                      {task.period}
                                    </span>
                                  )}
                                </div>
                                <Link
                                  to={`/tasks/${task.id}`}
                                  className="block font-bold text-xs text-ink hover:text-stamp line-clamp-2 transition-colors"
                                >
                                  {task.title || (task.templateId ? `Filing ${task.templateId}` : 'Tax Obligation')}
                                </Link>
                              </div>

                              {/* Card Status & Due */}
                              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-rule/50 min-w-0">
                                <DueBadge size="sm" state={summary.dueState} dueDate={task.dueDate} />
                                <span
                                  title={`${summary.acceptedLineCount} of ${summary.requiredLineCount} checklist items accepted`}
                                  className="text-[10px] font-semibold text-ink-3 whitespace-nowrap shrink-0"
                                >
                                  {summary.acceptedLineCount}/{summary.requiredLineCount} items
                                </span>
                              </div>

                              {/* Card Actions & Transition */}
                              <div className="pt-1.5 border-t border-rule/40">
                                {col.isDerived ? (
                                  <div className="flex flex-col gap-1">
                                    {col.status === 'waiting_on_client' && (
                                      <Link to={`/tasks/${task.id}`} className="w-full block">
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          className="w-full text-[10px] h-6 py-0 justify-center font-semibold border-warn-bd text-warn-fg bg-warn-bg/40 hover:bg-warn-bg"
                                        >
                                          View Missing Items
                                        </Button>
                                      </Link>
                                    )}
                                    {col.status === 'review_required' && (
                                      <Link to={`/tasks/${task.id}`} className="w-full block">
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          className="w-full text-[10px] h-6 py-0 justify-center font-semibold"
                                        >
                                          Review Lines ({summary.requiredLineCount - summary.acceptedLineCount})
                                        </Button>
                                      </Link>
                                    )}
                                    {col.status === 'needs_correction' && (
                                      <Link to={`/tasks/${task.id}`} className="w-full block">
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          className="w-full text-[10px] h-6 py-0 justify-center font-semibold border-critical-bd text-critical bg-critical-bg/40 hover:bg-critical-bg"
                                        >
                                          Resolve Flagged
                                        </Button>
                                      </Link>
                                    )}
                                    {col.status === 'intake' && (
                                      <Link to={`/tasks/${task.id}`} className="w-full block">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="w-full text-[10px] h-6 py-0 justify-center font-semibold"
                                        >
                                          Request Items
                                        </Button>
                                      </Link>
                                    )}
                                    {role === 'owner' && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOverrideModalTask(task);
                                        }}
                                        className="text-[10px] text-ink-3 hover:text-stamp text-center underline cursor-pointer pt-0.5"
                                      >
                                        Override status...
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <Select
                                    value=""
                                    placeholder="Move to..."
                                    onChange={(val) => {
                                      const target = val as TaskStatus;
                                      if (!target) return;
                                      if (target === 'submitted') {
                                        setSubmittedModalTask(task);
                                      } else if (target === 'completed') {
                                        setCompletedModalTask(task);
                                      } else {
                                        setTaskStatus.mutate(
                                          { id: task.id, to: target },
                                          {
                                            onError: (err: any) => {
                                              setBoardNotice(err?.message || 'Failed to update task status');
                                            },
                                          }
                                        );
                                      }
                                    }}
                                    buttonClassName="text-[10px] h-6 py-0 px-2 bg-sheet-2 border-rule text-ink-2 hover:text-ink w-full font-medium"
                                    menuClassName="min-w-[150px] text-xs z-30"
                                  >
                                    {col.status === 'in_preparation' && (
                                      <option value="ready_next_step">Ready for Action</option>
                                    )}
                                    {col.status === 'ready_next_step' && (
                                      <>
                                        <option value="in_preparation">In Preparation</option>
                                        <option value="submitted">Mark Submitted</option>
                                        <option value="completed">Mark Completed</option>
                                      </>
                                    )}
                                    {col.status === 'submitted' && (
                                      <>
                                        <option value="completed">Mark Completed</option>
                                        <option value="in_preparation">Revert to In Prep</option>
                                      </>
                                    )}
                                    {col.status === 'completed' && (
                                      <option value="in_preparation">Reopen Task</option>
                                    )}
                                  </Select>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. Modals & Sheets */}
      <OpenPeriodModal
        open={isOpenPeriodOpen}
        onClose={() => setIsOpenPeriodOpen(false)}
      />

      <NewTaskSheet
        open={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
      />

      {submittedModalTask && (
        <MarkSubmittedDialog
          open={Boolean(submittedModalTask)}
          onClose={() => setSubmittedModalTask(null)}
          task={submittedModalTask}
        />
      )}

      {completedModalTask && (
        <MarkCompletedDialog
          open={Boolean(completedModalTask)}
          onClose={() => setCompletedModalTask(null)}
          task={completedModalTask}
        />
      )}

      {overrideModalTask && (
        <OverrideStatusDialog
          open={Boolean(overrideModalTask)}
          onClose={() => setOverrideModalTask(null)}
          task={overrideModalTask}
        />
      )}
    </div>
  );
}
