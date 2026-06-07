'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Income } from '@/types/income';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import { receiveIncomeAction } from './income-actions';

interface ReceiveIncomeDialogProps {
  income: Income;
  open: boolean;
  onClose: () => void;
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
 * Confirmation dialog for marking a PENDING income as RECEIVED (D-14 / INC-05).
 * Provides a date input defaulting to today; editable for backdating.
 * Only reachable from PENDING rows in the income list.
 */
export function ReceiveIncomeDialog({ income, open, onClose }: ReceiveIncomeDialogProps) {
  const formatCurrency = useFormatCurrency();
  const [receivedDate, setReceivedDate] = useState(todayLocal());
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await receiveIncomeAction(income.id, receivedDate);
      if (result?.error) {
        toast.error('Failed to mark income as received. Please try again.');
        return;
      }
      toast.success('Income marked as received.');
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as Received</DialogTitle>
          <DialogDescription>
            Confirm that {formatCurrency(income.amount)} ({income.categoryName}) has been received.
            You can backdate the received date if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="receive-date">Received Date</Label>
          <Input
            id="receive-date"
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            max={todayLocal()}
            aria-label="Date the income was received"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !receivedDate}>
            {isPending ? 'Confirming…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
