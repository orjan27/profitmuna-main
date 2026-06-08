import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from 'date-fns';
import { TZDate } from '@date-fns/tz';

// Period scope for the Income and Expense ledgers — the segmented control's
// four presets (mockup: 30 days / This month / This year / All). Shared between
// the ledger RSCs (which resolve the default range and the stats date keys) and
// the 'use client' PeriodControl (which renders the presets). Lives in lib/ so
// the server can call these — a client module's exports can't run in an RSC.

const APP_TIMEZONE = 'Asia/Manila';

function nowManila(): TZDate {
  return new TZDate(new Date(), APP_TIMEZONE);
}

function fmt(date: Date | TZDate): string {
  return format(date, 'yyyy-MM-dd');
}

// ── Presets ────────────────────────────────────────────────────────────────

export const LEDGER_PERIOD_KEYS = ['30d', 'month', 'year', 'all'] as const;
export type LedgerPeriodKey = (typeof LEDGER_PERIOD_KEYS)[number];

/** The default period when the URL carries no `period` param (mockup default). */
export const DEFAULT_LEDGER_PERIOD: LedgerPeriodKey = 'month';

interface LedgerPreset {
  key: LedgerPeriodKey;
  /** Segmented-control label. */
  label: string;
  /** Resolved bounds; `all` leaves both undefined (unbounded). */
  getRange: () => { from?: string; to?: string };
}

export const LEDGER_PERIODS: readonly LedgerPreset[] = [
  {
    key: '30d',
    label: '30 days',
    getRange: () => ({ from: fmt(subDays(nowManila(), 29)), to: fmt(nowManila()) }),
  },
  {
    key: 'month',
    label: 'This month',
    getRange: () => ({ from: fmt(startOfMonth(nowManila())), to: fmt(endOfMonth(nowManila())) }),
  },
  {
    key: 'year',
    label: 'This year',
    getRange: () => ({ from: fmt(startOfYear(nowManila())), to: fmt(endOfYear(nowManila())) }),
  },
  {
    key: 'all',
    label: 'All',
    getRange: () => ({ from: undefined, to: undefined }),
  },
] as const;

function isLedgerPeriodKey(value: string | undefined): value is LedgerPeriodKey {
  return value !== undefined && (LEDGER_PERIOD_KEYS as readonly string[]).includes(value);
}

/**
 * Resolve a URL `period` value to its key and concrete date bounds. Unknown or
 * missing values fall back to {@link DEFAULT_LEDGER_PERIOD}.
 */
export function resolveLedgerPeriod(value?: string): {
  key: LedgerPeriodKey;
  from?: string;
  to?: string;
} {
  const key = isLedgerPeriodKey(value) ? value : DEFAULT_LEDGER_PERIOD;
  const preset = LEDGER_PERIODS.find((p) => p.key === key)!;
  return { key, ...preset.getRange() };
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
