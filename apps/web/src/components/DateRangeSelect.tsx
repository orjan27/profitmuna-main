'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Check, ChevronDown } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';

import { cn } from '@/lib/utils';
import {
  ALL_TIME_SENTINEL,
  CUSTOM_LABEL,
  DATE_PRESETS,
  resolvePresetLabel,
} from '@/lib/overview-date-presets';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangeSelectProps {
  className?: string;
}

/** `yyyy-MM-dd` → local Date (parseISO keeps date-only strings in local time). */
function toDate(value: string | null): Date | undefined {
  return value ? parseISO(value) : undefined;
}

/** Compact label for a resolved custom range, e.g. "Jun 1 – Jul 15, 2026". */
function customLabel(from: string | null, to: string | null): string {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return 'Custom range';
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

/**
 * Unified time-scope control for the dashboard ledgers and the overview — a
 * select-styled popover with the five date presets plus a Custom range picker.
 * Scope lives in the URL `from`/`to` params via nuqs (shareable, survives
 * refresh); `?from=all` is the explicit All Time choice and an empty URL is the
 * This Month default. Selecting a scope refreshes the RSC, which re-resolves the
 * bounds via {@link resolveOverviewRange}.
 *
 * NOTE: nuqs hooks are client-only — the matching RSC reads `searchParams`
 * directly and resolves bounds in @/lib/overview-date-presets.
 */
export function DateRangeSelect({ className }: DateRangeSelectProps): React.JSX.Element {
  const router = useRouter();
  const [from, setFrom] = useQueryState('from', parseAsString);
  const [to, setTo] = useQueryState('to', parseAsString);

  const [open, setOpen] = useState(false);
  // Two-step content: the preset list, then the calendar once Custom is chosen.
  const [showCalendar, setShowCalendar] = useState(false);
  // Draft range while the calendar is open — the first click sets only `from`,
  // so we hold the in-progress selection locally and commit once both ends exist.
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);

  const activeLabel = resolvePresetLabel(from ?? undefined, to ?? undefined);

  const triggerLabel =
    activeLabel === 'All Time'
      ? 'All time'
      : activeLabel === CUSTOM_LABEL
        ? customLabel(from, to)
        : activeLabel;

  function close(): void {
    setOpen(false);
    setShowCalendar(false);
  }

  async function selectPreset(label: string): Promise<void> {
    if (label === 'All Time') {
      await setFrom(ALL_TIME_SENTINEL);
      await setTo(null);
    } else {
      const preset = DATE_PRESETS.find((p) => p.label === label);
      if (!preset) return;
      const range = preset.getRange();
      await setFrom(range.from ?? null);
      await setTo(range.to ?? null);
    }
    close();
    router.refresh();
  }

  const selectedRange: DateRange | undefined =
    activeLabel === CUSTOM_LABEL ? { from: toDate(from), to: toDate(to) } : undefined;

  function openCalendar(): void {
    setDraft(selectedRange);
    setShowCalendar(true);
  }

  async function handleRangeSelect(range: DateRange | undefined): Promise<void> {
    setDraft(range);
    // Commit only once both ends are picked; the first click leaves `to` unset.
    if (!range?.from || !range?.to) return;
    await setFrom(format(range.from, 'yyyy-MM-dd'));
    await setTo(format(range.to, 'yyyy-MM-dd'));
    close();
    router.refresh();
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setShowCalendar(false);
      }}
    >
      <PopoverTrigger
        aria-label={`Date range: ${triggerLabel}`}
        className={cn(
          'flex h-9 w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-medium whitespace-nowrap shadow-xs transition-colors outline-none hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-accent/40',
          className
        )}
      >
        {triggerLabel}
        <ChevronDown aria-hidden="true" className="h-4 w-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {showCalendar ? (
          <Calendar
            mode="range"
            // min=1 so the first click sets only the start (to stays undefined)
            // and a second click is required to complete the range — without it
            // react-day-picker returns {from,to} on the first click and the
            // range commits/closes immediately.
            min={1}
            numberOfMonths={1}
            defaultMonth={draft?.from ?? new Date()}
            selected={draft}
            onSelect={(range) => void handleRangeSelect(range)}
            autoFocus
          />
        ) : (
          <div className="flex min-w-44 flex-col p-1">
            {DATE_PRESETS.map((preset) => {
              const active = activeLabel === preset.label;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => void selectPreset(preset.label)}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                    active && 'font-semibold'
                  )}
                >
                  {preset.label}
                  {active ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                </button>
              );
            })}
            <button
              type="button"
              onClick={openCalendar}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                activeLabel === CUSTOM_LABEL && 'font-semibold'
              )}
            >
              Custom range…
              {activeLabel === CUSTOM_LABEL ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : null}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
