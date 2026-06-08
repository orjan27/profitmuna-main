'use client';

import { useState, useTransition, useEffect } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { MoreHorizontal, Plus, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

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
import { PeriodControl } from '@/components/PeriodControl';
import { StellaSprite } from '@/components/Stella';
import { monthShortLabel, type LedgerPeriodKey } from '@/lib/ledger-period';
import { nextDueDate } from '@/lib/recurrence';
import { formatDate } from '@/lib/format-date';
import type { Income, IncomeCategory } from '@/types/income';
import type { RecurringIncome } from '@/types/recurring';
import type { LedgerStats } from '@/types/stats';
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
  /** Recurring income templates for the "Recurring" section + monthly stat. */
  recurring: RecurringIncome[];
  /** Aggregate figures for the stat band and charts. */
  stats: LedgerStats;
  /** Resolved period key (drives the period caption + the best-month star). */
  periodKey: LedgerPeriodKey;
  /** Resolved period bounds — keep load-more scoped to the same window. */
  from?: string;
  to?: string;
  /** Asia/Manila-resolved date keys for the monthly bar series. */
  statsDate: { year: string; month: string; prevMonth: string };
}

const PERIOD_CAPTION: Record<LedgerPeriodKey, string> = {
  '30d': 'last 30 days',
  month: 'this month',
  year: 'this year',
  all: 'all time',
};

/** Monthly-equivalent contribution of a recurring template (null amount = skip). */
function monthlyEquivalent(template: RecurringIncome): number {
  if (template.amount === null || !template.active) return 0;
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

/**
 * Build the monthly bar series for the current year: Jan through the current
 * month, zero-filled, with the current month flagged for the money tone.
 */
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
 * Client orchestrator for the income ledger. Mobile keeps a lean hero (the
 * in-view total + records); the web view (md+) adds the period control, a
 * three-tile stat band, and the monthly / by-source charts. Recording goes
 * through the global Record sheet; the FAB carries it on mobile.
 */
export function IncomeOverview({
  initialData,
  categories,
  recurring,
  stats,
  periodKey,
  from,
  to,
  statsDate,
}: IncomeOverviewProps): React.JSX.Element {
  const { openRecordSheet } = useRecordSheet();
  const formatCurrency = useFormatCurrency();
  const { visible, toggle, mounted } = useAmountVisibility();

  const [items, setItems] = useState<Income[]>(initialData.content);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [isLast, setIsLast] = useState(initialData.last);
  const [isPending, startTransition] = useTransition();

  // Re-sync the accumulator when the RSC re-fetches (record sheet → refresh).
  useEffect(() => {
    setItems(initialData.content);
    setCurrentPage(initialData.page);
    setIsLast(initialData.last);
  }, [initialData]);

  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [receivingIncome, setReceivingIncome] = useState<Income | null>(null);

  // Secondary filters (search + status) live behind the Filter toggle; the
  // primary time scope is the PeriodControl (URL `period`).
  const [search] = useQueryState('search', parseAsString.withDefault(''));
  const [moneyStatus] = useQueryState('moneyStatus', parseAsString.withDefault(''));

  const activeFilterCount = [search, moneyStatus].filter(Boolean).length;
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  /** Reset the accumulator on filter change; the RSC re-fetches page 0. */
  function handleFilterChange(): void {
    setCurrentPage(0);
    setIsLast(false);
    setItems([]);
  }

  function handleLoadMore(): void {
    startTransition(async () => {
      try {
        const nextPage = currentPage + 1;
        const result = await fetchIncomesAction({
          page: nextPage,
          search: search || undefined,
          moneyStatus: moneyStatus || undefined,
          from,
          to,
        });
        setItems((prev) => [...prev, ...result.content]);
        setCurrentPage(result.page);
        setIsLast(result.last);
      } catch {
        toast.error('Failed to load more income. Please try again.');
      }
    });
  }

  // ── Derived stat figures ────────────────────────────────────────────────
  const recordCount = stats.period.count;
  const periodCaption = PERIOD_CAPTION[periodKey];

  // Best-month star: only when viewing the current month and it's the highest
  // single calendar month on record (truthful — never on multi-month views).
  const isBestMonth =
    periodKey === 'month' &&
    stats.thisMonthTotal > 0 &&
    stats.bestMonth !== null &&
    stats.thisMonthTotal >= stats.bestMonth.total;

  // Month-over-month delta for the "This month" tile.
  const prevTotal = stats.prevMonthTotal;
  const monthDelta =
    prevTotal > 0 ? Math.round(((stats.thisMonthTotal - prevTotal) / prevTotal) * 100) : null;
  const prevMonthLabel = monthShortLabel(statsDate.prevMonth);

  // Recurring monthly equivalent + the top contributor's next occurrence.
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
        <h1 className="text-[22px] leading-tight font-semibold">Income</h1>
        <div className="flex items-center gap-1.5">
          <PeriodControl className="max-md:hidden" />
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
          <Button size="sm" className="max-md:hidden" onClick={() => openRecordSheet('income')}>
            <Plus aria-hidden="true" />
            Record income
          </Button>
        </div>
      </div>

      {/* Time scope — full-width segmented row on mobile (the header copy is
          md+ only); the stat band and charts below render on every size. */}
      <PeriodControl className="flex w-full justify-between overflow-x-auto md:hidden" />

      {/* Stat band — total spans full width on mobile, then the pair; three
          across on the web view. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatTile
          className="col-span-2 md:col-span-1"
          label={
            <>
              Total in view
              {isBestMonth ? <StellaSprite mood="smiling" size={18} decorative /> : null}
            </>
          }
          caption={
            <>
              across {recordCount} record{recordCount !== 1 ? 's' : ''} ·{' '}
              {isBestMonth ? 'all-time best month' : periodCaption}
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
                    monthDelta >= 0 ? 'text-income' : 'text-expense'
                  )}
                >
                  {monthDelta >= 0 ? (
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
              'First month with income'
            ) : (
              'Nothing yet this month'
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
        <section aria-labelledby="income-monthly-heading" className="rounded-3xl bg-card p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="income-monthly-heading" className="text-base font-semibold">
              Monthly income
            </h2>
            <span className="text-xs text-ink-faint">{statsDate.year} · by month</span>
          </div>
          <div className="mt-6">
            <MonthlyBars data={monthlyBars} tone="income" formatCurrency={formatCurrency} />
          </div>
        </section>

        <section aria-labelledby="income-source-heading" className="rounded-3xl bg-card p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="income-source-heading" className="text-base font-semibold">
              Income by source
            </h2>
            <span className="text-xs text-ink-faint">{periodCaption}</span>
          </div>
          <div className="mt-5">
            {stats.bySource.length > 0 ? (
              <SourceBreakdown
                data={stats.bySource}
                tone="income"
                total={stats.period.total}
                unitLabel="income"
                formatCurrency={formatCurrency}
              />
            ) : (
              <p className="py-6 text-center text-sm text-ink-faint">No income in this period.</p>
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

      {/* Secondary filters (search + status) — collapsed by default */}
      {filtersOpen ? <IncomeFilters onFilterChange={handleFilterChange} /> : null}

      {/* Records */}
      <section aria-label="Records" className="mt-1 flex flex-col gap-5">
        <h2 className="text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase max-md:sr-only">
          Records
        </h2>

        {/* Recurring templates — renders nothing when the user has none */}
        <RecurringIncomeList templates={recurring} categories={categories} />

        <IncomeList
          items={items}
          filtered={activeFilterCount > 0}
          onEditRow={(income) => setEditingIncome(income)}
          onReceiveRow={(income) => setReceivingIncome(income)}
        />
      </section>

      {/* Load more (D-06 — append on demand) */}
      {!isLast && items.length > 0 ? (
        <div className="flex justify-center pt-1">
          <Button variant="ghost" onClick={handleLoadMore} disabled={isPending}>
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}

      {editingIncome ? (
        <EditIncomeDialog
          income={editingIncome}
          categories={categories}
          open={editingIncome !== null}
          onClose={() => setEditingIncome(null)}
        />
      ) : null}

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
