'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { toast } from 'sonner';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

import { createWalletAction } from '../../_actions/wallet-actions';
import type { PfAccount, IncomeCategory, ExpenseCategory } from '@/types/wallet';

// 8 preset color swatches per D-15 and UI-SPEC
const COLOR_SWATCHES = [
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
] as const;

type ExpenseMode = 'NONE' | 'ALL' | 'CATEGORIES';

interface NewWalletFormProps {
  pfAccounts: PfAccount[];
  linkedPfAccountIds: Set<number>;
  incomeCategories: IncomeCategory[];
  expenseCategories: ExpenseCategory[];
  prefilledPfAccountId?: number;
}

export function NewWalletForm({
  pfAccounts,
  linkedPfAccountIds,
  incomeCategories,
  expenseCategories,
  prefilledPfAccountId,
}: NewWalletFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<'PROFIT_FIRST' | 'BLANK'>('BLANK');
  const [pfAccountId, setPfAccountId] = useState<string | undefined>(
    prefilledPfAccountId ? String(prefilledPfAccountId) : undefined
  );
  const [color, setColor] = useState<string>(COLOR_SWATCHES[0]);
  const [selectedIncomeCategoryIds, setSelectedIncomeCategoryIds] = useState<number[]>([]);
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>('NONE');
  const [selectedExpenseCategoryIds, setSelectedExpenseCategoryIds] = useState<number[]>([]);

  // Combobox open state
  const [incomePickerOpen, setIncomePickerOpen] = useState(false);
  const [expensePickerOpen, setExpensePickerOpen] = useState(false);

  // Validation error
  const [formError, setFormError] = useState<string | null>(null);

  function toggleIncomeCategory(id: number) {
    setSelectedIncomeCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleExpenseCategory(id: number) {
    setSelectedExpenseCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Client-side validation
    if (!name.trim()) {
      setFormError('Wallet Name is required.');
      return;
    }
    if (sourceType === 'PROFIT_FIRST' && !pfAccountId) {
      setFormError('Select a Profit First allocation account.');
      return;
    }
    if (expenseMode === 'CATEGORIES' && selectedExpenseCategoryIds.length === 0) {
      setFormError('Select at least one expense category.');
      return;
    }

    // Build expenseMode discriminated union
    type ExpenseModeInput =
      | { kind: 'NONE' }
      | { kind: 'ALL' }
      | { kind: 'CATEGORIES'; ids: number[] };

    let expenseModeInput: ExpenseModeInput | undefined;
    if (expenseMode === 'ALL') {
      expenseModeInput = { kind: 'ALL' };
    } else if (expenseMode === 'CATEGORIES') {
      expenseModeInput = { kind: 'CATEGORIES', ids: selectedExpenseCategoryIds };
    } else {
      expenseModeInput = { kind: 'NONE' };
    }

    setSubmitting(true);
    try {
      const result = await createWalletAction({
        name: name.trim(),
        sourceType,
        profitFirstAccountId: sourceType === 'PROFIT_FIRST' ? Number(pfAccountId) : null,
        color,
        incomeCategoryIds: sourceType !== 'PROFIT_FIRST' ? selectedIncomeCategoryIds : undefined,
        expenseMode: expenseModeInput,
      });

      // createWalletAction redirects on success — result only arrives on error
      if (result && 'error' in result) {
        const code = result.error;
        if (code === 'wallet_pf_account_already_linked') {
          setFormError('This allocation account already has a wallet. Choose a different account.');
        } else if (
          code === 'income_category_already_mapped' ||
          code === 'expense_category_already_mapped'
        ) {
          setFormError('Already mapped to another wallet — remove it there first.');
        } else {
          setFormError('Something went wrong. Please try again.');
        }
      }
    } catch (err) {
      // redirect() throws a special error — re-throw so Next.js can handle the navigation
      if (isRedirectError(err)) throw err;
      // Real failures surface an error toast instead of a false success
      toast.error('Could not create wallet. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Wallet Name */}
      <div className="space-y-2">
        <Label htmlFor="wallet-name">Wallet Name</Label>
        <Input
          id="wallet-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Profit Account"
          disabled={submitting}
          maxLength={80}
        />
      </div>

      {/* Wallet Type */}
      <div className="space-y-2">
        <Label>Wallet Type</Label>
        <Select
          value={sourceType}
          onValueChange={(v) => {
            setSourceType(v as 'PROFIT_FIRST' | 'BLANK');
            setPfAccountId(undefined);
            setSelectedIncomeCategoryIds([]);
          }}
          disabled={submitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select wallet type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PROFIT_FIRST">
              <div>
                <div className="font-medium">Profit First</div>
                <div className="text-muted-foreground text-xs">
                  Funded by your Profit First allocation percentage.
                </div>
              </div>
            </SelectItem>
            <SelectItem value="BLANK">
              <div>
                <div className="font-medium">Standalone</div>
                <div className="text-muted-foreground text-xs">
                  Manually managed wallet with no automatic allocation.
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Allocation Account — shown only for PROFIT_FIRST */}
      {sourceType === 'PROFIT_FIRST' && (
        <div className="space-y-2">
          <Label>Allocation Account</Label>
          <Select value={pfAccountId} onValueChange={setPfAccountId} disabled={submitting}>
            <SelectTrigger>
              <SelectValue placeholder="Select allocation account" />
            </SelectTrigger>
            <SelectContent>
              {pfAccounts.map((account) => {
                const isLinked = linkedPfAccountIds.has(account.id);
                return (
                  <SelectItem
                    key={account.id}
                    value={String(account.id)}
                    disabled={isLinked}
                    className={cn(isLinked && 'cursor-not-allowed opacity-50')}
                  >
                    {account.name}
                    {isLinked && ' (already linked)'}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Color Picker */}
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          {COLOR_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setColor(hex)}
              disabled={submitting}
              aria-label={`Select color ${hex}`}
              className={cn(
                'h-6 w-6 rounded-full transition-shadow',
                color === hex && 'ring-2 ring-primary ring-offset-2'
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Income Categories — hidden for PROFIT_FIRST (D-08) */}
      {sourceType !== 'PROFIT_FIRST' && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Income Categories</p>
            <p className="text-muted-foreground text-xs">
              Income from these categories will automatically credit this wallet.
            </p>
          </div>
          <Popover open={incomePickerOpen} onOpenChange={setIncomePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={incomePickerOpen}
                className="w-full justify-between"
                disabled={submitting}
              >
                {selectedIncomeCategoryIds.length > 0
                  ? `${selectedIncomeCategoryIds.length} selected`
                  : 'Search and select categories…'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search income categories…" />
                <CommandList>
                  <CommandEmpty>No categories found.</CommandEmpty>
                  <CommandGroup>
                    {incomeCategories.map((cat) => (
                      <CommandItem
                        key={cat.id}
                        value={cat.name}
                        onSelect={() => toggleIncomeCategory(cat.id)}
                      >
                        <Checkbox
                          checked={selectedIncomeCategoryIds.includes(cat.id)}
                          className="mr-2"
                          onCheckedChange={() => toggleIncomeCategory(cat.id)}
                        />
                        {cat.name}
                        <Check
                          className={cn(
                            'ml-auto h-4 w-4',
                            selectedIncomeCategoryIds.includes(cat.id) ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <Separator />

      {/* Expense Settings — 3-mode radio (D-07) */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Expense Settings</p>
        <RadioGroup
          value={expenseMode}
          onValueChange={(v) => setExpenseMode(v as ExpenseMode)}
          disabled={submitting}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="NONE" id="expense-none" />
            <Label htmlFor="expense-none">No automatic expenses</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ALL" id="expense-all" />
            <Label htmlFor="expense-all">Auto-deduct all expenses</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="CATEGORIES" id="expense-categories" />
            <Label htmlFor="expense-categories">Specific expense categories</Label>
          </div>
        </RadioGroup>

        {/* Expense category picker — shown only when CATEGORIES is selected */}
        {expenseMode === 'CATEGORIES' && (
          <div className="mt-2 space-y-2">
            <Label>Expense Categories</Label>
            <Popover open={expensePickerOpen} onOpenChange={setExpensePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={expensePickerOpen}
                  className="w-full justify-between"
                  disabled={submitting}
                >
                  {selectedExpenseCategoryIds.length > 0
                    ? `${selectedExpenseCategoryIds.length} selected`
                    : 'Search and select categories…'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search expense categories…" />
                  <CommandList>
                    <CommandEmpty>No categories found.</CommandEmpty>
                    <CommandGroup>
                      {expenseCategories.map((cat) => (
                        <CommandItem
                          key={cat.id}
                          value={cat.name}
                          onSelect={() => toggleExpenseCategory(cat.id)}
                        >
                          <Checkbox
                            checked={selectedExpenseCategoryIds.includes(cat.id)}
                            className="mr-2"
                            onCheckedChange={() => toggleExpenseCategory(cat.id)}
                          />
                          {cat.name}
                          <Check
                            className={cn(
                              'ml-auto h-4 w-4',
                              selectedExpenseCategoryIds.includes(cat.id)
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Form-level error */}
      {formError && <p className="text-destructive text-sm">{formError}</p>}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/wallets')}
          disabled={submitting}
        >
          Discard Changes
        </Button>
        <Button type="submit" disabled={submitting} className="ml-auto">
          {submitting ? 'Creating…' : 'Create Wallet'}
        </Button>
      </div>
    </form>
  );
}
