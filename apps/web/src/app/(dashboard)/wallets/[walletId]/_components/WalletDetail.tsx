'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryState, parseAsInteger } from 'nuqs';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  RotateCcw,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatCurrency, toCents } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { sourceLabel } from '@/lib/wallet-labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
  restoreTransactionAction,
  deleteWalletAction,
} from '../../_actions/wallet-actions';
import type { WalletDetailResponse, WalletTransaction } from '@/types/wallet';

// ── Copywriting Contract ──────────────────────────────────────────────────────
const BLOCKING_COPY = {
  pf_deposit:
    'Profit First wallets do not accept manual deposits — they derive their allocation from received income.',
  income_mapped:
    'This wallet auto-credits matching income. Manual deposits would double-count — record the income instead.',
  expense_mapped:
    'This wallet auto-deducts matching expenses. Manual withdrawals would double-count — record an expense instead.',
} as const;

const ERROR_COPY: Record<string, string> = {
  manual_deposit_blocked_pf_wallet: BLOCKING_COPY.pf_deposit,
  manual_deposit_blocked_income_mapped: BLOCKING_COPY.income_mapped,
  manual_withdrawal_blocked_expense_mapped: BLOCKING_COPY.expense_mapped,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function transactionTypeBadgeLabel(type: WalletTransaction['type']): string {
  switch (type) {
    case 'DEPOSIT':
      return 'Deposit';
    case 'WITHDRAWAL':
      return 'Withdrawal';
    case 'INCOME_AUTO':
      return 'Income';
    case 'EXPENSE_AUTO':
      return 'Expense';
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface WalletDetailProps {
  detail: WalletDetailResponse;
}

// ── Add/Edit Transaction Dialog ───────────────────────────────────────────────

interface TxDialogProps {
  open: boolean;
  mode: 'add-deposit' | 'add-withdrawal' | 'edit';
  editTx?: WalletTransaction;
  walletId: number;
  onClose: () => void;
}

function TxDialog({ open, mode, editTx, walletId, onClose }: TxDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isEdit = mode === 'edit';
  const txType = isEdit
    ? (editTx?.type ?? 'DEPOSIT')
    : mode === 'add-deposit'
      ? 'DEPOSIT'
      : 'WITHDRAWAL';
  const isDeposit = txType === 'DEPOSIT';

  const title = isEdit
    ? isDeposit
      ? 'Edit Deposit'
      : 'Edit Withdrawal'
    : isDeposit
      ? 'Add Deposit'
      : 'Add Withdrawal';

  const confirmLabel = isEdit
    ? isDeposit
      ? 'Save Deposit'
      : 'Save Withdrawal'
    : isDeposit
      ? 'Add Deposit'
      : 'Add Withdrawal';

  const pendingLabel = isEdit ? 'Saving…' : 'Adding…';

  const [amount, setAmount] = useState(isEdit && editTx ? String(editTx.amount / 100) : '');
  const [date, setDate] = useState(isEdit && editTx ? editTx.transactionDate : todayIso());
  const [description, setDescription] = useState(
    isEdit && editTx ? (editTx.description ?? '') : ''
  );

  function handleOpenChange(o: boolean) {
    if (!o) onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = toCents(Number(amount));
    if (cents <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }

    startTransition(async () => {
      const input = {
        type: txType as 'DEPOSIT' | 'WITHDRAWAL',
        amount: cents,
        transactionDate: date,
        description: description || undefined,
      };

      let result: { error: string } | undefined;
      if (isEdit && editTx) {
        result = await updateTransactionAction(walletId, editTx.id, input);
      } else {
        result = await createTransactionAction(walletId, input);
      }

      if (result?.error) {
        toast.error(ERROR_COPY[result.error] ?? 'Something went wrong. Please try again.');
        return;
      }

      toast.success(isEdit ? 'Transaction updated.' : 'Transaction saved.');
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">Amount</Label>
            <Input
              id="tx-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-date">Date</Label>
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-description">Description</Label>
            <Input
              id="tx-description"
              type="text"
              placeholder="Optional note"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Close
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? pendingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Transaction Dialog ─────────────────────────────────────────────────

interface DeleteTxDialogProps {
  tx: WalletTransaction | null;
  walletId: number;
  onClose: () => void;
}

function DeleteTxDialog({ tx, walletId, onClose }: DeleteTxDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!tx) return;
    startTransition(async () => {
      const result = await deleteTransactionAction(walletId, tx.id);
      if (result?.error) {
        toast.error('Something went wrong. Please try again.');
        onClose();
        return;
      }
      toast.success('Transaction deleted.');
      onClose();
      router.refresh();
    });
  }

  const typeLabel = tx
    ? tx.type === 'DEPOSIT' || tx.type === 'WITHDRAWAL'
      ? tx.type.charAt(0) + tx.type.slice(1).toLowerCase()
      : tx.type === 'INCOME_AUTO'
        ? 'income'
        : 'expense'
    : '';

  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
          <DialogDescription>
            Delete this {tx ? formatCurrency(tx.amount) : ''} {typeLabel}? You can restore it from
            the list.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Close
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WalletDetail({ detail }: WalletDetailProps) {
  const router = useRouter();
  const { wallet, breakdown, transactions, pagination } = detail;

  // Pagination state via nuqs URL param (D-10).
  // shallow: false — the RSC page reads `page` from searchParams, so the URL
  // change must round-trip through the server to fetch the new page of rows.
  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(0).withOptions({ shallow: false })
  );

  // Dialog state
  const [txDialogMode, setTxDialogMode] = useState<
    'add-deposit' | 'add-withdrawal' | 'edit' | null
  >(null);
  const [editTx, setEditTx] = useState<WalletTransaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<WalletTransaction | null>(null);

  // Delete wallet dialog state
  const [deleteWalletOpen, setDeleteWalletOpen] = useState(false);
  const [isDeletingWallet, startDeleteWallet] = useTransition();

  // Restore handler
  const [, startRestore] = useTransition();

  function handleRestore(tx: WalletTransaction) {
    startRestore(async () => {
      const result = await restoreTransactionAction(wallet.id, tx.id);
      if (result?.error) {
        toast.error('Something went wrong. Please try again.');
        return;
      }
      toast.success('Transaction restored.');
      router.refresh();
    });
  }

  function handleDeleteWallet() {
    startDeleteWallet(async () => {
      const result = await deleteWalletAction(wallet.id);
      if (result && 'error' in result) {
        toast.error('Something went wrong. Please try again.');
        setDeleteWalletOpen(false);
        return;
      }
      toast.success('Wallet deleted.');
      router.push('/wallets');
    });
  }

  // Blocking logic derived from wallet shape
  const isDepositBlocked = !!wallet.profitFirstAccountId || wallet.mappingCount > 0;
  // For deposit blocking, we check PF or income-mapped. For withdrawal, expense-mapped.
  // We use the wallet detail data to derive these:
  const isPfWallet = wallet.sourceType === 'PROFIT_FIRST';
  const hasIncomeMappings =
    breakdown.mappedIncomeCents > 0 || (isPfWallet ? false : wallet.mappingCount > 0);

  // Deposit is blocked if PF wallet OR has income-category mappings
  // Withdrawal is blocked if has expense-category mappings or autoDeductAllExpenses
  // Since we don't have the raw mapping lists in WalletDetailResponse, we infer:
  // - PF wallet → deposit blocked
  // - mappedIncomeCents > 0 → deposit blocked (income is flowing in automatically)
  // - mappedExpensesCents > 0 → withdrawal blocked (expenses auto-deducted)
  // Note: these are conservative — may block when no mapping exists but income/expense happened to be 0
  // The server enforces the real guard; UI disables as a hint.
  const depositBlocked = isPfWallet || breakdown.mappedIncomeCents > 0;
  const depositBlockReason = isPfWallet ? BLOCKING_COPY.pf_deposit : BLOCKING_COPY.income_mapped;

  // We can't fully know expense auto status from breakdown alone without extra fields.
  // Use mappedExpensesCents as a proxy — if any expense was auto-deducted, block withdrawal.
  // A more reliable approach: the server will enforce it anyway.
  const withdrawalBlocked = breakdown.mappedExpensesCents > 0;
  const withdrawalBlockReason = BLOCKING_COPY.expense_mapped;

  // Suppress unused variable warning for hasIncomeMappings
  void hasIncomeMappings;
  void isDepositBlocked;

  const [breakdownOpen, setBreakdownOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/wallets"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold">{wallet.name}</h1>
          <Badge variant="secondary">{sourceLabel(wallet.sourceType)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* No /edit route in Phase 4 — wallet editing ships in a later phase (D-05) */}
          <Button variant="destructive" size="sm" onClick={() => setDeleteWalletOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      {/* Total balance — Display role (D-13: negative → destructive) */}
      <div>
        <p className="text-sm text-muted-foreground">Total Balance</p>
        <p
          className={cn(
            'text-3xl font-semibold tabular-nums leading-tight',
            wallet.balanceCents < 0 && 'text-destructive'
          )}
        >
          {formatCurrency(wallet.balanceCents)}
        </p>
      </div>

      {/* Balance Breakdown collapsible (D-02) */}
      <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-0 text-sm font-medium">
            {breakdownOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Balance Breakdown
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-lg border bg-card p-4 space-y-2 text-sm">
            {breakdown.pfAllocationCents !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit First Allocation</span>
                <span className="tabular-nums">{formatCurrency(breakdown.pfAllocationCents)}</span>
              </div>
            )}
            {breakdown.mappedIncomeCents !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mapped Income</span>
                <span className="tabular-nums">{formatCurrency(breakdown.mappedIncomeCents)}</span>
              </div>
            )}
            {breakdown.mappedExpensesCents !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mapped Expenses</span>
                <span className="tabular-nums text-destructive">
                  -{formatCurrency(breakdown.mappedExpensesCents)}
                </span>
              </div>
            )}
            {breakdown.depositsCents !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposits</span>
                <span className="tabular-nums">{formatCurrency(breakdown.depositsCents)}</span>
              </div>
            )}
            {breakdown.withdrawalsCents !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Withdrawals</span>
                <span className="tabular-nums text-destructive">
                  -{formatCurrency(breakdown.withdrawalsCents)}
                </span>
              </div>
            )}
            {breakdown.pfAllocationCents === 0 &&
              breakdown.mappedIncomeCents === 0 &&
              breakdown.mappedExpensesCents === 0 &&
              breakdown.depositsCents === 0 &&
              breakdown.withdrawalsCents === 0 && (
                <p className="text-muted-foreground text-center py-2">No activity yet.</p>
              )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Transaction History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Transaction History</h2>
          <div className="flex items-center gap-2">
            {/* Add Deposit */}
            <Button
              size="sm"
              onClick={() => setTxDialogMode('add-deposit')}
              disabled={depositBlocked}
              title={depositBlocked ? depositBlockReason : undefined}
            >
              <ArrowDownLeft className="h-3.5 w-3.5 mr-1" />
              Add Deposit
            </Button>
            {/* Add Withdrawal */}
            <Button
              size="sm"
              onClick={() => setTxDialogMode('add-withdrawal')}
              disabled={withdrawalBlocked}
              title={withdrawalBlocked ? withdrawalBlockReason : undefined}
            >
              <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
              Add Withdrawal
            </Button>
          </div>
        </div>

        {/* Transaction list */}
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Description
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={`${tx.source}-${tx.id}`}
                    className={cn(
                      'border-b last:border-0',
                      // D-09: soft-deleted rows greyed + strikethrough
                      tx.deletedAt && 'opacity-50 line-through text-muted-foreground'
                    )}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(tx.transactionDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {tx.description ?? '—'}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right tabular-nums whitespace-nowrap',
                        (tx.type === 'WITHDRAWAL' || tx.type === 'EXPENSE_AUTO') &&
                          'text-destructive'
                      )}
                    >
                      {tx.type === 'WITHDRAWAL' || tx.type === 'EXPENSE_AUTO'
                        ? `-${formatCurrency(tx.amount)}`
                        : formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary" className="text-xs">
                        {transactionTypeBadgeLabel(tx.type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {/* Auto-sourced rows are read-only */}
                      {tx.source === 'manual' && (
                        <div className="flex items-center justify-end gap-1">
                          {tx.deletedAt ? (
                            // D-09: soft-deleted — show Restore button
                            <Button variant="outline" size="sm" onClick={() => handleRestore(tx)}>
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Restore
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Edit transaction"
                                onClick={() => {
                                  setEditTx(tx);
                                  setTxDialogMode('edit');
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                aria-label="Delete transaction"
                                onClick={() => setDeleteTx(tx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination (D-10) */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground mr-2">
              Page {pagination.page + 1} of {pagination.totalPages}
            </span>
            {Array.from({ length: pagination.totalPages }, (_, i) => (
              <Button
                key={i}
                variant={i === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => void setPage(i)}
                className="h-8 w-8 p-0"
              >
                {i + 1}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Transaction Dialog */}
      {txDialogMode && (
        <TxDialog
          open={!!txDialogMode}
          mode={txDialogMode}
          editTx={editTx ?? undefined}
          walletId={wallet.id}
          onClose={() => {
            setTxDialogMode(null);
            setEditTx(null);
          }}
        />
      )}

      {/* Delete Transaction Dialog */}
      <DeleteTxDialog tx={deleteTx} walletId={wallet.id} onClose={() => setDeleteTx(null)} />

      {/* Delete Wallet Dialog */}
      <Dialog open={deleteWalletOpen} onOpenChange={setDeleteWalletOpen}>
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
            <Button
              variant="outline"
              onClick={() => setDeleteWalletOpen(false)}
              disabled={isDeletingWallet}
            >
              Close
            </Button>
            <Button variant="destructive" onClick={handleDeleteWallet} disabled={isDeletingWallet}>
              {isDeletingWallet ? 'Deleting…' : 'Delete Wallet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
