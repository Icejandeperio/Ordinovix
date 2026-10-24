import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useClient, useTasks } from '@/hooks/useData';
import { ArrowLeft, Users, Shield, Phone, Mail, FileText, CheckSquare, Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';

export function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { data, isLoading } = useClient(clientId || '');
  const { data: tasksData } = useTasks({ clientId });

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-sheet-3 rounded" />
        <div className="h-32 bg-sheet-3 rounded-panel" />
      </div>
    );
  }

  const { client, summary } = data;
  const tasks = tasksData?.items || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Clients</span>
        </Link>
      </div>

      {/* Client Profile Header */}
      <div className="bg-sheet border border-rule rounded-panel p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-chip text-xs font-black bg-stamp-soft text-stamp tracking-wider font-sans">
                {client.code}
              </span>
              <span className="text-xs text-ink-3 uppercase font-semibold">
                {client.entityType} · RDO {client.rdoCode}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-ink tracking-tight font-sans">
              {client.displayName}
            </h1>
            {client.registeredName && (
              <p className="text-xs text-ink-3">{client.registeredName}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/tasks/new?clientId=${client.id}`}
              className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </Link>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-rule text-xs">
          <div>
            <span className="text-ink-3 block">VAT Registration</span>
            <span className="font-semibold text-ink capitalize">{client.vatStatus.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-ink-3 block">Filing Mode</span>
            <span className="font-semibold text-ink uppercase">{client.filingChannel || 'Manual'}</span>
          </div>
          <div>
            <span className="text-ink-3 block">eFPS Group</span>
            <span className="font-semibold text-ink">{client.efpsGroup || 'N/A'}</span>
          </div>
          <div>
            <span className="text-ink-3 block">Fiscal Year End</span>
            <span className="font-semibold text-ink">Month {client.fiscalYearEndMonth}</span>
          </div>
        </div>
      </div>

      {/* Active Tasks for this Client */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-stamp" />
            <h2 className="text-sm font-bold tracking-tight text-ink uppercase">
              Active Filing Returns & Errands ({tasks.length})
            </h2>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="p-8 text-center bg-sheet border border-rule rounded-panel text-xs text-ink-3">
            No active filing tasks for this client.
          </div>
        ) : (
          <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
            {tasks.map((t) => (
              <Link
                key={t.task.id}
                to={`/tasks/${t.task.id}`}
                className="p-3.5 flex items-center justify-between hover:bg-sheet-2 transition-colors"
              >
                <div>
                  <h3 className="text-sm font-bold text-ink">{t.task.title}</h3>
                  <div className="text-xs text-ink-3">
                    Due: {formatDate(t.task.dueDate)} · {t.acceptedLineCount}/{t.requiredLineCount} items accepted
                  </div>
                </div>
                <span className="text-xs font-semibold text-stamp">View &rarr;</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
