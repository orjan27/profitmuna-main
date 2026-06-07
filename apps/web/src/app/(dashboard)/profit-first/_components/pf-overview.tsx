'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreVertical } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { MaskedAmount } from '@/components/amount-visibility';
import { deleteAccountAction } from '@/server/profit-first-actions';
import { PfAccountForm } from './pf-account-form';

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
  visible: boolean;
  mounted: boolean;
}

/**
 * Account ledger for the Profit First summary page.
 *
 * Hairline-separated rows instead of cards: color dot + name, target percent,
 * allocated amount (masked-aware, tabular), and a per-row Edit/Delete menu.
 * Structure comes from whitespace and type scale, not boxes (The Calm
 * Envelope: whitespace is the layout).
 *
 * T-03-06: account.name is always rendered as text content (never
 * dangerouslySetInnerHTML) to prevent stored XSS.
 */
export function PfOverview({ accounts, visible, mounted }: PfOverviewProps) {
  if (accounts.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">No allocation accounts yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your default accounts are created when you sign up. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {accounts.map((account) => (
        <AccountRow key={account.id} account={account} visible={visible} mounted={mounted} />
      ))}
    </ul>
  );
}

// ── Account row ───────────────────────────────────────────────────────────────

interface AccountRowProps {
  account: PfAccount;
  visible: boolean;
  mounted: boolean;
}

function AccountRow({ account, visible, mounted }: AccountRowProps) {
  const router = useRouter();
  const isDefault = account.accountType !== 'CUSTOM';

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await deleteAccountAction(account.id);
      if (!result.ok) {
        toast.error(result.message ?? 'Something went wrong. Please try again.');
        return;
      }
      toast.success('Account deleted.');
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="flex items-center gap-3 py-4">
      {/* Identity dot — same hue as this account's bar segment */}
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: account.color }}
      />

      {/* T-03-06: text content only, no dangerouslySetInnerHTML */}
      <span className="truncate text-[15px] font-medium">{account.name}</span>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {account.targetPercentage}%
      </span>

      <MaskedAmount
        cents={account.computedBalance}
        visible={visible}
        mounted={mounted}
        className="ml-auto shrink-0 text-[15px] font-medium tabular-nums"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Options for ${account.name}`}
            className="h-8 w-8 shrink-0 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Edit — available for all account types */}
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>

          {/* Delete — disabled with tooltip for non-CUSTOM accounts (D-05, T-03-07) */}
          {isDefault ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Wrapper span needed: disabled button swallows pointer events for tooltip */}
                <span className="block">
                  <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
                    Delete
                  </DropdownMenuItem>
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">Default accounts cannot be deleted.</TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog */}
      <PfAccountForm open={editOpen} onOpenChange={setEditOpen} account={account} />

      {/* Delete confirmation dialog (CUSTOM accounts only) */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          {/* T-03-06: name rendered as text content only */}
          <p className="text-sm text-muted-foreground">
            Delete &ldquo;{account.name}&rdquo;? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
