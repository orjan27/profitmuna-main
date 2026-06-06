# Phase 5: Dashboard - Research

**Researched:** 2026-06-06
**Domain:** Next.js SSR dashboard page + Hono aggregate API endpoint
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Five stat cards: Total Income (received), Pending Income, Total Expenses, Net Income, Total Wallet Balance. The first four replicate the reference cards (icons, colors, conditional red Net Income styling); Total Wallet Balance replaces the stripped rentals cards.
- **D-02:** The Total Wallet Balance card respects the date filter — the wallet balance formula is recomputed limited to the selected range. It is NOT the all-time balance shown on wallet pages; label/subtitle should make the period clear.
- **D-03:** Unified chronological feed — one list mixing all three types (income, expense, wallet deposit/withdrawal), each row badged by type with color-coded amounts.
- **D-04:** Feed paginates with a "Load more" button, matching Phase 2's list pattern (02-CONTEXT D-06). Initial page size aligns with whatever Phase 2 establishes.
- **D-05:** Clicking a feed row navigates to its section — income → `/income`, expense → `/expenses`, wallet transaction → that wallet's detail page. No inline editing on the dashboard.
- **D-06:** Soft-deleted records are excluded from the feed. Restore flows stay on the list/detail pages.
- **D-07:** One date filter governs everything on the page — stat cards, PF balances, wallet balance card, AND the recent transactions feed.
- **D-08:** Default range is This Month (Asia/Manila); filter state in URL search params via nuqs (Phase 3 D-11 pattern).
- **D-09:** Freshness = fresh dynamic SSR per visit — no caching, no polling, no focus-revalidation.
- **D-10:** Dashboard lives at `/dashboard`; authenticated `/` redirects to `/dashboard`; post-login redirect targets `/dashboard`.
- **D-11:** Phase 5 owns finalizing the nav shell: add Dashboard nav entry, make it the default landing, verify all section links. Settings nav entry waits for Phase 6.
- **D-12:** Brand-new users (zero data) see zeroed cards + getting-started hints: ₱0.00 stat cards, seeded PF accounts at ₱0, and the empty feed area shows CTAs like "Record your first income" linking to `/income/new`.

### Claude's Discretion

- Exact feed row layout (icon/badge/description/amount/date columns), type badge styling, and sort tie-breaking — follow shadcn/ui conventions and Phase 2/4 row styling
- Initial feed page size (align with Phase 2's list page size, which is 20)
- Dashboard API shape (single `GET /api/dashboard/summary` vs composing existing endpoints) — reference `dashboard-service.ts` `getSummary` with parallel queries is the model
- Whether PF section card links to `/profit-first` and exact progress-bar semantics
- Exact getting-started CTA copy and which CTAs appear (income/expense/wallet)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Settings nav entry and currency selection remain Phase 6.

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                             | Research Support                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DASH-01 | User lands on a dashboard showing income/expense totals, Profit First balances, and recent transactions | Covered by: dashboard service parallel-query pattern, Phase 3 PF summary reuse, Phase 4 wallet balance formula, unified feed merge logic, date-filter/nuqs pattern from Phase 3 |

</phase_requirements>

---

## Summary

Phase 5 adds a single `GET /api/dashboard/summary` endpoint backed by a new `dashboard-service.ts` that runs aggregate queries in parallel over the income, expenses, profit_first_accounts, wallets, wallet_transactions, and wallet mapping tables already built in Phases 2–4. The service reuses `createProfitFirstService(db).getSummary(userId, dateRange)` for PF balances (established Phase 3 pattern) and ports the `incomeQuery` + `expensesQuery` CASE-aggregate pattern from the reference `dashboard-service.ts`, scoped to `userId` instead of `businessId`. All wallet-balance queries are date-scoped so the Total Wallet Balance card reflects the selected period — this is the key behavioral difference from the wallet list page which shows all-time balances.

On the frontend, a new `/dashboard` page inside the existing `(dashboard)` route group replaces the marketing page as the authenticated landing destination. The page server-renders via `apiFetch` (the established `apps/web/src/server/api.ts` pattern), passes the summary to a client `DashboardContent` component that owns amount-masking state, and reuses the Phase 3 date-filter component (`pf-filters.tsx` date presets) with `nuqs` URL params. The net-new element is the unified recent transactions feed, which is paginated client-side with a "Load more" button and populated from a separate `recentTransactions` array in the summary response.

**Primary recommendation:** One new API endpoint `GET /api/dashboard/summary?from=&to=` backed by `createDashboardService(db)` that runs all aggregations in a single `Promise.all` — no composition of existing endpoints. Frontend: RSC page + `DashboardContent` client component, reusing existing Phase 3/4 primitives with no new dependencies.

---

## Architectural Responsibility Map

| Capability                                 | Primary Tier                 | Secondary Tier              | Rationale                                                                                                                  |
| ------------------------------------------ | ---------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Stat card aggregation (income/expense/net) | API / Backend                | —                           | Aggregate SQL queries must run server-side; cannot be computed client-side without multiple round-trips                    |
| Profit First balance computation           | API / Backend                | —                           | Already owned by profit-first-service.getSummary; dashboard reuses it via the factory pattern                              |
| Period-scoped wallet balance               | API / Backend                | —                           | The wallet balance formula requires joining wallets, wallet_transactions, incomes, expenses, mappings; must be DB-computed |
| Recent transactions feed                   | API / Backend                | Frontend (pagination state) | Server assembles the merged+sorted list; client owns "Load more" cursor                                                    |
| Date filter state                          | Browser / Client             | Frontend Server (URL)       | nuqs manages URL params; RSC reads searchParams for SSR; client updates URL on filter change                               |
| Amount masking (visibility toggle)         | Browser / Client             | —                           | localStorage persistence; must run client-side; hydration-safe guard already established                                   |
| Nav shell finalization                     | Frontend Server (SSR)        | —                           | Layout component in (dashboard)/layout.tsx; server-rendered nav links                                                      |
| Route redirect (/ → /dashboard)            | Frontend Server (middleware) | —                           | Next.js middleware.ts handles auth guard; page.tsx handles app-level redirect                                              |

---

## Standard Stack

### Core (all pre-pinned — no new installs required)

| Library                 | Version       | Purpose                         | Why Standard                                                                                            |
| ----------------------- | ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Hono                    | 4.12.9        | API route handler               | Project standard; dashboard route follows profitFirstRouter/walletsRouter pattern [VERIFIED: CLAUDE.md] |
| @hono/zod-validator     | 0.7.6         | Query param validation          | Established pattern for all API query schemas [VERIFIED: CLAUDE.md]                                     |
| Zod                     | 4.3.6         | Schema definition               | Project standard for all request/response validation [VERIFIED: CLAUDE.md]                              |
| Drizzle ORM             | 0.45.2        | Database queries                | Project standard; all aggregate queries use Drizzle's sql template tag [VERIFIED: CLAUDE.md]            |
| nuqs                    | 2.8.9         | URL search param state          | Phase 3 locked decision D-11; date filter state in URL [VERIFIED: apps/web/package.json]                |
| date-fns + @date-fns/tz | 4.1.0 / 1.4.1 | Date range presets in Manila tz | Phase 3 established; pf-filters.tsx uses these [VERIFIED: apps/web/package.json]                        |
| Next.js 15 (App Router) | 15.4.11       | SSR page with searchParams      | Project standard [VERIFIED: CLAUDE.md]                                                                  |

### Supporting (pre-pinned)

| Library                         | Version | Purpose                                 | When to Use                                                                            |
| ------------------------------- | ------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| lucide-react                    | 1.8.0   | Stat card icons                         | TrendingUp/TrendingDown/Clock/Wallet/Landmark for stat cards, matching reference icons |
| sonner                          | 2.0.7   | Error toasts                            | If dashboard data fetch fails gracefully                                               |
| shadcn/ui Card, Badge, Progress | pinned  | Stat cards, PF account cards, feed rows | All installed via prior phases                                                         |

### Alternatives Considered

| Instead of                          | Could Use                                 | Tradeoff                                                                                                          |
| ----------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Single `GET /api/dashboard/summary` | Compose 3+ existing endpoints client-side | Single endpoint avoids waterfall and keeps the dashboard-specific period-scoped wallet balance logic in one place |
| RSC direct API call with apiFetch   | Client-side fetch on mount                | SSR is correct here — D-09 mandates fresh data per visit; SSR also avoids flash of empty state                    |

**Installation:** No new packages. All dependencies are pre-pinned. [VERIFIED: CLAUDE.md constraint "no new deps without user approval"]

---

## Package Legitimacy Audit

> Phase 5 installs zero new external packages. All required libraries (Hono, Drizzle, Next.js, nuqs, date-fns, shadcn/ui, lucide-react, Zod) are already pinned in `package.json` files from prior phases.

| Package                  | Registry | Status | slopcheck | Disposition |
| ------------------------ | -------- | ------ | --------- | ----------- |
| (none — no new installs) | —        | —      | —         | N/A         |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

_slopcheck was not run because no new packages are being installed._

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (nuqs URL params)
        │ ?from=&to=
        ▼
Next.js RSC page.tsx  ──── searchParams ──→  applies Manila TZ default range
        │
        │ apiFetch (server-to-server, Bearer token)
        ▼
Workers API  GET /api/dashboard/summary?from=&to=
        │
        │ requireAuth (userId from JWT)
        ▼
createDashboardService(db).getSummary(userId, dateRange)
        │
        │ Promise.all([
        │   incomeQuery (received + pending CASE aggregates),
        │   expensesQuery (total, date-filtered, excludes deletedAt),
        │   pfService.getSummary(userId, dateRange),     ← reuse Phase 3
        │   walletBalanceQuery (period-scoped),          ← new, wallet tables
        │   recentTransactionsQuery (merge 3 sources),  ← new
        │ ])
        ▼
DashboardSummary JSON  →  Next.js DashboardContent (client component)
        │
        ├── StatCards (5 cards, amount-masking)
        ├── PF Accounts section (reuses PfOverview pattern)
        ├── Recent Transactions feed (Load more pagination)
        └── DateFilter / AmountToggle (nuqs + localStorage)
```

### Recommended Project Structure

```
apps/api/src/
├── routes/dashboard.ts          # NEW: thin route handler, self-guards with requireAuth
├── schemas/dashboard.ts         # NEW: Zod query schema (from, to)
├── services/dashboard-service.ts # NEW: createDashboardService factory

apps/web/src/
├── app/(dashboard)/
│   ├── layout.tsx               # EXTEND: add sidebar nav with Dashboard entry
│   └── dashboard/               # NEW directory
│       ├── page.tsx             # NEW: RSC — searchParams → apiFetch → DashboardContent
│       └── _components/
│           └── DashboardContent.tsx  # NEW: 'use client', stat cards + PF + feed
├── app/
│   └── page.tsx                 # REPLACE: redirect to /dashboard (middleware handles auth)
├── app/api/dashboard/
│   └── [...path]/route.ts       # NEW: BFF proxy for /api/dashboard/*
├── types/
│   └── dashboard.ts             # NEW: DashboardSummary, RecentTransaction types
```

### Pattern 1: Dashboard Service — Parallel Aggregation

**What:** Single `createDashboardService(db)` factory that runs all aggregations in one `Promise.all`. Reuses `createProfitFirstService(db).getSummary(userId, dateRange)` for PF accounts.

**When to use:** Anytime multiple independent DB queries must return before the response — Cloudflare Workers has 50ms CPU budget concern so serial queries are a problem.

```typescript
// Source: reference /mnt/c/dev/profitfirst/practice/src/server/services/dashboard-service.ts
// + apps/api/src/services/profit-first-service.ts (reuse pattern)

export function createDashboardService(db: ReturnType<typeof createDb>) {
  return {
    async getSummary(userId: number, dateRange?: { from?: string; to?: string }) {
      const from = dateRange?.from;
      const to = dateRange?.to;

      const fromCondition = from ? sql`${incomes.incomeDate} >= ${from}` : undefined;
      const toCondition = to ? sql`${incomes.incomeDate} <= ${to}` : undefined;

      const [incomeRows, expensesRows, pfSummary, walletBalanceRows, recentRows] =
        await Promise.all([
          // Combined received + pending via CASE aggregate — one query instead of two
          db
            .select({
              received: sql<number>`COALESCE(SUM(CASE WHEN ${incomes.moneyStatus} = 'RECEIVED' THEN ${incomes.amount} ELSE 0 END), 0)`,
              pending: sql<number>`COALESCE(SUM(CASE WHEN ${incomes.moneyStatus} = 'PENDING' THEN ${incomes.amount} ELSE 0 END), 0)`,
            })
            .from(incomes)
            .where(and(eq(incomes.userId, userId), fromCondition, toCondition)),

          // Expenses — exclude soft-deleted
          db
            .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
            .from(expenses)
            .where(
              and(
                eq(expenses.userId, userId),
                isNull(expenses.deletedAt),
                fromCondition,
                toCondition
              )
            ),

          // Reuse the full PF summary (includes per-account computed balances + categories list)
          createProfitFirstService(db).getSummary(userId, dateRange),

          // Period-scoped wallet balance (see Pattern 2)
          getWalletBalanceForPeriod(db, userId, from, to),

          // Recent transactions feed (see Pattern 3)
          getRecentTransactions(db, userId, from, to, page, size),
        ]);
      // ... compose DashboardSummary
    },
  };
}
```

**Important:** The `incomes` date filter uses `incomeDate` (not `receivedDate`) for the income aggregate, matching the reference — this is consistent with Phase 3's `getSummary` date filter. The PF `getSummary` call already uses `dateRange` internally via its own date conditions.

### Pattern 2: Period-Scoped Wallet Balance

**What:** The Total Wallet Balance card aggregates the wallet balance formula over only the selected date range. This differs from the wallet list page which uses all-time figures.

**Formula (locked from Phase 4):** `pfAllocation + mappedIncome − mappedExpenses + deposits − withdrawals`

```typescript
// Source: [ASSUMED based on Phase 4 wallet-service.ts balance formula]
// Period-scoped means: income filtered by incomeDate range, expenses by expenseDate,
// walletTransactions by transactionDate.

async function getWalletBalanceForPeriod(
  db: ReturnType<typeof createDb>,
  userId: number,
  from?: string,
  to?: string
): Promise<number> {
  // 1. Period-scoped PF allocation: sum across all wallets
  //    totalReceivedIncome (date-filtered) * targetPercentage / 10000 per wallet
  // 2. Period-scoped mappedIncome: received incomes in date range by income category mapping
  // 3. Period-scoped mappedExpenses: non-deleted expenses in date range by expense category mapping
  // 4. Period-scoped deposits: walletTransactions DEPOSIT where deletedAt IS NULL, filtered by transactionDate
  // 5. Period-scoped withdrawals: walletTransactions WITHDRAWAL where deletedAt IS NULL, filtered by transactionDate
  // Sum all wallets' period balances for the one number shown on the card.
}
```

**Key behavioral note (D-02):** The label must read "Total Wallet Balance (This Month)" or similar to distinguish it from the wallet page's all-time balance. The implementation runs date-scoped versions of the wallet balance aggregates — the same approach the Phase 4 `list()` service uses for the balance, but with an added date filter on each source query.

### Pattern 3: Recent Transactions Feed — Merge 3 Sources

**What:** The unified chronological feed merges income records, expense records, and wallet_transactions (manual DEPOSIT/WITHDRAWAL), sorted by date DESC then id DESC, paginated with a "Load more" cursor.

**Source:** Adapts the Phase 4 wallet `getById` merge pattern (Pattern 5 in 04-RESEARCH.md) to cross-wallet scope.

```typescript
// Source: [ASSUMED] adapted from Phase 4 wallet-service.ts getById merge-3-sources pattern
// The dashboard feed is cross-wallet (all user's wallets) and does NOT include auto-sourced
// INCOME_AUTO/EXPENSE_AUTO entries — only manual wallet transactions + raw incomes + raw expenses.

// Each source fetched with fetchLimit = (page+1)*size to bound memory
// Then merged, sorted, and sliced.

type FeedItem =
  | {
      kind: 'income';
      id: number;
      date: string;
      amount: number;
      description: string | null;
      categoryName: string;
    }
  | {
      kind: 'expense';
      id: number;
      date: string;
      amount: number;
      description: string | null;
      categoryName: string;
    }
  | {
      kind: 'wallet_tx';
      id: number;
      date: string;
      amount: number;
      description: string | null;
      walletId: number;
      walletName: string;
      txType: 'DEPOSIT' | 'WITHDRAWAL';
    };
```

**Soft-delete rule (D-06):** Income records are unfiltered for deletion (income has no soft-delete in Phase 2 scope — `INC-04` deletes are hard deletes); expenses filter `isNull(expenses.deletedAt)`; wallet_transactions filter `isNull(walletTransactions.deletedAt)`.

**Pagination:** For the feed, `page` is a cursor-style offset count (matching Phase 2's pagination default of 20 items). The dashboard summary endpoint takes `?feedPage=0&feedSize=20` OR the feed pagination can be a separate endpoint `GET /api/dashboard/feed?page=0&size=20` — see Open Questions.

### Pattern 4: Nav Shell Extension

**What:** The `(dashboard)/layout.tsx` already exists as a minimal auth shell (confirmed in codebase). Phase 5 extends it with a sidebar/topbar containing navigation links.

```typescript
// Source: apps/web/src/app/(dashboard)/layout.tsx (current — minimal shell)
// EXTEND, do not replace.
// Add nav entries:
//   Dashboard → /dashboard
//   Income → /income
//   Expenses → /expenses
//   Profit First → /profit-first
//   Wallets → /wallets
// Settings entry deferred to Phase 6.
```

### Pattern 5: Root Page Redirect

**What:** The current `apps/web/src/app/page.tsx` is the marketing landing page. Per D-10, authenticated `/` should redirect to `/dashboard`. The middleware already redirects unauthenticated users from any non-public route to `/login`.

**Approach:** Replace `apps/web/src/app/page.tsx` with a simple server-side redirect when authenticated, or update the middleware's PUBLIC_ROUTES to not treat `/` as public — but this would break the marketing page for unauthenticated users. The correct approach is to add `/` → `/dashboard` redirect only when a session is present.

```typescript
// Source: [ASSUMED] standard Next.js redirect pattern
// apps/web/src/app/page.tsx — check session, redirect if authenticated
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect('/dashboard');
  // else render marketing page (current content)
}
```

**Note:** The middleware's PUBLIC_ROUTES currently includes `/` — that setting is correct and must NOT change. The redirect is handled at the page level, not middleware level.

### Anti-Patterns to Avoid

- **Storing dashboard aggregates:** All balances and totals must remain derived at read time — never insert a `dashboard_cache` table or store pre-computed values. [VERIFIED: CLAUDE.md "Allocation and wallet balances are derived, not stored"]
- **Recomputing PF balances from scratch:** Call `createProfitFirstService(db).getSummary(userId, dateRange)` — do NOT duplicate the balance formula in the dashboard service. The PF service is the single source of truth for PF account balances.
- **Using `(db as any).select(...)` pattern from the reference:** The reference uses `(db as any)` due to a different Drizzle setup. The Profitmuna codebase uses typed Drizzle queries consistently — do not adopt the `as any` pattern.
- **Calling `/api/wallets` from the dashboard endpoint:** The dashboard service is a new factory that runs its own optimized aggregate queries. It does NOT call `createWalletService(db).list()` (that returns per-wallet detail, not a total balance).
- **nuqs hooks in the RSC page:** page.tsx reads `searchParams` directly (server-side); nuqs `useQueryState` is only in client components (Pitfall 5 from Phase 3). The `DashboardContent` client component or a child `DashboardFilters` component owns nuqs.

---

## Don't Hand-Roll

| Problem                           | Don't Build                                               | Use Instead                                                                                   | Why                                                                      |
| --------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Amount visibility toggle          | Custom visibility state                                   | `useAmountVisibility` + `MaskedAmount` + `AmountToggle` from `@/components/amount-visibility` | Already built in Phase 3 with hydration-safe localStorage persistence    |
| Date range presets                | Custom preset buttons                                     | Extract the `DATE_PRESETS` array + preset logic from `pf-filters.tsx`                         | Identical presets required; Manila timezone handling is correct there    |
| Currency formatting               | Custom formatter                                          | `formatCurrency(cents)` from `@/lib/format-currency`                                          | ₱ prefix, `en-PH` locale, Phase 6 currency swap point already documented |
| URL search param state            | Manual URLSearchParams manipulation                       | `nuqs` `useQueryState` with `parseAsString`                                                   | Phase 3 locked pattern; SSR-safe; refresh-preserving                     |
| PF account balance computation    | Recomputing `Math.round(totalIncome * targetPct / 10000)` | `createProfitFirstService(db).getSummary(userId, dateRange)`                                  | Authoritative formula; reuse avoids divergence                           |
| Authentication guard on API route | Custom auth middleware                                    | `requireAuth` from `@/middleware/auth`                                                        | Established pattern; iss/aud/exp validated                               |
| Feed pagination accumulation      | Custom cursor/offset logic                                | Adapt Phase 4 merge pattern with `fetchLimit = (page+1)*size`                                 | Prevents unbounded memory reads                                          |

**Key insight:** The dashboard is almost entirely composition — it assembles outputs of existing services (profit-first, income, expenses, wallets) into a summary shape. The only genuinely new code is the orchestration layer in `dashboard-service.ts` and the unified feed merge.

---

## Common Pitfalls

### Pitfall 1: Period-Scoped Wallet Balance vs All-Time Wallet Balance

**What goes wrong:** Implementer queries `createWalletService(db).list(userId)` and sums `balanceCents` — gets all-time balances, not period-scoped.

**Why it happens:** The wallet `list()` uses `getTotalReceivedIncomeCents(userId)` without date filtering. D-02 explicitly requires the dashboard wallet card to be period-scoped.

**How to avoid:** The dashboard service must implement its own wallet balance query with date conditions on `incomes.incomeDate`, `expenses.expenseDate`, and `walletTransactions.transactionDate`. Do NOT delegate to `createWalletService(db).list()` for this number.

**Warning signs:** The wallet list page shows the same balance as the dashboard "Total Wallet Balance" card even after changing the date filter — that indicates the dashboard is using all-time data.

### Pitfall 2: nuqs Hooks in RSC Page

**What goes wrong:** `useQueryState('from', parseAsString)` called in `page.tsx` — crashes with "useState can only be called in client components."

**Why it happens:** nuqs hooks are React hooks; RSC pages cannot use them.

**How to avoid:** `page.tsx` reads `searchParams` prop directly (the Next.js 15 way: `await searchParams`). `DashboardContent.tsx` or `DashboardFilters.tsx` is `'use client'` and uses `useQueryState`. This exact pattern is established in Phase 3's `pf-filters.tsx` + `page.tsx`. [VERIFIED: apps/web/src/app/(dashboard)/profit-first/page.tsx line 43-47]

**Warning signs:** TypeScript error "cannot call hooks from server components" or missing `'use client'` directive.

### Pitfall 3: Hydration Mismatch on Amount Masking

**What goes wrong:** `MaskedAmount` renders the formatted amount on server, blank/masked on client — React hydration error.

**Why it happens:** `localStorage` is unavailable during SSR; `visible` defaults to false. If the component uses `visible` directly without the `mounted` guard, it renders differently server vs client.

**How to avoid:** Use `useAmountVisibility()` hook from `@/components/amount-visibility`, which returns `{ visible, toggle, mounted }`. Pass BOTH `visible` and `mounted` to `MaskedAmount`. The `shouldShow = mounted && visible` pattern ensures SSR always renders masked. [VERIFIED: apps/web/src/components/amount-visibility.tsx lines 21-41, 89-98]

### Pitfall 4: Date Filter Applied Inconsistently Across Stat Cards

**What goes wrong:** Income/expense stat cards filter by `incomeDate`/`expenseDate`, but the PF summary uses a different date field or no date filter at all.

**Why it happens:** The dashboard passes `dateRange` to `createProfitFirstService(db).getSummary(userId, dateRange)`, but if `dateRange` is missing or incorrectly constructed from `searchParams`, PF balances reflect all-time data while the stat cards reflect the filtered period.

**How to avoid:** Construct a single `dateRange` object from `searchParams` in `page.tsx` (or the route handler for the API) and pass it consistently to every sub-query in the `Promise.all`. Validate: changing the date filter should change ALL five cards AND the PF accounts section simultaneously.

### Pitfall 5: Feed "Load More" Triggering Full-Page Re-render

**What goes wrong:** Clicking "Load more" updates a nuqs URL param (`feedPage`) which causes the RSC page to re-render and re-fetch ALL summary data, not just the feed.

**Why it happens:** nuqs param changes trigger RSC re-renders.

**How to avoid:** The feed "Load more" should be client-side state (`useState`) in `DashboardContent`, not a URL param. The feed can either be part of the initial summary response (first page) with a separate client-side `fetch('/api/dashboard/feed?page=N')` for subsequent pages, OR the entire feed is a separate endpoint the client calls. Either way, the feed pagination does NOT live in the URL. The date filter (from/to) DOES live in the URL.

### Pitfall 6: Incorrect Income Date Field for Date Filtering

**What goes wrong:** Dashboard filters income by `receivedDate` instead of `incomeDate`, producing different numbers than Phase 3's PF summary (which uses `incomeDate`).

**Why it happens:** The incomes table has both `incomeDate` (when income was recorded) and `receivedDate` (when PENDING → RECEIVED). The reference dashboard service and Phase 3 both filter by `incomeDate`.

**How to avoid:** Filter all income queries by `incomes.incomeDate`. This is consistent with the reference `getSummary` and Phase 3. [VERIFIED: apps/api/src/services/profit-first-service.ts lines 155-158 — date conditions use `incomes.incomeDate`]

### Pitfall 7: Dashboard Route Missing from BFF Proxy

**What goes wrong:** `DashboardContent` "Load more" feed fetch hits `/api/dashboard/feed` but there's no BFF proxy at `apps/web/src/app/api/dashboard/[...path]/route.ts` — returns 404 from Next.js.

**Why it happens:** Server components use `apiFetch` (which calls the Workers API directly), but client-side `fetch` calls must go through the BFF proxy (same-origin, no CORS required).

**How to avoid:** Create `apps/web/src/app/api/dashboard/[...path]/route.ts` matching the pattern of `apps/web/src/app/api/wallets/[...path]/route.ts`. Required for any client-side fetch to `/api/dashboard/*`.

---

## Code Examples

### Dashboard Zod Query Schema

```typescript
// Source: [ASSUMED] adapted from apps/api/src/schemas/profit-first.ts summaryQuerySchema pattern
// apps/api/src/schemas/dashboard.ts
import { z } from 'zod';

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

### DashboardSummary Type Shape

```typescript
// Source: [ASSUMED] adapted from reference /mnt/c/dev/profitfirst/practice/src/types/dashboard.ts
// Strip rentals fields; add wallet balance + recent transactions.
// apps/web/src/types/dashboard.ts

import type { AccountSummaryItem } from '@/types/profit-first'; // or inline

export interface DashboardSummary {
  // Stat cards — all in integer cents
  totalIncomeReceivedCents: number;
  totalIncomePendingCents: number;
  totalExpensesCents: number;
  netIncomeCents: number;
  totalWalletBalanceCents: number; // period-scoped (D-02)

  // PF accounts section — reuses Phase 3 AccountSummaryItem shape
  profitFirstAccounts: AccountSummaryItem[];

  // Recent transactions feed
  recentTransactions: RecentTransaction[];
  feedPagination: { page: number; size: number; hasMore: boolean };
}

export type RecentTransactionKind = 'income' | 'expense' | 'wallet_deposit' | 'wallet_withdrawal';

export interface RecentTransaction {
  id: number;
  kind: RecentTransactionKind;
  date: string; // YYYY-MM-DD
  amountCents: number;
  description: string | null;
  label: string; // category name for income/expense, wallet name for wallet_tx
  // Navigation target (D-05)
  href: string; // '/income', '/expenses', '/wallets/{walletId}'
}
```

### Page.tsx SSR Pattern (adapted from profit-first/page.tsx)

```typescript
// Source: [VERIFIED] apps/web/src/app/(dashboard)/profit-first/page.tsx (established pattern)
// apps/web/src/app/(dashboard)/dashboard/page.tsx

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;  // Next.js 15: searchParams is a Promise

  // Apply default range server-side (D-08: This Month, Manila tz)
  const defaults = getDefaultDashboardRange(); // from pf-filters.tsx DATE_PRESETS[0]
  const from = params.from ?? defaults.from;
  const to   = params.to   ?? defaults.to;

  const summary = await apiFetch<{ data: DashboardSummary }>(
    `/api/dashboard/summary?from=${from}&to=${to}`
  ).catch(() => null);

  return <DashboardContent summary={summary?.data ?? null} from={from} to={to} />;
}
```

### Default Manila Date Range Helper

```typescript
// Source: [VERIFIED] apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx
// Reuse or extract this logic into apps/web/src/lib/date-utils.ts

import { startOfMonth, endOfMonth, format } from 'date-fns';
import { TZDate } from '@date-fns/tz';

const APP_TIMEZONE = 'Asia/Manila';

export function getDefaultDashboardRange(): { from: string; to: string } {
  const now = new TZDate(new Date(), APP_TIMEZONE);
  return {
    from: format(startOfMonth(now), 'yyyy-MM-dd'),
    to: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
}
```

### Feed Row Component Sketch

```typescript
// Source: [ASSUMED] follows Phase 4 WalletCard pattern + Phase 2 income list row styling
// apps/web/src/app/(dashboard)/dashboard/_components/FeedRow.tsx
// Color convention matching stat cards: income=emerald, expense=rose, deposit=sky, withdrawal=amber

type FeedRowProps = { tx: RecentTransaction; visible: boolean; mounted: boolean };

export function FeedRow({ tx, visible, mounted }: FeedRowProps) {
  const isIncome    = tx.kind === 'income';
  const isDeposit   = tx.kind === 'wallet_deposit';
  const isWithdraw  = tx.kind === 'wallet_withdrawal';
  const sign = (isIncome || isDeposit) ? '+' : '-';
  const amountClass = cn(
    'tabular-nums font-semibold',
    (isIncome || isDeposit) ? 'text-emerald-600' : 'text-rose-600'
  );
  return (
    <Link href={tx.href} className="flex items-center gap-3 py-3 px-4 hover:bg-muted/40 rounded-lg transition-colors">
      <Badge variant="secondary" className="shrink-0 w-24 justify-center text-xs">
        {tx.kind.replace('_', ' ')}
      </Badge>
      <span className="flex-1 text-sm truncate">{tx.label}</span>
      {tx.description && <span className="text-xs text-muted-foreground truncate max-w-32">{tx.description}</span>}
      <MaskedAmount cents={tx.amountCents} visible={visible} mounted={mounted}
                    className={amountClass} />
      <span className="text-xs text-muted-foreground w-20 text-right">{formatDate(tx.date)}</span>
    </Link>
  );
}
```

---

## State of the Art

| Old Approach                                                    | Current Approach                                                                     | When Changed          | Impact                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------- |
| Reference uses `businessId` scoping in all service methods      | Profitmuna uses `userId` — locked replacement                                        | Phase 1–4 established | Replace every `businessId` with `userId` when porting from reference             |
| Reference `dashboard-service.ts` uses `(db as any).select(...)` | Profitmuna uses typed Drizzle queries                                                | Phase 2 established   | Don't adopt `as any` pattern; typed queries work with D1                         |
| Reference `fromCents(cents)` converts cents to decimal          | Profitmuna uses `formatCurrency(cents)` for display, stores/transports integer cents | Phase 2 established   | Keep all API responses in cents; format only at UI layer                         |
| Reference accumulates rentals/bookings data                     | Profitmuna dashboard strips all rentals fields                                       | Profitmuna design     | `getBadgeCounts`/`getActionItems`/bookings/units/partner sections are NOT ported |

**Deprecated/outdated:**

- Reference `getBadgeCounts` and `getActionItems` methods: rentals-only — do not port.
- Reference bookings, units, partner commission stat cards: stripped — do not port.
- Reference `totalAdsSpent`/`totalPartnerCommissionsPaid`/`totalUnitsBooked`/`averageDailyBookings` fields: stripped — do not include in `DashboardSummary`.

---

## Assumptions Log

| #   | Claim                                                                                                                                                                                | Section                                     | Risk if Wrong                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A1  | Feed "Load more" pagination uses client-side state (not URL params) to avoid full-page re-renders                                                                                    | Architecture Patterns §Pattern 3, Pitfall 5 | Low — if URL params are used, re-renders only affect the feed section; main risk is UX jank     |
| A2  | The dashboard service implements its own period-scoped wallet balance query rather than delegating to `createWalletService(db).list()`                                               | Pattern 2                                   | Medium — if wrong, all-time balance is shown; needs explicit confirmation during implementation |
| A3  | `feedPage`/`feedSize` query params are added to the same `GET /api/dashboard/summary` endpoint (not a separate `/api/dashboard/feed` endpoint)                                       | Code Examples §Dashboard Zod Schema         | Low — either approach works; affects whether a BFF proxy is needed for client-side load-more    |
| A4  | The `incomes` table query uses `incomeDate` (not `receivedDate`) for date filtering in the dashboard, consistent with Phase 3                                                        | Common Pitfalls §Pitfall 6                  | Medium — using wrong date field produces unexpected totals                                      |
| A5  | Phase 4 Plan 03 (`getById` + transaction routes + WalletDetail page) executes before Phase 5 ships, so wallet detail routes exist at `/wallets/[walletId]` for feed navigation links | Architecture                                | Low — if Phase 03 is still pending, feed links to wallet detail pages will 404                  |

---

## Open Questions

1. **Feed pagination: same endpoint or separate endpoint?**
   - What we know: The summary endpoint returns a first page of feed items; the user wants "Load more"
   - What's unclear: Whether loading more items should call the same `GET /api/dashboard/summary` with `feedPage` param (re-fetching the entire summary) or a separate lightweight `GET /api/dashboard/feed?page=N` (only the incremental feed slice)
   - Recommendation: Use a separate `GET /api/dashboard/feed` endpoint for "Load more" to avoid re-fetching all aggregate data. Summary includes page 0 of the feed; subsequent pages use the feed endpoint. If this is too complex, a simpler design is to embed all feed items the planner deems reasonable (e.g., 20 rows max, no load more) — DASH-01 doesn't explicitly require pagination depth.

2. **Date filter placement: reuse PfFilters or create DashboardFilters?**
   - What we know: Phase 3's `pf-filters.tsx` has date presets + category filter; dashboard needs only date presets (no category filter)
   - What's unclear: Should the planner extract the date-preset logic into a shared `DatePresets` component or duplicate it in a new `DashboardFilters` component?
   - Recommendation: At Claude's discretion. A shared extraction is cleaner long-term but adds a refactor task. A new `DashboardFilters` component that copies the `DATE_PRESETS` array is simpler and avoids breaking Phase 3's component.

3. **Getting-started CTA: which pages already have a "new" route?**
   - What we know: D-12 references `/income/new` as a CTA target; Phase 4 created `/wallets/new`
   - What's unclear: Whether Phase 2 created `/income/new` and `/expenses/new` routes, or if those links will 404
   - Recommendation: Planner should verify which Phase 2 routes exist before writing CTAs. If `/income/new` doesn't exist, use `/income` as the fallback CTA target.

---

## Environment Availability

> No new external tools, databases, or services are introduced in this phase. All runtime dependencies are already available from prior phases.

| Dependency            | Required By                 | Available | Version        | Fallback |
| --------------------- | --------------------------- | --------- | -------------- | -------- |
| Cloudflare D1 (local) | Dashboard aggregate queries | ✓         | wrangler local | —        |
| Node.js               | Build/test                  | ✓         | v24.15.0       | —        |
| npm                   | Package scripts             | ✓         | 11.12.0        | —        |
| Workers API (local)   | E2E dev testing             | ✓         | wrangler dev   | —        |

---

## Validation Architecture

### Test Framework

| Property           | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| Framework          | Vitest 3.0.0                                            |
| Config file        | `apps/api/vitest.config.ts`                             |
| Quick run command  | `cd apps/api && npx vitest run tests/dashboard.test.ts` |
| Full suite command | `cd apps/api && npm run test`                           |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                                 | Test Type | Automated Command                        | File Exists? |
| ------- | -------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- | ------------ |
| DASH-01 | getSummary returns totalIncomeReceivedCents, totalIncomePendingCents, totalExpensesCents, netIncomeCents | unit      | `npx vitest run tests/dashboard.test.ts` | Wave 0       |
| DASH-01 | getSummary returns profitFirstAccounts with computedBalance                                              | unit      | `npx vitest run tests/dashboard.test.ts` | Wave 0       |
| DASH-01 | getSummary returns totalWalletBalanceCents as period-scoped balance                                      | unit      | `npx vitest run tests/dashboard.test.ts` | Wave 0       |
| DASH-01 | getSummary returns recentTransactions sorted date DESC, soft-deleted excluded                            | unit      | `npx vitest run tests/dashboard.test.ts` | Wave 0       |
| DASH-01 | Date filter restricts all aggregates to the given from/to range                                          | unit      | `npx vitest run tests/dashboard.test.ts` | Wave 0       |
| DASH-01 | Zeroed cards for user with no data                                                                       | unit      | `npx vitest run tests/dashboard.test.ts` | Wave 0       |

### Sampling Rate

- **Per task commit:** `cd apps/api && npx vitest run tests/dashboard.test.ts`
- **Per wave merge:** `cd apps/api && npm run test && cd ../web && npm run typecheck && npm run lint`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/tests/dashboard.test.ts` — covers all DASH-01 unit assertions above
- [ ] `apps/api/tests/helpers/db.ts` — may already have all wallet + income/expense DDL; verify it has `wallet_transactions` and `walletTransactions`-related tables for dashboard test seeding

_(Existing `wallets.test.ts` confirms the helper DDL already covers wallet tables; dashboard test can reuse the same createTestDb helper without modification.)_

---

## Security Domain

> `security_enforcement: true` in config.json.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| V2 Authentication     | yes     | `requireAuth` middleware on `dashboardRouter.use('/*', requireAuth)` — established pattern      |
| V3 Session Management | no      | JWT validation handled globally by requireAuth                                                  |
| V4 Access Control     | yes     | All queries scoped to `eq(table.userId, userId)` where userId comes from JWT — no IDOR possible |
| V5 Input Validation   | yes     | Zod `dashboardQuerySchema` validates `from`, `to`, `feedPage`, `feedSize` at route entry        |
| V6 Cryptography       | no      | No new cryptographic operations                                                                 |

### Known Threat Patterns for This Stack

| Pattern                                                            | STRIDE                 | Standard Mitigation                                                                                                                        |
| ------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| IDOR — querying another user's financial summary                   | Elevation of Privilege | All service queries gated by `eq(table.userId, c.get('userId'))` where userId is from the verified JWT, never from request body            |
| Date injection — malformed `from`/`to` params manipulating queries | Tampering              | Zod regex `/^\d{4}-\d{2}-\d{2}$/` validates date format before any DB query                                                                |
| Unauthorized feed navigation links                                 | Information Disclosure | Feed links (`/wallets/{walletId}`) point to user's own wallets — middleware guards those routes; dashboard summary is scoped to userId     |
| Cross-user data in wallet balance aggregation                      | Information Disclosure | `getWalletBalanceForPeriod` must apply `eq(wallets.userId, userId)` before all joins; walletTransactions queries must add userId condition |

---

## Sources

### Primary (HIGH confidence)

- `apps/api/src/services/profit-first-service.ts` — confirmed `getSummary` factory pattern, `getTotalReceivedIncome` with date filter, `computeBalance` formula
- `apps/api/src/services/wallet-service.ts` — confirmed `computeBalanceCents` formula, `Promise.all` aggregate pattern
- `apps/web/src/app/(dashboard)/profit-first/page.tsx` — confirmed RSC pattern, `await searchParams`, direct apiFetch server-to-server
- `apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx` — confirmed `DATE_PRESETS` array, Manila timezone, nuqs `useQueryState`
- `apps/web/src/components/amount-visibility.tsx` — confirmed `useAmountVisibility`, `MaskedAmount` API with `cents`, `visible`, `mounted` params
- `apps/web/src/server/api.ts` — confirmed `apiFetch<T>` signature, `ApiError` shape
- `packages/db/src/schema.ts` — confirmed all table/column names used in research
- `apps/api/src/index.ts` — confirmed router mount pattern, error handler shape
- `apps/web/src/app/(dashboard)/layout.tsx` — confirmed minimal existing layout with "Phase 5 will extend" comment
- `/mnt/c/dev/profitfirst/practice/src/server/services/dashboard-service.ts` — confirmed CASE-aggregate income query, parallel Promise.all, PF summary reuse
- `/mnt/c/dev/profitfirst/practice/src/types/dashboard.ts` — confirmed `DashboardSummary` fields to keep vs strip
- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/dashboard/_components/dashboard-content.tsx` — confirmed stat card labels, icons, Net Income conditional coloring

### Secondary (MEDIUM confidence)

- `.planning/phases/05-dashboard/05-CONTEXT.md` — decisions D-01..D-12 verified against this research
- `.planning/phases/04-wallets/04-01-PLAN.md`, `04-02-PLAN.md`, `04-03-PLAN.md` — wallet schema, service exports, types confirmed from plan artifacts and actual committed code

### Tertiary (LOW confidence — marked [ASSUMED] in text)

- Feed "Load more" as client-side state (not URL param): inferred from Pitfall 5 analysis, no explicit prior-phase precedent
- Period-scoped wallet balance implementation approach: inferred from D-02 + wallet service patterns; exact query structure will need to be determined during planning

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all deps confirmed in package.json; no new installs
- Architecture: HIGH — service factory, RSC, nuqs, apiFetch patterns all verified in codebase
- Dashboard service parallel query pattern: HIGH — reference + Phase 3/4 code read directly
- Period-scoped wallet balance: MEDIUM — formula confirmed, date-scoping approach is inferred
- Feed pagination design: LOW — two viable approaches; planner must choose

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable stack — packages are pinned)
