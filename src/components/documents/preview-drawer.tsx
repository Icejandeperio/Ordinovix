import React, { useState, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Stamp,
  AlertTriangle,
  FileText,
  Calendar,
  User,
  ShieldCheck,
  Hash,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { formatBytes } from '@/lib/compression';
import { useSetLineStatus } from '@/hooks/useData';
import type { DocumentFile, LineStatus } from '@/domain/types';

export interface PreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  document: DocumentFile | null;
  documentsList?: DocumentFile[];
  onSelectDocument?: (doc: DocumentFile) => void;
  lineStatus?: LineStatus;
  onAcceptLine?: (lineId: string) => void;
  onFlagLine?: (lineId: string, note: string) => void;
}

export function PreviewDrawer({
  open,
  onClose,
  document: currentDoc,
  documentsList = [],
  onSelectDocument,
  lineStatus,
  onAcceptLine,
  onFlagLine,
}: PreviewDrawerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flagNoteOpen, setFlagNoteOpen] = useState(false);
  const [flagNote, setFlagNote] = useState('');

  // Keyboard navigation: Left/Right arrows for prev/next, Esc for close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && documentsList.length > 1 && currentDoc) {
        const idx = documentsList.findIndex((d) => d.id === currentDoc.id);
        if (idx > 0) onSelectDocument?.(documentsList[idx - 1]);
      } else if (e.key === 'ArrowRight' && documentsList.length > 1 && currentDoc) {
        const idx = documentsList.findIndex((d) => d.id === currentDoc.id);
        if (idx < documentsList.length - 1) onSelectDocument?.(documentsList[idx + 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentDoc, documentsList, onClose, onSelectDocument]);

  // Reset zoom & rotation when document changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [currentDoc?.id]);

  if (!open || !currentDoc) return null;

  const isImage = currentDoc.mimeType.startsWith('image/');
  const isPdf = currentDoc.mimeType === 'application/pdf';

  const currentIndex = documentsList.findIndex((d) => d.id === currentDoc.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < documentsList.length - 1;

  const canReview = lineStatus === 'received' || lineStatus === 'under_review';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/50 backdrop-blur-xs transition-opacity animate-fade-in">
      {/* 720px Desktop Side Sheet / Full screen mobile */}
      <div className="w-full sm:w-[720px] h-full bg-sheet border-l border-rule shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        {/* 1. Header Toolbar */}
        <div className="p-3.5 border-b border-rule flex items-center justify-between gap-3 bg-sheet-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-ink truncate max-w-[280px]">
              {currentDoc.displayName}
            </span>
            <span className="text-[10px] font-mono font-bold uppercase bg-sheet-3 px-1.5 py-0.5 rounded border border-rule text-ink-3">
              v{currentDoc.versionNo}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Prev / Next controls */}
            {documentsList.length > 1 && (
              <div className="flex items-center bg-sheet border border-rule rounded-control p-0.5 mr-1">
                <button
                  disabled={!hasPrev}
                  onClick={() => hasPrev && onSelectDocument?.(documentsList[currentIndex - 1])}
                  className="p-1 text-ink-3 hover:text-ink disabled:opacity-30 rounded"
                  title="Previous file (Left arrow)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono text-ink-3 px-1.5">
                  {currentIndex + 1}/{documentsList.length}
                </span>
                <button
                  disabled={!hasNext}
                  onClick={() => hasNext && onSelectDocument?.(documentsList[currentIndex + 1])}
                  className="p-1 text-ink-3 hover:text-ink disabled:opacity-30 rounded"
                  title="Next file (Right arrow)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Viewer Zoom & Rotation */}
            {isImage && (
              <div className="flex items-center bg-sheet border border-rule rounded-control p-0.5">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 text-ink-3 hover:text-ink rounded"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono text-ink-3 px-1">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="p-1 text-ink-3 hover:text-ink rounded"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 text-ink-3 hover:text-ink rounded border-l border-rule ml-0.5"
                  title="Rotate 90 degrees"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Download */}
            <a
              href={currentDoc.storageKey}
              download={currentDoc.displayName}
              className="p-1.5 text-ink-3 hover:text-ink rounded-control bg-sheet border border-rule hover:bg-sheet-3 transition-colors"
              title="Download original file"
            >
              <Download className="w-3.5 h-3.5" />
            </a>

            {/* Print */}
            <button
              onClick={() => window.print()}
              className="p-1.5 text-ink-3 hover:text-ink rounded-control bg-sheet border border-rule hover:bg-sheet-3 transition-colors"
              title="Print document"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-ink-3 hover:text-ink rounded-control bg-sheet border border-rule hover:bg-sheet-3 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Main Canvas Body: Pure White Canvas even in dark mode */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Document Canvas Area: Strictly white background */}
          <div className="flex-1 bg-white flex items-center justify-center p-4 overflow-auto relative select-none">
            {isImage ? (
              <div
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-w-full max-h-full flex items-center justify-center"
              >
                <img
                  src={currentDoc.storageKey}
                  alt={currentDoc.displayName}
                  className="max-w-full max-h-[75vh] object-contain shadow-sm rounded-xs pointer-events-none"
                />
              </div>
            ) : isPdf ? (
              <iframe
                src={`${currentDoc.storageKey}#toolbar=0`}
                title={currentDoc.displayName}
                className="w-full h-full border-0 rounded"
              />
            ) : (
              <div className="p-8 text-center text-zinc-600 space-y-2">
                <FileText className="w-12 h-12 text-zinc-400 mx-auto" />
                <p className="text-sm font-bold text-zinc-800">{currentDoc.displayName}</p>
                <p className="text-xs">Preview unavailable for this format.</p>
              </div>
            )}
          </div>

          {/* 3. Document Details Side Panel */}
          <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-rule bg-sheet p-4 space-y-4 overflow-y-auto shrink-0 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-ink-3 tracking-wider block mb-1">
                Document Details
              </span>
              <div className="space-y-2 pt-1 border-t border-rule">
                <div>
                  <span className="text-ink-3 block text-[11px]">Category Kind</span>
                  <span className="font-bold text-ink uppercase font-mono">{currentDoc.kind}</span>
                </div>
                <div>
                  <span className="text-ink-3 block text-[11px]">File Size</span>
                  <span className="font-semibold text-ink">{formatBytes(currentDoc.sizeBytes)}</span>
                </div>
                <div>
                  <span className="text-ink-3 block text-[11px]">Upload Date</span>
                  <span className="font-semibold text-ink">
                    {formatDate(currentDoc.createdAt.slice(0, 10))}
                  </span>
                </div>
                <div>
                  <span className="text-ink-3 block text-[11px]">Uploaded By</span>
                  <span className="font-semibold text-ink">
                    {currentDoc.createdBy === 'user-ana' ? 'Ana Santos (Owner)' : 'Ben Morales (Helper)'}
                  </span>
                </div>
              </div>
            </div>

            {/* SHA-256 Hash */}
            <div>
              <span className="text-[10px] uppercase font-bold text-ink-3 tracking-wider block mb-1">
                Integrity & Hash
              </span>
              <div className="p-2 rounded bg-sheet-2 border border-rule font-mono text-[10px] break-all text-ink-2">
                <div className="flex items-center gap-1 text-ink-3 font-bold mb-0.5">
                  <Hash className="w-3 h-3 text-stamp" />
                  <span>SHA-256</span>
                </div>
                {currentDoc.sha256}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Review Footer Actions (Section 9.8): Mark Accepted & Flag */}
        {canReview && currentDoc.lineId && (
          <div className="p-3.5 border-t border-rule bg-sheet-2 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink">
                Line is currently awaiting review
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFlagNoteOpen(true)}
                icon={<AlertTriangle className="w-3.5 h-3.5 text-serious-fg" />}
                className="text-xs font-bold text-serious-fg border-serious-bd/50 hover:bg-serious-bg"
              >
                Flag Issue
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onAcceptLine?.(currentDoc.lineId!);
                  onClose();
                }}
                icon={<Stamp className="w-3.5 h-3.5" />}
                className="text-xs font-black bg-good-solid hover:bg-good-solid/90 text-on-good-solid"
              >
                Stamp Accept
              </Button>
            </div>
          </div>
        )}

        {/* Flag Correction Modal */}
        {flagNoteOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-sheet border border-rule rounded-panel p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink font-sans">Flag Document Issue</h3>
                <button
                  onClick={() => setFlagNoteOpen(false)}
                  className="text-ink-3 hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Specify what needs correction:
                </label>
                <textarea
                  value={flagNote}
                  onChange={(e) => setFlagNote(e.target.value)}
                  placeholder="e.g. Missing signature on page 2 or blurry schedule"
                  rows={3}
                  className="w-full p-2 text-xs bg-sheet-2 border border-rule rounded-control text-ink focus:outline-none focus:ring-1 focus:ring-focus resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-rule">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFlagNoteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (flagNote.trim() && currentDoc.lineId) {
                      onFlagLine?.(currentDoc.lineId, flagNote.trim());
                      setFlagNoteOpen(false);
                      onClose();
                    }
                  }}
                  disabled={!flagNote.trim()}
                >
                  Submit Flag
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
