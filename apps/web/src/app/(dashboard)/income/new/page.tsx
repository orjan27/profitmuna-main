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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Record Income</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new income entry to your records.
        </p>
      </div>
      <IncomeForm categories={categoriesData.data} action={createIncomeAction} />
    </main>
  );
}
