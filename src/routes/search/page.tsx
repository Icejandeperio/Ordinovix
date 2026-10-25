import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { repositories } from '@/data';
import { formatDate, formatPeso } from '@/lib/format';
import { StatusChip, DueBadge, ReadinessMeter } from '@/components/ui/status-chip';
import { Button } from '@/components/ui/button';
import {
  Search as SearchIcon,
  Users,
  CheckSquare,
  FileText,
  MapPin,
  Send,
  CreditCard,
  Building2,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Inbox,
} from 'lucide-react';
import type { SearchResults } from '@/domain/types';

function HighlightText({ text = '', query = '' }: { text?: string; query: string }) {
  if (!text) return null;
  if (!query.trim()) return <>{text}</>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-stamp-soft text-stamp-strong px-0.5 rounded-xs font-semibold"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Expanded categories toggle (per Spec 11.16 "each showing the top 5 with Show all")
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Recent searches
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ox-recent-searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveRecentSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(0, 5);
    setRecentSearches(next);
    try {
      localStorage.setItem('ox-recent-searches', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setSearchTerm(initialQuery);
      setIsLoading(true);
      repositories.search
        .query(initialQuery)
        .then((res) => {
          setResults(res);
          setIsLoading(false);
          saveRecentSearch(initialQuery);
        })
        .catch(() => setIsLoading(false));
    } else {
      setResults(null);
    }
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setSearchParams({ q: searchTerm.trim() });
    }
  };

  const handleRecentClick = (term: string) => {
    setSearchTerm(term);
    setSearchParams({ q: term });
  };

  const totalHits = results
    ? (results.clients?.length || 0) +
      (results.tasks?.length || 0) +
      (results.documents?.length || 0) +
      (results.visits?.length || 0) +
      (results.followUps?.length || 0) +
      (results.payments?.length || 0) +
      (results.offices?.length || 0)
    : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Search Bar & Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink font-sans">
            Search
          </h1>
          <p className="text-xs text-ink-3 mt-0.5">
            Global index across clients, filing obligations, visits, and receipts
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by client name, code, contact, obligation, period, or reference number..."
            className="w-full pl-10 pr-24 py-2.5 text-sm rounded-control bg-sheet border border-rule text-ink placeholder:text-ink-3 focus:border-stamp focus:outline-none shadow-xs font-sans"
            autoFocus
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchParams({});
              }}
              className="absolute right-20 text-ink-3 hover:text-ink p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs transition-colors"
          >
            Search
          </button>
        </form>

        {/* Recent Search Chips */}
        {recentSearches.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-ink-3 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Recent:</span>
            </span>
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleRecentClick(term)}
                className="px-2.5 py-0.5 rounded-chip text-xs bg-sheet-2 border border-rule text-ink hover:border-stamp hover:text-stamp transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-12 text-center space-y-2 bg-sheet border border-rule rounded-panel">
          <div className="w-6 h-6 border-2 border-stamp border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-ink-3">Searching across practice records...</p>
        </div>
      )}

      {/* Results View */}
      {!isLoading && results && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-ink-3 border-b border-rule pb-2">
            <span>
              Found <strong className="text-ink">{totalHits}</strong> result{totalHits === 1 ? '' : 's'}{' '}
              for "<strong className="text-ink">{initialQuery}</strong>"
            </span>
          </div>

          {totalHits === 0 ? (
            <div className="p-12 text-center bg-sheet border border-rule rounded-panel space-y-3">
              <Inbox className="w-10 h-10 text-ink-3 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-ink">No matching records found</h3>
                <p className="text-xs text-ink-3">
                  Check your spelling or try searching by client code or filing period (e.g., "Q3 2026").
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. Clients Group */}
              {results.clients?.length > 0 && (
                <div className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-stamp uppercase flex items-center gap-1.5 font-sans">
                      <Users className="w-4 h-4" />
                      <span>Clients ({results.clients.length})</span>
                    </h3>
                    {results.clients.length > 5 && (
                      <button
                        onClick={() => toggleSection('clients')}
                        className="text-xs text-stamp hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>{expandedSections['clients'] ? 'Show fewer' : `Show all ${results.clients.length}`}</span>
                        {expandedSections['clients'] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-rule">
                    {(expandedSections['clients'] ? results.clients : results.clients.slice(0, 5)).map((c) => (
                      <Link
                        key={c.client.id}
                        to={`/clients/${c.client.id}`}
                        className="py-2.5 flex items-center justify-between gap-3 hover:bg-sheet-2 px-2 rounded-control transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.2 rounded-chip bg-sheet-2 border border-rule text-[10px] font-bold text-ink">
                              <HighlightText text={c.client.code} query={initialQuery} />
                            </span>
                            <span className="text-xs font-bold text-ink truncate">
                              <HighlightText text={c.client.displayName} query={initialQuery} />
                            </span>
                          </div>
                          {c.client.registeredName && (
                            <div className="text-[11px] text-ink-3 truncate">
                              Registered: <HighlightText text={c.client.registeredName} query={initialQuery} />
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-3 shrink-0 font-mono">
                          {c.client.rdoCode ? `RDO ${c.client.rdoCode}` : c.client.entityType}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Tasks Group */}
              {results.tasks?.length > 0 && (
                <div className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-stamp uppercase flex items-center gap-1.5 font-sans">
                      <CheckSquare className="w-4 h-4" />
                      <span>Filing Tasks ({results.tasks.length})</span>
                    </h3>
                    {results.tasks.length > 5 && (
                      <button
                        onClick={() => toggleSection('tasks')}
                        className="text-xs text-stamp hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>{expandedSections['tasks'] ? 'Show fewer' : `Show all ${results.tasks.length}`}</span>
                        {expandedSections['tasks'] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-rule">
                    {(expandedSections['tasks'] ? results.tasks : results.tasks.slice(0, 5)).map((t) => (
                      <Link
                        key={t.task.id}
                        to={`/tasks/${t.task.id}`}
                        className="py-2.5 flex items-center justify-between gap-3 hover:bg-sheet-2 px-2 rounded-control transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded-chip bg-sheet-2 border border-rule text-[10px] font-bold text-ink">
                              {t.client.code}
                            </span>
                            <span className="text-xs font-bold text-ink truncate">
                              <HighlightText text={t.task.title} query={initialQuery} />
                            </span>
                            <span className="text-xs text-ink-3">
                              · <HighlightText text={t.task.period} query={initialQuery} />
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip status={t.displayedStatus} />
                          </div>
                        </div>

                        <div className="shrink-0">
                          <DueBadge state={t.dueState} dueDate={t.task.dueDate} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Documents Group */}
              {results.documents?.length > 0 && (
                <div className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-stamp uppercase flex items-center gap-1.5 font-sans">
                      <FileText className="w-4 h-4" />
                      <span>Documents ({results.documents.length})</span>
                    </h3>
                    {results.documents.length > 5 && (
                      <button
                        onClick={() => toggleSection('documents')}
                        className="text-xs text-stamp hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>{expandedSections['documents'] ? 'Show fewer' : `Show all ${results.documents.length}`}</span>
                        {expandedSections['documents'] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-rule">
                    {(expandedSections['documents'] ? results.documents : results.documents.slice(0, 5)).map((d) => (
                      <div
                        key={d.id}
                        className="py-2 flex items-center justify-between gap-3 px-2 rounded-control"
                      >
                        <div className="space-y-0.5 truncate">
                          <div className="text-xs font-bold text-ink truncate">
                            <HighlightText text={d.displayName} query={initialQuery} />
                          </div>
                          <div className="text-[11px] text-ink-3 font-mono truncate">
                            {d.mimeType} · {d.storageKey}
                          </div>
                        </div>
                        <span className="text-[10px] text-ink-3 uppercase font-semibold">
                          {d.kind}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Visits Group */}
              {results.visits?.length > 0 && (
                <div className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-stamp uppercase flex items-center gap-1.5 font-sans">
                      <MapPin className="w-4 h-4" />
                      <span>Counter Visits ({results.visits.length})</span>
                    </h3>
                  </div>

                  <div className="divide-y divide-rule">
                    {results.visits.slice(0, 5).map((v) => (
                      <Link
                        key={v.visit.id}
                        to={`/visits/${v.visit.id}`}
                        className="py-2.5 flex items-center justify-between gap-3 hover:bg-sheet-2 px-2 rounded-control transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-ink">
                            <HighlightText text={v.visit.officeName} query={initialQuery} />
                          </div>
                          <div className="text-[11px] text-ink-3">
                            {formatDate(v.visit.plannedDate)} · {v.visit.purpose}
                          </div>
                        </div>
                        <ReadinessMeter ready={v.readyItemCount} total={v.itemCount} label="Items ready" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Payments Group */}
              {results.payments?.length > 0 && (
                <div className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-stamp uppercase flex items-center gap-1.5 font-sans">
                      <CreditCard className="w-4 h-4" />
                      <span>Payments ({results.payments.length})</span>
                    </h3>
                  </div>

                  <div className="divide-y divide-rule">
                    {results.payments.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        className="py-2.5 flex items-center justify-between gap-3 px-2 rounded-control"
                      >
                        <div>
                          <div className="text-xs font-bold text-ink">
                            Ref: <HighlightText text={p.referenceNo} query={initialQuery} />
                          </div>
                          <div className="text-[11px] text-ink-3">
                            Paid on {formatDate(p.paidOn)} · {p.channel}
                          </div>
                        </div>
                        <div className="text-xs font-bold font-mono text-ink">
                          {formatPeso(p.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Offices Group */}
              {results.offices?.length > 0 && (
                <div className="bg-sheet border border-rule rounded-panel p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-stamp uppercase flex items-center gap-1.5 font-sans">
                      <Building2 className="w-4 h-4" />
                      <span>Tax Offices ({results.offices.length})</span>
                    </h3>
                  </div>

                  <div className="divide-y divide-rule">
                    {results.offices.slice(0, 5).map((o) => (
                      <div
                        key={o.id}
                        className="py-2 flex items-center justify-between gap-3 px-2 rounded-control"
                      >
                        <div>
                          <div className="text-xs font-bold text-ink">
                            <HighlightText text={o.name} query={initialQuery} />
                          </div>
                          <div className="text-[11px] text-ink-3">{o.address}</div>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-chip bg-sheet-2 border border-rule">
                          RDO {o.rdoCode}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
