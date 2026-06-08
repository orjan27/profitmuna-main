import { format, isToday, isYesterday, parse, parseISO } from 'date-fns';

/** Parse an ISO date (YYYY-MM-DD) or datetime string anchored to LOCAL time (WR-03). */
function parseLocal(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parse(iso, 'yyyy-MM-dd', new Date()) : parseISO(iso);
}

/**
 * Format an ISO date string (YYYY-MM-DD) or ISO datetime for display.
 *
 * Date-only strings are parsed in LOCAL time. `new Date('2026-06-06')` parses
 * as UTC midnight, which renders the previous day in negative-offset timezones
 * (WR-03). `parse(...)` with an explicit format anchors to local time.
 *
 * @param iso - ISO date or datetime string
 * @returns Human-readable date (e.g. "Jun 6, 2026")
 */
export function formatDate(iso: string): string {
  return format(parseLocal(iso), 'MMM d, yyyy');
}

/**
 * Format an ISO date as a ledger group heading: "Today", "Yesterday",
 * or "Jun 6, 2026". Used by the date-grouped transaction lists.
 *
 * @param iso - ISO date or datetime string
 * @returns Group heading label
 */
export function formatDateGroup(iso: string): string {
  const d = parseLocal(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d, yyyy');
}

/**
 * Today as YYYY-MM-DD in local time — the default value for date inputs.
 *
 * @returns Local date string (e.g. "2026-06-06")
 */
export function todayLocal(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Formats a day-of-month number as an ordinal string.
 * Examples: 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 21 → "21st"
 *
 * @param n - Day of month (1–31)
 * @returns Ordinal label
 */
export function formatOrdinal(n: number): string {
  // 11th–13th are "th" despite ending in 1–3
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  const suffix = mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}
