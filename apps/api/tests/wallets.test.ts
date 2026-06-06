import { describe, it } from 'vitest';

// Wave 0 scaffold: it.todo stubs for WAL-01..WAL-05.
// Plans 02 and 03 convert these to real assertions using createTestDb + createWalletService.
//
// Each describe block references the requirement ID from 04-VALIDATION.md so the
// executor can trace failures back to the source requirement.

describe('wallets service', () => {
  describe('WAL-01: wallet CRUD', () => {
    it.todo('creates a PROFIT_FIRST wallet linked to a PF account');
    it.todo('creates a BLANK (standalone) wallet without a PF account link');
    it.todo('returns 409 when the same PF account is already linked to another wallet');
    it.todo('lists wallets with computed balanceCents, transactionCount, and mappingCount');
    it.todo('updates wallet name, color, and sortOrder');
    it.todo('deletes a wallet and cascades to mappings and transactions (D-16)');
  });

  describe('WAL-02: income and expense category mappings', () => {
    it.todo('maps income categories to a wallet on create');
    it.todo('returns 409 when an income category is already mapped to another wallet');
    it.todo('maps expense categories via expenseMode CATEGORIES to a wallet');
    it.todo('returns 409 when an expense category is already mapped to another wallet');
    it.todo('expenseMode ALL sets autoDeductAllExpenses=true and clears category mappings');
    it.todo('expenseMode NONE sets autoDeductAllExpenses=false and clears category mappings');
    it.todo('replaces existing income category mappings atomically on update');
  });

  describe('WAL-03: derived balance computation', () => {
    it.todo(
      'balance formula: pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals'
    );
    it.todo('allows negative balance (no clamp — D-13)');
    it.todo('pfAllocation is basis-point ratio of total RECEIVED income for PROFIT_FIRST wallet');
    it.todo('BLANK wallet has pfAllocation=0 regardless of income records');
  });

  describe('WAL-04: manual transaction guard (assertCanInsertTransaction)', () => {
    it.todo('blocks manual DEPOSIT on a PROFIT_FIRST wallet (manual_deposit_blocked_pf_wallet)');
    it.todo(
      'blocks manual DEPOSIT on a wallet with mapped income categories (manual_deposit_blocked_income_mapped)'
    );
    it.todo(
      'blocks manual WITHDRAWAL on a wallet with mapped expense categories (manual_withdrawal_blocked_expense_mapped)'
    );
    it.todo(
      'blocks manual WITHDRAWAL on a wallet with autoDeductAllExpenses=true (manual_withdrawal_blocked_expense_mapped)'
    );
    it.todo('allows manual WITHDRAWAL on a PROFIT_FIRST wallet with no expense mappings');
    it.todo('creates and updates manual transactions on eligible wallets');
  });

  describe('WAL-05: transaction soft-delete and restore', () => {
    it.todo('soft-delete sets deletedAt to ISO timestamp (null before delete)');
    it.todo('restore clears deletedAt back to null');
    it.todo('soft-deleted transactions appear in paginated history (D-09)');
    it.todo('balance computation excludes soft-deleted transactions');
    it.todo(
      'paginated history merges 3 sources (manual, income_auto, expense_auto) sorted DESC by transactionDate then id'
    );
  });
});
