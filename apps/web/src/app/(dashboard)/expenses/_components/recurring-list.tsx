'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Repeat } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormActions } from '@/components/FormActions';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import {
  RecurrenceFields,
  recurrenceIsValid,
  type RecurrenceValue,
} from '@/components/RecurrenceFields';
import { formatScheduleSummary, nextDueDate } from '@/lib/recurrence';
import { formatDate } from '@/lib/format-date';
import type { RecurringExpense } from '@/types/recurring';
import {
  updateRecurringExpenseAction,
  setRecurringExpenseActiveAction,
  deleteRecurringExpenseAction,
} from './recurring-actions';

interface CategoryOption {
  id: number;
  name: string;
}

interface WalletOption {
  id: number;
  name: string;
}

interface RecurringExpenseListProps {
  templates: RecurringExpense[];
  categories: CategoryOption[];
  wallets: WalletOption[];
}

/**
 * "Recurring" section on the expenses page: active templates with their
 * schedule, next due date, and an edit/pause/stop menu. Renders nothing when
 * the user has no templates.
 */
export function RecurringExpenseList({
  templates,
  categories,
  wallets,
}: RecurringExpenseListProps) {
  const router = useRouter();
  const formatCurrency = useFormatCurrency();
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [stopping, setStopping] = useState<RecurringExpense | null>(null);
  const [isPending, startTransition] = useTransition();

  if (templates.length === 0) return null;

  function handleToggleActive(template: RecurringExpense) {
    startTransition(async () => {
      const result = await setRecurringExpenseActiveAction(template, !template.active);
      if (result?.error) {
        toast.error('Could not update the recurring expense. Please try again.');
        return;
      }
      toast.success(template.active ? 'Recurring expense paused.' : 'Recurring expense resumed.');
      router.refresh();
    });
  }

  function handleStop() {
    if (!stopping) return;
    startTransition(async () => {
      const result = await deleteRecurringExpenseAction(stopping.id);
      if (result?.error) {
        toast.error('Could not stop the recurring expense. Please try again.');
        return;
      }
      toast.success('Recurring expense stopped. Past entries are untouched.');
      setStopping(null);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="expense-recurring-heading" className="flex flex-col gap-2">
      <h2
        id="expense-recurring-heading"
        className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase"
      >
        Recurring
      </h2>
      <ul className="divide-y divide-hairline/60">
        {templates.map((template) => (
          <li key={template.id} className="flex items-center gap-4 py-3">
            <Repeat aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-faint" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {template.description?.trim() || template.categoryName}
                {!template.active ? (
                  <span className="ml-2 text-xs font-normal text-ink-faint">Paused</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {formatScheduleSummary(template)}
                {template.active ? ` · Next ${formatDate(nextDueDate(template))}` : ''}
                {template.walletName ? ` · ${template.walletName}` : ''}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              −{formatCurrency(template.amount)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for recurring ${template.categoryName}`}
                  className="shrink-0 text-ink-soft"
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(template)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleToggleActive(template)}>
                  {template.active ? 'Pause' : 'Resume'}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setStopping(template)}>
                  Stop
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      {editing ? (
        <EditRecurringExpenseDialog
          template={editing}
          categories={categories}
          wallets={wallets}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {/* Stop confirmation */}
      {stopping ? (
        <Dialog open onOpenChange={(isOpen) => !isOpen && setStopping(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Stop recurring expense?</DialogTitle>
              <DialogDescription>
                {stopping.categoryName} ({formatScheduleSummary(stopping)}) will no longer be
                recorded automatically. Entries already recorded are untouched.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStopping(null)} disabled={isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleStop} disabled={isPending}>
                {isPending ? 'Stopping…' : 'Stop'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

interface EditRecurringExpenseDialogProps {
  template: RecurringExpense;
  categories: CategoryOption[];
  wallets: WalletOption[];
  onClose: () => void;
}

function EditRecurringExpenseDialog({
  template,
  categories,
  wallets,
  onClose,
}: EditRecurringExpenseDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [categoryId, setCategoryId] = useState(String(template.categoryId));
  const [walletId, setWalletId] = useState(String(template.walletId));
  const [amount, setAmount] = useState((template.amount / 100).toFixed(2));
  const [recurrence, setRecurrence] = useState<RecurrenceValue>({
    frequency: template.frequency,
    dayOfWeek: template.dayOfWeek,
    dayOfMonth: template.dayOfMonth,
    dayOfMonth2: template.dayOfMonth2,
  });

  const parsedAmount = Number(amount);
  const amountValid = amount !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0;

  function handleSave() {
    if (!recurrenceIsValid(recurrence) || recurrence.frequency === 'NONE') {
      toast.error('Pick two different days for the bi-weekly repeat.');
      return;
    }
    if (!amountValid) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    const frequency = recurrence.frequency;
    startTransition(async () => {
      const result = await updateRecurringExpenseAction(template.id, {
        categoryId: Number(categoryId),
        amountPesos: parsedAmount,
        description: template.description,
        walletId: Number(walletId),
        frequency,
        dayOfWeek: recurrence.dayOfWeek,
        dayOfMonth: recurrence.dayOfMonth,
        dayOfMonth2: recurrence.dayOfMonth2,
      });
      if (result?.error) {
        toast.error('Could not update the recurring expense. Please try again.');
        return;
      }
      toast.success('Recurring expense updated.');
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-screen overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Recurring Expense</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recurring-expense-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="recurring-expense-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recurring-expense-amount">Amount (₱)</Label>
            <Input
              id="recurring-expense-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recurring-expense-wallet">Paid with</Label>
            <Select value={walletId} onValueChange={setWalletId}>
              <SelectTrigger id="recurring-expense-wallet" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <RecurrenceFields
            value={recurrence}
            onChange={setRecurrence}
            idPrefix="recurring-expense-edit"
          />
        </div>

        <FormActions variant="overlay">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </FormActions>
      </DialogContent>
    </Dialog>
  );
}
