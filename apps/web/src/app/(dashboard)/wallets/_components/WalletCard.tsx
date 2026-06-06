'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MoreVertical } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format-currency';
import { sourceLabel } from '@/lib/wallet-labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

interface WalletCardProps {
  wallet: WalletListItem;
}

export function WalletCard({ wallet }: WalletCardProps) {
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
    <>
      <Card
        className={cn(
          'relative overflow-hidden shadow-sm transition-shadow hover:shadow-md',
          'rounded-xl'
        )}
      >
        {/* 4px left color accent bar (per UI-SPEC — data-driven hex) */}
        <div
          className="absolute left-0 top-0 h-full w-1"
          style={{ backgroundColor: wallet.color }}
          aria-hidden="true"
        />

        <CardContent className="pl-5 pr-4 py-4">
          {/* Card header row: name, badge, dropdown */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link
                href={`/wallets/${wallet.id}`}
                className="block truncate text-base font-semibold hover:underline"
              >
                {wallet.name}
              </Link>
              <Badge variant="secondary" className="mt-1 text-xs">
                {sourceLabel(wallet.sourceType)}
              </Badge>
            </div>

            {/* Dropdown menu — ⋮ */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Wallet actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Edit navigates to detail page (D-05: inline edit; no separate /edit route in Phase 4) */}
                <DropdownMenuItem asChild>
                  <Link href={`/wallets/${wallet.id}`}>Edit</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Total balance — Display role (28px semibold); negative in destructive red (D-13) */}
          <Link href={`/wallets/${wallet.id}`} className="mt-3 block">
            <span
              className={cn(
                'text-2xl font-semibold tabular-nums',
                wallet.balanceCents < 0 && 'text-destructive'
              )}
            >
              {formatCurrency(wallet.balanceCents)}
            </span>
          </Link>
        </CardContent>
      </Card>

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
    </>
  );
}
