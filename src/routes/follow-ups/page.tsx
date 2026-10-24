import React from 'react';
import { useFollowUps } from '@/hooks/useData';
import { formatDate } from '@/lib/format';
import { MessageSquare, Send, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FollowUpsPage() {
  const { data, isLoading } = useFollowUps();
  const followUps = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Follow-ups</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Track document requests sent to clients via Viber, Messenger, or Email
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-sheet-3 rounded-panel" />
          <div className="h-20 bg-sheet-3 rounded-panel" />
        </div>
      ) : followUps.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3">
          <MessageSquare className="w-8 h-8 text-ink-3 mx-auto mb-2" />
          <p className="text-sm font-semibold text-ink">No pending client follow-ups</p>
        </div>
      ) : (
        <div className="bg-sheet border border-rule rounded-panel divide-y divide-rule shadow-xs">
          {followUps.map(({ followUp, client, task, lines, state }) => (
            <div key={followUp.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink">{client.displayName}</span>
                  <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-sheet-2 text-ink-2 border border-rule uppercase">
                    {followUp.channel}
                  </span>
                  <span className="text-xs text-ink-3">Attempts: {followUp.attemptCount}</span>
                </div>
                <div className="text-sm font-bold text-ink">{task?.title || 'Document Request'}</div>
                <div className="text-xs text-ink-2">
                  Waiting on: {lines.map((l) => l.label).join(', ')}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-3">
                  Expected: {followUp.expectedBy ? formatDate(followUp.expectedBy) : 'Open'}
                </span>
                <button
                  onClick={() => alert(`Copied message reminder for ${client.displayName}`)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong"
                >
                  Copy Message
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
