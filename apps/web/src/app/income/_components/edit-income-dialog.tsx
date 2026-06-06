'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Income, IncomeCategory } from '@/types/income';
import { IncomeForm } from './income-form';
import { updateIncomeAction, deleteIncomeAction } from './income-actions';

interface EditIncomeDialogProps {
  income: Income;
  categories: IncomeCategory[];
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog for editing or deleting an income record (D-05).
 * Reuses IncomeForm with initialValues bound to updateIncomeAction.
 * Delete shows a confirmation step before calling deleteIncomeAction.
 */
export function EditIncomeDialog({ income, categories, open, onClose }: EditIncomeDialogProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteIncomeAction(income.id);
      if (result?.error) {
        toast.error('Failed to delete income. Please try again.');
        setConfirmDelete(false);
        return;
      }
      toast.success('Income deleted.');
      onClose();
    });
  }

  async function handleUpdate(formData: FormData): Promise<{ error: string } | void> {
    const result = await updateIncomeAction(income.id, formData);
    if (result?.error) {
      return result;
    }
    toast.success('Income updated.');
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Income</DialogTitle>
        </DialogHeader>

        {confirmDelete ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this income record? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <IncomeForm
              categories={categories}
              action={handleUpdate}
              initialValues={income}
              submitLabel="Save Changes"
              onCancel={onClose}
            />
            <div className="border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="w-full"
              >
                Delete Income
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
