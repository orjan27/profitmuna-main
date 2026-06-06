'use client';

import { useAmountVisibility, AmountToggle } from '@/components/amount-visibility';
import { PfOverview, type PfAccount } from './pf-overview';

interface PfContentProps {
  accounts: PfAccount[];
  totalIncome: number;
}

/**
 * Client boundary component that owns the amount-visibility state and
 * composes AmountToggle + PfOverview.
 *
 * This allows the RSC page.tsx to pass server-fetched data down while
 * the client manages the localStorage-backed toggle state.
 */
export function PfContent({ accounts, totalIncome }: PfContentProps) {
  const { visible, toggle, mounted } = useAmountVisibility();

  return (
    <>
      <div className="flex items-center justify-end">
        <AmountToggle visible={visible} toggle={toggle} />
      </div>
      <PfOverview
        accounts={accounts}
        totalIncome={totalIncome}
        visible={visible}
        mounted={mounted}
      />
    </>
  );
}
