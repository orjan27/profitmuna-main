/**
 * Format an integer cent amount as a Philippine Peso display string.
 * Phase 6 currency swap point: change locale/prefix here to support other currencies.
 *
 * @param cents - Amount in integer cents (e.g. 10000 = ₱100.00)
 * @returns Formatted currency string (e.g. "₱100.00")
 */
export function formatCurrency(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Convert a decimal peso input to integer cents for storage.
 * Uses Math.round to avoid floating-point precision issues (D-08).
 *
 * @param pesos - Decimal peso amount from a form input (e.g. 100.50)
 * @returns Integer cents (e.g. 10050)
 */
export function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}
