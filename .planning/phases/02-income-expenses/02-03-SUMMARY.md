---
phase: 02-income-expenses
plan: 03
subsystem: api, ui
tags: [hono, drizzle, next-js, zod, soft-delete, nuqs, server-actions, shadcn]

# Dependency graph
requires:
  - phase: 02-01
    provides: apiFetch, ApiError, getSession, formatCurrency, toCents, formatDate, PAYMENT_METHODS, paginationWithDateSchema, idParamSchema, requireAuth, expense-categories route, expenses table with deletedAt
provides:
  - Expense Zod schemas (createExpenseSchema, updateExpenseSchema, expenseQuerySchema) with 5-value paymentMethod enum
  - createExpenseService factory (list/create/getById/update/softDelete/restore) with userId scoping
  - Expense routes: GET / POST / GET /:id / PUT /:id / DELETE /:id / PATCH /:id/restore (soft delete)
  - 15 unit tests covering EXP-01..04, IDOR guard, and soft delete/restore lifecycle
  - /expenses RSC page with date-filter SSR
  - /expenses/new RSC page + createExpenseAction (toCents + apiFetch POST)
  - ExpenseForm (category, amount, date, optional payment method, description)
  - ExpenseList (active rows clickable → edit dialog; deleted rows with RotateCcw restore)
  - ExpensesOverview (nuqs date-range filter, accumulator load-more, active-only totals)
  - EditExpenseDialog (reuses ExpenseForm; confirm-step soft delete)
  - expense-actions.ts (updateExpenseAction, deleteExpenseAction, restoreExpenseAction)
affects: [03-profit-first-allocation, 04-wallets, future-reports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - soft-delete via deletedAt nullable timestamp; totals filtered with isNull(deletedAt)
    - accumulator-based load-more (append-on-demand, reset on filter change) — no numbered pagination
    - nuqs useQueryState for URL-synced date-range filter
    - reusable form component accepting action prop (create vs update)
    - server actions call revalidatePath('/expenses') then redirect or return {error}

key-files:
  created:
    - apps/api/src/schemas/expense.ts
    - apps/api/src/services/expense-service.ts
    - apps/api/src/routes/expenses.ts
    - apps/api/tests/expense.test.ts
    - apps/web/src/app/expenses/page.tsx
    - apps/web/src/app/expenses/new/page.tsx
    - apps/web/src/app/expenses/new/_actions/create-expense.ts
    - apps/web/src/app/expenses/_components/expense-form.tsx
    - apps/web/src/app/expenses/_components/expense-list.tsx
    - apps/web/src/app/expenses/_components/expenses-overview.tsx
    - apps/web/src/app/expenses/_components/edit-expense-dialog.tsx
    - apps/web/src/app/expenses/_components/expense-actions.ts
  modified: []

key-decisions:
  - 'Soft delete via deletedAt ISO string; restore clears to null; totals always use isNull(expenses.deletedAt)'
  - 'PATCH /:id/restore registered before /:id handlers to avoid route shadowing'
  - 'Deleted rows surfaced inline below active list with greyed styling + RotateCcw restore icon (no separate toggle needed given low expected count)'
  - 'Load-more resets accumulator on filter change (not a full router refresh) to avoid page flicker'
  - 'paymentMethod Zod z.enum restricted to exactly 5 values matching PAYMENT_METHODS constant (D-10)'

patterns-established:
  - 'Pattern: soft-delete with isNull guard on totals — replicate for any future deletable resource'
  - 'Pattern: accumulator load-more with useTransition reset on filter change'
  - 'Pattern: reusable form with action prop — same component for create (/new page) and update (dialog)'
  - 'Pattern: IDOR guard — every expense-service query includes eq(expenses.userId, userId); miss → HTTPException 404'

requirements-completed: [EXP-01, EXP-02, EXP-03, EXP-04]

# Metrics
duration: 45min
completed: 2026-06-06
---

# Phase 2 Plan 03: Expense Slice Summary

**Expense record + browse + edit + soft-delete/restore slice with Zod payment-method enum, userId-scoped Drizzle service, and nuqs date-filter load-more UI**

## Performance

- **Duration:** 45 min
- **Started:** 2026-06-06T11:45:00Z
- **Completed:** 2026-06-06T12:02:00Z
- **Tasks:** 3 (Task 1 committed in prior session; Tasks 2-3 completed here)
- **Files modified:** 12

## Accomplishments

- Full expense API slice: Zod schemas with 5-value paymentMethod enum, createExpenseService with soft-delete/restore, 6 route handlers (incl. PATCH /:id/restore before /:id), 15 passing tests
- IDOR guard on every query (userId scoping + 404 on miss); soft-deleted rows excluded from totals via isNull(deletedAt)
- Full expense UI: RSC pages, reusable ExpenseForm, ExpenseList with per-row edit/restore, ExpensesOverview with nuqs date-range filter and accumulator load-more

## Task Commits

1. **Task 1: Expense Zod schemas + service + routes (RED)** - `c50d9f1` (test)
2. **Task 1: Expense Zod schemas + service + routes (GREEN)** - `3ab3dd9` (feat)
3. **Task 2: Expense record + browse UI** - `c778879` (feat)
4. **Task 3: Edit + soft-delete/restore dialogs** - `eabb0e4` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/api/src/schemas/expense.ts` - createExpenseSchema, updateExpenseSchema, expenseQuerySchema; z.enum for 5 payment methods
- `apps/api/src/services/expense-service.ts` - createExpenseService: list/create/getById/update/delete(soft)/restore; userId-scoped
- `apps/api/src/routes/expenses.ts` - 6 handlers; PATCH /:id/restore registered before /:id
- `apps/api/tests/expense.test.ts` - 15 tests: EXP-01..04, IDOR, soft-delete exclusion, restore, invalid paymentMethod
- `apps/web/src/app/expenses/page.tsx` - RSC; getSession guard; date-filter SSR via searchParams; renders ExpensesOverview
- `apps/web/src/app/expenses/new/page.tsx` - RSC; fetches categories; renders ExpenseForm with createExpenseAction
- `apps/web/src/app/expenses/new/_actions/create-expense.ts` - toCents; apiFetch POST; revalidatePath + redirect
- `apps/web/src/app/expenses/_components/expense-form.tsx` - reusable form; PAYMENT_METHODS select with blank option
- `apps/web/src/app/expenses/_components/expense-list.tsx` - active rows clickable (edit dialog); deleted rows with RotateCcw restore
- `apps/web/src/app/expenses/_components/expenses-overview.tsx` - nuqs date-range filter; accumulator load-more; active-only totals header
- `apps/web/src/app/expenses/_components/edit-expense-dialog.tsx` - reuses ExpenseForm; confirm-step soft delete
- `apps/web/src/app/expenses/_components/expense-actions.ts` - updateExpenseAction, deleteExpenseAction, restoreExpenseAction; all revalidatePath('/expenses')

## Decisions Made

- Soft delete uses ISO string timestamp in deletedAt; restore sets null. Totals always filtered with isNull(expenses.deletedAt) per T-02-14.
- PATCH /:id/restore registered before GET/PUT/DELETE /:id to avoid route shadowing by Hono's parameter matching.
- Deleted rows shown inline below active list (greyed, strikethrough, RotateCcw button) without a toggle — simpler UX, low expected deleted count.
- Accumulator load-more resets to page 0 on filter change (via applyFilter) so the user always sees fresh results without a full navigation.

## Deviations from Plan

None - plan executed exactly as written. All STRIDE mitigations applied: IDOR guard (T-02-10), positive amount (T-02-11), paymentMethod enum (T-02-12), category ownership (T-02-13), isNull(deletedAt) totals (T-02-14), getSession guard (T-02-15).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Expense slice fully complete (EXP-01..04); all tests green; typecheck + lint pass
- /expenses and /expenses/new routes functional; edit, soft-delete, and restore wired end-to-end
- Phase 02 income + expense slices both complete; Phase 03 profit-first allocation can proceed

---

_Phase: 02-income-expenses_
_Completed: 2026-06-06_
