'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical } from 'lucide-react';

import { MaskedAmount } from '@/components/amount-visibility';
import { formatCurrency } from '@/lib/format-currency';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/profit-first/summary accounts array */
export interface PfAccount {
  id: number;
  name: string;
  /** Whole-number percent (e.g. 5 = 5%) — API returns bp/100 */
  targetPercentage: number;
  color: string;
  sortOrder: number;
  accountType: 'PROFIT' | 'OWNERS_PAY' | 'TAX' | 'OPEX' | 'CUSTOM';
  /** Derived balance in integer cents */
  computedBalance: number;
}

interface PfOverviewProps {
  accounts: PfAccount[];
  totalIncome: number;
  visible: boolean;
  mounted: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<Exclude<PfAccount['accountType'], 'CUSTOM'>, string> = {
  PROFIT: 'Profit',
  OWNERS_PAY: 'Owner Pay',
  TAX: 'Tax',
  OPEX: 'Operating Expenses',
};

/**
 * Account cards grid for the Profit First summary page.
 *
 * Renders a 2-column grid on md+, 1-column on mobile. Each card shows:
 * - 4px left border in the account color hex
 * - Account name (Heading), type badge for non-CUSTOM accounts
 * - Target percentage
 * - Derived balance (masked or formatted) in Display slot
 * - Progress bar (value = targetPercentage, 0–100)
 * - Total received income line
 * - Per-account dropdown (⋮) with Edit/Delete — handlers wired by Plan 04 Task 2
 *
 * T-03-06: account.name is always rendered as text content (never
 * dangerouslySetInnerHTML) to prevent stored XSS.
 */
export function PfOverview({ accounts, totalIncome, visible, mounted }: PfOverviewProps) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-semibold text-foreground">No allocation accounts yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your default accounts will appear here. If you don&apos;t see them, contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          totalIncome={totalIncome}
          visible={visible}
          mounted={mounted}
        />
      ))}
    </div>
  );
}

// ── Account card ──────────────────────────────────────────────────────────────

interface AccountCardProps {
  account: PfAccount;
  totalIncome: number;
  visible: boolean;
  mounted: boolean;
}

function AccountCard({ account, totalIncome, visible, mounted }: AccountCardProps) {
  const isDefault = account.accountType !== 'CUSTOM';
  const typeLabel = isDefault
    ? ACCOUNT_TYPE_LABELS[account.accountType as Exclude<PfAccount['accountType'], 'CUSTOM'>]
    : null;

  return (
    <Card
      className="relative overflow-hidden shadow-sm rounded-xl transition-shadow hover:shadow-md"
      style={{ borderLeft: `4px solid ${account.color}` }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* T-03-06: text content only, no dangerouslySetInnerHTML */}
            <CardTitle className="text-[20px] font-semibold leading-tight">
              {account.name}
            </CardTitle>
            {typeLabel !== null && (
              <Badge variant="secondary" className="text-xs">
                {typeLabel}
              </Badge>
            )}
          </div>

          {/* Per-account dropdown — Plan 04 Task 2 wires Edit/Delete handlers */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Account options"
                className="h-8 w-8 shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Edit handler wired by Plan 04 */}
              <DropdownMenuItem disabled>Edit</DropdownMenuItem>
              {/* Delete disabled for non-CUSTOM accounts (D-05) */}
              <DropdownMenuItem
                disabled={isDefault}
                className={isDefault ? 'opacity-50 cursor-not-allowed' : 'text-destructive'}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-sm text-muted-foreground">Target: {account.targetPercentage}%</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Allocated balance — Display slot (28px semibold) */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Allocated balance
          </p>
          <MaskedAmount
            cents={account.computedBalance}
            visible={visible}
            mounted={mounted}
            className="text-[28px] font-semibold leading-none tabular-nums"
          />
        </div>

        {/* Progress bar — value is percent (0–100) */}
        <Progress value={account.targetPercentage} className="h-2" />

        {/* Total received income line */}
        <p className="text-xs text-muted-foreground">
          of {formatCurrency(totalIncome)} total received income
        </p>
      </CardContent>
    </Card>
  );
}
