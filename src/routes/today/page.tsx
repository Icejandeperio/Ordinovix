import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToday, useSetLineStatus, useSession } from '@/hooks/useData';
import { formatDate, formatRelative, formatTime } from '@/lib/format';
import { formatHeaderDate } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { DueBadge, StatusChip, ReadinessMeter, AuthorizationBadge } from '@/components/ui/status-chip';
import { ReviewStamp } from '@/components/ui/stamp';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Lock,
  FileText,
  Send,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  Eye,
  AlertTriangle,
  FolderOpen,
  X,
} from 'lucide-react';
import type { TaskSummary, TaskLine, Client, DocumentFile } from '@/domain/types';

export function TodayPage() {
  const { data: session } = useSession();
  const [scope, setScope] = useState<'mine' | 'everyone'>('everyone');
  const { data: queue, isLoading, error, refetch } = useToday(scope);
  const setLineStatus = useSetLineStatus();

  // Flag line modal state
  const [flaggingLine, setFlaggingLine] = useState<{ line: TaskLine; client: Client } | null>(null);
  const [flagNote, setFlagNote] = useState('');

  // Preview file modal state
  const [previewFile, setPreviewFile] = useState<{ file: DocumentFile; client: Client } | null>(null);

  // Accepted line transient stamp indicator
  const [recentlyAcceptedId, setRecentlyAcceptedId] = useState<string | null>(null);

  const isOwner = session?.membership?.role === 'owner';

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.focus();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-2">
        <div className="h-10 w-72 bg-sheet-3 rounded-control" />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-32 bg-sheet-3 rounded-chip shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="h-44 bg-sheet-3 rounded-panel" />
            <div className="h-44 bg-sheet-3 rounded-panel" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <div className="h-36 bg-sheet-3 rounded-panel" />
            <div className="h-48 bg-sheet-3 rounded-panel" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !queue) {
    return (
      <div className="p-8 text-center bg-sheet rounded-panel border border-critical-bd space-y-4">
        <AlertCircle className="w-10 h-10 text-critical mx-auto" />
        <div className="space-y-1">
          <h3 className="text-base font-bold text-ink">Failed to load Today queue</h3>
          <p className="text-xs text-ink-3">Check simulated network latency or retry the request.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  // Combine urgent tasks: Overdue first, then due today, then due soon (within 7 days)
  const urgentTasks: TaskSummary[] = [
    ...queue.overdueTasks,
    ...queue.dueTodayTasks,
    ...queue.dueSoonTasks.filter(
      (s) => !queue.overdueTasks.some((o) => o.task.id === s.task.id) && !queue.dueTodayTasks.some((d) => d.task.id === s.task.id)
    ),
  ];

  const totalNeedYou =
    queue.counts.overdue +
    queue.counts.dueThisWeek +
    queue.counts.awaitingReview +
    queue.counts.blockedByClient +
    queue.counts.followUpsDue;

  const isCompletelyEmpty =
    urgentTasks.length === 0 &&
    queue.reviewRequiredLines.length === 0 &&
    queue.blockedByClient.length === 0 &&
    queue.readyForActionTasks.length === 0 &&
    queue.nextVisits.length === 0 &&
    queue.followUpsDue.length === 0;

  const handleAcceptLine = (lineId: string) => {
    setRecentlyAcceptedId(lineId);
    setLineStatus.mutate(
      { id: lineId, to: 'accepted', extra: { note: 'Verified by operator' } },
      {
        onSettled: () => {
          setTimeout(() => setRecentlyAcceptedId(null), 1200);
        },
      }
    );
  };

  const handleConfirmFlag = () => {
    if (!flaggingLine || !flagNote.trim()) return;
    setLineStatus.mutate(
      {
        id: flaggingLine.line.id,
        to: 'needs_correction',
        extra: { note: flagNote.trim() },
      },
      {
        onSuccess: () => {
          setFlaggingLine(null);
          setFlagNote('');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* 11.3 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink font-sans">
              Today
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-chip bg-sheet-2 text-ink-2 border border-rule">
              {formatHeaderDate(queue.focusDate)}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-ink-2 mt-1">
            <span className="font-semibold text-ink">{totalNeedYou} need you</span>
            {' · '}
            <span>{queue.counts.visitsThisWeek} visits this week</span>
          </p>
        </div>

        {/* Mine | Everyone toggle (Owner only per Spec 11.3) */}
        {isOwner && (
          <div className="inline-flex items-center p-0.5 bg-sheet-2 border border-rule rounded-chip text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setScope('mine')}
              className={`px-3 py-1 rounded-chip transition-colors ${
                scope === 'mine'
                  ? 'bg-sheet text-ink shadow-xs border border-rule'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              Mine
            </button>
            <button
              onClick={() => setScope('everyone')}
              className={`px-3 py-1 rounded-chip transition-colors ${
                scope === 'everyone'
                  ? 'bg-sheet text-ink shadow-xs border border-rule'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              Everyone
            </button>
          </div>
        )}
      </div>

      {/* 11.3 Count Strip (Interactive Buttons) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => scrollToSection('section-urgent')}
          className={`px-3 py-1.5 rounded-chip text-xs font-bold shrink-0 transition-colors border flex items-center gap-1.5 ${
            queue.counts.overdue > 0
              ? 'bg-critical-bg text-critical-fg border-critical-bd hover:bg-critical-solid hover:text-on-critical-solid'
              : 'bg-sheet-2 text-ink-3 border-rule hover:bg-sheet-3'
          }`}
        >
          <span>Overdue</span>
          <span className="px-1.5 py-0.2 rounded-chip bg-critical text-on-critical text-[10px] font-mono">
            {queue.counts.overdue}
          </span>
        </button>

        <button
          onClick={() => scrollToSection('section-urgent')}
          className="px-3 py-1.5 rounded-chip text-xs font-semibold shrink-0 bg-sheet-2 text-ink border border-rule hover:bg-sheet-3 flex items-center gap-1.5"
        >
          <span>Due this week</span>
          <span className="px-1.5 py-0.2 rounded-chip bg-sheet-3 text-ink-2 text-[10px] font-mono">
            {queue.counts.dueThisWeek}
          </span>
        </button>

        <button
          onClick={() => scrollToSection('section-blocked')}
          className="px-3 py-1.5 rounded-chip text-xs font-semibold shrink-0 bg-sheet-2 text-ink border border-rule hover:bg-sheet-3 flex items-center gap-1.5"
        >
          <span>Blocked by client</span>
          <span className="px-1.5 py-0.2 rounded-chip bg-sheet-3 text-ink-2 text-[10px] font-mono">
            {queue.counts.blockedByClient}
          </span>
        </button>

        <button
          onClick={() => scrollToSection('section-review')}
          className={`px-3 py-1.5 rounded-chip text-xs font-bold shrink-0 transition-colors border flex items-center gap-1.5 ${
            queue.counts.awaitingReview > 0
              ? 'bg-stamp-soft text-stamp-strong border-stamp-bd hover:bg-stamp hover:text-on-stamp'
              : 'bg-sheet-2 text-ink-3 border-rule hover:bg-sheet-3'
          }`}
        >
          <span>Awaiting my review</span>
          <span className="px-1.5 py-0.2 rounded-chip bg-stamp text-on-stamp text-[10px] font-mono">
            {queue.counts.awaitingReview}
          </span>
        </button>

        <button
          onClick={() => scrollToSection('section-followups')}
          className="px-3 py-1.5 rounded-chip text-xs font-semibold shrink-0 bg-sheet-2 text-ink border border-rule hover:bg-sheet-3 flex items-center gap-1.5"
        >
          <span>Follow-ups due</span>
          <span className="px-1.5 py-0.2 rounded-chip bg-sheet-3 text-ink-2 text-[10px] font-mono">
            {queue.counts.followUpsDue}
          </span>
        </button>

        <button
          onClick={() => scrollToSection('section-visits')}
          className="px-3 py-1.5 rounded-chip text-xs font-semibold shrink-0 bg-sheet-2 text-ink border border-rule hover:bg-sheet-3 flex items-center gap-1.5"
        >
          <span>Visits this week</span>
          <span className="px-1.5 py-0.2 rounded-chip bg-sheet-3 text-ink-2 text-[10px] font-mono">
            {queue.counts.visitsThisWeek}
          </span>
        </button>
      </div>

      {/* Empty State per Spec 11.3 */}
      {isCompletelyEmpty ? (
        <div className="bg-sheet border border-rule rounded-panel p-12 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-control bg-good-bg text-good mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-ink">Nothing needs you today.</h2>
            <p className="text-xs text-ink-3">
              All client obligations are on track, no documents await review, and no counter visits are scheduled.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/tasks">
              <Button variant="secondary" size="sm">
                Open a period
              </Button>
            </Link>
            <Link to="/visits">
              <Button variant="primary" size="sm">
                Plan a visit
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        /* Main 2-Column Desktop Layout (≥1280px) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Primary Action Feed */}
          <div className="lg:col-span-8 space-y-8">
            {/* 1. Overdue and due within 7 days */}
            <section id="section-urgent" tabIndex={-1} className="space-y-3 outline-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-critical" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
                    Overdue and Due Within 7 Days ({urgentTasks.length})
                  </h2>
                </div>
                <Link to="/tasks?filter=due-soon" className="text-xs text-stamp hover:underline font-semibold">
                  All tasks &rarr;
                </Link>
              </div>

              {urgentTasks.length === 0 ? (
                <div className="p-4 bg-sheet border border-rule rounded-panel text-xs text-ink-3 text-center">
                  No urgent deadlines within the next 7 days.
                </div>
              ) : (
                <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
                  {urgentTasks.map((t) => (
                    <div
                      key={t.task.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sheet-2 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <DueBadge state={t.dueState} dueDate={t.task.dueDate} />
                          <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-sheet-2 border border-rule text-ink">
                            {t.client.code}
                          </span>
                          <span className="text-xs font-bold text-ink truncate max-w-[200px]">
                            {t.client.displayName}
                          </span>
                          <span className="text-xs text-ink-3">· {t.task.period}</span>
                        </div>
                        <div className="text-sm font-semibold text-ink flex items-center gap-2">
                          <span className="truncate">{t.task.title || 'Tax Obligation'}</span>
                          <StatusChip status={t.displayedStatus} />
                          {t.task.statusOverride && (
                            <span className="text-[10px] text-warn-fg bg-warn-bg px-1.5 py-0.5 rounded-chip border border-warn-bd">
                              Override
                            </span>
                          )}
                        </div>
                        {t.task.nextAction && (
                          <div className="text-xs text-ink-3 flex items-center gap-1.5 truncate">
                            <span className="text-ink-2 font-medium">Next:</span>
                            <span className="truncate">{t.task.nextAction.text}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Link to={`/tasks/${t.task.id}`}>
                          <Button variant="secondary" size="sm">
                            Open
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2. Received, awaiting my review */}
            <section id="section-review" tabIndex={-1} className="space-y-3 outline-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-stamp animate-pulse" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
                    Received, Awaiting My Review ({queue.reviewRequiredLines.length})
                  </h2>
                </div>
                <span className="text-xs text-ink-3 italic">Received ≠ Accepted</span>
              </div>

              {queue.reviewRequiredLines.length === 0 ? (
                <div className="p-4 bg-sheet border border-rule rounded-panel text-xs text-ink-3 text-center">
                  All received documents have been verified and stamped.
                </div>
              ) : (
                <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
                  {queue.reviewRequiredLines.map(({ line, task, client, files }) => (
                    <div
                      key={line.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sheet-2 transition-colors relative overflow-hidden"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-sheet-2 border border-rule text-ink">
                            {client.code}
                          </span>
                          <span className="text-xs font-semibold text-ink truncate">{client.displayName}</span>
                          <span className="text-xs text-ink-3">· {task.title}</span>
                        </div>
                        <div className="text-sm font-bold text-ink">{line.label}</div>
                        <div className="flex items-center gap-3 text-[11px] text-ink-3 flex-wrap">
                          <span>Form: {line.copyForm}</span>
                          <span>· Copies: {line.copies || 1}</span>
                          <span>· Received: {formatDate(line.receivedAt)}</span>
                          {files && files.length > 0 && (
                            <button
                              onClick={() => setPreviewFile({ file: files[0], client })}
                              className="text-stamp hover:underline font-semibold flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{files.length} file{files.length > 1 ? 's' : ''}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {files && files.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewFile({ file: files[0], client })}
                            title="Preview file"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setFlaggingLine({ line, client })}
                        >
                          Flag
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAcceptLine(line.id)}
                          disabled={setLineStatus.isPending}
                        >
                          {recentlyAcceptedId === line.id ? (
                            <ReviewStamp variant="line" animate={false} />
                          ) : (
                            <span>Accept</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Blocked by client */}
            <section id="section-blocked" tabIndex={-1} className="space-y-3 outline-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-serious" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
                    Blocked by Client ({queue.blockedByClient.length} Clients)
                  </h2>
                </div>
                <Link to="/follow-ups" className="text-xs text-stamp hover:underline font-semibold">
                  Follow-ups &rarr;
                </Link>
              </div>

              {queue.blockedByClient.length === 0 ? (
                <div className="p-4 bg-sheet border border-rule rounded-panel text-xs text-ink-3 text-center">
                  No tasks currently blocked by client missing items.
                </div>
              ) : (
                <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
                  {queue.blockedByClient.map((group) => (
                    <div
                      key={group.client.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sheet-2 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-sheet-2 border border-rule text-ink">
                            {group.client.code}
                          </span>
                          <span className="text-xs font-bold text-ink">{group.client.displayName}</span>
                        </div>
                        <div className="text-xs text-serious font-medium">
                          Missing {group.missingCount} item{group.missingCount > 1 ? 's' : ''}:{' '}
                          <span className="text-ink font-normal">{group.firstMissingLabels.join(', ')}</span>
                        </div>
                        <div className="text-[11px] text-ink-3">
                          {group.lastRequestedDate
                            ? `Last requested ${formatDate(group.lastRequestedDate)} · ${group.attemptCount} attempt${group.attemptCount > 1 ? 's' : ''}`
                            : 'No request recorded yet'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Link to={`/follow-ups?client=${group.client.id}`}>
                          <Button variant="secondary" size="sm">
                            <Send className="w-3.5 h-3.5 mr-1.5" />
                            <span>Request missing</span>
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Ready for my action */}
            <section id="section-ready" tabIndex={-1} className="space-y-3 outline-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-good" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
                    Ready for My Action ({queue.readyForActionTasks.length})
                  </h2>
                </div>
                <span className="text-xs text-ink-3">All required lines accepted</span>
              </div>

              {queue.readyForActionTasks.length === 0 ? (
                <div className="p-4 bg-sheet border border-rule rounded-panel text-xs text-ink-3 text-center">
                  No tasks currently pending filing submission or visit dispatch.
                </div>
              ) : (
                <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
                  {queue.readyForActionTasks.map((t) => (
                    <div
                      key={t.task.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-sheet-2 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-chip text-[11px] font-bold bg-sheet-2 border border-rule text-ink">
                            {t.client.code}
                          </span>
                          <span className="text-xs font-bold text-ink">{t.client.displayName}</span>
                          <span className="text-xs text-ink-3">· {t.task.period}</span>
                        </div>
                        <div className="text-sm font-semibold text-ink">{t.task.title}</div>
                        <div className="text-xs text-good font-semibold">
                          Due {formatDate(t.task.dueDate)} · 100% lines verified
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Link to={`/tasks/${t.task.id}`}>
                          <Button variant="primary" size="sm">
                            {t.task.officeAction ? 'Add to visit' : 'Mark submitted'}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Rail (4 cols): Secondary / Context Rail */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Next Visits */}
            <section id="section-visits" tabIndex={-1} className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs outline-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-stamp" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
                    Next Visits
                  </h3>
                </div>
                <Link to="/visits" className="text-xs text-stamp hover:underline font-semibold">
                  All &rarr;
                </Link>
              </div>

              {queue.nextVisits.length === 0 ? (
                <p className="text-xs text-ink-3">No upcoming counter visits scheduled.</p>
              ) : (
                <div className="space-y-2.5">
                  {queue.nextVisits.map((v) => (
                    <Link
                      key={v.visit.id}
                      to={`/visits/${v.visit.id}`}
                      className="block p-3 rounded-control border border-rule bg-sheet-2 hover:bg-sheet-3 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-ink">
                            {v.office?.name || v.visit.officeName || 'Tax Office'}
                          </div>
                          <div className="text-[11px] text-ink-3">
                            {formatDate(v.visit.plannedDate)} · {v.visit.arriveBy ? `By ${v.visit.arriveBy}` : 'Anytime'}
                          </div>
                        </div>
                        {v.isReady ? (
                          <span className="px-2 py-0.5 rounded-chip text-[10px] font-extrabold bg-good-bg text-good border border-good-bd">
                            READY
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-warn-bg text-warn-fg border border-warn-bd">
                            {v.itemCount - v.readyItemCount} items missing
                          </span>
                        )}
                      </div>
                      <ReadinessMeter ready={v.readyItemCount} total={v.itemCount} label="Items ready" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* 2. Follow-ups Due Today */}
            <section id="section-followups" tabIndex={-1} className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs outline-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-ink-2" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
                    Follow-ups Due Today
                  </h3>
                </div>
                <Link to="/follow-ups" className="text-xs text-stamp hover:underline font-semibold">
                  {queue.followUpsDue.length} to send
                </Link>
              </div>

              {queue.followUpsDue.length === 0 ? (
                <p className="text-xs text-ink-3">No follow-ups due today.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {queue.followUpsDue.slice(0, 3).map((fu) => (
                      <span
                        key={fu.followUp.id}
                        className="px-2 py-0.5 rounded-chip text-xs bg-sheet-2 border border-rule text-ink font-semibold"
                      >
                        {fu.client.code}
                      </span>
                    ))}
                    {queue.followUpsDue.length > 3 && (
                      <span className="text-xs text-ink-3 self-center">
                        +{queue.followUpsDue.length - 3} more
                      </span>
                    )}
                  </div>
                  <Link to="/follow-ups" className="block">
                    <Button variant="secondary" size="sm" className="w-full">
                      Start follow-ups
                    </Button>
                  </Link>
                </div>
              )}
            </section>

            {/* 3. Expiring Authorizations */}
            <section className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-serious" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
                    Authorizations Expiring
                  </h3>
                </div>
                <span className="text-xs text-ink-3">{queue.authorizationsExpiring.length}</span>
              </div>

              {queue.authorizationsExpiring.length === 0 ? (
                <p className="text-xs text-ink-3">All client authorizations valid and current.</p>
              ) : (
                <div className="space-y-2">
                  {queue.authorizationsExpiring.map((a) => (
                    <Link
                      key={a.authorization.id}
                      to={`/clients/${a.client.id}?tab=authorizations`}
                      className="block p-2 rounded-control bg-sheet-2 border border-rule hover:bg-sheet-3 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-ink">{a.client.displayName}</span>
                        <AuthorizationBadge state={a.state} />
                      </div>
                      <div className="text-[11px] text-ink-3 mt-0.5">
                        {a.authorization.type} · Expires {formatDate(a.authorization.validUntil)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Next 14 Days Mini Calendar Strip */}
            <section className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-ink-2" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
                    Next 14 Days
                  </h3>
                </div>
                <Link to="/calendar" className="text-xs text-stamp hover:underline font-semibold">
                  Calendar &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {queue.next14Days.map((day, idx) => (
                  <Link
                    key={day.date}
                    to={`/calendar?date=${day.date}`}
                    className={`p-1.5 rounded-control text-center transition-colors border ${
                      idx === 0
                        ? 'border-stamp bg-stamp-soft text-stamp-strong font-bold'
                        : 'border-rule bg-sheet-2 hover:bg-sheet-3 text-ink'
                    }`}
                  >
                    <div className="text-[9px] text-ink-3">{day.dayName}</div>
                    <div className="text-xs font-bold">{day.dayNumber}</div>
                    <div className="flex items-center justify-center gap-0.5 h-1.5 mt-0.5">
                      {day.hasDueTasks && <span className="w-1 h-1 rounded-full bg-critical" />}
                      {day.hasVisits && <span className="w-1 h-1 rounded-full bg-stamp" />}
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* 5. Recent Activity */}
            <section className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink font-sans">
                  Recent Activity
                </h3>
                <Link to="/audit" className="text-xs text-stamp hover:underline font-semibold">
                  Log &rarr;
                </Link>
              </div>

              {queue.recentActivity.length === 0 ? (
                <p className="text-xs text-ink-3">No activity recorded today.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {queue.recentActivity.map((ev) => (
                    <div key={ev.id} className="pb-2 border-b border-rule last:border-b-0 last:pb-0">
                      <div className="text-ink font-medium leading-snug">{ev.summary}</div>
                      <div className="text-[10px] text-ink-3 mt-0.5 flex items-center gap-1">
                        <span>{formatTime(ev.at)}</span>
                        {ev.reason && <span>· {ev.reason}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Flag Issue Modal */}
      {flaggingLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4">
          <div className="bg-sheet border border-rule rounded-panel p-6 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink">Flag Issue on Document</h3>
                <p className="text-xs text-ink-3">
                  {flaggingLine.client.displayName} · {flaggingLine.line.label}
                </p>
              </div>
              <button
                onClick={() => setFlaggingLine(null)}
                className="text-ink-3 hover:text-ink p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink">Correction note for client / helper</label>
              <textarea
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="Describe what needs correction (e.g., missing signature on Part II, blurred date)..."
                rows={3}
                className="w-full p-2.5 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setFlaggingLine(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmFlag}
                disabled={!flagNote.trim() || setLineStatus.isPending}
              >
                Flag Issue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Document File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4">
          <div className="bg-sheet border border-rule rounded-panel p-6 max-w-lg w-full shadow-lg space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink truncate max-w-sm">
                  {previewFile.file.displayName}
                </h3>
                <p className="text-xs text-ink-3">
                  {previewFile.client.displayName} · {previewFile.file.mimeType} · Version {previewFile.file.versionNo}
                </p>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-ink-3 hover:text-ink p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-48 bg-sheet-2 border border-dashed border-rule rounded-panel flex flex-col items-center justify-center text-ink-3 space-y-2">
              <FileText className="w-8 h-8 text-stamp" />
              <div className="text-xs font-medium text-ink">Simulated Document Preview</div>
              <div className="text-[11px] text-ink-3 font-mono">{previewFile.file.storageKey}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setPreviewFile(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
