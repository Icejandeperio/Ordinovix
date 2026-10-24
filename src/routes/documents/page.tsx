import React from 'react';
import { FileText, Upload, Download, Search, CheckCircle2 } from 'lucide-react';

export function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">Documents Library</h1>
          <p className="text-xs sm:text-sm text-ink-2 mt-0.5">
            Verified returns, acknowledgments, 2307 certificates, SPAs, and payment receipts
          </p>
        </div>
      </div>

      <div className="p-12 text-center bg-sheet border border-rule rounded-panel text-ink-3 space-y-2">
        <FileText className="w-10 h-10 text-stamp mx-auto" />
        <p className="text-sm font-bold text-ink">Documents Pipeline & Preview Drawer</p>
        <p className="text-xs max-w-sm mx-auto">
          Client documents uploaded during task intake and visit outcomes are indexed here with SHA-256 integrity and thumbnail generation.
        </p>
      </div>
    </div>
  );
}
