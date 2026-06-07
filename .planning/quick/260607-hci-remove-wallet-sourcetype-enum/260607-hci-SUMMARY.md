---
phase: 260607-hci
plan: 01
subsystem: wallets
tags: [schema, migration, refactor, profit-first, web, api]
requires:
  - wallets.profitFirstAccountId (nullable FK, unique index)
provides:
  - wallets schema with no source_type column
  - profitFirstAccountId nullability as the sole PF discriminator across API + web
affects:
  - packages/db schema + migrations
  - apps/api wallet service, schema, tests, dashboard service
  - apps/web wallet types, labels, UI (new-wallet form type picker removed)
tech-stack:
  added: []
  patterns:
    - 'Single source of truth: derive PF-ness from profitFirstAccountId != null instead of a parallel enum'
key-files:
  created:
    - packages/db/migrations/0004_far_mister_sinister.sql
  modified:
    - packages/db/src/schema.ts
    - apps/api/src/schemas/wallets.ts
    - apps/api/src/services/wallet-service.ts
    - apps/api/src/services/dashboard-service.ts
    - apps/api/tests/helpers/db.ts
    - apps/api/tests/wallets.test.ts
    - apps/api/tests/dashboard.test.ts
    - apps/web/src/types/wallet.ts
    - apps/web/src/lib/wallet-labels.ts
    - apps/web/src/app/(dashboard)/wallets/_components/WalletRow.tsx
    - apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx
    - apps/web/src/app/(dashboard)/wallets/[walletId]/_components/EditWalletDialog.tsx
    - apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx
decisions:
  - 'sourceType enum removed; profitFirstAccountId != null is the only PF discriminator'
  - 'New-wallet form uses an always-visible optional allocation selector with a STANDALONE sentinel (shadcn Select cannot hold an empty value)'
  - 'profitFirstAccountId remains immutable on update (no change to update path)'
metrics:
  duration: ~14 min active
  completed: 2026-06-07
---

# Phase 260607-hci Plan 01: Remove Wallet sourceType Enum Summary

Removed the redundant `sourceType` enum from the wallets feature end to end; `profitFirstAccountId` nullability is now the sole Profit-First discriminator across schema, API, and web.

## What Was Built

- **Schema + migration (Task 1):** Dropped the `sourceType` column from the `wallets` table. drizzle-kit generated `0004_far_mister_sinister.sql` as a single `ALTER TABLE wallets DROP COLUMN source_type;` — it leaves `profit_first_account_id`, the FK to `profit_first_accounts(id)`, and the `wallets_user_pf_account_unique` index untouched. Synced the in-memory test DDL in `tests/helpers/db.ts`. Migration generation only — not applied to remote D1 (decision 7).
- **API (Task 2):** Removed `sourceType` from `walletBaseSchema` and deleted the now-meaningless `.refine()` on `createWalletSchema` (now `= walletBaseSchema`). Re-keyed all six PF gates in `wallet-service.ts` (list/getById pfAllocation, create uniqueness, D-08 income-mapping guard `setIncomeCategoryMappings`, create insert) onto `profitFirstAccountId != null`. Updated tests to seed/assert on `profitFirstAccountId`. Full Vitest suite green (190 tests).
- **Web (Task 3):** Deleted `WalletSourceType` and the `sourceType` fields from `WalletListItem`/`CreateWalletInput`. Re-keyed `sourceLabel`/`withdrawalLabel`, `WalletRow`, `WalletDetail`, `EditWalletDialog`. Reworked `NewWalletForm`: removed the "Wallet Type" picker and `sourceType` state; the Allocation Account selector is now always visible and optional with a leading "Standalone (no allocation)" sentinel item (blank = standalone). Income-category section gated on `!isPf`; create payload drops `sourceType`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] dashboard-service.ts referenced wallet.sourceType**

- **Found during:** Task 2 (grep of `apps/api/src` surfaced a reference not listed in the plan's files)
- **Issue:** `apps/api/src/services/dashboard-service.ts:291` gated pfAllocation on `wallet.sourceType === 'PROFIT_FIRST' && wallet.profitFirstAccountId != null`. After the schema change `sourceType` no longer exists on the wallet row type, so API typecheck/tests would fail.
- **Fix:** Changed the gate to `if (wallet.profitFirstAccountId != null)` — identical behavior, keyed on the surviving discriminator.
- **Files modified:** apps/api/src/services/dashboard-service.ts
- **Commit:** 848c18a

Test-name/comment strings containing `PROFIT_FIRST` were also re-worded (to "PF-linked") so the plan's repo-wide zero-reference verification passes; behavioral assertions were preserved.

## Discretionary Choices

- **withdrawalLabel** (dead code, zero importers) was kept and re-keyed to `profitFirstAccountId: number | null` rather than deleted, so the file compiles cleanly without `WalletSourceType` (plan allowed either).
- **STANDALONE sentinel** (`'__standalone__'`) added to the form's allocation Select because shadcn `Select` cannot represent an empty value; mapped to `null` on submit.

## Verification

- `packages/db`: typecheck passes; `0004_far_mister_sinister.sql` drops `source_type` and preserves `profit_first_account_id`, the FK, and the unique index.
- `apps/api`: typecheck passes; full Vitest suite green (190 tests across 9 files); zero `sourceType`/`source_type`/`PROFIT_FIRST` references in `src` or `tests`.
- `apps/web`: typecheck + lint pass; zero `sourceType`/`WalletSourceType`/`PROFIT_FIRST` references in `src`.
- Remaining `source_type` mentions are confined to historical migrations 0000–0003 and their snapshots (immutable history — left as-is).

## Commits

- 684b1ab — feat(260607-hci): drop wallets.source_type column from schema
- 848c18a — refactor(260607-hci): re-key wallet API onto profitFirstAccountId
- e3cea15 — refactor(260607-hci): re-key web wallet layer onto profitFirstAccountId

## Known Stubs

None.

## Self-Check: PASSED

All created files exist (0004 migration, wallet-labels.ts, SUMMARY.md) and all three task commits (684b1ab, 848c18a, e3cea15) are present in git history.
