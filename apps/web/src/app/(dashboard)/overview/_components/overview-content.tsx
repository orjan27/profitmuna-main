'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { TZDate } from '@date-fns/tz';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { AmountToggle, MaskedAmount, useAmountVisibility } from '@/components/amount-visibility';
import { StellaSprite, type StellaMood } from '@/components/Stella';
import { useRecordSheet } from '@/components/RecordSheetProvider';
import type { BalanceComparison, DashboardSummary, RecentTransaction } from '@/types/dashboard';
import { DateRangeSelect } from '@/components/DateRangeSelect';
import { StellaMessages } from './stella-messages';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverviewContentProps {
  greeting: string;
  /** Full name for the greeting heading — null renders a name-less greeting */
  userName: string | null;
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

// ── Stella's payday countdown ─────────────────────────────────────────────────

/**
 * Calendar days from today (Asia/Manila) to a YYYY-MM-DD date. Pure string →
 * UTC-midnight math so the diff is an exact integer with no DST/tz parsing.
 */
function daysUntilManila(dateStr: string): number {
  const todayStr = format(new TZDate(new Date(), 'Asia/Manila'), 'yyyy-MM-dd');
  const toUtcMidnight = (s: string): number => {
    const [year, month, day] = s.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtcMidnight(dateStr) - toUtcMidnight(todayStr)) / 86_400_000);
}

/** Caption line for the next pending income — mirrors the bell's payday alert. */
function paydayMessage(days: number): string {
  if (days <= 0) return 'Payday is today!';
  if (days === 1) return '1 day until payday.';
  return `${days} days until payday.`;
}

// ── Trend badge ───────────────────────────────────────────────────────────────

/**
 * Percent delta of the current balance vs the previous equal-length period,
 * plus a friendly label ("vs May" when the previous window sits in one month,
 * "vs previous period" otherwise). Null when there's nothing to compare
 * against — a zero previous balance makes any percent meaningless.
 */
function trendFromComparison(
  currentCents: number,
  comparison: BalanceComparison | null
): { deltaPercent: number; label: string } | null {
  if (!comparison || comparison.previousPeriodBalanceCents === 0) return null;

  const prev = comparison.previousPeriodBalanceCents;
  const deltaPercent = Math.round(((currentCents - prev) / Math.abs(prev)) * 100);

  const [year, month] = comparison.prevFrom.split('-').map(Number);
  const sameMonth = comparison.prevFrom.slice(0, 7) === comparison.prevTo.slice(0, 7);
  const label = sameMonth
    ? `vs ${format(new Date(year, month - 1, 1), 'MMM')}`
    : 'vs previous period';

  return { deltaPercent, label };
}

// ── Savings donut ─────────────────────────────────────────────────────────────

interface SavingsDonutProps {
  /** 0–100 share of received income kept as savings */
  ratePercent: number;
}

/** Small SVG ring: savings as a share of received income, percent centered. */
function SavingsDonut({ ratePercent }: SavingsDonutProps): React.JSX.Element {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (circumference * ratePercent) / 100;

  return (
    <div
      role="img"
      aria-label={`Savings rate: ${ratePercent}% of received income`}
      className="relative h-16 w-16 shrink-0"
    >
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="7" className="stroke-paper" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className="stroke-saving"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-saving tabular-nums">
        {ratePercent}%
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Client half of the Overview home (Playful Bento layout). Owns
 * amount-visibility state (shared localStorage key with the Profit First
 * page), the Record sheet hooks, and the feed's Load-more pagination (client
 * useState — never a URL param, Pitfall 5; URL params re-render the RSC and
 * would reset the feed).
 *
 * Layout: greeting + speech bubble → balance hero card (period pill filter) →
 * income/expense card pair → split card → savings/pending pair → recent card.
 */
export function OverviewContent({
  greeting,
  userName,
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
  const receivedCents = summary?.totalIncomeReceivedCents ?? 0;
  const pendingCents = summary?.totalIncomePendingCents ?? 0;

  // Stella's mood is a readout of the period's financial state. Priority:
  // privacy (eyes closed) > trouble (teary) > quiet period (asleep) > healthy.
  // Her expression never carries the meaning alone — the caption does.
  let stellaMood: StellaMood = 'smiling';
  let stellaCaption = "Everything's sorted.";
  if (mounted && !visible) {
    stellaMood = 'happy';
    stellaCaption = "Stella's not looking.";
  } else if (
    walletBalanceCents < 0 ||
    netIncomeCents < 0 ||
    accounts.some((account) => account.computedBalance < 0)
  ) {
    stellaMood = 'sad';
    stellaCaption = 'One of your buckets needs attention.';
  } else if (receivedCents === 0 && (summary?.totalExpensesCents ?? 0) === 0) {
    stellaMood = 'sleeping';
    stellaCaption = "Quiet period. Stella's napping.";
  }

  // Stella's message pool: mood caption first (stable across SSR/hydration),
  // then the payday countdown when a pending income has an upcoming date.
  const stellaMessages: string[] = [stellaCaption];
  if (summary?.nextPendingIncome) {
    stellaMessages.push(
      paydayMessage(daysUntilManila(summary.nextPendingIncome.expectedReleaseDate))
    );
  }

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
        <StellaSprite mood="sleeping" size={64} className="mx-auto" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome to Profitmuna</h1>
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

  const trend = trendFromComparison(walletBalanceCents, summary?.balanceComparison ?? null);
  // Donut share of received income kept as savings — clamped so a negative
  // net or rounding never breaks the ring.
  const savingsRate =
    receivedCents > 0
      ? Math.min(100, Math.max(0, Math.round((netIncomeCents / receivedCents) * 100)))
      : 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <StellaMessages
        mood={stellaMood}
        greeting={greeting}
        userName={userName}
        messages={stellaMessages}
        onAdd={() => openRecordSheet('income')}
      />

      {/* Hero card: where the money stands for the selected period */}
      <section
        aria-label="Available balance"
        className="relative mt-6 rounded-3xl bg-gradient-to-br from-tint-income via-tint-income/60 to-tint-income/20 p-6"
      >
        {/* Decorative star peeking over the corner (mockup) — Stella in the
            greeting carries the meaning; this one is pure ornament. */}
        <StellaSprite
          mood="smiling"
          size={56}
          decorative
          className="absolute -top-5 -right-1 rotate-12"
        />
        <p className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">
          Available balance
        </p>
        <div className="mt-2 flex items-center gap-2">
          <MaskedAmount
            cents={walletBalanceCents}
            visible={visible}
            mounted={mounted}
            className={cn(
              'text-4xl leading-none font-bold tracking-tight tabular-nums',
              walletBalanceCents < 0 && 'text-expense'
            )}
          />
          <AmountToggle visible={visible} toggle={toggle} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {trend ? (
            <span
              className={cn(
                'flex items-center gap-1 rounded-full bg-paper/70 px-3 py-1 text-sm font-semibold tabular-nums',
                trend.deltaPercent >= 0 ? 'text-income' : 'text-expense'
              )}
            >
              {trend.deltaPercent >= 0 ? (
                <TrendingUp aria-hidden="true" className="h-4 w-4" />
              ) : (
                <TrendingDown aria-hidden="true" className="h-4 w-4" />
              )}
              {trend.deltaPercent >= 0 ? '+' : ''}
              {trend.deltaPercent}% {trend.label}
            </span>
          ) : null}
          {/* D-02: the wallet balance is period-scoped — the pill names the
              period AND opens the preset picker (one date filter governs
              every figure and the feed, D-07/D-08). */}
          <DateRangeSelect />
        </div>
      </section>

      {/* Income / Expenses pair — each card navigates to its ledger */}
      <section aria-label="Period totals" className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
        <Link
          href="/income"
          className="rounded-3xl bg-tint-income p-5 transition-opacity hover:opacity-90"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-paper">
            <ArrowDownLeft aria-hidden="true" className="h-5 w-5 text-income" />
          </span>
          <p className="mt-5 text-sm font-medium text-ink-soft">Income</p>
          <MaskedAmount
            cents={receivedCents}
            visible={visible}
            mounted={mounted}
            className="mt-1 block text-2xl leading-tight font-bold tabular-nums"
          />
          <p className="mt-0.5 text-xs text-ink-faint">Received</p>
        </Link>
        <Link
          href="/expenses"
          className="rounded-3xl bg-tint-expense p-5 transition-opacity hover:opacity-90"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-paper">
            <ArrowUpRight aria-hidden="true" className="h-5 w-5 text-expense" />
          </span>
          <p className="mt-5 text-sm font-medium text-ink-soft">Expenses</p>
          <MaskedAmount
            cents={summary?.totalExpensesCents ?? 0}
            visible={visible}
            mounted={mounted}
            className="mt-1 block text-2xl leading-tight font-bold tabular-nums"
          />
          <p className="mt-0.5 text-xs text-ink-faint">Recorded</p>
        </Link>
      </section>

      {/* The split at a glance — percentages AND per-account balances (D-01) */}
      {accounts.length > 0 ? (
        <section
          aria-labelledby="overview-split-heading"
          className="mt-3 rounded-3xl bg-card p-5 sm:mt-4 sm:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="overview-split-heading" className="text-base font-bold">
              Your split
            </h2>
            <Link
              href="/profit-first"
              className="rounded-full bg-tint-income px-3 py-1 text-xs font-semibold text-income transition-opacity hover:opacity-80"
            >
              Profit First
            </Link>
          </div>
          <div
            role="img"
            aria-label={`Allocation split: ${accounts
              .map((a) => `${a.name} ${a.targetPercentage}%`)
              .join(', ')}`}
            className="mt-4"
          >
            <div className="animate-fill motion-reduce:animate-none flex h-3.5 w-full origin-left gap-1.5">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="h-full rounded-full"
                  style={{ width: `${account.targetPercentage}%`, backgroundColor: account.color }}
                  title={`${account.name} · ${account.targetPercentage}%`}
                />
              ))}
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: account.color }}
                />
                <span className="font-medium">{account.name}</span>
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

      {/* Savings / Pending pair */}
      <section
        aria-label="Savings and pending income"
        className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4"
      >
        <div className="rounded-3xl bg-tint-saving p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <SavingsDonut ratePercent={savingsRate} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
                <Target aria-hidden="true" className="h-4 w-4" />
                Savings
              </p>
              <MaskedAmount
                cents={netIncomeCents}
                visible={visible}
                mounted={mounted}
                className={cn(
                  'mt-1 block text-xl leading-tight font-bold tabular-nums',
                  netIncomeCents < 0 && 'text-expense'
                )}
              />
              <p className="mt-0.5 text-xs text-ink-faint">of income received</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl bg-card p-5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
            <Clock aria-hidden="true" className="h-4 w-4" />
            Pending
          </p>
          <MaskedAmount
            cents={pendingCents}
            visible={visible}
            mounted={mounted}
            className="mt-2 block text-2xl leading-tight font-bold tabular-nums"
          />
          {pendingCents === 0 ? (
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-income">
              <Check aria-hidden="true" className="h-4 w-4" />
              All received
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-faint">
              {summary?.nextPendingIncome
                ? paydayMessage(daysUntilManila(summary.nextPendingIncome.expectedReleaseDate))
                : 'Awaiting receipt'}
            </p>
          )}
        </div>
      </section>

      {/* Recent movement — unified feed: income + expenses + wallet activity (D-03) */}
      <section
        aria-labelledby="overview-recent-heading"
        className="mt-3 rounded-3xl bg-card p-5 sm:mt-4 sm:p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="overview-recent-heading" className="text-base font-bold">
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
                    className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3.5 transition-colors hover:bg-muted/60"
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
          // No CTA here: the greeting bubble's Add button is the page's one
          // primary action, right above.
          <p className="py-12 text-center text-sm text-ink-soft">
            Nothing recorded in this period.
          </p>
        )}
      </section>
    </div>
  );
}
