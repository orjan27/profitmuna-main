import { cn } from '@/lib/utils';

export interface MonthlyBarDatum {
  /** Axis label, e.g. "Jun". */
  label: string;
  /** Bucket total in integer cents. */
  total: number;
  /** The most-recent / in-focus month — rendered in the money tone. */
  current?: boolean;
}

interface MonthlyBarsProps {
  data: MonthlyBarDatum[];
  tone: 'income' | 'expense';
  /** Formats cents for the per-bar tooltip + aria summary. */
  formatCurrency: (cents: number) => string;
}

const TONE_BAR: Record<MonthlyBarsProps['tone'], string> = {
  income: 'bg-income',
  expense: 'bg-expense',
};

/**
 * A compact monthly bar series, drawn with flexed divs (no chart library — same
 * hand-rolled approach as the Overview savings ring). The in-focus month wears
 * the money tone; prior months stay quiet neutral so the eye lands on "now".
 * Empty months render a hairline baseline rather than nothing, so the axis
 * reads as a continuous timeline.
 */
export function MonthlyBars({ data, tone, formatCurrency }: MonthlyBarsProps): React.JSX.Element {
  const max = Math.max(1, ...data.map((d) => d.total));
  const summary = data.map((d) => `${d.label} ${formatCurrency(d.total)}`).join(', ');

  return (
    <div
      role="img"
      aria-label={`Monthly totals: ${summary}`}
      className="flex h-36 items-end gap-1.5"
    >
      {data.map((d) => {
        const pct = (d.total / max) * 100;
        // Floor non-zero bars at 6% so a small month is still a visible bar;
        // zero months get a thin baseline nub.
        const height = d.total > 0 ? Math.max(pct, 6) : 2;
        return (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  'w-full rounded-md',
                  d.total === 0 ? 'bg-hairline' : d.current ? TONE_BAR[tone] : 'bg-ink/15'
                )}
                style={{ height: `${height}%` }}
                title={`${d.label}: ${formatCurrency(d.total)}`}
              />
            </div>
            <span
              className={cn('text-[11px]', d.current ? 'font-semibold text-ink' : 'text-ink-faint')}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
