'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PF_DEFAULT_COLORS } from '@/lib/constants';
import { createAccountAction, updateAccountAction } from '@/server/profit-first-actions';
import type { PfAccount } from './pf-overview';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PfAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Provide an account to edit; omit for create mode */
  account?: PfAccount;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Create / Edit account dialog.
 *
 * Reused for both modes:
 * - Create: no `account` prop; title "Add Account"
 * - Edit:   `account` prop supplied; title "Edit Account"; fields pre-filled
 *
 * Color selection uses PF_DEFAULT_COLORS as preset swatches only (D-08).
 * No free hex input — API z.enum enforces the preset palette server-side (T-03-11).
 *
 * T-03-06: account name rendered as text content / input value — no
 * dangerouslySetInnerHTML.
 */
export function PfAccountForm({ open, onOpenChange, account }: PfAccountFormProps) {
  const router = useRouter();
  const isEdit = account !== undefined;

  const [name, setName] = useState(account?.name ?? '');
  const [targetPercent, setTargetPercent] = useState(
    account ? String(account.targetPercentage) : ''
  );
  const [color, setColor] = useState<string>(account?.color ?? PF_DEFAULT_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  // Reset form state when dialog opens for a new context
  function handleOpenChange(next: boolean) {
    if (!next) {
      // Delay reset until after close animation to avoid flash
      setTimeout(() => {
        setName(account?.name ?? '');
        setTargetPercent(account ? String(account.targetPercentage) : '');
        setColor(account?.color ?? PF_DEFAULT_COLORS[0]);
        setSubmitting(false);
      }, 200);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const parsed = parseFloat(targetPercent);
    if (!name.trim()) {
      toast.error('Account name is required.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast.error('Target % must be a number between 0 and 100.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const result = await updateAccountAction(account.id, {
          name: name.trim(),
          targetPercentage: parsed,
          color,
        });
        if (!result.ok) {
          toast.error(result.message ?? 'Something went wrong. Please try again.');
          return;
        }
        toast.success('Account updated.');
      } else {
        const result = await createAccountAction({
          name: name.trim(),
          targetPercentage: parsed,
          color,
        });
        if (!result.ok) {
          toast.error(result.message ?? 'Something went wrong. Please try again.');
          return;
        }
        toast.success('Account created.');
      }
      handleOpenChange(false);
      router.refresh();
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Account' : 'Add Account'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Account Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pf-account-name">Account Name</Label>
            <Input
              id="pf-account-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Emergency Fund"
              disabled={submitting}
              required
            />
          </div>

          {/* Target % */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pf-account-percent">Target %</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="pf-account-percent"
                type="number"
                min={0}
                max={100}
                step={1}
                value={targetPercent}
                onChange={(e) => setTargetPercent(e.target.value)}
                className="w-24 text-right tabular-nums"
                placeholder="0"
                disabled={submitting}
                required
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          {/* Color — preset swatches only (D-08; T-03-11) */}
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <div className="flex gap-1.5 flex-wrap">
              {PF_DEFAULT_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Select color ${hex}`}
                  aria-pressed={color === hex}
                  onClick={() => setColor(hex)}
                  disabled={submitting}
                  className={cn(
                    'h-7 w-7 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    color === hex
                      ? 'ring-2 ring-ring ring-offset-2'
                      : 'opacity-80 hover:opacity-100'
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
