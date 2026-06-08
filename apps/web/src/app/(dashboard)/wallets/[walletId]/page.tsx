import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import type {
  WalletDetailResponse,
  WalletListItem,
  IncomeCategory,
  PfAccount,
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

  // Detail plus the supporting data the page needs, fetched in parallel:
  // income categories + sibling wallets for the edit dialog (D-06 disabled
  // states), PF summary for the hero card's allocation footer
  const [detail, incomeCategoriesRes, walletsRes, pfSummaryRes] = await Promise.all([
    apiFetch<{ data: WalletDetailResponse }>(`/api/wallets/${walletId}?page=${page}&size=20`),
    apiFetch<{ data: IncomeCategory[] }>('/api/income-categories').catch(() => ({
      data: [] as IncomeCategory[],
    })),
    apiFetch<{ data: WalletListItem[] }>('/api/wallets').catch(() => ({
      data: [] as WalletListItem[],
    })),
    apiFetch<{ data: { accounts: PfAccount[] } }>('/api/profit-first/summary').catch(() => ({
      data: { accounts: [] as PfAccount[] },
    })),
  ]);

  // D-06: income categories mapped to a DIFFERENT wallet appear disabled in the edit picker
  const otherWallets = (walletsRes.data ?? []).filter((w) => w.id !== detail.data.wallet.id);
  const mappedIncomeCategoryIds = new Set(otherWallets.flatMap((w) => w.incomeCategoryIds ?? []));

  // Linked PF account — hero footer shows its name and allocation percentage
  const pfAccount =
    detail.data.wallet.profitFirstAccountId != null
      ? (pfSummaryRes.data.accounts.find((a) => a.id === detail.data.wallet.profitFirstAccountId) ??
        null)
      : null;

  return (
    <WalletDetail
      detail={detail.data}
      pfAccount={pfAccount}
      incomeCategories={incomeCategoriesRes.data ?? []}
      mappedIncomeCategoryIds={mappedIncomeCategoryIds}
      initialEditOpen={edit === '1'}
    />
  );
}
