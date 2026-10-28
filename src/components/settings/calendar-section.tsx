import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  useDeadlineMoves,
  useHolidays,
  useRemoveDeadlineMove,
  useRemoveHoliday,
  useSaveHoliday,
  useSaveSettings,
} from '@/hooks/useData';
import { QueryState } from '@/components/ui/query-state';
import { DateField } from '@/components/inputs/date-field';
import { formatDate, todayInManila } from '@/lib/dates';
import { SaveBar, INPUT_CLASS, LABEL_CLASS } from './save-bar';
import type { Holiday, OrgSettings } from '@/domain/types';

const HOLIDAY_TYPES: Array<{ value: Holiday['type']; label: string }> = [
  { value: 'regular', label: 'Regular holiday' },
  { value: 'special_non_working', label: 'Special non-working day' },
  { value: 'local', label: 'Local holiday' },
  { value: 'office_closure', label: 'Office closure' },
];

function Thresholds({ settings, onSaved }: { settings: OrgSettings; onSaved: () => void }) {
  const save = useSaveSettings();
  const [dueSoon, setDueSoon] = useState(String(settings.dueSoonDays));
  const [chase, setChase] = useState(String(settings.followUpWaitDays));
  const [authWarn, setAuthWarn] = useState(String(settings.authWarnDays));
  const [error, setError] = useState<string | null>(null);

  const cards: Array<{ id: string; label: string; value: string; set: (v: string) => void }> = [
    { id: 'due-soon', label: 'Due-soon Window (days)', value: dueSoon, set: setDueSoon },
    { id: 'chase', label: 'Follow-up Chasing Interval (days)', value: chase, set: setChase },
    { id: 'auth-warn', label: 'Authorization Expiry Warning (days)', value: authWarn, set: setAuthWarn },
  ];

  const handleSave = () => {
    setError(null);
    save.mutate(
      { version: settings.version, dueSoonDays: Number(dueSoon), followUpWaitDays: Number(chase), authWarnDays: Number(authWarn) },
      { onSuccess: onSaved, onError: (err) => setError((err as Error).message) }
    );
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-[var(--ink-3)] uppercase tracking-wider">Default Thresholds</div>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.id} className="p-3 rounded border border-[var(--rule)] bg-[var(--sheet-2)]">
            <label htmlFor={`threshold-${c.id}`} className="text-xs text-[var(--ink-3)]">{c.label}</label>
            <input
              id={`threshold-${c.id}`}
              type="number"
              min={1}
              value={c.value}
              onChange={(e) => c.set(e.target.value)}
              className="mt-1 w-full bg-transparent text-lg font-bold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--stamp)] rounded"
            />
          </div>
        ))}
        <div className="p-3 rounded border border-[var(--rule)] bg-[var(--sheet-2)]">
          <div className="text-xs text-[var(--ink-3)]">Timezone Standard</div>
          <div className="text-sm font-bold text-[var(--ink)] font-mono mt-1">Asia/Manila (UTC+8)</div>
        </div>
      </div>
      <SaveBar onSave={handleSave} saving={save.isPending} error={error} />
    </div>
  );
}

function HolidaysList({ onSaved }: { onSaved: () => void }) {
  const year = Number(todayInManila().slice(0, 4));
  const { data: holidays, isLoading, isError, error, refetch } = useHolidays(year);
  const saveHoliday = useSaveHoliday();
  const removeHoliday = useRemoveHoliday();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<Holiday['type']>('regular');
  const [message, setMessage] = useState<string | null>(null);

  const sorted = [...(holidays ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  const handleAdd = () => {
    setMessage(null);
    saveHoliday.mutate(
      { date, name: name.trim(), type },
      {
        onSuccess: () => {
          setDate('');
          setName('');
          onSaved();
        },
        onError: (err) => setMessage((err as Error).message),
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-[var(--ink-3)] uppercase tracking-wider">Holidays {year}</div>
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        subject="holidays"
        isEmpty={sorted.length === 0}
        empty={<p className="text-xs text-[var(--ink-3)]">No holidays listed for {year}.</p>}
      >
        <div className="space-y-2">
          {sorted.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 p-2.5 rounded border border-[var(--rule)] bg-[var(--sheet)] text-sm text-[var(--ink)]">
              <div className="min-w-0">
                <div className="font-medium truncate">{h.name}</div>
                <div className="text-[11px] text-[var(--ink-3)]">
                  {formatDate(h.date)} · {HOLIDAY_TYPES.find((t) => t.value === h.type)?.label ?? h.type}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${h.name}`}
                disabled={removeHoliday.isPending}
                onClick={() => removeHoliday.mutate(h.id, { onSuccess: onSaved, onError: (err) => setMessage((err as Error).message) })}
                className="p-1.5 rounded text-[var(--ink-3)] hover:text-[var(--critical-fg)] hover:bg-[var(--critical-bg)]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </QueryState>

      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_190px_auto] gap-2 items-end">
        <DateField label="Date" value={date} onChange={(v) => setDate(v || '')} />
        <div>
          <label htmlFor="holiday-name" className={LABEL_CLASS}>Name</label>
          <input id="holiday-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="holiday-type" className={LABEL_CLASS}>Type</label>
          <select id="holiday-type" value={type} onChange={(e) => setType(e.target.value as Holiday['type'])} className={INPUT_CLASS}>
            {HOLIDAY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={saveHoliday.isPending}
          className="h-10 px-3.5 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-sm font-medium hover:bg-[var(--stamp-strong)] disabled:opacity-60"
        >
          Add holiday
        </button>
      </div>
      {message && (
        <p role="alert" className="text-xs text-[var(--critical-fg)]">
          {message}
        </p>
      )}
    </div>
  );
}

function DeadlineMovesList({ onSaved }: { onSaved: () => void }) {
  const { data: moves, isLoading, isError, error, refetch } = useDeadlineMoves();
  const remove = useRemoveDeadlineMove();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-[var(--ink-3)] uppercase tracking-wider">Deadline Moves</div>
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        subject="deadline moves"
        isEmpty={!moves || moves.length === 0}
        empty={<p className="text-xs text-[var(--ink-3)]">No deadline moves recorded.</p>}
      >
        <div className="space-y-2">
          {(moves ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 p-2.5 rounded border border-[var(--rule)] bg-[var(--sheet)] text-sm text-[var(--ink)]">
              <div className="min-w-0">
                <div className="font-medium truncate">Period {m.period} moved to {formatDate(m.newDueDate)}</div>
                <div className="text-[11px] text-[var(--ink-3)] font-mono truncate">{m.sourceRef}</div>
              </div>
              <button
                type="button"
                aria-label={`Remove move for ${m.period}`}
                disabled={remove.isPending}
                onClick={() => {
                  const reason = prompt('Reason for removing this deadline move:');
                  if (!reason) return;
                  setMessage(null);
                  remove.mutate({ id: m.id, reason }, { onSuccess: onSaved, onError: (err) => setMessage((err as Error).message) });
                }}
                className="p-1.5 rounded text-[var(--ink-3)] hover:text-[var(--critical-fg)] hover:bg-[var(--critical-bg)]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </QueryState>
      {message && (
        <p role="alert" className="text-xs text-[var(--critical-fg)]">
          {message}
        </p>
      )}
    </div>
  );
}

/** Deadlines and holidays (owner only): thresholds, holidays and deadline moves, each read from and saved to its repository. */
export function CalendarSection({ settings, onSaved }: { settings: OrgSettings; onSaved: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[var(--ink)]">Deadlines & Statutory Holidays</h2>
        <p className="text-xs text-[var(--ink-3)] mt-0.5">Statutory holiday rules and deadline move parameters.</p>
      </div>
      <Thresholds key={settings.version} settings={settings} onSaved={onSaved} />
      <HolidaysList onSaved={onSaved} />
      <DeadlineMovesList onSaved={onSaved} />
    </div>
  );
}
