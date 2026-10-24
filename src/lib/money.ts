import type { Centavos } from '@/domain/types';

/**
 * Formats centavos into formatted Philippine Peso string.
 * Example: 1234550 -> "₱12,345.50"
 */
export function formatPeso(centavos: Centavos | null | undefined): string {
  if (centavos == null || isNaN(centavos)) return '₱0.00';
  const pesos = centavos / 100;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}

/**
 * Formats large peso amounts concisely.
 * Example: 123456789 -> "₱1.2M"
 */
export function formatPesoShort(centavos: Centavos | null | undefined): string {
  if (centavos == null || isNaN(centavos)) return '₱0';
  const pesos = centavos / 100;
  if (Math.abs(pesos) >= 1_000_000) {
    return `₱${(pesos / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(pesos) >= 1_000) {
    return `₱${(pesos / 1_000).toFixed(1)}k`;
  }
  return formatPeso(centavos);
}

/**
 * Parses user input into centavos.
 * Example: "12,345.50" -> 1234550
 */
export function parseToCentavos(val: string | number): Centavos {
  if (typeof val === 'number') {
    return Math.round(val * 100);
  }
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
