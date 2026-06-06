'use client';

import { useState, useTransition } from 'react';
import { RotateCcw, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { PAYMENT_METHODS } from '@/lib/constants';
import { restoreExpenseAction } from './expense-actions';
import { EditExpenseDialog, type ExpenseRow } from './edit-expense-dialog';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}

interface ExpenseListProps {
  expenses: ExpenseRow[];
  categories: ExpenseCategory[];
  /** Called after any mutation so parent can refresh state */
  onMutated: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function paymentMethodLabel(value: string | null): string | null {
  if (!value) return null;
  const match = PAYMENT_METHODS.find((pm) => pm.value === value);
  return match ? match.label : value;
}

// ── Sub-component: deleted row restore affordance ─────────────────────────────

interface DeletedRowProps {
  expense: ExpenseRow;
  onMutated: () => void;
}

function DeletedExpenseRow({ expense, onMutated }: DeletedRowProps) {
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreExpenseAction(expense.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Expense restored.');
        onMutated();
      }
    });
  }

  const pmLabel = paymentMethodLabel(expense.paymentMethod);

  return (
    <div className="flex items-center gap-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3 opacity-60">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium line-through text-muted-foreground">
            {expense.categoryName}
          </span>
          <Badge variant="outline" className="text-xs shrink-0">
            Deleted
          </Badge>
          {pmLabel && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {pmLabel}
            </Badge>
          )}
        </div>
        {expense.description && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{expense.description}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium text-muted-foreground line-through">
          {formatCurrency(expense.amount)}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(expense.expenseDate)}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Restore expense"
        onClick={handleRestore}
        disabled={isPending}
        className="shrink-0"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Sub-component: active row ─────────────────────────────────────────────────

interface ActiveRowProps {
  expense: ExpenseRow;
  categories: ExpenseCategory[];
  onMutated: () => void;
}

function ActiveExpenseRow({ expense, categories, onMutated }: ActiveRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const pmLabel = paymentMethodLabel(expense.paymentMethod);

  return (
    <>
      <div
        className="flex items-center gap-4 rounded-md border border-border px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
        onClick={() => setDialogOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={`Edit expense: ${expense.categoryName}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setDialogOpen(true);
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{expense.categoryName}</span>
            {pmLabel && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {pmLabel}
              </Badge>
            )}
          </div>
          {expense.description && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{expense.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{formatCurrency(expense.amount)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(expense.expenseDate)}</p>
        </div>
        <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
      </div>

      <EditExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={expense}
        categories={categories}
        onMutated={onMutated}
      />
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * Renders the expense list.
 *
 * Active rows are clickable and open the edit dialog (EXP-03).
 * Soft-deleted rows are surfaced below with a restore affordance (EXP-04).
 * Empty state shown when there are no active expenses.
 */
export function ExpenseList({ expenses, categories, onMutated }: ExpenseListProps) {
  const activeExpenses = expenses.filter((e) => e.deletedAt === null);
  const deletedExpenses = expenses.filter((e) => e.deletedAt !== null);

  if (activeExpenses.length === 0 && deletedExpenses.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border py-12 text-center">
        <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Record your first expense using the button above.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Active expenses */}
      {activeExpenses.map((expense) => (
        <ActiveExpenseRow
          key={expense.id}
          expense={expense}
          categories={categories}
          onMutated={onMutated}
        />
      ))}

      {activeExpenses.length === 0 && deletedExpenses.length > 0 && (
        <div className="rounded-md border border-dashed border-border py-6 text-center">
          <p className="text-sm text-muted-foreground">No active expenses in this period.</p>
        </div>
      )}

      {/* Soft-deleted expenses */}
      {deletedExpenses.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Deleted ({deletedExpenses.length})
          </p>
          {deletedExpenses.map((expense) => (
            <div key={expense.id} className="mb-2">
              <DeletedExpenseRow expense={expense} onMutated={onMutated} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
