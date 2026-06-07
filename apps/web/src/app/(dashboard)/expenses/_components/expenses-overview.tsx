'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { useQueryState } from 'nuqs';
import { MoreHorizontal, Plus, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRecordSheet } from '@/components/RecordSheetProvider';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import { fetchExpensesAction } from './expense-actions';
import { ExpenseList } from './expense-list';
import type { ExpenseRow } from './edit-expense-dialog';
import { ManageCategoriesDialog } from './manage-categories-dialog';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}

interface PaginatedExpenses {
  content: ExpenseRow[];
  page: number;
  last: boolean;
  totalElements: number;
}

interface ExpensesOverviewProps {
  initialData: PaginatedExpenses;
  categories: ExpenseCategory[];
}

const PAGE_LIMIT = 20;

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Client shell for the expense ledger: holds the collapsed date-range filter,
 * the grouped expense list, and load-more. Recording goes through the global
 * Record sheet.
 *
 * Filter change resets the accumulator to page 0 results (D-07 — date range only, no free-text).
 * "Load more" appends the next page to the accumulated list without resetting (D-06).
 * The header total sums ACTIVE (non-deleted) amounts only.
 */
export function ExpensesOverview({ initialData, categories }: ExpensesOverviewProps) {
  const { openRecordSheet } = useRecordSheet();
  const formatCurrency = useFormatCurrency();

  // Date-range filter via nuqs (D-07) — synced to URL search params
  const [from, setFrom] = useQueryState('from', { defaultValue: '' });
  const [to, setTo] = useQueryState('to', { defaultValue: '' });

  // Accumulated expense rows across pages; reset on filter change
  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialData.content);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [isLast, setIsLast] = useState(initialData.last);

  const [isLoadingMore, startLoadMoreTransition] = useTransition();

  // Re-sync accumulator when the RSC parent re-fetches after router.refresh()
  // (e.g. after a create via the Record sheet). useState ignores prop changes
  // after initial mount, so an effect is needed to pick up the new initialData.
  useEffect(() => {
    setExpenses(initialData.content);
    setCurrentPage(initialData.page);
    setIsLast(initialData.last);
  }, [initialData]);

  const activeFilterCount = [from, to].filter(Boolean).length;
  // Collapsed unless a shared/refreshed URL already carries a filter
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);
  // Manage categories lives in the header's overflow menu (controlled dialog)
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Fetch a page with current filter and return the result
  async function fetchPage(
    page: number,
    fromVal: string,
    toVal: string
  ): Promise<PaginatedExpenses> {
    return fetchExpensesAction({
      page,
      limit: PAGE_LIMIT,
      ...(fromVal ? { from: fromVal } : {}),
      ...(toVal ? { to: toVal } : {}),
    });
  }

  // Apply filter: reset accumulator to page 0 with new filter values
  async function applyFilter(newFrom: string, newTo: string) {
    await setFrom(newFrom || null);
    await setTo(newTo || null);
    const data = await fetchPage(0, newFrom, newTo);
    setExpenses(data.content);
    setCurrentPage(data.page);
    setIsLast(data.last);
  }

  // Load more: append next page to existing list
  function handleLoadMore() {
    startLoadMoreTransition(async () => {
      const nextPage = currentPage + 1;
      const data = await fetchPage(nextPage, from, to);
      setExpenses((prev) => [...prev, ...data.content]);
      setCurrentPage(data.page);
      setIsLast(data.last);
    });
  }

  // After a mutation (edit/delete/restore) re-fetch page 0 with current filter
  const handleMutated = useCallback(() => {
    startLoadMoreTransition(async () => {
      const data = await fetchPage(0, from, to);
      setExpenses(data.content);
      setCurrentPage(data.page);
      setIsLast(data.last);
    });
  }, [from, to]);

  // Totals: sum of active (non-deleted) expenses only
  const activeTotal = expenses
    .filter((e) => e.deletedAt === null)
    .reduce((sum, e) => sum + e.amount, 0);
  const activeCount = expenses.filter((e) => e.deletedAt === null).length;

  // One primary action per view: a truly empty ledger (no records, no filters)
  // leaves the empty state's CTA as the only action on the page.
  const showHeaderControls = expenses.length > 0 || activeFilterCount > 0;

  function handleFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    void applyFilter(e.target.value, to);
  }

  function handleToChange(e: React.ChangeEvent<HTMLInputElement>) {
    void applyFilter(from, e.target.value);
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] leading-tight font-semibold">Expenses</h1>
          {activeCount > 0 ? (
            <>
              {/* Same display scale as the Overview hero — money reads at one
                  size across pages */}
              <p className="mt-3 text-[34px] leading-none font-semibold tracking-tight tabular-nums">
                {formatCurrency(activeTotal)}
              </p>
              <p className="mt-1.5 text-sm text-ink-faint">
                spent across {activeCount} record{activeCount !== 1 ? 's' : ''} in view
              </p>
            </>
          ) : null}
        </div>
        {showHeaderControls ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={activeFilterCount > 0 ? 'text-ink' : 'text-ink-soft'}
            >
              <SlidersHorizontal aria-hidden="true" />
              Filter
              {activeFilterCount > 0 ? (
                <span className="tabular-nums">· {activeFilterCount}</span>
              ) : null}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="More actions"
                  className="text-ink-soft"
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setCategoriesOpen(true)}>
                  Manage categories
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Hidden on mobile: RecordFab is the record affordance there. */}
            <Button size="sm" className="max-md:hidden" onClick={() => openRecordSheet('expense')}>
              <Plus aria-hidden="true" />
              Record expense
            </Button>
          </div>
        ) : null}
      </div>

      {/* Manage categories dialog — opened from the overflow menu */}
      <ManageCategoriesDialog
        categories={categories}
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
      />

      {/* Date-range filter (D-07 — no free-text search for expenses) */}
      {filtersOpen ? (
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-from" className="text-xs">
              From
            </Label>
            <Input
              id="filter-from"
              type="date"
              value={from}
              onChange={handleFromChange}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-to" className="text-xs">
              To
            </Label>
            <Input
              id="filter-to"
              type="date"
              value={to}
              onChange={handleToChange}
              className="w-40"
            />
          </div>
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void applyFilter('', '')}
              className="mb-px"
            >
              Clear filter
            </Button>
          )}
        </div>
      ) : null}

      {/* Expense ledger */}
      <ExpenseList
        expenses={expenses}
        filtered={activeFilterCount > 0}
        categories={categories}
        onMutated={handleMutated}
      />

      {/* Load more (D-06 — append-on-demand, not pagination) */}
      {!isLast && (
        <div className="flex justify-center pt-2">
          <Button variant="ghost" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
