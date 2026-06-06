'use client';

import { useState, useTransition, useCallback } from 'react';
import { useQueryState } from 'nuqs';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/format-currency';
import { fetchExpensesAction } from './expense-actions';
import { ExpenseList } from './expense-list';
import type { ExpenseRow } from './edit-expense-dialog';

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
 * Client shell that holds date-range filter state, the expense list, and load-more.
 *
 * Filter change resets the accumulator to page 0 results (D-07 — date range only, no free-text).
 * "Load more" appends the next page to the accumulated list without resetting (D-06).
 * Totals header sums ACTIVE (non-deleted) amounts only.
 */
export function ExpensesOverview({ initialData, categories }: ExpensesOverviewProps) {
  // Date-range filter via nuqs (D-07) — synced to URL search params
  const [from, setFrom] = useQueryState('from', { defaultValue: '' });
  const [to, setTo] = useQueryState('to', { defaultValue: '' });

  // Accumulated expense rows across pages; reset on filter change
  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialData.content);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [isLast, setIsLast] = useState(initialData.last);

  const [isLoadingMore, startLoadMoreTransition] = useTransition();

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

  function handleFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    void applyFilter(e.target.value, to);
  }

  function handleToChange(e: React.ChangeEvent<HTMLInputElement>) {
    void applyFilter(from, e.target.value);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Totals header */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-6 py-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total (active)</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(activeTotal)}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/expenses/new">
            <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
            Record Expense
          </Link>
        </Button>
      </div>

      {/* Date-range filter (D-07 — no free-text search for expenses) */}
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
          <Input id="filter-to" type="date" value={to} onChange={handleToChange} className="w-40" />
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

      {/* Expense list */}
      <ExpenseList expenses={expenses} categories={categories} onMutated={handleMutated} />

      {/* Load more (D-06 — append-on-demand, not pagination) */}
      {!isLast && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
