'use client';

import type { Income } from '@/types/income';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface IncomeListProps {
  items: Income[];
  onEditRow: (income: Income) => void;
  onReceiveRow: (income: Income) => void;
}

/**
 * Renders a list of income rows.
 * Clicking a row opens the edit dialog.
 * PENDING rows show a "Receive" action button (INC-05 / D-14).
 */
export function IncomeList({ items, onEditRow, onReceiveRow }: IncomeListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">No income records yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click &quot;Add Income&quot; above to record your first income entry.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {items.map((income) => (
        <div
          key={income.id}
          className="flex cursor-pointer items-start justify-between gap-4 px-4 py-3 hover:bg-muted/50"
          onClick={() => onEditRow(income)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onEditRow(income);
          }}
          aria-label={`Edit income: ${income.categoryName}, ${formatCurrency(income.amount)}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">{income.categoryName}</span>
              <Badge variant={income.moneyStatus === 'RECEIVED' ? 'success' : 'warning'}>
                {income.moneyStatus === 'RECEIVED' ? 'Received' : 'Pending'}
              </Badge>
            </div>
            {income.description ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{income.description}</p>
            ) : null}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(income.incomeDate)}
              {income.receivedDate ? ` · Received ${formatDate(income.receivedDate)}` : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(income.amount)}
            </span>
            {income.moneyStatus === 'PENDING' ? (
              <Button
                size="sm"
                variant="outline"
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
          </div>
        </div>
      ))}
    </div>
  );
}
