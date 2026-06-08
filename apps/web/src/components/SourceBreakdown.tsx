import { cn } from '@/lib/utils';

export interface SourceDatum {
  categoryName: string;
  /** Total in integer cents. */
  total: number;
  count: number;
}

interface SourceBreakdownProps {
  data: SourceDatum[];
  tone: 'income' | 'expense';
  /** Period total in cents — denominator for each source's share. */
  total: number;
  /** Noun used in the share caption, e.g. "income" or "spending". */
  unitLabel: string;
  formatCurrency: (cents: number) => string;
}

const TONE: Record<SourceBreakdownProps['tone'], { dot: string; bar: string }> = {
  income: { dot: 'bg-income', bar: 'bg-income' },
  expense: { dot: 'bg-expense', bar: 'bg-expense' },
};

/**
 * Category breakdown for the active period: each source as a labelled share bar
 * with its amount, percentage, and record count. The money tone fills the bar
 * (color carries financial meaning); the share percent always pairs with the
 * amount and count so meaning never rides on color alone.
 */
export function SourceBreakdown({
  data,
  tone,
  total,
  unitLabel,
  formatCurrency,
}: SourceBreakdownProps): React.JSX.Element {
  const palette = TONE[tone];

  return (
    <ul className="flex flex-col gap-4">
      {data.map((source) => {
        const pct = total > 0 ? (source.total / total) * 100 : 0;
        return (
          <li key={source.categoryName}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden="true"
                  className={cn('h-2 w-2 shrink-0 rounded-full', palette.dot)}
                />
                <span className="truncate">{source.categoryName}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatCurrency(source.total)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-raised">
              <div
                className={cn('h-full rounded-full', palette.bar)}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-ink-faint">
              <span className="tabular-nums">
                {pct.toFixed(1)}% of {unitLabel}
              </span>
              <span className="tabular-nums">
                {source.count} record{source.count !== 1 ? 's' : ''}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
