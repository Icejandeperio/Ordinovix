import type { ReactNode } from 'react';
import { Save } from 'lucide-react';

interface SaveBarProps {
  onSave: () => void;
  saving?: boolean;
  /** Message from a failed save, shown next to the button. */
  error?: string | null;
  disabled?: boolean;
  /** Extra controls on the left (for example a sign-out button). */
  children?: ReactNode;
}

/** The "Save changes" footer shared by every settings section. */
export function SaveBar({ onSave, saving = false, error, disabled = false, children }: SaveBarProps) {
  return (
    <div className="pt-4 border-t border-[var(--rule)] flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {children}
        {error && (
          <p role="alert" className="text-xs text-[var(--critical-fg)] truncate">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || saving}
        className="ml-auto flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] font-medium text-sm hover:bg-[var(--stamp-strong)] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Save className="w-4 h-4" />
        <span>{saving ? 'Saving…' : 'Save changes'}</span>
      </button>
    </div>
  );
}

export const INPUT_CLASS =
  'w-full h-10 px-3 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--stamp)] read-only:bg-[var(--sheet-2)] read-only:text-[var(--ink-2)]';
export const LABEL_CLASS = 'block text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1';
