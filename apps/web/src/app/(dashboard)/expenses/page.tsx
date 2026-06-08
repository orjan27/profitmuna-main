import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch, ApiError } from '@/server/api';
import type { RecurringExpenseListResponse } from '@/types/recurring';
import type { LedgerStatsResponse } from '@/types/stats';
import { ledgerStatsDateParams } from '@/lib/ledger-period';
import { resolveOverviewRange, resolvePresetLabel } from '@/lib/overview-date-presets';
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
 * Resolves the URL `from`/`to` (DateRangeSelect) to date bounds for both the ledger
 * list and the stats aggregate. Guards with getSession → redirect to /login
 * when unauthenticated.
 */
export default async function ExpensesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const range = resolveOverviewRange(params.from, params.to);
  const periodLabel = resolvePresetLabel(params.from, params.to);
  const statsDate = ledgerStatsDateParams();

  const listQs = new URLSearchParams({ page: '0', limit: '20' });
  if (range.from) listQs.set('from', range.from);
  if (range.to) listQs.set('to', range.to);

  const statsQs = new URLSearchParams({
    year: statsDate.year,
    month: statsDate.month,
    prevMonth: statsDate.prevMonth,
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
  }).toString();

  let expensesData: PaginatedExpenses;
  let categoriesData: { data: ExpenseCategory[] };
  let walletsData: { data: WalletListItem[] };
  let recurringData: RecurringExpenseListResponse;
  let statsData: LedgerStatsResponse;
  try {
    [expensesData, categoriesData, walletsData, recurringData, statsData] = await Promise.all([
      apiFetch<PaginatedExpenses>(`/api/expenses?${listQs.toString()}`),
      apiFetch<{ data: ExpenseCategory[] }>('/api/expense-categories'),
      apiFetch<{ data: WalletListItem[] }>('/api/wallets'),
      apiFetch<RecurringExpenseListResponse>('/api/recurring-expenses'),
      apiFetch<LedgerStatsResponse>(`/api/expenses/stats?${statsQs}`),
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
    <div className="mx-auto w-full max-w-5xl">
      <ExpensesOverview
        // Re-key per period so the client accumulator resets on scope change.
        key={`${range.from ?? 'all'}-${range.to ?? 'all'}`}
        initialData={expensesData}
        categories={categoriesData.data}
        wallets={wallets}
        defaultWalletId={defaultWalletId}
        recurring={recurringData.data}
        stats={statsData.data}
        periodLabel={periodLabel}
        from={range.from}
        to={range.to}
        statsDate={statsDate}
      />
    </div>
  );
}
