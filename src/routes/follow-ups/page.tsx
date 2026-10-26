import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFollowUps, useClients } from '@/hooks/useData';
import type { FollowUpView, FollowUpState, Channel } from '@/domain/types';
import { copyFormLabel } from '@/domain/labels';
import { formatDate } from '@/lib/format';
import { Select } from '@/components/ui/select';
import { MessageComposer } from '@/components/follow-ups/composer';
import {
  LogResponseModal,
  EscalateModal,
  ResolveModal,
  NewFollowUpModal,
} from '@/components/follow-ups/follow-up-modals';
import {
  MessageSquare,
  Search,
  Filter,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  MoreVertical,
  X,
  AlertOctagon,
  CheckCheck,
  RefreshCw,
  Smartphone,
  Mail,
} from 'lucide-react';

export function FollowUpsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useFollowUps();
  const followUps = data?.items || [];

  const { data: clientsRes } = useClients();
  const clients = clientsRes?.items || [];

  // Tab state: 'due_today' | 'overdue' | 'waiting' | 'resolved' | 'all'
  const [activeTab, setActiveTab] = useState<'due_today' | 'overdue' | 'waiting' | 'resolved' | 'all'>('due_today');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  // Active modals
  const [selectedForComposer, setSelectedForComposer] = useState<FollowUpView | null>(null);
  const [selectedForResponse, setSelectedForResponse] = useState<FollowUpView | null>(null);
  const [selectedForEscalate, setSelectedForEscalate] = useState<FollowUpView | null>(null);
  const [selectedForResolve, setSelectedForResolve] = useState<FollowUpView | null>(null);
  const [isNewFollowUpOpen, setIsNewFollowUpOpen] = useState(false);

  // Compute counts for summary strip
  const counts = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    let waiting = 0;
    let resolved = 0;

    for (const fu of followUps) {
      if (fu.state === 'due_today') dueToday++;
      else if (fu.state === 'overdue' || fu.followUp.status === 'escalated') overdue++;
      else if (fu.state === 'waiting') waiting++;
      else if (fu.state === 'resolved') resolved++;
    }

    return {
      dueToday,
      overdue,
      waiting,
      resolved,
      total: followUps.length,
    };
  }, [followUps]);

  // Filter items
  const filteredItems = useMemo(() => {
    return followUps.filter((item) => {
      // Tab filter
      if (activeTab === 'due_today' && item.state !== 'due_today') return false;
      if (activeTab === 'overdue' && item.state !== 'overdue' && item.followUp.status !== 'escalated') return false;
      if (activeTab === 'waiting' && item.state !== 'waiting') return false;
      if (activeTab === 'resolved' && item.state !== 'resolved') return false;

      // Client filter
      if (clientFilter && item.client.id !== clientFilter) return false;

      // Channel filter
      if (channelFilter && item.followUp.channel !== channelFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient =
          item.client.displayName.toLowerCase().includes(q) ||
          item.client.code.toLowerCase().includes(q);
        const matchesTask = item.task?.title?.toLowerCase().includes(q);
        const matchesContact = item.contact?.name.toLowerCase().includes(q);
        const matchesLine = item.lines.some((l) => l.label.toLowerCase().includes(q));

        if (!matchesClient && !matchesTask && !matchesContact && !matchesLine) {
          return false;
        }
      }

      return true;
    });
  }, [followUps, activeTab, clientFilter, channelFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Follow-ups</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-sheet-2 text-ink-2 border border-rule">
              {followUps.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Clear the day's chasing in one sitting: copy, send in your usual app, mark as sent, next.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {counts.dueToday > 0 && (
            <button
              onClick={() => navigate('/follow-ups/run')}
              className="px-3.5 py-2 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Clear Due Today ({counts.dueToday})
            </button>
          )}

          <button
            onClick={() => setIsNewFollowUpOpen(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-control bg-paper text-ink border border-rule hover:bg-sheet-2 shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Follow-up
          </button>
        </div>
      </div>

      {/* Summary Count Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveTab('due_today')}
          className={`p-3.5 rounded-panel border text-left transition-all ${
            activeTab === 'due_today'
              ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
              : 'bg-sheet border-rule hover:bg-sheet-2'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
            <span>Due Today</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink mt-1">{counts.dueToday}</div>
        </button>

        <button
          onClick={() => setActiveTab('overdue')}
          className={`p-3.5 rounded-panel border text-left transition-all ${
            activeTab === 'overdue'
              ? 'bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/30'
              : 'bg-sheet border-rule hover:bg-sheet-2'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 dark:text-rose-400">
            <span>Overdue</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink mt-1">{counts.overdue}</div>
        </button>

        <button
          onClick={() => setActiveTab('waiting')}
          className={`p-3.5 rounded-panel border text-left transition-all ${
            activeTab === 'waiting'
              ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30'
              : 'bg-sheet border-rule hover:bg-sheet-2'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-400">
            <span>Waiting on Client</span>
            <Send className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink mt-1">{counts.waiting}</div>
        </button>

        <button
          onClick={() => setActiveTab('resolved')}
          className={`p-3.5 rounded-panel border text-left transition-all ${
            activeTab === 'resolved'
              ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
              : 'bg-sheet border-rule hover:bg-sheet-2'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span>Resolved</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink mt-1">{counts.resolved}</div>
        </button>
      </div>

      {/* Filter and Tab Strip */}
      <div className="space-y-3">
        {/* Tab switcher */}
        <div className="flex items-center gap-1 border-b border-rule overflow-x-auto pb-1 text-xs">
          {[
            { id: 'due_today', label: 'Due today', count: counts.dueToday },
            { id: 'overdue', label: 'Overdue', count: counts.overdue },
            { id: 'waiting', label: 'Waiting (sent)', count: counts.waiting },
            { id: 'resolved', label: 'Resolved (30d)', count: counts.resolved },
            { id: 'all', label: 'All follow-ups', count: counts.total },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 font-bold rounded-t-control border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-stamp text-stamp bg-sheet'
                  : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              {tab.label}
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-sheet-2 rounded-full text-ink-3">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client, contact, task or item..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-sheet border border-rule rounded-control text-ink placeholder:text-ink-3 focus:outline-none focus:border-stamp"
            />
          </div>

          <Select
            value={clientFilter}
            onChange={setClientFilter}
            className="w-auto min-w-[140px] max-w-[200px]"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.client.id} value={c.client.id}>
                {c.client.displayName} ({c.client.code})
              </option>
            ))}
          </Select>

          <Select
            value={channelFilter}
            onChange={setChannelFilter}
            className="w-auto min-w-[120px]"
          >
            <option value="">All Channels</option>
            <option value="viber">Viber</option>
            <option value="messenger">Messenger</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </Select>

          {(searchQuery || clientFilter || channelFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setClientFilter('');
                setChannelFilter('');
              }}
              className="text-xs text-ink-2 hover:text-ink underline px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content State Handling */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-28 bg-sheet-3 rounded-panel" />
          <div className="h-28 bg-sheet-3 rounded-panel" />
          <div className="h-28 bg-sheet-3 rounded-panel" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-sheet border border-rule rounded-panel text-ink-3 space-y-3">
          <p className="text-sm text-ink font-semibold">Failed to load follow-ups</p>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel space-y-3">
          <MessageSquare className="w-8 h-8 text-ink-3 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-ink">No follow-ups found</h3>
            <p className="text-xs text-ink-3 max-w-sm mx-auto">
              {searchQuery || clientFilter || channelFilter
                ? 'Try adjusting your search filters.'
                : 'No client follow-ups in this tab category.'}
            </p>
          </div>
          <button
            onClick={() => setIsNewFollowUpOpen(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-control bg-stamp text-on-stamp inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New Follow-up
          </button>
        </div>
      ) : (
        /* List of Follow-up Cards */
        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs overflow-hidden">
          {filteredItems.map((item) => {
            const { followUp, client, task, lines, contact, state } = item;
            const attemptLabel =
              followUp.attemptCount === 0
                ? '1st request'
                : followUp.attemptCount === 1
                ? '2nd reminder'
                : `${followUp.attemptCount + 1}th reminder`;

            return (
              <div
                key={followUp.id}
                className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                  followUp.status === 'escalated'
                    ? 'bg-amber-500/5'
                    : state === 'overdue'
                    ? 'bg-rose-500/5'
                    : 'hover:bg-sheet-2/60'
                }`}
              >
                {/* Left block: Client, Task, Contact */}
                <div className="space-y-2 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-chip bg-stamp-soft text-stamp border border-stamp/20">
                      {client.code}
                    </span>
                    <Link
                      to={`/clients/${client.id}`}
                      className="text-xs font-bold text-ink hover:underline"
                    >
                      {client.displayName}
                    </Link>

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-chip uppercase tracking-wide border ${
                        followUp.status === 'escalated'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400'
                          : state === 'overdue'
                          ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400'
                          : state === 'due_today'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400'
                          : state === 'waiting'
                          ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-400'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}
                    >
                      {followUp.status === 'escalated'
                        ? 'Escalated'
                        : state === 'due_today'
                        ? 'Due Today'
                        : state === 'overdue'
                        ? 'Overdue'
                        : state === 'waiting'
                        ? 'Waiting'
                        : 'Resolved'}
                    </span>

                    {/* Channel badge */}
                    <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-sheet-2 text-ink border border-rule uppercase">
                      {followUp.channel}
                    </span>

                    <span className="text-[11px] font-medium text-ink-3">
                      {attemptLabel}
                    </span>
                  </div>

                  {/* Task & Period */}
                  <div>
                    <span className="text-sm font-bold text-ink">
                      {task ? (
                        <Link to={`/tasks/${task.id}`} className="hover:underline">
                          {task.title || 'Filing Obligation'}
                        </Link>
                      ) : (
                        'Document Collection'
                      )}
                    </span>
                    {task?.period && (
                      <span className="text-xs font-mono text-ink-2 ml-1.5">
                        ({task.period})
                      </span>
                    )}
                  </div>

                  {/* Outstanding Items */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-ink-3">
                      Outstanding items ({lines.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {lines.map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-paper border border-rule text-ink"
                        >
                          <span>{l.label}</span>
                          {l.copyForm && (
                            <span className="text-[9px] uppercase font-bold text-ink-3">
                              · {copyFormLabel(l.copyForm)}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Contact row */}
                  <div className="text-[11px] text-ink-2 flex items-center gap-3 pt-0.5">
                    <span>
                      Contact: <strong className="text-ink">{contact?.name || 'Primary'}</strong>
                    </span>
                    {followUp.expectedBy && (
                      <span>
                        Expected by:{' '}
                        <strong className="text-ink">{formatDate(followUp.expectedBy)}</strong>
                      </span>
                    )}
                    {followUp.status === 'escalated' && followUp.escalatedReason && (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">
                        Escalation: {followUp.escalatedReason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right block: Action buttons */}
                <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                  {state !== 'resolved' && (
                    <>
                      <button
                        onClick={() => setSelectedForComposer(item)}
                        className="px-3 py-1.5 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Compose
                      </button>

                      <button
                        onClick={() => setSelectedForResponse(item)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-control bg-paper text-ink border border-rule hover:bg-sheet-2 flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Log response
                      </button>

                      {followUp.status !== 'escalated' && (
                        <button
                          onClick={() => setSelectedForEscalate(item)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-control text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                          title="Escalate"
                        >
                          <AlertOctagon className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedForResolve(item)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-control text-ink-3 hover:text-ink hover:bg-sheet-2 transition-colors"
                        title="Resolve manually"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {state === 'resolved' && (
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      {followUp.resolvedReason || 'Resolved'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {selectedForComposer && (
        <MessageComposer
          followUpView={selectedForComposer}
          isOpen={!!selectedForComposer}
          onClose={() => setSelectedForComposer(null)}
        />
      )}

      {selectedForResponse && (
        <LogResponseModal
          followUpView={selectedForResponse}
          isOpen={!!selectedForResponse}
          onClose={() => setSelectedForResponse(null)}
        />
      )}

      {selectedForEscalate && (
        <EscalateModal
          followUpView={selectedForEscalate}
          isOpen={!!selectedForEscalate}
          onClose={() => setSelectedForEscalate(null)}
        />
      )}

      {selectedForResolve && (
        <ResolveModal
          followUpView={selectedForResolve}
          isOpen={!!selectedForResolve}
          onClose={() => setSelectedForResolve(null)}
        />
      )}

      {isNewFollowUpOpen && (
        <NewFollowUpModal
          isOpen={isNewFollowUpOpen}
          onClose={() => setIsNewFollowUpOpen(false)}
        />
      )}
    </div>
  );
}
