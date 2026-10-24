/**
 * Universal Data Export Engine for Ordinovix
 * Supports CSV (UTF-8 BOM), Microsoft Excel (.xls XML Spreadsheet), and PDF (Printable Report).
 */

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
 * Opens a print-optimized document window formatted according to Ordinovix print guidelines,
 * triggering the browser's native print-to-PDF dialog.
 */
export function exportToPdf({ title, subtitle, headers, rows }: ExportData): void {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Pop-up was blocked. Please allow pop-ups for Ordinovix to generate the PDF.');
    return;
  }

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
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #182033;
      background: #FFFFFF;
      margin: 0;
      padding: 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      border-bottom: 2px solid #5A3DB8;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      color: #5A3DB8;
      letter-spacing: -0.02em;
    }
    .report-title {
      font-size: 16px;
      font-weight: 700;
      color: #182033;
      margin-top: 4px;
    }
    .subtitle {
      font-size: 11px;
      color: #5F6879;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #5F6879;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      line-height: 1.4;
      margin-top: 10px;
    }
    th {
      background-color: #F6F7F9;
      color: #182033;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.05em;
      border: 1px solid #D8DEE6;
      padding: 8px 10px;
      text-align: left;
    }
    td {
      border: 1px solid #D8DEE6;
      padding: 6px 10px;
      color: #182033;
      font-variant-numeric: tabular-nums;
    }
    tr:nth-child(even) td {
      background-color: #FAFAFC;
    }
    .footer {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #D8DEE6;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #848E9E;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
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
    <div>Page 1 of 1</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
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
