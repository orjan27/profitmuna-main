'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatCurrency, toCents } from '@/lib/format-currency';
import { todayLocal } from '@/lib/format-date';
import { PAYMENT_METHODS } from '@/lib/constants';
import {
  getRecordSheetData,
  recordIncomeFromSheet,
  recordExpenseFromSheet,
  type RecordSheetData,
  type SplitAccount,
} from '@/server/record-sheet';

export type RecordMode = 'income' | 'expense';

interface RecordSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: RecordMode;
  onModeChange: (mode: RecordMode) => void;
}

/** Maps action error codes to plain-language messages. */
function errorMessage(code: string): string {
  switch (code) {
    case 'invalid_amount':
      return 'Enter an amount greater than zero.';
    case 'invalid_category':
      return 'Pick a category first.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * The global Record sheet: record income or an expense from anywhere in the
 * app. Income entries show a live preview of how the amount will split across
 * the user's allocation accounts as they type — the core promise, visible at
 * the moment of entry.
 *
 * Data (categories + allocation accounts) loads lazily on first open via a
 * server action and is cached for the session.
 */
export function RecordSheet({
  open,
  onOpenChange,
  mode,
  onModeChange,
}: RecordSheetProps): React.JSX.Element {
  const [data, setData] = useState<RecordSheetData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Bumped by "Try again" to re-trigger the load effect explicitly.
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    // isLoading/loadFailed must NOT be dependencies here: setIsLoading(true)
    // below would re-run the effect, whose cleanup flips `cancelled` for the
    // fetch it just started — the result is discarded and the skeleton never
    // resolves. The effect re-runs only on open/data/loadAttempt changes.
    if (!open || data) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);
    getRecordSheetData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data, loadAttempt]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="text-[20px] leading-tight">Record</SheetTitle>
          <SheetDescription className="sr-only">
            Record income or an expense without leaving this page.
          </SheetDescription>

          {/* Mode switch — income | expense */}
          <div
            role="tablist"
            aria-label="What to record"
            className="mt-3 inline-flex w-fit items-center rounded-lg bg-raised/60 p-0.5"
          >
            {(['income', 'expense'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => onModeChange(m)}
                className={cn(
                  'rounded-md px-3.5 py-1.5 text-sm transition-colors',
                  mode === m
                    ? 'bg-paper font-medium text-ink'
                    : 'text-ink-faint hover:text-ink-soft'
                )}
              >
                {m === 'income' ? 'Income' : 'Expense'}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="px-6 pt-4 pb-8">
          {isLoading ? <SheetSkeleton /> : null}

          {loadFailed ? (
            <div className="py-12 text-center">
              <p className="text-sm text-ink-soft">Could not load your categories.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setLoadAttempt((n) => n + 1)}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {data && !isLoading ? (
            mode === 'income' ? (
              <IncomeEntryForm data={data} onDone={() => onOpenChange(false)} />
            ) : (
              <ExpenseEntryForm data={data} onDone={() => onOpenChange(false)} />
            )
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SheetSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <div className="h-12 animate-pulse rounded-md bg-raised/50" />
      <div className="h-9 animate-pulse rounded-md bg-raised/50" />
      <div className="h-9 animate-pulse rounded-md bg-raised/50" />
      <div className="h-9 w-2/3 animate-pulse rounded-md bg-raised/50" />
    </div>
  );
}

// ── Live split preview ────────────────────────────────────────────────────────

interface SplitPreviewProps {
  accounts: SplitAccount[];
  /** Amount in integer cents */
  amountCents: number;
  pending: boolean;
}

/**
 * The promise, live: how this income will split across allocation accounts.
 * Per-account cents are rounded; any rounding drift lands on the largest
 * share so the rows always sum to the entered amount.
 */
function SplitPreview({ accounts, amountCents, pending }: SplitPreviewProps): React.JSX.Element {
  const rows = useMemo(() => {
    const computed = accounts.map((a) => ({
      ...a,
      cents: Math.round((amountCents * a.targetPercentage) / 100),
    }));
    const drift = amountCents - computed.reduce((sum, r) => sum + r.cents, 0);
    if (drift !== 0 && computed.length > 0) {
      const largest = computed.reduce(
        (max, r) => (r.targetPercentage > max.targetPercentage ? r : max),
        computed[0]
      );
      largest.cents += drift;
    }
    return computed;
  }, [accounts, amountCents]);

  return (
    <div className="rounded-lg bg-raised/40 px-4 py-4">
      <div
        className="flex h-2 gap-[3px] overflow-hidden rounded-full"
        role="img"
        aria-label={`Split preview: ${rows
          .map((r) => `${r.name} ${formatCurrency(r.cents)}`)
          .join(', ')}`}
      >
        {rows.map((row) => (
          <div
            key={row.id}
            className="h-full"
            style={{ width: `${row.targetPercentage}%`, backgroundColor: row.color }}
          />
        ))}
      </div>

      <ul className="mt-3.5 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline gap-3 text-xs">
            <span className="truncate text-ink-soft">{row.name}</span>
            <span className="shrink-0 text-ink-faint tabular-nums">{row.targetPercentage}%</span>
            <span className="ml-auto shrink-0 font-medium text-ink tabular-nums">
              {formatCurrency(row.cents)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-ink-faint">
        {pending
          ? 'Splits across your buckets when you mark it received.'
          : 'Split applied the moment you record it.'}
      </p>
    </div>
  );
}

// ── Income entry ──────────────────────────────────────────────────────────────

interface EntryFormProps {
  data: RecordSheetData;
  onDone: () => void;
}

function IncomeEntryForm({ data, onDone }: EntryFormProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [moneyStatus, setMoneyStatus] = useState<'PENDING' | 'RECEIVED'>('PENDING');
  const [incomeDate, setIncomeDate] = useState(todayLocal());
  const [description, setDescription] = useState('');
  const [expectedReleaseDate, setExpectedReleaseDate] = useState('');
  const [pfAllocated, setPfAllocated] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  const amountPesos = Number(amount);
  const amountCents = Number.isFinite(amountPesos) && amountPesos > 0 ? toCents(amountPesos) : 0;
  const showPreview = pfAllocated && amountCents > 0 && data.accounts.length > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordIncomeFromSheet({
        categoryId: Number(categoryId),
        amountPesos,
        moneyStatus,
        incomeDate,
        description: description.trim() || undefined,
        expectedReleaseDate: expectedReleaseDate || undefined,
        profitFirstAllocated: pfAllocated,
      });
      if ('error' in result) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(`${formatCurrency(amountCents)} recorded.`);
      setAmount('');
      setDescription('');
      setExpectedReleaseDate('');
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Amount — the one field that matters most, sized accordingly */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-income-amount">Amount (₱)</Label>
        <Input
          id="record-income-amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-12 text-2xl font-semibold tabular-nums md:text-2xl"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-income-category">Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger id="record-income-category">
            <SelectValue placeholder="Pick a category" />
          </SelectTrigger>
          <SelectContent>
            {data.incomeCategories.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="record-income-status">Status</Label>
          <Select
            value={moneyStatus}
            onValueChange={(v) => setMoneyStatus(v as 'PENDING' | 'RECEIVED')}
          >
            <SelectTrigger id="record-income-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RECEIVED">Received</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="record-income-date">Date</Label>
          <Input
            id="record-income-date"
            type="date"
            value={incomeDate}
            onChange={(e) => setIncomeDate(e.target.value)}
            required
          />
        </div>
      </div>

      {showPreview ? (
        <SplitPreview
          accounts={data.accounts}
          amountCents={amountCents}
          pending={moneyStatus === 'PENDING'}
        />
      ) : null}

      {/* Less-used fields stay out of the way until asked for */}
      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
        className="flex items-center gap-1 self-start text-sm text-ink-faint transition-colors hover:text-ink"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn('h-4 w-4 transition-transform', moreOpen && 'rotate-180')}
        />
        More options
      </button>

      {moreOpen ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="record-income-description">Description (optional)</Label>
            <Textarea
              id="record-income-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="record-income-release">Expected release date (optional)</Label>
            <Input
              id="record-income-release"
              type="date"
              value={expectedReleaseDate}
              onChange={(e) => setExpectedReleaseDate(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="record-income-pf">Include in Profit First</Label>
              <p className="mt-0.5 text-xs text-ink-faint">
                When off, this income won&apos;t be split across your buckets.
              </p>
            </div>
            <Switch id="record-income-pf" checked={pfAllocated} onCheckedChange={setPfAllocated} />
          </div>
        </div>
      ) : null}

      <Button type="submit" disabled={isPending || !categoryId || amountCents <= 0}>
        {isPending ? 'Recording…' : 'Record income'}
      </Button>
    </form>
  );
}

// ── Expense entry ─────────────────────────────────────────────────────────────

function ExpenseEntryForm({ data, onDone }: EntryFormProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('none');
  const [expenseDate, setExpenseDate] = useState(todayLocal());
  const [description, setDescription] = useState('');

  const amountPesos = Number(amount);
  const amountCents = Number.isFinite(amountPesos) && amountPesos > 0 ? toCents(amountPesos) : 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordExpenseFromSheet({
        categoryId: Number(categoryId),
        amountPesos,
        expenseDate,
        paymentMethod: paymentMethod !== 'none' ? paymentMethod : undefined,
        description: description.trim() || undefined,
      });
      if ('error' in result) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(`${formatCurrency(amountCents)} expense recorded.`);
      setAmount('');
      setDescription('');
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-expense-amount">Amount (₱)</Label>
        <Input
          id="record-expense-amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-12 text-2xl font-semibold tabular-nums md:text-2xl"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-expense-category">Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger id="record-expense-category">
            <SelectValue placeholder="Pick a category" />
          </SelectTrigger>
          <SelectContent>
            {data.expenseCategories.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="record-expense-method">Paid with</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger id="record-expense-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {PAYMENT_METHODS.map((pm) => (
                <SelectItem key={pm.value} value={pm.value}>
                  {pm.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="record-expense-date">Date</Label>
          <Input
            id="record-expense-date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-expense-description">Description (optional)</Label>
        <Textarea
          id="record-expense-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
        />
      </div>

      <Button type="submit" disabled={isPending || !categoryId || amountCents <= 0}>
        {isPending ? 'Recording…' : 'Record expense'}
      </Button>
    </form>
  );
}
