'use client';

import { useTransition, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Income, IncomeCategory } from '@/types/income';
import { createIncomeCategoryAction } from './category-actions';

interface IncomeFormProps {
  categories: IncomeCategory[];
  /** Server action to call on submit (create or update). */
  action: (formData: FormData) => Promise<{ error: string } | void>;
  /** Pre-filled values when used for editing (edit dialog). */
  initialValues?: Partial<Income>;
  /** Label for the submit button. */
  submitLabel?: string;
  /** Called when the user clicks Cancel (edit dialog). */
  onCancel?: () => void;
}

/** today as YYYY-MM-DD in local time */
function todayLocal(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Reusable income form used on /income/new and inside the edit dialog.
 * Amount field shows decimal pesos; the server action converts to cents (Pitfall 2).
 * profitFirstAllocated Switch initialized to true (Pitfall 5).
 */
export function IncomeForm({
  categories,
  action,
  initialValues,
  submitLabel = 'Add Income',
  onCancel,
}: IncomeFormProps) {
  const [isPending, startTransition] = useTransition();
  // Pitfall 5: profitFirstAllocated defaults to true
  const [pfAllocated, setPfAllocated] = useState(initialValues?.profitFirstAllocated ?? true);

  // Local categories copy so quick-add appears immediately without full page reload
  const [localCategories, setLocalCategories] = useState<IncomeCategory[]>(categories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialValues?.categoryId ? String(initialValues.categoryId) : ''
  );
  const [quickAddName, setQuickAddName] = useState('');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isQuickAddPending, startQuickAddTransition] = useTransition();

  /** Quick-add: create a new category and select it immediately. */
  function handleQuickAdd() {
    const trimmed = quickAddName.trim();
    if (!trimmed) return;
    startQuickAddTransition(async () => {
      const result = await createIncomeCategoryAction(trimmed);
      if ('error' in result) {
        toast.error(
          result.error === 'category_exists'
            ? 'A category with that name already exists.'
            : 'Failed to create category. Please try again.'
        );
      } else {
        const newCat: IncomeCategory = {
          id: result.data.id,
          name: result.data.name,
          system: false,
          userId: 0, // userId not needed by the select — placeholder
        };
        setLocalCategories((prev) => [...prev, newCat]);
        setSelectedCategoryId(String(result.data.id));
        toast.success(`"${trimmed}" added and selected.`);
        setQuickAddName('');
        setIsQuickAddOpen(false);
      }
    });
  }

  // Amount displayed in pesos (cents / 100) when editing
  const initialAmountPesos =
    initialValues?.amount !== undefined ? (initialValues.amount / 100).toFixed(2) : '';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    // Inject pfAllocated as string — action checks === 'true'
    formData.set('profitFirstAllocated', String(pfAllocated));

    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        toast.error(
          result.error === 'invalid_category'
            ? 'Invalid category selected.'
            : result.error === 'invalid_amount'
              ? 'Enter a valid amount greater than zero.'
              : 'Something went wrong. Please try again.'
        );
      }
      // On success the action calls redirect() — component unmounts
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-categoryId">Category</Label>
        <div className="flex items-center gap-2">
          <Select
            name="categoryId"
            value={selectedCategoryId}
            onValueChange={setSelectedCategoryId}
            required
          >
            <SelectTrigger id="income-categoryId" className="flex-1">
              <SelectValue placeholder="Select category" />
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
          <div className="flex items-center gap-2 pt-1">
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
              aria-label="New income category name"
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

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-amount">Amount (₱)</Label>
        <Input
          id="income-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          defaultValue={initialAmountPesos}
          required
        />
      </div>

      {/* Money Status */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-moneyStatus">Status</Label>
        <Select name="moneyStatus" defaultValue={initialValues?.moneyStatus ?? 'PENDING'} required>
          <SelectTrigger id="income-moneyStatus">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending — not yet withdrawable</SelectItem>
            <SelectItem value="RECEIVED">Received — money is in your account</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Income Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-incomeDate">Income Date</Label>
        <Input
          id="income-incomeDate"
          name="incomeDate"
          type="date"
          defaultValue={initialValues?.incomeDate ?? todayLocal()}
          required
        />
      </div>

      {/* Expected Release Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-expectedReleaseDate">Expected Release Date (optional)</Label>
        <Input
          id="income-expectedReleaseDate"
          name="expectedReleaseDate"
          type="date"
          defaultValue={initialValues?.expectedReleaseDate ?? ''}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-description">Description (optional)</Label>
        <Textarea
          id="income-description"
          name="description"
          placeholder="Optional description..."
          defaultValue={initialValues?.description ?? ''}
          maxLength={500}
        />
      </div>

      {/* Profit First Allocated switch — Pitfall 5: default true */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="income-profitFirstAllocated" className="text-base">
            Include in Profit First
          </Label>
          <p className="text-sm text-muted-foreground">
            When off, this income won&apos;t be split across Profit First allocations.
          </p>
        </div>
        <Switch
          id="income-profitFirstAllocated"
          checked={pfAllocated}
          onCheckedChange={setPfAllocated}
        />
      </div>

      <div className="flex justify-end gap-3">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
