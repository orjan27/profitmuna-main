'use client';

import { useRouter } from 'next/navigation';
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { Filter } from 'lucide-react';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A category option derived from the summary response.
 * Phase 2 will provide full income_categories labels — until then, the
 * category filter operates on raw category IDs from the summary response.
 */
export interface CategoryOption {
  id: string;
  label: string;
}

interface PfFiltersProps {
  /** Category options derived from distinct IDs in the summary response. */
  categoryOptions?: CategoryOption[];
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Date-range preset selector and income category multi-select filter.
 *
 * Filter state lives in URL search params via nuqs (D-11). Changing a filter
 * updates the URL, which re-renders the RSC page and re-fetches the summary.
 *
 * NOTE: nuqs hooks may only be called in client components (Pitfall 5).
 * This component is 'use client' — page.tsx reads searchParams directly.
 */
export function PfFilters({ categoryOptions = [] }: PfFiltersProps) {
  const router = useRouter();

  const [from, setFrom] = useQueryState('from', parseAsString);
  const [to, setTo] = useQueryState('to', parseAsString);
  const [selectedCategories, setSelectedCategories] = useQueryState(
    'categoryIds',
    parseAsArrayOf(parseAsString).withDefault([])
  );

  function isPresetActive(label: string): boolean {
    const preset = DATE_PRESETS.find((p) => p.label === label);
    if (!preset) return false;
    if (label === 'All Time') return !from && !to;
    const range = preset.getRange();
    return from === range.from && to === range.to;
  }

  async function selectPreset(label: string) {
    const preset = DATE_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    const range = preset.getRange();
    await setFrom(range.from ?? null);
    await setTo(range.to ?? null);
    router.refresh();
  }

  async function toggleCategory(id: string) {
    const current = selectedCategories ?? [];
    const updated = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    await setSelectedCategories(updated.length > 0 ? updated : null);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Date range preset buttons — Manila timezone (D-09) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {DATE_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant={isPresetActive(preset.label) ? 'default' : 'outline'}
            size="sm"
            onClick={() => void selectPreset(preset.label)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Category multi-select sheet or empty-state */}
      {categoryOptions.length > 0 ? (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Income categories
              {(selectedCategories?.length ?? 0) > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                  {selectedCategories?.length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Income categories</SheetTitle>
              <SheetDescription>
                Filter the allocation summary by income category. Default shows all categories.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-3 px-1">
              {categoryOptions.map((cat) => {
                const checked = (selectedCategories ?? []).includes(cat.id);
                return (
                  <div key={cat.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`cat-${cat.id}`}
                      checked={checked}
                      onCheckedChange={() => void toggleCategory(cat.id)}
                    />
                    <Label htmlFor={`cat-${cat.id}`} className="cursor-pointer font-normal">
                      {cat.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        /* categoryOptions.length === 0 — explicit empty-state so the filter is
           visible but non-interactive rather than silently absent */
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5" disabled>
            <Filter className="h-3.5 w-3.5" />
            Income categories
          </Button>
          <span className="text-xs text-muted-foreground">No income categories yet</span>
        </div>
      )}
    </div>
  );
}
