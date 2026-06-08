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

/** Label shown for an arbitrary range that matches no preset. */
export const CUSTOM_LABEL = 'Custom';

/** A preset label, or the Custom-range marker — the values DateRangeSelect drives. */
export type PresetLabel = (typeof DATE_PRESETS)[number]['label'] | typeof CUSTOM_LABEL;

/** Default overview period: This Month in Asia/Manila (D-08). */
export function getDefaultOverviewRange(): { from: string; to: string } {
  return DATE_PRESETS[0].getRange();
}

/**
 * Map the URL `from`/`to` params to the preset they represent — or
 * {@link CUSTOM_LABEL} for an arbitrary range. Mirrors the resolution the
 * server uses: an empty URL is the This Month default; `?from=all` is All Time.
 */
export function resolvePresetLabel(from?: string, to?: string): PresetLabel {
  if (from === ALL_TIME_SENTINEL) return 'All Time';
  if (!from && !to) return 'This Month';
  for (const preset of DATE_PRESETS) {
    if (preset.label === 'All Time') continue;
    const range = preset.getRange();
    if (range.from === from && range.to === to) return preset.label;
  }
  return CUSTOM_LABEL;
}

/**
 * Resolve URL `from`/`to` params to the concrete bounds a page fetches with.
 * An empty URL applies the This Month default (D-08); `?from=all` is the
 * explicit All Time choice (both bounds undefined → unbounded). Any other
 * pair is passed through verbatim (a Custom range).
 */
export function resolveOverviewRange(
  from?: string,
  to?: string
): { from?: string; to?: string; allTime: boolean; hasUrlFilter: boolean } {
  const allTime = from === ALL_TIME_SENTINEL;
  const hasUrlFilter = Boolean(from || to);
  const defaults = getDefaultOverviewRange();
  return {
    from: allTime ? undefined : (from ?? defaults.from),
    to: allTime ? undefined : (to ?? defaults.to),
    allTime,
    hasUrlFilter,
  };
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
