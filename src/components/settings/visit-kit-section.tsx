import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useVisitKit, useSaveVisitKitItem } from '@/hooks/useData';
import { QueryState } from '@/components/ui/query-state';
import { INPUT_CLASS } from './save-bar';

/** Standard visit kit (owner only): the items on every trip pack list, from visitKit.list and visitKit.save. */
export function VisitKitSection({ onSaved }: { onSaved: () => void }) {
  const { data: items, isLoading, isError, error, refetch } = useVisitKit();
  const save = useSaveVisitKitItem();
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const sorted = [...(items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const run = (item: Parameters<typeof save.mutate>[0], after?: () => void) => {
    setMessage(null);
    save.mutate(item, {
      onSuccess: () => {
        after?.();
        onSaved();
      },
      onError: (err) => setMessage((err as Error).message),
    });
  };

  const handleAdd = () => {
    const text = label.trim();
    if (!text) return;
    run({ label: text, sortOrder: sorted.length + 1 }, () => setLabel(''));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[var(--ink)]">Standard Visit Kit</h2>
        <p className="text-xs text-[var(--ink-3)] mt-0.5">Items automatically included on every field trip pack list.</p>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        subject="the visit kit"
        isEmpty={sorted.length === 0}
        empty={<p className="text-xs text-[var(--ink-3)]">No kit items yet. Add the first one below.</p>}
      >
        <div className="space-y-2">
          {sorted.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 p-3 rounded border border-[var(--rule)] bg-[var(--sheet)] text-sm text-[var(--ink)] cursor-pointer"
            >
              <Check className={`w-4 h-4 shrink-0 ${item.active ? 'text-[var(--good-solid)]' : 'text-[var(--ink-3)] opacity-40'}`} />
              <span className={`flex-1 ${item.active ? '' : 'line-through text-[var(--ink-3)]'}`}>{item.label}</span>
              <input
                type="checkbox"
                checked={item.active}
                aria-label={`Include ${item.label} on pack lists`}
                disabled={save.isPending}
                onChange={(e) => run({ id: item.id, version: item.version, active: e.target.checked })}
                className="w-4 h-4 accent-[var(--stamp)] rounded"
              />
            </label>
          ))}
        </div>
      </QueryState>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a kit item"
          aria-label="New kit item"
          className={INPUT_CLASS}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!label.trim() || save.isPending}
          className="flex items-center gap-1.5 px-3.5 h-10 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-sm font-medium hover:bg-[var(--stamp-strong)] disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
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
