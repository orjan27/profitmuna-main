'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { AmountToggle, MaskedAmount, useAmountVisibility } from '@/components/amount-visibility';
import { useRecordSheet } from '@/components/RecordSheetProvider';
import { PfAllocationBar } from '@/app/(dashboard)/profit-first/_components/pf-allocation-bar';
import type { PfAccount } from '@/app/(dashboard)/profit-first/_components/pf-overview';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecentEntry {
  id: string;
  kind: 'income' | 'expense';
  label: string;
  /** ISO YYYY-MM-DD */
  date: string;
  amountCents: number;
  pending?: boolean;
}

interface OverviewContentProps {
  greeting: string;
  totalBalanceCents: number;
  hasWallets: boolean;
  accounts: PfAccount[];
  totalIncomeCents: number;
  recent: RecentEntry[];
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Client half of the Overview home. Owns amount-visibility state (shared
 * localStorage key with the Profit First page) and the Record sheet hooks.
 *
 * Layout is whitespace and type scale, no cards: greeting → hero balance →
 * split bar with legend → recent ledger.
 */
export function OverviewContent({
  greeting,
  totalBalanceCents,
  hasWallets,
  accounts,
  totalIncomeCents,
  recent,
}: OverviewContentProps): React.JSX.Element {
  const { visible, toggle, mounted } = useAmountVisibility();
  const { openRecordSheet } = useRecordSheet();

  const isFirstRun = !hasWallets && recent.length === 0 && totalIncomeCents === 0;

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      {/* Hero: where the money stands */}
      <header>
        <p className="text-sm text-ink-faint">{greeting}</p>
        <div className="mt-3 flex items-center gap-2">
          <MaskedAmount
            cents={totalBalanceCents}
            visible={visible}
            mounted={mounted}
            className={cn(
              'text-[34px] leading-none font-semibold tracking-tight tabular-nums',
              totalBalanceCents < 0 && 'text-expense'
            )}
          />
          <AmountToggle visible={visible} toggle={toggle} />
        </div>
        <p className="mt-1.5 text-sm text-ink-faint">
          {hasWallets ? (
            'across all wallets'
          ) : (
            <>
              no wallets yet ·{' '}
              <Link
                href="/wallets"
                className="underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                set them up
              </Link>
            </>
          )}
        </p>
      </header>

      {/* The split at a glance */}
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
              <li key={account.id} className="flex items-center gap-1.5 text-xs text-ink-soft">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: account.color }}
                />
                {account.name}
                <span className="text-ink-faint tabular-nums">{account.targetPercentage}%</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recent movement */}
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

        {recent.length > 0 ? (
          <ul className="mt-2 divide-y divide-hairline/60">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.label}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {formatDate(entry.date)}
                    {entry.pending ? ' · Pending' : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-sm font-semibold tabular-nums',
                    entry.kind === 'expense'
                      ? 'text-expense'
                      : entry.pending
                        ? 'text-ink-soft'
                        : 'text-income'
                  )}
                >
                  {entry.kind === 'expense' ? '−' : '+'}
                  {formatCurrency(entry.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-ink-soft">Nothing recorded yet.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => openRecordSheet('income')}
            >
              <Plus aria-hidden="true" />
              Record income
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
