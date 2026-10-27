import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FileQuestion, Home, Lock, RotateCw, Search, WifiOff } from 'lucide-react';
import { classifyError } from '@/domain/errors';

interface QueryErrorPanelProps {
  error: unknown;
  onRetry?: () => void;
  /** What could not be loaded, for the generic message ("visits", "this client"). */
  subject?: string;
}

/** Error view for a failed query: 403, 404, offline or generic, with Retry where it can help. Copy follows spec 11.20. */
export function QueryErrorPanel({ error, onRetry, subject = 'this page' }: QueryErrorPanelProps) {
  const kind = classifyError(error);

  const view =
    kind === 'forbidden'
      ? {
          icon: <Lock className="w-6 h-6" />,
          title: 'No access',
          body: "You don't have access to this client. Ask the owner to assign it to you.",
          retry: false,
        }
      : kind === 'not_found'
      ? {
          icon: <FileQuestion className="w-6 h-6" />,
          title: 'Not found',
          body: "This page doesn't exist. It may have been moved or the link is incomplete.",
          retry: false,
        }
      : kind === 'offline'
      ? {
          icon: <WifiOff className="w-6 h-6" />,
          title: "You're offline",
          body: `You're offline and ${subject} hasn't been opened on this device before.`,
          retry: true,
        }
      : {
          icon: <AlertCircle className="w-6 h-6" />,
          title: 'Something went wrong',
          body: `We could not load ${subject}. Your saved changes are safe.`,
          retry: true,
        };

  return (
    <div role="alert" className="min-h-[40vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-sheet border border-rule rounded-panel p-6 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-sheet-2 text-ink-2 border border-rule flex items-center justify-center mx-auto">
          {view.icon}
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-ink">{view.title}</h2>
          <p className="text-xs text-ink-2 leading-relaxed">{view.body}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          {view.retry && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-control bg-stamp text-on-stamp text-xs font-semibold hover:bg-stamp-strong transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          )}
          <Link
            to="/"
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-control border border-rule bg-sheet text-ink text-xs font-semibold hover:bg-sheet-2 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Go to Today</span>
          </Link>
          {kind === 'not_found' && (
            <Link
              to="/search"
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-control border border-rule bg-sheet text-ink text-xs font-semibold hover:bg-sheet-2 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** Default loading skeleton when a page does not pass its own. */
export function QuerySkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-40 bg-sheet-3 rounded" />
      <div className="h-32 bg-sheet-3 rounded-panel" />
      <div className="h-32 bg-sheet-3 rounded-panel" />
    </div>
  );
}

interface QueryStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Own skeleton to keep the page's look while loading. */
  loading?: ReactNode;
  /** True when the loaded data has nothing to show. */
  isEmpty?: boolean;
  empty?: ReactNode;
  subject?: string;
  children: ReactNode;
}

/**
 * The one wrapper for data-backed content: loading skeleton, error with Retry (403 and 404 variants),
 * empty, then the populated children. Pass the fields of a TanStack Query result.
 */
export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  loading,
  isEmpty,
  empty,
  subject,
  children,
}: QueryStateProps) {
  if (isError) return <QueryErrorPanel error={error} onRetry={onRetry} subject={subject} />;
  if (isLoading) return <>{loading ?? <QuerySkeleton />}</>;
  if (isEmpty && empty) return <>{empty}</>;
  return <>{children}</>;
}
