import React, { useState } from 'react';
import { useClients } from '@/hooks/useData';
import { Link } from 'react-router-dom';
import { Users, Search, Plus, Shield, ArrowRight } from 'lucide-react';
import { repositories } from '@/data';

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useClients({ search: search || undefined });
  const [revealedTins, setRevealedTins] = useState<Record<string, string>>({});

  const clients = data?.items || [];

  const handleRevealTin = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const full = await repositories.clients.revealTin(id);
      setRevealedTins((prev) => ({ ...prev, [id]: full }));
    } catch (err) {
      alert('Failed to reveal TIN');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Clients</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Retainer and corporate profiles, authorizations, contacts, and tax filing states
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/clients/import"
            className="px-3 py-1.5 text-xs font-semibold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3"
          >
            Import CSV
          </Link>
          <Link
            to="/clients/new"
            className="px-3 py-1.5 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Client</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 border-b border-rule pb-3">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            placeholder="Search by code, firm name, or TIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-control bg-sheet border border-rule text-ink placeholder:text-ink-3 focus:border-stamp focus:outline-none"
          />
        </div>
      </div>

      {/* Clients Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          <div className="h-40 bg-sheet-3 rounded-panel" />
          <div className="h-40 bg-sheet-3 rounded-panel" />
        </div>
      ) : clients.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3">
          <Users className="w-8 h-8 text-ink-3 mx-auto mb-2" />
          <p className="text-sm font-semibold text-ink">No clients found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map(({ client, activeTaskCount, blockedTaskCount, authAttention }) => (
            <Link
              key={client.id}
              to={`/clients/${client.id}`}
              className="bg-sheet border border-rule rounded-panel p-5 space-y-4 hover:border-stamp-strong hover:shadow-xs transition-all relative overflow-hidden group"
            >
              {/* Folder tab signature detail */}
              <div className="flex items-center justify-between border-b border-rule pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-chip text-xs font-black bg-stamp-soft text-stamp tracking-wider font-sans">
                    {client.code}
                  </span>
                  <span className="text-xs text-ink-3 capitalize">
                    {client.entityType === 'gpp' ? 'General Professional Partnership' : client.entityType}
                  </span>
                </div>

                {authAttention && (
                  <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-critical-bg text-critical-fg border border-critical-bd flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>SPA Attention</span>
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink group-hover:text-stamp transition-colors">
                  {client.displayName}
                </h3>
                {client.registeredName && (
                  <p className="text-xs text-ink-3 truncate">{client.registeredName}</p>
                )}
              </div>

              {/* TIN & RDO strip */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-[11px] text-ink-3 block">TIN (RA 10173 Protected)</span>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink">
                    <span>{revealedTins[client.id] || client.tinMasked || '•••-•••-000-00000'}</span>
                    {!revealedTins[client.id] && (
                      <button
                        onClick={(e) => handleRevealTin(client.id, e)}
                        className="text-[10px] text-stamp hover:underline"
                      >
                        Reveal
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-ink-3 block">Tax Office / Filing</span>
                  <span className="font-semibold text-ink">
                    RDO {client.rdoCode} · {client.filingChannel?.toUpperCase() || 'Manual'}
                  </span>
                </div>
              </div>

              {/* Stats Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-rule text-xs text-ink-2">
                <div>
                  <span>{activeTaskCount} active tasks</span>
                  {blockedTaskCount > 0 && (
                    <span className="text-serious-fg font-semibold ml-1.5">
                      ({blockedTaskCount} blocked)
                    </span>
                  )}
                </div>

                <span className="text-stamp font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <span>Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
