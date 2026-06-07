import type { PfAccount } from '@/app/(dashboard)/profit-first/_components/pf-overview';

/** Feed row source — matches the API dashboard-service RecentTransactionKind */
export type RecentTransactionKind = 'income' | 'expense' | 'wallet_deposit' | 'wallet_withdrawal';

/** One row of the unified recent-transactions feed from GET /api/dashboard/summary */
export interface RecentTransaction {
  id: number;
  kind: RecentTransactionKind;
  /** ISO YYYY-MM-DD */
  date: string;
  amountCents: number;
  description: string | null;
  /** Category name for income/expense rows; wallet name for wallet tx rows */
  label: string;
  /** Navigation target for the feed row (D-05) */
  href: string;
}

export interface FeedPagination {
  page: number;
  size: number;
  hasMore: boolean;
}

/** Shape of GET /api/dashboard/summary `data` */
export interface DashboardSummary {
  totalIncomeReceivedCents: number;
  totalIncomePendingCents: number;
  totalExpensesCents: number;
  /** Received income minus expenses — pending income does not count */
  netIncomeCents: number;
  /** Period-scoped sum across all wallets for the active date range */
  totalWalletBalanceCents: number;
  /** Total received + allocated income in cents (PF summary passthrough) */
  totalIncome: number;
  profitFirstAccounts: PfAccount[];
  recentTransactions: RecentTransaction[];
  feedPagination: FeedPagination;
}
