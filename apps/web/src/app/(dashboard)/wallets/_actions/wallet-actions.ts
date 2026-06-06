'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiFetch, ApiError } from '@/server/api';
import type { CreateWalletInput } from '@/types/wallet';

/**
 * Creates a new wallet via the Workers API.
 * On success: revalidates /wallets and redirects there.
 * On ApiError: returns { error: code } for the form to surface.
 */
export async function createWalletAction(input: CreateWalletInput) {
  try {
    await apiFetch('/api/wallets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
  revalidatePath('/wallets');
  redirect('/wallets');
}

/**
 * Deletes a wallet and returns the impact counts ({ id, transactionCount, mappingCount }).
 * On success: revalidates /wallets.
 * On ApiError: returns { error: code }.
 */
export async function deleteWalletAction(walletId: number) {
  let result: { id: number; transactionCount: number; mappingCount: number } | undefined;
  try {
    const res = await apiFetch<{
      data: { id: number; transactionCount: number; mappingCount: number };
    }>(`/api/wallets/${walletId}`, { method: 'DELETE' });
    result = res.data;
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
  revalidatePath('/wallets');
  return result;
}
