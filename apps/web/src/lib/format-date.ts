import { format, parse, parseISO } from 'date-fns';

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
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parse(iso, 'yyyy-MM-dd', new Date()) : parseISO(iso);
  return format(d, 'MMM d, yyyy');
}
