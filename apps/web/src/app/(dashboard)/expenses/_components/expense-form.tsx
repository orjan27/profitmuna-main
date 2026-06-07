'use client';

import { useTransition, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { FormActions } from '@/components/FormActions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAYMENT_METHODS } from '@/lib/constants';
import { createExpenseCategoryAction } from './category-actions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}

interface InitialValues {
  categoryId?: number;
  /** Amount in cents — form displays as decimal pesos */
  amount?: number;
  expenseDate?: string;
  paymentMethod?: string | null;
  description?: string | null;
}

interface ExpenseFormProps {
  categories: ExpenseCategory[];
  /** Server action (create or update). Returns { error } on failure, void on success. */
  action: (formData: FormData) => Promise<{ error: string } | undefined>;
  /** When provided, pre-populates the form for editing */
  initialValues?: InitialValues;
  /** Called after a successful submission (e.g. close dialog) */
  onSuccess?: () => void;
  /** Where the form renders; controls the mobile action-bar treatment. */
  variant?: 'page' | 'dialog';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Reusable expense form for both /expenses/new and the edit dialog.
 *
 * Accepts an `action` prop so create and update actions can share the same UI.
 * When `initialValues` is provided the fields are pre-populated (edit mode).
 *
 * Payment method is optional per D-09/D-10 — a blank option is always included.
 */
export function ExpenseForm({
  categories,
  action,
  initialValues,
  onSuccess,
  variant = 'page',
}: ExpenseFormProps) {
  const [isPending, startTransition] = useTransition();

  // Local categories copy so quick-add appears immediately without full page reload
  const [localCategories, setLocalCategories] = useState<ExpenseCategory[]>(categories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialValues?.categoryId?.toString() ?? ''
  );
  const [quickAddName, setQuickAddName] = useState('');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isQuickAddPending, startQuickAddTransition] = useTransition();

  /** Quick-add: create a new expense category and select it immediately (D-11). */
  function handleQuickAdd() {
    const trimmed = quickAddName.trim();
    if (!trimmed) return;
    startQuickAddTransition(async () => {
      const result = await createExpenseCategoryAction(trimmed);
      if ('error' in result) {
        toast.error(
          result.error === 'category_exists'
            ? 'A category with that name already exists.'
            : 'Failed to create category. Please try again.'
        );
      } else {
        const newCat: ExpenseCategory = {
          id: result.data.id,
          name: result.data.name,
          system: false,
        };
        setLocalCategories((prev) => [...prev, newCat]);
        setSelectedCategoryId(String(result.data.id));
        toast.success(`"${trimmed}" added and selected.`);
        setQuickAddName('');
        setIsQuickAddOpen(false);
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(initialValues ? 'Expense updated.' : 'Expense recorded.');
        onSuccess?.();
      }
    });
  }

  const defaultDate = initialValues?.expenseDate ?? todayISO();
  const defaultAmount = initialValues?.amount != null ? centsToDecimal(initialValues.amount) : '';
  // Radix Select forbids empty-string item values — use 'none' sentinel,
  // translated back to null in the server actions.
  const defaultPayment = initialValues?.paymentMethod ?? 'none';
  const defaultDescription = initialValues?.description ?? '';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-lg">
      {/* Category */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="categoryId">Category</Label>
        <div className="flex items-center gap-2">
          <Select
            name="categoryId"
            value={selectedCategoryId}
            onValueChange={setSelectedCategoryId}
            required
          >
            <SelectTrigger id="categoryId" className="flex-1">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {localCategories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsQuickAddOpen((v) => !v)}
            aria-label="Add new category"
            title="Add new category"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick-add new category inline (D-11) */}
        {isQuickAddOpen ? (
          <div className="flex items-center gap-2">
            <Input
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickAdd();
                }
                if (e.key === 'Escape') setIsQuickAddOpen(false);
              }}
              placeholder="New category name"
              className="flex-1 h-8 text-sm"
              aria-label="New expense category name"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              onClick={handleQuickAdd}
              disabled={isQuickAddPending || !quickAddName.trim()}
            >
              Add
            </Button>
          </div>
        ) : null}
      </div>

      {/* Amount (decimal pesos — toCents conversion happens in the server action) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Amount (₱)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          defaultValue={defaultAmount}
          required
        />
      </div>

      {/* Date */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="expenseDate">Date</Label>
        <Input
          id="expenseDate"
          name="expenseDate"
          type="date"
          defaultValue={defaultDate}
          required
        />
      </div>

      {/* Payment method — optional, blank = no payment method recorded */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="paymentMethod">Payment Method (optional)</Label>
        <Select name="paymentMethod" defaultValue={defaultPayment}>
          <SelectTrigger id="paymentMethod">
            <SelectValue placeholder="No payment method" />
          </SelectTrigger>
          <SelectContent>
            {/* 'none' sentinel clears the payment method (Radix forbids value="") */}
            <SelectItem value="none">None</SelectItem>
            {PAYMENT_METHODS.map((pm) => (
              <SelectItem key={pm.value} value={pm.value}>
                {pm.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          name="description"
          maxLength={500}
          rows={3}
          placeholder="Brief note about this expense"
          defaultValue={defaultDescription}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
      </div>

      <FormActions variant={variant === 'dialog' ? 'overlay' : 'page'} className="md:justify-start">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? initialValues
              ? 'Saving…'
              : 'Recording…'
            : initialValues
              ? 'Save Changes'
              : 'Record Expense'}
        </Button>
      </FormActions>
    </form>
  );
}
