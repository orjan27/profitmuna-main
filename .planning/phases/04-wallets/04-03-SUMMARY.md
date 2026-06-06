---
phase: 04-wallets
plan: 03
subsystem: wallets-transactions
tags:
  [
    tdd,
    transaction-service,
    getById,
    soft-delete,
    restore,
    detail-page,
    collapsible,
    pagination,
    nuqs,
    server-actions,
  ]
dependency_graph:
  requires: [04-01, 04-02, 03-01, 03-02, 02-01, 02-02]
  provides:
    [
      wallets-transaction-methods,
      wallets-getById-detail,
      wallets-transaction-routes,
      wallets-transaction-actions,
      wallets-detail-page,
      wallets-detail-component,
    ]
  affects:
    - apps/api/src/services/wallet-service.ts
    - apps/api/src/routes/wallets.ts
    - apps/api/tests/wallets.test.ts
    - apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts
    - apps/web/src/app/(dashboard)/wallets/[walletId]/page.tsx
    - apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx
tech_stack:
  added:
    - shadcn collapsible component (for balance breakdown disclosure D-02)
  patterns:
    - TDD RED/GREEN cycle (test commit then feat commit)
    - assertCanInsertTransaction double-count guard (RESEARCH Pattern 3)
    - getById merge-3-sources (RESEARCH Pattern 5) sorted DESC by date then id
    - Soft-delete (deletedAt ISO) + restore (deletedAt null) ownership-scoped
    - nuqs useQueryState('page') for URL-driven pagination (D-10)
    - D-09 inline soft-delete rendering (opacity-50 line-through + Restore button)
    - D-02 collapsible breakdown with zero-row hiding
key_files:
  created:
    - apps/web/src/app/(dashboard)/wallets/[walletId]/page.tsx
    - apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx
    - apps/web/src/components/ui/collapsible.tsx
  modified:
    - apps/api/src/services/wallet-service.ts
    - apps/api/src/routes/wallets.ts
    - apps/api/tests/wallets.test.ts
    - apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts
decisions:
  - 'assertCanInsertTransaction is a module-level function (not factory method) — it is pure (no DB) and can be called before the DB insert'
  - 'getById breakdown uses separate balance queries (excludes deletedAt) and separate history queries (includes deletedAt) — Pitfall 4 compliance'
  - 'History merge: [...incomeEntries, ...expenseEntries, ...manualEntries].sort(date DESC, id DESC).slice(page*size) — Pattern 5 verbatim'
  - 'fetchLimit = (page+1)*size caps each source to avoid unbounded reads (Pitfall 3 — accepted for v1 volumes)'
  - 'autoDeductAllExpenses wallets expand to all user expense categories for history fetch (mirrors balance computation)'
  - 'WalletDetail derives deposit/withdrawal blocking from breakdown cents values as a conservative proxy; server enforces the real guard'
  - 'TxDialog seeded amount from editTx.amount/100 (cents back to pesos for display), toCents on submit'
  - 'Test fix: WAL-05 merge-3-sources test seeds manual transaction via db.insert (not createTransaction) because income mapping correctly blocks DEPOSIT via assertCanInsertTransaction'
metrics:
  duration: '~12 minutes active'
  completed: '2026-06-06'
  tasks: 3
  files: 7
---

# Phase 04 Plan 03: Transaction Management and Wallet Detail Summary

**One-liner:** assertCanInsertTransaction double-count guard + getById merge-3-sources pagination + four transaction CRUD methods with soft-delete/restore + wallet detail page with collapsible breakdown, paginated history, and add/edit/delete/restore dialogs — completing WAL-04 and WAL-05.

---

## Tasks Completed

| Task        | Name                                                                        | Commit    | Files                                                                                                                                      |
| ----------- | --------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 (RED)     | WAL-04/05 failing tests — RED gate                                          | `8391193` | `apps/api/tests/wallets.test.ts`                                                                                                           |
| 1 (GREEN)   | assertCanInsertTransaction + transaction methods + getById + route handlers | `f986313` | `apps/api/src/services/wallet-service.ts`, `apps/api/src/routes/wallets.ts`                                                                |
| collapsible | Install shadcn collapsible for D-02                                         | `d1ae9fa` | `apps/web/src/components/ui/collapsible.tsx`                                                                                               |
| 2           | Transaction server actions (create/update/delete/restore)                   | `424968d` | `apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts`                                                                          |
| 3           | Wallet detail page + WalletDetail component                                 | `0975dce` | `apps/web/src/app/(dashboard)/wallets/[walletId]/page.tsx`, `apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx` |

---

## Verification Results

- `cd apps/api && npx vitest run tests/wallets.test.ts` — 35 passed, 0 todo (all WAL-01..05 real and green)
- `cd apps/api && npm run typecheck` — 0 errors
- `cd apps/web && npm run typecheck` — 0 errors
- `cd apps/web && npm run lint` — 0 errors
- Blocking error codes: `manual_deposit_blocked_pf_wallet` (1), `manual_deposit_blocked_income_mapped` (1), `manual_withdrawal_blocked_expense_mapped` (1) — all present in service
- Restore route: `'/:walletId/transactions/:txId/restore'` registered at line 93 of routes.ts — before generic `/:txId` handlers at lines 108+
- `deletedAt: null` present in restoreTransaction (service line 1091)
- `eq(walletTransactions.userId, userId)` scoping on all transaction queries — verified

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WAL-05 merge test seeded manual transaction via db.insert instead of createTransaction**

- **Found during:** Task 1 GREEN — test for "paginated history merges 3 sources" called `createTransaction` on a wallet with income mapping, which correctly threw `manual_deposit_blocked_income_mapped`
- **Issue:** The test design was internally inconsistent: a wallet with `incomeCategoryIds` mapped cannot accept manual DEPOSITs (that is the correct server behavior); the test needed to bypass the guard to seed history data
- **Fix:** Changed to `db.insert(schema.walletTransactions).values(...).run()` to seed the manual transaction directly — same pattern used in WAL-03 transactionCount test; added comment explaining why
- **Files modified:** `apps/api/tests/wallets.test.ts`
- **Commit:** included in `f986313` GREEN commit

### TDD Gate Compliance

- RED commit `8391193` — `test(04-03)`: 12 failing tests for WAL-04/05 (replaced 11 it.todo + added 1 new ownership test)
- GREEN commit `f986313` — `feat(04-03)`: implementation that made all 35 tests pass
- RED → GREEN gate sequence satisfied

---

## Known Stubs

None — all rendered data is wired to real API responses. The blocking detection in WalletDetail uses `breakdown.mappedIncomeCents > 0` and `breakdown.mappedExpensesCents > 0` as a conservative proxy. This means the buttons may be disabled even when a wallet that happens to have 0 income/expense amounts has mappings. The server enforces the real guard anyway; the UI disable is advisory. Future improvement: include `hasMappings` flags in WalletDetailResponse.

---

## Threat Surface Scan

All planned mitigations from the threat register applied:

| Threat ID | Mitigation                                                                                                                    | Status                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| T-04-11   | getById + all transaction methods scoped with `eq(wallets.userId, userId)` / `eq(walletTransactions.userId, userId)` from JWT | Applied — 5+ occurrences per method        |
| T-04-12   | `assertCanInsertTransaction` runs server-side before insert; cannot be bypassed by client                                     | Applied — module-level function in service |
| T-04-13   | Zod `z.number().positive()` in walletTransactionSchema; service rejects `toCents(amount) <= 0`                                | Applied                                    |
| T-04-14   | removeTransaction/restoreTransaction ownership-scoped by (txId, walletId, userId); 404 otherwise                              | Applied                                    |
| T-04-15   | fetchLimit `(page+1)*size` per source caps history read                                                                       | Accepted for v1                            |
| T-04-SC   | No new npm packages; shadcn `collapsible` from official registry                                                              | Applied                                    |

No new threat surface beyond what was planned.

---

## Self-Check: PASSED

Files created/verified present:

- apps/api/src/services/wallet-service.ts (modified) — FOUND
- apps/api/src/routes/wallets.ts (modified) — FOUND
- apps/api/tests/wallets.test.ts (modified) — FOUND
- apps/web/src/app/(dashboard)/wallets/\_actions/wallet-actions.ts (modified) — FOUND
- apps/web/src/app/(dashboard)/wallets/[walletId]/page.tsx — FOUND
- apps/web/src/app/(dashboard)/wallets/[walletId]/\_components/WalletDetail.tsx — FOUND
- apps/web/src/components/ui/collapsible.tsx — FOUND

Commits verified:

- 8391193 — FOUND (test RED)
- f986313 — FOUND (feat GREEN)
- d1ae9fa — FOUND (chore collapsible)
- 424968d — FOUND (feat transaction actions)
- 0975dce — FOUND (feat detail page)
