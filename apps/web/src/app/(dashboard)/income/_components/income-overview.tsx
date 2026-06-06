'use client';

import { useState, useTransition } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useRecordSheet } from '@/components/RecordSheetProvider';
import type { Income, IncomeCategory } from '@/types/income';
import { formatCurrency } from '@/lib/format-currency';
import { IncomeFilters } from './income-filters';
import { IncomeList } from './income-list';
import { EditIncomeDialog } from './edit-income-dialog';
import { ReceiveIncomeDialog } from './receive-income-dialog';
import { fetchIncomesAction } from './income-actions';
import { ManageCategoriesDialog } from './manage-categories-dialog';

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
 * Client-side orchestrator for the income ledger page.
 * Manages accumulated items state (load-more / D-06), the collapsed filter
 * row, and dialog open state for edit (D-05) and receive (D-14) flows.
 * Recording goes through the global Record sheet.
 */
export function IncomeOverview({ initialData, categories }: IncomeOverviewProps) {
  const { openRecordSheet } = useRecordSheet();

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

  const activeFilterCount = [search, moneyStatus, from, to].filter(Boolean).length;
  // Filters stay collapsed until asked for — but a shared/refreshed URL with
  // filters applied opens them so the state is visible.
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);

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
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] leading-tight font-semibold">Income</h1>
          {items.length > 0 ? (
            <p className="mt-1 text-sm text-ink-faint">
              <span className="font-medium text-ink-soft tabular-nums">
                {formatCurrency(loadedTotal)}
              </span>{' '}
              across {items.length} record{items.length !== 1 ? 's' : ''} in view
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <ManageCategoriesDialog categories={categories} />
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
          <Button size="sm" onClick={() => openRecordSheet('income')}>
            <Plus aria-hidden="true" />
            Record income
          </Button>
        </div>
      </div>

      {/* Filters (URL-persisted, debounced search) — collapsed by default */}
      {filtersOpen ? <IncomeFilters onFilterChange={handleFilterChange} /> : null}

      {/* Income ledger */}
      <IncomeList
        items={items}
        onEditRow={(income) => setEditingIncome(income)}
        onReceiveRow={(income) => setReceivingIncome(income)}
      />

      {/* Load more (D-06 — append on demand, NOT numbered pages) */}
      {!isLast && items.length > 0 ? (
        <div className="flex justify-center pt-2">
          <Button variant="ghost" onClick={handleLoadMore} disabled={isPending}>
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
