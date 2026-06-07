---
phase: '06-settings-notifications'
plan: '01'
subsystem: 'db-schema + api-tests + web-types'
tags: ['schema', 'migration', 'd1', 'test-scaffold', 'currency', 'notifications', 'settings']
dependency_graph:
  requires: []
  provides:
    - 'notifications table in local D1 (migrated)'
    - 'users settings columns: displayCurrency, reminderEnabled, reminderFrequency, reminderDayOfWeek, reminderDayOfMonth, reminderHour'
    - 'incomes.pendingDueNotifiedAt dedup column'
    - 'CURRENCY_LOCALES map + CurrencyCode type in format-currency.ts'
    - 'UserSettings interface + CurrencyCode re-export in types/settings.ts'
    - 'Notification interface + NotificationType union in types/notifications.ts'
    - 'RED test scaffolds for settings/notifications/cron services'
  affects:
    - 'packages/db/src/schema.ts'
    - 'packages/db/migrations/ (additive)'
    - 'apps/api/tests/helpers/db.ts'
    - 'apps/web/src/lib/format-currency.ts'
tech_stack:
  added: []
  patterns:
    - 'Drizzle additive migration via drizzle-kit generate + wrangler d1 migrations apply'
    - 'Option B formatCurrency upgrade: optional second param with PHP default preserves all call sites'
    - 'Vitest RED scaffold pattern: import non-existent service to force test failure on missing module'
key_files:
  created:
    - 'packages/db/migrations/0005_orange_naoko.sql'
    - 'apps/api/tests/settings.test.ts'
    - 'apps/api/tests/notifications.test.ts'
    - 'apps/api/tests/cron.test.ts'
    - 'apps/web/src/types/settings.ts'
    - 'apps/web/src/types/notifications.ts'
  modified:
    - 'packages/db/src/schema.ts'
    - 'packages/db/migrations/meta/0005_snapshot.json'
    - 'packages/db/migrations/meta/_journal.json'
    - 'apps/api/tests/helpers/db.ts'
    - 'apps/web/src/lib/format-currency.ts'
decisions:
  - "Option B selected for formatCurrency upgrade: add optional `currency: CurrencyCode = 'PHP'` param rather than Option A (React context hook). The plan explicitly calls out Option B as the correct choice for the no-call-site-rework contract — all 10 existing call sites pass 0 extra args and remain unchanged."
  - 'JPY fraction digits = 0 (zero-decimal currency); all others = 2. Implemented as a ternary inline in formatCurrency.'
  - 'pendingDueNotifiedAt placed before createdAt/updatedAt in incomes table to follow the established column ordering pattern.'
  - "cron.test.ts scaffolds use `require('drizzle-orm').eq(...)` for direct db.update calls in test setup — avoids a top-level import that would conflict with the mock setup order."
metrics:
  duration: '7 minutes'
  completed_date: '2026-06-07'
  tasks_completed: 3
  files_changed: 11
---

# Phase 6 Plan 01: Foundation Schema + Test Scaffolds + Currency Formatter Summary

Schema foundation, additive D1 migration, test DDL sync, RED test scaffolds, and currency-aware formatter for Phase 6 settings and notifications.

## What Was Built

### Task 1: Drizzle schema extension + D1 migration (BLOCKING)

Extended `packages/db/src/schema.ts` with three additions:

1. **`notifications` table** — id, userId (FK cascade), type enum `['INCOME_REMINDER', 'PENDING_INCOME_DUE']`, title, message, link (nullable), read (boolean default false), createdAt ($defaultFn ISO). Two indexes: `notif_user_read_created_idx(userId, read, createdAt)` and `notif_user_read_idx(userId, read)`.

2. **Six settings columns on `users`** — `displayCurrency` (text, default 'PHP'), `reminderEnabled` (boolean, default false), `reminderFrequency` (enum nullable), `reminderDayOfWeek` (int nullable), `reminderDayOfMonth` (int nullable, capped 1–28), `reminderHour` (int nullable).

3. **`pendingDueNotifiedAt` on `incomes`** — text nullable; the D-07 dedup guard that prevents repeated PENDING_INCOME_DUE notifications for the same income record.

Migration `0005_orange_naoko.sql` was generated (additive only — no existing migration modified) and applied to the local D1 database. Verified with `wrangler d1 execute` queries confirming both `notifications` table and `users.display_currency` column exist.

### Task 2: Test DDL sync + RED scaffolds

Extended `apps/api/tests/helpers/db.ts` DDL to mirror the new schema:

- Added 6 settings columns to `CREATE TABLE users`
- Added `pending_due_notified_at TEXT` to `CREATE TABLE incomes`
- Added `CREATE TABLE notifications` with both indexes

Created three RED test files (fail only on missing-module imports):

| File                                   | Covers                                                                                   | RED reason                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `apps/api/tests/settings.test.ts`      | SET-01 default currency, updateSettings currency + SET-02 DAILY/WEEKLY/MONTHLY reminders | `@/services/settings-service` does not exist     |
| `apps/api/tests/notifications.test.ts` | NOTIF-01 unread count, markAsRead IDOR guard, markAllAsRead, list order                  | `@/services/notification-service` does not exist |
| `apps/api/tests/cron.test.ts`          | NOTIF-02 due-user detection, non-due skip, pending-due dedup, per-user email mock        | `@/services/cron-service` does not exist         |

All 190 previously-passing tests remain green.

### Task 3: Currency-aware formatCurrency + web contract types

Upgraded `apps/web/src/lib/format-currency.ts`:

- Added `CURRENCY_LOCALES` const with all 8 codes: PHP (₱, en-PH), USD ($, en-US), EUR (€, de-DE), GBP (£, en-GB), SGD (S$, en-SG), AUD (A$, en-AU), JPY (¥, ja-JP), CAD (C$, en-CA)
- Exported `CurrencyCode = keyof typeof CURRENCY_LOCALES`
- Changed signature to `formatCurrency(cents: number, currency: CurrencyCode = 'PHP'): string`
- PHP default preserves identical output for all 10 existing call sites
- JPY uses 0 fraction digits; all others use 2

Created `apps/web/src/types/settings.ts` exporting `UserSettings` interface and re-exporting `CurrencyCode`.

Created `apps/web/src/types/notifications.ts` exporting `NotificationType` union and `Notification` interface.

`npx tsc -b apps/web/tsconfig.json` passes with zero errors — no call-site breakage.

## Commits

| Hash      | Type | Description                                                                                              |
| --------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `5b8a74a` | feat | Extend schema with notifications table + user settings columns; additive migration generated and applied |
| `94beb89` | test | Sync test DDL and add RED test scaffolds for SET-01, SET-02, NOTIF-01, NOTIF-02                          |
| `f95e518` | feat | Currency-aware formatCurrency + UserSettings and Notification types                                      |

## Deviations from Plan

None — plan executed exactly as written. Option B was pre-selected by the planner for formatCurrency and confirmed in plan `<action>` — no architectural deviation.

## Known Stubs

None. This plan contains no UI components or data-wired pages. All outputs are schema, types, and test scaffolds.

## Threat Flags

No new trust boundaries introduced. The schema additions are purely additive and isolated to the packages/db layer. Migration is additive only (T-6-01 mitigated). Live D1 query confirms tables present (T-6-02 mitigated).

## Self-Check: PASSED

- `packages/db/src/schema.ts` exports `notifications` — FOUND
- `packages/db/migrations/0005_orange_naoko.sql` — FOUND
- `apps/api/tests/helpers/db.ts` contains `CREATE TABLE notifications` — FOUND
- `apps/api/tests/settings.test.ts` — FOUND
- `apps/api/tests/notifications.test.ts` — FOUND
- `apps/api/tests/cron.test.ts` — FOUND
- `apps/web/src/lib/format-currency.ts` contains `CURRENCY_LOCALES` — FOUND
- `apps/web/src/types/settings.ts` — FOUND
- `apps/web/src/types/notifications.ts` — FOUND
- Commits `5b8a74a`, `94beb89`, `f95e518` — FOUND in git log
- D1 live query: `notifications` table present — PASSED
- D1 live query: `users.display_currency` column present — PASSED
- `npx tsc -b apps/web/tsconfig.json` — PASSED (0 errors)
- `npm run test --workspace=apps/api` — 190 existing tests green; 3 new RED scaffolds fail only on missing-module imports (expected)
