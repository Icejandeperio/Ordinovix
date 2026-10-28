import { useState } from 'react';
import { useMessageTemplates, useSaveMessageTemplate } from '@/hooks/useData';
import { QueryState } from '@/components/ui/query-state';
import type { MessageTemplate } from '@/domain/types';

const LANGUAGE_LABELS: Record<MessageTemplate['language'], string> = { en: 'English', fil: 'Filipino' };

function TemplateCard({ template, onSaved }: { template: MessageTemplate; onSaved: () => void }) {
  const save = useSaveMessageTemplate();
  const [body, setBody] = useState(template.body);
  const [error, setError] = useState<string | null>(null);
  const changed = body !== template.body;

  const handleSave = () => {
    setError(null);
    save.mutate({ id: template.id, version: template.version, body }, { onSuccess: onSaved, onError: (err) => setError((err as Error).message) });
  };

  return (
    <div className="p-3.5 rounded-lg border border-[var(--rule)] bg-[var(--sheet-2)]">
      <div className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider mb-2">
        {template.name.includes(LANGUAGE_LABELS[template.language]) ? template.name : `${template.name} (${LANGUAGE_LABELS[template.language]})`}
      </div>
      <textarea
        aria-label={`${template.name} message`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        className="w-full text-xs text-[var(--ink-2)] bg-[var(--sheet)] p-3 rounded border border-[var(--rule)] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--stamp)]"
      />
      <div className="mt-2 flex items-center justify-end gap-3">
        {error && (
          <p role="alert" className="text-xs text-[var(--critical-fg)] mr-auto">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!changed || save.isPending}
          className="px-3 py-1.5 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

/** Message templates (owner only): each is loaded from and saved to messages.list and messages.save. */
export function MessagesSection({ onSaved }: { onSaved: () => void }) {
  const { data: templates, isLoading, isError, error, refetch } = useMessageTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[var(--ink)]">Message Templates</h2>
        <p className="text-xs text-[var(--ink-3)] mt-0.5">Pre-composed messages for Viber and WhatsApp follow-ups with variable chips.</p>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        subject="message templates"
        isEmpty={!templates || templates.length === 0}
        empty={<p className="text-xs text-[var(--ink-3)]">No message templates yet.</p>}
      >
        <div className="space-y-4">
          {(templates ?? []).map((t) => (
            <TemplateCard key={`${t.id}-${t.version}`} template={t} onSaved={onSaved} />
          ))}
        </div>
      </QueryState>
    </div>
  );
}
