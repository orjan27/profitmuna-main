// types/ is runtime-free — only type definitions (CLAUDE.md: types/ for shared TypeScript types)
// Use interface for extensible shapes; type for unions/aliases

export type WalletSourceType = 'PROFIT_FIRST' | 'BLANK';
export type WalletTransactionType = 'DEPOSIT' | 'WITHDRAWAL';
export type ProfitFirstAccountType = 'PROFIT' | 'OWNERS_PAY' | 'TAX' | 'OPEX' | 'CUSTOM';

export interface WalletListItem {
  id: number;
  name: string;
  sourceType: WalletSourceType;
  color: string;
  sortOrder: number;
  /** Derived balance in cents — never stored */
  balanceCents: number;
  profitFirstAccountId: number | null;
  /** Count of non-deleted wallet_transactions (for delete impact dialog) */
  transactionCount: number;
  /** Count of income + expense category mappings (for delete impact dialog) */
  mappingCount: number;
  /** Income category ids mapped to this wallet (D-06: disable in pickers elsewhere) */
  incomeCategoryIds: number[];
  /** Expense category ids mapped to this wallet (D-06: disable in pickers elsewhere) */
  expenseCategoryIds: number[];
}

export interface WalletTransaction {
  id: number;
  /** merged view — INCOME_AUTO and EXPENSE_AUTO are auto-generated entries */
  type: WalletTransactionType | 'INCOME_AUTO' | 'EXPENSE_AUTO';
  amount: number;
  description: string | null;
  transactionDate: string;
  /** null = active; ISO string = soft-deleted (D-09) */
  deletedAt: string | null;
  source: 'manual' | 'income' | 'expense';
}

export interface WalletDetailResponse {
  wallet: WalletListItem;
  breakdown: {
    pfAllocationCents: number;
    mappedIncomeCents: number;
    mappedExpensesCents: number;
    depositsCents: number;
    withdrawalsCents: number;
  };
  transactions: WalletTransaction[];
  pagination: { page: number; size: number; total: number; totalPages: number };
}

// Input types used by wallet forms and server actions

export interface CreateWalletInput {
  name: string;
  sourceType: WalletSourceType;
  profitFirstAccountId?: number | null;
  color?: string;
  sortOrder?: number;
  incomeCategoryIds?: number[];
  expenseMode?: { kind: 'NONE' } | { kind: 'ALL' } | { kind: 'CATEGORIES'; ids: number[] };
}

export type UpdateWalletInput = Partial<CreateWalletInput>;

export interface CreateTransactionInput {
  type: WalletTransactionType;
  amount: number;
  description?: string;
  transactionDate: string;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

// Supporting shapes used by the new-wallet form props

export interface PfAccount {
  id: number;
  name: string;
  accountType: ProfitFirstAccountType;
  color: string;
  targetPercentage: number;
}

export interface IncomeCategory {
  id: number;
  name: string;
  system: boolean;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  system: boolean;
}
