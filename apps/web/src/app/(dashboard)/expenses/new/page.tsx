import { redirect } from 'next/navigation';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import { ExpenseForm } from '../_components/expense-form';
import { createExpenseAction } from './_actions/create-expense';

interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}

/**
 * RSC for /expenses/new.
 * Guards with getSession → redirect to /login when unauthenticated.
 * Fetches expense categories for the form select.
 */
export default async function NewExpensePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const categoriesData = await apiFetch<{ data: ExpenseCategory[] }>('/api/expense-categories');

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-7">
      <div>
        <h1 className="text-[20px] font-semibold leading-tight">Record expense</h1>
        <p className="mt-1 text-sm text-ink-faint">Add a new business expense.</p>
      </div>
      <ExpenseForm categories={categoriesData.data} action={createExpenseAction} />
    </div>
  );
}
