'use client';

import { useState, useTransition } from 'react';
import { ArrowUpRight, MoreHorizontal, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StellaSprite } from '@/components/Stella';
import { useRecordSheet } from '@/components/RecordSheetProvider';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import { formatDateGroup } from '@/lib/format-date';
import { deleteExpenseAction, restoreExpenseAction } from './expense-actions';
import { EditExpenseDialog, type ExpenseRow } from './edit-expense-dialog';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}

interface WalletOption {
  id: number;
  name: string;
}

interface ExpenseListProps {
  expenses: ExpenseRow[];
  /** True when URL filters are narrowing the list — changes the empty state. */
  filtered: boolean;
  categories: ExpenseCategory[];
  /** Wallets for the edit dialog's "Paid with" selector */
  wallets: WalletOption[];
  /** Default wallet id used to preselect legacy NULL-wallet rows */
  defaultWalletId: number | null;
  /** Called after any mutation so parent can refresh state */
  onMutated: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function DeletedExpenseRow({ expense, onMutated }: DeletedRowProps): React.JSX.Element {
  const formatCurrency = useFormatCurrency();
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
    <li className="flex items-center gap-3.5 py-3 opacity-60">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-ink-faint"
      >
        <ArrowUpRight className="h-5 w-5" />
      </span>
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
  wallets: WalletOption[];
  defaultWalletId: number | null;
  onMutated: () => void;
}

function ActiveExpenseRow({
  expense,
  categories,
  wallets,
  defaultWalletId,
  onMutated,
}: ActiveRowProps): React.JSX.Element {
  const formatCurrency = useFormatCurrency();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  // Second line: description and wallet name as quiet text (walletName is
  // denormalized, so it renders even when the wallet has been soft-deleted).
  const detail = [expense.description, expense.walletName].filter(Boolean).join(' · ');

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteExpenseAction(expense.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Expense deleted.');
        onMutated();
      }
    });
  }

  return (
    <li>
      <div
        className="group -mx-3 flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-raised/40"
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
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-expense text-expense"
        >
          <ArrowUpRight className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{expense.categoryName}</p>
          {detail ? <p className="mt-0.5 truncate text-xs text-ink-faint">{detail}</p> : null}
        </div>

        <span className="shrink-0 text-sm font-semibold text-expense tabular-nums">
          −{formatCurrency(expense.amount)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${expense.categoryName}`}
              className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialogOpen(true)}>Edit</DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={isDeleting}
              onSelect={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EditExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={expense}
        categories={categories}
        wallets={wallets}
        defaultWalletId={defaultWalletId}
        onMutated={onMutated}
      />
    </li>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

/**
 * The expense ledger: rows grouped under date headings, amounts in the expense
 * color always paired with the − sign. Active rows open the edit dialog (EXP-03)
 * and carry an Edit / Delete overflow; soft-deleted rows surface below with a
 * restore affordance (EXP-04).
 */
export function ExpenseList({
  expenses,
  filtered,
  categories,
  wallets,
  defaultWalletId,
  onMutated,
}: ExpenseListProps): React.JSX.Element {
  const { openRecordSheet } = useRecordSheet();

  const activeExpenses = expenses.filter((e) => e.deletedAt === null);
  const deletedExpenses = expenses.filter((e) => e.deletedAt !== null);

  if (activeExpenses.length === 0 && deletedExpenses.length === 0) {
    if (filtered) {
      return (
        <div className="py-16 text-center">
          <p className="text-sm text-ink-soft">No expenses match your filters.</p>
        </div>
      );
    }
    return (
      <div className="py-20 text-center">
        <StellaSprite mood="sleeping" size={64} className="mx-auto" />
        <p className="mt-5 text-base font-medium">No expenses recorded yet</p>
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
    <div className="flex flex-col gap-7">
      {groupByDate(activeExpenses).map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
            {group.label}
          </h2>
          <ul className="mt-1.5 flex flex-col">
            {group.items.map((expense) => (
              <ActiveExpenseRow
                key={expense.id}
                expense={expense}
                categories={categories}
                wallets={wallets}
                defaultWalletId={defaultWalletId}
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
          <ul className="mt-1.5 divide-y divide-hairline/60">
            {deletedExpenses.map((expense) => (
              <DeletedExpenseRow key={expense.id} expense={expense} onMutated={onMutated} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
