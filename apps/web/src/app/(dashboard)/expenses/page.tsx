import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
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
  paymentMethod: string | null;
  deletedAt: string | null;
  createdAt: string | null;
}

interface PaginatedExpenses {
  content: Expense[];
  page: number;
  last: boolean;
  totalElements: number;
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

  const [expensesData, categoriesData] = await Promise.all([
    apiFetch<PaginatedExpenses>(`/api/expenses?${qs.toString()}`),
    apiFetch<{ data: ExpenseCategory[] }>('/api/expense-categories'),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ExpensesOverview initialData={expensesData} categories={categoriesData.data} />
    </div>
  );
}
