'use client';

import { useRouter } from 'next/navigation';
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
import { DateRangeSelect } from '@/components/DateRangeSelect';

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
 * Date-range selector and income category multi-select filter.
 *
 * The time scope is the shared {@link DateRangeSelect} (URL `from`/`to` via
 * nuqs — D-11); category selection lives in `categoryIds`. Changing a filter
 * updates the URL, which re-renders the RSC page and re-fetches the summary.
 *
 * NOTE: nuqs hooks may only be called in client components (Pitfall 5).
 * This component is 'use client' — page.tsx reads searchParams directly.
 */
export function PfFilters({ categoryOptions = [] }: PfFiltersProps) {
  const router = useRouter();

  const [selectedCategories, setSelectedCategories] = useQueryState(
    'categoryIds',
    parseAsArrayOf(parseAsString).withDefault([])
  );

  async function toggleCategory(id: string) {
    const current = selectedCategories ?? [];
    const updated = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    await setSelectedCategories(updated.length > 0 ? updated : null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Time scope — shared select (presets + Custom range), Manila tz (D-09). */}
      <DateRangeSelect />

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
