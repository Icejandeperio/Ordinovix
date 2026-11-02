import type { ExportKind } from './types';

/**
 * CSV exports (spec 11.14, 19.2, 19.5). The column headers are the ones the Reports screen shows, kept here so the screen and
 * `reports.exportCsv` (mock and Worker) cannot drift apart. A TIN appears only as its masked form.
 */
export const EXPORT_HEADERS: Record<ExportKind, string[]> = {
  clients: ['Client Code', 'Practice Name', 'Registered Entity Name', 'Entity Type', 'RDO', 'VAT Status', 'Status', 'Masked TIN'],
  tasks: ['Task Code / Title', 'Client Code', 'Period', 'Due Date', 'Status', 'Office Action', 'Payment Expected'],
  lines: ['Client', 'Task', 'Line Requirement', 'Copy Form', 'Supplied By', 'Status', 'Late Discovered'],
  follow_ups: ['Client', 'Channel', 'Attempts', 'Status', 'Expected By', 'Last Message Snapshot'],
  visits: ['Office', 'Planned Date', 'Status', 'Items Count', 'Ready to Go', 'Departure Override'],
  payments: ['Paid On', 'Client', 'Channel', 'Reference No.', 'Paid By', 'Amount (PHP)', 'Reimbursement Status'],
  activity: ['Timestamp (PHT)', 'Actor', 'Entity', 'Action', 'Entity ID', 'Summary'],
};

export const EXPORT_KINDS = Object.keys(EXPORT_HEADERS) as ExportKind[];

/** Centavos as a plain decimal for a spreadsheet: 4500050 -> "45000.50". */
export const pesoDecimal = (centavos: number): string => (centavos / 100).toFixed(2);

const UTF8_BOM = '﻿';

function cell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 CSV with a byte-order mark so Excel shows ñ and ₱ correctly. */
export function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return UTF8_BOM + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
