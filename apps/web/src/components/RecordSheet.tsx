'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronDown, X } from 'lucide-react';
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
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toCents } from '@/lib/format-currency';
import { useFormatCurrency } from '@/components/CurrencyProvider';
import { Stella, StellaSprite } from '@/components/Stella';
import {
  RecurrenceFields,
  NO_RECURRENCE,
  recurrenceIsValid,
  toRecurrenceInput,
  type RecurrenceValue,
} from '@/components/RecurrenceFields';
import { todayLocal } from '@/lib/format-date';
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
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="px-6 pt-6 pb-2">
          {/* Custom title row so the close X shares the 24px content gutter
              and centers vertically with the title (the built-in close sits
              at top-4 right-4, off this sheet's grid). */}
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[20px] leading-tight">Record</SheetTitle>
            <SheetClose className="rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">
            Record income or an expense without leaving this page.
          </SheetDescription>

          {/* Mode switch — income | expense. The active mode's direction gets
              its money color: the one place the switch is allowed a hue. */}
          <div
            role="tablist"
            aria-label="What to record"
            className="mt-3 grid w-full grid-cols-2 rounded-lg bg-raised/60 p-1"
          >
            {(['income', 'expense'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => onModeChange(m)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md py-2 text-sm transition-colors',
                  mode === m
                    ? cn(
                        'bg-paper font-medium shadow-xs',
                        m === 'income' ? 'text-income' : 'text-expense'
                      )
                    : 'text-ink-faint hover:text-ink-soft'
                )}
              >
                {m === 'income' ? (
                  <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                {m === 'income' ? 'Income' : 'Expense'}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* flex-1 lets the entry forms stretch so the action bar can anchor
            to the sheet bottom even when the form is short. */}
        <div className="flex flex-1 flex-col px-6 pt-4 pb-8">
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
      <div className="h-14 animate-pulse rounded-lg bg-raised/50" />
      <div className="h-9 animate-pulse rounded-md bg-raised/50" />
      <div className="h-9 animate-pulse rounded-md bg-raised/50" />
      <div className="h-9 w-2/3 animate-pulse rounded-md bg-raised/50" />
    </div>
  );
}

// ── Amount field ──────────────────────────────────────────────────────────────

interface AmountFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  mode: RecordMode;
  /** Rendered below the input box, inside the label group (e.g. Stella). */
  children?: React.ReactNode;
}

/**
 * The hero field: a large bordered box with the peso sign in-field and a
 * direction pill ("Money in" / "Money out") — the pill carries the mode's
 * money color so the direction reads at a glance.
 */
function AmountField({ id, value, onChange, mode, children }: AmountFieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Amount</Label>
      <div className="flex h-14 items-center gap-2 rounded-lg border border-input px-4 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
        <span aria-hidden="true" className="text-2xl font-semibold text-ink-faint">
          ₱
        </span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-2xl font-semibold tabular-nums outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-ink-faint/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          autoFocus
          required
        />
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
            mode === 'income' ? 'bg-income/15 text-income' : 'bg-expense/15 text-expense'
          )}
        >
          {mode === 'income' ? 'Money in' : 'Money out'}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Advanced options disclosure ───────────────────────────────────────────────

interface AdvancedToggleProps {
  open: boolean;
  onToggle: () => void;
}

function AdvancedToggle({ open, onToggle }: AdvancedToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex items-center gap-1 self-start text-sm font-medium text-ink-soft transition-colors hover:text-ink"
    >
      Advanced options
      <ChevronDown
        aria-hidden="true"
        className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
      />
    </button>
  );
}

// ── Pinned action bar ─────────────────────────────────────────────────────────

interface RecordActionsProps {
  submitLabel: string;
  isPending: boolean;
  disabled: boolean;
  onCancel: () => void;
}

/**
 * Sheet footer: divider, full-width primary on top, full-width Cancel below.
 * Sticky against the sheet's scroll container so the commit action never
 * scrolls away. DOM order stays Cancel-then-primary (flex-col-reverse) so
 * tabbing reaches Cancel before the destructive-ish commit.
 */
function RecordActions({
  submitLabel,
  isPending,
  disabled,
  onCancel,
}: RecordActionsProps): React.JSX.Element {
  return (
    <div className="sticky bottom-0 z-10 mt-auto -mx-6 -mb-8 flex flex-col-reverse gap-2 border-t border-hairline bg-background/95 px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur [&>button]:h-11 [&>button]:w-full">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={disabled}>
        {isPending ? 'Recording…' : submitLabel}
      </Button>
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
  const formatCurrency = useFormatCurrency();
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

      {/* Stella perks up the moment the split comes alive — the app's core
          promise gets a face at the moment of entry. */}
      <div className="mt-3 flex items-center gap-2">
        <StellaSprite mood="smiling" size={24} decorative />
        <p className="text-[11px] text-ink-faint">
          {pending
            ? 'Splits across your buckets when you mark it received.'
            : 'Split applied the moment you record it.'}
        </p>
      </div>
    </div>
  );
}

// ── Income entry ──────────────────────────────────────────────────────────────

interface EntryFormProps {
  data: RecordSheetData;
  onDone: () => void;
}

function IncomeEntryForm({ data, onDone }: EntryFormProps): React.JSX.Element {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [moneyStatus, setMoneyStatus] = useState<'PENDING' | 'RECEIVED'>('PENDING');
  const [incomeDate, setIncomeDate] = useState(todayLocal());
  const [description, setDescription] = useState('');
  const [expectedReleaseDate, setExpectedReleaseDate] = useState('');
  const [pfAllocated, setPfAllocated] = useState(true);
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(NO_RECURRENCE);
  const [moreOpen, setMoreOpen] = useState(false);

  const amountPesos = Number(amount);
  const amountCents = Number.isFinite(amountPesos) && amountPesos > 0 ? toCents(amountPesos) : 0;
  const showPreview = pfAllocated && amountCents > 0 && data.accounts.length > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!recurrenceIsValid(recurrence)) {
      toast.error('Pick two different days for the bi-weekly repeat.');
      return;
    }
    startTransition(async () => {
      const result = await recordIncomeFromSheet({
        categoryId: Number(categoryId),
        amountPesos,
        moneyStatus,
        incomeDate,
        description: description.trim() || undefined,
        expectedReleaseDate: expectedReleaseDate || undefined,
        profitFirstAllocated: pfAllocated,
        recurrence: toRecurrenceInput(recurrence),
      });
      if ('error' in result) {
        toast.error(errorMessage(result.error));
        return;
      }
      if ('warning' in result) {
        toast.warning('Income recorded, but the repeat schedule could not be saved.');
      } else {
        toast.success(`${formatCurrency(amountCents)} recorded.`, {
          icon: <StellaSprite mood="happy" size={20} decorative />,
        });
      }
      setAmount('');
      setDescription('');
      setExpectedReleaseDate('');
      setRecurrence(NO_RECURRENCE);
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5" noValidate>
      <AmountField id="record-income-amount" value={amount} onChange={setAmount} mode="income" />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-income-category">Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger id="record-income-category" className="w-full">
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
          <Label htmlFor="record-income-date">Date</Label>
          <Input
            id="record-income-date"
            type="date"
            value={incomeDate}
            onChange={(e) => setIncomeDate(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="record-income-status">Status</Label>
          <Select
            value={moneyStatus}
            onValueChange={(v) => setMoneyStatus(v as 'PENDING' | 'RECEIVED')}
          >
            <SelectTrigger id="record-income-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
            </SelectContent>
          </Select>
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
      <AdvancedToggle open={moreOpen} onToggle={() => setMoreOpen((v) => !v)} />

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
          <RecurrenceFields
            value={recurrence}
            onChange={setRecurrence}
            referenceDate={incomeDate}
            idPrefix="record-income-recurrence"
          />
        </div>
      ) : null}

      {/* Whether this income splits is core to the promise, so the toggle
          stays visible instead of hiding under Advanced options. */}
      <div className="flex items-center justify-between gap-4 rounded-lg bg-raised/40 px-4 py-3.5">
        <div>
          <Label htmlFor="record-income-pf">Include in Profit First</Label>
          <p className="mt-0.5 text-xs text-ink-faint">
            When off, this income won&apos;t be split across your buckets.
          </p>
        </div>
        <Switch
          id="record-income-pf"
          checked={pfAllocated}
          onCheckedChange={setPfAllocated}
          className="data-[state=checked]:bg-income"
        />
      </div>

      <RecordActions
        submitLabel="Record income"
        isPending={isPending}
        disabled={isPending || !categoryId || amountCents <= 0}
        onCancel={onDone}
      />
    </form>
  );
}

// ── Expense entry ─────────────────────────────────────────────────────────────

function ExpenseEntryForm({ data, onDone }: EntryFormProps): React.JSX.Element {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [walletId, setWalletId] = useState(
    data.defaultWalletId != null ? String(data.defaultWalletId) : ''
  );
  const [expenseDate, setExpenseDate] = useState(todayLocal());
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(NO_RECURRENCE);
  const [moreOpen, setMoreOpen] = useState(false);

  const amountPesos = Number(amount);
  const amountCents = Number.isFinite(amountPesos) && amountPesos > 0 ? toCents(amountPesos) : 0;

  // Stella reacts live as the amount grows: smiling while the expense fits
  // inside the Operating Expenses bucket, teary once it would overdraw it.
  // A warning with a face — submission stays allowed either way.
  const opex = data.accounts.find((account) => account.accountType === 'OPEX');
  const overOpex = opex !== undefined && amountCents > opex.computedBalance;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!recurrenceIsValid(recurrence)) {
      toast.error('Pick two different days for the bi-weekly repeat.');
      return;
    }
    startTransition(async () => {
      const result = await recordExpenseFromSheet({
        categoryId: Number(categoryId),
        amountPesos,
        expenseDate,
        walletId: Number(walletId),
        description: description.trim() || undefined,
        recurrence: toRecurrenceInput(recurrence),
      });
      if ('error' in result) {
        toast.error(errorMessage(result.error));
        return;
      }
      if ('warning' in result) {
        toast.warning('Expense recorded, but the repeat schedule could not be saved.');
      } else {
        toast.success(`${formatCurrency(amountCents)} expense recorded.`, {
          icon: <StellaSprite mood="wink" size={20} decorative />,
        });
      }
      setAmount('');
      setDescription('');
      setRecurrence(NO_RECURRENCE);
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5" noValidate>
      <AmountField id="record-expense-amount" value={amount} onChange={setAmount} mode="expense">
        {opex && amountCents > 0 ? (
          <Stella
            mood={overOpex ? 'sad' : 'smiling'}
            animated
            size={28}
            className="mt-1"
            caption={
              overOpex
                ? `That's more than your ${opex.name} bucket (${formatCurrency(opex.computedBalance)}).`
                : `Within your ${opex.name} bucket.`
            }
          />
        ) : null}
      </AmountField>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-expense-category">Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger id="record-expense-category" className="w-full">
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
          <Label htmlFor="record-expense-date">Date</Label>
          <Input
            id="record-expense-date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="record-expense-wallet">Paid with</Label>
          <Select value={walletId} onValueChange={setWalletId} required>
            <SelectTrigger id="record-expense-wallet" className="w-full">
              <SelectValue placeholder="Select a wallet" />
            </SelectTrigger>
            <SelectContent>
              {data.wallets.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Less-used fields stay out of the way until asked for */}
      <AdvancedToggle open={moreOpen} onToggle={() => setMoreOpen((v) => !v)} />

      {moreOpen ? (
        <div className="flex flex-col gap-5">
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
          <RecurrenceFields
            value={recurrence}
            onChange={setRecurrence}
            referenceDate={expenseDate}
            idPrefix="record-expense-recurrence"
          />
        </div>
      ) : null}

      <RecordActions
        submitLabel="Record expense"
        isPending={isPending}
        disabled={isPending || !categoryId || amountCents <= 0}
        onCancel={onDone}
      />
    </form>
  );
}
