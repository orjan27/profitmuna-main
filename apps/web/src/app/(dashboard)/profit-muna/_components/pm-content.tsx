'use client';

import { useState } from 'react';
import { Check, Plus, TriangleAlert } from 'lucide-react';

import { JarGlyph } from '@/components/JarGlyph';

import { Button } from '@/components/ui/button';
import { useAmountVisibility, AmountToggle } from '@/components/amount-visibility';
import { useCurrency } from '@/components/CurrencyProvider';
import { formatCurrencyParts } from '@/lib/format-currency';
import { PmOverview, type PmAccount } from './pm-overview';
import { PmAccountForm } from './pm-account-form';
import { PmPercentageEditor } from './pm-percentage-editor';

interface PmContentProps {
  accounts: PmAccount[];
  totalIncome: number;
}

/**
 * Client boundary for /profit-muna. Owns amount-visibility state and the
 * mutation entry points (add-jar dialog, inline percentage editor).
 *
 * Composition: hero total (received income to allocate) → row of jars (the
 * split is the picture) → funded-status banner → quiet foot actions.
 */
export function PmContent({ accounts, totalIncome }: PmContentProps) {
  const { visible, toggle, mounted } = useAmountVisibility();
  const [addOpen, setAddOpen] = useState(false);
  const [editingPercents, setEditingPercents] = useState(false);

  return (
    <div className="flex flex-col gap-7">
      {/* Hero: received income to allocate, as typography on the paper. The eye
          toggle is anchored to the balance it masks (financial-app convention). */}
      <div>
        <p className="text-sm text-ink-soft">Received income to allocate</p>
        <div className="mt-1.5 flex items-center gap-3">
          <HeroAmount cents={totalIncome} visible={visible} mounted={mounted} />
          <AmountToggle visible={visible} toggle={toggle} />
        </div>
      </div>

      {/* The jars, or the inline bulk percentage editor while editing */}
      {editingPercents ? (
        <PmPercentageEditor accounts={accounts} onCancel={() => setEditingPercents(false)} />
      ) : (
        <>
          <PmOverview accounts={accounts} visible={visible} mounted={mounted} />

          <StatusBanner accounts={accounts} totalIncome={totalIncome} />

          {/* Foot actions: add a jar (primary) on the left, rare bulk edit
              quietly on the right where it acts. On mobile the labeled add
              button gives way to the thumb-zone JarFab below (max-md:hidden). */}
          <div className="flex items-center justify-between">
            <Button onClick={() => setAddOpen(true)} className="rounded-full max-md:hidden">
              <Plus aria-hidden="true" />
              Add a jar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-ink-soft hover:text-ink max-md:ml-auto"
              onClick={() => setEditingPercents(true)}
            >
              Edit percentages
            </Button>
          </div>

          {/* Mobile FAB — mirrors RecordFab/WalletFab placement and size; a Jar
              glyph with a small + badge, self-hidden at md+ via md:hidden. */}
          <button
            type="button"
            aria-label="Add a jar"
            onClick={() => setAddOpen(true)}
            className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/25 transition-transform outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
          >
            <span className="relative">
              <JarGlyph className="size-7" />
              <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary-foreground text-primary">
                <Plus className="size-2.5" strokeWidth={3} aria-hidden="true" />
              </span>
            </span>
          </button>
        </>
      )}

      {/* Create jar dialog */}
      <PmAccountForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

// ── Hero amount ─────────────────────────────────────────────────────────────

interface HeroAmountProps {
  /** Amount in integer cents */
  cents: number;
  visible: boolean;
  mounted: boolean;
}

/**
 * The received-income hero figure. Renders the integer portion bold with the
 * decimals in a quieter weight (₱88,447 with a faint .05), honoring the user's
 * display currency. Masked to ••••••• until amounts are revealed — SSR always
 * renders the masked state to avoid a hydration mismatch (Pitfall 7).
 */
function HeroAmount({ cents, visible, mounted }: HeroAmountProps) {
  const currency = useCurrency();

  if (!(mounted && visible)) {
    return (
      <span
        aria-hidden="true"
        className="text-4xl font-bold leading-none tracking-tight md:text-5xl"
      >
        •••••••
      </span>
    );
  }

  const { symbol, whole, fraction } = formatCurrencyParts(cents, currency);
  return (
    <span className="flex items-baseline font-bold leading-none tracking-tight tabular-nums">
      <span className="text-4xl md:text-5xl">
        {symbol}
        {whole}
      </span>
      {fraction ? <span className="text-2xl text-ink-faint md:text-3xl">{fraction}</span> : null}
    </span>
  );
}

// ── Funded-status banner ──────────────────────────────────────────────────────

interface StatusBannerProps {
  accounts: PmAccount[];
  totalIncome: number;
}

/**
 * One-line readout of allocation health beneath the jars:
 * - allocations ≠ 100%  → warning, nudge to fix the percentages
 * - 100% but no income  → neutral hint, the split is ready
 * - 100% and income in   → success, the profit-muna promise is kept
 */
function StatusBanner({ accounts, totalIncome }: StatusBannerProps) {
  if (accounts.length === 0) return null;

  const totalPercent = accounts.reduce((sum, a) => sum + a.targetPercentage, 0);

  if (totalPercent !== 100) {
    return (
      <Banner
        tone="warning"
        icon={<TriangleAlert aria-hidden="true" className="h-4 w-4 text-paper" strokeWidth={2.5} />}
      >
        Your jars add up to <strong className="font-semibold">{totalPercent}%</strong> — adjust to
        100% so every peso has a home.
      </Banner>
    );
  }

  if (totalIncome === 0) {
    return (
      <Banner
        tone="neutral"
        icon={<Check aria-hidden="true" className="h-4 w-4 text-paper" strokeWidth={3} />}
      >
        Record your first income and watch it pour into your jars.
      </Banner>
    );
  }

  return (
    <Banner
      tone="success"
      icon={<Check aria-hidden="true" className="h-4 w-4 text-paper" strokeWidth={3} />}
    >
      Every jar is funded — your profit is set aside{' '}
      <strong className="font-semibold">before</strong> expenses.
    </Banner>
  );
}

interface BannerProps {
  tone: 'success' | 'warning' | 'neutral';
  /** Badge glyph — rendered inside the colored circle. */
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Banner({ tone, icon, children }: BannerProps) {
  const surface =
    tone === 'warning' ? 'bg-tint-expense' : tone === 'neutral' ? 'bg-card' : 'bg-tint-income';
  const badge = tone === 'warning' ? 'bg-expense' : tone === 'neutral' ? 'bg-saving' : 'bg-income';

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${surface}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${badge}`}>
        {icon}
      </span>
      <p className="text-sm text-ink">{children}</p>
    </div>
  );
}
