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
    // Pitfall 5: profitFirstAllocated defaults true; switch sends 'true'/'false' string
    profitFirstAllocated: formData.get('profitFirstAllocated') === 'true',
  };

  try {
    await apiFetch('/api/incomes', { method: 'POST', body: JSON.stringify(body) });
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.code };
    }
    return { error: 'unknown' };
  }

  revalidatePath('/income');
  redirect('/income');
}
