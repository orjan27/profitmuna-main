'use client';

import { useEffect, useRef } from 'react';
import { useQueryState, parseAsString } from 'nuqs';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
 * URL-persisted filter controls for the income list.
 * Uses nuqs useQueryState so filters survive page refresh and are shareable (D-07).
 * Search is debounced ~300ms to avoid excessive re-fetches.
 */
export function IncomeFilters({ onFilterChange }: IncomeFiltersProps) {
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));
  const [moneyStatus, setMoneyStatus] = useQueryState('moneyStatus', parseAsString.withDefault(''));
  const [from, setFrom] = useQueryState('from', parseAsString.withDefault(''));
  const [to, setTo] = useQueryState('to', parseAsString.withDefault(''));

  // Local controlled value for search so typing feels instant while debouncing the URL update
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      await setSearch(value || null);
      onFilterChange?.();
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
  }

  async function handleFromChange(value: string) {
    await setFrom(value || null);
    onFilterChange?.();
  }

  async function handleToChange(value: string) {
    await setTo(value || null);
    onFilterChange?.();
  }

  return (
    <div className="mb-4 flex flex-wrap gap-3">
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

      {/* Date range */}
      <div className="flex items-center gap-2">
        <Label htmlFor="income-from" className="shrink-0 text-sm text-muted-foreground">
          From
        </Label>
        <Input
          id="income-from"
          type="date"
          className="w-36"
          value={from}
          onChange={(e) => handleFromChange(e.target.value)}
          aria-label="Filter from date"
        />
        <Label htmlFor="income-to" className="shrink-0 text-sm text-muted-foreground">
          To
        </Label>
        <Input
          id="income-to"
          type="date"
          className="w-36"
          value={to}
          onChange={(e) => handleToChange(e.target.value)}
          aria-label="Filter to date"
        />
      </div>
    </div>
  );
}
