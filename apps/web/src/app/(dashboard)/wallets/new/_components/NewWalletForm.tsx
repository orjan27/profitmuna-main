'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { toast } from 'sonner';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormActions } from '@/components/FormActions';
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
import type { PfAccount, IncomeCategory } from '@/types/wallet';

// 8 preset color swatches per D-15 and UI-SPEC
const COLOR_SWATCHES = [
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#8b5cf6', name: 'Violet' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#f43f5e', name: 'Rose' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#f97316', name: 'Orange' },
] as const;

interface NewWalletFormProps {
  pfAccounts: PfAccount[];
  linkedPfAccountIds: Set<number>;
  incomeCategories: IncomeCategory[];
  prefilledPfAccountId?: number;
  /** D-06: categories already mapped to another wallet appear disabled in the picker */
  mappedIncomeCategoryIds: Set<number>;
}

export function NewWalletForm({
  pfAccounts,
  linkedPfAccountIds,
  incomeCategories,
  prefilledPfAccountId,
  mappedIncomeCategoryIds,
}: NewWalletFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Sentinel value for the "no allocation" (standalone) option — shadcn Select cannot hold an empty value
  const STANDALONE = '__standalone__';

  // Form state
  const [name, setName] = useState('');
  // Allocation account drives PF-ness: a chosen account = PF wallet, STANDALONE sentinel = standalone.
  // D-04: a quick-create link arriving with ?pfAccountId pre-selects that account.
  const [pfAccountId, setPfAccountId] = useState<string>(
    prefilledPfAccountId ? String(prefilledPfAccountId) : STANDALONE
  );
  // Non-sentinel selection means the wallet is funded by a Profit First allocation
  const isPf = pfAccountId !== STANDALONE;
  const [color, setColor] = useState<string>(COLOR_SWATCHES[0].hex);
  const [selectedIncomeCategoryIds, setSelectedIncomeCategoryIds] = useState<number[]>([]);

  // Combobox open state
  const [incomePickerOpen, setIncomePickerOpen] = useState(false);

  // Validation error
  const [formError, setFormError] = useState<string | null>(null);

  function toggleIncomeCategory(id: number) {
    setSelectedIncomeCategoryIds((prev) =>
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

    setSubmitting(true);
    try {
      const result = await createWalletAction({
        name: name.trim(),
        profitFirstAccountId: isPf ? Number(pfAccountId) : null,
        color,
        incomeCategoryIds: !isPf ? selectedIncomeCategoryIds : undefined,
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

      {/* Allocation Account — optional; blank (Standalone) means no Profit First funding */}
      <div className="space-y-2">
        <Label htmlFor="allocation-account">Allocation Account</Label>
        <Select
          value={pfAccountId}
          onValueChange={(v) => {
            setPfAccountId(v);
            // Income-category mappings are not valid for PF-funded wallets (D-08) — clear on switch to PF
            if (v !== STANDALONE) setSelectedIncomeCategoryIds([]);
          }}
          disabled={submitting}
        >
          <SelectTrigger id="allocation-account" className="w-full">
            <SelectValue placeholder="Select allocation account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STANDALONE}>Standalone (no allocation)</SelectItem>
            {pfAccounts.map((account) => {
              const isLinked = linkedPfAccountIds.has(account.id);
              return (
                <SelectItem key={account.id} value={String(account.id)} disabled={isLinked}>
                  {account.name}
                  {isLinked && <span className="text-muted-foreground">(already linked)</span>}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Standalone wallets are managed manually with no automatic allocation.
        </p>
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-3">
          {COLOR_SWATCHES.map(({ hex, name: colorName }) => (
            <button
              key={hex}
              type="button"
              onClick={() => setColor(hex)}
              disabled={submitting}
              aria-label={`Select color ${colorName}`}
              aria-pressed={color === hex}
              className={cn(
                'h-8 w-8 rounded-full transition-shadow',
                color === hex && 'ring-primary ring-offset-background ring-2 ring-offset-2'
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      {/* Income Categories — hidden for PF-funded wallets (D-08); separator lives
          inside the conditional so hiding the section doesn't stack two hairlines */}
      {!isPf && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="income-categories-trigger">Income Categories</Label>
              <p className="text-muted-foreground text-xs">
                Income from these categories will automatically credit this wallet.
              </p>
            </div>
            <Popover open={incomePickerOpen} onOpenChange={setIncomePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="income-categories-trigger"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={incomePickerOpen}
                  className="w-full justify-between"
                  disabled={submitting}
                >
                  {selectedIncomeCategoryIds.length > 0
                    ? `${selectedIncomeCategoryIds.length} selected`
                    : 'Select categories…'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search income categories…" />
                  <CommandList>
                    <CommandEmpty>No categories found.</CommandEmpty>
                    <CommandGroup>
                      {incomeCategories.map((cat) => {
                        // D-06: already mapped to another wallet — disabled, server enforces 409
                        const isMapped = mappedIncomeCategoryIds.has(cat.id);
                        return (
                          <CommandItem
                            key={cat.id}
                            value={cat.name}
                            disabled={isMapped}
                            onSelect={() => toggleIncomeCategory(cat.id)}
                          >
                            <Checkbox
                              checked={selectedIncomeCategoryIds.includes(cat.id)}
                              disabled={isMapped}
                              className="mr-2"
                              onCheckedChange={() => toggleIncomeCategory(cat.id)}
                            />
                            {cat.name}
                            {isMapped && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                (already mapped)
                              </span>
                            )}
                            <Check
                              className={cn(
                                'ml-auto h-4 w-4',
                                selectedIncomeCategoryIds.includes(cat.id)
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}

      {/* Form-level error */}
      {formError && (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      )}

      {/* Actions */}
      <FormActions className="md:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/wallets')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Wallet'}
        </Button>
      </FormActions>
    </form>
  );
}
