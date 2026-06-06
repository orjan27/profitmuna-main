import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
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

  const [incomeData, categoriesData] = await Promise.all([
    apiFetch<IncomeListResponse>(`/api/incomes?${qs}`),
    apiFetch<IncomeCategoryListResponse>('/api/income-categories'),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <IncomeOverview initialData={incomeData.data} categories={categoriesData.data} />
    </div>
  );
}
