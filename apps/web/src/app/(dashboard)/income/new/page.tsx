import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import type { IncomeCategoryListResponse } from '@/types/income';
import { IncomeForm } from '../_components/income-form';
import { createIncomeAction } from './_actions/create-income';

export default async function NewIncomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const categoriesData = await apiFetch<IncomeCategoryListResponse>('/api/income-categories');

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-7">
      <div>
        <h1 className="text-[20px] font-semibold leading-tight">Record income</h1>
        <p className="mt-1 text-sm text-ink-faint">Add a new income entry to your records.</p>
      </div>
      <IncomeForm categories={categoriesData.data} action={createIncomeAction} />
    </div>
  );
}
