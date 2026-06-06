import { redirect } from 'next/navigation';
import { TZDate } from '@date-fns/tz';

import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import type { Income, IncomeListResponse } from '@/types/income';
import type { WalletListItem } from '@/types/wallet';
import type { PfAccount } from '@/app/(dashboard)/profit-first/_components/pf-overview';
import { OverviewContent, type RecentEntry } from './_components/overview-content';

// ── API response shapes ───────────────────────────────────────────────────────

interface SummaryResponse {
  data: {
    totalIncome: number;
    accounts: PfAccount[];
  };
}

interface ExpenseItem {
  id: number;
  categoryName: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  deletedAt: string | null;
}

/** /api/expenses returns the page object directly — no { data } envelope. */
interface PaginatedExpenses {
  content: ExpenseItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Time-of-day greeting anchored to Asia/Manila — the app's currency is PHP,
 * so the user's clock is assumed local to it. Phase 6 currency swap point:
 * derive the zone alongside the locale when other currencies land.
 */
function greetingForNow(): string {
  const hour = new TZDate(Date.now(), 'Asia/Manila').getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * The signed-in home: total balance across wallets in display scale, the
 * allocation split at a glance, and recent money movement — the app's promise
 * on one screen. Each fetch degrades independently so one failing endpoint
 * never blanks the whole page.
 */
export default async function OverviewPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [walletsRes, summaryRes, incomesRes, expensesRes] = await Promise.all([
    apiFetch<{ data: WalletListItem[] }>('/api/wallets').catch(() => ({
      data: [] as WalletListItem[],
    })),
    apiFetch<SummaryResponse>('/api/profit-first/summary').catch(() => ({
      data: { totalIncome: 0, accounts: [] as PfAccount[] },
    })),
    apiFetch<IncomeListResponse>('/api/incomes?page=0&limit=6').catch(() => ({
      data: { content: [] as Income[], page: 0, last: true },
    })),
    apiFetch<PaginatedExpenses>('/api/expenses?page=0&limit=6').catch(() => ({
      content: [] as ExpenseItem[],
    })),
  ]);

  const wallets = walletsRes.data ?? [];
  const accounts = summaryRes.data?.accounts ?? [];
  const totalIncome = summaryRes.data?.totalIncome ?? 0;
  const totalBalanceCents = wallets.reduce((sum, w) => sum + w.balanceCents, 0);

  const recent: RecentEntry[] = [
    ...(incomesRes.data?.content ?? []).map((income) => ({
      id: `income-${income.id}`,
      kind: 'income' as const,
      label: income.categoryName,
      date: income.incomeDate,
      amountCents: income.amount,
      pending: income.moneyStatus === 'PENDING',
    })),
    ...(expensesRes.content ?? [])
      .filter((expense) => expense.deletedAt === null)
      .map((expense) => ({
        id: `expense-${expense.id}`,
        kind: 'expense' as const,
        label: expense.categoryName,
        date: expense.expenseDate,
        amountCents: expense.amount,
      })),
  ]
    // ISO YYYY-MM-DD sorts correctly as a string
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <OverviewContent
      greeting={greetingForNow()}
      totalBalanceCents={totalBalanceCents}
      hasWallets={wallets.length > 0}
      accounts={accounts}
      totalIncomeCents={totalIncome}
      recent={recent}
    />
  );
}
