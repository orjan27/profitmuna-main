'use client';

import { useState, useTransition, useEffect } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { MoreHorizontal, Plus, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRecordSheet } from '@/components/RecordSheetProvider';
import type { Income, IncomeCategory } from '@/types/income';
import type { RecurringIncome } from '@/types/recurring';
import { AmountToggle, MaskedAmount, useAmountVisibility } from '@/components/amount-visibility';
import { IncomeFilters } from './income-filters';
import { IncomeList } from './income-list';
import { EditIncomeDialog } from './edit-income-dialog';
import { ReceiveIncomeDialog } from './receive-income-dialog';
import { RecurringIncomeList } from './recurring-list';
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
  /** Recurring income templates for the "Recurring" section */
  recurring: RecurringIncome[];
}

/**
 * Client-side orchestrator for the income ledger page.
 * Manages accumulated items state (load-more / D-06), the collapsed filter
 * row, and dialog open state for edit (D-05) and receive (D-14) flows.
 * Recording goes through the global Record sheet.
 */
export function IncomeOverview({ initialData, categories, recurring }: IncomeOverviewProps) {
  const { openRecordSheet } = useRecordSheet();
  // Shared visibility state (same localStorage key as Overview/Profit First)
  const { visible, toggle, mounted } = useAmountVisibility();

  const [items, setItems] = useState<Income[]>(initialData.content);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [isLast, setIsLast] = useState(initialData.last);
  const [isPending, startTransition] = useTransition();

  // Re-sync accumulator when the RSC parent re-fetches after router.refresh()
  // (e.g. after a create via the Record sheet). useState ignores prop changes
  // after initial mount, so an effect is needed to pick up the new initialData.
  useEffect(() => {
    setItems(initialData.content);
    setCurrentPage(initialData.page);
    setIsLast(initialData.last);
  }, [initialData]);

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
  // Manage categories lives in the header's overflow menu (controlled dialog)
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // One primary action per view: when the ledger is truly empty (no records,
  // no filters narrowing things), the empty state's CTA is the only action —
  // header controls would be three buttons doing the same job.
  const showHeaderControls = items.length > 0 || activeFilterCount > 0;

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
            <>
              {/* Same display scale as the Overview hero — money reads at one
                  size across pages, eye toggle anchored to the total it masks */}
              <div className="mt-3 flex items-center gap-2">
                <MaskedAmount
                  cents={loadedTotal}
                  visible={visible}
                  mounted={mounted}
                  className="text-[34px] leading-none font-semibold tracking-tight tabular-nums"
                />
                <AmountToggle visible={visible} toggle={toggle} />
              </div>
              <p className="mt-1.5 text-sm text-ink-faint">
                across {items.length} record{items.length !== 1 ? 's' : ''} in view
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
            <Button size="sm" className="max-md:hidden" onClick={() => openRecordSheet('income')}>
              <Plus aria-hidden="true" />
              Record income
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

      {/* Filters (URL-persisted, debounced search) — collapsed by default */}
      {filtersOpen ? <IncomeFilters onFilterChange={handleFilterChange} /> : null}

      {/* Recurring templates — renders nothing when the user has none */}
      <RecurringIncomeList templates={recurring} categories={categories} />

      {/* Income ledger */}
      <IncomeList
        items={items}
        filtered={activeFilterCount > 0}
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
