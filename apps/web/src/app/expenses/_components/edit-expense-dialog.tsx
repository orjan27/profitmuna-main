'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExpenseForm } from './expense-form';
import { updateExpenseAction, deleteExpenseAction } from './expense-actions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}

export interface ExpenseRow {
  id: number;
  categoryId: number;
  categoryName: string;
  /** Amount in cents */
  amount: number;
  description: string | null;
  expenseDate: string;
  paymentMethod: string | null;
  deletedAt: string | null;
}

interface EditExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseRow;
  categories: ExpenseCategory[];
  /** Called after a successful edit or delete so the parent can refresh state */
  onMutated: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Dialog for editing a single expense row (D-05).
 *
 * Reuses ExpenseForm with initialValues bound to the row.
 * Includes a (soft) Delete button with a confirmation step.
 * All mutations call revalidatePath('/expenses') via server actions.
 */
export function EditExpenseDialog({
  open,
  onOpenChange,
  expense,
  categories,
  onMutated,
}: EditExpenseDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleFormSuccess() {
    onOpenChange(false);
    onMutated();
  }

  function boundUpdateAction(formData: FormData) {
    return updateExpenseAction(expense.id, formData);
  }

  function handleDeleteClick() {
    setConfirmDelete(true);
  }

  function handleDeleteCancel() {
    setConfirmDelete(false);
  }

  function handleDeleteConfirm() {
    startDeleteTransition(async () => {
      const result = await deleteExpenseAction(expense.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success('Expense deleted.');
        setConfirmDelete(false);
        onOpenChange(false);
        onMutated();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
        </DialogHeader>

        {confirmDelete ? (
          /* Confirm step for soft delete */
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              Delete this expense? It will be excluded from totals but can be restored later.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={handleDeleteCancel} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete Expense'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ExpenseForm
              categories={categories}
              action={boundUpdateAction}
              initialValues={{
                categoryId: expense.categoryId,
                amount: expense.amount,
                expenseDate: expense.expenseDate,
                paymentMethod: expense.paymentMethod,
                description: expense.description,
              }}
              onSuccess={handleFormSuccess}
            />
            <div className="border-t pt-4">
              <Button
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleDeleteClick}
                type="button"
              >
                Delete Expense
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
