'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch, ApiError } from '@/server/api';
import { toCents } from '@/lib/format-currency';

import type { ExpenseRow } from './edit-expense-dialog';

interface PaginatedExpenses {
  content: ExpenseRow[];
  page: number;
  last: boolean;
  totalElements: number;
}

/**
 * Load a page of expense records for the load-more affordance.
 * Called from the ExpensesOverview client component — client components must
 * not import the server-only apiFetch directly.
 *
 * @returns The page content plus a `last` flag signalling no more pages.
 */
export async function fetchExpensesAction(params: {
  page: number;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<PaginatedExpenses> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit ?? 20),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  });
  return apiFetch<PaginatedExpenses>(`/api/expenses?${qs.toString()}`);
}

/**
 * Update an existing expense by ID.
 * Converts decimal peso amount to integer cents (D-08).
 *
 * @param id - Expense ID to update
 * @param formData - Form data with updated fields
 */
export async function updateExpenseAction(
  id: number,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const rawAmount = Number(formData.get('amount'));
  const categoryId = Number(formData.get('categoryId'));
  const expenseDate = formData.get('expenseDate') as string;
  const description = (formData.get('description') as string) || undefined;
  const paymentMethodRaw = formData.get('paymentMethod') as string | null;
  const paymentMethod = paymentMethodRaw || null;

  const amount = toCents(rawAmount);

  try {
    await apiFetch(`/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        categoryId,
        amount,
        expenseDate,
        description,
        paymentMethod,
      }),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: `Failed to update expense (${err.code}).` };
    }
    return { error: 'Could not reach the server. Please try again.' };
  }

  revalidatePath('/expenses');
}

/**
 * Soft-delete an expense by ID.
 * The API sets deletedAt; the expense is excluded from totals but restorable.
 *
 * @param id - Expense ID to soft-delete
 */
export async function deleteExpenseAction(id: number): Promise<{ error: string } | undefined> {
  try {
    await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: `Failed to delete expense (${err.code}).` };
    }
    return { error: 'Could not reach the server. Please try again.' };
  }

  revalidatePath('/expenses');
}

/**
 * Restore a soft-deleted expense by ID.
 * Calls PATCH /api/expenses/:id/restore to clear deletedAt.
 *
 * @param id - Expense ID to restore
 */
export async function restoreExpenseAction(id: number): Promise<{ error: string } | undefined> {
  try {
    await apiFetch(`/api/expenses/${id}/restore`, { method: 'PATCH' });
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: `Failed to restore expense (${err.code}).` };
    }
    return { error: 'Could not reach the server. Please try again.' };
  }

  revalidatePath('/expenses');
}
