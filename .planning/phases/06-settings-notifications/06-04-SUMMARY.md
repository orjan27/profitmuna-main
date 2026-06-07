---
phase: '06-settings-notifications'
plan: '04'
subsystem: 'cron-email-producer'
tags: ['cron', 'workers', 'resend', 'email', 'notifications', 'manila-time', 'NOTIF-02']
dependency_graph:
  requires:
    - '06-01 (schema: incomes.pendingDueNotifiedAt, users settings columns)'
    - '06-02 (settings service: reminderEnabled/Frequency/Hour/etc stored in DB)'
    - '06-03 (notification service: create() for INCOME_REMINDER + PENDING_INCOME_DUE)'
  provides:
    - 'apps/api/src/lib/manila-time.ts: dependency-free UTC+8 helper (getManilaParts, lastDayOfMonth)'
    - 'apps/api/src/services/cron-service.ts: runCron(env, now?) with due-user + pending-due logic'
    - 'apps/api/src/lib/email.ts: sendIncomeReminderEmail added to EmailService'
    - 'apps/api/src/index.ts: Module Worker export { fetch, scheduled } replacing export default app'
    - 'apps/api/wrangler.toml: [triggers] crons = ["0 * * * *"]'
  affects:
    - 'apps/api/tests/auth.test.ts (import updated: default → named { app })'
    - 'apps/api/tests/index.test.ts (import updated: default → named { app })'
tech_stack:
  added: []
  patterns:
    - 'Dependency-free UTC+8 Manila offset helper (no @date-fns/tz in apps/api)'
    - 'Module Worker export: { fetch: app.fetch, scheduled } required for Workers cron (Pitfall 5)'
    - 'runCron(env, now?) accepts optional now for test clock injection'
    - 'Per-user/per-income try/catch so one failure does not abort the whole cron run (T-6-13)'
    - 'isNull(pendingDueNotifiedAt) dedup guard + stamp-after-insert (T-6-11, D-07)'
    - 'CRON_CURRENCY_LOCALES inline map synced with apps/web format-currency.ts (SET-01 in API layer)'
    - 'Named export { app } alongside Worker default for test-helper compatibility'
key_files:
  created:
    - 'apps/api/src/lib/manila-time.ts'
    - 'apps/api/src/services/cron-service.ts'
  modified:
    - 'apps/api/src/lib/email.ts'
    - 'apps/api/src/index.ts'
    - 'apps/api/wrangler.toml'
    - 'apps/api/tests/auth.test.ts'
    - 'apps/api/tests/index.test.ts'
decisions:
  - >-
    Named export { app } added alongside the Module Worker default export so existing
    test helpers (index.test.ts, auth.test.ts) that call app.request() continue to work.
    The default Worker object { fetch, scheduled } is the production export; the named
    app is the test surface. Import updated in both test files.
  - >-
    CRON_CURRENCY_LOCALES defined inline in cron-service.ts (not imported from apps/web)
    because the API workspace cannot import across workspace boundaries. Comment instructs
    maintainers to keep it in sync with CURRENCY_LOCALES in format-currency.ts.
  - >-
    runCron accepts optional now?: Date second parameter for test clock injection — avoids
    mocking Date.now() globally and keeps tests deterministic without time freezing.
  - >-
    Pending-due currency formatting uses the income owner's displayCurrency from a join
    on users table, never hardcodes PHP/en-PH (SET-01 requirement, T-6-12).
metrics:
  duration: '15 minutes'
  completed_date: '2026-06-07'
  tasks_completed: 3
  files_changed: 7
---

# Phase 6 Plan 04: Cron/Email Producer (NOTIF-02) Summary

Hourly Workers cron that emails income-reminder nudges, mirrors them as INCOME_REMINDER in-app notifications, and creates one-time PENDING_INCOME_DUE notifications for pending incomes due today — with correct Manila-time bucketing, display-currency-aware message formatting, and idempotency via dedup stamp.

## What Was Built

### Task 1: Manila-time helper + cron-service (GREEN the cron tests)

**`apps/api/src/lib/manila-time.ts`** — dependency-free UTC+8 offset helper:

- `getManilaParts(now: Date)` shifts by `MANILA_OFFSET_MS = 8 * 60 * 60 * 1000` and reads UTC getters on the shifted Date (no `@date-fns/tz` import — that package is not in `apps/api/package.json`). Returns `{ hour, dayOfWeek, dayOfMonth, dateStr }`.
- `lastDayOfMonth(year, month0)` for the day-31 monthly clamp (Pitfall 6): `new Date(year, month0+1, 0).getDate()`.

**`apps/api/src/services/cron-service.ts`** — `runCron(env: Bindings, now?: Date)`:

- All env values consumed inside `runCron` — never at module scope (Pitfall 1, T-6-10).
- `isUserDue(user, parts)`: DAILY checks `reminderHour === hour`; WEEKLY adds `reminderDayOfWeek === dayOfWeek`; MONTHLY clamps stored `reminderDayOfMonth` to the last day of the current month (`lastDayOfMonth`) before comparing.
- **Reminder path**: selects users where `reminderEnabled=true`, applies `isUserDue` in service logic, calls `emailSvc.sendIncomeReminderEmail` + `notifSvc.create(..., 'INCOME_REMINDER', ...)` per due user (D-05 mirror).
- **Pending-due path**: inner-joins `incomes` with `users` to get `displayCurrency`, queries `moneyStatus='PENDING' AND expectedReleaseDate=dateStr AND isNull(pendingDueNotifiedAt)` (D-07 dedup guard), calls `notifSvc.create(..., 'PENDING_INCOME_DUE', ...)` with `formatPendingDueMessage(amountCents, categoryName, displayCurrency)`, then stamps `pendingDueNotifiedAt` (T-6-11). Never emails pending-due (D-06).
- **`CRON_CURRENCY_LOCALES`**: inline map of 8 ISO codes → `{ locale, symbol }` — same 8 as `apps/web/src/lib/format-currency.ts`; comment instructs sync maintenance.
- Per-user/per-income try/catch so one failure does not abort the run (T-6-13); logs `{ userId/incomeId, err }` only — no PII, no API key (T-6-10, security.md).
- Optional `now?: Date` parameter enables test clock injection without global mocking.

**cron.test.ts**: All 4 NOTIF-02 tests turn GREEN:

- Due daily user at matching Manila hour → reminder email sent
- User not due at current hour → no email
- Pending income dedup: second cron run at same date creates no duplicate
- Two due users → two email calls (mock Resend verification)

### Task 2: Extend EmailService with sendIncomeReminderEmail (D-04)

**`apps/api/src/lib/email.ts`**: Added `sendIncomeReminderEmail(to, name, incomePageUrl): Promise<void>` to:

- The `EmailService` type
- The `createEmailService` return object

Subject: `'Profitmuna: Time to log your income'`. HTML: plain nudge with user's name and anchor to `incomePageUrl` (D-04 — no aggregate stats). Error log pattern: `console.error('sendIncomeReminderEmail failed:', { to, error })` — no PII body (security.md).

### Task 3: Module Worker scheduled export + hourly cron trigger [wiring]

**`apps/api/src/index.ts`**:

- Imports `runCron` from `@/services/cron-service`.
- Replaces `export default app;` with Module Worker object form: `export default { fetch: app.fetch, async scheduled(_controller, env, ctx) { ctx.waitUntil(runCron(env)); } }` (Pitfall 5 — object form required for scheduled event to register; `ctx.waitUntil` bounds Worker lifetime).
- Adds `export { app }` as a named export so `auth.test.ts` and `index.test.ts` (which call `app.request()`) remain unbroken.

**`apps/api/wrangler.toml`**: Added `[triggers]` section with `crons = ["0 * * * *"]` (D-02, hourly; handler buckets to Manila hour).

**Test import fix** (Rule 1): `auth.test.ts` and `index.test.ts` updated from `import app from '../src/index'` to `import { app } from '../src/index'` — the default export is now the Worker object, not the Hono instance.

Full suite: **203 tests pass across 12 test files**.

## Commits

| Hash      | Type | Description                                               |
| --------- | ---- | --------------------------------------------------------- |
| `dfd9a6d` | feat | Add Manila-time helper and runCron service (GREEN)        |
| `f571c6a` | feat | Extend EmailService with sendIncomeReminderEmail (D-04)   |
| `08070dc` | feat | Wire Module Worker scheduled export + hourly cron trigger |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test import breakage from Module Worker default export**

- **Found during:** Task 3 verify
- **Issue:** Changing `export default app` (Hono instance) to `export default { fetch, scheduled }` (Worker object) broke `auth.test.ts` and `index.test.ts` which called `app.request()` on the default export — `default.request is not a function`.
- **Fix:** Added `export { app }` named export to `index.ts` alongside the Worker default. Updated the two test files to import `{ app }` (named) instead of `app` (default). No test behavior changed, only the import syntax.
- **Files modified:** `apps/api/src/index.ts`, `apps/api/tests/auth.test.ts`, `apps/api/tests/index.test.ts`
- **Commit:** 08070dc

**2. Tasks 1 and 2 implemented together (tightly coupled)**

- **Found during:** Task 1 verify
- **Issue:** cron.test.ts called `emailSvc.sendIncomeReminderEmail` which did not exist yet (Task 2 was planned after Task 1). The test error was `emailSvc.sendIncomeReminderEmail is not a function` — caught by per-item try/catch in `sendReminderEmails`, causing all reminder tests to see 0 email calls.
- **Fix:** Implemented Task 2 (email.ts extension) before committing Task 1, then committed them in plan order (Task 1 commit includes both files). The plan ordering is preserved; this is a sequencing note only.

## Known Stubs

None. The cron service is fully wired: email sending uses the live Resend SDK (mocked in tests), notification creation uses the real notification service, and Manila-time derivation is complete. No hardcoded stubs or placeholder data.

## Threat Flags

No new trust boundaries beyond the plan's threat model.

| Threat Mitigation                 | Status                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| T-6-10 (PII/key leak in logs)     | Mitigated — env consumed inside runCron; logs only { userId/incomeId, err }            |
| T-6-11 (duplicate pending-due)    | Mitigated — isNull(pendingDueNotifiedAt) guard + stamp after insert                    |
| T-6-12 (cross-user notifications) | Mitigated — notifications created using the row's own userId (user.id / income.userId) |
| T-6-13 (one failure aborts cron)  | Mitigated — per-user/per-income try/catch                                              |

## Self-Check: PASSED

- `apps/api/src/lib/manila-time.ts` — FOUND
- `apps/api/src/services/cron-service.ts` contains `export async function runCron` — FOUND
- `apps/api/src/lib/email.ts` contains `sendIncomeReminderEmail` — FOUND
- `apps/api/src/index.ts` contains `scheduled` and `runCron` — FOUND
- `apps/api/src/index.ts` does NOT contain `export default app;` — CONFIRMED
- `apps/api/wrangler.toml` contains `crons = ["0 * * * *"]` — FOUND
- No `import ... from '@date-fns/tz'` in apps/api/src/ — CONFIRMED (comment mentions only, no import)
- Commits `dfd9a6d`, `f571c6a`, `08070dc` — FOUND in git log
- `npm run test --workspace=apps/api -- --run`: 203 tests passed (12 test files) — PASSED
- `npx tsc -b apps/api/tsconfig.json --noEmit` — PASSED (0 errors)
- cron.test.ts: 4/4 NOTIF-02 tests GREEN — PASSED
