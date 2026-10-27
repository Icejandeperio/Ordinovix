import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  useDocuments,
  useClients,
  useTasks,
  useSetLineStatus,
  useRemoveDocument,
} from '@/hooks/useData';
import { FileTile } from '@/components/documents/file-tile';
import { PreviewDrawer } from '@/components/documents/preview-drawer';
import { FileDrop } from '@/components/documents/file-drop';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/format';
import { formatBytes } from '@/lib/compression';
import type { DocumentFile, DocumentKind } from '@/domain/types';
import {
  FileText,
  Upload,
  LayoutList,
  LayoutGrid,
  Search,
  Filter,
  X,
  Eye,
  Download,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  MoreVertical,
} from 'lucide-react';
import { QueryState } from '@/components/ui/query-state';
import { StoredImage, StoredFileLink } from '@/components/documents/stored-file';
import { saveFile } from '@/lib/files';

type TabView = 'all' | 'needs_review' | 'evidence' | 'recent';

export function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = (searchParams.get('view') as 'table' | 'grid') || 'table';
  const activeTab = (searchParams.get('tab') as TabView) || 'all';
  const selectedClient = searchParams.get('clientId') || '';
  const selectedKind = (searchParams.get('kind') as DocumentKind) || '';
  const selectedType = searchParams.get('type') || '';

  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DocumentFile | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Data queries
  const { data: docsData, isLoading, isError, error, refetch } = useDocuments();
  const { data: clientsData } = useClients();
  const { data: tasksData } = useTasks();

  const setLineStatus = useSetLineStatus();
  const removeDocument = useRemoveDocument();

  const allDocuments = docsData?.items || [];
  const clients = clientsData?.items || [];
  const tasks = tasksData?.items || [];

  const updateParam = (key: string, val: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val);
    else next.delete(key);
    setSearchParams(next);
  };

  // Tab filtering logic
  const tabFiltered = useMemo(() => {
    return allDocuments.filter((doc) => {
      switch (activeTab) {
        case 'needs_review':
          // Documents on tasks/lines awaiting review
          return doc.lineId !== undefined;
        case 'evidence':
          return (
            doc.kind === 'filed_return' ||
            doc.kind === 'acknowledgment' ||
            doc.kind === 'payment_proof' ||
            doc.kind === 'stamped_copy' ||
            doc.kind === 'ecar'
          );
        case 'recent':
          return true; // sorted below
        case 'all':
        default:
          return true;
      }
    });
  }, [allDocuments, activeTab]);

  // Dropdown and search filters
  const filtered = useMemo(() => {
    let result = tabFiltered.filter((doc) => {
      if (selectedClient && doc.clientId !== selectedClient) return false;
      if (selectedKind && doc.kind !== selectedKind) return false;
      if (selectedType) {
        if (selectedType === 'image' && !doc.mimeType.startsWith('image/')) return false;
        if (selectedType === 'pdf' && doc.mimeType !== 'application/pdf') return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName =
          doc.displayName.toLowerCase().includes(q) ||
          doc.originalName.toLowerCase().includes(q) ||
          doc.kind.toLowerCase().includes(q);
        if (!matchName) return false;
      }

      return true;
    });

    if (activeTab === 'recent') {
      result = [...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    return result;
  }, [tabFiltered, selectedClient, selectedKind, selectedType, search, activeTab]);

  const hasActiveFilters = Boolean(
    selectedClient || selectedKind || selectedType || search
  );

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('clientId');
    next.delete('kind');
    next.delete('type');
    setSearchParams(next);
    setSearch('');
  };

  return (
    <div className="space-y-5 pb-16">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink font-sans">
              Documents Library
            </h1>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-stamp/10 text-stamp border border-stamp/20">
              {filtered.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Client source schedules, stamped returns, acknowledgment receipts, and payment proofs
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          {/* View mode toggle */}
          <div className="flex items-center p-0.5 bg-sheet-2 border border-rule rounded-control">
            <button
              onClick={() => updateParam('view', 'table')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-sheet text-ink shadow-xs border border-rule/50'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => updateParam('view', 'grid')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-sheet text-ink shadow-xs border border-rule/50'
                  : 'text-ink-3 hover:text-ink'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            icon={<Upload className="w-3.5 h-3.5" />}
            className="text-xs font-bold"
          >
            Upload Document
          </Button>
        </div>
      </div>

      {/* 2. Built-in View Tabs */}
      <div className="border-b border-rule flex items-center gap-1 overflow-x-auto pb-0.5 no-print">
        {[
          { id: 'all', label: 'All documents' },
          { id: 'needs_review', label: 'Needs review' },
          { id: 'evidence', label: 'Evidence files' },
          { id: 'recent', label: 'Recently added' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => updateParam('tab', tab.id === 'all' ? null : tab.id)}
              className={`px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-stamp text-stamp'
                  : 'border-transparent text-ink-3 hover:text-ink hover:border-rule-2'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. Filter Strip */}
      <div className="bg-sheet border border-rule rounded-panel p-3 flex flex-wrap items-center gap-2.5 shadow-2xs no-print">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="w-3.5 h-3.5 text-ink-3 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by file name or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-sheet-2 border border-rule rounded-control text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-focus"
          />
        </div>

        {/* Client filter */}
        <Select
          value={selectedClient}
          onChange={(val) => updateParam('clientId', val || null)}
          className="w-auto min-w-[130px] max-w-[200px]"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.client.id} value={c.client.id}>
              {c.client.code} · {c.client.displayName}
            </option>
          ))}
        </Select>

        {/* Kind filter */}
        <Select
          value={selectedKind}
          onChange={(val) => updateParam('kind', val || null)}
          className="w-auto min-w-[140px]"
        >
          <option value="">All Document Kinds</option>
          <option value="filed_return">Filed Return</option>
          <option value="acknowledgment">Acknowledgment Receipt</option>
          <option value="payment_proof">Payment Proof</option>
          <option value="stamped_copy">Stamped Copy</option>
          <option value="ecar">eCAR Certificate</option>
          <option value="authorization">SPA / Authorization</option>
          <option value="source">Client Source Document</option>
          <option value="other">Other Attachment</option>
        </Select>

        {/* File Type filter */}
        <Select
          value={selectedType}
          onChange={(val) => updateParam('type', val || null)}
          className="w-auto min-w-[130px]"
        >
          <option value="">All File Types</option>
          <option value="image">Images / Photos (JPEG, PNG, WebP)</option>
          <option value="pdf">PDF Documents</option>
        </Select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs font-bold text-ink-3 hover:text-ink px-2 py-1 rounded bg-sheet-3 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* 4. Content Views */}
      {isError ? (
        <QueryState isLoading={false} isError error={error} onRetry={() => refetch()} subject="documents">
          {null}
        </QueryState>
      ) : isLoading ? (
        <div className="space-y-3">
          <div className="h-16 bg-sheet-3 rounded-panel animate-pulse" />
          <div className="h-16 bg-sheet-3 rounded-panel animate-pulse" />
          <div className="h-16 bg-sheet-3 rounded-panel animate-pulse" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3 space-y-3 shadow-xs">
          <FileText className="w-10 h-10 text-stamp mx-auto" />
          <h3 className="text-sm font-bold text-ink">No documents found</h3>
          <p className="text-xs max-w-sm mx-auto">
            Documents uploaded to task requirement lines or visit outcomes will appear here indexed by client and kind.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="text-xs"
          >
            Upload First Document
          </Button>
        </div>
      ) : viewMode === 'table' ? (
        /* ================= TABLE VIEW ================= */
        <div className="bg-sheet border border-rule rounded-panel overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-sheet-2 border-b border-rule text-ink-3 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 w-16 whitespace-nowrap">Preview</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Document Name</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Client</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Category Kind</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">File Size</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Uploaded By</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap actions-col no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {filtered.map((doc) => {
                  const client = clients.find((c) => c.client.id === doc.clientId)?.client;
                  const isImage = doc.mimeType.startsWith('image/');

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setPreviewDoc(doc)}
                      className="hover:bg-sheet-2/70 transition-colors cursor-pointer group"
                    >
                      {/* Thumbnail */}
                      <td className="py-2.5 px-3">
                        <div className="w-10 h-10 rounded bg-sheet-3 border border-rule overflow-hidden flex items-center justify-center shrink-0">
                          {isImage && doc.storageKey ? (
                            <StoredImage
                              storageKey={doc.storageKey}
                              alt={doc.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileText className="w-5 h-5 text-stamp" />
                          )}
                        </div>
                      </td>

                      {/* Document Name */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-ink group-hover:text-stamp transition-colors truncate max-w-[240px]">
                          {doc.displayName}
                        </div>
                        <div className="text-[10px] text-ink-3 font-mono">
                          v{doc.versionNo} {doc.compressed && '• Optimized'}
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-2.5 px-3">
                        {client ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-black px-1 rounded bg-sheet-2 border border-rule">
                              {client.code}
                            </span>
                            <span className="truncate max-w-[140px] font-medium text-ink">
                              {client.displayName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>

                      {/* Kind */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-chip text-[10px] font-bold uppercase bg-sheet-2 border border-rule text-ink-2 font-mono whitespace-nowrap shrink-0">
                          {doc.kind.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-ink-2 whitespace-nowrap">
                        {formatBytes(doc.sizeBytes)}
                      </td>

                      {/* Uploaded By */}
                      <td className="py-2.5 px-3 text-ink-2 whitespace-nowrap">
                        {doc.createdBy === 'user-ana' ? 'Ana Santos' : 'Ben Morales'}
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 text-ink-3 text-[11px] whitespace-nowrap">
                        {formatDate(doc.createdAt.slice(0, 10))}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap actions-cell no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1 rounded text-ink-3 hover:text-ink hover:bg-sheet-3 transition-colors"
                            title="Preview file"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <StoredFileLink
                            storageKey={doc.storageKey}
                            download={doc.displayName}
                            className="p-1 rounded text-ink-3 hover:text-ink hover:bg-sheet-3 transition-colors"
                            title="Download file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </StoredFileLink>
                          <button
                            onClick={() => {
                              const reason = prompt('Specify reason for removing document:');
                              if (reason) {
                                removeDocument.mutate({ id: doc.id, reason });
                              }
                            }}
                            className="p-1 rounded text-ink-3 hover:text-critical-fg hover:bg-critical-bg transition-colors"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= GRID VIEW ================= */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((doc) => (
            <FileTile
              key={doc.id}
              document={doc}
              onPreview={setPreviewDoc}
              onDownload={(d) => {
                void saveFile(d.storageKey, d.displayName);
              }}
              onRemove={(d) => {
                const reason = prompt('Reason for removing file:');
                if (reason) {
                  removeDocument.mutate({ id: d.id, reason });
                }
              }}
            />
          ))}
        </div>
      )}

      {/* 5. Document Preview Drawer (Section 9.8) */}
      <PreviewDrawer
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        documentsList={filtered}
        onSelectDocument={setPreviewDoc}
        clientMeta={
          previewDoc
            ? (() => {
                const c = clients.find((cl) => cl.client.id === previewDoc.clientId)?.client;
                return c ? { displayName: c.displayName, code: c.code } : undefined;
              })()
            : undefined
        }
        onAcceptLine={(lineId) => {
          setLineStatus.mutate({
            id: lineId,
            to: 'accepted',
            extra: { note: 'Verified and approved in document preview' },
          });
        }}
        onFlagLine={(lineId, note) => {
          setLineStatus.mutate({
            id: lineId,
            to: 'needs_correction',
            extra: { note },
          });
        }}
      />

      {/* 6. Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-sheet border border-rule rounded-panel p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink font-sans">Upload Client Document</h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <FileDrop
              clientId={selectedClient || (clients[0]?.client.id ?? 'client-rsp')}
              clientCode={clients.find((c) => c.client.id === selectedClient)?.client.code || 'DOC'}
              defaultKind={selectedKind || 'source'}
              onUploaded={() => {
                setIsUploadOpen(false);
              }}
            />

            <div className="flex justify-end pt-2 border-t border-rule">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsUploadOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
