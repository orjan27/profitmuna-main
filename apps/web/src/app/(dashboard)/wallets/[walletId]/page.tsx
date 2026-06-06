import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import type { WalletDetailResponse } from '@/types/wallet';

import { WalletDetail } from './_components/WalletDetail';

export default async function WalletDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ walletId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { walletId } = await params;
  const { page = '0' } = await searchParams;

  const detail = await apiFetch<{ data: WalletDetailResponse }>(
    `/api/wallets/${walletId}?page=${page}&size=20`
  );

  return <WalletDetail detail={detail.data} />;
}
