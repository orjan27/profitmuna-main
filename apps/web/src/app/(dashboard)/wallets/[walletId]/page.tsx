import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import type {
  WalletDetailResponse,
  WalletListItem,
  IncomeCategory,
  ExpenseCategory,
} from '@/types/wallet';

import { WalletDetail } from './_components/WalletDetail';

export default async function WalletDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ walletId: string }>;
  searchParams: Promise<{ page?: string; edit?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { walletId } = await params;
  const { page = '0', edit } = await searchParams;

  // Detail plus the supporting data the edit dialog needs (categories + sibling
  // wallets for D-06 disabled states), fetched in parallel
  const [detail, incomeCategoriesRes, expenseCategoriesRes, walletsRes] = await Promise.all([
    apiFetch<{ data: WalletDetailResponse }>(`/api/wallets/${walletId}?page=${page}&size=20`),
    apiFetch<{ data: IncomeCategory[] }>('/api/income-categories').catch(() => ({
      data: [] as IncomeCategory[],
    })),
    apiFetch<{ data: ExpenseCategory[] }>('/api/expense-categories').catch(() => ({
      data: [] as ExpenseCategory[],
    })),
    apiFetch<{ data: WalletListItem[] }>('/api/wallets').catch(() => ({
      data: [] as WalletListItem[],
    })),
  ]);

  // D-06: categories mapped to a DIFFERENT wallet appear disabled in the edit pickers
  const otherWallets = (walletsRes.data ?? []).filter((w) => w.id !== detail.data.wallet.id);
  const mappedIncomeCategoryIds = new Set(otherWallets.flatMap((w) => w.incomeCategoryIds ?? []));
  const mappedExpenseCategoryIds = new Set(otherWallets.flatMap((w) => w.expenseCategoryIds ?? []));
  const otherWalletHasAutoDeductAll = otherWallets.some((w) => w.autoDeductAllExpenses);

  return (
    <WalletDetail
      detail={detail.data}
      incomeCategories={incomeCategoriesRes.data ?? []}
      expenseCategories={expenseCategoriesRes.data ?? []}
      mappedIncomeCategoryIds={mappedIncomeCategoryIds}
      mappedExpenseCategoryIds={mappedExpenseCategoryIds}
      otherWalletHasAutoDeductAll={otherWalletHasAutoDeductAll}
      initialEditOpen={edit === '1'}
    />
  );
}
