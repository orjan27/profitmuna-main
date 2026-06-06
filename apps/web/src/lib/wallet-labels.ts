// Pure utility — no React imports, no framework coupling (CLAUDE.md: lib/ for framework-agnostic utils)
import type { WalletSourceType, ProfitFirstAccountType } from '@/types/wallet';

/**
 * Returns the appropriate label for a withdrawal from a wallet.
 * For PROFIT_FIRST wallets, maps the account type to a descriptive action name.
 *
 * @param sourceType - The wallet's source type
 * @param accountType - The linked PF account type (only relevant for PROFIT_FIRST)
 * @returns Human-readable withdrawal label
 */
export function withdrawalLabel(
  sourceType: WalletSourceType,
  accountType: ProfitFirstAccountType | null
): string {
  if (sourceType === 'PROFIT_FIRST') {
    switch (accountType) {
      case 'PROFIT':
        return 'Profit Distribution';
      case 'OWNERS_PAY':
        return "Owner's Draw";
      case 'TAX':
        return 'Tax Payment';
      case 'OPEX':
        return 'Expense';
      default:
        return 'Withdrawal';
    }
  }
  return 'Withdrawal';
}

/**
 * Returns a human-readable label for the wallet source type.
 *
 * @param sourceType - The wallet's source type
 * @returns Display label string
 */
export function sourceLabel(sourceType: WalletSourceType): string {
  return sourceType === 'PROFIT_FIRST' ? 'Profit First' : 'Standalone';
}
