'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiFetch, ApiError } from '@/server/api';
import { toCents } from '@/lib/format-currency';

/**
 * Server action to create a new expense.
 * Converts decimal peso amount to integer cents before sending to the API (Pitfall 2 / D-08).
 *
 * @param formData - Form data containing categoryId, amount, expenseDate, walletId, description
 * @returns Error object on failure; redirects to /expenses on success.
 */
export async function createExpenseAction(
  formData: FormData
): Promise<{ error: string } | undefined> {
  const rawAmount = Number(formData.get('amount'));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return { error: 'Enter a valid amount greater than zero.' };
  }
  const categoryId = Number(formData.get('categoryId'));
  const expenseDate = formData.get('expenseDate') as string;
  const description = (formData.get('description') as string) || undefined;
  const walletId = Number(formData.get('walletId'));
  if (!Number.isInteger(walletId) || walletId <= 0) {
    return { error: 'Select a wallet to pay with.' };
  }

  const amount = toCents(rawAmount);

  try {
    await apiFetch('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        categoryId,
        amount,
        expenseDate,
        description,
        walletId,
      }),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: `Failed to record expense (${err.code}).` };
    }
    return { error: 'Could not reach the server. Please try again.' };
  }

  // Optional recurrence (hidden RecurrenceFields inputs): create the template
  // after the entry. Soft-fail — the recorded entry is never rolled back.
  const recurrenceFrequency = formData.get('recurrenceFrequency') as string | null;
  if (
    recurrenceFrequency === 'WEEKLY' ||
    recurrenceFrequency === 'BIWEEKLY' ||
    recurrenceFrequency === 'MONTHLY'
  ) {
    const dayField = (name: string): number | null => {
      const raw = formData.get(name) as string | null;
      return raw ? Number(raw) : null;
    };
    try {
      await apiFetch('/api/recurring-expenses', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          amount,
          description,
          walletId,
          frequency: recurrenceFrequency,
          dayOfWeek: dayField('recurrenceDayOfWeek'),
          dayOfMonth: dayField('recurrenceDayOfMonth'),
          dayOfMonth2: dayField('recurrenceDayOfMonth2'),
          // Prevent same-day double generation by the cron
          lastGeneratedDate: expenseDate,
        }),
      });
    } catch (err) {
      console.error('createExpenseAction: recurring template creation failed:', { err });
    }
  }

  revalidatePath('/expenses');
  redirect('/expenses');
}
