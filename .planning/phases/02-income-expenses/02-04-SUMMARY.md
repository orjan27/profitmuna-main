---
phase: 02-income-expenses
plan: 04
subsystem: api, ui
tags: [drizzle, hono, zod, nextjs, shadcn, server-actions, categories]

# Dependency graph
requires:
  - phase: 02-income-expenses/02-01
    provides: incomeCategories and expenseCategories tables with unique(userId,name) index
  - phase: 02-income-expenses/02-02
    provides: income forms, overview, and income-actions pattern
  - phase: 02-income-expenses/02-03
    provides: expense forms, overview, and expense-actions pattern
provides:
  - Income + expense category services (seed/create/rename-cascade/delete-block-in-use/system-protection)
  - incomeCategoriesRouter and expenseCategoriesRouter (GET/POST/PUT/:id/DELETE/:id)
  - ManageCategoriesDialog for income and expenses (system protection, inline rename, block-in-use errors)
  - category-actions.ts server actions for income and expenses
  - quick-add "+ new category" affordance in income-form and expense-form
  - 22 passing unit tests covering all category service behaviors
affects: [03-profit-first-allocation, 04-wallets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Lazy idempotent seeding with onConflictDoNothing on unique(userId,name) index
    - Cascade rename via Promise.all updating both category name and denormalized categoryName on record rows
    - Block-delete-in-use via COUNT query before deletion; 400 category_in_use on positive count
    - System-category protection by reading the row first and throwing 400 for system=true rows
    - Server action returning { data } | { error: code } pattern; client maps error codes to toast messages
    - Local categories state copy in forms for immediate quick-add feedback without page reload

key-files:
  created:
    - apps/api/src/services/income-category-service.ts
    - apps/api/src/services/expense-category-service.ts
    - apps/api/src/routes/income-categories.ts
    - apps/api/src/routes/expense-categories.ts
    - apps/api/tests/income-category.test.ts
    - apps/api/tests/expense-category.test.ts
    - apps/web/src/app/income/_components/category-actions.ts
    - apps/web/src/app/income/_components/manage-categories-dialog.tsx
    - apps/web/src/app/expenses/_components/category-actions.ts
    - apps/web/src/app/expenses/_components/manage-categories-dialog.tsx
  modified:
    - apps/api/src/schemas/income.ts
    - apps/api/src/schemas/expense.ts
    - apps/web/src/app/income/_components/income-overview.tsx
    - apps/web/src/app/income/_components/income-form.tsx
    - apps/web/src/app/expenses/_components/expenses-overview.tsx
    - apps/web/src/app/expenses/_components/expense-form.tsx

key-decisions:
  - "category-actions.ts uses 'use server' and returns { error: code } so client components never import from server/api directly"
  - 'Quick-add in forms maintains local state copy of categories so new category appears and is selected immediately without RSC re-render'
  - 'Expense form switched from defaultValue to controlled value for category Select to support quick-add auto-selection'
  - 'System categories shown with (default) badge and edit/delete controls disabled (not hidden) for transparency'
  - 'IDOR protection: every category-service method scopes queries by userId; cross-user access returns 404'

patterns-established:
  - 'Pattern: Lazy idempotent seeding — list() checks for zero categories, seeds defaults with onConflictDoNothing, returns all'
  - 'Pattern: Cascade rename — Promise.all([update category name, update denormalized field on all records])'
  - 'Pattern: Block-delete-in-use — COUNT records referencing categoryId before delete; >0 throws 400 category_in_use'
  - "Pattern: Server action error codes — return { error: 'code_string' } mapped to user-facing toast messages in client"

requirements-completed: [INC-06, EXP-05]

# Metrics
duration: 45min
completed: 2026-06-06
---

# Phase 2 Plan 04: Category Management Summary

**Income and expense category services with lazy seeding, cascade rename, block-delete-in-use, system protection — wired DB to API to UI with manage-categories dialog and quick-add affordance in record forms**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-06T13:30:00Z
- **Completed:** 2026-06-06T13:57:00Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN; Task 2: UI)
- **Files modified:** 16

## Accomplishments

- Category services for income and expenses: lazy idempotent seeding of system defaults (D-01/D-02), create custom category, cascade rename updates both the category row and all denormalized `categoryName` fields on records, delete blocked when category is in use (D-12), system categories protected from edit/delete (D-13)
- 22 unit tests covering: seed idempotency, cascade rename, block-in-use, system protection, IDOR (cross-user 404)
- ManageCategoriesDialog for income and expenses: inline rename, delete with descriptive error messages, add new category, system categories shown with (default) badge and controls disabled
- Quick-add "+ new category" affordance next to the category Select in both income-form and expense-form — new category auto-selected on success without page reload
- "Manage categories" trigger added to income-overview and expenses-overview header areas
- Next.js build passes; typecheck and lint clean

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Income + expense category tests** - `d7ea3d4` (test)
2. **Task 1 GREEN: Income + expense category services and routes** - `d0b1d00` (feat)
3. **Task 2: Category management UI** - `799d5b5` (feat)

**Plan metadata:** (to be added after docs commit)

## Files Created/Modified

- `apps/api/src/services/income-category-service.ts` - Service factory with seed/create/update(cascade)/delete(block-in-use/system-protection)
- `apps/api/src/services/expense-category-service.ts` - Same surface for expenses with expense-specific defaults
- `apps/api/src/routes/income-categories.ts` - GET / POST / PUT /:id / DELETE /:id, filled from Plan-01 stub
- `apps/api/src/routes/expense-categories.ts` - Same for expenses
- `apps/api/tests/income-category.test.ts` - 11 tests: seed, cascade, block-in-use, system protection, IDOR
- `apps/api/tests/expense-category.test.ts` - 11 tests: same assertions for expenses
- `apps/api/src/schemas/income.ts` - createIncomeCategorySchema / updateIncomeCategorySchema (name only, no system field)
- `apps/api/src/schemas/expense.ts` - createExpenseCategorySchema / updateExpenseCategorySchema
- `apps/web/src/app/income/_components/category-actions.ts` - use server: createIncomeCategoryAction / renameIncomeCategoryAction / deleteIncomeCategoryAction
- `apps/web/src/app/income/_components/manage-categories-dialog.tsx` - shadcn Dialog with inline rename, delete error surface, add-new input
- `apps/web/src/app/expenses/_components/category-actions.ts` - use server: expense equivalents
- `apps/web/src/app/expenses/_components/manage-categories-dialog.tsx` - same dialog for expenses
- `apps/web/src/app/income/_components/income-overview.tsx` - added ManageCategoriesDialog trigger
- `apps/web/src/app/income/_components/income-form.tsx` - added quick-add with local state for immediate selection
- `apps/web/src/app/expenses/_components/expenses-overview.tsx` - added ManageCategoriesDialog trigger
- `apps/web/src/app/expenses/_components/expense-form.tsx` - added quick-add with local state for immediate selection

## Decisions Made

- `category-actions.ts` uses `'use server'` and returns `{ error: code }` so client components never import from `@/server/api` directly (server-only boundary rule)
- Quick-add in forms maintains a local `useState` copy of categories so the newly created category appears and is selected immediately — avoids waiting for an RSC re-render cycle
- Expense form category Select switched from `defaultValue` to controlled `value` prop to support programmatic selection after quick-add
- System categories displayed with (default) badge and disabled (not hidden) edit/delete controls — transparency over hiding controls
- IDOR: every service method includes `eq(<table>.userId, userId)` so cross-user access yields a 404

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Running `npx vitest run` from the workspace root failed due to alias resolution outside the API project root; resolved by running from `apps/api/` directory where `vitest.config.ts` lives — no code change needed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- INC-06 and EXP-05 complete across DB → API → UI
- Category seeding, cascade rename, and block-delete-in-use verified by 22 unit tests
- Phase 3 (Profit First allocation) can reference income categories via the seeded defaults
- Phase 4 (Wallets) unaffected by this plan

---

_Phase: 02-income-expenses_
_Completed: 2026-06-06_
