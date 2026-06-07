'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiFetch, ApiError } from '@/server/api';
import type {
  CreateWalletInput,
  UpdateWalletInput,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '@/types/wallet';

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
 * Updates a wallet's mutable fields (name, color, income mappings).
 * On success: revalidates /wallets and the wallet detail page.
 * On ApiError: returns { error: code } for the form to surface.
 */
export async function updateWalletAction(
  walletId: number,
  input: UpdateWalletInput
): Promise<{ error: string } | undefined> {
  try {
    await apiFetch(`/api/wallets/${walletId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
  revalidatePath('/wallets');
  revalidatePath(`/wallets/${walletId}`);
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

/**
 * Creates a manual transaction on a wallet.
 * Caller converts pesos → cents via toCents before passing input.amount.
 * Returns raw error code on ApiError (blocking codes mapped to copy in the component).
 */
export async function createTransactionAction(
  walletId: number,
  input: CreateTransactionInput
): Promise<{ error: string } | undefined> {
  try {
    await apiFetch(`/api/wallets/${walletId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
  revalidatePath(`/wallets/${walletId}`);
}

/**
 * Updates a manual transaction's mutable fields.
 * Returns raw error code on ApiError.
 */
export async function updateTransactionAction(
  walletId: number,
  txId: number,
  input: UpdateTransactionInput
): Promise<{ error: string } | undefined> {
  try {
    await apiFetch(`/api/wallets/${walletId}/transactions/${txId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
  revalidatePath(`/wallets/${walletId}`);
}

/**
 * Soft-deletes a manual transaction (sets deletedAt server-side).
 * Returns raw error code on ApiError.
 */
export async function deleteTransactionAction(
  walletId: number,
  txId: number
): Promise<{ error: string } | undefined> {
  try {
    await apiFetch(`/api/wallets/${walletId}/transactions/${txId}`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
  revalidatePath(`/wallets/${walletId}`);
}

/**
 * Restores a soft-deleted transaction (clears deletedAt server-side).
 * Returns raw error code on ApiError.
 */
export async function restoreTransactionAction(
  walletId: number,
  txId: number
): Promise<{ error: string } | undefined> {
  try {
    await apiFetch(`/api/wallets/${walletId}/transactions/${txId}/restore`, { method: 'PATCH' });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
  revalidatePath(`/wallets/${walletId}`);
}
