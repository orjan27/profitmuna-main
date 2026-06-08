'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { MoreHorizontal, Plus, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRecordSheet } from '@/components/RecordSheetProvider';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import { AmountToggle, MaskedAmount, useAmountVisibility } from '@/components/amount-visibility';
import { StatTile } from '@/components/StatTile';
import { MonthlyBars, type MonthlyBarDatum } from '@/components/MonthlyBars';
import { SourceBreakdown } from '@/components/SourceBreakdown';
import { DateRangeSelect } from '@/components/DateRangeSelect';
import { monthShortLabel } from '@/lib/ledger-period';
import type { PresetLabel } from '@/lib/overview-date-presets';
import { nextDueDate } from '@/lib/recurrence';
import { formatDate } from '@/lib/format-date';
import type { RecurringExpense } from '@/types/recurring';
import type { LedgerStats } from '@/types/stats';
import { fetchExpensesAction } from './expense-actions';
import { ExpenseList } from './expense-list';
import type { ExpenseRow } from './edit-expense-dialog';
import { ManageCategoriesDialog } from './manage-categories-dialog';
import { RecurringExpenseList } from './recurring-list';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}

interface WalletOption {
  id: number;
  name: string;
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
  wallets: WalletOption[];
  defaultWalletId: number | null;
  /** Recurring expense templates for the "Recurring" section + monthly stat. */
  recurring: RecurringExpense[];
  /** Aggregate figures for the stat band and charts. */
  stats: LedgerStats;
  /** Resolved preset label (drives the period caption). */
  periodLabel: PresetLabel;
  /** Resolved period bounds — keep load-more / refresh scoped to the window. */
  from?: string;
  to?: string;
  /** Asia/Manila-resolved date keys for the monthly bar series. */
  statsDate: { year: string; month: string; prevMonth: string };
}

const PAGE_LIMIT = 20;

const PERIOD_CAPTION: Record<PresetLabel, string> = {
  'This Month': 'this month',
  'Last Month': 'last month',
  'Last 3 Months': 'last 3 months',
  'This Year': 'this year',
  'All Time': 'all time',
  Custom: 'selected range',
};

/** Monthly-equivalent contribution of a recurring expense template. */
function monthlyEquivalent(template: RecurringExpense): number {
  if (!template.active) return 0;
  switch (template.frequency) {
    case 'WEEKLY':
      return template.amount * 4;
    case 'BIWEEKLY':
      return template.amount * 2;
    case 'MONTHLY':
      return template.amount;
    default:
      return 0;
  }
}

/** Jan → current month, zero-filled, current month flagged for the money tone. */
function buildMonthlyBars(stats: LedgerStats, year: string, month: string): MonthlyBarDatum[] {
  const currentMonthNum = Number(month.slice(5, 7));
  const byYm = new Map(stats.monthly.map((m) => [m.ym, m.total]));
  const bars: MonthlyBarDatum[] = [];
  for (let m = 1; m <= currentMonthNum; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`;
    bars.push({
      label: monthShortLabel(ym),
      total: byYm.get(ym) ?? 0,
      current: m === currentMonthNum,
    });
  }
  return bars;
}

/**
 * Client shell for the expense ledger. Mobile keeps a lean hero (the in-view
 * total + records); the web view (md+) adds the period control, a three-tile
 * stat band, and the monthly / by-source charts. Recording goes through the
 * global Record sheet; the FAB carries it on mobile.
 *
 * The header total sums ACTIVE (non-deleted) amounts via the stats aggregate.
 */
export function ExpensesOverview({
  initialData,
  categories,
  wallets,
  defaultWalletId,
  recurring,
  stats,
  periodLabel,
  from,
  to,
  statsDate,
}: ExpensesOverviewProps): React.JSX.Element {
  const { openRecordSheet } = useRecordSheet();
  const formatCurrency = useFormatCurrency();
  const { visible, toggle, mounted } = useAmountVisibility();

  const [expenses, setExpenses] = useState<ExpenseRow[]>(initialData.content);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [isLast, setIsLast] = useState(initialData.last);
  const [isLoadingMore, startLoadMoreTransition] = useTransition();

  // Re-sync the accumulator when the RSC re-fetches (record sheet → refresh).
  useEffect(() => {
    setExpenses(initialData.content);
    setCurrentPage(initialData.page);
    setIsLast(initialData.last);
  }, [initialData]);

  const [categoriesOpen, setCategoriesOpen] = useState(false);

  function handleLoadMore(): void {
    startLoadMoreTransition(async () => {
      const nextPage = currentPage + 1;
      const data = await fetchExpensesAction({ page: nextPage, limit: PAGE_LIMIT, from, to });
      setExpenses((prev) => [...prev, ...data.content]);
      setCurrentPage(data.page);
      setIsLast(data.last);
    });
  }

  // After a mutation (edit/delete/restore) re-fetch page 0 within the period.
  const handleMutated = useCallback(() => {
    startLoadMoreTransition(async () => {
      const data = await fetchExpensesAction({ page: 0, limit: PAGE_LIMIT, from, to });
      setExpenses(data.content);
      setCurrentPage(data.page);
      setIsLast(data.last);
    });
  }, [from, to]);

  // ── Derived stat figures ────────────────────────────────────────────────
  const recordCount = stats.period.count;
  const periodCaption = PERIOD_CAPTION[periodLabel];

  // Month-over-month delta. For spending, up reads as expense (red) and down as
  // income (green) — less spending is the good direction.
  const prevTotal = stats.prevMonthTotal;
  const monthDelta =
    prevTotal > 0 ? Math.round(((stats.thisMonthTotal - prevTotal) / prevTotal) * 100) : null;
  const prevMonthLabel = monthShortLabel(statsDate.prevMonth);

  const activeRecurring = recurring.filter((r) => r.active);
  const recurringMonthly = activeRecurring.reduce((sum, r) => sum + monthlyEquivalent(r), 0);
  const topRecurring = activeRecurring
    .slice()
    .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))[0];

  const monthlyBars = buildMonthlyBars(stats, statsDate.year, statsDate.month);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] leading-tight font-semibold">Expenses</h1>
        <div className="flex items-center gap-1.5">
          <DateRangeSelect />
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
          <Button size="sm" className="max-md:hidden" onClick={() => openRecordSheet('expense')}>
            <Plus aria-hidden="true" />
            Record expense
          </Button>
        </div>
      </div>

      {/* Stat band — total spans full width on mobile, then the pair; three
          across on the web view. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatTile
          className="col-span-2 md:col-span-1"
          label="Total in view"
          caption={
            <>
              spent across {recordCount} record{recordCount !== 1 ? 's' : ''} · {periodCaption}
            </>
          }
        >
          <div className="flex items-center gap-2">
            <MaskedAmount
              cents={stats.period.total}
              visible={visible}
              mounted={mounted}
              className="text-[30px] leading-none font-semibold tracking-tight tabular-nums sm:text-[32px]"
            />
            <AmountToggle visible={visible} toggle={toggle} />
          </div>
        </StatTile>

        <StatTile
          label="This month"
          caption={
            monthDelta !== null ? (
              <span className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 font-semibold tabular-nums',
                    monthDelta > 0 ? 'text-expense' : 'text-income'
                  )}
                >
                  {monthDelta > 0 ? (
                    <TrendingUp aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <TrendingDown aria-hidden="true" className="h-4 w-4" />
                  )}
                  {monthDelta >= 0 ? '+' : ''}
                  {monthDelta}%
                </span>
                <span>
                  vs {formatCurrency(prevTotal)} in {prevMonthLabel}
                </span>
              </span>
            ) : stats.thisMonthTotal > 0 ? (
              'First month with spending'
            ) : (
              'Nothing spent this month'
            )
          }
        >
          <MaskedAmount
            cents={stats.thisMonthTotal}
            visible={visible}
            mounted={mounted}
            className="text-[22px] leading-none font-semibold tracking-tight tabular-nums sm:text-[28px]"
          />
        </StatTile>

        <StatTile
          label="Recurring / month"
          caption={
            topRecurring
              ? `${topRecurring.categoryName} · next ${formatDate(nextDueDate(topRecurring))}`
              : 'None set up'
          }
        >
          <MaskedAmount
            cents={recurringMonthly}
            visible={visible}
            mounted={mounted}
            className="text-[22px] leading-none font-semibold tracking-tight tabular-nums sm:text-[28px]"
          />
        </StatTile>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section aria-labelledby="expense-monthly-heading" className="rounded-3xl bg-card p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="expense-monthly-heading" className="text-base font-semibold">
              Monthly spending
            </h2>
            <span className="text-xs text-ink-faint">{statsDate.year} · by month</span>
          </div>
          <div className="mt-6">
            <MonthlyBars data={monthlyBars} tone="expense" formatCurrency={formatCurrency} />
          </div>
        </section>

        <section aria-labelledby="expense-source-heading" className="rounded-3xl bg-card p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="expense-source-heading" className="text-base font-semibold">
              Spending by category
            </h2>
            <span className="text-xs text-ink-faint">{periodCaption}</span>
          </div>
          <div className="mt-5">
            {stats.bySource.length > 0 ? (
              <SourceBreakdown
                data={stats.bySource}
                tone="expense"
                total={stats.period.total}
                unitLabel="spending"
                formatCurrency={formatCurrency}
              />
            ) : (
              <p className="py-6 text-center text-sm text-ink-faint">No spending in this period.</p>
            )}
          </div>
        </section>
      </div>

      {/* Manage categories dialog — opened from the overflow menu */}
      <ManageCategoriesDialog
        categories={categories}
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
      />

      {/* Records */}
      <section aria-label="Records" className="mt-1 flex flex-col gap-5">
        <h2 className="text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase max-md:sr-only">
          Records
        </h2>

        {/* Recurring templates — renders nothing when the user has none */}
        <RecurringExpenseList templates={recurring} categories={categories} wallets={wallets} />

        <ExpenseList
          expenses={expenses}
          filtered={false}
          categories={categories}
          wallets={wallets}
          defaultWalletId={defaultWalletId}
          onMutated={handleMutated}
        />
      </section>

      {/* Load more (D-06 — append-on-demand) */}
      {!isLast && expenses.length > 0 ? (
        <div className="flex justify-center pt-1">
          <Button variant="ghost" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
