import type { DocumentKind } from '@/domain/types';

// ---- Spec 9.9 display names: {CLIENTCODE}_{TEMPLATECODE}_{PERIOD}_{KIND}_v{N}.{ext} ----

const KIND_SLUGS: Record<DocumentKind, string> = {
  source: 'src',
  filed_return: 'return',
  acknowledgment: 'ack',
  payment_proof: 'payproof',
  stamped_copy: 'stamped',
  ecar: 'ecar',
  authorization: 'auth',
  other: 'other',
};

export const documentKindSlug = (kind: DocumentKind): string => KIND_SLUGS[kind] ?? 'other';

/** "BIR 1601-EQ" becomes "1601EQ"; a task without a template is "TASK". */
export function templateCodeSlug(code?: string): string {
  const cleaned = (code ?? '').replace(/^BIR\s+/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned || 'TASK';
}

/** "2026-Q3" becomes "2026Q3"; months, years and dates are kept as they are. */
export function periodSlug(period: string): string {
  return period.replace(/-(Q\d)$/i, '$1');
}

export const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export function extensionOf(originalName: string, mimeType?: string): string {
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(originalName);
  if (m) return m[1].toLowerCase().replace(/^jpeg$/, 'jpg');
  return (mimeType && MIME_EXT[mimeType]) || 'pdf';
}

export function documentDisplayName(opts: {
  clientCode: string;
  templateCode?: string;
  /** Period key for periodic tasks, or the transaction date for one-off tasks. */
  period: string;
  kind: DocumentKind;
  versionNo: number;
  originalName: string;
  mimeType?: string;
}): string {
  const ext = extensionOf(opts.originalName, opts.mimeType);
  return `${opts.clientCode}_${templateCodeSlug(opts.templateCode)}_${periodSlug(opts.period)}_${documentKindSlug(opts.kind)}_v${opts.versionNo}.${ext}`;
}
