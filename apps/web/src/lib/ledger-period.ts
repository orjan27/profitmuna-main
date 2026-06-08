import { format, subMonths } from 'date-fns';
import { TZDate } from '@date-fns/tz';

// Date-key helpers for the Income and Expense ledger stats. The time-scope
// presets now live in @/lib/overview-date-presets (shared with the dashboard
// overview); this module only provides the Asia/Manila stats date keys and the
// month-label helper the ledgers still need. Lives in lib/ so the server can
// call these — a client module's exports can't run in an RSC.

const APP_TIMEZONE = 'Asia/Manila';

function nowManila(): TZDate {
  return new TZDate(new Date(), APP_TIMEZONE);
}

/**
 * Asia/Manila `YYYY` / `YYYY-MM` keys the stats endpoint needs for the monthly
 * series and the month-over-month comparison. Computed web-side so the API
 * stays timezone-agnostic.
 */
export function ledgerStatsDateParams(): { year: string; month: string; prevMonth: string } {
  const now = nowManila();
  return {
    year: format(now, 'yyyy'),
    month: format(now, 'yyyy-MM'),
    prevMonth: format(subMonths(now, 1), 'yyyy-MM'),
  };
}

// ── Month labels (from a `YYYY-MM` key) ──────────────────────────────────────

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** `2026-06` → `Jun`. Empty string for a malformed key. */
export function monthShortLabel(ym: string): string {
  const month = Number(ym.slice(5, 7));
  return MONTH_SHORT[month - 1] ?? '';
}
