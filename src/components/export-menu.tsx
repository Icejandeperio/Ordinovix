import React, { useState, useRef, useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Download, ChevronDown, FileSpreadsheet, FileText, Printer, Check } from 'lucide-react';
import { exportData, type ExportData } from '@/lib/export';

interface ExportMenuProps {
  label?: string;
  getData: () => Promise<ExportData> | ExportData;
  className?: string;
  variant?: 'primary' | 'secondary' | 'compact';
}

export function ExportMenu({
  label = 'Export',
  getData,
  className = '',
  variant = 'secondary',
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<string | null>(null);
  const [lastExported, setLastExported] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      setLoadingFormat(format);
      const data = await getData();
      exportData(format, data);
      setLastExported(format);
      setTimeout(() => setLastExported(null), 2000);
      setOpen(false);
    } catch (err) {
      console.error('Failed to export data:', err);
      alert('Unable to generate export. Please try again.');
    } finally {
      setLoadingFormat(null);
    }
  };

  const getButtonStyles = () => {
    if (variant === 'primary') {
      return 'bg-[var(--stamp)] text-[var(--on-stamp)] hover:bg-[var(--stamp-strong)]';
    }
    if (variant === 'compact') {
      return 'bg-[var(--sheet)] border border-[var(--rule)] text-[var(--ink)] hover:bg-[var(--sheet-2)] px-2.5 py-1 text-xs';
    }
    return 'bg-[var(--sheet)] border border-[var(--rule)] text-[var(--ink)] hover:bg-[var(--sheet-2)] px-3 py-1.5 text-xs font-semibold';
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-md transition-colors cursor-pointer shadow-xs ${getButtonStyles()}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--ink-3)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-1.5 w-56 rounded-lg bg-[var(--sheet)] border border-[var(--rule)] shadow-lg py-1.5 z-50"
          >
          <div className="px-3 py-1 border-b border-[var(--rule)] mb-1">
            <span className="text-[10px] font-bold text-[var(--ink-3)] uppercase tracking-wider">Choose Export Format</span>
          </div>

          <button
            type="button"
            onClick={() => handleExport('excel')}
            disabled={loadingFormat !== null}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--sheet-2)] transition-colors text-left disabled:opacity-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-[var(--good-bg)] text-[var(--good-fg)] border border-[var(--good-bd)] flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-semibold">Microsoft Excel</div>
                <div className="text-[10px] text-[var(--ink-3)]">Formatted spreadsheet (.xls)</div>
              </div>
            </div>
            {lastExported === 'excel' && <Check className="w-3.5 h-3.5 text-[var(--good-solid)]" />}
          </button>

          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={loadingFormat !== null}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--sheet-2)] transition-colors text-left disabled:opacity-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-[var(--critical-bg)] text-[var(--critical-fg)] border border-[var(--critical-bd)] flex items-center justify-center shrink-0">
                <Printer className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-semibold">PDF Document</div>
                <div className="text-[10px] text-[var(--ink-3)]">Printable / Save as PDF (.pdf)</div>
              </div>
            </div>
            {lastExported === 'pdf' && <Check className="w-3.5 h-3.5 text-[var(--good-solid)]" />}
          </button>

          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={loadingFormat !== null}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-[var(--ink)] hover:bg-[var(--sheet-2)] transition-colors text-left disabled:opacity-50 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-[var(--info-bg)] text-[var(--info-fg)] border border-[var(--info-bd)] flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-semibold">CSV Spreadsheet</div>
                <div className="text-[10px] text-[var(--ink-3)]">Raw data with UTF-8 BOM (.csv)</div>
              </div>
            </div>
            {lastExported === 'csv' && <Check className="w-3.5 h-3.5 text-[var(--good-solid)]" />}
          </button>
        </m.div>
      )}
    </AnimatePresence>
    </div>
  );
}
