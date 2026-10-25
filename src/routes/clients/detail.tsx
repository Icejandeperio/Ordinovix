import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  useClient,
  useTasks,
  useContacts,
  useAuthorizations,
  useDocuments,
  useFollowUps,
  usePayments,
  useNotes,
  useSaveNote,
  useArchiveClient,
  useRestoreClient,
  useMemberships,
  useRemoveContact,
} from '@/hooks/useData';
import { repositories } from '@/data';
import {
  ArrowLeft,
  Plus,
  Edit3,
  Archive,
  RotateCcw,
  Printer,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Users,
  CheckCircle2,
  Calendar,
  FileText,
  DollarSign,
  Phone,
  Mail,
  ExternalLink,
  MessageSquare,
  Clock,
  Send,
  Lock,
  Pin,
  ChevronRight,
  Info,
  CheckSquare,
  FileCheck2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MaskedTin } from '@/components/inputs/identity-inputs';
import { AuthorizationBadge, DueBadge, ClientFlag, StatusChip } from '@/components/ui/status-chip';
import { ClientFormSheet } from '@/components/clients/client-form-sheet';
import { ContactFormModal } from '@/components/clients/contact-form-modal';
import { AuthorizationFormModal } from '@/components/clients/authorization-form-modal';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { formatPeso } from '@/lib/money';
import type { Contact, Authorization, TaskKind, DueState } from '@/domain/types';
import { authorizationState } from '@/domain/rules';

type TabKey =
  | 'overview'
  | 'tasks'
  | 'history'
  | 'documents'
  | 'follow-ups'
  | 'payments'
  | 'authorizations'
  | 'contacts'
  | 'notes';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'history', label: 'History' },
  { key: 'documents', label: 'Documents' },
  { key: 'follow-ups', label: 'Follow-ups' },
  { key: 'payments', label: 'Payments' },
  { key: 'authorizations', label: 'Authorizations' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'notes', label: 'Notes' },
];

export function ClientDetailPage() {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentTab = (searchParams.get('tab') as TabKey) || 'overview';
  const setTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  // Queries
  const { data: clientData, isLoading: clientLoading } = useClient(clientId);
  const { data: tasksData } = useTasks({ clientId });
  const { data: contacts = [] } = useContacts(clientId);
  const { data: authorizations = [] } = useAuthorizations(clientId);
  const { data: documentsData } = useDocuments({ clientId });
  const { data: followUpsData } = useFollowUps({ clientId });
  const { data: paymentsData } = usePayments({ clientId });
  const { data: notes = [] } = useNotes('client', clientId);
  const { data: memberships } = useMemberships();

  // Mutations
  const saveNote = useSaveNote();
  const archiveClient = useArchiveClient();
  const restoreClient = useRestoreClient();
  const removeContact = useRemoveContact();

  // Modal states
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedAuth, setSelectedAuth] = useState<Authorization | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  // Archive modal
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  // Request missing modal
  const [requestMissingOpen, setRequestMissingOpen] = useState(false);
  const [copiedMissing, setCopiedMissing] = useState(false);

  // Notes input
  const [noteBody, setNoteBody] = useState('');
  const [notePinned, setNotePinned] = useState(false);

  if (clientLoading || !clientData) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-sheet-3 rounded" />
        <div className="h-44 bg-sheet-3 rounded-panel" />
        <div className="h-64 bg-sheet-3 rounded-panel" />
      </div>
    );
  }

  const { client, summary } = clientData;
  const tasks = tasksData?.items || [];
  const openTasks = tasks.filter((t) => t.task.status !== 'completed' && t.task.status !== 'archived');
  const closedTasks = tasks.filter((t) => t.task.status === 'completed' || t.task.status === 'archived');
  const clientDocs = documentsData?.items || [];
  const followUps = followUpsData?.items || [];
  const payments = paymentsData?.items || [];

  // Compute Warning Strip Items per Spec 11.7.2
  const warnings: string[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const hasExpiringOrExpiredAuth = authorizations.some((a) => {
    const s = authorizationState(a, todayStr);
    return s !== 'valid';
  });
  if (hasExpiringOrExpiredAuth) {
    warnings.push('Client authorization (SPA / Authorization letter) has expired or is expiring within 30 days.');
  }
  const hasSignatory = contacts.some((c) => c.isSignatory);
  if (!hasSignatory) {
    warnings.push('No signatory contact designated for this client. Designate at least one authorized person.');
  }
  if (!client.accessHolder || client.accessHolder === 'unknown') {
    warnings.push('ORUS access holder is unknown. Confirm whether client or preparer holds login access.');
  }
  if (!client.assignedUserIds || client.assignedUserIds.length === 0) {
    warnings.push('No assigned preparer or helper for this client.');
  }

  // Active Authorizations vs Historical replaced authorizations
  const activeAuths = authorizations.filter((a) => !a.replacedById);
  const replacedAuths = authorizations.filter((a) => a.replacedById);

  // Handle Note Submission
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;

    saveNote.mutate(
      {
        entity: 'client',
        entityId: client.id,
        body: noteBody.trim(),
        pinned: notePinned,
      },
      {
        onSuccess: () => {
          setNoteBody('');
          setNotePinned(false);
        },
      }
    );
  };

  const handleArchive = () => {
    if (!archiveReason.trim()) return;
    archiveClient.mutate(
      { id: client.id, reason: archiveReason.trim() },
      {
        onSuccess: () => {
          setArchiveModalOpen(false);
          setArchiveReason('');
        },
      }
    );
  };

  const handleRestore = () => {
    restoreClient.mutate(
      { id: client.id, reason: 'Restored from client profile' },
      {
        onSuccess: () => {},
      }
    );
  };

  const handleCopyMissingMessage = () => {
    const lines = [
      `Hi ${client.displayName}, here are the pending items we need for your upcoming BIR filings:`,
      ...openTasks.flatMap((t) => [`\n• ${t.task.title || (t.task.templateId ? t.task.templateId.toUpperCase() : 'BIR Filing')} (${t.task.period}):`, '  - Complete signed schedule & invoices']),
      `\nPlease send them over at your earliest convenience so we can beat the deadline. Thank you!`,
    ].join('\n');
    navigator.clipboard.writeText(lines);
    setCopiedMissing(true);
    setTimeout(() => setCopiedMissing(false), 2500);
  };

  const noteHasPassword = /password|pw:|passwd|secret/i.test(noteBody);

  return (
    <div className="space-y-6">
      {/* Top Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Clients Directory</span>
        </Link>

        {client.status === 'archived' && (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-critical-bg text-critical border border-critical-bd flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5" />
            <span>Archived Client</span>
          </span>
        )}
      </div>

      {/* Warnings Strip per Spec 11.7.2 */}
      {warnings.length > 0 && (
        <div className="bg-warn-bg border border-warn-bd text-warn-fg rounded-panel p-3.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-warn-fg shrink-0" />
            <span>Attention Required ({warnings.length})</span>
          </div>
          <ul className="text-xs space-y-1 pl-6 list-disc font-sans">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Client Profile Header Card */}
      <div className="bg-sheet border border-rule rounded-panel overflow-hidden shadow-2xs">
        {/* Top Folder Tab Stripe */}
        <div className="bg-sheet-2 px-6 py-2.5 border-b border-rule flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded bg-stamp-soft text-stamp border border-stamp/20 tracking-wider">
              {client.code}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <ClientFlag label={client.entityType === 'gpp' ? 'General Professional Partnership' : client.entityType === 'solo' ? 'Solo Practitioner' : 'Corporation'} />
              <ClientFlag label={client.vatStatus === 'vat' ? 'VAT Registered' : 'Non-VAT'} />
              <ClientFlag label={`Filing: ${client.filingChannel}${client.efpsGroup ? ` (Grp ${client.efpsGroup})` : ''}`} />
              <span className="text-xs font-mono text-ink-3">
                RDO: <strong className="text-ink">{client.rdoCode}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-3">ORUS Access:</span>
            <span className="font-bold text-ink capitalize">{client.accessHolder || 'Unknown'}</span>
          </div>
        </div>

        {/* Profile Info & Actions Bar */}
        <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink font-sans">
                {client.displayName}
              </h1>
              {client.registeredName && client.registeredName !== client.displayName && (
                <span className="text-xs text-ink-3 italic">
                  (Reg: {client.registeredName})
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-ink-2">
              <div className="flex items-center gap-1.5">
                <span className="text-ink-3">TIN:</span>
                <MaskedTin
                  tin={client.tinMasked || '000-000-000-00000'}
                  onReveal={async () => {
                    await repositories.clients.revealTin(client.id);
                  }}
                />
              </div>

              <span className="text-rule-strong">•</span>

              <span>
                <strong>{summary.activeTaskCount}</strong> open tasks
              </span>

              <span className="text-rule-strong">•</span>

              <span>
                <strong>{summary.blockedTaskCount}</strong> blocked
              </span>

              <span className="text-rule-strong">•</span>

              <AuthorizationBadge state={summary.authAttention ? 'expiring' : 'valid'} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/tasks?new=true&clientId=${client.id}`)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Task</span>
            </Button>

            {summary.blockedTaskCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRequestMissingOpen(true)}
                className="flex items-center gap-1.5 border-warn-bd text-warn-fg bg-warn-bg/50 hover:bg-warn-bg"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Request Missing</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditClientOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Button>

            {client.status === 'archived' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRestore}
                className="flex items-center gap-1.5 text-stamp hover:text-stamp-strong"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setArchiveModalOpen(true)}
                className="flex items-center gap-1.5 text-critical hover:text-critical"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.print()}
              title="Print Client Profile and History"
            >
              <Printer className="w-3.5 h-3.5 text-ink-3" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="px-6 border-t border-rule bg-sheet-2/40 overflow-x-auto scrollbar-none flex items-center gap-1">
          {TABS.map((tab) => {
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={`px-3.5 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-stamp text-stamp font-bold bg-sheet/80'
                    : 'border-transparent text-ink-2 hover:text-ink hover:border-rule-strong'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {/* TAB 1: OVERVIEW */}
        {currentTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Status Groups Summary */}
              <div className="bg-sheet border border-rule rounded-panel p-5 space-y-4">
                <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                  Tax Filing & Task Status Breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-sheet-2 rounded-control border border-rule">
                    <span className="text-[11px] text-ink-3 block">Open Returns</span>
                    <span className="text-xl font-black text-ink">{openTasks.length}</span>
                  </div>
                  <div className="p-3 bg-sheet-2 rounded-control border border-rule">
                    <span className="text-[11px] text-ink-3 block">Blocked Lines</span>
                    <span className="text-xl font-black text-warn-fg">{summary.blockedTaskCount}</span>
                  </div>
                  <div className="p-3 bg-sheet-2 rounded-control border border-rule">
                    <span className="text-[11px] text-ink-3 block">Pending Review</span>
                    <span className="text-xl font-black text-info-fg">{summary.pendingReviewCount}</span>
                  </div>
                  <div className="p-3 bg-sheet-2 rounded-control border border-rule">
                    <span className="text-[11px] text-ink-3 block">Completed (Total)</span>
                    <span className="text-xl font-black text-good-fg">{closedTasks.length}</span>
                  </div>
                </div>
              </div>

              {/* Next 3 Due Tasks */}
              <div className="bg-sheet border border-rule rounded-panel p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                    Upcoming Return Deadlines
                  </h3>
                  <button onClick={() => setTab('tasks')} className="text-xs text-stamp font-bold hover:underline">
                    View All ({openTasks.length})
                  </button>
                </div>

                {openTasks.length === 0 ? (
                  <p className="text-xs text-ink-3 py-4 text-center">No open tax filings for this client</p>
                ) : (
                  <div className="space-y-2">
                    {openTasks.slice(0, 3).map(({ task, dueState }) => (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="p-3 bg-sheet-2 hover:bg-sheet-3 rounded-control border border-rule flex items-center justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-stamp">{task.templateId ? task.templateId.toUpperCase() : 'FILING'}</span>
                            <span className="text-xs font-bold text-ink">{task.title || task.templateId || 'Tax Filing'}</span>
                          </div>
                          <span className="text-[11px] text-ink-3 font-mono">Period: {task.period}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DueBadge state={dueState} dueDate={task.dueDate} />
                          <ChevronRight className="w-4 h-4 text-ink-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column Metrics */}
            <div className="space-y-6">
              <div className="bg-sheet border border-rule rounded-panel p-5 space-y-4">
                <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                  Service & Filing Cadence
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-rule">
                    <span className="text-ink-3">Filing Channel</span>
                    <span className="font-bold text-ink uppercase">{client.filingChannel}</span>
                  </div>
                  {client.filingChannel === 'efps' && (
                    <div className="flex justify-between py-1.5 border-b border-rule">
                      <span className="text-ink-3">eFPS Staggered Group</span>
                      <span className="font-bold text-ink">Group {client.efpsGroup || 'B'}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 border-b border-rule">
                    <span className="text-ink-3">Avg. Days to Send Docs</span>
                    <span className="font-bold text-ink">3.8 days</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-rule">
                    <span className="text-ink-3">Accounting Year Ends</span>
                    <span className="font-bold text-ink">Month {client.fiscalYearEndMonth || 12}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-ink-3">Assigned Preparers</span>
                    <span className="font-bold text-ink">
                      {summary.assignedUsers.map((u) => u.displayName).join(', ') || 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TASKS */}
        {currentTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                Active Returns & Filings ({openTasks.length})
              </h3>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/tasks?new=true&clientId=${client.id}`)}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Task</span>
              </Button>
            </div>

            {openTasks.length === 0 ? (
              <div className="p-8 text-center bg-sheet border border-rule rounded-panel text-ink-3">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-good-fg" />
                <p className="text-xs font-bold text-ink">All tasks completed for this client</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openTasks.map(({ task, dueState, displayedStatus, requiredLineCount }) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="p-4 bg-sheet hover:bg-sheet-2 rounded-panel border border-rule flex items-center justify-between gap-4 cursor-pointer transition-colors shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-stamp-soft text-stamp">
                          {task.templateId ? task.templateId.toUpperCase() : 'FILING'}
                        </span>
                        <h4 className="font-bold text-xs text-ink">{task.title || task.templateId || 'Tax Filing'}</h4>
                        <StatusChip status={displayedStatus} />
                      </div>
                      <p className="text-[11px] text-ink-3 font-mono">
                        Period: {task.period} · {requiredLineCount} required checklist items
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <DueBadge state={dueState} dueDate={task.dueDate} />
                      <ChevronRight className="w-4 h-4 text-ink-3" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HISTORY */}
        {currentTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
              Closed Filing History &amp; Stamped Evidence ({closedTasks.length})
            </h3>
            {closedTasks.length === 0 ? (
              <div className="p-8 text-center bg-sheet border border-rule rounded-panel text-ink-3">
                <p className="text-xs">No completed or archived filings recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {closedTasks.map(({ task }) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="p-3.5 bg-sheet rounded-panel border border-rule flex items-center justify-between gap-3 hover:bg-sheet-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileCheck2 className="w-4 h-4 text-good-fg" />
                      <div>
                        <span className="font-bold text-xs text-ink">{task.templateId ? task.templateId.toUpperCase() : 'RECORD'} - {task.title || task.templateId || 'Filing'}</span>
                        <p className="text-[11px] text-ink-3 font-mono">Period {task.period} · Completed</p>
                      </div>
                    </div>
                    <span className="text-xs text-ink-3">View Record</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DOCUMENTS */}
        {currentTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                Client Documents & Receipts ({clientDocs.length})
              </h3>
            </div>
            {clientDocs.length === 0 ? (
              <div className="p-8 text-center bg-sheet border border-rule rounded-panel text-ink-3">
                <FileText className="w-8 h-8 mx-auto mb-2 text-ink-3/40" />
                <p className="text-xs">No documents uploaded for this client yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clientDocs.map((doc) => (
                  <div key={doc.id} className="p-3 bg-sheet rounded-control border border-rule flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-stamp shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-ink truncate">{doc.displayName}</p>
                        <p className="text-[10px] text-ink-3 uppercase">{doc.kind} · {formatDate(doc.createdAt.slice(0, 10))}</p>
                      </div>
                    </div>
                    <a
                      href={doc.storageKey}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-ink-3 hover:text-stamp"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: FOLLOW-UPS */}
        {currentTab === 'follow-ups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                Follow-ups &amp; Document Requests ({followUps.length})
              </h3>
            </div>
            {followUps.length === 0 ? (
              <div className="p-8 text-center bg-sheet border border-rule rounded-panel text-ink-3">
                <p className="text-xs">No active follow-ups for this client</p>
              </div>
            ) : (
              <div className="space-y-2">
                {followUps.map((fu) => (
                  <div key={fu.followUp.id} className="p-4 bg-sheet rounded-panel border border-rule space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink capitalize">Channel: {fu.followUp.channel}</span>
                      <span className="text-ink-3">{formatDate(fu.followUp.createdAt.slice(0, 10))}</span>
                    </div>
                    {fu.attempts.length > 0 && (
                      <p className="text-xs text-ink-2 bg-sheet-2 p-2 rounded-control italic">
                        "{fu.attempts[fu.attempts.length - 1].messageSnapshot}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: PAYMENTS */}
        {currentTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                Payments &amp; Retainer Ledger ({payments.length})
              </h3>
            </div>
            {payments.length === 0 ? (
              <div className="p-8 text-center bg-sheet border border-rule rounded-panel text-ink-3">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-ink-3/40" />
                <p className="text-xs">No payments recorded for this client</p>
              </div>
            ) : (
              <div className="bg-sheet rounded-panel border border-rule overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-sheet-2 border-b border-rule text-ink-2 font-semibold">
                    <tr>
                      <th className="p-3">Paid On</th>
                      <th className="p-3">Channel</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule font-sans">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-sheet-2">
                        <td className="p-3 font-mono">{p.paidOn}</td>
                        <td className="p-3 uppercase font-medium">{p.channel.replace(/_/g, ' ')}</td>
                        <td className="p-3 font-mono text-ink-3">{p.referenceNo || '—'}</td>
                        <td className="p-3 text-right font-mono font-bold text-ink">
                          {formatPeso(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: AUTHORIZATIONS */}
        {currentTab === 'authorizations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                  Active Legal Authorizations ({activeAuths.length})
                </h3>
                <p className="text-[11px] text-ink-3">Special Powers of Attorney, Sec. Certs, and Letters of Authority</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedAuth(null);
                  setReplaceTargetId(null);
                  setAuthModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Authorization</span>
              </Button>
            </div>

            {activeAuths.length === 0 ? (
              <div className="p-8 text-center bg-sheet border border-rule rounded-panel text-ink-3">
                <ShieldAlert className="w-8 h-8 text-critical mx-auto mb-2" />
                <p className="text-xs font-bold text-ink">No active legal authorization on file</p>
                <p className="text-[11px] text-ink-3 mt-1">
                  Add an SPA or Letter of Authority before submitting filings at the RDO.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeAuths.map((a) => {
                  const state = authorizationState(a, todayStr);
                  const granteeMem = memberships?.find((m) => m.userId === a.granteeUserId);
                  const grantee = granteeMem ? (granteeMem.userId === 'user-ana' ? 'Ana Santos (Owner)' : granteeMem.userId === 'user-ben' ? 'Ben Morales (Helper)' : granteeMem.email) : a.granteeUserId;
                  return (
                    <div
                      key={a.id}
                      className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-2xs relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-ink tracking-wide">
                          {a.type.replace(/_/g, ' ')}
                        </span>
                        <AuthorizationBadge state={state} />
                      </div>

                      <div className="text-xs space-y-1 text-ink-2">
                        <p>
                          <span className="text-ink-3">Authorized Person:</span> <strong>{grantee}</strong>
                        </p>
                        <p>
                          <span className="text-ink-3">Issued On:</span> {formatDate(a.issuedOn)}
                        </p>
                        <p>
                          <span className="text-ink-3">Valid Until:</span>{' '}
                          {a.validUntil ? formatDate(a.validUntil) : 'No stated expiry'}
                        </p>
                        <p>
                          <span className="text-ink-3">Notarized:</span>{' '}
                          {a.notarized ? <strong className="text-good-fg">Yes (Sealed)</strong> : 'No'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-rule flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAuth(a);
                            setReplaceTargetId(null);
                            setAuthModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedAuth(null);
                            setReplaceTargetId(a.id);
                            setAuthModalOpen(true);
                          }}
                        >
                          Replace (Keep History)
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Replaced History */}
            {replacedAuths.length > 0 && (
              <div className="pt-4 border-t border-rule space-y-3">
                <h4 className="text-xs font-bold text-ink-3 uppercase">Replaced Authorization History</h4>
                <div className="space-y-2">
                  {replacedAuths.map((ra) => (
                    <div key={ra.id} className="p-3 bg-sheet-2 rounded-control border border-rule flex items-center justify-between text-xs text-ink-3">
                      <div>
                        <span className="font-bold text-ink uppercase">{ra.type.replace(/_/g, ' ')}</span> · Issued {formatDate(ra.issuedOn)}
                      </div>
                      <span className="text-[11px] font-mono">Archived / Replaced</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 8: CONTACTS */}
        {currentTab === 'contacts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                  Contact Persons ({contacts.length})
                </h3>
                <p className="text-[11px] text-ink-3">Partners, accounting officers, and designated signatories</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setSelectedContact(null);
                  setContactModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </Button>
            </div>

            {contacts.length === 0 ? (
              <div className="p-8 text-center bg-sheet border border-rule rounded-panel text-ink-3">
                <Users className="w-8 h-8 text-ink-3/40 mx-auto mb-2" />
                <p className="text-xs font-bold text-ink">No contact persons registered</p>
                <p className="text-[11px] text-ink-3 mt-1">Add a representative to receive follow-ups and sign BIR forms.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contacts.map((c) => (
                  <div key={c.id} className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-ink">
                            {c.title ? `${c.title} ` : ''}{c.name}
                          </h4>
                          {c.isSignatory && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-stamp-soft text-stamp border border-stamp/20">
                              Signatory
                            </span>
                          )}
                        </div>
                        {c.role && <p className="text-[11px] text-ink-3">{c.role}</p>}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedContact(c);
                            setContactModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs space-y-1 text-ink-2 pt-2 border-t border-rule">
                      {c.phoneE164 && (
                        <div className="flex items-center gap-2 font-mono">
                          <Phone className="w-3.5 h-3.5 text-ink-3" />
                          <a href={`tel:${c.phoneE164}`} className="hover:text-stamp">{c.phoneE164}</a>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-ink-3" />
                          <a href={`mailto:${c.email}`} className="hover:text-stamp">{c.email}</a>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-ink-3 pt-1">
                        <span>Preferred: <strong className="text-ink capitalize">{c.preferredChannel}</strong></span>
                        <span>•</span>
                        <span>Language: <strong className="text-ink uppercase">{c.language}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 9: NOTES */}
        {currentTab === 'notes' && (
          <div className="space-y-6">
            <div className="bg-sheet border border-rule rounded-panel p-5 space-y-4">
              <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                Add Practice Note
              </h3>

              {/* Password notice banner per Spec 11.7.3 */}
              <div className="p-2.5 rounded-control bg-sheet-2 border border-rule text-xs text-ink-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-stamp shrink-0" />
                <span>Notice: Don't store eFPS, eBIRForms or ORUS passwords here.</span>
              </div>

              {noteHasPassword && (
                <div className="p-2.5 rounded-control bg-warn-bg border border-warn-bd text-warn-fg text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>This looks like a password. Store passwords in a password manager, not in Ordinovix.</span>
                </div>
              )}

              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Record client instructions, special RDO routing notes, or accounting preferences..."
                  rows={3}
                  className="w-full p-3 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notePinned}
                      onChange={(e) => setNotePinned(e.target.checked)}
                      className="rounded text-stamp focus:ring-stamp"
                    />
                    <span>Pin to top of client notes</span>
                  </label>

                  <Button variant="primary" size="sm" type="submit" loading={saveNote.isPending}>
                    Save Note
                  </Button>
                </div>
              </form>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold tracking-wider text-ink uppercase">
                Notes History ({notes.length})
              </h3>

              {notes.length === 0 ? (
                <p className="text-xs text-ink-3 py-4 text-center">No notes recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 rounded-panel border text-xs space-y-1.5 ${
                        n.pinned ? 'bg-stamp-soft/30 border-stamp/30' : 'bg-sheet border-rule'
                      }`}
                    >
                      <div className="flex items-center justify-between text-ink-3 text-[11px]">
                        <span className="font-semibold text-ink">Ana Santos</span>
                        <span>{formatDateTime(n.createdAt)}</span>
                      </div>
                      <p className="text-ink leading-relaxed whitespace-pre-wrap">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Client Form Sheet */}
      <ClientFormSheet
        open={editClientOpen}
        onClose={() => setEditClientOpen(false)}
        client={client}
      />

      {/* Contact Form Modal */}
      <ContactFormModal
        open={contactModalOpen}
        onClose={() => {
          setContactModalOpen(false);
          setSelectedContact(null);
        }}
        clientId={client.id}
        contact={selectedContact}
      />

      {/* Authorization Form Modal */}
      <AuthorizationFormModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setSelectedAuth(null);
          setReplaceTargetId(null);
        }}
        clientId={client.id}
        authorization={selectedAuth}
        replaceTargetId={replaceTargetId}
      />

      {/* Archive Reason Modal per Spec 11.7.2 & QA #4 */}
      {archiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setArchiveModalOpen(false)} />
          <div className="relative w-full max-w-md bg-sheet rounded-modal border border-rule shadow-2xl p-5 space-y-4 z-10">
            <h3 className="text-sm font-bold text-ink">Archive Client: {client.displayName}</h3>
            <p className="text-xs text-ink-2">
              Archiving removes this client from the active directory and Today focus queue. Closed filing history remains accessible.
            </p>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Reason for Archiving <span className="text-critical">*</span>
              </label>
              <textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="e.g. Closed business; engaged in-house accountant; retainer terminated"
                rows={3}
                className="w-full p-2.5 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setArchiveModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!archiveReason.trim()}
                onClick={handleArchive}
                loading={archiveClient.isPending}
              >
                Archive Client
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request Missing Items Modal */}
      {requestMissingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setRequestMissingOpen(false)} />
          <div className="relative w-full max-w-lg bg-sheet rounded-modal border border-rule shadow-2xl p-5 space-y-4 z-10">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <h3 className="text-sm font-bold text-ink">Request All Missing Items ({client.code})</h3>
              <button onClick={() => setRequestMissingOpen(false)} className="text-ink-3 hover:text-ink">✕</button>
            </div>
            <p className="text-xs text-ink-2">
              Consolidated message containing all blocked checklist requirements ready to send via Viber, SMS, or Email:
            </p>
            <div className="p-3 bg-sheet-2 border border-rule rounded-control text-xs font-mono text-ink leading-relaxed">
              Hi {client.displayName}, here are the pending items we need for your upcoming BIR filings:
              <br /><br />
              {openTasks.map((t) => (
                <div key={t.task.id}>
                  • {t.task.title || (t.task.templateId ? t.task.templateId.toUpperCase() : 'BIR Filing')} ({t.task.period}):
                  <br />
                  &nbsp;&nbsp;- Complete signed schedule &amp; invoices
                </div>
              ))}
              <br />
              Please send them over at your earliest convenience. Thank you!
            </div>
            <div className="flex items-center justify-between pt-2">
              {copiedMissing && <span className="text-xs text-good-fg font-bold">Copied to clipboard!</span>}
              <div className="flex gap-2 ml-auto">
                <Button variant="ghost" size="sm" onClick={() => setRequestMissingOpen(false)}>
                  Close
                </Button>
                <Button variant="primary" size="sm" onClick={handleCopyMissingMessage}>
                  Copy Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
