import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch, ApiError } from '@/server/api';
import type { IncomeListResponse, IncomeCategoryListResponse } from '@/types/income';
import { IncomeOverview } from './_components/income-overview';

interface SearchParams {
  search?: string;
  moneyStatus?: string;
  from?: string;
  to?: string;
}

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function IncomePage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const qs = new URLSearchParams({
    page: '0',
    limit: '20',
    ...(params.search ? { search: params.search } : {}),
    ...(params.moneyStatus ? { moneyStatus: params.moneyStatus } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  }).toString();

  let incomeData: IncomeListResponse;
  let categoriesData: IncomeCategoryListResponse;
  try {
    [incomeData, categoriesData] = await Promise.all([
      apiFetch<IncomeListResponse>(`/api/incomes?${qs}`),
      apiFetch<IncomeCategoryListResponse>('/api/income-categories'),
    ]);
  } catch (err) {
    // A decodable-but-rejected token passes getSession but 401s at the API
    // (expired session after a failed silent refresh). Send the user to
    // login instead of crashing the page.
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <IncomeOverview initialData={incomeData.data} categories={categoriesData.data} />
    </div>
  );
}
