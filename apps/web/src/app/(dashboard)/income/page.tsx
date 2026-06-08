import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch, ApiError } from '@/server/api';
import type { IncomeListResponse, IncomeCategoryListResponse } from '@/types/income';
import type { RecurringIncomeListResponse } from '@/types/recurring';
import type { LedgerStatsResponse } from '@/types/stats';
import { ledgerStatsDateParams, resolveLedgerPeriod } from '@/lib/ledger-period';
import { IncomeOverview } from './_components/income-overview';

interface SearchParams {
  period?: string;
  search?: string;
  moneyStatus?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function IncomePage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;

  // The segmented PeriodControl drives the time scope (URL `period`); the RSC
  // resolves it to concrete bounds for both the ledger list and the stats
  // aggregate. Search + status are secondary filters behind the Filter toggle.
  const period = resolveLedgerPeriod(params.period);
  const statsDate = ledgerStatsDateParams();

  const listQs = new URLSearchParams({
    page: '0',
    limit: '20',
    ...(params.search ? { search: params.search } : {}),
    ...(params.moneyStatus ? { moneyStatus: params.moneyStatus } : {}),
    ...(period.from ? { from: period.from } : {}),
    ...(period.to ? { to: period.to } : {}),
  }).toString();

  const statsQs = new URLSearchParams({
    year: statsDate.year,
    month: statsDate.month,
    prevMonth: statsDate.prevMonth,
    ...(period.from ? { from: period.from } : {}),
    ...(period.to ? { to: period.to } : {}),
  }).toString();

  let incomeData: IncomeListResponse;
  let categoriesData: IncomeCategoryListResponse;
  let recurringData: RecurringIncomeListResponse;
  let statsData: LedgerStatsResponse;
  try {
    [incomeData, categoriesData, recurringData, statsData] = await Promise.all([
      apiFetch<IncomeListResponse>(`/api/incomes?${listQs}`),
      apiFetch<IncomeCategoryListResponse>('/api/income-categories'),
      apiFetch<RecurringIncomeListResponse>('/api/recurring-incomes'),
      apiFetch<LedgerStatsResponse>(`/api/incomes/stats?${statsQs}`),
    ]);
  } catch (err) {
    // A decodable-but-rejected token passes getSession but 401s at the API
    // (expired session after a failed silent refresh). Send the user to
    // login instead of crashing the page.
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <IncomeOverview
        // Re-key per period so the client accumulator resets on scope change.
        key={period.key}
        initialData={incomeData.data}
        categories={categoriesData.data}
        recurring={recurringData.data}
        stats={statsData.data}
        periodKey={period.key}
        from={period.from}
        to={period.to}
        statsDate={statsDate}
      />
    </div>
  );
}
