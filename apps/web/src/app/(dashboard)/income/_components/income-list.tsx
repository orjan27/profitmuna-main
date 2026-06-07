'use client';

import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Income } from '@/types/income';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import { formatDateGroup } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { useRecordSheet } from '@/components/RecordSheetProvider';

interface IncomeListProps {
  items: Income[];
  /** True when URL filters are narrowing the list — changes the empty state. */
  filtered: boolean;
  onEditRow: (income: Income) => void;
  onReceiveRow: (income: Income) => void;
}

interface DateGroup {
  label: string;
  items: Income[];
}

/** Group consecutive rows by their ledger date heading (Today / Yesterday / date). */
function groupByDate(items: Income[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const income of items) {
    const label = formatDateGroup(income.incomeDate);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(income);
    } else {
      groups.push({ label, items: [income] });
    }
  }
  return groups;
}

/**
 * The income ledger: borderless rows grouped under date headings, amounts
 * right-aligned in tabular numerals. Received amounts carry the income color
 * (always paired with the + sign); pending amounts stay in soft ink with a
 * "Pending" label and an inline Receive action (INC-05 / D-14).
 * Clicking a row opens the edit dialog.
 */
export function IncomeList({ items, filtered, onEditRow, onReceiveRow }: IncomeListProps) {
  const { openRecordSheet } = useRecordSheet();
  const formatCurrency = useFormatCurrency();

  if (items.length === 0) {
    // Filtered-empty is not first-run: the records exist, the filters hide
    // them. Say so instead of the teach copy, and offer no competing CTA —
    // the filter row sits right above.
    if (filtered) {
      return (
        <div className="py-16 text-center">
          <p className="text-sm text-ink-soft">No income matches your filters.</p>
        </div>
      );
    }
    return (
      <div className="py-20 text-center">
        <p className="text-base font-medium">Nothing recorded yet</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-faint">
          Record your first income and watch it split across your buckets.
        </p>
        <Button className="mt-6" onClick={() => openRecordSheet('income')}>
          <Plus aria-hidden="true" />
          Record income
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groupByDate(items).map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
            {group.label}
          </h2>
          <ul className="mt-1 divide-y divide-hairline/60">
            {group.items.map((income) => (
              <li key={income.id}>
                <div
                  className="group -mx-3 flex cursor-pointer items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-raised/40"
                  onClick={() => onEditRow(income)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onEditRow(income);
                    }
                  }}
                  aria-label={`Edit income: ${income.categoryName}, ${formatCurrency(income.amount)}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{income.categoryName}</p>
                    {income.description ? (
                      <p className="mt-0.5 truncate text-xs text-ink-faint">{income.description}</p>
                    ) : null}
                  </div>

                  {income.moneyStatus === 'PENDING' ? (
                    <Button
                      size="xs"
                      variant="outline"
                      className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={(e) => {
                        // Prevent row click from firing
                        e.stopPropagation();
                        onReceiveRow(income);
                      }}
                      aria-label={`Mark income as received: ${income.categoryName}`}
                    >
                      Receive
                    </Button>
                  ) : null}

                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        income.moneyStatus === 'RECEIVED' ? 'text-income' : 'text-ink-soft'
                      )}
                    >
                      +{formatCurrency(income.amount)}
                    </p>
                    {income.moneyStatus === 'PENDING' ? (
                      <p className="text-[11px] text-ink-faint">Pending</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
