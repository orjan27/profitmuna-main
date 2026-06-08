/**
 * Currency locale and symbol mapping for the 8 supported ISO 4217 codes.
 * JPY uses 0 fraction digits (whole yen); all others use 2.
 *
 * @see SET-01 — user-selectable display currency
 */
export const CURRENCY_LOCALES = {
  PHP: { locale: 'en-PH', symbol: '₱' },
  USD: { locale: 'en-US', symbol: '$' },
  EUR: { locale: 'de-DE', symbol: '€' },
  GBP: { locale: 'en-GB', symbol: '£' },
  SGD: { locale: 'en-SG', symbol: 'S$' },
  AUD: { locale: 'en-AU', symbol: 'A$' },
  JPY: { locale: 'ja-JP', symbol: '¥' },
  CAD: { locale: 'en-CA', symbol: 'C$' },
} as const satisfies Record<string, { locale: string; symbol: string }>;

/** Union of supported ISO 4217 currency codes (SET-01). */
export type CurrencyCode = keyof typeof CURRENCY_LOCALES;

/**
 * Format an integer cent amount as a currency display string.
 *
 * The second param defaults to 'PHP' so all existing call sites continue to
 * produce identical ₱-prefixed output — no call-site rework required (D-14).
 *
 * JPY is a zero-decimal currency — formatCurrency(10000, 'JPY') = '¥100'.
 * All other currencies use 2 decimal places.
 *
 * @param cents - Amount in integer cents (e.g. 10000 = 100.00 in the currency unit)
 * @param currency - ISO 4217 code from the supported list (default: 'PHP')
 * @returns Formatted currency string (e.g. "₱100.00", "$100.00", "¥100")
 */
export function formatCurrency(cents: number, currency: CurrencyCode = 'PHP'): string {
  const { locale, symbol } = CURRENCY_LOCALES[currency];
  // JPY is a zero-decimal currency; fraction digits = 0.
  const fractionDigits = currency === 'JPY' ? 0 : 2;
  return `${symbol}${(cents / 100).toLocaleString(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Currency split into display parts so the decimals can be styled apart. */
export interface CurrencyParts {
  /** Currency symbol with any leading sign — e.g. "₱" or "-₱". */
  symbol: string;
  /** Grouped integer portion — e.g. "88,447". */
  whole: string;
  /** Decimal separator + fraction digits — e.g. ".05". Empty for JPY. */
  fraction: string;
}

/**
 * Format an integer cent amount into locale-correct display parts so a hero
 * figure can render the decimals in a quieter weight (e.g. ₱88,447 with a
 * faint .05). Locale-safe: the integer/decimal split comes from
 * Intl.NumberFormat parts, not a naive `.split('.')` (which breaks for
 * comma-decimal locales like de-DE).
 *
 * @param cents - Amount in integer cents
 * @param currency - ISO 4217 code from the supported list (default: 'PHP')
 */
export function formatCurrencyParts(cents: number, currency: CurrencyCode = 'PHP'): CurrencyParts {
  const { locale, symbol } = CURRENCY_LOCALES[currency];
  const fractionDigits = currency === 'JPY' ? 0 : 2;
  const parts = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).formatToParts(Math.abs(cents) / 100);

  const whole = parts
    .filter((p) => p.type === 'integer' || p.type === 'group')
    .map((p) => p.value)
    .join('');
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '';
  const fractionDigitsValue = parts.find((p) => p.type === 'fraction')?.value ?? '';

  return {
    symbol: `${cents < 0 ? '-' : ''}${symbol}`,
    whole,
    fraction: fractionDigitsValue ? `${decimal}${fractionDigitsValue}` : '',
  };
}

/**
 * Convert a decimal amount input to integer cents for storage.
 * Uses Math.round to avoid floating-point precision issues (D-08).
 *
 * @param amount - Decimal amount from a form input (e.g. 100.50)
 * @returns Integer cents (e.g. 10050)
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
