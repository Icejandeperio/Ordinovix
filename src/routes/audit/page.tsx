import { useMemo, useState } from 'react';
import { useActivity, useClients, useMemberships, useSession } from '@/hooks/useData';
import { Shield, Filter, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ExportMenu } from '@/components/export-menu';
import { QueryState } from '@/components/ui/query-state';
import { DateField } from '@/components/inputs/date-field';
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  SENSITIVE_ACTIONS,
  describeDelta,
  isOverrideEvent,
  isSensitiveEvent,
  recordLink,
} from '@/lib/audit';
import type { ActivityAction, ActivityEntity, ActivityEvent } from '@/domain/types';

type View = 'all' | 'sensitive' | 'overrides';

const SELECT_CLASS =
  'h-8 px-2 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]';

/** "2026-10-24T14:32:10+08:00" as "2026-10-24 14:32:10" (the stored offset is always Asia/Manila). */
const stamp = (at: string) => `${at.slice(0, 10)} ${at.slice(11, 19)}`;

export function AuditPage() {
  const { data: session } = useSession();
  const isOwner = session?.membership.role === 'owner';

  const [view, setView] = useState<View>('all');
  const [actorId, setActorId] = useState('');
  const [entity, setEntity] = useState<ActivityEntity | ''>('');
  const [action, setAction] = useState<ActivityAction | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filters = useMemo(() => {
    let actions: ActivityAction[] | undefined = action ? [action] : undefined;
    if (view === 'sensitive') {
      actions = action ? SENSITIVE_ACTIONS.filter((a) => a === action) : [...SENSITIVE_ACTIONS];
    }
    return {
      actorId: actorId || undefined,
      entity: entity || undefined,
      actions: actions && actions.length === 0 ? (['__none__'] as unknown as ActivityAction[]) : actions,
      from: from || undefined,
      to: to || undefined,
    };
  }, [view, actorId, entity, action, from, to]);

  // Only the owner may read the practice-wide log
  const activity = useActivity(filters, Boolean(isOwner));
  const { data: memberships = [] } = useMemberships();
  const { data: clientsData } = useClients();

  const actorNames = useMemo(() => new Map(memberships.map((m) => [m.userId ?? '', m.name ?? m.email])), [memberships]);
  const clientNames = useMemo(
    () => new Map((clientsData?.items ?? []).map((c) => [c.client.id, c.client.displayName])),
    [clientsData]
  );

  const events: ActivityEvent[] = useMemo(() => {
    const items = activity.data?.items ?? [];
    return view === 'overrides' ? items.filter(isOverrideEvent) : items;
  }, [activity.data, view]);

  const actorName = (id: string) => actorNames.get(id) ?? (id === session?.user.id ? session.user.name : id);
  const targetName = (e: ActivityEvent) => (e.clientId ? clientNames.get(e.clientId) : undefined) ?? ENTITY_LABELS[e.entity];

  if (!isOwner) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="w-12 h-12 rounded-full bg-[var(--critical-bg)] text-[var(--critical-fg)] flex items-center justify-center mx-auto border border-[var(--critical-bd)]">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Access Denied</h1>
        <p className="text-sm text-[var(--ink-2)]">
          You do not have administrative permission to view the immutable practice audit log. Ask the practice owner to review these records.
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-sm font-semibold hover:bg-[var(--stamp-strong)] transition-colors"
        >
          Return to Today
        </Link>
      </div>
    );
  }

  const tabClass = (active: boolean, tone: 'stamp' | 'warn' | 'serious') =>
    `px-3 py-1 rounded-md font-medium text-xs transition-colors ${
      active
        ? tone === 'stamp'
          ? 'bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-bold'
          : tone === 'warn'
          ? 'bg-[var(--warn-bg)] text-[var(--warn-fg)] border border-[var(--warn-bd)] font-bold'
          : 'bg-[var(--serious-bg)] text-[var(--serious-fg)] border border-[var(--serious-bd)] font-bold'
        : 'text-[var(--ink-2)] hover:bg-[var(--sheet-2)]'
    }`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--rule)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[var(--stamp)]" />
            <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Audit Log</h1>
          </div>
          <p className="text-sm text-[var(--ink-2)] mt-0.5">
            Immutable, sequential activity trail of all operator actions, TIN reveals, status overrides, and system events.
          </p>
        </div>

        <div className="no-print">
          <ExportMenu
            label="Export Audit Log"
            getData={() => ({
              filename: `ordinovix-audit-log-${new Date().toISOString().slice(0, 10)}`,
              title: 'Practice Activity Audit Trail',
              subtitle: `View: ${view.toUpperCase()} · Total Events: ${events.length}`,
              headers: ['Timestamp (PHT)', 'Actor', 'Target Record', 'Action', 'Details / Delta', 'Client Device'],
              rows: events.map((e) => [stamp(e.at), actorName(e.actorId), targetName(e), ACTION_LABELS[e.action], describeDelta(e), e.device ?? '—']),
            })}
          />
        </div>
      </div>

      {/* Built-in views */}
      <div className="flex items-center gap-2 border-b border-[var(--rule)] pb-2 text-sm no-print flex-wrap">
        <Filter className="w-4 h-4 text-[var(--ink-3)] mr-1" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mr-2">Views:</span>
        <button onClick={() => setView('all')} className={tabClass(view === 'all', 'stamp')}>
          All Activity{view === 'all' && activity.data ? ` (${events.length})` : ''}
        </button>
        <button onClick={() => setView('sensitive')} className={tabClass(view === 'sensitive', 'warn')}>
          Sensitive Events (TIN & Access)
        </button>
        <button onClick={() => setView('overrides')} className={tabClass(view === 'overrides', 'serious')}>
          Manual Overrides & Reasons
        </button>
      </div>

      {/* Filters: actor, record type, action, date range */}
      <div className="flex items-end gap-3 flex-wrap no-print">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] flex flex-col gap-1">
          Actor
          <select value={actorId} onChange={(e) => setActorId(e.target.value)} className={SELECT_CLASS}>
            <option value="">Everyone</option>
            {memberships.map((m) => (
              <option key={m.id} value={m.userId ?? ''}>{m.name ?? m.email}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] flex flex-col gap-1">
          Record type
          <select value={entity} onChange={(e) => setEntity(e.target.value as ActivityEntity | '')} className={SELECT_CLASS}>
            <option value="">All records</option>
            {(Object.keys(ENTITY_LABELS) as ActivityEntity[]).map((k) => (
              <option key={k} value={k}>{ENTITY_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] flex flex-col gap-1">
          Action
          <select value={action} onChange={(e) => setAction(e.target.value as ActivityAction | '')} className={SELECT_CLASS}>
            <option value="">All actions</option>
            {(Object.keys(ACTION_LABELS) as ActivityAction[]).map((k) => (
              <option key={k} value={k}>{ACTION_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <div className="w-36">
          <DateField label="From" value={from} onChange={(v) => setFrom(v || '')} />
        </div>
        <div className="w-36">
          <DateField label="To" value={to} onChange={(v) => setTo(v || '')} />
        </div>
      </div>

      {/* Audit Table */}
      <QueryState
        isLoading={activity.isLoading}
        isError={activity.isError}
        error={activity.error}
        onRetry={() => activity.refetch()}
        subject="the audit log"
        isEmpty={events.length === 0}
        empty={
          <div className="p-10 text-center bg-[var(--sheet)] border border-[var(--rule)] rounded-lg text-sm text-[var(--ink-3)]">
            No activity matches these filters.
          </div>
        }
      >
        <div className="bg-[var(--sheet)] border border-[var(--rule)] rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--rule)] bg-[var(--sheet-2)] text-[var(--ink-3)] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp (PHT)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Record</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details / Delta</th>
                <th className="py-3 px-4">Client Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] font-normal text-[var(--ink)]">
              {events.map((evt) => {
                const link = recordLink(evt);
                const name = targetName(evt);
                const delta = describeDelta(evt);
                return (
                  <tr key={evt.id} className="hover:bg-[var(--sheet-2)] transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-[var(--ink-2)]">{stamp(evt.at)}</td>
                    <td className="py-3 px-4 font-medium whitespace-nowrap">{actorName(evt.actorId)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {link ? (
                        <Link to={link} className="font-semibold text-[var(--stamp)] hover:underline">{name}</Link>
                      ) : (
                        <span className="font-semibold text-[var(--stamp)]">{name}</span>
                      )}
                      <span className="ml-1.5 text-[10px] text-[var(--ink-3)] uppercase">{ENTITY_LABELS[evt.entity]}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isSensitiveEvent(evt)
                            ? 'bg-[var(--warn-bg)] text-[var(--warn-fg)] border border-[var(--warn-bd)]'
                            : isOverrideEvent(evt)
                            ? 'bg-[var(--serious-bg)] text-[var(--serious-fg)] border border-[var(--serious-bd)]'
                            : 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)]'
                        }`}
                      >
                        {ACTION_LABELS[evt.action]}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] max-w-xs truncate text-[var(--ink-2)]" title={delta}>
                      {delta}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[var(--ink-3)] whitespace-nowrap">{evt.device ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </QueryState>
    </div>
  );
}
