import { formatPeso, formatPesoShort, parseToCentavos } from './money';
import { formatDate, formatDateTime, formatRelative, formatTime, todayInManila } from './dates';
import { formatTin, maskTin } from './tin';
import { formatPhone } from './phone';

export {
  formatPeso,
  formatPesoShort,
  parseToCentavos,
  formatDate,
  formatDateTime,
  formatRelative,
  formatTime,
  todayInManila,
  formatTin,
  maskTin,
  formatPhone,
};

/**
 * Format helper for status and task codes
 */
export function formatCode(code: string): string {
  return code.toUpperCase().trim();
}
