import React from 'react';
import { useOffices } from '@/hooks/useData';
import { Building2, MapPin, Clock, Plus } from 'lucide-react';

export function OfficesPage() {
  const { data: offices = [], isLoading } = useOffices();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Offices Directory</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            BIR Revenue District Offices (RDO), authorized banks, and local government units
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          <div className="h-32 bg-sheet-3 rounded-panel" />
          <div className="h-32 bg-sheet-3 rounded-panel" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {offices.map((office) => (
            <div key={office.id} className="bg-sheet border border-rule rounded-panel p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold bg-stamp-soft text-stamp uppercase">
                  {office.type}
                </span>
                {office.rdoCode && (
                  <span className="text-xs font-bold text-ink">RDO {office.rdoCode}</span>
                )}
              </div>
              <h3 className="text-base font-bold text-ink">{office.name}</h3>
              {office.address && (
                <p className="text-xs text-ink-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                  <span>{office.address}</span>
                </p>
              )}
              {office.hours && (
                <p className="text-xs text-ink-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-ink-3" />
                  <span>{office.hours}</span>
                </p>
              )}
              {office.tips && (
                <div className="p-2.5 rounded-control bg-sheet-2 text-xs text-ink-2 border border-rule mt-2">
                  <span className="font-semibold text-stamp block">Operator Counter Tip:</span>
                  {office.tips}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
