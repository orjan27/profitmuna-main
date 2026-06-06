import { format } from 'date-fns';

/**
 * Format an ISO date string (YYYY-MM-DD) or ISO datetime for display.
 *
 * @param iso - ISO date or datetime string
 * @returns Human-readable date (e.g. "Jun 6, 2026")
 */
export function formatDate(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy');
}
