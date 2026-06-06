'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useQueryState, parseAsString } from 'nuqs';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { Income, IncomeCategory } from '@/types/income';
import { formatCurrency } from '@/lib/format-currency';
import { IncomeFilters } from './income-filters';
import { IncomeList } from './income-list';
import { EditIncomeDialog } from './edit-income-dialog';
import { ReceiveIncomeDialog } from './receive-income-dialog';
import { fetchIncomesAction } from './income-actions';

interface IncomeOverviewProps {
  /** Initial page of income records rendered server-side. */
  initialData: {
    content: Income[];
    page: number;
    last: boolean;
  };
  categories: IncomeCategory[];
}

/**
 * Client-side orchestrator for the income list page.
 * Manages accumulated items state (load-more / D-06), filter resets,
 * and dialog open state for edit (D-05) and receive (D-14) flows.
 */
export function IncomeOverview({ initialData, categories }: IncomeOverviewProps) {
  const [items, setItems] = useState<Income[]>(initialData.content);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [isLast, setIsLast] = useState(initialData.last);
  const [isPending, startTransition] = useTransition();

  // Edit dialog state
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  // Receive dialog state
  const [receivingIncome, setReceivingIncome] = useState<Income | null>(null);

  // Filter state from URL (nuqs — survives navigation, shareable link)
  const [search] = useQueryState('search', parseAsString.withDefault(''));
  const [moneyStatus] = useQueryState('moneyStatus', parseAsString.withDefault(''));
  const [from] = useQueryState('from', parseAsString.withDefault(''));
  const [to] = useQueryState('to', parseAsString.withDefault(''));

  /** Total value of all loaded income items (display only — not a server aggregate). */
  const loadedTotal = items.reduce((sum, i) => sum + i.amount, 0);

  /**
   * Called by IncomeFilters whenever a filter changes.
   * Resets the accumulated list; Next.js re-renders the RSC parent with new URL params,
   * which provides a fresh initialData on the next render cycle.
   */
  function handleFilterChange() {
    // Reset accumulator — RSC will re-fetch with the updated URL search params
    setCurrentPage(0);
    setIsLast(false);
    setItems([]);
  }

  /** Append the next page of results (D-06 load-more pattern). */
  function handleLoadMore() {
    startTransition(async () => {
      try {
        const nextPage = currentPage + 1;
        const result = await fetchIncomesAction({
          page: nextPage,
          search: search || undefined,
          moneyStatus: moneyStatus || undefined,
          from: from || undefined,
          to: to || undefined,
        });
        setItems((prev) => [...prev, ...result.content]);
        setCurrentPage(result.page);
        setIsLast(result.last);
      } catch {
        toast.error('Failed to load more income. Please try again.');
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Income</h1>
          {items.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {items.length} record{items.length !== 1 ? 's' : ''} · Total loaded:{' '}
              <span className="font-medium">{formatCurrency(loadedTotal)}</span>
            </p>
          ) : null}
        </div>
        <Button asChild>
          <Link href="/income/new">Add Income</Link>
        </Button>
      </div>

      {/* Filters (URL-persisted, debounced search) */}
      <IncomeFilters onFilterChange={handleFilterChange} />

      {/* Income list */}
      <IncomeList
        items={items}
        onEditRow={(income) => setEditingIncome(income)}
        onReceiveRow={(income) => setReceivingIncome(income)}
      />

      {/* Load more (D-06 — append on demand, NOT numbered pages) */}
      {!isLast && items.length > 0 ? (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleLoadMore} disabled={isPending}>
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}

      {/* Edit income dialog (D-05) */}
      {editingIncome ? (
        <EditIncomeDialog
          income={editingIncome}
          categories={categories}
          open={editingIncome !== null}
          onClose={() => setEditingIncome(null)}
        />
      ) : null}

      {/* Receive income dialog (D-14) */}
      {receivingIncome ? (
        <ReceiveIncomeDialog
          income={receivingIncome}
          open={receivingIncome !== null}
          onClose={() => setReceivingIncome(null)}
        />
      ) : null}
    </div>
  );
}
