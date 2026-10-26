import React, { useState } from 'react';
import { Table, Download, Eye, EyeOff } from 'lucide-react';
import { exportToCsv } from '@/lib/export';

export interface LegendItem {
  label: string;
  color: string;
  icon?: React.ReactNode;
  dashed?: boolean;
}

export interface ChartFrameProps {
  title: string;
  takeaway: string;
  legend?: LegendItem[];
  tableHeaders: string[];
  tableRows: Array<Array<string | number>>;
  csvFilename: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartFrame({
  title,
  takeaway,
  legend,
  tableHeaders,
  tableRows,
  csvFilename,
  children,
  className = '',
}: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);

  const handleDownloadCsv = () => {
    exportToCsv({
      filename: csvFilename,
      title,
      subtitle: takeaway,
      headers: tableHeaders,
      rows: tableRows,
    });
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-panel border border-[var(--rule)] bg-[var(--sheet)] shadow-xs flex flex-col justify-between space-y-4 min-w-0 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-[var(--ink)] tracking-tight font-sans">{title}</h3>
        <p className="text-xs text-[var(--ink-2)] leading-relaxed">{takeaway}</p>
      </div>

      {/* Legend if multiple series */}
      {legend && legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-medium text-[var(--ink-2)]">
          {legend.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              {item.dashed ? (
                <span
                  className="w-3.5 h-0 border-t-2 border-dashed shrink-0"
                  style={{ borderColor: item.color }}
                />
              ) : item.icon ? (
                item.icon
              ) : (
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart Plot or Table View */}
      <div className="py-2">
        {showTable ? (
          <div className="overflow-x-auto max-h-64 border border-[var(--rule)] rounded-control">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[var(--sheet-2)] text-[var(--ink-3)] uppercase font-semibold text-[10px] tracking-wider border-b border-[var(--rule)]">
                <tr>
                  {tableHeaders.map((h, i) => (
                    <th key={i} className="px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)] text-[var(--ink)]">
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[var(--sheet-2)] transition-colors">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-3 py-1.5 font-mono ${
                          cIdx === 0 ? 'font-sans font-medium' : 'text-right'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full">{children}</div>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--rule)] text-[11px] text-[var(--ink-3)]">
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="flex items-center gap-1.5 hover:text-[var(--ink)] transition-colors font-medium cursor-pointer"
          aria-label={showTable ? 'Switch back to visual chart' : 'View chart data as accessible table'}
        >
          {showTable ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide table</span>
            </>
          ) : (
            <>
              <Table className="w-3.5 h-3.5" />
              <span>Show table</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDownloadCsv}
          className="flex items-center gap-1.5 hover:text-[var(--stamp)] transition-colors font-medium cursor-pointer"
          aria-label="Download chart data as CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download CSV</span>
        </button>
      </div>
    </div>
  );
}
