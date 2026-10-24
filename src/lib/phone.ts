/**
 * Formats a Philippine mobile number into human-readable representation.
 * Example: '+639171234567' -> '0917 123 4567'
 */
export function formatPhone(phone?: string | null): string {
  if (!phone) return '—';
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('63') && clean.length === 12) {
    clean = '0' + clean.slice(2);
  }
  if (clean.length === 11 && clean.startsWith('09')) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  }
  return phone;
}
