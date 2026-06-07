---
phase: 05-dashboard
plan: 04
subsystem: dashboard-backend
tags: [dashboard-service, aggregation, tdd, bff-proxy, period-scoped-balance]
dependency_graph:
  requires: [04-02, 03-02, 02-01, 02-02]
  provides:
    [dashboard-service, dashboard-summary-endpoint, dashboard-web-types, dashboard-bff-proxy]
  affects:
    - apps/api/src/services/dashboard-service.ts
    - apps/api/src/schemas/dashboard.ts
    - apps/api/src/routes/dashboard.ts
    - apps/api/src/index.ts
    - apps/api/tests/dashboard.test.ts
    - apps/web/src/types/dashboard.ts
    - apps/web/src/app/api/dashboard/[...path]/route.ts
tech_stack:
  added: []
  patterns:
    - Income CASE aggregate (received + pending in one query) filtered by incomeDate
    - Period-scoped wallet balance reimplementation (NOT walletService.list() — that is all-time)
    - Per-source fetchLimit = window + 1 so hasMore is decidable when one source dominates
    - PF summary reuse via createProfitFirstService(db).getSummary (no formula duplication)
    - TDD RED → GREEN → WIRE (11 tests written first, failing on missing module)
key_files:
  created:
    - apps/api/src/services/dashboard-service.ts
    - apps/api/src/schemas/dashboard.ts
    - apps/api/src/routes/dashboard.ts
    - apps/api/tests/dashboard.test.ts
    - apps/web/src/types/dashboard.ts
    - apps/web/src/app/api/dashboard/[...path]/route.ts
  modified:
    - apps/api/src/index.ts
requirements: [DASH-01]
status: complete
commits: [7780e87, 1b31054, 3efa8d9]
executed: 2026-06-07
executor: direct (user opted out of GSD executor for this phase)
---

# Summary: Dashboard Data Backend

`GET /api/dashboard/summary?from=&to=&feedPage=&feedSize=` behind `requireAuth`,
backed by `createDashboardService(db).getSummary(userId, dateRange?, feedPage, feedSize)`.

One `Promise.all` runs five sources:

1. Income CASE aggregate — `totalIncomeReceivedCents` + `totalIncomePendingCents`,
   filtered by `incomes.incomeDate` (consistent with the Phase 3 PF summary).
2. Expense SUM excluding soft-deleted, filtered by `expenseDate`.
3. PF accounts with `computedBalance` reused from `createProfitFirstService`.
4. Period-scoped total wallet balance — re-derives
   `pfAllocation + mappedIncome − mappedExpenses + deposits − withdrawals`
   per wallet with every input restricted to the date range (Pitfall 1: never
   delegates to the all-time `walletService.list()`).
5. Unified feed — income + expense + wallet tx merged, date DESC / id DESC,
   each row carrying `kind` and `href`; paginated with `hasMore`.

`dashboardQuerySchema` enforces the `YYYY-MM-DD` regex on from/to (T-05-02)
and bounds `feedPage`/`feedSize`. All queries gated by `eq(table.userId, userId)`
(T-05-03); wallet joins constrained to the user's own wallets (T-05-04).

## Deviations

- Mid-execution, a parallel session dropped `wallets.sourceType` (commit
  684b1ab); the service and tests were adapted to discriminate PF wallets via
  `profitFirstAccountId != null`.
- Per-source feed fetch uses `window + 1` rows (plan said `window`) so
  `hasMore` is correct when a single source has exactly `window` rows with
  more beyond.

## Verification

- `apps/api/tests/dashboard.test.ts` — 11 tests green (zeroed empty state,
  received/pending split, soft-delete exclusion, net income, date filtering,
  PF computedBalance, period-scoped wallet balance, unified feed ordering,
  id-DESC tie-break, pagination/hasMore, cross-user isolation).
- Full API suite 190/190; `tsc --noEmit` clean in api and web.
- Manual: unauthenticated `GET /api/dashboard/summary` → 401.
