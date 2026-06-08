'use client';

import { useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { Check, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ALL_TIME_SENTINEL, DATE_PRESETS, getPeriodCaption } from '@/lib/overview-date-presets';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Date-range preset selector for the Overview page — a single pill button
 * (sitting in the hero card) that opens a dropdown of presets, keeping the
 * page clean instead of laying every filter out as a row of pills.
 *
 * Filter state lives in URL search params via nuqs (D-07). Changing a preset
 * updates the URL, which re-renders the RSC page and re-fetches the summary.
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

  // Sentence-case label on the pill ("This month" reads as prose in the hero);
  // custom URL ranges that match no preset fall back to "Custom range".
  const activePreset = DATE_PRESETS.find((p) => isPresetActive(p.label));
  const pillLabel = activePreset
    ? activePreset.label === 'All Time'
      ? 'All time'
      : (getPeriodCaption(activePreset.getRange().from ?? '', activePreset.getRange().to ?? '') ??
        activePreset.label)
    : 'Custom range';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Date range: ${pillLabel}`}
        className="flex items-center gap-1 rounded-full border border-hairline bg-paper/70 py-1 pr-2 pl-3 text-sm font-semibold text-ink transition-colors hover:bg-paper data-[state=open]:bg-paper"
      >
        {pillLabel}
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-ink-soft" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44 rounded-2xl">
        {DATE_PRESETS.map((preset) => {
          const active = isPresetActive(preset.label);
          return (
            <DropdownMenuItem
              key={preset.label}
              onSelect={() => void selectPreset(preset.label)}
              className={cn('rounded-xl', active && 'font-semibold')}
            >
              {preset.label}
              {active ? <Check aria-hidden="true" className="ml-auto h-4 w-4" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
