import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch, ApiError } from '@/server/api';
import type { RecurringExpenseListResponse } from '@/types/recurring';
import { ExpensesOverview } from './_components/expenses-overview';

interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}

interface Expense {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  walletId: number | null;
  walletName: string | null;
  deletedAt: string | null;
  createdAt: string | null;
}

interface PaginatedExpenses {
  content: Expense[];
  page: number;
  last: boolean;
  totalElements: number;
}

interface WalletListItem {
  id: number;
  name: string;
  isDefault: boolean;
}

interface SearchParams {
  from?: string;
  to?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

/**
 * RSC for /expenses.
 * Reads searchParams for SSR date filter.
 * Guards with getSession → redirect to /login when unauthenticated.
 */
export default async function ExpensesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const qs = new URLSearchParams({ page: '0', limit: '20' });
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);

  let expensesData: PaginatedExpenses;
  let categoriesData: { data: ExpenseCategory[] };
  let walletsData: { data: WalletListItem[] };
  let recurringData: RecurringExpenseListResponse;
  try {
    [expensesData, categoriesData, walletsData, recurringData] = await Promise.all([
      apiFetch<PaginatedExpenses>(`/api/expenses?${qs.toString()}`),
      apiFetch<{ data: ExpenseCategory[] }>('/api/expense-categories'),
      apiFetch<{ data: WalletListItem[] }>('/api/wallets'),
      apiFetch<RecurringExpenseListResponse>('/api/recurring-expenses'),
    ]);
  } catch (err) {
    // A decodable-but-rejected token passes getSession but 401s at the API
    // (expired session after a failed silent refresh). Send the user to
    // login instead of crashing the page.
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  const wallets = walletsData.data.map((w) => ({ id: w.id, name: w.name }));
  const defaultWalletId = walletsData.data.find((w) => w.isDefault)?.id ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ExpensesOverview
        initialData={expensesData}
        categories={categoriesData.data}
        wallets={wallets}
        defaultWalletId={defaultWalletId}
        recurring={recurringData.data}
      />
    </div>
  );
}
