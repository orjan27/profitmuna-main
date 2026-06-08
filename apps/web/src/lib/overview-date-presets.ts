import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { TZDate } from '@date-fns/tz';

// Shared between the overview RSC (page.tsx computes the default range) and
// the 'use client' filter component (renders the presets). Lives in lib/ so
// the server can call these — functions exported from a client module cannot
// be invoked from a Server Component.

// ── Manila timezone ──────────────────────────────────────────────────────────

const APP_TIMEZONE = 'Asia/Manila';

function nowManila(): TZDate {
  return new TZDate(new Date(), APP_TIMEZONE);
}

function fmt(date: Date | TZDate): string {
  return format(date, 'yyyy-MM-dd');
}

// ── Date presets ─────────────────────────────────────────────────────────────

export const DATE_PRESETS = [
  {
    label: 'This Month',
    getRange: () => ({
      from: fmt(startOfMonth(nowManila())),
      to: fmt(endOfMonth(nowManila())),
    }),
  },
  {
    label: 'Last Month',
    getRange: () => ({
      from: fmt(startOfMonth(subMonths(nowManila(), 1))),
      to: fmt(endOfMonth(subMonths(nowManila(), 1))),
    }),
  },
  {
    label: 'Last 3 Months',
    getRange: () => ({
      from: fmt(startOfMonth(subMonths(nowManila(), 2))),
      to: fmt(endOfMonth(nowManila())),
    }),
  },
  {
    label: 'This Year',
    getRange: () => ({
      from: fmt(startOfYear(nowManila())),
      to: fmt(endOfYear(nowManila())),
    }),
  },
  {
    label: 'All Time',
    getRange: () => ({ from: undefined, to: undefined }),
  },
] as const;

/**
 * URL sentinel for the All Time preset (D-07/D-08 wrinkle): an EMPTY URL means
 * "apply the This Month default", so All Time can't be expressed by clearing
 * the params — it would snap back to the default. `?from=all` marks the
 * explicit all-time choice; page.tsx translates it to an unbounded range.
 */
export const ALL_TIME_SENTINEL = 'all';

/** Default overview period: This Month in Asia/Manila (D-08). */
export function getDefaultOverviewRange(): { from: string; to: string } {
  return DATE_PRESETS[0].getRange();
}

// Sentence-case captions for the hero ("This month" reads as prose next to
// the trend badge; the filter pills keep their Title Case labels).
const PERIOD_CAPTIONS: Record<string, string> = {
  'This Month': 'This month',
  'Last Month': 'Last month',
  'Last 3 Months': 'Last 3 months',
  'This Year': 'This year',
};

/**
 * Friendly caption for a resolved closed period — "This month" when the
 * range matches a preset, null for custom ranges (caller formats the dates).
 */
export function getPeriodCaption(from: string, to: string): string | null {
  for (const preset of DATE_PRESETS) {
    const range = preset.getRange();
    if (range.from === from && range.to === to) {
      return PERIOD_CAPTIONS[preset.label] ?? preset.label;
    }
  }
  return null;
}
