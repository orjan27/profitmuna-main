---
phase: 02-income-expenses
plan: 02
subsystem: api, web
tags: [hono, nextjs, zod, drizzle, nuqs, shadcn, income, tdd]

# Dependency graph
requires:
  - phase: 02-income-expenses
    plan: 01
    provides: incomes table, incomeCategories table, incomesRouter stub, requireAuth, apiFetch, formatCurrency/toCents, formatDate, NuqsAdapter, createTestDb()
provides:
  - income Zod schemas (createIncomeSchema, updateIncomeSchema, receiveIncomeSchema, incomeQuerySchema)
  - createIncomeService factory with list/create/getById/update/receive/delete (userId-scoped)
  - incomesRouter with GET/ POST/ GET/:id PUT/:id PUT/:id/receive DELETE/:id
  - /income SSR page (search + status + date filters, load-more, INC-02)
  - /income/new create form (INC-01)
  - EditIncomeDialog for in-list edits (INC-03/04)
  - ReceiveIncomeDialog for PENDING → RECEIVED transition with backdatable date (INC-05)
  - shadcn UI primitives: Select, Switch, Textarea, Dialog, Badge
affects:
  - 02-income-expenses (expenses plan builds on the service/route patterns established here)
  - 03-profit-first-allocation (RECEIVED incomes feed allocation trigger)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'TDD RED/GREEN: failing tests committed before implementation'
    - 'userId-scoped service queries — every read/write AND-scoped with eq(incomes.userId, userId)'
    - 'PUT /:id/receive registered BEFORE PUT /:id to avoid Hono param shadowing'
    - 'toCents() in server action, never in API — API treats amount as integer cents'
    - 'profitFirstAllocated default true (Switch) — receive() never mutates it (T-02-08)'
    - 'Load-more via server action returning {content, last} — no client-side fetch needed'
    - 'nuqs useQueryState for URL-persisted filters; debounced search ~300ms'
    - 'IncomeForm reused by /new page and EditIncomeDialog via action prop'

key-files:
  created:
    - apps/api/src/schemas/income.ts
    - apps/api/src/services/income-service.ts
    - apps/api/tests/income.test.ts
    - apps/web/src/types/income.ts
    - apps/web/src/app/income/page.tsx
    - apps/web/src/app/income/new/page.tsx
    - apps/web/src/app/income/new/_actions/create-income.ts
    - apps/web/src/app/income/_components/income-overview.tsx
    - apps/web/src/app/income/_components/income-list.tsx
    - apps/web/src/app/income/_components/income-filters.tsx
    - apps/web/src/app/income/_components/income-form.tsx
    - apps/web/src/app/income/_components/income-actions.ts
    - apps/web/src/app/income/_components/edit-income-dialog.tsx
    - apps/web/src/app/income/_components/receive-income-dialog.tsx
    - apps/web/src/components/ui/select.tsx
    - apps/web/src/components/ui/switch.tsx
    - apps/web/src/components/ui/textarea.tsx
    - apps/web/src/components/ui/dialog.tsx
    - apps/web/src/components/ui/badge.tsx
    - apps/web/src/app/globals.css
  modified:
    - apps/api/src/routes/incomes.ts

key-decisions:
  - 'income-actions.ts holds all server actions including fetchIncomesAction (load-more) so Task 2 and Task 3 share one server module'
  - 'Load-more uses server action returning data rather than client fetch — avoids needing a new BFF proxy route (RESEARCH Open Question 1 resolved)'
  - 'globals.css was untracked in main checkout — committed in worktree to unblock Next.js build (pre-existing gap)'
  - 'receiveIncomeAction sends receivedDate even when undefined — API uses today as default (INC-05 Pitfall 3)'

requirements-completed: [INC-01, INC-02, INC-03, INC-04, INC-05]

# Metrics
duration: ~25min
completed: 2026-06-06
---

# Phase 2 Plan 02: Income Vertical Slice Summary

**Income CRUD from DB to UI: Zod schemas, userId-scoped service, routes with /:id/receive, 13 passing unit tests (INC-01..05 + IDOR), SSR list page with nuqs URL-filters + load-more, create/edit/delete/receive dialogs — full vertical slice complete.**

## Performance

- **Duration:** ~25 min (continuation from prior agent)
- **Completed:** 2026-06-06
- **Tasks:** 3 auto + 1 checkpoint (human-verify)
- **Files created:** 20 + modified: 1

## Accomplishments

- **Task 1 (API slice / TDD):** income Zod schemas, `createIncomeService` factory with all 6 methods userId-scoped, `incomesRouter` with 6 routes in correct registration order (`/:id/receive` before `/:id`), 13 unit tests covering INC-01..05 and IDOR — all green
- **Task 2 (Browse + Create UI):** `/income` SSR page (getSession guard, apiFetch initial data), `/income/new` page + `createIncomeAction` with `toCents`, `IncomeForm` (profitFirstAllocated defaults true), `IncomeFilters` (nuqs + 300ms debounce), `IncomeList` (status badges, row actions), `IncomeOverview` (load-more via server action), 5 new shadcn UI primitives
- **Task 3 (Edit + Delete + Receive UI):** `EditIncomeDialog` (reuses IncomeForm + delete confirm), `ReceiveIncomeDialog` (backdatable date input + receiveIncomeAction), all three mutation server actions with `revalidatePath`

## Task Commits

| #        | Commit    | Description                                                                   |
| -------- | --------- | ----------------------------------------------------------------------------- |
| T1-RED   | `ccb3c00` | test(02-02): add failing tests for INC-01..05 + IDOR (RED phase)              |
| T1-GREEN | `923ca37` | feat(02-02): implement income Zod schemas, service, and routes (GREEN phase)  |
| T2       | `f4aef3a` | feat(02-02): income record + browse UI (page, form, list, filters, load-more) |
| T3       | `b1097f2` | feat(02-02): edit + delete + receive income dialogs (INC-03/04/05 UI)         |
| fix      | `f0f5f70` | fix(02-02): add globals.css to worktree so Next.js build succeeds             |

## Files Created/Modified

### API

- `apps/api/src/schemas/income.ts` — createIncomeSchema, updateIncomeSchema, receiveIncomeSchema, incomeQuerySchema
- `apps/api/src/services/income-service.ts` — createIncomeService factory; every query scoped with `eq(incomes.userId, userId)`
- `apps/api/src/routes/incomes.ts` — 6 handlers; PUT /:id/receive registered before PUT /:id
- `apps/api/tests/income.test.ts` — 13 tests: INC-01..05 + IDOR cross-user 404

### Web

- `apps/web/src/types/income.ts` — Income, IncomeCategory, IncomeListResponse, IncomeCategoryListResponse
- `apps/web/src/app/income/page.tsx` — RSC page with getSession + apiFetch initial data
- `apps/web/src/app/income/new/page.tsx` — RSC page, fetches categories
- `apps/web/src/app/income/new/_actions/create-income.ts` — server action with toCents + revalidatePath
- `apps/web/src/app/income/_components/income-overview.tsx` — load-more accumulator, filter wiring, dialog open state
- `apps/web/src/app/income/_components/income-list.tsx` — row render, edit/receive handlers, empty state
- `apps/web/src/app/income/_components/income-filters.tsx` — nuqs useQueryState, debounced search
- `apps/web/src/app/income/_components/income-form.tsx` — reusable form (create + edit), profitFirstAllocated Switch defaults true
- `apps/web/src/app/income/_components/income-actions.ts` — fetchIncomesAction, updateIncomeAction, deleteIncomeAction, receiveIncomeAction
- `apps/web/src/app/income/_components/edit-income-dialog.tsx` — edit form + delete confirm
- `apps/web/src/app/income/_components/receive-income-dialog.tsx` — backdatable date input + confirm
- `apps/web/src/components/ui/{select,switch,textarea,dialog,badge}.tsx` — shadcn primitives
- `apps/web/src/app/globals.css` — Tailwind CSS theme (was untracked in main)

## Decisions Made

- `income-actions.ts` was created in Task 2 (not Task 3 as originally sequenced) because `IncomeOverview` imports `fetchIncomesAction` for load-more — all server actions consolidated in one module
- Load-more uses a server action (`fetchIncomesAction`) returning `{ content, last }` rather than a client-side fetch, avoiding the need for a BFF proxy extension (RESEARCH Open Question 1)
- `globals.css` committed from main checkout's untracked files — pre-existing gap unblocked the Next.js build

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] globals.css missing from worktree**

- **Found during:** Post-task web build verification
- **Issue:** `apps/web/src/app/globals.css` existed in main checkout as an untracked file but was not committed, so the worktree lacked it and `next build` failed with `Module not found: Can't resolve './globals.css'`
- **Fix:** Copied the file from the main checkout into the worktree and committed it
- **Files modified:** `apps/web/src/app/globals.css`
- **Commit:** `f0f5f70`

**2. [Rule 2 - Missing Critical] income-actions.ts created in Task 2 scope**

- **Found during:** Building IncomeOverview (Task 2)
- **Issue:** The plan placed `income-actions.ts` in Task 3, but `IncomeOverview` (Task 2) imports `fetchIncomesAction` for load-more. Creating it in Task 3 would break Task 2's typecheck
- **Fix:** Created `income-actions.ts` with all 4 server actions (including the load-more fetch) during Task 2. Task 3 then only needed to create dialog components
- **Impact:** No scope change — all planned exports are present; only commit sequencing differs

## Threat Surface Scan

All threat mitigations from the plan's `<threat_model>` are implemented:

| Threat                      | Mitigation                                                              | Verified                                                  |
| --------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| T-02-05 IDOR                | Every service query `AND eq(incomes.userId, userId)`                    | 13 unit tests including IDOR test                         |
| T-02-06 Negative amount     | Zod `amount.positive()` + `toCents()` in server action                  | Schema + action                                           |
| T-02-07 Category ownership  | `resolveCategoryName` validates `(categoryId, userId)`                  | Service create + update                                   |
| T-02-08 Receive mass-assign | `receive()` only sets moneyStatus + receivedDate                        | Code + INC-05 test asserts profitFirstAllocated unchanged |
| T-02-09 Unauth access       | `/api/incomes/*` behind requireAuth; `/income` page getSession→redirect | Middleware + page guard                                   |

No new threat surface introduced beyond what the plan accounted for.

## Known Stubs

None — all data sources are wired. The income list page fetches real data via apiFetch; the load-more calls the real API via server action.

## Self-Check: PASSED

- `apps/api/src/schemas/income.ts` — FOUND, exports createIncomeSchema, updateIncomeSchema, receiveIncomeSchema, incomeQuerySchema
- `apps/api/src/services/income-service.ts` — FOUND, exports createIncomeService; contains `eq(incomes.userId`
- `apps/api/src/routes/incomes.ts` — FOUND, PUT /:id/receive registered before PUT /:id
- `apps/api/tests/income.test.ts` — FOUND, 13 tests all PASS
- `apps/web/src/app/income/page.tsx` — FOUND, default export async RSC with getSession + apiFetch
- `apps/web/src/app/income/new/_actions/create-income.ts` — FOUND, contains `toCents(` and `revalidatePath('/income')`
- `apps/web/src/app/income/_components/income-form.tsx` — FOUND, profitFirstAllocated defaults to true
- `apps/web/src/app/income/_components/income-filters.tsx` — FOUND, uses useQueryState from nuqs, debounces search
- `apps/web/src/app/income/_components/income-overview.tsx` — FOUND, renders Load more button, seeds items from initialData
- `apps/web/src/app/income/_components/income-actions.ts` — FOUND, exports updateIncomeAction, deleteIncomeAction, receiveIncomeAction (all call revalidatePath); receiveIncomeAction calls PUT on `/api/incomes/${id}/receive`
- `apps/web/src/app/income/_components/edit-income-dialog.tsx` — FOUND, reuses IncomeForm, has delete confirm step
- `apps/web/src/app/income/_components/receive-income-dialog.tsx` — FOUND, date input defaults today, calls receiveIncomeAction
- Next.js build: PASS (`/income` and `/income/new` present in build output)
- API typecheck: PASS
- Web typecheck: PASS
- ESLint: PASS
- Commits: `ccb3c00`, `923ca37`, `f4aef3a`, `b1097f2`, `f0f5f70` — all in git log
