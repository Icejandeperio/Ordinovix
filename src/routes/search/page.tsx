import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { repositories } from '@/data';
import { Search as SearchIcon, Users, CheckSquare, Building2 } from 'lucide-react';
import type { SearchResults } from '@/domain/types';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResults | null>(null);

  React.useEffect(() => {
    if (q) {
      repositories.search.query(q).then(setResults);
    }
  }, [q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink font-sans">
          Search Results for "{q}"
        </h1>
      </div>

      {!results ? (
        <div className="p-8 text-center text-xs text-ink-3">Searching...</div>
      ) : (
        <div className="space-y-4">
          {results.clients.length > 0 && (
            <div className="bg-sheet border border-rule rounded-panel p-4 space-y-2">
              <h3 className="text-xs font-bold text-stamp uppercase flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>Clients</span>
              </h3>
              <div className="divide-y divide-rule">
                {results.clients.map((c) => (
                  <Link
                    key={c.client.id}
                    to={`/clients/${c.client.id}`}
                    className="py-2 flex items-center justify-between text-xs hover:text-stamp"
                  >
                    <span className="font-bold">{c.client.displayName}</span>
                    <span className="text-ink-3">{c.client.code}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.tasks.length > 0 && (
            <div className="bg-sheet border border-rule rounded-panel p-4 space-y-2">
              <h3 className="text-xs font-bold text-stamp uppercase flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4" />
                <span>Tasks</span>
              </h3>
              <div className="divide-y divide-rule">
                {results.tasks.map((t) => (
                  <Link
                    key={t.task.id}
                    to={`/tasks/${t.task.id}`}
                    className="py-2 flex items-center justify-between text-xs hover:text-stamp"
                  >
                    <span className="font-bold">{t.task.title}</span>
                    <span className="text-ink-3">{t.client.displayName}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
