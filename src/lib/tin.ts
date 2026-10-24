/**
 * Formats a 9 or 12-digit TIN string into grouped digits.
 * Example: '123456789000' -> '123-456-789-000'
 */
export function formatTin(tin?: string | null, branch: string = '00000'): string {
  if (!tin) return '—';
  const clean = tin.replace(/\D/g, '');
  const base = clean.slice(0, 9);
  const ext = clean.length > 9 ? clean.slice(9) : branch;
  
  const g1 = base.slice(0, 3);
  const g2 = base.slice(3, 6);
  const g3 = base.slice(6, 9);
  
  if (ext) {
    return `${g1}-${g2}-${g3}-${ext}`;
  }
  return `${g1}-${g2}-${g3}`;
}

/**
 * Masks TIN for privacy by default (RA 10173).
 * Example: maskTin('123456789', '00000') -> '•••-•••-789-00000'
 */
export function maskTin(tin?: string | null, branch: string = '00000'): string {
  if (!tin) return '—';
  const clean = tin.replace(/\D/g, '');
  const last3 = clean.slice(6, 9) || '000';
  const ext = clean.length > 9 ? clean.slice(9) : branch;
  return `•••-•••-${last3}-${ext}`;
}
