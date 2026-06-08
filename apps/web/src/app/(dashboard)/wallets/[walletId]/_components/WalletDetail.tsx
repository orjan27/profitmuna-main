'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryState, parseAsInteger } from 'nuqs';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
  RotateCcw,
  Star,
  TriangleAlert,
  Wallet,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { toCents } from '@/lib/format-currency';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import { formatDate } from '@/lib/format-date';
import { sourceLabel, withdrawalLabel } from '@/lib/wallet-labels';
import { walletCardGradient } from '@/lib/wallet-color';
import { AmountToggle, MaskedAmount, useAmountVisibility } from '@/components/amount-visibility';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  createTransactionAction,
  createWalletIncomeAction,
  updateTransactionAction,
  deleteTransactionAction,
  restoreTransactionAction,
  deleteWalletAction,
} from '../../_actions/wallet-actions';
import { EditWalletDialog } from './EditWalletDialog';
import type {
  WalletDetailResponse,
  WalletTransaction,
  IncomeCategory,
  PfAccount,
} from '@/types/wallet';

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

/** Money flowing INTO the wallet — deposits, auto-credited income, direct top-up income */
function isMoneyIn(type: WalletTransaction['type']): boolean {
  return type === 'DEPOSIT' || type === 'INCOME_AUTO' || type === 'INCOME';
}

/** Plain-language activity row title, PF-aware for withdrawals */
function transactionTitle(tx: WalletTransaction, pfAccount: PfAccount | null): string {
  switch (tx.type) {
    case 'DEPOSIT':
      return 'Deposit';
    case 'WITHDRAWAL':
      return withdrawalLabel(pfAccount ? pfAccount.id : null, pfAccount?.accountType ?? null);
    case 'INCOME_AUTO':
      return 'Income allocation';
    case 'INCOME':
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
  /** Linked Profit First account — null for standalone wallets */
  pfAccount: PfAccount | null;
  incomeCategories: IncomeCategory[];
  /** D-06: income category ids already mapped to a DIFFERENT wallet */
  mappedIncomeCategoryIds: Set<number>;
  /** When true (via ?edit=1), the edit dialog opens on first render */
  initialEditOpen: boolean;
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

  // Labels mirror the action tiles ("Add money" / "Withdraw") so the dialog
  // never introduces a second name for the same action
  const title = isEdit
    ? isDeposit
      ? 'Edit deposit'
      : 'Edit withdrawal'
    : isDeposit
      ? 'Add money'
      : 'Withdraw';

  const confirmLabel = isEdit ? 'Save changes' : isDeposit ? 'Add money' : 'Withdraw';

  const pendingLabel = isEdit ? 'Saving…' : isDeposit ? 'Adding…' : 'Withdrawing…';

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

// ── Add Income Dialog (PF allocation wallets) ─────────────────────────────────

interface AddIncomeDialogProps {
  open: boolean;
  walletId: number;
  categories: IncomeCategory[];
  onClose: () => void;
}

/**
 * "Add money" for PF allocation wallets: records a real income with Profit First
 * OFF, linked directly to this wallet. Credits the wallet without splitting across
 * allocations. Editing/deleting these entries lives in the Income section.
 */
function AddIncomeDialog({ open, walletId, categories, onClose }: AddIncomeDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string>(
    categories.length > 0 ? String(categories[0].id) : ''
  );
  const [date, setDate] = useState(todayIso());
  const [description, setDescription] = useState('');

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
    if (!categoryId) {
      toast.error('Choose a category.');
      return;
    }

    startTransition(async () => {
      const result = await createWalletIncomeAction(walletId, {
        categoryId: Number(categoryId),
        amount: cents,
        incomeDate: date,
        description: description || undefined,
      });

      if (result?.error) {
        toast.error('Something went wrong. Please try again.');
        return;
      }

      toast.success('Income added.');
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add money</DialogTitle>
          <DialogDescription>
            Recorded as income for this wallet, excluded from Profit First allocations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="inc-amount">Amount</Label>
            <Input
              id="inc-amount"
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
            <Label htmlFor="inc-category">Category</Label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              disabled={isPending || categories.length === 0}
            >
              <SelectTrigger id="inc-category">
                <SelectValue
                  placeholder={categories.length === 0 ? 'No categories' : 'Select a category'}
                />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-date">Date</Label>
            <Input
              id="inc-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-description">Description</Label>
            <Input
              id="inc-description"
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
            <Button type="submit" disabled={isPending || categories.length === 0}>
              {isPending ? 'Adding…' : 'Add money'}
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
  const formatCurrency = useFormatCurrency();
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

// ── Action Tile ───────────────────────────────────────────────────────────────

interface ActionTileProps extends React.ComponentPropsWithoutRef<'button'> {
  icon: React.ReactNode;
  label: string;
  /** Visually dimmed but still clickable so the click can explain itself */
  blocked?: boolean;
}

/**
 * One square quick-action below the hero card: circular icon over a label.
 * Blocked tiles stay clickable — the handler explains why via toast, which
 * works on touch where a hover tooltip never shows.
 */
function ActionTile({ icon, label, blocked, className, ...props }: ActionTileProps) {
  return (
    <button
      type="button"
      aria-disabled={blocked || undefined}
      className={cn(
        'flex flex-col items-center gap-2.5 rounded-2xl bg-card px-2 py-4 text-[13px] font-medium',
        'motion-safe:transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        blocked && 'cursor-not-allowed opacity-55 hover:bg-card',
        className
      )}
      {...props}
    >
      <span className="grid size-10 place-items-center rounded-full bg-raised text-ink">
        {icon}
      </span>
      {label}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WalletDetail({
  detail,
  pfAccount,
  incomeCategories,
  mappedIncomeCategoryIds,
  initialEditOpen,
}: WalletDetailProps) {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const { visible, toggle, mounted } = useAmountVisibility();
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
  // "Add money" on a PF allocation wallet records a direct income (PF off)
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);

  // Edit wallet dialog state — ?edit=1 (from the list's Edit action) opens it on load
  const [editWalletOpen, setEditWalletOpen] = useState(initialEditOpen);

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
        toast.error(
          result.error === 'cannot_delete_default_wallet'
            ? 'The Default wallet cannot be deleted.'
            : 'Something went wrong. Please try again.'
        );
        setDeleteWalletOpen(false);
        return;
      }
      toast.success('Wallet deleted.');
      router.push('/wallets');
    });
  }

  // PF allocation wallets "Add money" as a direct income (PF off) — never blocked.
  // Income-mapped (non-PF) wallets still block manual deposits to avoid double-count;
  // mapping PRESENCE blocks, not amounts (a mapped category with zero spend still blocks).
  const isPfWallet = wallet.profitFirstAccountId != null;
  const depositBlocked = !isPfWallet && wallet.incomeCategoryIds.length > 0;
  const depositBlockReason = BLOCKING_COPY.income_mapped;

  // Withdrawals are allowed on all wallets — the expense-mapping guard was dropped.

  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Money in / money out summary tiles, derived from the same breakdown D-02 exposes
  const moneyInCents =
    breakdown.pfAllocationCents +
    breakdown.mappedIncomeCents +
    breakdown.depositsCents +
    breakdown.directIncomeCents;
  const moneyOutCents = breakdown.mappedExpensesCents + breakdown.withdrawalsCents;
  const hasActivity = moneyInCents !== 0 || moneyOutCents !== 0;

  // Reserve the trailing menu slot only when this page of rows has editable
  // (manual) entries — keeps amounts aligned without wasting subtitle width
  // on all-auto lists
  const hasManualRows = transactions.some((t) => t.source === 'manual');

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      {/* Header — back chevron + wallet name; the eye toggle drives every masked amount */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" aria-label="Back to wallets" asChild>
          <Link href="/wallets">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-[20px] leading-tight font-semibold">
          {wallet.name}
        </h1>
        <AmountToggle visible={visible} toggle={toggle} />
      </div>

      {/* Hero card — same bank-card surface as the wallets-list stack */}
      <div
        className="relative h-52 overflow-hidden rounded-[1.75rem] text-white shadow-[0_16px_40px_-20px_rgb(0_0_0/0.6)]"
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

        <div className="relative flex h-full flex-col px-6 pt-5 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
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
            {wallet.isDefault && (
              <span className="grid size-8 place-items-center">
                <Star aria-hidden="true" className="size-4 fill-white text-white" />
                <span className="sr-only">Default wallet</span>
              </span>
            )}
          </div>

          <p className="mt-4 truncate text-[15px] font-semibold text-white/95">{wallet.name}</p>

          <MaskedAmount
            cents={wallet.balanceCents}
            visible={visible}
            mounted={mounted}
            className="mt-1.5 text-[32px] leading-none font-bold tracking-tight tabular-nums"
          />

          {pfAccount && (
            <p className="mt-auto truncate text-xs font-medium text-white/85">
              {pfAccount.name} · {pfAccount.targetPercentage}% allocation
            </p>
          )}
        </div>
      </div>

      {/* Quick actions — Edit and Delete live under More */}
      <div className="grid grid-cols-3 gap-3">
        <ActionTile
          icon={<Plus aria-hidden="true" className="size-4.5" />}
          label="Add money"
          blocked={depositBlocked}
          onClick={() => {
            if (isPfWallet) {
              setIncomeDialogOpen(true);
            } else if (depositBlocked) {
              toast.error(depositBlockReason);
            } else {
              setTxDialogMode('add-deposit');
            }
          }}
        />
        <ActionTile
          icon={<ArrowDownToLine aria-hidden="true" className="size-4.5" />}
          label="Withdraw"
          onClick={() => setTxDialogMode('add-withdrawal')}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionTile
              icon={<MoreVertical aria-hidden="true" className="size-4.5" />}
              label="More"
              aria-label={`More options for ${wallet.name}`}
              className="data-[state=open]:bg-raised"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* D-05: inline edit on the detail page — no separate /edit route */}
            <DropdownMenuItem onSelect={() => setEditWalletOpen(true)}>
              Edit wallet
            </DropdownMenuItem>
            {/* The Default wallet is undeletable (server returns 409) — hide the action */}
            {!wallet.isDefault && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeleteWalletOpen(true)}
              >
                Delete wallet
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Money in / Money out — totals from the balance breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
            <span aria-hidden="true" className="size-2 rounded-full bg-income" />
            Money in
          </p>
          <MaskedAmount
            cents={moneyInCents}
            visible={visible}
            mounted={mounted}
            className="mt-1 block text-lg leading-tight font-semibold tabular-nums"
          />
        </div>
        <div className="rounded-2xl bg-card px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
            <span aria-hidden="true" className="size-2 rounded-full bg-expense" />
            Money out
          </p>
          <MaskedAmount
            cents={moneyOutCents}
            visible={visible}
            mounted={mounted}
            className="mt-1 block text-lg leading-tight font-semibold tabular-nums"
          />
        </div>
      </div>

      {/* Balance breakdown disclosure (D-02) — the tiles summarize, this itemizes */}
      {hasActivity && (
        <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-1.5 px-0 text-sm font-medium">
              {breakdownOpen ? (
                <ChevronDown aria-hidden="true" className="size-4" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-4" />
              )}
              Balance breakdown
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 pt-1 pb-2 pl-6 text-sm">
              {breakdown.pfAllocationCents !== 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Profit First allocation</span>
                  <span className="tabular-nums">
                    {formatCurrency(breakdown.pfAllocationCents)}
                  </span>
                </div>
              )}
              {breakdown.mappedIncomeCents !== 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Mapped income</span>
                  <span className="tabular-nums">
                    {formatCurrency(breakdown.mappedIncomeCents)}
                  </span>
                </div>
              )}
              {breakdown.directIncomeCents !== 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Income</span>
                  <span className="tabular-nums">
                    {formatCurrency(breakdown.directIncomeCents)}
                  </span>
                </div>
              )}
              {breakdown.mappedExpensesCents !== 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Mapped expenses</span>
                  <span className="tabular-nums">
                    -{formatCurrency(breakdown.mappedExpensesCents)}
                  </span>
                </div>
              )}
              {breakdown.depositsCents !== 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Deposits</span>
                  <span className="tabular-nums">{formatCurrency(breakdown.depositsCents)}</span>
                </div>
              )}
              {breakdown.withdrawalsCents !== 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Withdrawals</span>
                  <span className="tabular-nums">
                    -{formatCurrency(breakdown.withdrawalsCents)}
                  </span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Recent activity */}
      <section className="pt-2">
        <h2 className="text-xs font-medium tracking-[0.12em] text-ink-faint uppercase">
          Recent activity
        </h2>

        {transactions.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">No transactions yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-hairline">
            {transactions.map((tx) => {
              const moneyIn = isMoneyIn(tx.type);
              return (
                <li
                  key={`${tx.source}-${tx.id}`}
                  className={cn(
                    'flex items-center gap-3 py-3.5',
                    // D-09: soft-deleted rows greyed + strikethrough
                    tx.deletedAt && 'line-through opacity-50'
                  )}
                >
                  {/* Direction icon — green tint marks money in; outflows stay neutral */}
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full',
                      moneyIn ? 'bg-tint-income text-income' : 'bg-raised text-ink-soft'
                    )}
                  >
                    {moneyIn ? (
                      <ArrowDownLeft aria-hidden="true" className="size-4" />
                    ) : (
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {transactionTitle(tx, pfAccount)}
                    </p>
                    <p className="truncate text-[13px] text-ink-faint">
                      {tx.description ? `${tx.description} · ` : ''}
                      {formatDate(tx.transactionDate)}
                    </p>
                  </div>

                  {/* Sign always pairs with the color (never color alone) */}
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums whitespace-nowrap',
                      moneyIn && 'text-income'
                    )}
                  >
                    {moneyIn ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </span>

                  {/* Trailing slot keeps amounts aligned across mixed rows;
                      only manual rows get a menu — auto rows are read-only */}
                  {hasManualRows && (
                    <span className="grid size-8 shrink-0 place-items-center">
                      {tx.source === 'manual' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Transaction options"
                              className="data-[state=open]:bg-raised"
                            >
                              <MoreVertical aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {tx.deletedAt ? (
                              // D-09: soft-deleted — offer Restore
                              <DropdownMenuItem onSelect={() => handleRestore(tx)}>
                                <RotateCcw aria-hidden="true" className="size-3.5" />
                                Restore
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setEditTx(tx);
                                    setTxDialogMode('edit');
                                  }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => setDeleteTx(tx)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination (D-10) */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <span className="mr-2 text-sm text-ink-faint">
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
      </section>

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

      {/* Add Income Dialog — PF allocation wallets record a direct income (PF off) */}
      {incomeDialogOpen && (
        <AddIncomeDialog
          open={incomeDialogOpen}
          walletId={wallet.id}
          categories={incomeCategories}
          onClose={() => setIncomeDialogOpen(false)}
        />
      )}

      {/* Delete Transaction Dialog */}
      <DeleteTxDialog tx={deleteTx} walletId={wallet.id} onClose={() => setDeleteTx(null)} />

      {/* Edit Wallet Dialog — mounted only while open so state prefills fresh each time */}
      {editWalletOpen && (
        <EditWalletDialog
          open={editWalletOpen}
          onClose={() => setEditWalletOpen(false)}
          wallet={wallet}
          incomeCategories={incomeCategories}
          mappedIncomeCategoryIds={mappedIncomeCategoryIds}
        />
      )}

      {/* Delete Wallet Dialog */}
      <Dialog open={deleteWalletOpen} onOpenChange={setDeleteWalletOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Wallet</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{wallet.name}&rdquo;? Its income mappings and bucket link will be
              unlinked. Past expenses keep this wallet on their record.
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
