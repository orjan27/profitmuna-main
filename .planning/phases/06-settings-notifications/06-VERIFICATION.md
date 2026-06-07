---
phase: 06-settings-notifications
verified: 2026-06-07T15:45:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: 'Open /settings in the browser while logged in. Select a non-PHP currency (e.g. USD). Click Save Settings. Navigate to the Income, Expenses, Profit First, and Wallets pages.'
    expected: 'All monetary amounts across all pages render with the USD $ symbol and en-US formatting. The Settings page reloads with USD pre-selected.'
    why_human: 'Currency context flows from a React context provider seeded by an SSR fetch. grep can confirm the wiring is present but cannot exercise the runtime rendering across pages.'

  - test: 'Open the notification bell in the nav. Verify the bell icon and unread badge render. Create a test INCOME_REMINDER notification row directly in the local D1 DB, reload the page.'
    expected: 'The badge shows the correct unread count (e.g. 1). Opening the bell shows the notification row with unread (highlighted / dot indicator) styling. Clicking the row marks it read (badge clears) and navigates to /income.'
    why_human: 'The notification center is an SSR-fed dropdown; optimistic state updates and navigation cannot be verified by grep. The Plan 04 cron must be triggered manually or the row inserted directly to test the consumer path.'

  - test: "Enable reminders on the Settings page (Daily, 9:00 AM Manila). Trigger the cron manually: curl 'http://localhost:8793/cdn-cgi/handler/scheduled' while the API dev server is running."
    expected: "The Resend dashboard (or test log) shows an email sent to the seeded user's address with subject 'Profitmuna: Time to log your income'. A new INCOME_REMINDER notification row appears in the local D1 notifications table."
    why_human: 'The cron handler runs in a Workers runtime. Test suite mocks Resend — only the live runtime confirms the email actually sends through Resend and that the Module Worker scheduled export is wired correctly end-to-end.'

  - test: 'With a PENDING income whose expectedReleaseDate is today (Manila time), trigger the cron. Trigger again a second time.'
    expected: 'First run: a PENDING_INCOME_DUE notification is created for that income. No email is sent. Second run: no duplicate notification is created (pendingDueNotifiedAt is stamped after the first).'
    why_human: 'Dedup relies on the pendingDueNotifiedAt column being stamped in the live D1 DB. Test suite verifies this but against an in-memory SQLite shim — live D1 behavior should be spot-checked once.'
---

# Phase 6: Settings & Notifications Verification Report

**Phase Goal:** Users can configure their display currency and reminder schedule, and receive both in-app notifications and scheduled email reminders
**Verified:** 2026-06-07T15:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                            | Status   | Evidence                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Notifications table, user settings columns, and incomes.pendingDueNotifiedAt exist in schema and migration                                                                       | VERIFIED | `packages/db/src/schema.ts` exports `notifications` table with correct columns and indexes; 6 settings columns on `users`; `pendingDueNotifiedAt` on `incomes`. Migration `0005_orange_naoko.sql` exists and is additive.                                                                                                    |
| 2   | formatCurrency supports 8 currencies with PHP default; no existing call sites broken                                                                                             | VERIFIED | `CURRENCY_LOCALES` map with all 8 codes in `format-currency.ts`. Signature `formatCurrency(cents: number, currency: CurrencyCode = 'PHP')`.                                                                                                                                                                                  |
| 3   | User can open /settings and see current currency and reminder schedule pre-populated                                                                                             | VERIFIED | `settings/page.tsx` is a Server Component that SSR-fetches `/api/settings` and passes `initialSettings` to `<SettingsForm>`. Service `getSettings(userId)` returns all 6 fields.                                                                                                                                             |
| 4   | User can change display currency and Save; CurrencyProvider propagates it app-wide                                                                                               | VERIFIED | `SettingsForm` PUTs to `/api/settings`. `CurrencyProvider` in `layout.tsx` fetches SSR and wraps children. All 9 client-component formatCurrency consumers converted to `useFormatCurrency()`.                                                                                                                               |
| 5   | User can configure Daily/Weekly/Monthly + day + Manila hour reminder schedule; Save persists it                                                                                  | VERIFIED | `SettingsForm` conditionally mounts schedule fields. `updateSettingsSchema` validates all fields. `updateSettings()` persists scoped to `userId`. Day-of-month capped at 28 (Pitfall 6).                                                                                                                                     |
| 6   | GET /api/settings and PUT /api/settings are behind requireAuth and userId-scoped                                                                                                 | VERIFIED | `settingsRouter.use('/*', requireAuth)`. All queries use `eq(users.id, userId)`. 5/5 settings tests pass.                                                                                                                                                                                                                    |
| 7   | Bell icon in nav shows unread count badge; opening it shows notifications newest-first, unread highlighted                                                                       | VERIFIED | `NotificationBell` renders Bell + destructive Badge (9+ cap). `DashboardNav` receives SSR-fetched `unreadCount + notifications` from layout. `NotificationList` sorts newest-first (ORDER BY desc(createdAt), desc(id)). Unread rows get `bg-accent/50 hover:bg-accent` class.                                               |
| 8   | Clicking a notification marks it read and navigates via its link; mark-all-read clears the badge                                                                                 | VERIFIED | `handleNotificationClick` optimistically sets row read, fires `PUT /api/notifications/:id/read`, then `router.push(link)`. `handleMarkAllRead` PUTs `/api/notifications/read-all`. 4/4 notification tests pass.                                                                                                              |
| 9   | Hourly Workers cron fires; due users get reminder email + INCOME_REMINDER notification; pending incomes due today get PENDING_INCOME_DUE notification (once only, never emailed) | VERIFIED | `wrangler.toml` has `[triggers] crons = ["0 * * * *"]`. `index.ts` exports Module Worker object with `scheduled` handler calling `ctx.waitUntil(runCron(env))`. `runCron` implements reminder path (email + INCOME_REMINDER create) and pending-due path (PENDING_INCOME_DUE create + stamp, no email). 4/4 cron tests pass. |
| 10  | PENDING_INCOME_DUE message uses the income owner's displayCurrency, not hardcoded PHP                                                                                            | VERIFIED | `createPendingDueNotifications` inner-joins `users` to get `displayCurrency`. `formatPendingDueMessage` reads from `CRON_CURRENCY_LOCALES` — no hardcoded `₱` or `en-PH` in the pending-due message path.                                                                                                                    |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact                                                     | Expected                                                                    | Status   | Details                                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `packages/db/src/schema.ts`                                  | notifications table + users settings columns + incomes.pendingDueNotifiedAt | VERIFIED | All present. `export const notifications` with correct enum, indexes.                                        |
| `apps/api/tests/helpers/db.ts`                               | Test DDL mirrors new schema                                                 | VERIFIED | `CREATE TABLE notifications`, 6 settings columns on users, `pending_due_notified_at` on incomes all present. |
| `apps/web/src/lib/format-currency.ts`                        | CURRENCY_LOCALES + CurrencyCode                                             | VERIFIED | `CURRENCY_LOCALES` with 8 codes, exported `CurrencyCode = keyof typeof CURRENCY_LOCALES`.                    |
| `apps/web/src/types/settings.ts`                             | UserSettings + CurrencyCode                                                 | VERIFIED | Exports both.                                                                                                |
| `apps/web/src/types/notifications.ts`                        | Notification + NotificationType                                             | VERIFIED | Exports both.                                                                                                |
| `apps/api/src/services/settings-service.ts`                  | createSettingsService getSettings/updateSettings                            | VERIFIED | Factory pattern, ownership-scoped, HTTPException 404 on missing row.                                         |
| `apps/api/src/routes/settings.ts`                            | GET / and PUT / behind requireAuth                                          | VERIFIED | `settingsRouter.use('/*', requireAuth)`. Both routes present. Exported as `settingsRouter`.                  |
| `apps/web/src/app/(dashboard)/settings/page.tsx`             | SSR settings page                                                           | VERIFIED | Server Component, SSR fetch, renders `<SettingsForm initialSettings={settings}>`.                            |
| `apps/web/src/components/CurrencyProvider.tsx`               | CurrencyProvider context                                                    | VERIFIED | Exports `CurrencyProvider`, `useCurrency`, `useFormatCurrency`. Default 'PHP'.                               |
| `apps/api/src/services/notification-service.ts`              | list/getUnreadCount/markAsRead/markAllAsRead/create                         | VERIFIED | All 5 methods present. IDOR-safe (dual predicate on markAsRead). No `any`.                                   |
| `apps/api/src/routes/notifications.ts`                       | GET / GET /unread-count PUT /read-all PUT /:id/read                         | VERIFIED | `/read-all` registered before `/:id/read` (param-shadow avoidance). requireAuth at router level.             |
| `apps/web/src/components/notifications/NotificationBell.tsx` | Bell + badge + dropdown                                                     | VERIFIED | Ghost icon Button, Bell, destructive Badge (9+ cap). DropdownMenuContent wraps NotificationList.             |
| `apps/web/src/components/notifications/NotificationList.tsx` | Rows, mark-read on click, mark-all-read                                     | VERIFIED | Optimistic updates, `PUT :id/read`, `PUT /read-all`, empty state, Settings footer link.                      |
| `apps/api/src/services/cron-service.ts`                      | runCron(env)                                                                | VERIFIED | `export async function runCron`. Due-user + pending-due logic. Per-item try/catch.                           |
| `apps/api/src/lib/manila-time.ts`                            | UTC+8 helper (no new deps)                                                  | VERIFIED | `getManilaParts` and `lastDayOfMonth`. No import of `@date-fns/tz` or `date-fns`.                            |
| `apps/api/src/lib/email.ts`                                  | sendIncomeReminderEmail on EmailService                                     | VERIFIED | Added to type and implementation. Subject matches spec. Error log pattern correct.                           |
| `apps/api/wrangler.toml`                                     | [triggers] crons                                                            | VERIFIED | `[triggers]` section with `crons = ["0 * * * *"]`.                                                           |

### Key Link Verification

| From                                                                  | To                             | Via                                                    | Status   | Details                                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(dashboard)/settings/_components/settings-form.tsx` | `/api/settings`                | fetch PUT                                              | VERIFIED | `fetch('/api/settings', { method: 'PUT', ... })` present. Success/error toasts + `router.refresh()` confirmed.                        |
| `apps/api/src/index.ts`                                               | `settingsRouter`               | `app.route` mount                                      | VERIFIED | `app.route('/api/settings', settingsRouter)` on line 86.                                                                              |
| `apps/web/src/app/(dashboard)/layout.tsx`                             | `CurrencyProvider`             | wraps children with fetched displayCurrency            | VERIFIED | Layout fetches `/api/settings` SSR with try/catch fallback. Wraps `{children}` in `<CurrencyProvider currency={displayCurrency}>`.    |
| `apps/web/src/components/notifications/NotificationList.tsx`          | `/api/notifications/:id/read`  | fetch PUT on row click                                 | VERIFIED | `fetch(\`/api/notifications/${notification.id}/read\`, { method: 'PUT' })`in`handleNotificationClick`.                                |
| `apps/api/src/index.ts`                                               | `notificationsRouter`          | `app.route` mount                                      | VERIFIED | `app.route('/api/notifications', notificationsRouter)` on line 89.                                                                    |
| `apps/web/src/components/DashboardNav.tsx`                            | `NotificationBell`             | rendered with ml-auto, SSR unread count + list         | VERIFIED | DashboardNav accepts `unreadCount + notifications` props, renders `<NotificationBell>` with `ml-auto` wrapper.                        |
| `apps/api/src/index.ts`                                               | `runCron`                      | scheduled handler in Module Worker export              | VERIFIED | `export default { fetch: app.fetch, async scheduled(...) { ctx.waitUntil(runCron(env)); } }`. `export default app` no longer present. |
| `apps/api/src/services/cron-service.ts`                               | `createNotificationService`    | create() for INCOME_REMINDER + PENDING_INCOME_DUE rows | VERIFIED | Both reminder and pending-due paths call `notifSvc.create(...)` with the correct type.                                                |
| `apps/api/src/services/cron-service.ts`                               | `incomes.pendingDueNotifiedAt` | isNull dedup guard + stamp after insert                | VERIFIED | `isNull(incomes.pendingDueNotifiedAt)` in WHERE; `db.update(incomes).set({ pendingDueNotifiedAt: ... })` after insert.                |

### Data-Flow Trace (Level 4)

| Artifact                                         | Data Variable                  | Source                                                                                                                | Produces Real Data                           | Status  |
| ------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------- |
| `settings/page.tsx`                              | `settings`                     | `apiFetch<{ data: UserSettings }>('/api/settings')` → `settings-service.getSettings(userId)` → DB `select from users` | Yes — Drizzle select from users table        | FLOWING |
| `DashboardNav.tsx` (unreadCount + notifications) | `unreadCount`, `notifications` | `layout.tsx` `apiFetch` → `notificationsRouter` → `createNotificationService` → DB queries                            | Yes — Drizzle queries on notifications table | FLOWING |
| `CurrencyProvider.tsx`                           | `currency`                     | `layout.tsx` SSR fetch `/api/settings` → `users.displayCurrency`                                                      | Yes — real DB column, PHP fallback on error  | FLOWING |

### Behavioral Spot-Checks

| Behavior                                                      | Command                                                                                               | Result                            | Status |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------- | ------ |
| Phase-06 test suites (settings, notifications, cron)          | `cd apps/api && npx vitest run tests/settings.test.ts tests/notifications.test.ts tests/cron.test.ts` | 13 passed (3 test files) in 1.57s | PASS   |
| schema.ts exports notifications                               | `grep -q "export const notifications" packages/db/src/schema.ts`                                      | Found                             | PASS   |
| cron trigger in wrangler.toml                                 | `grep -q 'crons = \["0 \* \* \* \*"\]' apps/api/wrangler.toml`                                        | Found                             | PASS   |
| scheduled export in index.ts                                  | `grep -q "scheduled" apps/api/src/index.ts`                                                           | Found (line 110)                  | PASS   |
| No @date-fns/tz import in apps/api                            | `grep -r "@date-fns/tz" apps/api/src/`                                                                | No output                         | PASS   |
| Module Worker default export (no longer `export default app`) | `grep -q "export default app" apps/api/src/index.ts`                                                  | No match (line does not exist)    | PASS   |

### Requirements Coverage

| Requirement | Source Plan  | Description                                         | Status    | Evidence                                                                                                               |
| ----------- | ------------ | --------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| SET-01      | 06-01, 06-02 | User can select their display currency              | SATISFIED | `CURRENCY_LOCALES` (8 codes), `CurrencyProvider`, 9 client-component conversions, settings service + UI                |
| SET-02      | 06-01, 06-02 | User can configure their income reminder schedule   | SATISFIED | `updateSettingsSchema` (DAILY/WEEKLY/MONTHLY + day + hour), SettingsForm conditional fields, settings service persists |
| NOTIF-01    | 06-01, 06-03 | In-app notification center with read/unread states  | SATISFIED | NotificationBell + NotificationList, unread badge + highlighting, mark-as-read + mark-all-read, 4/4 tests pass         |
| NOTIF-02    | 06-01, 06-04 | Scheduled reminder emails via Workers cron + Resend | SATISFIED | `sendIncomeReminderEmail`, `runCron`, Module Worker scheduled export, hourly cron trigger, 4/4 cron tests pass         |

All 4 declared requirement IDs (SET-01, SET-02, NOTIF-01, NOTIF-02) are covered by plans and verified in the codebase. All 4 Phase 6 requirements have `Phase 6` in REQUIREMENTS.md traceability. No orphaned requirements.

### Anti-Patterns Found

| File                                        | Line  | Pattern                                                                                                                                                 | Severity | Impact                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/schemas/notifications.ts`     | 5     | `z.coerce.boolean()` coerces any non-empty string to `true` — `?unreadOnly=false` parses as `true` (CR-01 from REVIEW.md)                               | WARNING  | The current web UI never passes `?unreadOnly=false` explicitly (layout fetches without the param; NotificationList has no unreadOnly call site), so the bug does not affect any observable success criterion today. A direct API client or future UI change that passes the param explicitly would get the wrong filter. |
| `apps/api/src/lib/email.ts`                 | 67    | Unescaped `${name}` interpolated into HTML email body (WR-01 from REVIEW.md)                                                                            | WARNING  | Single-user app limits blast radius. The name field accepts HTML characters. React auto-escapes in-app rendering; the email body is raw HTML sent to Resend.                                                                                                                                                             |
| `apps/api/src/services/settings-service.ts` | 58    | Empty PUT body `{}` passes validation and reaches `db.update(users).set({})` — Drizzle throws "No values to set" → unhandled 500 (WR-02 from REVIEW.md) | WARNING  | Edge case; the SettingsForm always sends all fields. Direct API callers or fuzzers would see a 500.                                                                                                                                                                                                                      |
| `apps/api/src/services/cron-service.ts`     | 80–86 | Dead day-31 clamp — schema caps `reminderDayOfMonth` at 28 so `lastDayOfMonth` clamp never fires (WR-04 from REVIEW.md)                                 | INFO     | No runtime impact; dead code / contradictory intent between schema cap and clamp helper.                                                                                                                                                                                                                                 |

**Debt marker check:** No `TBD`, `FIXME`, or `XXX` markers found in phase-06 modified files.

### Human Verification Required

#### 1. Currency selection app-wide rendering

**Test:** Log in as the seeded UAT user. Navigate to /settings, change Display Currency from PHP to USD, click Save Settings. Then navigate to Income, Expenses, Profit First, and Wallets pages.
**Expected:** All monetary values render with `$` prefix and en-US number formatting. The Settings page reloads showing USD as the selected currency.
**Why human:** CurrencyProvider is a React context seeded by SSR. The grep verifies the wiring exists (layout fetches settings, wraps children in provider, client components call `useFormatCurrency()`), but whether formatting actually changes at runtime across all pages requires a browser session.

#### 2. Notification bell interaction

**Test:** Insert a test row into the local D1 `notifications` table with `user_id` = the seeded user's id, `read = 0`. Reload any dashboard page. Open the notification bell.
**Expected:** Bell badge shows count 1. Dropdown renders the notification with unread styling (highlighted row + dot indicator). Clicking the row: (a) the row visually changes to read styling, (b) `PUT /api/notifications/:id/read` fires, (c) router navigates to the notification's `link`. Reloading clears the badge.
**Why human:** Optimistic UI updates, dropdown behavior, and navigation require browser interaction. The test suite tests the service layer directly, not the component lifecycle.

#### 3. Income reminder cron end-to-end

**Test:** In local settings for the seeded user, set `reminderEnabled = true`, `reminderFrequency = 'DAILY'`, `reminderHour` = the current Manila hour (UTC+8). Start the API dev server (`wrangler dev`). Run `curl "http://localhost:8793/cdn-cgi/handler/scheduled"`.
**Expected:** The Resend sandbox receives an email with subject 'Profitmuna: Time to log your income' to the user's address. A new `INCOME_REMINDER` row appears in the `notifications` table.
**Why human:** The Workers `scheduled` export only fires in the Wrangler runtime. The test suite mocks Resend — only the live runtime confirms the Module Worker form + waitUntil + Resend SDK integration works end-to-end.

#### 4. Pending income due notification + dedup

**Test:** Insert a PENDING income with `expectedReleaseDate = today's Manila date` and `pendingDueNotifiedAt = NULL`. Trigger the cron twice.
**Expected:** First trigger: one `PENDING_INCOME_DUE` notification created; no email sent; `pendingDueNotifiedAt` stamped on the income row. Second trigger: no duplicate notification created. If the user has a non-PHP display currency, the notification message uses their currency symbol and locale.
**Why human:** Requires live D1 write-back confirmation. The in-memory SQLite test shim passes, but the stamp-and-requery flow against real D1 should be validated once.

---

### Gaps Summary

No automated gaps were found. All 10 must-haves are verified in the codebase. The 4 items above require human testing because they involve browser-rendered UI (currency context, notification dropdown, optimistic updates) and the Workers cron runtime (live Resend, scheduled export, D1 write-back). These are the phase's inherently unautomatable behavioral checks.

The CR-01 bug (`z.coerce.boolean()` on `unreadOnly`) is a real defect documented in REVIEW.md but does not break any current success criterion — the web UI never passes `?unreadOnly=false` explicitly. It is captured as a WARNING above. If a client ever needs to filter to unread-only via the query param, this must be fixed first.

---

_Verified: 2026-06-07T15:45:00Z_
_Verifier: Claude (gsd-verifier)_
