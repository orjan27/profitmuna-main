---
phase: 04-wallets
plan: 04
subsystem: wallets
tags: [gap-closure, pagination, validation, form-error-handling]
dependency_graph:
  requires: [04-03]
  provides: [ordered-paginated-history, param-422-validation, redirect-aware-form]
  affects:
    [
      apps/api/src/services/wallet-service.ts,
      apps/api/src/routes/wallets.ts,
      apps/api/src/schemas/wallets.ts,
      apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx,
    ]
tech_stack:
  added: []
  patterns:
    [
      drizzle-orm inArray + orderBy(desc),
      COUNT(*) totals independent of window,
      Zod coerce param schemas,
      isRedirectError re-throw pattern,
    ]
key_files:
  created: []
  modified:
    - apps/api/src/services/wallet-service.ts
    - apps/api/src/routes/wallets.ts
    - apps/api/src/schemas/wallets.ts
    - apps/api/tests/wallets.test.ts
    - apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx
decisions:
  - Per-source COUNT(*) queries are independent of the fetchLimit window so totalPages is never understated by the per-page cap
  - inArray replaces per-category for-loops for both income and expense history sources — eliminates N+1 queries and duplicate rows in autoDeductAllExpenses path
  - walletIdParamSchema + txIdParamSchema exported from schemas/wallets.ts mirror walletTransactionQuerySchema style; coerce handles string-typed path params
  - isRedirectError from next/dist/client/components/redirect-error is the stable Next.js 15 guard for distinguishing redirect throws from real errors
metrics:
  duration: ~15 min
  completed_date: 2026-06-06
  tasks: 2
  files: 5
---

# Phase 04 Plan 04: Gap Closure — Ordered History, Param Validation, Form Error Toast Summary

**One-liner:** Deterministic DESC-ordered paginated wallet history with COUNT-based totals, Zod 422 param guards on all wallet routes, and redirect-aware error toast in NewWalletForm.

---

## What Was Built

### Task 1: Order + COUNT-back paginated history in getById (wallet-service.ts)

- Added `desc` and `inArray` to the drizzle-orm import.
- Income history: replaced per-category for-loop with a single `inArray(incomes.categoryId, incomeCatIds)` query ordered by `desc(incomes.incomeDate), desc(incomes.id)` before `.limit(fetchLimit)`.
- Expense history: replaced per-category for-loop with a single `inArray(expenses.categoryId, expenseCatIdsForHistory)` query ordered by `desc(expenses.expenseDate), desc(expenses.id)` before `.limit(fetchLimit)`. Handles both `autoDeductAllExpenses` (all user expense cats) and mapped-categories paths.
- Manual history: added `.orderBy(desc(walletTransactions.transactionDate), desc(walletTransactions.id))` before `.limit(fetchLimit)`.
- Replaced `total = merged.length` with three independent `COUNT(*)` queries (income RECEIVED in incomeCatIds, non-deleted expenses in expenseCatIdsForHistory, all manual including soft-deleted). Each skips when the id list is empty (contributes 0). `totalPages = Math.ceil(total / size) || 1`.

### Task 2: Regression tests + param 422 + form toast co-fixes

**Tests (apps/api/tests/wallets.test.ts):**

- Added `two-page income history` test: seeds 30 RECEIVED incomes with distinct ascending dates via direct `db.insert(...).run()` loop; asserts page 0 = 20 newest rows DESC with `transactionDate === '2026-01-30'` first; page 1 = remaining 10 with no ID overlap; `pagination.total === 30`, `totalPages === 2`.
- Added `autoDeductAllExpenses: single inArray query produces no duplicate rows` test: seeds 5 expenses across each of 2 categories; asserts all 10 returned exactly once, IDs unique, `pagination.total === 10`.

**Param validation (apps/api/src/routes/wallets.ts + schemas/wallets.ts):**

- Exported `walletIdParamSchema` (`{ walletId: z.coerce.number().int().positive() }`) and `txIdParamSchema` (`{ walletId, txId: z.coerce.number().int().positive() }`) from `schemas/wallets.ts`.
- Applied `zValidator('param', ..., (result, c) => 422)` to all 7 route handlers reading `:walletId` and/or `:txId` (GET/:walletId, PUT/:walletId, DELETE/:walletId, POST/:walletId/transactions, PUT/:walletId/transactions/:txId, DELETE/:walletId/transactions/:txId, PATCH restore).
- Replaced all `Number(c.req.param(...))` with `c.req.valid('param')` destructuring.

**NewWalletForm (apps/web/src/app/(dashboard)/wallets/new/\_components/NewWalletForm.tsx):**

- Imported `isRedirectError` from `next/dist/client/components/redirect-error`.
- Catch block now re-throws redirect errors so Next.js can navigate; on real errors calls `toast.error('Could not create wallet. Please try again.')`.
- Removed unconditional `toast.success('Wallet created.')` from the catch block — success UX is the redirect itself.

---

## Commits

| Task    | Commit  | Message                                                                                       |
| ------- | ------- | --------------------------------------------------------------------------------------------- |
| 1 RED   | 2d48483 | test(04-04): add failing regression tests for >1-page history and COUNT total                 |
| 1 GREEN | ab3b1fc | feat(04-04): order + COUNT-back paginated history in getById; single inArray queries          |
| 2       | 093197f | fix(04-04): 422 param validation on wallet routes + redirect-aware create-form error handling |

---

## Acceptance Criteria Verification

- `grep -n "orderBy(desc"` on `wallet-service.ts` returns >= 3 matches (income, expense, manual history queries): **PASS**
- `grep -c "for (const catId of"` in getById range returns 0 (replaced by inArray): **PASS**
- `grep -c "total = merged.length"` returns 0: **PASS**
- `grep -c "zValidator('param'"` in `routes/wallets.ts` returns 7: **PASS**
- `grep -c "Number(c.req.param"` in `routes/wallets.ts` returns 0: **PASS**
- `grep -n "isRedirectError"` in `NewWalletForm.tsx` matches line 5 (import) and line 158 (guard): **PASS**
- `grep -c "toast.success"` in `NewWalletForm.tsx` returns 0: **PASS**
- All 37 wallet tests pass: **PASS**
- `npm run typecheck` (api + web): clean: **PASS**
- `npm run lint`: clean: **PASS**

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Flags

No new security-relevant surface introduced. All route handlers retain ownership-scoped DB queries. COUNT(\*) queries are aggregate-only. isRedirectError guard does not expose internal error details to the client.

---

## Self-Check: PASSED

- `apps/api/src/services/wallet-service.ts` — modified (Task 1)
- `apps/api/src/routes/wallets.ts` — modified (Task 2)
- `apps/api/src/schemas/wallets.ts` — modified (Task 2)
- `apps/api/tests/wallets.test.ts` — modified (Task 1 RED)
- `apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx` — modified (Task 2)
- Commits 2d48483, ab3b1fc, 093197f all present in git log
