import { Link } from 'react-router-dom';
import { Search, Home, FileQuestion } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--sheet)] border border-[var(--rule)] rounded-xl p-8 text-center space-y-5 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-[var(--neutral-bg)] text-[var(--neutral-fg)] border border-[var(--neutral-bd)] flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <div className="font-mono text-xs font-bold text-[var(--stamp-ink)] uppercase tracking-wider">Error 404</div>
          <h1 className="text-xl font-bold text-[var(--ink)]">Page Not Found</h1>
          <p className="text-xs text-[var(--ink-2)] leading-relaxed pt-1">
            This page doesn't exist. It may have been moved, archived, or the link is incomplete.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Link
            to="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[var(--stamp)] text-[var(--on-stamp)] text-xs font-semibold hover:bg-[var(--stamp-strong)] transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Go to Today</span>
          </Link>

          <Link
            to="/search"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-[var(--rule)] bg-[var(--sheet)] text-[var(--ink)] text-xs font-semibold hover:bg-[var(--sheet-2)] transition-colors"
          >
            <Search className="w-4 h-4 text-[var(--ink-3)]" />
            <span>Search</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
