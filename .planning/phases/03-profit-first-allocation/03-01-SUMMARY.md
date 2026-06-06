---
phase: 03-profit-first-allocation
plan: '01'
subsystem: profit-first-accounts
tags: [schema, seeding, migration, utilities, tests]
dependency_graph:
  requires: [phase-01-auth]
  provides:
    [
      profit_first_accounts table,
      incomes table,
      seedProfitFirstAccounts helper,
      PF_DEFAULT_COLORS,
      formatCurrency,
      PF-01 tests,
    ]
  affects: [auth-service seeding hooks, local D1 schema]
tech_stack:
  added: []
  patterns:
    [
      Drizzle additive migration,
      idempotent backfill SQL,
      service seed helper,
      in-memory test DB pattern,
    ]
key_files:
  created:
    - apps/api/src/services/profit-first-service.ts
    - apps/api/tests/profit-first.test.ts
  modified:
    - packages/db/src/schema.ts
    - apps/api/src/services/auth-service.ts
    - apps/api/tests/helpers/db.ts
    - apps/web/src/lib/constants.ts
    - packages/db/migrations/0002_narrow_lethal_legion.sql
decisions:
  - profitFirstAccounts table uses uniqueIndex(userId, name) for idempotent seeding
  - incomes table already existed from Phase 2 work — no minimal stub needed
  - backfill uses 4 separate INSERT...SELECT...WHERE NOT IN statements for idempotency
  - PF_DEFAULT_COLORS added to existing constants.ts (alongside PAYMENT_METHODS)
  - formatCurrency already existed with toLocaleString en-PH — produces correct output
metrics:
  duration: '~15 min'
  completed: '2026-06-06'
  tasks_completed: 3
  files_modified: 7
---

# Phase 03 Plan 01: Profit First Data Foundation Summary

Profit First accounts table, seed helper wired into both auth paths, additive migration with idempotent backfill, and PF-01 tests — every new and pre-existing user now gets exactly four canonical allocation accounts.

## Tasks Completed

| Task | Name                                                         | Commit  | Files                                                       |
| ---- | ------------------------------------------------------------ | ------- | ----------------------------------------------------------- |
| 1    | Add profitFirstAccounts table to schema                      | f57b7aa | packages/db/src/schema.ts                                   |
| 2    | Wave 0 scaffold — seed helper, auth hooks, tests, utilities  | 489b49b | 5 files                                                     |
| 3    | Generate + apply additive migration with idempotent backfill | 3508595 | packages/db/migrations/0002_narrow_lethal_legion.sql + meta |

## What Was Built

### Schema (Task 1)

`profit_first_accounts` table added to `packages/db/src/schema.ts`:

- Columns: id, name, targetPercentage (basis points), color (hex), sortOrder, accountType enum (PROFIT/OWNERS_PAY/TAX/OPEX/CUSTOM), userId FK, createdAt, updatedAt
- `uniqueIndex('pfa_user_name_unique')` on (userId, name) for race-safe idempotent seeding
- `incomes` table was already present from Phase 2 work — no minimal stub needed

### Seed Helper (Task 2)

`apps/api/src/services/profit-first-service.ts` exports `seedProfitFirstAccounts(db, userId)`:

- Inserts 4 canonical defaults: Profit/500bp/#10b981, Owner Pay/5000bp/#8b5cf6, Tax/1500bp/#f59e0b, Operating Expenses/3000bp/#f43f5e
- Wired into `register()` (after user insert, before issueVerifyToken)
- Wired into `upsertGoogleUser()` branch 3 only (brand-new users — never branches 1/2)

### Web Utilities (Task 2)

- `apps/web/src/lib/constants.ts`: Added `PF_DEFAULT_COLORS` 8-value as const tuple. `formatCurrency` already existed with correct `toLocaleString('en-PH')` implementation.
- Cross-plan sync noted: Plan 02 must duplicate PF_DEFAULT_COLORS in `apps/api/src/schemas/profit-first.ts` for Zod enum validation.

### Tests (Task 2)

`apps/api/tests/profit-first.test.ts` — 3 PF-01 tests pass:

- "seeds default accounts on register" — verifies 4 accounts with exact D-03 values
- "seeds on Google OAuth first login" — verifies 4 accounts for new Google user
- "does not duplicate accounts for returning Google user" — verifies exactly 4 accounts after second upsertGoogleUser call

PF-02/03/04 describe blocks scaffolded with `it.todo(...)` entries.

### Migration (Task 3)

`packages/db/migrations/0002_narrow_lethal_legion.sql` (additive):

- Creates `profit_first_accounts` table with unique index
- Appends 4 idempotent backfill INSERT...SELECT statements using `WHERE id NOT IN (SELECT DISTINCT user_id FROM profit_first_accounts)` guard
- Applied to local D1 — both `profit_first_accounts` and `incomes` confirmed present

## Deviations from Plan

### Deviation 1: incomes table already existed

**Found during:** Task 1 planning
**Issue:** The plan described adding a "minimal incomes table" but the schema.ts already contained a full incomes table from Phase 2 work (categories FK, description, paymentMethod, soft-delete, etc.) — more complete than the minimal stub planned.
**Fix:** Skipped adding the minimal stub; the full table already satisfies the summary query columns needed by Phase 3.
**Files modified:** None (no change needed)
**Rule:** Auto-fixed (Rule 3 — blocking issue resolved by recognizing the table was already present)

### Deviation 2: format-currency.ts already existed

**Found during:** Task 2 planning
**Issue:** `apps/web/src/lib/format-currency.ts` already existed with `formatCurrency` using `toLocaleString('en-PH')` instead of the regex pattern in the plan. Output is identical: `formatCurrency(123456)` → `₱1,234.56`.
**Fix:** No change needed — existing implementation is correct and more maintainable.
**Rule:** Auto-fixed (Rule 3 — file already satisfies the task requirement)

### Deviation 3: PF_DEFAULT_COLORS added to existing constants.ts

**Found during:** Task 2 implementation
**Issue:** `apps/web/src/lib/constants.ts` already existed with `PAYMENT_METHODS`. The plan assumed the file would be created fresh.
**Fix:** Added `PF_DEFAULT_COLORS` to the existing file alongside `PAYMENT_METHODS`.
**Rule:** Auto-fixed (Rule 3 — additive change to existing file)

## Verification Results

- `cd packages/db && npx tsc --noEmit` — exits 0
- `cd apps/api && npx vitest run tests/profit-first.test.ts` — 3 tests pass, 11 todos
- `npm run test` — 73 tests pass, 11 todos (full suite green)
- `wrangler d1 execute DB --local` — confirms profit_first_accounts and incomes tables present
- `grep` gates: seedProfitFirstAccounts wired into register() + Google branch 3 only (3 occurrences: 1 import + 2 call sites)

## Known Stubs

None — all required functionality is implemented and wired.

## Threat Surface Scan

No new network endpoints introduced in this plan. The seeding calls use server-side userId from the insert result (T-03-01: never client-supplied). Branch seeding restricted to branch 3 only (T-03-02). Backfill uses NOT IN idempotency guard (T-03-03). No new threat surface beyond what the plan's threat model anticipated.

## Self-Check: PASSED

- packages/db/src/schema.ts: FOUND
- apps/api/src/services/profit-first-service.ts: FOUND
- apps/api/src/services/auth-service.ts: FOUND (seeding calls verified)
- apps/api/tests/helpers/db.ts: FOUND (DDL extended)
- apps/api/tests/profit-first.test.ts: FOUND
- apps/web/src/lib/constants.ts: FOUND (PF_DEFAULT_COLORS present)
- packages/db/migrations/0002_narrow_lethal_legion.sql: FOUND
- Commits f57b7aa, 489b49b, 3508595: all verified in git log
