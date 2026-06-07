---
phase: '06-settings-notifications'
plan: '02'
subsystem: 'settings-ui + api + currency-context'
tags: ['settings', 'currency', 'notifications', 'context', 'bff', 'ssr', 'SET-01', 'SET-02']
dependency_graph:
  requires:
    - '06-01 (schema, types, format-currency, RED test scaffolds)'
  provides:
    - 'GET /api/settings and PUT /api/settings behind requireAuth'
    - 'settings-service: getSettings/updateSettings scoped by userId'
    - 'BFF proxy at /api/settings/[...path]'
    - 'SSR settings page at /settings with SettingsForm client component'
    - 'CurrencyProvider context driving formatCurrency across all client components'
    - 'Settings nav link in DashboardNav'
  affects:
    - 'apps/api/src/schemas/settings.ts'
    - 'apps/api/src/services/settings-service.ts'
    - 'apps/api/src/routes/settings.ts'
    - 'apps/api/src/index.ts'
    - 'apps/web/src/components/CurrencyProvider.tsx'
    - 'apps/web/src/app/(dashboard)/layout.tsx'
    - 'apps/web/src/components/DashboardNav.tsx'
    - 'apps/web/src/app/(dashboard)/settings/* (new)'
    - 'apps/web/src/app/api/settings/[...path]/route.ts (new)'
    - 'All client-component formatCurrency consumers (converted)'
tech_stack:
  added: []
  patterns:
    - 'React context for user currency preference (CurrencyProvider + useFormatCurrency hook)'
    - 'SSR settings hydration: layout.tsx fetches /api/settings server-side with PHP fallback'
    - 'TDD: settings tests went RED to GREEN by implementing settings-service'
    - 'BFF proxy pattern: Next.js /api/settings/[...path] to Hono /api/settings/'
    - 'Zod schema with day-of-month max 28 (Pitfall 6 mitigation)'
key_files:
  created:
    - 'apps/api/src/schemas/settings.ts'
    - 'apps/api/src/services/settings-service.ts'
    - 'apps/api/src/routes/settings.ts'
    - 'apps/web/src/app/api/settings/[...path]/route.ts'
    - 'apps/web/src/app/(dashboard)/settings/page.tsx'
    - 'apps/web/src/app/(dashboard)/settings/_components/settings-form.tsx'
    - 'apps/web/src/components/CurrencyProvider.tsx'
  modified:
    - 'apps/api/src/index.ts (mount settingsRouter)'
    - 'apps/web/src/app/(dashboard)/layout.tsx (CurrencyProvider + SSR settings fetch)'
    - 'apps/web/src/components/DashboardNav.tsx (Settings nav link)'
    - 'apps/web/src/app/(dashboard)/income/_components/income-list.tsx'
    - 'apps/web/src/app/(dashboard)/income/_components/income-overview.tsx'
    - 'apps/web/src/app/(dashboard)/income/_components/receive-income-dialog.tsx'
    - 'apps/web/src/app/(dashboard)/expenses/_components/expense-list.tsx'
    - 'apps/web/src/app/(dashboard)/expenses/_components/expenses-overview.tsx'
    - 'apps/web/src/components/amount-visibility.tsx'
    - 'apps/web/src/app/(dashboard)/wallets/_components/WalletRow.tsx'
    - 'apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx'
    - 'apps/web/src/components/RecordSheet.tsx'
    - 'apps/web/src/app/(dashboard)/wallets/page.tsx'
decisions:
  - >-
    createSettingsService accepts { DB: D1Database } (raw binding) not a Drizzle
    instance to match the test helper pattern and avoid requiring a full Hono
    context in tests
  - >-
    wallets/page.tsx is a Server Component and cannot use React hooks; it fetches
    displayCurrency from /api/settings SSR and passes explicitly to formatCurrency()
  - >-
    RecordSheet.tsx and WalletDetail.tsx keep their toCents import from
    format-currency; the formatCurrency function is now consumed via useFormatCurrency
  - >-
    WalletCard.tsx referenced in plan does not exist; actual file is WalletRow.tsx;
    converted WalletRow.tsx instead
  - >-
    RecordSheet.tsx was not in plan's list of 9 but uses formatCurrency in client
    sub-components; added conversion as Rule 2 deviation for currency consistency
metrics:
  duration: '15 minutes'
  completed_date: '2026-06-07'
  tasks_completed: 3
  files_changed: 19
---

# Phase 6 Plan 02: Settings Vertical Slice (SET-01, SET-02) Summary

Full settings vertical slice: Zod schema + service + router on the API, BFF proxy + SSR page + client form on the web, and layout-level CurrencyProvider driving formatCurrency app-wide.

## What Was Built

### Task 1: Settings Zod schema + service + router (GREEN)

Implemented the API layer for settings:

- **`apps/api/src/schemas/settings.ts`**: `updateSettingsSchema` with 8 currency codes, frequency enum (DAILY/WEEKLY/MONTHLY), `reminderDayOfMonth` capped at max 28 (Pitfall 6 mitigation), `reminderHour` 0-23.

- **`apps/api/src/services/settings-service.ts`**: `createSettingsService({ DB: D1Database })` factory. `getSettings(userId)` selects the 6 settings columns scoped by `eq(users.id, userId)`; throws `HTTPException(404)` if no row. `updateSettings(userId, input)` updates then returns fresh settings — ownership-scoped, IDOR impossible (T-6-03).

- **`apps/api/src/routes/settings.ts`**: `settingsRouter` with `.use('/*', requireAuth)` at router level. `GET /` returns `{ data: settings }`. `PUT /` validates with `zValidator` (422 on failure) then updates and returns `{ data: settings }`.

- **`apps/api/src/index.ts`**: Added `app.route('/api/settings', settingsRouter)` next to the wallets mount.

All 5 settings tests (SET-01 + SET-02 behaviors) turned GREEN.

### Task 2: BFF proxy + SSR settings page + client SettingsForm

- **`apps/web/src/app/api/settings/[...path]/route.ts`**: BFF catch-all proxy; forwards to `/api/settings/`; exports GET + PUT only.

- **`apps/web/src/app/(dashboard)/settings/page.tsx`**: Server Component using `apiFetch`. Renders heading and `<SettingsForm initialSettings={data} />` inside `max-w-2xl`.

- **`apps/web/src/app/(dashboard)/settings/_components/settings-form.tsx`**: Client component with two card sections. Card 1 "Display Currency": 8-option Select. Card 2 "Income Reminders": Switch toggle; when ON shows Frequency Select, conditional Day of Week (WEEKLY), conditional Day of Month 1-28 (MONTHLY) with help text, and Hour Select (24 entries 12-hour AM/PM). "Save Settings" button fires success/error toasts and `router.refresh()`. Reminder fields not mounted when switch is off.

### Task 3: CurrencyProvider + layout + Settings nav (SET-01 app-wide)

- **`apps/web/src/components/CurrencyProvider.tsx`**: React context with default 'PHP'. `CurrencyProvider` wraps children. `useCurrency()` returns current code. `useFormatCurrency()` returns a bound formatter.

- **`apps/web/src/app/(dashboard)/layout.tsx`**: Now async Server Component. Fetches `/api/settings` SSR with try/catch PHP fallback. Wraps children in `<CurrencyProvider currency={displayCurrency}>`.

- **`apps/web/src/components/DashboardNav.tsx`**: Added Settings link to NAV_ITEMS.

- **Client component conversions**: All client-component formatCurrency consumers converted to `useFormatCurrency()`:
  1. income-list.tsx
  2. income-overview.tsx
  3. receive-income-dialog.tsx
  4. expense-list.tsx (both DeletedExpenseRow + ActiveExpenseRow)
  5. expenses-overview.tsx
  6. amount-visibility.tsx (MaskedAmount)
  7. WalletRow.tsx (plan listed WalletCard.tsx — actual file is WalletRow.tsx)
  8. WalletDetail.tsx (DeleteTxDialog + WalletDetail)
  9. RecordSheet.tsx (SplitPreview + IncomeEntryForm + ExpenseEntryForm — Rule 2 addition)

- **`apps/web/src/app/(dashboard)/wallets/page.tsx`**: Server Component; fetches displayCurrency SSR and passes explicitly to formatCurrency().

## Commits

| Hash      | Type | Description                                                          |
| --------- | ---- | -------------------------------------------------------------------- |
| `0c2d0ec` | feat | Add settings Zod schema, service, and router (GREEN)                 |
| `4b91282` | feat | Add settings BFF proxy, SSR page, and SettingsForm                   |
| `b9a35f1` | feat | Wire CurrencyProvider into layout + convert formatCurrency consumers |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WalletCard.tsx does not exist — converted WalletRow.tsx instead**

- **Found during:** Task 3
- **Issue:** Plan listed WalletCard.tsx but actual file is WalletRow.tsx.
- **Fix:** Applied useFormatCurrency() conversion to WalletRow.tsx instead.
- **Files modified:** apps/web/src/app/(dashboard)/wallets/\_components/WalletRow.tsx
- **Commit:** b9a35f1

**2. [Rule 2 - Missing Critical Functionality] RecordSheet.tsx added to conversion list**

- **Found during:** Task 3 verify grep
- **Issue:** RecordSheet.tsx is a client component with 4 formatCurrency() calls. Omitting it would leave record amounts unconverted.
- **Fix:** Added useFormatCurrency() to SplitPreview, IncomeEntryForm, and ExpenseEntryForm.
- **Files modified:** apps/web/src/components/RecordSheet.tsx
- **Commit:** b9a35f1

**3. [Deviation Note] pf-overview.tsx does not use formatCurrency**

- **Found during:** Task 3 — no action needed; the file has no formatCurrency call.

**4. [Deviation Note] wallets/page.tsx is a Server Component**

- **Found during:** Task 3
- **Fix:** Added SSR settings fetch with displayCurrency passed explicitly to formatCurrency().

## Known Stubs

None. All settings are persisted to the database; currency selection drives actual formatting. The reminder schedule is stored and will be consumed by Plan 04's cron handler.

## Threat Flags

No new trust boundaries beyond the plan's threat model. T-6-03 and T-6-04 implemented as planned.

## Self-Check: PASSED

- apps/api/src/schemas/settings.ts — FOUND
- apps/api/src/services/settings-service.ts contains createSettingsService — FOUND
- apps/api/src/routes/settings.ts exports settingsRouter — FOUND
- apps/api/src/index.ts contains app.route('/api/settings', settingsRouter) — FOUND
- apps/web/src/app/api/settings/[...path]/route.ts — FOUND
- apps/web/src/app/(dashboard)/settings/page.tsx — FOUND
- apps/web/src/app/(dashboard)/settings/\_components/settings-form.tsx — FOUND
- apps/web/src/components/CurrencyProvider.tsx exports CurrencyProvider, useCurrency, useFormatCurrency — FOUND
- DashboardNav contains /settings link — FOUND
- apps/web/src/app/(dashboard)/layout.tsx contains CurrencyProvider — FOUND
- Commits 0c2d0ec, 4b91282, b9a35f1 — FOUND in git log
- npm run test (settings): 5 tests PASSED (GREEN)
- npx tsc -b apps/api/tsconfig.json: 0 errors
- npx tsc -b apps/web/tsconfig.json: 0 errors
- npm run lint: PASSED
- No client component imports raw formatCurrency from format-currency — VERIFIED
