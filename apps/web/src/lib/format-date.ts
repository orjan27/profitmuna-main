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
