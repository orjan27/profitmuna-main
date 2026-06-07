'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  createExpenseCategoryAction,
  renameExpenseCategoryAction,
  deleteExpenseCategoryAction,
} from './category-actions';

interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}

interface ManageCategoriesDialogProps {
  categories: ExpenseCategory[];
  /** Controlled mode: when provided, the internal trigger button is not rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Dialog for managing expense categories (D-11).
 * - System categories: displayed with "(default)" label, edit/delete controls disabled.
 * - Custom categories: inline rename, delete (blocked if in use via category_in_use error).
 * - Add new custom category via text input at the bottom.
 *
 * Supports controlled open state so it can be launched from a menu item
 * (the page header's overflow menu) instead of its own trigger button.
 */
export function ManageCategoriesDialog({
  categories,
  open: controlledOpen,
  onOpenChange,
}: ManageCategoriesDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => undefined)) : setInternalOpen;
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleStartEdit(cat: ExpenseCategory) {
    setEditingId(cat.id);
    setEditingName(cat.name);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditingName('');
  }

  function handleRename(id: number) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await renameExpenseCategoryAction(id, trimmed);
      if ('error' in result) {
        toast.error(
          result.error === 'cannot_edit_system_category'
            ? 'System categories cannot be edited.'
            : result.error === 'category_exists'
              ? 'A category with that name already exists.'
              : 'Failed to rename category. Please try again.'
        );
      } else {
        toast.success('Category renamed.');
        setEditingId(null);
        setEditingName('');
        // Dialog reflects new name after revalidatePath triggers RSC re-render
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteExpenseCategoryAction(id);
      if ('error' in result) {
        if (result.error === 'category_in_use') {
          toast.error('Category is in use — reassign or delete those records first.');
        } else if (result.error === 'cannot_delete_system_category') {
          toast.error('System categories cannot be deleted.');
        } else {
          toast.error('Failed to delete category. Please try again.');
        }
      } else {
        toast.success('Category deleted.');
      }
    });
  }

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createExpenseCategoryAction(trimmed);
      if ('error' in result) {
        toast.error(
          result.error === 'category_exists'
            ? 'A category with that name already exists.'
            : 'Failed to create category. Please try again.'
        );
      } else {
        toast.success(`"${trimmed}" added.`);
        setNewName('');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isControlled ? null : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Manage categories
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Expense Categories</DialogTitle>
        </DialogHeader>

        <ul className="divide-y divide-border rounded-md border">
          {categories.map((cat) => (
            <li key={cat.id} className="flex items-center gap-2 px-3 py-2">
              {editingId === cat.id ? (
                <>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(cat.id);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="h-7 flex-1 text-sm"
                    autoFocus
                    aria-label="Rename category"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleRename(cat.id)}
                    disabled={isPending}
                    aria-label="Confirm rename"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleCancelEdit}
                    disabled={isPending}
                    aria-label="Cancel rename"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">
                    {cat.name}
                    {cat.system ? (
                      <span className="ml-2 text-xs text-muted-foreground">(default)</span>
                    ) : null}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleStartEdit(cat)}
                    disabled={isPending || cat.system}
                    aria-label={`Rename ${cat.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(cat.id)}
                    disabled={isPending || cat.system}
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>

        {/* Add new category */}
        <div className="flex gap-2 pt-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="New category name"
            className="flex-1"
            aria-label="New expense category name"
          />
          <Button onClick={handleAdd} disabled={isPending || !newName.trim()}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
