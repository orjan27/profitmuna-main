'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { AmountToggle, MaskedAmount, useAmountVisibility } from '@/components/amount-visibility';
import { useRecordSheet } from '@/components/RecordSheetProvider';
import { PfAllocationBar } from '@/app/(dashboard)/profit-first/_components/pf-allocation-bar';
import type { DashboardSummary, RecentTransaction } from '@/types/dashboard';
import { OverviewFilters } from './overview-filters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverviewContentProps {
  greeting: string;
  /** null = summary fetch failed — render zeroed figures (D-12) */
  summary: DashboardSummary | null;
  /** Resolved period bounds; both undefined = All Time */
  from?: string;
  to?: string;
  /** True when the user explicitly chose a period via the URL (first-run guard) */
  hasUrlFilter: boolean;
}

// ── Feed row presentation ─────────────────────────────────────────────────────

const KIND_LABELS: Record<RecentTransaction['kind'], string> = {
  income: 'Income',
  expense: 'Expense',
  wallet_deposit: 'Deposit',
  wallet_withdrawal: 'Withdrawal',
};

/** Money flowing in (income, deposits) reads green with a +; out reads red with a −. */
function isInflow(kind: RecentTransaction['kind']): boolean {
  return kind === 'income' || kind === 'wallet_deposit';
}

// ── Stat figures ──────────────────────────────────────────────────────────────

interface StatFigure {
  label: string;
  subLabel: string;
  cents: number;
  /** Apply the negative tone when the value dips below zero (Net Income) */
  negativeAware?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Client half of the Overview home. Owns amount-visibility state (shared
 * localStorage key with the Profit First page), the Record sheet hooks, and
 * the feed's Load-more pagination (client useState — never a URL param,
 * Pitfall 5; URL params re-render the RSC and would reset the feed).
 *
 * Layout is whitespace and type scale, no cards: greeting → hero balance →
 * period filter → stat figures → split bar with legend → recent ledger.
 */
export function OverviewContent({
  greeting,
  summary,
  from,
  to,
  hasUrlFilter,
}: OverviewContentProps): React.JSX.Element {
  const { visible, toggle, mounted } = useAmountVisibility();
  const { openRecordSheet } = useRecordSheet();

  // Feed pagination state — initialized from the server-rendered first page.
  // page.tsx keys this component by period, so state resets on filter change.
  const [feedItems, setFeedItems] = useState<RecentTransaction[]>(
    summary?.recentTransactions ?? []
  );
  const [hasMore, setHasMore] = useState(summary?.feedPagination.hasMore ?? false);
  const [feedPage, setFeedPage] = useState(summary?.feedPagination.page ?? 0);
  const [loadingMore, setLoadingMore] = useState(false);

  const accounts = summary?.profitFirstAccounts ?? [];
  const walletBalanceCents = summary?.totalWalletBalanceCents ?? 0;
  const netIncomeCents = summary?.netIncomeCents ?? 0;

  // First-run welcome: the default period is effectively empty and the user
  // hasn't filtered. PF accounts are seeded at registration, so account count
  // can't distinguish a new user — the figures and feed do.
  const isFirstRun =
    !hasUrlFilter &&
    summary !== null &&
    summary.totalIncomeReceivedCents === 0 &&
    summary.totalIncomePendingCents === 0 &&
    summary.totalExpensesCents === 0 &&
    summary.totalWalletBalanceCents === 0 &&
    summary.totalIncome === 0 &&
    feedItems.length === 0 &&
    accounts.every((account) => account.computedBalance === 0);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      qs.set('feedPage', String(feedPage + 1));
      qs.set('feedSize', '20');
      // Same-origin BFF proxy — forwards the httpOnly session server-side
      const res = await fetch(`/api/dashboard/summary?${qs.toString()}`);
      if (!res.ok) {
        toast.error('Could not load more transactions. Please try again.');
        return;
      }
      const json = (await res.json()) as { data: DashboardSummary };
      setFeedItems((prev) => [...prev, ...json.data.recentTransactions]);
      setHasMore(json.data.feedPagination.hasMore);
      setFeedPage((page) => page + 1);
    } catch {
      toast.error('Could not load more transactions. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (isFirstRun) {
    return (
      <div className="mx-auto max-w-3xl py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Profitmuna</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
          Record income and it splits across your buckets automatically. You always know exactly how
          much belongs where.
        </p>
        <Button className="mt-8" onClick={() => openRecordSheet('income')}>
          <Plus aria-hidden="true" />
          Record your first income
        </Button>
      </div>
    );
  }

  const figures: StatFigure[] = [
    {
      label: 'Total Income',
      subLabel: 'Received this period',
      cents: summary?.totalIncomeReceivedCents ?? 0,
    },
    {
      label: 'Pending Income',
      subLabel: 'Awaiting receipt',
      cents: summary?.totalIncomePendingCents ?? 0,
    },
    {
      label: 'Total Expenses',
      subLabel: 'Recorded this period',
      cents: summary?.totalExpensesCents ?? 0,
    },
    {
      label: 'Net Income',
      subLabel: 'Income minus expenses',
      cents: netIncomeCents,
      negativeAware: true,
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      {/* Hero: where the money stands for the selected period. The page's one
          primary action sits beside it — recording income is the app's core
          job, and the nav carries no record button (one primary per view). */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="text-sm text-ink-faint">{greeting}</p>
          <div className="mt-3 flex items-center gap-2">
            <MaskedAmount
              cents={walletBalanceCents}
              visible={visible}
              mounted={mounted}
              className={cn(
                'text-[34px] leading-none font-semibold tracking-tight tabular-nums',
                walletBalanceCents < 0 && 'text-expense'
              )}
            />
            <AmountToggle visible={visible} toggle={toggle} />
          </div>
          {/* D-02: the wallet balance is period-scoped — say so explicitly */}
          <p className="mt-1.5 text-sm text-ink-faint">
            {from && to ? `Period total · ${from} – ${to}` : 'All-time total across wallets'}
          </p>
        </div>

        {/* Hidden on mobile: RecordFab is the record affordance there. */}
        <Button className="shrink-0 max-md:hidden" onClick={() => openRecordSheet('income')}>
          <Plus aria-hidden="true" />
          Record income
        </Button>
      </header>

      {/* One date filter governs every figure and the feed (D-07, D-08) */}
      <div className="mt-8">
        <OverviewFilters />
      </div>

      {/* Stat figures (D-01) — quiet label + amount stacks, no cards */}
      <section className="mt-10" aria-label="Period totals">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {figures.map((figure) => (
            <div key={figure.label}>
              <dt className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
                {figure.label}
              </dt>
              <dd className="mt-1.5">
                <MaskedAmount
                  cents={figure.cents}
                  visible={visible}
                  mounted={mounted}
                  className={cn(
                    'text-lg leading-tight font-semibold tabular-nums',
                    figure.negativeAware && figure.cents < 0 && 'text-expense'
                  )}
                />
                <p className="mt-0.5 text-xs text-ink-faint">{figure.subLabel}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* The split at a glance — percentages AND per-account balances (D-01) */}
      {accounts.length > 0 ? (
        <section className="mt-14" aria-labelledby="overview-split-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="overview-split-heading"
              className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase"
            >
              Your split
            </h2>
            <Link
              href="/profit-first"
              className="text-sm text-ink-faint transition-colors hover:text-ink"
            >
              Profit First
            </Link>
          </div>
          <div className="mt-4">
            <PfAllocationBar accounts={accounts} />
          </div>
          <ul className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center gap-2 text-xs text-ink-soft">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: account.color }}
                />
                {account.name}
                <span className="text-ink-faint tabular-nums">{account.targetPercentage}%</span>
                <MaskedAmount
                  cents={account.computedBalance}
                  visible={visible}
                  mounted={mounted}
                  className="text-ink-soft tabular-nums"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recent movement — unified feed: income + expenses + wallet activity (D-03) */}
      <section className="mt-14" aria-labelledby="overview-recent-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="overview-recent-heading"
            className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase"
          >
            Recent
          </h2>
          <div className="flex items-center gap-4">
            <Link
              href="/income"
              className="text-sm text-ink-faint transition-colors hover:text-ink"
            >
              Income
            </Link>
            <Link
              href="/expenses"
              className="text-sm text-ink-faint transition-colors hover:text-ink"
            >
              Expenses
            </Link>
          </div>
        </div>

        {feedItems.length > 0 ? (
          <>
            <ul className="mt-2 divide-y divide-hairline/60">
              {feedItems.map((tx) => (
                <li key={`${tx.kind}-${tx.id}`}>
                  {/* D-05: every row navigates to its ledger or wallet */}
                  <Link
                    href={tx.href}
                    className="-mx-2 flex items-center gap-4 rounded-md px-2 py-3.5 transition-colors hover:bg-paper-deep/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tx.label}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {formatDate(tx.date)} · {KIND_LABELS[tx.kind]}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'flex shrink-0 items-center gap-0.5 text-sm font-semibold tabular-nums',
                        isInflow(tx.kind) ? 'text-income' : 'text-expense'
                      )}
                    >
                      {isInflow(tx.kind) ? '+' : '−'}
                      <MaskedAmount cents={tx.amountCents} visible={visible} mounted={mounted} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* D-04: client-side pagination through the BFF proxy */}
            {hasMore ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => void handleLoadMore()}
                  className="text-ink-soft"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          // No CTA here: the hero's Record income button is the page's one
          // primary action, right above.
          <p className="py-12 text-center text-sm text-ink-soft">
            Nothing recorded in this period.
          </p>
        )}
      </section>
    </div>
  );
}
