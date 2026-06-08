'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsString } from 'nuqs';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface IncomeFiltersProps {
  /** Called whenever any filter changes so the overview can reset the load-more page counter. */
  onFilterChange?: () => void;
}

/**
 * Secondary income filters: free-text search and money status. The primary time
 * scope is the DateRangeSelect (URL `from`/`to`), so date range no longer lives here.
 * Filter state lives in nuqs query params (survives refresh, shareable);
 * search is debounced ~300ms to avoid excessive re-fetches.
 */
export function IncomeFilters({ onFilterChange }: IncomeFiltersProps): React.JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));
  const [moneyStatus, setMoneyStatus] = useQueryState('moneyStatus', parseAsString.withDefault(''));

  // Local controlled value for search so typing feels instant while debouncing the URL update
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      await setSearch(value || null);
      onFilterChange?.();
      // nuqs updates the URL shallowly; refresh so the RSC re-fetches with the new param.
      router.refresh();
    }, 300);
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  async function handleStatusChange(value: string) {
    // 'all' sentinel clears the filter (Radix Select forbids value="").
    await setMoneyStatus(value === 'all' ? null : value || null);
    onFilterChange?.();
    // nuqs updates the URL shallowly; refresh so the RSC re-fetches with the new param.
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3">
      {/* Search */}
      <div className="min-w-48 flex-1">
        <Input
          placeholder="Search description or category…"
          defaultValue={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Search income"
        />
      </div>

      {/* Status filter */}
      <div className="w-40">
        <Select value={moneyStatus || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="RECEIVED">Received</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
