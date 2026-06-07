'use client';

import { useRouter } from 'next/navigation';
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { parseAsString, useQueryState } from 'nuqs';

import { cn } from '@/lib/utils';

// ── Manila timezone ──────────────────────────────────────────────────────────

const APP_TIMEZONE = 'Asia/Manila';

function nowManila(): TZDate {
  return new TZDate(new Date(), APP_TIMEZONE);
}

function fmt(date: Date | TZDate): string {
  return format(date, 'yyyy-MM-dd');
}

// ── Date presets ─────────────────────────────────────────────────────────────

const DATE_PRESETS = [
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

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Date-range preset selector for the Overview page.
 *
 * Filter state lives in URL search params via nuqs (D-07). Changing a preset
 * updates the URL, which re-renders the RSC page and re-fetches the summary.
 * Quiet text affordances match the adopted monochrome idiom — no boxes.
 *
 * NOTE: nuqs hooks may only be called in client components (Pitfall 2).
 * page.tsx reads searchParams directly.
 */
export function OverviewFilters(): React.JSX.Element {
  const router = useRouter();

  const [from, setFrom] = useQueryState('from', parseAsString);
  const [to, setTo] = useQueryState('to', parseAsString);

  function isPresetActive(label: string): boolean {
    // Empty URL → the server applies the This Month default (D-08)
    if (!from && !to) return label === 'This Month';
    if (from === ALL_TIME_SENTINEL) return label === 'All Time';
    const preset = DATE_PRESETS.find((p) => p.label === label);
    if (!preset) return false;
    const range = preset.getRange();
    return from === range.from && to === range.to;
  }

  async function selectPreset(label: string) {
    const preset = DATE_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    if (label === 'All Time') {
      await setFrom(ALL_TIME_SENTINEL);
      await setTo(null);
    } else {
      const range = preset.getRange();
      await setFrom(range.from ?? null);
      await setTo(range.to ?? null);
    }
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Date range"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
    >
      {DATE_PRESETS.map((preset) => {
        const active = isPresetActive(preset.label);
        return (
          <button
            key={preset.label}
            type="button"
            aria-pressed={active}
            onClick={() => void selectPreset(preset.label)}
            className={cn(
              'text-sm transition-colors',
              active ? 'font-medium text-ink' : 'text-ink-faint hover:text-ink'
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
