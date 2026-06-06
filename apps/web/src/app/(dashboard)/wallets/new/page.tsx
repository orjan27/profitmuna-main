import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch, ApiError } from '@/server/api';
import type { PfAccount, IncomeCategory, ExpenseCategory, WalletListItem } from '@/types/wallet';
import { NewWalletForm } from './_components/NewWalletForm';

type PfSummaryResponse = {
  data: {
    accounts: PfAccount[];
  };
};

type IncomeCategoryResponse = {
  data: IncomeCategory[];
};

type ExpenseCategoryResponse = {
  data: ExpenseCategory[];
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
  const prefilledPfAccountId = params.pfAccountId ? Number(params.pfAccountId) : undefined;

  // Fetch PF accounts, income categories, expense categories, and wallet list in parallel
  const [pfSummary, incomeCategoriesRes, expenseCategoriesRes, walletsRes] = await Promise.all([
    apiFetch<PfSummaryResponse>('/api/profit-first/summary').catch((err) => {
      if (err instanceof ApiError && err.status === 404) return { data: { accounts: [] } };
      throw err;
    }),
    apiFetch<IncomeCategoryResponse>('/api/income-categories'),
    apiFetch<ExpenseCategoryResponse>('/api/expense-categories'),
    apiFetch<WalletListResponse>('/api/wallets').catch(() => ({ data: [] as WalletListItem[] })),
  ]);

  const pfAccounts = pfSummary.data.accounts ?? [];
  const wallets = walletsRes.data ?? [];

  // Filter to unlinked PF accounts — wallets with a profitFirstAccountId already claimed
  const linkedPfAccountIds = new Set(
    wallets
      .filter((w) => w.profitFirstAccountId != null)
      .map((w) => w.profitFirstAccountId as number)
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">Create Wallet</h1>
      <NewWalletForm
        pfAccounts={pfAccounts}
        linkedPfAccountIds={linkedPfAccountIds}
        incomeCategories={incomeCategoriesRes.data ?? []}
        expenseCategories={expenseCategoriesRes.data ?? []}
        prefilledPfAccountId={prefilledPfAccountId}
      />
    </div>
  );
}
