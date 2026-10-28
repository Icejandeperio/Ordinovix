import React, { useState, useMemo } from 'react';
import { useOffices, useSession } from '@/hooks/useData';
import type { Office, OfficeType } from '@/domain/types';
import { OFFICE_TYPE_LABELS } from '@/domain/labels';
import { OfficeFormModal } from '@/components/offices/office-form-modal';
import {
  Building2,
  Landmark,
  Building,
  MapPin,
  Clock,
  Phone,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { QueryState } from '@/components/ui/query-state';

function getOfficeIcon(type: OfficeType) {
  switch (type) {
    case 'rdo':
      return <Building2 className="w-4 h-4 text-stamp" />;
    case 'bank':
      return <Landmark className="w-4 h-4 text-stamp" />;
    case 'lgu':
      return <Building className="w-4 h-4 text-stamp" />;
    case 'sec':
      return <Building2 className="w-4 h-4 text-stamp" />;
    default:
      return <MapPin className="w-4 h-4 text-stamp" />;
  }
}

export function OfficesPage() {
  const { data: offices = [], isLoading, isError, error, refetch } = useOffices();
  // Adding and editing offices is the owner's; a helper reads them
  const { data: session } = useSession();
  const isOwner = session?.membership.role === 'owner';

  const [activeTypeTab, setActiveTypeTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfficeForEdit, setSelectedOfficeForEdit] = useState<Office | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredOffices = useMemo(() => {
    return offices.filter((office) => {
      if (activeTypeTab !== 'all' && office.type !== activeTypeTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = office.name.toLowerCase().includes(q);
        const matchRdo = office.rdoCode?.toLowerCase().includes(q);
        const matchAddress = office.address?.toLowerCase().includes(q);
        const matchTips = office.tips?.toLowerCase().includes(q);
        if (!matchName && !matchRdo && !matchAddress && !matchTips) return false;
      }
      return true;
    });
  }, [offices, activeTypeTab, searchQuery]);

  const handleOpenAdd = () => {
    setSelectedOfficeForEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (office: Office) => {
    setSelectedOfficeForEdit(office);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">
            Offices Directory
          </h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            BIR Revenue District Offices, Authorized Agent Banks, LGUs, and SEC locations
          </p>
        </div>

        {isOwner && (
        <button
          onClick={handleOpenAdd}
          className="px-3.5 py-2 text-xs font-semibold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Office</span>
        </button>
        )}
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-rule pb-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTypeTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors ${
              activeTypeTab === 'all'
                ? 'bg-sheet-3 text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            All Offices ({offices.length})
          </button>
          <button
            onClick={() => setActiveTypeTab('rdo')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors ${
              activeTypeTab === 'rdo'
                ? 'bg-sheet-3 text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            BIR RDOs
          </button>
          <button
            onClick={() => setActiveTypeTab('bank')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors ${
              activeTypeTab === 'bank'
                ? 'bg-sheet-3 text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            Agent Banks (AAB)
          </button>
          <button
            onClick={() => setActiveTypeTab('lgu')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors ${
              activeTypeTab === 'lgu'
                ? 'bg-sheet-3 text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            City Halls (LGU)
          </button>
          <button
            onClick={() => setActiveTypeTab('sec')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-control transition-colors ${
              activeTypeTab === 'sec'
                ? 'bg-sheet-3 text-ink font-bold shadow-2xs'
                : 'text-ink-3 hover:text-ink hover:bg-sheet-2'
            }`}
          >
            SEC
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, RDO, tips..."
            className="w-full bg-sheet border border-rule rounded-control pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-stamp"
          />
        </div>
      </div>

      {/* Offices Grid */}
      {isError ? (
        <QueryState isLoading={false} isError error={error} onRetry={() => refetch()} subject="offices">
          {null}
        </QueryState>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          <div className="h-40 bg-sheet-3 rounded-panel" />
          <div className="h-40 bg-sheet-3 rounded-panel" />
        </div>
      ) : filteredOffices.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3 space-y-3">
          <Building2 className="w-8 h-8 text-ink-3 mx-auto opacity-70" />
          <p className="text-sm font-bold text-ink">No offices found</p>
          <p className="text-xs text-ink-2">
            Add your frequently visited BIR district offices, tax payment banks, and local municipal halls
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOffices.map((office) => (
            <div
              key={office.id}
              className="bg-sheet border border-rule rounded-panel p-5 space-y-3 shadow-xs hover:border-stamp/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="p-1 rounded bg-sheet-2 border border-rule">
                    {getOfficeIcon(office.type)}
                  </span>
                  <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-stamp-soft text-stamp uppercase">
                    {OFFICE_TYPE_LABELS[office.type] || office.type}
                  </span>
                  {office.rdoCode && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sheet-2 text-ink-2 border border-rule">
                      RDO {office.rdoCode}
                    </span>
                  )}
                  {office.isSample && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sheet-3 text-ink-3 border border-rule">
                      Sample · replace with real details
                    </span>
                  )}
                </div>

                {isOwner && (
                <button
                  onClick={() => handleOpenEdit(office)}
                  className="p-1 rounded text-ink-3 hover:text-stamp hover:bg-sheet-2 transition-colors cursor-pointer"
                  title="Edit Office Details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                )}
              </div>

              <div>
                <h3 className="text-base font-bold text-ink">{office.name}</h3>
                {office.address && (
                  <p className="text-xs text-ink-2 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                    <span>{office.address}</span>
                    {office.mapUrl && (
                      <a
                        href={office.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-stamp hover:underline inline-flex items-center gap-0.5 font-semibold ml-1 shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-ink-3 pt-1">
                {office.hours && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-ink-3" />
                    <span>{office.hours}</span>
                  </span>
                )}
                {office.phoneE164 && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-ink-3" />
                    <span>{office.phoneE164}</span>
                  </span>
                )}
              </div>

              {/* Prominent Counter Tips */}
              {office.tips && (
                <div className="p-3 rounded-control bg-warn-bg/50 border border-warn-bd text-xs text-warn-fg space-y-0.5">
                  <span className="font-bold text-ink block">Operator Counter Tip:</span>
                  <p>{office.tips}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Office Modal */}
      <OfficeFormModal
        office={selectedOfficeForEdit}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOfficeForEdit(null);
        }}
      />
    </div>
  );
}
