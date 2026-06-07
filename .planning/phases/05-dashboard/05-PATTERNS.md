# Phase 5: Dashboard — Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File                                                         | Role               | Data Flow        | Closest Analog                                                         | Match Quality |
| ------------------------------------------------------------------------- | ------------------ | ---------------- | ---------------------------------------------------------------------- | ------------- |
| `apps/api/src/routes/dashboard.ts`                                        | route              | request-response | `apps/api/src/routes/profit-first.ts`                                  | exact         |
| `apps/api/src/schemas/dashboard.ts`                                       | schema             | transform        | `apps/api/src/schemas/profit-first.ts`                                 | exact         |
| `apps/api/src/services/dashboard-service.ts`                              | service            | CRUD + batch     | `apps/api/src/services/profit-first-service.ts`                        | exact         |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx`                         | route (RSC)        | request-response | `apps/web/src/app/(dashboard)/profit-first/page.tsx`                   | exact         |
| `apps/web/src/app/(dashboard)/dashboard/_components/DashboardContent.tsx` | component          | event-driven     | `apps/web/src/app/(dashboard)/profit-first/_components/pf-content.tsx` | exact         |
| `apps/web/src/app/(dashboard)/dashboard/_components/DashboardFilters.tsx` | component          | event-driven     | `apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx` | exact         |
| `apps/web/src/app/api/dashboard/[...path]/route.ts`                       | route (BFF)        | request-response | `apps/web/src/app/api/wallets/[...path]/route.ts`                      | exact         |
| `apps/web/src/types/dashboard.ts`                                         | type               | transform        | `apps/web/src/types/wallet.ts`                                         | role-match    |
| `apps/web/src/app/(dashboard)/layout.tsx`                                 | layout (extend)    | request-response | self (existing minimal shell)                                          | self          |
| `apps/web/src/components/DashboardNav.tsx`                                | component (update) | event-driven     | self (existing nav)                                                    | self          |
| `apps/web/src/app/page.tsx`                                               | route (modify)     | request-response | `apps/web/src/app/(auth)/login/page.tsx` pattern                       | role-match    |
| `apps/api/tests/dashboard.test.ts`                                        | test               | batch            | `apps/api/tests/expense-category.test.ts`                              | role-match    |

---

## Pattern Assignments

### `apps/api/src/routes/dashboard.ts` (route, request-response)

**Analog:** `apps/api/src/routes/profit-first.ts`

**Imports pattern** (lines 1–14 of analog):

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { requireAuth } from '@/middleware/auth';
import { createDashboardService } from '@/services/dashboard-service';
import { dashboardQuerySchema } from '@/schemas/dashboard';
import { createDb } from '@app/db';
import type { Bindings, Variables } from '@/types';

const dashboardRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
```

**Auth guard pattern** (lines 18–19 of analog):

```typescript
// T-05-01: every dashboard route behind requireAuth
dashboardRouter.use('/*', requireAuth);
```

**Core route handler pattern** (lines 21–52 of analog):

```typescript
dashboardRouter.get(
  '/summary',
  zValidator('query', dashboardQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_error', message: 'Invalid query parameters' } },
        422
      );
    }
  }),
  async (c) => {
    const query = c.req.valid('query');
    const db = createDb(c.env.DB);
    const svc = createDashboardService(db);
    const userId = c.get('userId');

    const dateRange = query.from || query.to ? { from: query.from, to: query.to } : undefined;
    const result = await svc.getSummary(userId, dateRange, query.feedPage, query.feedSize);
    return c.json({ data: result });
  }
);

export { dashboardRouter };
```

**Router registration pattern** — add to `apps/api/src/index.ts` after the wallets router (lines 75–76 of index.ts):

```typescript
// Dashboard route — auth guard applied inside dashboardRouter via .use('/*', requireAuth)
app.route('/api/dashboard', dashboardRouter);
```

---

### `apps/api/src/schemas/dashboard.ts` (schema, transform)

**Analog:** `apps/api/src/schemas/profit-first.ts`

**Imports pattern** (line 1 of analog):

```typescript
import { z } from 'zod';
```

**Core schema pattern** (lines 68–73 of analog — `summaryQuerySchema`):

```typescript
/**
 * Query schema for GET /api/dashboard/summary.
 * from/to: YYYY-MM-DD date strings (optional).
 * feedPage/feedSize: pagination for the recent transactions feed.
 */
export const dashboardQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  feedPage: z.coerce.number().int().min(0).default(0),
  feedSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

Note: The regex validation on `from`/`to` is the defense against date-injection (RESEARCH Security §V5). The `summaryQuerySchema` in `profit-first.ts` uses looser `z.string().optional()` — use the regex variant here for date fields per the RESEARCH Security section.

---

### `apps/api/src/services/dashboard-service.ts` (service, batch + CRUD)

**Analog:** `apps/api/src/services/profit-first-service.ts` (factory pattern, parallel queries)
**Secondary analog:** `apps/api/src/services/wallet-service.ts` (multi-table joins, `computeBalanceCents` formula)

**Imports pattern** (lines 1–5 of profit-first-service.ts analog):

```typescript
import { eq, and, isNull, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { createDb } from '@app/db';
import {
  incomes,
  expenses,
  profitFirstAccounts,
  wallets,
  walletTransactions,
  walletIncomeCategoryMappings,
  walletExpenseCategoryMappings,
} from '@app/db/schema';
import { createProfitFirstService } from '@/services/profit-first-service';
import type { DateRange } from '@/services/profit-first-service';
```

**Factory + parallel-query pattern** (lines 136–178 of profit-first-service.ts):

```typescript
export function createDashboardService(db: ReturnType<typeof createDb>) {
  return {
    async getSummary(userId: number, dateRange?: DateRange, feedPage = 0, feedSize = 20) {
      const from = dateRange?.from;
      const to = dateRange?.to;

      const [incomeRows, expensesRows, pfSummary, walletBalanceCents, feedRows] = await Promise.all(
        [
          // ... income CASE aggregate query
          // ... expenses sum query
          createProfitFirstService(db).getSummary(userId, dateRange),
          // ... period-scoped wallet balance helper
          // ... recent transactions feed helper
        ]
      );
      // ... compose DashboardSummary
    },
  };
}
```

**Income CASE aggregate pattern** (adapted from RESEARCH.md Pattern 1 + profit-first-service lines 148–178 for date conditions):

```typescript
// Combined received + pending via CASE aggregate — one query instead of two
db
  .select({
    received: sql<number>`COALESCE(SUM(CASE WHEN ${incomes.moneyStatus} = 'RECEIVED' THEN ${incomes.amount} ELSE 0 END), 0)`,
    pending:  sql<number>`COALESCE(SUM(CASE WHEN ${incomes.moneyStatus} = 'PENDING'  THEN ${incomes.amount} ELSE 0 END), 0)`,
  })
  .from(incomes)
  .where(
    and(
      eq(incomes.userId, userId),
      from ? (sql`${incomes.incomeDate} >= ${from}` as ReturnType<typeof eq>) : undefined,
      to   ? (sql`${incomes.incomeDate} <= ${to}`   as ReturnType<typeof eq>) : undefined
    )
  ),
```

Note: Date field is `incomes.incomeDate`, not `receivedDate` — per RESEARCH Pitfall 6 and profit-first-service.ts lines 155–158.

**Expenses aggregate pattern** (adapted from profit-first-service + wallet-service `isNull` soft-delete pattern):

```typescript
db
  .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
  .from(expenses)
  .where(
    and(
      eq(expenses.userId, userId),
      isNull(expenses.deletedAt),
      from ? (sql`${expenses.expenseDate} >= ${from}` as ReturnType<typeof eq>) : undefined,
      to   ? (sql`${expenses.expenseDate} <= ${to}`   as ReturnType<typeof eq>) : undefined
    )
  ),
```

**Period-scoped wallet balance** — the dashboard must implement its own date-scoped wallet balance query. Do NOT delegate to `createWalletService(db).list()` (that returns all-time balances — RESEARCH Pitfall 1). Use the `computeBalanceCents` formula from wallet-service.ts lines 33–48:

```typescript
/** Balance formula (locked): pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals */
function computeBalanceCents({
  pfAllocation,
  mappedIncome,
  mappedExpenses,
  deposits,
  withdrawals,
}) {
  return pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals;
}
```

Apply date conditions (`transactionDate`, `incomeDate`, `expenseDate`) on each component query to produce a period-scoped total.

**Recent transactions feed merge pattern** — follow wallet-service.ts multi-source parallel query style (lines 169–203), but cross-wallet scope. Fetch income, expense, and wallet_transaction rows independently then merge+sort in JS:

```typescript
// Fetch each source with limit = (feedPage+1)*feedSize to bound memory
// Sort merged array by date DESC then id DESC
// Slice [feedPage*feedSize .. (feedPage+1)*feedSize]
// hasMore = fetchedTotal > (feedPage+1)*feedSize
```

Soft-delete rule: `isNull(expenses.deletedAt)` and `isNull(walletTransactions.deletedAt)` on their respective queries; incomes have no soft-delete.

**Error handling pattern** (lines 302–312 of profit-first-service.ts):

```typescript
// HTTPException for expected domain errors
throw new HTTPException(404, { message: 'not_found' });
// Generic errors propagate up to app.onError() in index.ts (lines 35–46)
```

---

### `apps/web/src/app/(dashboard)/dashboard/page.tsx` (RSC page, request-response)

**Analog:** `apps/web/src/app/(dashboard)/profit-first/page.tsx` (lines 1–109) — exact pattern.

**Imports pattern** (lines 1–3 of analog):

```typescript
import { cookies } from 'next/headers';
import { DashboardContent } from './_components/DashboardContent';
import { DashboardFilters } from './_components/DashboardFilters';
```

**searchParams + default range pattern** (lines 43–48 of analog):

```typescript
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;  // Next.js 15: searchParams is a Promise
```

**Server-side fetch pattern** (lines 50–87 of analog):

```typescript
const cookieStore = await cookies();
const accessToken = cookieStore.get('access_token')?.value;

// Apply Manila timezone default range (D-08)
// if no from/to in params, compute This Month default — see DashboardFilters DATE_PRESETS[0]
const from = params.from ?? getDefaultDashboardRange().from;
const to   = params.to   ?? getDefaultDashboardRange().to;

const query = new URLSearchParams();
if (from) query.set('from', from);
if (to)   query.set('to', to);

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';
const summaryUrl = `${apiBaseUrl}/api/dashboard/summary?${query.toString()}`;

let summary = null;
try {
  const res = await fetch(summaryUrl, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    cache: 'no-store',  // D-09: fresh data per visit
  });
  if (res.ok) {
    const json = await res.json() as { data: DashboardSummary };
    summary = json.data;
  }
} catch {
  // Network error — render zeroed state
}

return (
  <div className="flex flex-col gap-8">
    <div>
      <h1 className="text-[20px] font-semibold leading-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your financial overview for the selected period.
      </p>
    </div>
    <DashboardFilters />
    <DashboardContent summary={summary} from={from} to={to} />
  </div>
);
```

Note: `cache: 'no-store'` is mandatory — balances must always reflect current data (matches profit-first/page.tsx line 75 comment `T-03-08`).

---

### `apps/web/src/app/(dashboard)/dashboard/_components/DashboardContent.tsx` (client component, event-driven)

**Analog:** `apps/web/src/app/(dashboard)/profit-first/_components/pf-content.tsx` (lines 1–72) — exact client boundary pattern.

**Imports pattern** (lines 1–8 of analog):

```typescript
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Clock, DollarSign, Wallet } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAmountVisibility, AmountToggle, MaskedAmount } from '@/components/amount-visibility';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { PfOverview } from '@/app/(dashboard)/profit-first/_components/pf-overview';
import type { DashboardSummary, RecentTransaction } from '@/types/dashboard';
```

**Amount visibility hook pattern** (lines 26–28 of pf-content.tsx):

```typescript
export function DashboardContent({ summary, from, to }: DashboardContentProps) {
  const { visible, toggle, mounted } = useAmountVisibility();
  const [feedItems, setFeedItems] = useState<RecentTransaction[]>(summary?.recentTransactions ?? []);
  const [hasMore, setHasMore] = useState(summary?.feedPagination.hasMore ?? false);
  const [feedPage, setFeedPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
```

**Load more pattern** — client-side `useState`, NOT a URL param (RESEARCH Pitfall 5):

```typescript
async function handleLoadMore() {
  setLoadingMore(true);
  try {
    const nextPage = feedPage + 1;
    const res = await fetch(
      `/api/dashboard/summary?from=${from}&to=${to}&feedPage=${nextPage}&feedSize=20`
    );
    if (!res.ok) {
      toast.error('Could not load more transactions. Please try again.');
      return;
    }
    const json = (await res.json()) as { data: DashboardSummary };
    setFeedItems((prev) => [...prev, ...json.data.recentTransactions]);
    setHasMore(json.data.feedPagination.hasMore);
    setFeedPage(nextPage);
  } catch {
    toast.error('Could not load more transactions. Please try again.');
  } finally {
    setLoadingMore(false);
  }
}
```

**MaskedAmount + AmountToggle pattern** (pf-content.tsx lines 34–40 and pf-overview.tsx lines 213–219):

```typescript
// AmountToggle in header row
<AmountToggle visible={visible} toggle={toggle} />

// In stat card
<MaskedAmount
  cents={summary?.totalIncomeReceivedCents ?? 0}
  visible={visible}
  mounted={mounted}
  className="text-[28px] font-semibold leading-none tabular-nums"
/>
```

**Stat card pattern** (from UI-SPEC — no direct codebase analog, follows shadcn Card conventions):

```typescript
<Card className="shadow-sm rounded-xl">
  <CardContent className="flex items-center gap-4 p-6">
    <div className="rounded-full p-3 bg-emerald-100">
      <TrendingUp className="h-6 w-6 text-emerald-700" />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">Total Income</p>
      <MaskedAmount cents={summary?.totalIncomeReceivedCents ?? 0} visible={visible} mounted={mounted}
                    className="text-[28px] font-semibold leading-none tabular-nums" />
      <p className="text-xs text-muted-foreground">Received this period</p>
    </div>
  </CardContent>
</Card>
```

Net Income conditional color (UI-SPEC):

```typescript
// Net Income amount — destructive when negative
<MaskedAmount
  cents={netIncomeCents}
  visible={visible}
  mounted={mounted}
  className={cn(
    'text-[28px] font-semibold leading-none tabular-nums',
    netIncomeCents < 0 ? 'text-destructive' : 'text-foreground'
  )}
/>
```

**PF accounts read-only section** — reuse `PfOverview` from pf-overview.tsx. Pass `visible` and `mounted`. Remove the dropdown menu by passing a read-only flag or creating a minimal dashboard variant without the `DropdownMenu`. The dashboard PF section is navigation-only (link to `/profit-first`).

**Feed row pattern** (RESEARCH FeedRow sketch + income-list.tsx lines 33–84):

```typescript
// Feed list container — same pattern as income-list.tsx line 33
<div className="divide-y rounded-lg border">
  {feedItems.map((tx) => (
    <Link
      key={`${tx.kind}-${tx.id}`}
      href={tx.href}
      className="flex items-center gap-3 py-3 px-4 hover:bg-muted/40 rounded-lg transition-colors"
    >
      <Badge variant="secondary" className="shrink-0 w-20 justify-center text-xs capitalize">
        {tx.kind === 'income' ? 'Income' : tx.kind === 'expense' ? 'Expense' :
         tx.kind === 'wallet_deposit' ? 'Deposit' : 'Withdrawal'}
      </Badge>
      <span className="flex-1 text-sm truncate">{tx.label}</span>
      {tx.description && (
        <span className="text-xs text-muted-foreground truncate max-w-[8rem]">{tx.description}</span>
      )}
      <MaskedAmount
        cents={tx.amountCents}
        visible={visible}
        mounted={mounted}
        className={cn(
          'tabular-nums text-sm font-semibold',
          (tx.kind === 'income' || tx.kind === 'wallet_deposit') ? 'text-emerald-600' : 'text-rose-600'
        )}
      />
      <span className="text-xs text-muted-foreground w-20 text-right">{formatDate(tx.date)}</span>
    </Link>
  ))}
</div>
```

**Empty feed state** (income-list.tsx lines 21–30 — empty state container pattern):

```typescript
// When feedItems.length === 0
<div className="rounded-lg border border-dashed py-12 text-center flex flex-col items-center gap-4">
  <p className="text-sm font-semibold text-foreground">No transactions yet</p>
  <p className="text-sm text-muted-foreground">
    Start by recording your first income, expense, or wallet transaction.
  </p>
  <div className="flex gap-2 flex-wrap justify-center">
    <Button asChild variant="outline" size="sm"><Link href="/income/new">Record income</Link></Button>
    <Button asChild variant="outline" size="sm"><Link href="/expenses/new">Record expense</Link></Button>
    <Button asChild variant="outline" size="sm"><Link href="/wallets/new">Create wallet</Link></Button>
  </div>
</div>
```

**Error handling pattern** (pf-content.tsx shows toast on failure — same approach):

```typescript
// On initial load failure (summary is null):
// page.tsx renders DashboardContent with summary=null → zeroed cards
// On load-more failure: toast.error('Could not load more transactions. Please try again.')
```

---

### `apps/web/src/app/(dashboard)/dashboard/_components/DashboardFilters.tsx` (client component, event-driven)

**Analog:** `apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx` (lines 1–201) — copy the date-preset section only; omit the category multi-select Sheet.

**Full DATE_PRESETS block to copy** (lines 35–68 of analog):

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { parseAsString, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';

const APP_TIMEZONE = 'Asia/Manila';

function nowManila(): TZDate {
  return new TZDate(new Date(), APP_TIMEZONE);
}

function fmt(date: Date | TZDate): string {
  return format(date, 'yyyy-MM-dd');
}

export const DATE_PRESETS = [
  {
    label: 'This Month',
    getRange: () => ({
      from: fmt(startOfMonth(nowManila())),
      to: fmt(endOfMonth(nowManila())),
    }),
  },
  {
    label: 'Last Month',
    getRange: () => ({
      from: fmt(startOfMonth(subMonths(nowManila(), 1))),
      to: fmt(endOfMonth(subMonths(nowManila(), 1))),
    }),
  },
  {
    label: 'Last 3 Months',
    getRange: () => ({
      from: fmt(startOfMonth(subMonths(nowManila(), 2))),
      to: fmt(endOfMonth(nowManila())),
    }),
  },
  {
    label: 'This Year',
    getRange: () => ({
      from: fmt(startOfYear(nowManila())),
      to: fmt(endOfYear(nowManila())),
    }),
  },
  { label: 'All Time', getRange: () => ({ from: undefined, to: undefined }) },
] as const;
```

**Export `getDefaultDashboardRange` for use in page.tsx** (derived from DATE_PRESETS[0]):

```typescript
export function getDefaultDashboardRange(): { from: string; to: string } {
  return DATE_PRESETS[0].getRange();
}
```

**Active preset detection + selection** (lines 108–129 of analog):

```typescript
const [from, setFrom] = useQueryState('from', parseAsString);
const [to, setTo] = useQueryState('to', parseAsString);

function isPresetActive(label: string): boolean {
  const preset = DATE_PRESETS.find((p) => p.label === label);
  if (!preset) return false;
  if (label === 'All Time') return !from && !to;
  const range = preset.getRange();
  return from === range.from && to === range.to;
}

async function selectPreset(label: string) {
  const preset = DATE_PRESETS.find((p) => p.label === label);
  if (!preset) return;
  const range = preset.getRange();
  await setFrom(range.from ?? null);
  await setTo(range.to ?? null);
  router.refresh();
}
```

**Render pattern** (lines 132–147 of analog — preset buttons only, no Sheet):

```typescript
return (
  <div className="flex items-center gap-2 flex-wrap">
    <div className="flex items-center gap-2 flex-wrap">
      {DATE_PRESETS.map((preset) => (
        <Button
          key={preset.label}
          variant={isPresetActive(preset.label) ? 'default' : 'outline'}
          size="sm"
          onClick={() => void selectPreset(preset.label)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  </div>
);
```

Note: gap is `gap-2` (8px) not `gap-1.5` (6px) — the UI-SPEC Spacing §Exceptions specifies `gap-2` for the new component, different from the grandfathered `gap-1.5` in pf-filters.tsx.

---

### `apps/web/src/app/api/dashboard/[...path]/route.ts` (BFF proxy, request-response)

**Analog:** `apps/web/src/app/api/wallets/[...path]/route.ts` (lines 1–63) — copy verbatim, change the path segment.

**Full proxy pattern** (lines 9–62 of analog):

```typescript
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  // Change 'wallets' to 'dashboard' here
  const url = `${apiBaseUrl}/api/dashboard/${path.join('/')}${request.nextUrl.search}`;
  const apiRes = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    redirect: 'manual',
  });

  return new NextResponse(apiRes.body, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
// POST/PUT/DELETE/PATCH follow the same pattern — copy from wallets/[...path]/route.ts
```

---

### `apps/web/src/types/dashboard.ts` (types, transform)

**Analog:** `apps/web/src/types/wallet.ts` (structure conventions — interface for extensible shapes, type for unions, no runtime code)

**Pattern** (wallet.ts lines 1–46):

```typescript
// types/ is runtime-free — only type definitions (CLAUDE.md: types/ for shared TypeScript types)
// Use interface for extensible shapes; type for unions/aliases

import type { AccountSummaryItem } from '@/app/(dashboard)/profit-first/_components/pf-overview';
// or inline the PfAccount type if importing from _components feels wrong

export type RecentTransactionKind = 'income' | 'expense' | 'wallet_deposit' | 'wallet_withdrawal';

export interface RecentTransaction {
  id: number;
  kind: RecentTransactionKind;
  date: string; // YYYY-MM-DD
  amountCents: number; // integer cents
  description: string | null;
  label: string; // category name or wallet name
  href: string; // '/income', '/expenses', '/wallets/{id}'
}

export interface FeedPagination {
  page: number;
  size: number;
  hasMore: boolean;
}

export interface DashboardSummary {
  // Stat cards — all integer cents
  totalIncomeReceivedCents: number;
  totalIncomePendingCents: number;
  totalExpensesCents: number;
  netIncomeCents: number;
  totalWalletBalanceCents: number; // period-scoped (D-02)
  // PF accounts section — reuses PfAccount / AccountSummaryItem shape
  profitFirstAccounts: PfAccount[];
  totalIncome: number; // passed through for PfOverview's "of X total" line
  // Feed
  recentTransactions: RecentTransaction[];
  feedPagination: FeedPagination;
}
```

Note: Re-export or import `PfAccount` from `pf-overview.tsx` rather than redefining it — single source of truth. If a cross-layer import is undesirable, inline the minimal fields needed.

---

### `apps/web/src/app/(dashboard)/layout.tsx` (layout, extend)

**Analog:** self (existing file, lines 1–23) — extend, do not replace.

**Current state** (lines 1–23 of existing file):

```typescript
import { DashboardNav } from '@/components/DashboardNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="pt-4 pb-16 px-4 md:px-8 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
```

Phase 5 may extend the layout with the sidebar structure described in UI-SPEC, OR keep the top-nav pattern if the UI-SPEC sidebar is not in scope for the plan. The existing `DashboardNav` already renders all 5 nav links with active-state detection — no nav gap to close. The main task is: ensure the Dashboard nav item's `href` points to `/dashboard` (not `/` as currently in DashboardNav.tsx line 17).

---

### `apps/web/src/components/DashboardNav.tsx` (component, update)

**Analog:** self (existing file, lines 1–69) — one-line update.

**Only change needed** (line 17 of existing file):

```typescript
// Current (incorrect for D-10):
{ label: 'Dashboard', href: '/', icon: LayoutDashboard },

// Replace with:
{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
```

The `isActive` logic in lines 43–47 already handles `pathname.startsWith(href + '/')` for non-root hrefs, so changing to `/dashboard` makes active detection work correctly.

---

### `apps/web/src/app/page.tsx` (root page, modify)

**Analog:** current `apps/web/src/app/page.tsx` (lines 1–214) — add session check + redirect before existing content.

**Pattern to add at top of `Home()` function** (following RESEARCH.md Pattern 5):

```typescript
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  // D-10: authenticated users land on /dashboard
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  if (accessToken) redirect('/dashboard');

  // ... rest of existing marketing page content unchanged
```

Note: Do NOT modify `middleware.ts` — `/` is correctly listed as a PUBLIC_ROUTE. The redirect is page-level only, matching RESEARCH Pattern 5.

---

### `apps/api/tests/dashboard.test.ts` (test, batch)

**Analog:** `apps/api/tests/expense-category.test.ts` (lines 1–60) — same test structure with `createTestDb`, `seedUser`, vitest `describe`/`it`/`expect`.

**Imports pattern** (lines 1–4 of analog):

```typescript
import { describe, it, expect } from 'vitest';
import {
  incomes,
  expenses,
  profitFirstAccounts,
  wallets,
  walletTransactions,
} from '@app/db/schema';
import { createTestDb, seedUser } from './helpers/db';
import { createDashboardService } from '../src/services/dashboard-service';
import { seedProfitFirstAccounts } from '../src/services/profit-first-service';
```

**Test seeding pattern** (lines 13–21 of analog):

```typescript
// createTestDb() returns { db, dbD1 } — use dbD1 for service, db for raw inserts
const { db, dbD1 } = createTestDb();
const user = seedUser(db, { email: 'dash-test@test.com', name: 'Dash User' })!;

// Seed PF accounts (required for getSummary to return profitFirstAccounts)
await seedProfitFirstAccounts(dbD1, user.id);
```

**Test structure pattern** (tests/expense-category.test.ts):

```typescript
describe('dashboard service — getSummary', () => {
  it('returns zeroed stat cards for user with no data', async () => { ... });
  it('returns totalIncomeReceivedCents from RECEIVED incomes filtered by date', async () => { ... });
  it('returns totalIncomePendingCents from PENDING incomes', async () => { ... });
  it('returns totalExpensesCents excluding soft-deleted expenses', async () => { ... });
  it('returns netIncomeCents as received minus expenses', async () => { ... });
  it('date filter restricts all aggregates to the given from/to range', async () => { ... });
  it('returns profitFirstAccounts with computedBalance from PF service', async () => { ... });
  it('returns totalWalletBalanceCents as period-scoped balance', async () => { ... });
  it('returns recentTransactions sorted date DESC', async () => { ... });
  it('excludes soft-deleted expenses and wallet_transactions from feed', async () => { ... });
});
```

---

## Shared Patterns

### Authentication on API Routes

**Source:** `apps/api/src/middleware/auth.ts` (lines 19–35)
**Apply to:** `apps/api/src/routes/dashboard.ts`

```typescript
// Mount at top of router — no unauthenticated access
dashboardRouter.use('/*', requireAuth);
// userId is available via c.get('userId') after requireAuth runs
const userId = c.get('userId');
```

### Error Handling (API)

**Source:** `apps/api/src/index.ts` (lines 35–46) + `apps/api/src/routes/profit-first.ts` (zValidator callback)
**Apply to:** `apps/api/src/routes/dashboard.ts`

```typescript
// Zod validation failure → 422 with structured body
zValidator('query', dashboardQuerySchema, (result, c) => {
  if (!result.success) {
    return c.json(
      { error: { code: 'validation_error', message: 'Invalid query parameters' } },
      422
    );
  }
});
// Unhandled errors propagate to app.onError() — no try/catch needed in route handler
// Service-level domain errors use: throw new HTTPException(statusCode, { message: 'code' })
```

### Server-Side Fetch (RSC pages)

**Source:** `apps/web/src/app/(dashboard)/profit-first/page.tsx` (lines 50–87)
**Apply to:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`

```typescript
// Direct to API base URL — NOT through BFF proxy (server-to-server is fine)
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';
// Read access_token cookie — async in Next.js 15
const cookieStore = await cookies();
const accessToken = cookieStore.get('access_token')?.value;
// cache: 'no-store' is mandatory for financial data (fresh on every visit)
cache: 'no-store';
```

### Client-Side Fetch via BFF Proxy

**Source:** `apps/web/src/app/api/wallets/[...path]/route.ts` (lines 9–37)
**Apply to:** `apps/web/src/app/api/dashboard/[...path]/route.ts` (load-more calls from `DashboardContent`)

```typescript
// Client components call /api/dashboard/* (same-origin, through BFF)
// BFF reads cookie and forwards Bearer token to Workers API
// Never call the Workers API base URL directly from client components
```

### Amount Masking

**Source:** `apps/web/src/components/amount-visibility.tsx` (lines 21–98)
**Apply to:** All `MaskedAmount` usages in `DashboardContent.tsx`

```typescript
// Always destructure all three from the hook
const { visible, toggle, mounted } = useAmountVisibility();
// Always pass both visible AND mounted to MaskedAmount
<MaskedAmount cents={value} visible={visible} mounted={mounted} className="..." />
// SSR always renders ●●●●●● — mounted guard prevents hydration mismatch
```

### Date Filter State in URL

**Source:** `apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx` (lines 101–129)
**Apply to:** `apps/web/src/app/(dashboard)/dashboard/_components/DashboardFilters.tsx`

```typescript
// nuqs hooks only in 'use client' components — never in RSC page.tsx (Pitfall 2)
const [from, setFrom] = useQueryState('from', parseAsString);
const [to, setTo] = useQueryState('to', parseAsString);
// After setting params: router.refresh() to trigger RSC re-render
await setFrom(range.from ?? null);
await setTo(range.to ?? null);
router.refresh();
```

### Feed Pagination State

**Source:** RESEARCH.md Pitfall 5 (A1) + this file's DashboardContent pattern above
**Apply to:** `apps/web/src/app/(dashboard)/dashboard/_components/DashboardContent.tsx`

```typescript
// Feed pagination MUST be client-side useState — NOT a nuqs URL param
// URL params trigger RSC re-renders that re-fetch ALL summary data
// Only date filter (from/to) lives in the URL
const [feedPage, setFeedPage] = useState(0);
const [hasMore, setHasMore] = useState(summary?.feedPagination.hasMore ?? false);
```

### Drizzle db Factory

**Source:** `apps/api/src/routes/profit-first.ts` (lines 31–34)
**Apply to:** `apps/api/src/routes/dashboard.ts`

```typescript
// Create db inside the handler — NEVER at module scope (Cloudflare Workers binding is request-scoped)
async (c) => {
  const db = createDb(c.env.DB);
  const svc = createDashboardService(db);
```

### Bindings and Variables Types

**Source:** `apps/api/src/types/index.ts` (lines 1–16)
**Apply to:** `apps/api/src/routes/dashboard.ts` + `apps/api/src/services/dashboard-service.ts`

```typescript
import type { Bindings, Variables } from '@/types';
// Router generic: new Hono<{ Bindings: Bindings; Variables: Variables }>()
// Service param: db: ReturnType<typeof createDb>
```

---

## No Analog Found

All files have close matches in the codebase. No new patterns without precedent.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/`, `apps/api/tests/`
**Files scanned:** 27
**Pattern extraction date:** 2026-06-06
