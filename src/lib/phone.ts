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

export const formatPhoneDisplay = formatPhone;

/**
 * Normalizes user input into E.164 (+63...) format.
 */
export function formatPhoneE164(input?: string | null): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('09') && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.startsWith('02') && digits.length === 10) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `+63${digits}`;
  }
  return input.startsWith('+') ? input : `+${input}`;
}
