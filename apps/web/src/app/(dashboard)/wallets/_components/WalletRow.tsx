'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MoreVertical } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import { sourceLabel } from '@/lib/wallet-labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { deleteWalletAction } from '../_actions/wallet-actions';
import type { WalletListItem } from '@/types/wallet';

interface WalletRowProps {
  wallet: WalletListItem;
}

/**
 * One wallet as a ledger row: identity dot in the wallet's color, name and
 * type as quiet text, balance right-aligned in display weight. Mirrors the
 * Profit First account rows so money reads the same everywhere.
 *
 * Negative balances render in the expense color, always paired with the
 * minus sign formatCurrency already includes (D-13).
 */
export function WalletRow({ wallet }: WalletRowProps) {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteWalletAction(wallet.id);
      if (result && 'error' in result) {
        toast.error('Something went wrong. Please try again.');
        setDeleteOpen(false);
        return;
      }
      toast.success('Wallet deleted.');
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <li className="group flex items-center gap-3 py-4">
      {/* Identity dot — the wallet's color, identity without decoration */}
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: wallet.color }}
      />

      <div className="min-w-0 flex-1">
        <Link
          href={`/wallets/${wallet.id}`}
          className="block truncate text-[15px] font-medium underline-offset-4 hover:underline"
        >
          {wallet.name}
        </Link>
        <p className="mt-0.5 text-xs text-ink-faint">{sourceLabel(wallet.profitFirstAccountId)}</p>
      </div>

      <Link
        href={`/wallets/${wallet.id}`}
        className={cn(
          'shrink-0 text-[17px] font-semibold tabular-nums',
          wallet.balanceCents < 0 && 'text-expense'
        )}
        aria-label={`${wallet.name} balance: ${formatCurrency(wallet.balanceCents)}`}
      >
        {formatCurrency(wallet.balanceCents)}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Options for ${wallet.name}`}
            className="shrink-0 text-ink-soft opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Edit opens the inline edit dialog on the detail page (D-05: no separate /edit route) */}
          <DropdownMenuItem asChild>
            <Link href={`/wallets/${wallet.id}?edit=1`}>Edit</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Wallet Confirmation Dialog (D-16) */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Wallet</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{wallet.name}&rdquo;? This will permanently remove{' '}
              {wallet.transactionCount} transaction{wallet.transactionCount !== 1 ? 's' : ''} and
              all category mappings. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Close
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Deleting…' : 'Delete Wallet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
