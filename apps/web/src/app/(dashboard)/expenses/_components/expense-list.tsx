'use client';

import { useState, useTransition } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useRecordSheet } from '@/components/RecordSheetProvider';
import { formatCurrency } from '@/lib/format-currency';
import { formatDateGroup } from '@/lib/format-date';
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
  /** True when URL filters are narrowing the list — changes the empty state. */
  filtered: boolean;
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

interface DateGroup {
  label: string;
  items: ExpenseRow[];
}

/** Group consecutive rows by their ledger date heading (Today / Yesterday / date). */
function groupByDate(items: ExpenseRow[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const expense of items) {
    const label = formatDateGroup(expense.expenseDate);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(expense);
    } else {
      groups.push({ label, items: [expense] });
    }
  }
  return groups;
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

  return (
    <li className="flex items-center gap-4 py-3 opacity-60">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-soft line-through">
          {expense.categoryName}
        </p>
        {expense.description ? (
          <p className="mt-0.5 truncate text-xs text-ink-faint">{expense.description}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-sm text-ink-faint tabular-nums line-through">
        −{formatCurrency(expense.amount)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Restore expense: ${expense.categoryName}`}
        onClick={handleRestore}
        disabled={isPending}
        className="shrink-0"
      >
        <RotateCcw aria-hidden="true" />
      </Button>
    </li>
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

  // Second line: description and payment method as quiet text, no badges
  const detail = [expense.description, pmLabel].filter(Boolean).join(' · ');

  return (
    <li>
      <div
        className="group -mx-3 flex cursor-pointer items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-raised/40"
        onClick={() => setDialogOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={`Edit expense: ${expense.categoryName}, ${formatCurrency(expense.amount)}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDialogOpen(true);
          }
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{expense.categoryName}</p>
          {detail ? <p className="mt-0.5 truncate text-xs text-ink-faint">{detail}</p> : null}
        </div>
        <span className="shrink-0 text-sm font-semibold text-expense tabular-nums">
          −{formatCurrency(expense.amount)}
        </span>
      </div>

      <EditExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={expense}
        categories={categories}
        onMutated={onMutated}
      />
    </li>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * The expense ledger: borderless rows grouped under date headings, amounts in
 * the expense color always paired with the − sign. Active rows open the edit
 * dialog (EXP-03); soft-deleted rows surface below with a restore affordance
 * (EXP-04).
 */
export function ExpenseList({ expenses, filtered, categories, onMutated }: ExpenseListProps) {
  const { openRecordSheet } = useRecordSheet();

  const activeExpenses = expenses.filter((e) => e.deletedAt === null);
  const deletedExpenses = expenses.filter((e) => e.deletedAt !== null);

  if (activeExpenses.length === 0 && deletedExpenses.length === 0) {
    // Filtered-empty is not first-run: the records exist, the filters hide
    // them. Say so instead of the teach copy, and offer no competing CTA —
    // the filter row sits right above.
    if (filtered) {
      return (
        <div className="py-16 text-center">
          <p className="text-sm text-ink-soft">No expenses match your filters.</p>
        </div>
      );
    }
    return (
      <div className="py-20 text-center">
        <p className="text-base font-medium">No expenses recorded yet</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-faint">
          Record what you spend and keep every bucket honest.
        </p>
        <Button className="mt-6" onClick={() => openRecordSheet('expense')}>
          <Plus aria-hidden="true" />
          Record expense
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groupByDate(activeExpenses).map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
            {group.label}
          </h2>
          <ul className="mt-1 divide-y divide-hairline/60">
            {group.items.map((expense) => (
              <ActiveExpenseRow
                key={expense.id}
                expense={expense}
                categories={categories}
                onMutated={onMutated}
              />
            ))}
          </ul>
        </section>
      ))}

      {activeExpenses.length === 0 && deletedExpenses.length > 0 && (
        <p className="py-6 text-center text-sm text-ink-faint">
          No active expenses in this period.
        </p>
      )}

      {/* Soft-deleted expenses */}
      {deletedExpenses.length > 0 && (
        <section aria-label="Deleted expenses">
          <h2 className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
            Deleted ({deletedExpenses.length})
          </h2>
          <ul className="mt-1 divide-y divide-hairline/60">
            {deletedExpenses.map((expense) => (
              <DeletedExpenseRow key={expense.id} expense={expense} onMutated={onMutated} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
