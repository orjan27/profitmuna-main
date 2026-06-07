---
phase: 04-wallets
plan: 02
subsystem: wallets-crud
tags: [wallet-service, balance-computation, tdd, create-form, list-page, server-actions]
dependency_graph:
  requires: [04-01, 03-01, 03-02, 02-01, 02-02]
  provides:
    [
      wallets-service,
      wallets-route-handlers,
      wallet-create-form,
      wallet-list-page,
      wallet-server-actions,
    ]
  affects:
    - apps/api/src/services/wallet-service.ts
    - apps/api/src/routes/wallets.ts
    - apps/api/src/schemas/wallets.ts
    - apps/api/tests/wallets.test.ts
    - apps/web/src/app/(dashboard)/wallets/page.tsx
    - apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx
    - apps/web/src/app/(dashboard)/wallets/new/page.tsx
    - apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx
    - apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts
tech_stack:
  added:
    - shadcn command component (cmdk-backed searchable multiselect)
  patterns:
    - 7-way Promise.all in list() for N+1 avoidance on D1 (RESEARCH Pattern 1)
    - db.batch atomic clear-and-replace for mapping operations (RESEARCH Pattern 2 + Pitfall 7 cast)
    - computeBalanceCents locked formula — never stored, never clamped (D-13)
    - TDD RED/GREEN cycle for Task 1a + 1b
    - Server Action mutation pattern (createWalletAction/deleteWalletAction) + revalidatePath
    - RSC page + client card component + dialog pattern (consistent with Phase 3)
key_files:
  created:
    - apps/api/src/services/wallet-service.ts
    - apps/web/src/app/(dashboard)/wallets/page.tsx
    - apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx
    - apps/web/src/app/(dashboard)/wallets/new/page.tsx
    - apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx
    - apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts
    - apps/web/src/components/ui/command.tsx
  modified:
    - apps/api/src/routes/wallets.ts
    - apps/api/src/schemas/wallets.ts
    - apps/api/tests/wallets.test.ts
decisions:
  - 'walletBaseSchema extracted from createWalletSchema so updateWalletSchema can use .partial() (Zod v4 disallows .partial() on refined schemas — Rule 1 auto-fix)'
  - 'GET /api/profit-first/summary used instead of non-existent /api/profit-first/accounts — fetches account list from summary.data.accounts'
  - 'Edit dropdown item navigates to /wallets/{id} (detail page) — no separate /edit route per D-05'
  - 'setIncomeCategoryMappings and setExpenseMappings implemented in Task 1a factory alongside create/update (plan allowed this ordering); WAL-02 tests were green on first run'
  - 'prefilledPfAccountId passed from page to NewWalletForm for D-04 one-click quick-create support'
  - 'popover and radio-group were already installed from Phase 3; only command component was net-new'
metrics:
  duration: '~12 minutes active'
  completed: '2026-06-06'
  tasks: 4
  files: 10
---

# Phase 04 Plan 02: Wallet CRUD Service, Create Form, List Page Summary

**One-liner:** Wallet service with 7-way Promise.all balance computation (pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals), mapping conflict enforcement, and the create/list UI delivering WAL-01/02/03.

---

## Tasks Completed

| Task       | Name                                           | Commit    | Files                                                                                                     |
| ---------- | ---------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| 1a (RED)   | WAL-01 + WAL-03 failing tests                  | `0ec2576` | `apps/api/tests/wallets.test.ts`                                                                          |
| 1a (GREEN) | Wallet service CRUD + balance + route handlers | `136a0d7` | `apps/api/src/services/wallet-service.ts`, `apps/api/src/routes/wallets.ts`                               |
| 1a fix     | Schema .partial() Zod v4 bug                   | `ca1c723` | `apps/api/src/schemas/wallets.ts`                                                                         |
| 1b (GREEN) | WAL-02 mapping conflict tests + fix            | `0119aac` | `apps/api/tests/wallets.test.ts`                                                                          |
| 2          | Create-wallet form                             | `cc8e29b` | `wallet-actions.ts`, `new/page.tsx`, `NewWalletForm.tsx`, `command.tsx`, `popover.tsx`, `radio-group.tsx` |
| 3          | Wallet list page + WalletCard                  | `5bd707e` | `wallets/page.tsx`, `WalletCard.tsx`                                                                      |

---

## Verification Results

- `cd apps/api && npx vitest run tests/wallets.test.ts` — 23 passed, 11 todo (WAL-04/05 for Plan 03)
- `cd apps/api && npm run test` — 162 passed, 11 todo (full suite green)
- `cd apps/api && npm run typecheck` — 0 errors
- `cd apps/web && npm run typecheck` — 0 errors
- `cd apps/web && npm run lint` — 0 errors

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 .partial() on refined schema**

- **Found during:** Full test suite run after Task 1a (auth.test.ts + index.test.ts failed)
- **Issue:** `createWalletSchema.partial()` throws "`.partial()` cannot be used on object schemas containing refinements" in Zod v4
- **Fix:** Extracted `walletBaseSchema` (no refine) as the base; `createWalletSchema = walletBaseSchema.refine(...)` and `updateWalletSchema = walletBaseSchema.partial()`
- **Files modified:** `apps/api/src/schemas/wallets.ts`
- **Commit:** `ca1c723`

**2. [Rule 1 - Bug] NewWalletForm import path and type errors**

- **Found during:** Task 2 typecheck
- **Issue:** Relative import `../../../_actions/wallet-actions` was wrong (3 levels from `new/_components/`); `color` state typed as const literal; Checkbox `readOnly` prop doesn't exist in shadcn
- **Fix:** Corrected import to `../../_actions/wallet-actions`; typed `color` as `string`; replaced `readOnly` with `onCheckedChange`
- **Files modified:** `apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx`
- **Commit:** included in `cc8e29b`

### TDD Gate Notes

Task 1b WAL-02 tests were added as it.todo first (RED), but the mapping helpers (`setIncomeCategoryMappings` / `setExpenseMappings`) were already implemented in Task 1a as the plan explicitly directed ("implement create to accept the ids and forward once 1b lands"). When the WAL-02 real tests replaced the todos they passed immediately (no classic RED→GREEN transition for 1b). The TDD protocol was followed for Task 1a (12 real assertions RED, then GREEN after service implementation).

---

## Known Stubs

- `apps/api/tests/wallets.test.ts` — 11 `it.todo` entries remain for WAL-04 (manual transaction guard) and WAL-05 (soft-delete/restore), converted in Plan 03.
- No UI stubs — all rendered data is wired to real API responses.

---

## Threat Surface Scan

All planned mitigations from the threat register applied:

| Threat ID | Mitigation                                                                                      | Status                            |
| --------- | ----------------------------------------------------------------------------------------------- | --------------------------------- |
| T-04-06   | `eq(wallets.userId, userId)` on all queries in wallet-service.ts                                | Applied — 13 occurrences          |
| T-04-07   | setIncomeCategoryMappings/setExpenseMappings validate category ownership (userId) before insert | Applied — 403 on foreign category |
| T-04-08   | Service 409 checks for PF link, income/expense category conflicts                               | Applied                           |
| T-04-09   | Pre-check rejects second autoDeductAllExpenses=true wallet with 409                             | Applied                           |
| T-04-10   | Zod createWalletSchema/updateWalletSchema whitelist at route entry                              | Applied                           |

No new threat surface beyond what was planned.

---

## Self-Check: PASSED

Files verified present:

- apps/api/src/services/wallet-service.ts — FOUND
- apps/api/src/routes/wallets.ts — FOUND
- apps/api/src/schemas/wallets.ts — FOUND
- apps/api/tests/wallets.test.ts — FOUND
- apps/web/src/app/(dashboard)/wallets/page.tsx — FOUND
- apps/web/src/app/(dashboard)/wallets/\_components/WalletCard.tsx — FOUND
- apps/web/src/app/(dashboard)/wallets/new/page.tsx — FOUND
- apps/web/src/app/(dashboard)/wallets/new/\_components/NewWalletForm.tsx — FOUND
- apps/web/src/app/(dashboard)/wallets/\_actions/wallet-actions.ts — FOUND

Commits verified:

- 0ec2576 — FOUND
- 136a0d7 — FOUND
- ca1c723 — FOUND
- 0119aac — FOUND
- cc8e29b — FOUND
- 5bd707e — FOUND
