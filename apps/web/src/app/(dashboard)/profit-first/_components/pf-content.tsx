'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAmountVisibility, AmountToggle, MaskedAmount } from '@/components/amount-visibility';
import { PfOverview, type PfAccount } from './pf-overview';
import { PfAccountForm } from './pf-account-form';
import { PfPercentageEditor } from './pf-percentage-editor';

interface PfContentProps {
  accounts: PfAccount[];
  totalIncome: number;
}

/**
 * Client boundary component that owns:
 * - amount-visibility state (passed to PfOverview / AmountToggle)
 * - "Add Account" dialog trigger
 * - "Edit Percentages" toggle (shows the inline bulk editor)
 *
 * This allows the RSC page.tsx to pass server-fetched data down while
 * the client manages all mutation entry points and modal state.
 */
export function PfContent({ accounts, totalIncome }: PfContentProps) {
  const { visible, toggle, mounted } = useAmountVisibility();
  const [addOpen, setAddOpen] = useState(false);
  const [editingPercents, setEditingPercents] = useState(false);

  return (
    <>
      {/* Headline stat: total received income for the active filter range */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total Income (Received)</p>
        <MaskedAmount
          cents={totalIncome}
          visible={visible}
          mounted={mounted}
          className="text-2xl font-semibold tracking-tight"
        />
      </div>

      {/* Action row: Add Account (accent CTA) + Edit Percentages + Eye toggle */}
      <div className="flex items-center gap-2">
        <Button onClick={() => setAddOpen(true)}>Add Account</Button>
        {!editingPercents && (
          <Button variant="outline" onClick={() => setEditingPercents(true)}>
            Edit Percentages
          </Button>
        )}
        <div className="ml-auto">
          <AmountToggle visible={visible} toggle={toggle} />
        </div>
      </div>

      {/* Inline bulk percentage editor — replaces cards area when active */}
      {editingPercents ? (
        <PfPercentageEditor accounts={accounts} onCancel={() => setEditingPercents(false)} />
      ) : (
        <PfOverview
          accounts={accounts}
          totalIncome={totalIncome}
          visible={visible}
          mounted={mounted}
        />
      )}

      {/* Create account dialog */}
      <PfAccountForm open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
