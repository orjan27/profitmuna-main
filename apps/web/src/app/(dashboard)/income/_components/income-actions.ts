'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch, ApiError } from '@/server/api';
import { toCents } from '@/lib/format-currency';
import type { Income } from '@/types/income';

/** Response shape from the API paginated income list. */
interface IncomePageResult {
  content: Income[];
  page: number;
  last: boolean;
}

/**
 * Load a page of income records for the load-more affordance.
 * Called from the IncomeOverview client component.
 *
 * @returns The page content plus a `last` flag signalling no more pages.
 */
export async function fetchIncomesAction(params: {
  page: number;
  limit?: number;
  search?: string;
  moneyStatus?: string;
  from?: string;
  to?: string;
}): Promise<IncomePageResult> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit ?? 20),
    ...(params.search ? { search: params.search } : {}),
    ...(params.moneyStatus ? { moneyStatus: params.moneyStatus } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  }).toString();

  const res = await apiFetch<{ data: IncomePageResult }>(`/api/incomes?${qs}`);
  return res.data;
}

/**
 * Update an existing income record.
 * Converts the decimal pesos amount to integer cents (Pitfall 2).
 */
export async function updateIncomeAction(
  id: number,
  formData: FormData
): Promise<{ error: string } | void> {
  const rawAmount = Number(formData.get('amount'));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return { error: 'invalid_amount' };
  }
  const body: Record<string, unknown> = {
    categoryId: Number(formData.get('categoryId')),
    amount: toCents(rawAmount),
    description: (formData.get('description') as string) || undefined,
    incomeDate: formData.get('incomeDate') as string,
    moneyStatus: formData.get('moneyStatus') as 'PENDING' | 'RECEIVED',
    expectedReleaseDate: (formData.get('expectedReleaseDate') as string) || undefined,
    profitFirstAllocated: formData.get('profitFirstAllocated') === 'true',
  };

  try {
    await apiFetch(`/api/incomes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidatePath('/income');
}

/**
 * Hard-delete an income record.
 */
export async function deleteIncomeAction(id: number): Promise<{ error: string } | void> {
  try {
    await apiFetch(`/api/incomes/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidatePath('/income');
}

/**
 * Mark a PENDING income as RECEIVED with an optional backdated received date.
 * Does NOT change profitFirstAllocated (T-02-08 — API enforces this too).
 */
export async function receiveIncomeAction(
  id: number,
  receivedDate?: string
): Promise<{ error: string } | void> {
  try {
    await apiFetch(`/api/incomes/${id}/receive`, {
      method: 'PUT',
      body: JSON.stringify({ receivedDate }),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }

  revalidatePath('/income');
}
