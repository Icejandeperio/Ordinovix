import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCsv, exportToExcel, exportToPdf, printDocumentFile, type ExportData } from './export';
import type { DocumentFile } from '@/domain/types';

describe('Universal Export and High-Fidelity Printing Engine', () => {
  let createdElements: any[] = [];
  let appendedElements: any[] = [];

  beforeEach(() => {
    createdElements = [];
    appendedElements = [];

    const mockDocument = {
      createElement: vi.fn((tagName: string) => {
        const el: any = {
          tagName: tagName.toUpperCase(),
          style: {},
          setAttribute: vi.fn(),
          appendChild: vi.fn(),
          removeChild: vi.fn(),
          click: vi.fn(),
        };

        if (tagName === 'iframe') {
          const fakeDoc = {
            open: vi.fn(),
            write: vi.fn(),
            close: vi.fn(),
          };
          const fakeWindow = {
            focus: vi.fn(),
            print: vi.fn(),
            document: fakeDoc,
          };
          el.contentWindow = fakeWindow;
          el.contentDocument = fakeDoc;
          el.parentNode = {
            removeChild: vi.fn(),
          };
        }

        createdElements.push(el);
        return el;
      }),
      body: {
        appendChild: vi.fn((el: any) => {
          appendedElements.push(el);
        }),
        removeChild: vi.fn(),
      },
    };

    const mockWindow = {
      open: vi.fn(() => null), // Return null to test automatic printable iframe fallback
      document: mockDocument,
      focus: vi.fn(),
      print: vi.fn(),
    };

    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const sampleData: ExportData = {
    filename: 'test-export',
    title: 'Test Export Report',
    subtitle: 'Confidential Client Summary',
    headers: ['Client', 'Tax Due', 'Status'],
    rows: [
      ['Rivera Salonga', 'PHP 12,345.50', 'Filed'],
      ['Cruz & Santos Litigation', 'PHP 45,000.00', 'Pending'],
    ],
  };

  it('exportToCsv escapes cells properly and creates downloadable blob', () => {
    exportToCsv(sampleData);

    const anchor = createdElements.find((el) => el.tagName === 'A');
    expect(anchor).toBeDefined();
    expect(anchor.download).toBe('test-export.csv');
    expect(anchor.href).toBe('blob:mock-url');
    expect(anchor.click).toHaveBeenCalled();
  });

  it('exportToExcel generates valid SpreadsheetML XML and triggers download', () => {
    exportToExcel(sampleData);

    const anchor = createdElements.find((el) => el.tagName === 'A');
    expect(anchor).toBeDefined();
    expect(anchor.download).toBe('test-export.xls');
    expect(anchor.href).toBe('blob:mock-url');
    expect(anchor.click).toHaveBeenCalled();
  });

  it('exportToPdf falls back seamlessly to printable iframe without throwing alert when popups blocked', () => {
    exportToPdf(sampleData);

    const iframes = createdElements.filter((el) => el.tagName === 'IFRAME');
    expect(iframes.length).toBeGreaterThan(0);

    const targetIframe = iframes[0];
    const fakeDoc = targetIframe.contentDocument;
    expect(fakeDoc.write).toHaveBeenCalled();

    // Verify written HTML contains report title and table rules
    const writtenHtml = fakeDoc.write.mock.calls[0][0];
    expect(writtenHtml).toContain('Test Export Report');
    expect(writtenHtml).toContain('Rivera Salonga');
    expect(writtenHtml).toContain('scrollbar-width: none !important');
    expect(writtenHtml).toContain('table-layout: auto');
    expect(writtenHtml).toContain('overflow: visible !important');
  });

  it('printDocumentFile formats practice document with client metadata and SHA-256 hash', () => {
    const mockDoc: DocumentFile = {
      id: 'doc-rsp-1',
      orgId: 'org-santos',
      clientId: 'client-rsp',
      kind: 'filed_return',
      displayName: 'RSP_1601EQ_2026Q3_return_v1.pdf',
      originalName: '1601EQ_Signed.pdf',
      mimeType: 'image/svg+xml',
      sizeBytes: 420 * 1024,
      originalSizeBytes: 1200 * 1024,
      compressed: true,
      sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      storageKey: 'data:image/svg+xml;utf8,<svg></svg>',
      versionNo: 1,
      source: 'upload',
      createdAt: '2026-10-24T10:15:00+08:00',
      createdBy: 'user-ana',
      updatedAt: '2026-10-24T10:15:00+08:00',
      updatedBy: 'user-ana',
      version: 1,
    };

    printDocumentFile(mockDoc, { displayName: 'Rivera Salonga & Partners', code: 'RSP' });

    const iframes = createdElements.filter((el) => el.tagName === 'IFRAME');
    expect(iframes.length).toBeGreaterThan(0);

    const targetIframe = iframes[iframes.length - 1];
    const fakeDoc = targetIframe.contentDocument;
    expect(fakeDoc.write).toHaveBeenCalled();

    const writtenHtml = fakeDoc.write.mock.calls[0][0];
    expect(writtenHtml).toContain('RSP_1601EQ_2026Q3_return_v1.pdf');
    expect(writtenHtml).toContain('FILED RETURN');
    expect(writtenHtml).toContain('[RSP] Rivera Salonga & Partners');
    expect(writtenHtml).toContain('a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0');
    expect(writtenHtml).toContain('doc-image');
    expect(writtenHtml).toContain('scrollbar-width: none !important');
    expect(writtenHtml).toContain('overflow: visible !important');
  });
});
