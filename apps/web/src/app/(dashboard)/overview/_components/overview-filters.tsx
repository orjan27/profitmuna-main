'use client';

import { useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';

import { cn } from '@/lib/utils';
import { ALL_TIME_SENTINEL, DATE_PRESETS } from '@/lib/overview-date-presets';

/**
 * Date-range preset selector for the Overview page.
 *
 * Filter state lives in URL search params via nuqs (D-07). Changing a preset
 * updates the URL, which re-renders the RSC page and re-fetches the summary.
 * Quiet text affordances match the adopted monochrome idiom — no boxes.
 *
 * NOTE: nuqs hooks may only be called in client components (Pitfall 2).
 * page.tsx reads searchParams directly; the preset/range definitions live in
 * @/lib/overview-date-presets so the RSC can compute the default range too.
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
