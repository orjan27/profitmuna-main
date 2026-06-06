'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch, ApiError } from '@/server/api';
import type { IncomeCategory } from '@/types/income';

/**
 * Create a new custom income category.
 * Returns { data: category } on success or { error: code } on failure.
 * The API echoes the full category row (incl. userId/system) so callers can
 * insert it into local state without fabricating a placeholder userId (WR-08).
 */
export async function createIncomeCategoryAction(
  name: string
): Promise<{ data: IncomeCategory } | { error: string }> {
  try {
    const result = await apiFetch<{ data: IncomeCategory }>('/api/income-categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    revalidatePath('/income');
    return result;
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.code };
    }
    return { error: 'unknown' };
  }
}

/**
 * Rename a custom income category.
 * Returns { data: category } on success or { error: code } on failure.
 */
export async function renameIncomeCategoryAction(
  id: number,
  name: string
): Promise<{ data: { id: number; name: string } } | { error: string }> {
  try {
    const result = await apiFetch<{ data: { id: number; name: string } }>(
      `/api/income-categories/${id}`,
      { method: 'PUT', body: JSON.stringify({ name }) }
    );
    revalidatePath('/income');
    return result;
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.code };
    }
    return { error: 'unknown' };
  }
}

/**
 * Delete a custom income category.
 * Returns { data: { message } } on success or { error: code } on failure.
 * category_in_use error means records still reference this category.
 */
export async function deleteIncomeCategoryAction(
  id: number
): Promise<{ data: { message: string } } | { error: string }> {
  try {
    const result = await apiFetch<{ data: { message: string } }>(`/api/income-categories/${id}`, {
      method: 'DELETE',
    });
    revalidatePath('/income');
    return result;
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.code };
    }
    return { error: 'unknown' };
  }
}
