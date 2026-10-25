import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud,
  Camera,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  compressImage,
  computeSha256,
  createThumbnail,
  formatBytes,
  formatStandardizedDocName,
} from '@/lib/compression';
import { useUploadDocument } from '@/hooks/useData';
import { repositories } from '@/data';
import type { DocumentKind, DocumentFile } from '@/domain/types';

export interface FileDropProps {
  clientId: string;
  clientCode?: string;
  taskId?: string;
  templateCode?: string;
  period?: string;
  lineId?: string;
  defaultKind?: DocumentKind;
  onUploaded?: (doc: DocumentFile) => void;
  className?: string;
}

interface UploadProgressItem {
  id: string;
  file: File;
  originalSize: number;
  compressedSize?: number;
  status: 'optimizing' | 'uploading' | 'duplicate_check' | 'done' | 'error';
  errorMessage?: string;
  sha256?: string;
  duplicateWarning?: boolean;
}

export function FileDrop({
  clientId,
  clientCode = 'CLI',
  taskId,
  templateCode,
  period,
  lineId,
  defaultKind = 'source',
  onUploaded,
  className = '',
}: FileDropProps) {
  const uploadMutation = useUploadDocument();
  const [items, setItems] = useState<UploadProgressItem[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      // 1. Validation check
      const validTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'application/pdf',
      ];
      if (!validTypes.includes(file.type)) {
        alert(`Unsupported file type: ${file.name}. Only photos (JPEG, PNG, WebP) and PDFs are supported.`);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        alert(`File too large: ${file.name}. Maximum size is 15 MB.`);
        return;
      }

      const itemId = Math.random().toString(36).slice(2);
      const newItem: UploadProgressItem = {
        id: itemId,
        file,
        originalSize: file.size,
        status: 'optimizing',
      };
      setItems((prev) => [newItem, ...prev]);

      try {
        // 2. Compression: compress image to WebP <= 600 KB
        const compressionResult = await compressImage(file);
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  compressedSize: compressionResult.compressedSize,
                  status: 'duplicate_check',
                }
              : it
          )
        );

        // 3. Compute SHA-256 for duplicate detection
        const sha256 = await computeSha256(compressionResult.file);

        // Check if file with same sha exists for client
        const duplicates = await repositories.documents.findBySha(sha256, clientId);
        if (duplicates.length > 0) {
          const confirmUpload = confirm(
            `Duplicate warning: A file with identical content (${duplicates[0].displayName}) was already uploaded for this client. Attach again?`
          );
          if (!confirmUpload) {
            setItems((prev) => prev.filter((it) => it.id !== itemId));
            return;
          }
        }

        // 4. Create 320px WebP thumbnail
        const thumb = await createThumbnail(compressionResult.file, file.type);

        // 5. Compute standardized filename (Section 9.9)
        const fileExt = file.name.split('.').pop() || 'pdf';
        const standardizedName = formatStandardizedDocName({
          clientCode,
          templateCode,
          period,
          kind: defaultKind,
          version: 1,
          ext: fileExt,
        });

        // 6. Upload
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, status: 'uploading', sha256 } : it))
        );

        uploadMutation.mutate(
          {
            meta: {
              clientId,
              taskId,
              lineId,
              kind: defaultKind,
              source: 'upload',
            },
            file: compressionResult.file,
            thumb,
            info: {
              originalName: standardizedName,
              originalSizeBytes: file.size,
              sha256,
            },
          },
          {
            onSuccess: (savedDoc) => {
              setItems((prev) =>
                prev.map((it) => (it.id === itemId ? { ...it, status: 'done' } : it))
              );
              onUploaded?.(savedDoc);
              // Clean up successful item after 4 seconds
              setTimeout(() => {
                setItems((prev) => prev.filter((it) => it.id !== itemId));
              }, 4000);
            },
            onError: (err: any) => {
              setItems((prev) =>
                prev.map((it) =>
                  it.id === itemId
                    ? { ...it, status: 'error', errorMessage: err.message || 'Upload failed' }
                    : it
                )
              );
            },
          }
        );
      } catch (err: any) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId
              ? { ...it, status: 'error', errorMessage: err.message || 'Processing failed' }
              : it
          )
        );
      }
    },
    [clientId, clientCode, taskId, templateCode, period, lineId, defaultKind, uploadMutation, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach(processFile);
    },
    noClick: false,
    noKeyboard: false,
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Drop Zone Box */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-panel p-6 text-center cursor-pointer transition-all select-none ${
          isDragActive
            ? 'border-stamp bg-stamp-soft/50 scale-[0.99]'
            : 'border-rule hover:border-rule-2 hover:bg-sheet-2/50 bg-sheet'
        }`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-sheet-3 border border-rule flex items-center justify-center text-stamp">
            <UploadCloud className="w-5 h-5" />
          </div>

          <div className="text-xs font-semibold text-ink">
            <span className="text-stamp font-bold">Click to upload</span> or drag and drop
          </div>
          <p className="text-[11px] text-ink-3">Photos (JPEG, PNG, WebP) or PDFs up to 15 MB</p>

          {/* Camera Capture Trigger for Mobile / Tablet */}
          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-control bg-sheet-2 border border-rule text-ink hover:bg-sheet-3 transition-colors shadow-2xs"
            >
              <Camera className="w-3.5 h-3.5 text-stamp" />
              <span>Take photo / Add page</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden camera input with environment capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            Array.from(files).forEach(processFile);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Live Upload Progress Tray (Section 9.8) */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="p-3 rounded-control bg-sheet border border-rule flex items-center justify-between gap-3 text-xs shadow-2xs animate-fade-in"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-stamp shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink truncate">{it.file.name}</div>
                  <div className="text-[11px] text-ink-3 flex items-center gap-2">
                    {it.status === 'optimizing' && (
                      <span className="text-stamp flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Optimizing image for fast transmission...</span>
                      </span>
                    )}
                    {it.status === 'duplicate_check' && (
                      <span>Checking SHA-256 integrity...</span>
                    )}
                    {it.status === 'uploading' && (
                      <span className="flex items-center gap-1 text-stamp">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>
                          {it.compressedSize && it.compressedSize < it.originalSize
                            ? `Optimized: ${formatBytes(it.originalSize)} → ${formatBytes(it.compressedSize)}`
                            : formatBytes(it.originalSize)}
                        </span>
                      </span>
                    )}
                    {it.status === 'done' && (
                      <span className="text-good-fg font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Attached to task requirements</span>
                      </span>
                    )}
                    {it.status === 'error' && (
                      <span className="text-critical-fg font-semibold">
                        {it.errorMessage}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {it.status !== 'done' && (
                <button
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                  className="text-ink-3 hover:text-ink p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
