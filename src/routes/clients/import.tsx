import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Download,
  Check,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImportPreview, useImportCommit, useImportUndo } from '@/hooks/useData';
import type { ImportPreview } from '@/domain/types';

type WizardStep = 1 | 2 | 3 | 4;

interface ColumnMapping {
  displayName: string;
  code: string;
  registeredName: string;
  entityType: string;
  tin: string;
  rdoCode: string;
  vatStatus: string;
  filingChannel: string;
}

const CLIENT_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'displayName', label: 'Client / Firm Name', required: true },
  { key: 'code', label: 'Client Code', required: true },
  { key: 'registeredName', label: 'Registered Legal Name', required: false },
  { key: 'entityType', label: 'Entity Type (GPP, Solo, Other)', required: false },
  { key: 'tin', label: 'Taxpayer Identification Number (TIN)', required: false },
  { key: 'rdoCode', label: 'Revenue District Office (RDO Code)', required: false },
  { key: 'vatStatus', label: 'VAT Status', required: false },
  { key: 'filingChannel', label: 'Filing Mode (eFPS / eBIRForms)', required: false },
];

export function ClientImportPage() {
  const navigate = useNavigate();
  const importPreviewMutation = useImportPreview();
  const importCommitMutation = useImportCommit();
  const importUndoMutation = useImportUndo();

  const [step, setStep] = useState<WizardStep>(1);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string>('');

  // Column Mappings
  const [mapping, setMapping] = useState<ColumnMapping>({
    displayName: '',
    code: '',
    registeredName: '',
    entityType: '',
    tin: '',
    rdoCode: '',
    vatStatus: '',
    filingChannel: '',
  });

  // Preview data
  const [previewData, setPreviewData] = useState<ImportPreview | null>(null);

  // Commit result & Undo timer
  const [commitResult, setCommitResult] = useState<{
    created: string[];
    skipped: number;
    batchId: string;
  } | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(300); // 5 minutes per spec 11.7.4
  const [isUndone, setIsUndone] = useState<boolean>(false);

  // Undo countdown timer
  useEffect(() => {
    if (step === 4 && undoSecondsLeft > 0 && !isUndone) {
      const timer = setInterval(() => {
        setUndoSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, undoSecondsLeft, isUndone]);

  // Robust CSV parser handling quotes and commas
  const parseCsv = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

    const parseLine = (line: string): string[] => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }

    return { headers, rows };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { headers, rows } = parseCsv(text);
        setCsvHeaders(headers);
        setParsedRows(rows);

        // Auto-match headers to target fields
        const autoMap: Partial<ColumnMapping> = {};
        for (const f of CLIENT_FIELDS) {
          const match = headers.find(
            (h) =>
              h.toLowerCase().includes(f.key.toLowerCase()) ||
              h.toLowerCase().includes(f.label.toLowerCase().slice(0, 4))
          );
          if (match) {
            autoMap[f.key] = match;
          } else {
            autoMap[f.key] = '';
          }
        }
        setMapping(autoMap as ColumnMapping);
        setStep(2);
      } catch (err: any) {
        alert(err.message || 'Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      'Name,Code,RegisteredName,EntityType,TIN,RDO,VatStatus,FilingChannel\n' +
      '"Acuña Design Studio","ADS","Acuña Studio & Co.","solo","123-456-789-00000","039","vat","efps"\n' +
      '"Valdez Maritime Law","VML","Valdez & Partners Law Offices","gpp","987-654-321-00000","044","vat","ebirforms"\n' +
      '"Bautista Dental Care","BDC","Bautista Medical Clinic","solo","456-789-012-00000","040","non_vat_8_percent","manual"';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ordinovix-clients-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleProceedToPreview = () => {
    if (!mapping.displayName) {
      alert('Please match the Client Name column before proceeding');
      return;
    }

    importPreviewMutation.mutate(
      {
        rows: parsedRows,
        mapping: mapping as any,
      },
      {
        onSuccess: (preview) => {
          setPreviewData(preview);
          setStep(3);
        },
      }
    );
  };

  const handleCommitImport = () => {
    if (!previewData) return;
    importCommitMutation.mutate(previewData, {
      onSuccess: (result) => {
        setCommitResult(result);
        setUndoSecondsLeft(300);
        setIsUndone(false);
        setStep(4);
      },
    });
  };

  const handleUndo = () => {
    if (!commitResult?.batchId) return;
    importUndoMutation.mutate(commitResult.batchId, {
      onSuccess: () => {
        setIsUndone(true);
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule pb-3">
        <div>
          <Link
            to="/clients"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Clients Directory</span>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink font-sans">
            Import Clients from CSV
          </h1>
          <p className="text-xs text-ink-2">
            Batch register taxpayer profiles with column mapping and duplicate validation
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={downloadSampleTemplate}
          className="flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download CSV Template</span>
        </Button>
      </div>

      {/* Wizard Step Indicator */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        {[
          { num: 1, label: 'Upload CSV' },
          { num: 2, label: 'Match Columns' },
          { num: 3, label: 'Validate Preview' },
          { num: 4, label: 'Import Summary' },
        ].map((s) => (
          <div
            key={s.num}
            className={`p-3 rounded-control border flex items-center gap-2 ${
              step === s.num
                ? 'bg-sheet border-stamp text-stamp font-bold shadow-2xs'
                : step > s.num
                ? 'bg-sheet-2 border-rule text-ink-2'
                : 'bg-sheet-2/40 border-rule/50 text-ink-3'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === s.num
                  ? 'bg-stamp text-on-stamp'
                  : step > s.num
                  ? 'bg-good-fg text-white'
                  : 'bg-sheet-3 text-ink-3'
              }`}
            >
              {step > s.num ? <Check className="w-3 h-3" /> : s.num}
            </span>
            <span className="truncate">{s.label}</span>
          </div>
        ))}
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="bg-sheet border border-rule rounded-panel p-8 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-stamp-soft text-stamp mx-auto flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-bold text-ink">Choose a CSV file to import</h3>
            <p className="text-xs text-ink-3">
              Upload your client spreadsheet. Ordinovix will auto-match column headers.
            </p>
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-control bg-stamp text-on-stamp hover:bg-stamp-strong cursor-pointer shadow-xs transition-colors">
              <Upload className="w-4 h-4" />
              <span>Select CSV File</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
          </div>

          <div className="pt-4 border-t border-rule max-w-sm mx-auto text-left text-xs text-ink-3 space-y-1">
            <p className="font-bold text-ink-2">Recommended template headers:</p>
            <p className="font-mono text-[11px]">Name, Code, RegisteredName, EntityType, TIN, RDO, VatStatus, FilingChannel</p>
          </div>
        </div>
      )}

      {/* STEP 2: MATCH COLUMNS */}
      {step === 2 && (
        <div className="bg-sheet border border-rule rounded-panel p-6 space-y-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <div>
              <h3 className="text-sm font-bold text-ink">Match CSV Columns to Client Fields</h3>
              <p className="text-xs text-ink-3">
                File: <strong>{fileName}</strong> ({parsedRows.length} rows detected)
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              Upload Different File
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CLIENT_FIELDS.map((field) => (
              <div key={field.key} className="p-3 bg-sheet-2 border border-rule rounded-control space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink">
                    {field.label} {field.required && <span className="text-critical">*</span>}
                  </label>
                </div>
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) =>
                    setMapping({ ...mapping, [field.key]: e.target.value })
                  }
                  className="w-full p-2 text-xs bg-sheet border border-rule rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-stamp"
                >
                  <option value="">-- Do not import --</option>
                  {csvHeaders.map((header) => (
                    <option key={header} value={header}>
                      CSV: {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-rule">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleProceedToPreview}
              loading={importPreviewMutation.isPending}
              className="flex items-center gap-1.5"
            >
              <span>Validate &amp; Preview Rows</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & VALIDATION */}
      {step === 3 && previewData && (
        <div className="bg-sheet border border-rule rounded-panel p-6 space-y-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-3">
            <div>
              <h3 className="text-sm font-bold text-ink">Preview &amp; Validation Check</h3>
              <p className="text-xs text-ink-3">
                Review rows before committing. Errored rows will be excluded from import.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-good-bg text-good-fg border border-good-bd flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{previewData.validRows.length} Ready</span>
              </span>

              {previewData.errors.length > 0 && (
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-critical-bg text-critical border border-critical-bd flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{previewData.errors.length} Errors / Duplicates</span>
                </span>
              )}
            </div>
          </div>

          {/* Errors list if any */}
          {previewData.errors.length > 0 && (
            <div className="p-3 bg-critical-bg/40 border border-critical-bd rounded-control text-xs text-critical space-y-1">
              <p className="font-bold">Errors found in CSV:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {previewData.errors.map((err, idx) => (
                  <li key={idx}>
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Valid rows preview table */}
          <div className="border border-rule rounded-control overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-sheet-2 border-b border-rule text-ink-2 font-semibold">
                <tr>
                  <th className="p-2.5">Code</th>
                  <th className="p-2.5">Client Name</th>
                  <th className="p-2.5">Entity</th>
                  <th className="p-2.5">RDO</th>
                  <th className="p-2.5">TIN</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule font-sans">
                {previewData.validRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-sheet-2">
                    <td className="p-2.5 font-mono font-bold text-stamp">{row.code}</td>
                    <td className="p-2.5 font-bold text-ink">{row.displayName}</td>
                    <td className="p-2.5 capitalize">{row.entityType}</td>
                    <td className="p-2.5 font-mono">{row.rdoCode}</td>
                    <td className="p-2.5 font-mono text-ink-3">{row.tinFull || '—'}</td>
                    <td className="p-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-good-bg text-good-fg border border-good-bd">
                        Ready
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-rule">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
              Back to Column Match
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={previewData.validRows.length === 0}
              onClick={handleCommitImport}
              loading={importCommitMutation.isPending}
              className="flex items-center gap-1.5"
            >
              <span>Import {previewData.validRows.length} Clients</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: IMPORT SUMMARY & 5-MINUTE UNDO */}
      {step === 4 && commitResult && (
        <div className="bg-sheet border border-rule rounded-panel p-8 space-y-6 shadow-2xs text-center">
          {isUndone ? (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-critical-bg text-critical mx-auto flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-ink">Import Rollback Complete</h3>
                <p className="text-xs text-ink-3">
                  All {commitResult.created.length} clients created during this batch have been removed from your directory.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => navigate('/clients')}>
                Return to Clients Directory
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-full bg-good-bg text-good-fg mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-ink font-sans">
                  {commitResult.created.length} Clients Added Successfully
                </h3>
                <p className="text-xs text-ink-3">
                  {commitResult.skipped > 0
                    ? `${commitResult.skipped} rows skipped due to duplicate code/name or missing required fields.`
                    : 'All rows imported cleanly without warnings.'}
                </p>
              </div>

              {/* 5-minute Undo Rollback notice per Spec 11.7.4 */}
              <div className="p-4 bg-sheet-2 border border-rule rounded-control max-w-md mx-auto space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-2 font-medium">Batch Rollback Window</span>
                  <span className="font-mono font-bold text-stamp tabular-nums">
                    {Math.floor(undoSecondsLeft / 60)}:{(undoSecondsLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="w-full bg-sheet-3 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-stamp h-full transition-all duration-1000"
                    style={{ width: `${(undoSecondsLeft / 300) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-ink-3 text-left">
                  Need to cancel this import? You can undo this entire batch within 5 minutes.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  loading={importUndoMutation.isPending}
                  className="w-full text-critical hover:text-critical flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo Batch Import ({commitResult.created.length} clients)</span>
                </Button>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <Button variant="secondary" size="sm" onClick={() => setStep(1)}>
                  Import Another File
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/clients')}>
                  View Clients Directory
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
