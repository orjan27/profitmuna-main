'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiFetch, ApiError } from '@/server/api';
import { toCents } from '@/lib/format-currency';

/**
 * Server action: create a new income record.
 * Converts decimal pesos amount to integer cents before sending to API (D-08 / Pitfall 2).
 */
export async function createIncomeAction(formData: FormData): Promise<{ error: string } | void> {
  const rawAmount = Number(formData.get('amount'));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return { error: 'invalid_amount' };
  }
  const amount = toCents(rawAmount); // Pitfall 2: convert pesos → cents before API

  const body = {
    categoryId: Number(formData.get('categoryId')),
    amount,
    description: (formData.get('description') as string) || undefined,
    incomeDate: formData.get('incomeDate') as string,
    moneyStatus: formData.get('moneyStatus') as 'PENDING' | 'RECEIVED',
    expectedReleaseDate: (formData.get('expectedReleaseDate') as string) || undefined,
    // Pitfall 5: profitMunaAllocated defaults true; switch sends 'true'/'false' string
    profitMunaAllocated: formData.get('profitMunaAllocated') === 'true',
  };

  try {
    await apiFetch('/api/incomes', { method: 'POST', body: JSON.stringify(body) });
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.code };
    }
    return { error: 'unknown' };
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
      await apiFetch('/api/recurring-incomes', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: body.categoryId,
          amount: body.amount,
          description: body.description,
          profitMunaAllocated: body.profitMunaAllocated,
          frequency: recurrenceFrequency,
          dayOfWeek: dayField('recurrenceDayOfWeek'),
          dayOfMonth: dayField('recurrenceDayOfMonth'),
          dayOfMonth2: dayField('recurrenceDayOfMonth2'),
          // Prevent same-day double generation by the cron
          lastGeneratedDate: body.incomeDate,
        }),
      });
    } catch (err) {
      console.error('createIncomeAction: recurring template creation failed:', { err });
    }
  }

  revalidatePath('/income');
  redirect('/income');
}
