'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

import { updateWalletAction } from '../../_actions/wallet-actions';
import type { WalletListItem, IncomeCategory } from '@/types/wallet';

// 8 preset color swatches per D-15 and UI-SPEC — mirrors NewWalletForm
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

interface EditWalletDialogProps {
  open: boolean;
  onClose: () => void;
  wallet: WalletListItem;
  incomeCategories: IncomeCategory[];
  /** D-06: category ids already mapped to a DIFFERENT wallet — disabled in picker */
  mappedIncomeCategoryIds: Set<number>;
}

/**
 * Dialog for editing a wallet's mutable fields: name, color, and income category
 * mappings (hidden for PF-linked wallets per D-08).
 * Wallet type and PF account link are immutable after creation.
 */
export function EditWalletDialog({
  open,
  onClose,
  wallet,
  incomeCategories,
  mappedIncomeCategoryIds,
}: EditWalletDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const isPfWallet = wallet.profitFirstAccountId != null;

  // Form state — prefilled from the wallet's current values
  const [name, setName] = useState(wallet.name);
  const [color, setColor] = useState(wallet.color);
  const [selectedIncomeCategoryIds, setSelectedIncomeCategoryIds] = useState<number[]>(
    wallet.incomeCategoryIds
  );

  // Combobox open state
  const [incomePickerOpen, setIncomePickerOpen] = useState(false);

  // Validation error
  const [formError, setFormError] = useState<string | null>(null);

  function toggleIncomeCategory(id: number) {
    setSelectedIncomeCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleOpenChange(o: boolean) {
    if (!o) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Wallet Name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await updateWalletAction(wallet.id, {
        name: name.trim(),
        color,
        // D-08: PF wallets never touch income mappings
        incomeCategoryIds: isPfWallet ? undefined : selectedIncomeCategoryIds,
      });

      if (result?.error) {
        const code = result.error;
        if (code === 'income_category_already_mapped') {
          setFormError('Already mapped to another wallet — remove it there first.');
        } else {
          setFormError('Something went wrong. Please try again.');
        }
        return;
      }

      toast.success('Wallet updated.');
      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Wallet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Wallet Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-wallet-name">Wallet Name</Label>
            <Input
              id="edit-wallet-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              maxLength={80}
            />
          </div>

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

          {/* Income Categories — hidden for PF-linked wallets (D-08) */}
          {!isPfWallet && (
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
                        {incomeCategories.map((cat) => {
                          // D-06: mapped to a different wallet — disabled, server enforces 409
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
          )}

          {/* Form-level error */}
          {formError && <p className="text-destructive text-sm">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Close
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
