/**
 * Universal Data Export Engine for Ordinovix
 * Supports CSV (UTF-8 BOM), Microsoft Excel (.xls XML Spreadsheet), and PDF (Printable Report).
 */

import type { DocumentFile } from '@/domain/types';

export interface ExportData {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

/**
 * Escapes values for CSV format and prepends UTF-8 BOM so Excel displays ₱ and ñ correctly.
 */
export function exportToCsv({ filename, headers, rows }: ExportData): void {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCell).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Generates an Excel XML Spreadsheet (.xls) with custom styling, bold headers,
 * and preserved Unicode characters.
 */
export function exportToExcel({ filename, title, headers, rows }: ExportData): void {
  const sanitize = (val: string | number | null | undefined): string => {
    if (val == null) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Ordinovix Tax Suite</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Segoe UI, Arial"/>
   <Interior ss:Color="#5A3DB8" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="DataCell">
   <Font ss:FontName="Segoe UI, Arial"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="NumberCell">
   <Font ss:FontName="Segoe UI, Arial"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sanitize(title).slice(0, 30) || 'Export'}">
  <Table>`;

  const xmlHeaders = `   <Row ss:Height="24">
${headers.map((h) => `    <Cell ss:StyleID="Header"><Data ss:Type="String">${sanitize(h)}</Data></Cell>`).join('\n')}
   </Row>`;

  const xmlRows = rows
    .map(
      (row) => `   <Row ss:Height="20">
${row
  .map((cell) => {
    const isNum = typeof cell === 'number';
    const type = isNum ? 'Number' : 'String';
    const styleId = isNum ? 'NumberCell' : 'DataCell';
    return `    <Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${sanitize(cell)}</Data></Cell>`;
  })
  .join('\n')}
   </Row>`
    )
    .join('\n');

  const xmlFooter = `  </Table>
 </Worksheet>
</Workbook>`;

  const fullXml = xmlHeader + '\n' + xmlHeaders + '\n' + xmlRows + '\n' + xmlFooter;
  const blob = new Blob([fullXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  triggerDownload(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
}

/**
 * Prints HTML content safely via a new window or an invisible iframe fallback,
 * completely preventing pop-up blocker failures.
 */
export function printHtmlContent(html: string, title: string): void {
  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '_blank', 'width=960,height=720');
  } catch {
    printWindow = null;
  }

  if (printWindow && printWindow.document) {
    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      return;
    } catch {
      // If writing to window fails, fallback to iframe
    }
  }

  // Fallback to invisible iframe which is never blocked by browser pop-up blockers
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('title', title);
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2500);
    }
  }, 400);
}

/**
 * Opens a print-optimized document window formatted according to Ordinovix print guidelines,
 * triggering the browser's native print-to-PDF dialog with full width and no scrollbars.
 */
export function exportToPdf({ title, subtitle, headers, rows }: ExportData): void {
  const generatedTime = new Date().toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} — Ordinovix Export</title>
  <style>
    @page {
      size: auto;
      margin: 12mm 14mm 12mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #182033;
      background: #FFFFFF;
      margin: 0;
      padding: 16px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      overflow: visible !important;
    }
    .header {
      border-bottom: 2px solid #5A3DB8;
      padding-bottom: 10px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #5A3DB8;
      letter-spacing: -0.02em;
    }
    .report-title {
      font-size: 15px;
      font-weight: 700;
      color: #182033;
      margin-top: 3px;
    }
    .subtitle {
      font-size: 10.5px;
      color: #5F6879;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #5F6879;
    }
    table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      table-layout: auto;
      font-size: 10px;
      line-height: 1.35;
      margin-top: 8px;
      overflow: visible;
    }
    th {
      background-color: #F6F7F9;
      color: #182033;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8.5px;
      letter-spacing: 0.05em;
      border: 1px solid #D8DEE6;
      padding: 7px 9px;
      text-align: left;
    }
    td {
      border: 1px solid #D8DEE6;
      padding: 5px 9px;
      color: #182033;
      font-variant-numeric: tabular-nums;
      word-break: break-word;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    tr:nth-child(even) td {
      background-color: #FAFAFC;
    }
    .footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #D8DEE6;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #848E9E;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-title">ORDINOVIX</div>
      <div class="report-title">${title}</div>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    </div>
    <div class="meta-box">
      <div><strong>Confidential Practice Record</strong></div>
      <div>Generated: ${generatedTime} PHT</div>
      <div>Timezone: Asia/Manila (UTC+8)</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        ${headers.map((h) => `<th>${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `<tr>${row.map((cell) => `<td>${cell != null ? String(cell) : '—'}</td>`).join('')}</tr>`
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>Ordinovix Private Practice Workflow System · RA 10173 Protected</div>
    <div>Report Document · Practice Record</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  printHtmlContent(html, title);
}

/**
 * Prints an isolated client document file (filed return, acknowledgment, stamped copy, payment proof)
 * with crisp practice header, metadata, full resolution rendering, and SHA-256 verification hash.
 */
export function printDocumentFile(
  doc: DocumentFile,
  clientMeta?: { displayName?: string; code?: string },
  /** Loadable URL for the file; stored files need one minted from IndexedDB (see useFileSrc). */
  fileSrc: string = doc.storageKey
): void {
  const generatedTime = new Date().toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const isImage = doc.mimeType.startsWith('image/');
  const isPdf = doc.mimeType === 'application/pdf';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${doc.displayName} — Ordinovix Archive</title>
  <style>
    @page {
      size: auto;
      margin: 10mm 12mm 10mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #182033;
      background: #FFFFFF;
      margin: 0;
      padding: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      overflow: visible !important;
    }
    .header {
      border-bottom: 2px solid #5A3DB8;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      font-size: 13px;
      font-weight: 800;
      color: #5A3DB8;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .doc-title {
      font-size: 15px;
      font-weight: 700;
      color: #182033;
      margin-top: 2px;
      word-break: break-all;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #F6F7F9;
      border: 1px solid #D8DEE6;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 14px;
      font-size: 9.5px;
    }
    .meta-item strong {
      display: block;
      color: #5F6879;
      text-transform: uppercase;
      font-size: 7.5px;
      letter-spacing: 0.05em;
      margin-bottom: 1px;
    }
    .meta-item span {
      font-weight: 600;
      color: #182033;
    }
    .doc-container {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      min-height: 480px;
      margin: 10px 0;
      page-break-inside: avoid;
      overflow: visible;
    }
    .doc-image {
      max-width: 100%;
      height: auto;
      max-height: 85vh;
      object-fit: contain;
      border: 1px solid #D8DEE6;
      border-radius: 4px;
      box-shadow: none;
    }
    .doc-iframe {
      width: 100%;
      height: 85vh;
      border: 1px solid #D8DEE6;
      border-radius: 4px;
    }
    .hash-bar {
      margin-top: 10px;
      padding: 5px 8px;
      background: #F6F7F9;
      border: 1px dashed #D8DEE6;
      border-radius: 4px;
      font-family: monospace;
      font-size: 8.5px;
      color: #465065;
      word-break: break-all;
    }
    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #D8DEE6;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #848E9E;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">ORDINOVIX · PRACTICE DOCUMENT ARCHIVE</div>
      <div class="doc-title">${doc.displayName}</div>
    </div>
    <div style="text-align: right; font-size: 9px; color: #5F6879;">
      <div><strong>Confidential Practice Record</strong></div>
      <div>Printed: ${generatedTime} PHT</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <strong>Category Kind</strong>
      <span>${doc.kind.replace(/_/g, ' ').toUpperCase()}</span>
    </div>
    <div class="meta-item">
      <strong>Client / Taxpayer</strong>
      <span>${clientMeta?.displayName ? `${clientMeta.code ? `[${clientMeta.code}] ` : ''}${clientMeta.displayName}` : doc.clientId}</span>
    </div>
    <div class="meta-item">
      <strong>Upload Date</strong>
      <span>${doc.createdAt.slice(0, 10)}</span>
    </div>
    <div class="meta-item">
      <strong>File Format</strong>
      <span>${doc.mimeType} (${Math.round(doc.sizeBytes / 1024)} KB)</span>
    </div>
  </div>

  <div class="doc-container">
    ${
      isImage
        ? `<img src="${fileSrc}" alt="${doc.displayName}" class="doc-image" id="docImage" />`
        : isPdf
        ? `<iframe src="${fileSrc}#toolbar=0" title="${doc.displayName}" class="doc-iframe" id="docPdf"></iframe>`
        : `<div style="padding: 40px; text-align: center; color: #5F6879;">
            <p style="font-size: 14px;"><strong>${doc.displayName}</strong></p>
            <p style="font-size: 11px;">Document binary archive record.</p>
           </div>`
    }
  </div>

  <div class="hash-bar">
    <strong>SHA-256 INTEGRITY DIGEST:</strong> ${doc.sha256}
  </div>

  <div class="footer">
    <div>Ordinovix Private Practice Workflow System · Section 9.8 / RA 10173 Protected</div>
    <div>Tamper-Evident Stored Copy · Verified Version ${doc.versionNo}</div>
  </div>

  <script>
    function triggerPrint() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    }
    var img = document.getElementById('docImage');
    if (img) {
      if (img.complete) {
        triggerPrint();
      } else {
        img.onload = triggerPrint;
        img.onerror = triggerPrint;
      }
    } else {
      window.onload = triggerPrint;
    }
  </script>
</body>
</html>`;

  printHtmlContent(html, doc.displayName);
}

/**
 * Universal dispatcher supporting csv | excel | pdf
 */
export function exportData(format: 'csv' | 'excel' | 'pdf', data: ExportData): void {
  if (format === 'csv') {
    exportToCsv(data);
  } else if (format === 'excel') {
    exportToExcel(data);
  } else if (format === 'pdf') {
    exportToPdf(data);
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
