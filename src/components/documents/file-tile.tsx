import React, { useState } from 'react';
import {
  FileText,
  FileCheck2,
  FileSpreadsheet,
  Download,
  Eye,
  MoreVertical,
  Trash2,
  RefreshCw,
  Tag,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import { formatBytes } from '@/lib/compression';
import type { DocumentFile, DocumentKind } from '@/domain/types';
import { StoredImage } from '@/components/documents/stored-file';

export interface FileTileProps {
  document: DocumentFile;
  onPreview?: (doc: DocumentFile) => void;
  onDownload?: (doc: DocumentFile) => void;
  onRemove?: (doc: DocumentFile) => void;
  onReplace?: (doc: DocumentFile) => void;
  onChangeKind?: (doc: DocumentFile) => void;
  className?: string;
}

const KIND_META: Record<
  DocumentKind,
  { label: string; tone: 'good' | 'warn' | 'neutral' | 'stamp' }
> = {
  filed_return: { label: 'Filed Return', tone: 'good' },
  acknowledgment: { label: 'Acknowledgment', tone: 'good' },
  payment_proof: { label: 'Payment Proof', tone: 'good' },
  stamped_copy: { label: 'Stamped Copy', tone: 'stamp' },
  ecar: { label: 'eCAR', tone: 'stamp' },
  authorization: { label: 'Authorization', tone: 'stamp' },
  source: { label: 'Source Document', tone: 'neutral' },
  other: { label: 'Other Attachment', tone: 'neutral' },
};

export function FileTile({
  document: doc,
  onPreview,
  onDownload,
  onRemove,
  onReplace,
  onChangeKind,
  className = '',
}: FileTileProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = KIND_META[doc.kind] || { label: doc.kind, tone: 'neutral' };
  const isImage = doc.mimeType.startsWith('image/');
  const isPdf = doc.mimeType === 'application/pdf';

  return (
    <div
      className={`group relative flex items-start gap-3 p-3 rounded-control bg-sheet border border-rule hover:border-rule-2 hover:bg-sheet-2/60 transition-all shadow-2xs ${className}`}
    >
      {/* 72px Thumbnail / Icon Box */}
      <div
        onClick={() => onPreview?.(doc)}
        className="w-16 h-16 sm:w-18 sm:h-18 rounded bg-sheet-3 border border-rule flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:opacity-90 relative"
      >
        {isImage && doc.storageKey ? (
          <StoredImage
            storageKey={doc.storageKey}
            alt={doc.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-ink-3">
            <FileText className="w-6 h-6 text-stamp" />
            <span className="text-[9px] font-mono font-bold uppercase mt-1">
              {isPdf ? 'PDF' : 'DOC'}
            </span>
          </div>
        )}

        {/* Hover preview eye */}
        <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Eye className="w-5 h-5 text-sheet" />
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
              meta.tone === 'good'
                ? 'bg-good-bg text-good-fg border-good-bd'
                : meta.tone === 'stamp'
                ? 'bg-stamp-soft text-stamp border-stamp/20'
                : 'bg-sheet-2 text-ink-2 border-rule'
            }`}
          >
            {meta.label}
          </span>

          <span className="text-[10px] font-mono text-ink-3 bg-sheet-2 px-1 rounded border border-rule">
            v{doc.versionNo}
          </span>

          {doc.compressed && (
            <span
              className="text-[10px] text-good-fg bg-good-bg px-1 rounded border border-good-bd"
              title="Optimized via client compression pipeline"
            >
              Optimized
            </span>
          )}
        </div>

        {/* Standardized display name */}
        <div
          onClick={() => onPreview?.(doc)}
          className="text-xs font-bold text-ink hover:text-stamp truncate cursor-pointer transition-colors"
          title={doc.displayName}
        >
          {doc.displayName}
        </div>

        {/* Original filename & metadata */}
        <div className="flex items-center gap-2 text-[11px] text-ink-3 truncate">
          <span>{formatBytes(doc.sizeBytes)}</span>
          <span>•</span>
          <span>{formatDate(doc.createdAt.slice(0, 10))}</span>
        </div>
      </div>

      {/* Overflow Menu */}
      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded text-ink-3 hover:text-ink hover:bg-sheet-3 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 mt-1 w-44 bg-sheet border border-rule rounded-panel shadow-md py-1 z-30 text-xs text-ink font-medium">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onPreview?.(doc);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sheet-2 flex items-center gap-2"
              >
                <Eye className="w-3.5 h-3.5 text-ink-3" />
                <span>Preview Document</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDownload?.(doc);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sheet-2 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-ink-3" />
                <span>Download File</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onReplace?.(doc);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sheet-2 flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5 text-ink-3" />
                <span>Upload New Version</span>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onChangeKind?.(doc);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sheet-2 flex items-center gap-2"
              >
                <Tag className="w-3.5 h-3.5 text-ink-3" />
                <span>Change File Kind</span>
              </button>

              <div className="border-t border-rule my-1" />

              <button
                onClick={() => {
                  setMenuOpen(false);
                  onRemove?.(doc);
                }}
                className="w-full text-left px-3 py-1.5 text-critical-fg hover:bg-critical-bg flex items-center gap-2 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove File</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
