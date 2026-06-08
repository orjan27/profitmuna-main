'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MoreVertical, Star, TriangleAlert, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { MaskedAmount, useAmountVisibility } from '@/components/amount-visibility';
import { sourceLabel } from '@/lib/wallet-labels';
import { walletCardGradient } from '@/lib/wallet-color';
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
import type { PfAccount, WalletListItem } from '@/types/wallet';

interface WalletCardProps {
  wallet: WalletListItem;
  /** Linked Profit First account — null for standalone wallets */
  pfAccount: PfAccount | null;
}

/**
 * One wallet as a stacked bank-card: the wallet's color paints the whole
 * card, cards overlap Apple-Wallet style (the list applies the negative
 * margin), and only the last card reveals its allocation footer.
 *
 * The big balance follows the shared amount-visibility toggle so hiding the
 * hero total also hides every card balance.
 */
export function WalletCard({ wallet, pfAccount }: WalletCardProps) {
  const router = useRouter();
  const { visible, mounted } = useAmountVisibility();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteWalletAction(wallet.id);
      if (result && 'error' in result) {
        toast.error(
          result.error === 'cannot_delete_default_wallet'
            ? 'The Default wallet cannot be deleted.'
            : 'Something went wrong. Please try again.'
        );
        setDeleteOpen(false);
        return;
      }
      toast.success('Wallet deleted.');
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    /* isolate scopes the link/control z-indexes to this card so a control on
       one card can never paint above the card stacked over it */
    <li
      className="group relative isolate h-52 overflow-hidden rounded-[1.75rem] text-white shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.55)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out hover:-translate-y-1.5 focus-within:-translate-y-1.5"
      style={{ backgroundImage: walletCardGradient(wallet.color) }}
    >
      {/* Diagonal sheen — a soft light streak across the card face */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent"
      />

      {/* Ghost wallet graphic, clipped by the card edge */}
      <Wallet
        aria-hidden="true"
        strokeWidth={1}
        className="absolute -right-7 bottom-2 size-40 text-white/10"
      />

      {/* Whole-card tap target — sits above the card face (z-10); the
          star/menu controls re-raise above it (z-20) */}
      <Link
        href={`/wallets/${wallet.id}`}
        aria-label={`${wallet.name} wallet`}
        className="absolute inset-0 z-10 rounded-[1.75rem] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-inset focus-visible:outline-none"
      />

      <div className="relative flex h-full flex-col px-6 pt-4 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1.5 text-[10px] leading-none font-bold tracking-[0.08em] uppercase">
              {sourceLabel(wallet.profitFirstAccountId)}
            </span>
            {/* Icon + label together — meaning never rides on color alone */}
            {wallet.balanceCents < 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] leading-none font-semibold">
                <TriangleAlert aria-hidden="true" className="size-3" />
                Low balance
              </span>
            )}
          </div>

          <div className="z-20 -mr-2 flex items-center">
            {wallet.isDefault && (
              <span className="grid size-8 place-items-center">
                <Star aria-hidden="true" className="size-4 fill-white text-white" />
                <span className="sr-only">Default wallet</span>
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Options for ${wallet.name}`}
                  className="text-white/85 hover:bg-white/15 hover:text-white focus-visible:ring-white/70 data-[state=open]:bg-white/15"
                >
                  <MoreVertical aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Edit opens the inline edit dialog on the detail page (D-05: no separate /edit route) */}
                <DropdownMenuItem asChild>
                  <Link href={`/wallets/${wallet.id}?edit=1`}>Edit</Link>
                </DropdownMenuItem>
                {/* The Default wallet is undeletable — hide the Delete action entirely */}
                {!wallet.isDefault && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleteOpen(true)}
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className="mt-3 truncate text-[15px] font-semibold text-white/95">{wallet.name}</p>

        <MaskedAmount
          cents={wallet.balanceCents}
          visible={visible}
          mounted={mounted}
          className="mt-1.5 text-[27px] leading-none font-bold tracking-tight tabular-nums"
        />

        {/* Allocation footer — hidden under the next card's overlap on all
            but the last (fully visible) card */}
        {pfAccount && (
          <p className="mt-auto truncate text-xs font-medium text-white/85">
            {pfAccount.name} · {pfAccount.targetPercentage}% allocation
          </p>
        )}
      </div>

      {/* Delete Wallet Confirmation Dialog (D-16) */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Wallet</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{wallet.name}&rdquo;? Its income mappings and bucket link will be
              unlinked. Past expenses keep this wallet on their record.
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
