import { useMemo } from 'react';
import { Link, useRouteError } from 'react-router-dom';
import { Home, RotateCw, TriangleAlert } from 'lucide-react';

/** Short, copy-friendly reference the operator can read out when something breaks. */
function makeErrorId(): string {
  return 'ERR-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Router error boundary (spec 11.20): a crash is not a 404. */
export function RouteErrorPage() {
  const error = useRouteError();
  const errorId = useMemo(() => makeErrorId(), []);

  if (typeof console !== 'undefined') {
    console.error(`[${errorId}] route error`, error);
  }

  return (
    <div role="alert" className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--sheet)] border border-[var(--rule)] rounded-xl p-8 text-center space-y-5 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)] flex items-center justify-center mx-auto">
          <TriangleAlert className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <div className="font-mono text-xs font-bold text-[var(--stamp-ink)] uppercase tracking-wider">Error ID {errorId}</div>
          <h1 className="text-xl font-bold text-[var(--ink)]">Something went wrong</h1>
          <p className="text-xs text-[var(--ink-2)] leading-relaxed pt-1">
            This page stopped working. Your saved changes are safe.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            <span>Reload</span>
          </button>

          <Link
            to="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs font-semibold hover:bg-[var(--sheet-2)] transition-colors"
          >
            <Home className="w-4 h-4 text-[var(--ink-3)]" />
            <span>Go to Today</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
