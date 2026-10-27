import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Circle, Sparkles } from 'lucide-react';
import { useSession, useSaveSettings } from '@/hooks/useData';
import { ONBOARDING_STEPS, doneSteps, firstOpenStep, showGettingStarted } from '@/lib/onboarding';

/** Spec 11.3: the five setup steps with their progress, until the setup is finished or the owner dismisses it. */
export function GettingStartedCard() {
  const { data: session } = useSession();
  const save = useSaveSettings();

  if (!session || session.membership.role !== 'owner') return null;
  const progress = session.settings.onboarding;
  if (!showGettingStarted(progress)) return null;

  const done = doneSteps(progress);
  const dismiss = () =>
    save.mutate(
      { onboarding: { done, dismissed: true } },
      { onError: (err) => toast.error((err as Error).message || 'Could not hide the card. Try again.') },
    );

  return (
    <section aria-label="Getting started" className="p-4 sm:p-5 rounded-panel border border-rule bg-sheet shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Sparkles className="w-4 h-4 text-stamp" />
          Getting started
        </h2>
        <span className="text-xs font-semibold text-ink-2">{done.length} of {ONBOARDING_STEPS.length} done</span>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {ONBOARDING_STEPS.map((s) => {
          const isDone = done.includes(s.key);
          return (
            <li key={s.key} className="flex items-center gap-2 text-xs text-ink-2">
              {isDone ? <Check className="w-3.5 h-3.5 text-good shrink-0" /> : <Circle className="w-3.5 h-3.5 text-ink-3 shrink-0" />}
              <span className={isDone ? 'line-through text-ink-3' : 'text-ink'}>{s.title}</span>
              <span className="sr-only">{isDone ? ' (done)' : ' (to do)'}</span>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-3 pt-1">
        <Link
          to={`/welcome?step=${firstOpenStep(progress)}`}
          className="inline-flex items-center min-h-[44px] sm:min-h-0 px-4 py-2 rounded-lg bg-stamp text-on-stamp text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors"
        >
          Continue setup
        </Link>
        <button
          type="button"
          onClick={dismiss}
          disabled={save.isPending}
          className="min-h-[44px] sm:min-h-0 px-2 text-xs font-medium text-ink-3 hover:text-ink transition-colors"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
