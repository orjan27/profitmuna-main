import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch, ApiError } from '@/server/api';
import type { PmAccount, IncomeCategory, WalletListItem } from '@/types/wallet';
import { NewWalletForm } from './_components/NewWalletForm';

type PmSummaryResponse = {
  data: {
    accounts: PmAccount[];
  };
};

type IncomeCategoryResponse = {
  data: IncomeCategory[];
};

type WalletListResponse = {
  data: WalletListItem[];
};

export default async function NewWalletPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const prefilledPmAccountId = params.pmAccountId ? Number(params.pmAccountId) : undefined;

  // Fetch PF accounts, income categories, and wallet list in parallel
  const [pmSummary, incomeCategoriesRes, walletsRes] = await Promise.all([
    apiFetch<PmSummaryResponse>('/api/profit-muna/summary').catch((err) => {
      if (err instanceof ApiError && err.status === 404) return { data: { accounts: [] } };
      throw err;
    }),
    apiFetch<IncomeCategoryResponse>('/api/income-categories'),
    apiFetch<WalletListResponse>('/api/wallets').catch(() => ({ data: [] as WalletListItem[] })),
  ]);

  const pmAccounts = pmSummary.data.accounts ?? [];
  const wallets = walletsRes.data ?? [];

  // Filter to unlinked PF accounts — wallets with a profitMunaAccountId already claimed
  const linkedPmAccountIds = new Set(
    wallets
      .filter((w) => w.profitMunaAccountId != null)
      .map((w) => w.profitMunaAccountId as number)
  );

  // D-06: income categories already mapped to another wallet appear disabled in the picker
  const mappedIncomeCategoryIds = new Set(wallets.flatMap((w) => w.incomeCategoryIds ?? []));

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Create Wallet</h1>
      <NewWalletForm
        pmAccounts={pmAccounts}
        linkedPmAccountIds={linkedPmAccountIds}
        incomeCategories={incomeCategoriesRes.data ?? []}
        prefilledPmAccountId={prefilledPmAccountId}
        mappedIncomeCategoryIds={mappedIncomeCategoryIds}
      />
    </div>
  );
}
