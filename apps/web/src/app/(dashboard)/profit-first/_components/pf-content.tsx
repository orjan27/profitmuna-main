'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAmountVisibility, AmountToggle, MaskedAmount } from '@/components/amount-visibility';
import { PfAllocationBar } from './pf-allocation-bar';
import { PfOverview, type PfAccount } from './pf-overview';
import { PfAccountForm } from './pf-account-form';
import { PfPercentageEditor } from './pf-percentage-editor';

interface PfContentProps {
  accounts: PfAccount[];
  totalIncome: number;
}

/**
 * Client boundary for /profit-first. Owns amount-visibility state and the
 * mutation entry points (add-account dialog, inline percentage editor).
 *
 * Composition: hero total (typographic, no container) → stacked allocation
 * bar (the split is the hero) → account ledger → quiet foot actions.
 */
export function PfContent({ accounts, totalIncome }: PfContentProps) {
  const { visible, toggle, mounted } = useAmountVisibility();
  const [addOpen, setAddOpen] = useState(false);
  const [editingPercents, setEditingPercents] = useState(false);

  return (
    <div className="flex flex-col">
      {/* Hero: received income as typography on the paper, eye toggle anchored
          to the balance it masks (financial-app convention) */}
      <div>
        <p className="text-sm text-muted-foreground">Received income</p>
        <div className="mt-1.5 flex items-center gap-3">
          <MaskedAmount
            cents={totalIncome}
            visible={visible}
            mounted={mounted}
            className="block text-4xl font-semibold leading-none tracking-tight tabular-nums md:text-5xl"
          />
          <AmountToggle visible={visible} toggle={toggle} />
        </div>
      </div>

      {/* The split: one stacked 100% bar, segments in account colors */}
      <div className="mt-7">
        <PfAllocationBar accounts={accounts} />
        {totalIncome === 0 && accounts.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Record your first income and watch it split automatically.
          </p>
        )}
      </div>

      {/* Ledger, or the inline bulk percentage editor while editing */}
      <div className="mt-8">
        {editingPercents ? (
          <PfPercentageEditor accounts={accounts} onCancel={() => setEditingPercents(false)} />
        ) : (
          <>
            <PfOverview accounts={accounts} visible={visible} mounted={mounted} />

            {/* Foot actions: rare operations live quietly where they act */}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setAddOpen(true)}
              >
                + Add account
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setEditingPercents(true)}
              >
                Edit percentages
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Create account dialog */}
      <PfAccountForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
