'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiFetch, ApiError } from '@/server/api';
import { toCents } from '@/lib/format-currency';

/**
 * Server action to create a new expense.
 * Converts decimal peso amount to integer cents before sending to the API (Pitfall 2 / D-08).
 *
 * @param formData - Form data containing categoryId, amount, expenseDate, paymentMethod, description
 * @returns Error object on failure; redirects to /expenses on success.
 */
export async function createExpenseAction(
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
    await apiFetch('/api/expenses', {
      method: 'POST',
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
      return { error: `Failed to record expense (${err.code}).` };
    }
    return { error: 'Could not reach the server. Please try again.' };
  }

  revalidatePath('/expenses');
  redirect('/expenses');
}
