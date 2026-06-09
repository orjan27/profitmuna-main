'use client';

import { AmountToggle, MaskedAmount, useAmountVisibility } from '@/components/amount-visibility';

interface WalletsTotalProps {
  /** Sum of all wallet balances in integer cents */
  totalBalanceCents: number;
  walletCount: number;
}

/**
 * Client island for the wallets page header total. Owns amount-visibility
 * state (shared localStorage key with Overview/Profit Muna) so the hero
 * total masks consistently across pages, with the eye toggle anchored to
 * the total it masks.
 */
export function WalletsTotal({ totalBalanceCents, walletCount }: WalletsTotalProps) {
  const { visible, toggle, mounted } = useAmountVisibility();

  return (
    <>
      {/* Same display scale as the Overview hero — money reads at one
          size across pages */}
      <div className="mt-3 flex items-center gap-2">
        <MaskedAmount
          cents={totalBalanceCents}
          visible={visible}
          mounted={mounted}
          className="text-[34px] leading-none font-semibold tracking-tight tabular-nums"
        />
        <AmountToggle visible={visible} toggle={toggle} />
      </div>
      <p className="mt-1.5 text-sm text-ink-faint">
        across {walletCount} wallet{walletCount !== 1 ? 's' : ''}
      </p>
    </>
  );
}
