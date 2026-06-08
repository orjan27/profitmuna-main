'use client';

import { useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';

import { cn } from '@/lib/utils';
import { DEFAULT_LEDGER_PERIOD, LEDGER_PERIODS } from '@/lib/ledger-period';

interface PeriodControlProps {
  className?: string;
}

/**
 * Segmented time-scope control for the Income and Expense ledgers (30 days /
 * This month / This year / All). The scope lives in the URL `period` param via
 * nuqs (shareable, survives refresh); the default preset is stored as an absent
 * param so a clean URL means {@link DEFAULT_LEDGER_PERIOD}. Selecting a preset
 * refreshes the RSC, which re-resolves the date bounds for both the stats
 * aggregate and the ledger list.
 *
 * NOTE: nuqs hooks are client-only — the matching RSC reads `searchParams`
 * directly and resolves bounds via `resolveLedgerPeriod` in lib/.
 */
export function PeriodControl({ className }: PeriodControlProps): React.JSX.Element {
  const router = useRouter();
  const [period, setPeriod] = useQueryState('period', parseAsString);
  const active = period ?? DEFAULT_LEDGER_PERIOD;

  async function select(key: string): Promise<void> {
    // Store the default as an absent param so the URL stays clean.
    await setPeriod(key === DEFAULT_LEDGER_PERIOD ? null : key);
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Time period"
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full bg-paper-deep/80 p-0.5',
        className
      )}
    >
      {LEDGER_PERIODS.map((preset) => {
        const isActive = preset.key === active;
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => void select(preset.key)}
            aria-pressed={isActive}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              isActive ? 'bg-raised text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
