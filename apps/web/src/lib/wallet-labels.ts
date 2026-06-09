// Pure utility — no React imports, no framework coupling (CLAUDE.md: lib/ for framework-agnostic utils)
import type { ProfitMunaAccountType } from '@/types/wallet';

/**
 * Returns the appropriate label for a withdrawal from a wallet.
 * For PF-linked wallets, maps the account type to a descriptive action name.
 *
 * @param profitMunaAccountId - The wallet's PF link (non-null = PF wallet, null = standalone)
 * @param accountType - The linked PF account type (only relevant for PF wallets)
 * @returns Human-readable withdrawal label
 */
export function withdrawalLabel(
  profitMunaAccountId: number | null,
  accountType: ProfitMunaAccountType | null
): string {
  if (profitMunaAccountId != null) {
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
 * Returns a human-readable label for the wallet's funding source.
 *
 * @param profitMunaAccountId - The wallet's PF link (non-null = PF wallet, null = standalone)
 * @returns Display label string
 */
export function sourceLabel(profitMunaAccountId: number | null): string {
  return profitMunaAccountId != null ? 'Profit Muna' : 'Standalone';
}
