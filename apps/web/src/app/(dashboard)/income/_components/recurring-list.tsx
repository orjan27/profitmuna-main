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
import { Switch } from '@/components/ui/switch';
import { FormActions } from '@/components/FormActions';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import {
  RecurrenceFields,
  recurrenceIsValid,
  type RecurrenceValue,
} from '@/components/RecurrenceFields';
import { formatScheduleSummary, nextDueDate } from '@/lib/recurrence';
import { formatDate } from '@/lib/format-date';
import type { RecurringIncome } from '@/types/recurring';
import type { IncomeCategory } from '@/types/income';
import {
  updateRecurringIncomeAction,
  setRecurringIncomeActiveAction,
  deleteRecurringIncomeAction,
} from './recurring-actions';

interface RecurringIncomeListProps {
  templates: RecurringIncome[];
  categories: IncomeCategory[];
}

/**
 * "Recurring" section on the income page: active templates with their
 * schedule, next due date, and an edit/pause/stop menu. Renders nothing when
 * the user has no templates — the section never advertises itself empty.
 */
export function RecurringIncomeList({ templates, categories }: RecurringIncomeListProps) {
  const router = useRouter();
  const formatCurrency = useFormatCurrency();
  const [editing, setEditing] = useState<RecurringIncome | null>(null);
  const [stopping, setStopping] = useState<RecurringIncome | null>(null);
  const [isPending, startTransition] = useTransition();

  if (templates.length === 0) return null;

  function handleToggleActive(template: RecurringIncome) {
    startTransition(async () => {
      const result = await setRecurringIncomeActiveAction(template, !template.active);
      if (result?.error) {
        toast.error('Could not update the recurring income. Please try again.');
        return;
      }
      toast.success(template.active ? 'Recurring income paused.' : 'Recurring income resumed.');
      router.refresh();
    });
  }

  function handleStop() {
    if (!stopping) return;
    startTransition(async () => {
      const result = await deleteRecurringIncomeAction(stopping.id);
      if (result?.error) {
        toast.error('Could not stop the recurring income. Please try again.');
        return;
      }
      toast.success('Recurring income stopped. Past entries are untouched.');
      setStopping(null);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="income-recurring-heading" className="flex flex-col gap-2">
      <h2
        id="income-recurring-heading"
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
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {template.amount !== null ? (
                `+${formatCurrency(template.amount)}`
              ) : (
                <span className="text-xs font-normal text-ink-faint">Set on receive</span>
              )}
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
        <EditRecurringIncomeDialog
          template={editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {/* Stop confirmation */}
      {stopping ? (
        <Dialog open onOpenChange={(isOpen) => !isOpen && setStopping(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Stop recurring income?</DialogTitle>
              <DialogDescription>
                {stopping.categoryName} ({formatScheduleSummary(stopping)}) will no longer be
                created automatically. Entries already recorded are untouched.
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

interface EditRecurringIncomeDialogProps {
  template: RecurringIncome;
  categories: IncomeCategory[];
  onClose: () => void;
}

function EditRecurringIncomeDialog({
  template,
  categories,
  onClose,
}: EditRecurringIncomeDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [categoryId, setCategoryId] = useState(String(template.categoryId));
  // Decimal pesos string; empty = "amount set on receive"
  const [amount, setAmount] = useState(
    template.amount !== null ? (template.amount / 100).toFixed(2) : ''
  );
  const [pmAllocated, setPmAllocated] = useState(template.profitMunaAllocated);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>({
    frequency: template.frequency,
    dayOfWeek: template.dayOfWeek,
    dayOfMonth: template.dayOfMonth,
    dayOfMonth2: template.dayOfMonth2,
  });

  const parsedAmount = Number(amount);
  const amountValid = amount === '' || (Number.isFinite(parsedAmount) && parsedAmount > 0);

  function handleSave() {
    if (!recurrenceIsValid(recurrence) || recurrence.frequency === 'NONE') {
      toast.error('Pick two different days for the bi-weekly repeat.');
      return;
    }
    if (!amountValid) {
      toast.error('Enter an amount greater than zero, or leave it blank.');
      return;
    }
    const frequency = recurrence.frequency;
    startTransition(async () => {
      const result = await updateRecurringIncomeAction(template.id, {
        categoryId: Number(categoryId),
        amountPesos: amount === '' ? undefined : parsedAmount,
        description: template.description,
        profitMunaAllocated: pmAllocated,
        frequency,
        dayOfWeek: recurrence.dayOfWeek,
        dayOfMonth: recurrence.dayOfMonth,
        dayOfMonth2: recurrence.dayOfMonth2,
      });
      if (result?.error) {
        toast.error('Could not update the recurring income. Please try again.');
        return;
      }
      toast.success('Recurring income updated.');
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-screen overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Recurring Income</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recurring-income-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="recurring-income-category" className="w-full">
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
            <Label htmlFor="recurring-income-amount">Amount (optional)</Label>
            <Input
              id="recurring-income-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-ink-faint">
              Leave blank to enter the actual amount each time you mark it received.
            </p>
          </div>

          <RecurrenceFields
            value={recurrence}
            onChange={setRecurrence}
            idPrefix="recurring-income-edit"
          />

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="recurring-income-pf">Include in Profit Muna</Label>
              <p className="mt-0.5 text-xs text-ink-faint">
                When off, generated incomes won&apos;t be split across your buckets.
              </p>
            </div>
            <Switch
              id="recurring-income-pf"
              checked={pmAllocated}
              onCheckedChange={setPmAllocated}
            />
          </div>
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
