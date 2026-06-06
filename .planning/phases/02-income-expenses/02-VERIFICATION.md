---
phase: 02-income-expenses
verified: 2026-06-06T21:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: 'Income CRUD end-to-end flow'
    expected: 'User can record, browse (with search/status/date filters + load-more), edit, delete, and mark PENDING income RECEIVED with a backdated date. Amounts display as ₱ with correct cent conversion.'
    why_human: 'Visual rendering, form interaction, filter state reset, load-more append behavior, dialog open/close, and toast feedback cannot be verified by grep.'
  - test: 'Expense CRUD end-to-end flow'
    expected: 'User can record an expense with payment method, browse with date-range filter + load-more, edit, soft-delete (disappears from totals), and restore (returns to totals). Totals header shows only active expenses.'
    why_human: 'Soft-delete visual indicator, restore UX, totals re-computation, and date-filter interactions require a running browser session.'
  - test: 'Income category management'
    expected: 'Default categories (Salary, Freelance, Business, Gifts, Other) appear on first /income visit. User can add a custom category, rename it (existing records reflect new name), and delete it when unused. System categories show no edit/delete controls. In-use categories show a clear error.'
    why_human: 'First-access seeding, cascade rename reflecting in the list, and error toasts require browser verification.'
  - test: 'Expense category management'
    expected: "Default categories (Housing, Food, Transportation, Utilities, Healthcare, Entertainment, Other) appear on first /expenses visit. Same create/rename/delete/protect behavior as income categories. 'None' payment method option works correctly."
    why_human: 'Same reasons as income category management.'
  - test: 'Quick-add category affordance in both forms'
    expected: 'Clicking + next to the category select in both /income/new and /expenses/new opens an inline input; submitting creates the category and selects it immediately without a page reload.'
    why_human: 'Optimistic local-state update and selection behavior require browser interaction.'
---

# Phase 2: Income & Expenses Verification Report

**Phase Goal:** Users can record, browse, edit, and delete income and expense entries with customizable categories
**Verified:** 2026-06-06T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Context

A code review (02-REVIEW.md, `status: fixed`) ran before this verification. All 5 Critical and 9 Warning findings were fixed in commits 0cde93f..f0ccfe6. This verification is against HEAD after those fixes.

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #    | Truth                                                                                                                                                        | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-1 | User can record income with category, amount, date, description, and PENDING/RECEIVED status; PENDING income can be marked RECEIVED, setting a received date | ✓ VERIFIED | `income-service.ts` `create()` inserts all fields; `receive()` sets `moneyStatus='RECEIVED'` + `receivedDate`; `income-form.tsx` renders all fields; `create-income.ts` is `'use server'` with `toCents`; `receive-income-dialog.tsx` calls `receiveIncomeAction`; 13 tests pass for INC-01..05                                                                                                                                               |
| SC-2 | User can browse a paginated income list with search and filters (status, date range) and edit or delete individual records                                   | ✓ VERIFIED | `income-service.ts` `list()` implements search (LIKE), moneyStatus, from/to filters; `income-overview.tsx` holds accumulated state + load-more; `income-filters.tsx` uses `nuqs useQueryState` with 300ms debounce; `edit-income-dialog.tsx` exists; `deleteIncomeAction` calls `DELETE /api/incomes/:id`; `income-list.tsx` renders rows with edit trigger                                                                                   |
| SC-3 | User can record an expense with category, amount, date, payment method, and description; soft-deleted expenses excluded from totals but restorable           | ✓ VERIFIED | `expense-service.ts` `create()` with nullable `paymentMethod`; `delete()` sets `deletedAt`; `totalActive()` uses `isNull(expenses.deletedAt)`; `expenses-overview.tsx` filters `e.deletedAt === null` for totals; `expense-list.tsx` shows `DeletedExpenseRow` with `RotateCcw` restore button; 17 expense tests pass                                                                                                                         |
| SC-4 | User can browse a paginated expense list filtered by date range and edit or soft-delete records                                                              | ✓ VERIFIED | `expense-service.ts` `list()` filters by `from`/`to` date range; `expenses-overview.tsx` has date-range filter with `useQueryState`; load-more appends pages; `edit-expense-dialog.tsx` exists; soft-delete via `deleteExpenseAction` → `DELETE /api/expenses/:id`                                                                                                                                                                            |
| SC-5 | User can manage income and expense categories — create, edit, delete custom; system defaults protected                                                       | ✓ VERIFIED | `income-category-service.ts` and `expense-category-service.ts`: seeding with `onConflictDoNothing`; `create()` with 409 `category_exists`; `update()` with atomic `db.batch` cascade rename; `delete()` with `category_in_use` block and `cannot_delete_system_category` protection; `manage-categories-dialog.tsx` (both) disables edit/delete on system rows and surfaces error toasts; 12 income-category + 13 expense-category tests pass |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                                             | Status              | Evidence                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/schema.ts`                                          | ✓ VERIFIED          | Exports `incomeCategories`, `incomes`, `expenseCategories`, `expenses`; `profitFirstAllocated` default `true`; `deletedAt` nullable text; `paymentMethod` nullable text; unique indexes on `(userId, name)`                                                                                                             |
| `packages/db/migrations/0001_serious_sebastian_shaw.sql`             | ✓ VERIFIED          | Contains `CREATE TABLE \`incomes\``and`CREATE TABLE \`expenses\`` with all required columns and indexes                                                                                                                                                                                                                 |
| `apps/api/src/index.ts`                                              | ✓ VERIFIED          | `allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']`; all four routers mounted behind `requireAuth` at correct paths                                                                                                                                                                                               |
| `apps/api/src/schemas/income.ts`                                     | ✓ VERIFIED          | Exports `createIncomeSchema` (`amount: z.number().int().positive()`), `updateIncomeSchema`, `receiveIncomeSchema`, `incomeQuerySchema`, `createIncomeCategorySchema`, `updateIncomeCategorySchema`; no `system` field in category schemas                                                                               |
| `apps/api/src/schemas/expense.ts`                                    | ✓ VERIFIED          | Exports `createExpenseSchema`, `updateExpenseSchema`, `expenseQuerySchema`, `createExpenseCategorySchema`, `updateExpenseCategorySchema`; `paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional().nullable()`                                                                                                          |
| `apps/api/src/schemas/common.ts`                                     | ✓ VERIFIED          | Exports `paginationSchema`, `paginationWithDateSchema`, `idParamSchema`                                                                                                                                                                                                                                                 |
| `apps/api/src/services/income-service.ts`                            | ✓ VERIFIED          | Exports `createIncomeService`; all queries carry `eq(incomes.userId, userId)`; `receive()` does not write `profitFirstAllocated`; `limit+1` look-ahead pagination                                                                                                                                                       |
| `apps/api/src/services/expense-service.ts`                           | ✓ VERIFIED          | Exports `createExpenseService`; `delete()` sets `deletedAt`; `restore()` clears `deletedAt` and rejects already-active rows (409); `totalActive()` uses `isNull`; soft-deleted rows block `update()` (409 `expense_deleted`)                                                                                            |
| `apps/api/src/services/income-category-service.ts`                   | ✓ VERIFIED          | Exports `createIncomeCategoryService`; `DEFAULT_INCOME_CATEGORIES = ['Salary','Freelance','Business','Gifts','Other']`; `onConflictDoNothing` seeding; `db.batch` cascade rename; in-use block; system protection                                                                                                       |
| `apps/api/src/services/expense-category-service.ts`                  | ✓ VERIFIED          | Exports `createExpenseCategoryService`; `DEFAULT_EXPENSE_CATEGORIES = ['Housing','Food','Transportation','Utilities','Healthcare','Entertainment','Other']`; same pattern as income; in-use check uses `isNull(expenses.deletedAt)` (CR-04 fix); category delete purges soft-deleted expenses in same batch (CR-05 fix) |
| `apps/api/src/routes/incomes.ts`                                     | ✓ VERIFIED          | Registers `PUT /:id/receive` before `PUT /:id`; all `:id` routes use `idParamSchema` (WR-01 fix); exports `incomesRouter`                                                                                                                                                                                               |
| `apps/api/src/routes/expenses.ts`                                    | ✓ VERIFIED          | Registers `PATCH /:id/restore` before `/:id`; exports `expensesRouter`                                                                                                                                                                                                                                                  |
| `apps/api/src/routes/income-categories.ts`                           | ✓ VERIFIED          | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`; exports `incomeCategoriesRouter`                                                                                                                                                                                                                                          |
| `apps/api/src/routes/expense-categories.ts`                          | ✓ VERIFIED          | Same surface; exports `expenseCategoriesRouter`                                                                                                                                                                                                                                                                         |
| `apps/api/tests/income.test.ts`                                      | ✓ VERIFIED          | 13 tests pass: INC-01..05, IDOR 404, `receive()` leaves `profitFirstAllocated` unchanged                                                                                                                                                                                                                                |
| `apps/api/tests/expense.test.ts`                                     | ✓ VERIFIED          | 17 tests pass: EXP-01..04, soft-delete/restore, totals, IDOR, payment method enum validation                                                                                                                                                                                                                            |
| `apps/api/tests/income-category.test.ts`                             | ✓ VERIFIED          | 12 tests pass: seeding, create, cascade rename, block-in-use, system protection, IDOR                                                                                                                                                                                                                                   |
| `apps/api/tests/expense-category.test.ts`                            | ✓ VERIFIED          | 13 tests pass: seeding, create, cascade rename, block-in-use (isNull filter), allow-delete-when-all-soft-deleted, system protection, IDOR                                                                                                                                                                               |
| `apps/api/tests/helpers/db.ts`                                       | ✓ VERIFIED          | Exports `createTestDb()`; DDL includes all 4 Phase-2 tables; exposes `dbD1` (D1-driver drizzle) for `db.batch` support in services                                                                                                                                                                                      |
| `apps/web/src/server/api.ts`                                         | ✓ VERIFIED          | Starts with `import 'server-only'`; exports `apiFetch` and `ApiError`; uses `await cookies()`, sets `Authorization: Bearer` header                                                                                                                                                                                      |
| `apps/web/src/lib/format-currency.ts`                                | ✓ VERIFIED          | Exports `formatCurrency` (returns `₱...`) and `toCents`                                                                                                                                                                                                                                                                 |
| `apps/web/src/lib/format-date.ts`                                    | ✓ VERIFIED          | `formatDate` parses `YYYY-MM-DD` with `parse(iso, 'yyyy-MM-dd', new Date())` in local time (WR-03 fix)                                                                                                                                                                                                                  |
| `apps/web/src/lib/constants.ts`                                      | ✓ VERIFIED          | Exports `PAYMENT_METHODS` with exactly 5 values (cash, gcash, bank_transfer, maya, check) and `PaymentMethodValue`                                                                                                                                                                                                      |
| `apps/web/src/app/layout.tsx`                                        | ✓ VERIFIED          | Imports `NuqsAdapter` from `nuqs/adapters/next/app`; wraps children                                                                                                                                                                                                                                                     |
| `apps/web/src/app/income/page.tsx`                                   | ✓ VERIFIED          | Default-export async RSC; `getSession()` guard; `apiFetch('/api/incomes...')` and `apiFetch('/api/income-categories')`; passes `categoriesData.data` (not raw object) to `<IncomeOverview>`                                                                                                                             |
| `apps/web/src/app/income/new/page.tsx`                               | ✓ VERIFIED          | RSC with session guard; fetches categories; renders `<IncomeForm>`                                                                                                                                                                                                                                                      |
| `apps/web/src/app/income/new/_actions/create-income.ts`              | ✓ VERIFIED          | `'use server'`; amount guard before `toCents`; `revalidatePath('/income')` + `redirect('/income')` on success                                                                                                                                                                                                           |
| `apps/web/src/app/income/_components/income-form.tsx`                | ✓ VERIFIED          | `profitFirstAllocated` Switch initialized to `true`; quick-add `+` button calls `createIncomeCategoryAction`; uses real API-returned category (WR-08 fix)                                                                                                                                                               |
| `apps/web/src/app/income/_components/income-filters.tsx`             | ✓ VERIFIED          | Uses `nuqs useQueryState`; search debounced 300ms via `setTimeout`; status filter uses `'all'` sentinel (CR-03 fix)                                                                                                                                                                                                     |
| `apps/web/src/app/income/_components/income-overview.tsx`            | ✓ VERIFIED          | Accumulates items from `initialData.content`; "Load more" appends via `fetchIncomesAction`; filter change resets accumulator; `formatCurrency` totals header                                                                                                                                                            |
| `apps/web/src/app/income/_components/income-list.tsx`                | ✓ VERIFIED          | Renders rows with `formatCurrency` + `formatDate`; PENDING rows show "Receive" button; click opens edit dialog                                                                                                                                                                                                          |
| `apps/web/src/app/income/_components/income-actions.ts`              | ✓ VERIFIED          | `'use server'`; exports `updateIncomeAction` (toCents), `deleteIncomeAction`, `receiveIncomeAction` (PUT `/api/incomes/${id}/receive`), `fetchIncomesAction`; all mutations call `revalidatePath('/income')`                                                                                                            |
| `apps/web/src/app/income/_components/edit-income-dialog.tsx`         | ✓ VERIFIED (exists) | Reuses `IncomeForm`; includes delete with confirm; sonner toasts                                                                                                                                                                                                                                                        |
| `apps/web/src/app/income/_components/receive-income-dialog.tsx`      | ✓ VERIFIED          | Date input defaulting to `todayLocal()`; calls `receiveIncomeAction`; closes on success                                                                                                                                                                                                                                 |
| `apps/web/src/app/income/_components/category-actions.ts`            | ✓ VERIFIED          | `'use server'`; exports `createIncomeCategoryAction` (returns full category — WR-08 fix), `renameIncomeCategoryAction`, `deleteIncomeCategoryAction`; all call `revalidatePath('/income')`                                                                                                                              |
| `apps/web/src/app/income/_components/manage-categories-dialog.tsx`   | ✓ VERIFIED          | Disables edit/delete for `cat.system` rows; surfaces `category_in_use` and `cannot_delete_system_category` toasts; add-new input                                                                                                                                                                                        |
| `apps/web/src/app/expenses/page.tsx`                                 | ✓ VERIFIED          | RSC; session guard; `apiFetch<{ data: ExpenseCategory[] }>('/api/expense-categories')`; passes `categoriesData.data` (CR-01 fix)                                                                                                                                                                                        |
| `apps/web/src/app/expenses/new/page.tsx`                             | ✓ VERIFIED          | RSC with session guard; passes `categoriesData.data` (CR-01 fix)                                                                                                                                                                                                                                                        |
| `apps/web/src/app/expenses/new/_actions/create-expense.ts`           | ✓ VERIFIED          | `'use server'`; amount guard; `toCents`; `'none'` sentinel for payment method (CR-03 fix); `revalidatePath('/expenses')`                                                                                                                                                                                                |
| `apps/web/src/app/expenses/_components/expense-form.tsx`             | ✓ VERIFIED          | Payment method uses `'none'` sentinel not `''` (CR-03 fix); quick-add `+` calls `createExpenseCategoryAction`                                                                                                                                                                                                           |
| `apps/web/src/app/expenses/_components/expenses-overview.tsx`        | ✓ VERIFIED          | Date-range filter via `useQueryState`; totals sum only `e.deletedAt === null` rows; load-more appends; no free-text search                                                                                                                                                                                              |
| `apps/web/src/app/expenses/_components/expense-list.tsx`             | ✓ VERIFIED          | Renders active rows (clickable→edit) and deleted rows (`DeletedExpenseRow` with `RotateCcw` restore button)                                                                                                                                                                                                             |
| `apps/web/src/app/expenses/_components/expense-actions.ts`           | ✓ VERIFIED          | `'use server'`; `updateExpenseAction` (WR-05 fix: `description: ... \|\| null`), `deleteExpenseAction`, `restoreExpenseAction` (PATCH `/:id/restore`), `fetchExpensesAction`; all mutations call `revalidatePath('/expenses')`                                                                                          |
| `apps/web/src/app/expenses/_components/edit-expense-dialog.tsx`      | ✓ VERIFIED (exists) | Reuses `ExpenseForm`; soft-delete with confirm                                                                                                                                                                                                                                                                          |
| `apps/web/src/app/expenses/_components/category-actions.ts`          | ✓ VERIFIED          | `'use server'`; exports `createExpenseCategoryAction`, `renameExpenseCategoryAction`, `deleteExpenseCategoryAction`; all call `revalidatePath('/expenses')`                                                                                                                                                             |
| `apps/web/src/app/expenses/_components/manage-categories-dialog.tsx` | ✓ VERIFIED (exists) | Same protection/error-surfacing pattern as income version                                                                                                                                                                                                                                                               |

### Key Link Verification

| From                                     | To                                  | Via                                                             | Status  | Evidence                                                                                                |
| ---------------------------------------- | ----------------------------------- | --------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `apps/api/src/index.ts`                  | incomes/expenses/categories routers | `app.use(requireAuth) + app.route(...)`                         | ✓ WIRED | All four route groups mounted with `requireAuth` prefix guard; `allowMethods` includes PUT/DELETE/PATCH |
| `apps/web/src/server/api.ts`             | Workers API                         | `fetch` with `Authorization: Bearer` from `access_token` cookie | ✓ WIRED | `await cookies()` + `headers.set('Authorization', ...)`                                                 |
| `create-income.ts` / `create-expense.ts` | `/api/incomes` / `/api/expenses`    | `apiFetch POST` with `toCents` conversion                       | ✓ WIRED | Both confirmed; amount guard precedes `toCents`                                                         |
| `receive-income-dialog.tsx`              | `receiveIncomeAction`               | calls `PUT /api/incomes/:id/receive`                            | ✓ WIRED | `receiveIncomeAction` → `apiFetch(\`/api/incomes/${id}/receive\`, { method: 'PUT' })`                   |
| `expense-list.tsx` (`DeletedExpenseRow`) | `restoreExpenseAction`              | `PATCH /api/expenses/:id/restore`                               | ✓ WIRED | `restoreExpenseAction` → `apiFetch(\`/api/expenses/${id}/restore\`, { method: 'PATCH' })`               |
| `income-category-service.ts`             | `incomes.categoryName`              | cascade `UPDATE` via `db.batch`                                 | ✓ WIRED | `db.batch([update incomeCategories.name, update incomes.categoryName where categoryId=id AND userId])`  |
| `expense-category-service.ts`            | `expenses.categoryName`             | cascade `UPDATE` via `db.batch`                                 | ✓ WIRED | Same pattern; batch also handles soft-deleted expense purge on category delete                          |
| `income-category-service.ts`             | incomes (usage count)               | block delete when count > 0                                     | ✓ WIRED | `COUNT(*) from incomes where categoryId=id AND userId`; throws 400 `category_in_use`                    |
| `expense-category-service.ts`            | expenses (active usage count)       | block delete when active count > 0                              | ✓ WIRED | `COUNT(*) from expenses where ... AND isNull(deletedAt)` (CR-04 fix)                                    |
| `income/page.tsx`                        | `IncomeOverview`                    | passes `categoriesData.data`                                    | ✓ WIRED | Confirmed — not passing raw `{ data: [...] }` object                                                    |
| `expenses/page.tsx`                      | `ExpensesOverview`                  | passes `categoriesData.data` (CR-01 fix)                        | ✓ WIRED | `apiFetch<{ data: ExpenseCategory[] }>` + `categories={categoriesData.data}`                            |

### Data-Flow Trace (Level 4)

| Artifact                                 | Data Variable              | Source                                                                                   | Produces Real Data                        | Status    |
| ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- | --------- |
| `income-overview.tsx`                    | `items`                    | `initialData.content` from RSC `apiFetch` → `income-service.list()` → D1                 | Yes — Drizzle query on `incomes` table    | ✓ FLOWING |
| `expenses-overview.tsx`                  | `expenses`                 | `initialData.content` from RSC `apiFetch` → `expense-service.list()` → D1                | Yes — Drizzle query on `expenses` table   | ✓ FLOWING |
| `expenses-overview.tsx` `activeTotal`    | filter of `expenses` state | client-side filter of `deletedAt === null` from loaded rows                              | Yes — uses real rows, not hardcoded       | ✓ FLOWING |
| `manage-categories-dialog.tsx` (income)  | `categories` prop          | RSC fetch `apiFetch('/api/income-categories')` → `income-category-service.list()` → D1   | Yes — seeds + queries `income_categories` | ✓ FLOWING |
| `manage-categories-dialog.tsx` (expense) | `categories` prop          | RSC fetch `apiFetch('/api/expense-categories')` → `expense-category-service.list()` → D1 | Yes                                       | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior                       | Command                            | Result                                                          | Status |
| ------------------------------ | ---------------------------------- | --------------------------------------------------------------- | ------ |
| API test suite (all 139 tests) | `npm test` from repo root          | 7 test files passed (1 skipped — wallets, unrelated to Phase 2) | ✓ PASS |
| API typecheck                  | `cd apps/api && npm run typecheck` | Exit 0, no errors                                               | ✓ PASS |
| Web typecheck                  | `cd apps/web && npm run typecheck` | Exit 0, no errors                                               | ✓ PASS |
| Web lint                       | `cd apps/web && npm run lint`      | Exit 0, no errors                                               | ✓ PASS |

### Probe Execution

No probes declared or expected for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description                                                                     | Status      | Evidence                                                                                                                                                                                            |
| ----------- | ----------- | ------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INC-01      | 02-02-PLAN  | Record income with category, amount, date, description, PENDING/RECEIVED status | ✓ SATISFIED | `income-service.create()`; `income-form.tsx`; `create-income.ts`; 2 create tests pass                                                                                                               |
| INC-02      | 02-02-PLAN  | Browse paginated income list with search and filters                            | ✓ SATISFIED | `income-service.list()` with search/status/date filters; `income-filters.tsx` nuqs; load-more overview; tests pass                                                                                  |
| INC-03      | 02-02-PLAN  | Edit an income record                                                           | ✓ SATISFIED | `income-service.update()`; `edit-income-dialog.tsx`; `updateIncomeAction`; update test passes                                                                                                       |
| INC-04      | 02-02-PLAN  | Delete an income record                                                         | ✓ SATISFIED | `income-service.delete()` hard-delete; `deleteIncomeAction`; delete test passes                                                                                                                     |
| INC-05      | 02-02-PLAN  | Mark PENDING income as RECEIVED, sets received date                             | ✓ SATISFIED | `income-service.receive()`; `receive-income-dialog.tsx`; `receiveIncomeAction`; `PUT /:id/receive` registered before `/:id`; receive tests pass; `profitFirstAllocated` NOT modified                |
| INC-06      | 02-04-PLAN  | Manage income categories (create/edit/delete custom; system defaults protected) | ✓ SATISFIED | `income-category-service.ts` full surface; 12 tests pass including seeding, cascade rename, block-in-use, system protection, IDOR                                                                   |
| EXP-01      | 02-03-PLAN  | Record expense with category, amount, date, payment method, description         | ✓ SATISFIED | `expense-service.create()`; `expense-form.tsx` with PAYMENT_METHODS; `create-expense.ts` with `'none'` sentinel; 2 create tests pass                                                                |
| EXP-02      | 02-03-PLAN  | Browse paginated expense list with date-range filters                           | ✓ SATISFIED | `expense-service.list()` with from/to; `expenses-overview.tsx` date-range filter; load-more; 2 list tests pass                                                                                      |
| EXP-03      | 02-03-PLAN  | Edit an expense                                                                 | ✓ SATISFIED | `expense-service.update()` (rejects soft-deleted, CR-05 fix); `edit-expense-dialog.tsx`; `updateExpenseAction`; update tests pass                                                                   |
| EXP-04      | 02-03-PLAN  | Soft-delete an expense (restorable; excluded from totals)                       | ✓ SATISFIED | `expense-service.delete()` sets `deletedAt`; `restore()` clears it + rejects active rows; `totalActive()` uses `isNull`; `expense-list.tsx` `DeletedExpenseRow` restore button; 5 EXP-04 tests pass |
| EXP-05      | 02-04-PLAN  | Manage expense categories (custom + protected system defaults)                  | ✓ SATISFIED | `expense-category-service.ts` full surface; 13 tests pass including isNull in-use check (CR-04 fix), soft-deleted purge on delete (CR-05 fix)                                                       |

All 11 requirements (INC-01..06, EXP-01..05) are covered by this phase's plans and verified in the codebase.

### Anti-Patterns Found

No `TBD`, `FIXME`, or `XXX` markers in any Phase-2 modified files. No stub patterns (empty returns, hardcoded empty arrays) in service or route files. The "placeholder" grep matches are all legitimate HTML input `placeholder=` attributes.

One info-level duplication remains open from the code review (IN-02): `PAYMENT_METHODS` in `apps/web/src/lib/constants.ts` and `PAYMENT_METHOD_VALUES` in `apps/api/src/schemas/expense.ts` duplicate the same 5 values. This is a known, accepted split across the package boundary and does not affect correctness — a sync comment is already noted. This is an info-level finding, not a blocker.

### Human Verification Required

Five flows require browser verification because they depend on visual rendering, form interaction, state management, and toast feedback:

#### 1. Income CRUD End-to-End

**Test:** Start dev (`npm run dev`), log in, visit `/income`

1. Record a PENDING income (category, amount 1500.50, date, description) — confirm it shows as ₱1,500.50
2. Search by description/category (debounced), set status=PENDING, set date range — confirm list resets on filter change
3. Record more than 20 incomes, click "Load more" — confirm rows append without resetting filters
4. Click a row → edit dialog → change amount → save → confirm updated value
5. PENDING row → "Receive" → pick a backdated date → confirm status flips to RECEIVED, receivedDate shows
6. Delete a row → confirm dialog → confirm row disappears

**Expected:** All six sub-steps complete without errors; amounts are always ₱ with 2 decimal places
**Why human:** Visual rendering, dialog lifecycle, filter state, load-more append, and toast feedback

#### 2. Expense CRUD End-to-End

**Test:** Visit `/expenses`

1. `/expenses/new` — record expense (category, 250.75, GCash, description) — confirm ₱250.75 and GCash badge
2. Date-range filter — confirm list resets; load-more appends
3. Totals header shows only active expense amounts
4. Edit a row (change amount) → save → confirm update
5. Delete a row → it disappears from active list; totals drop; deleted row shows with "Restore" (RotateCcw) icon in the list
6. Click restore → row returns; totals go back up

**Expected:** All steps complete; soft-delete/restore visible in the same list view
**Why human:** Soft-delete visual indicator, restore UX, totals re-computation

#### 3. Income Category Management

**Test:**

1. Fresh user (or user with no categories) opens `/income` — default categories (Salary, Freelance, Business, Gifts, Other) appear in category dropdown automatically
2. Click "Manage categories" → add "Consulting" → confirm it appears
3. Click pencil on "Consulting" → rename to "Advisory" while an income record uses that category → confirm existing record shows "Advisory"
4. Try to delete "Advisory" while it has a record → confirm "Category is in use" toast
5. Delete a record, then delete "Advisory" → confirm it's removed
6. Salary (system) category has no pencil or trash icons

**Expected:** Seeding, cascade rename, block-in-use error, and system protection all work
**Why human:** First-access seeding, cascade rename reflection, toast messages

#### 4. Expense Category Management

**Test:** Same flow on `/expenses` with Housing/Food/… defaults and expense records
**Expected:** Identical behavior to income categories
**Why human:** Same reasons

#### 5. Quick-Add Category in Both Forms

**Test:**

1. `/income/new` → click `+` button next to category select → type "Consulting" → Add → confirm new category appears selected
2. Repeat on `/expenses/new`

**Expected:** Category created and selected immediately without page reload; `"Consulting" added and selected.` toast
**Why human:** Optimistic local-state update and immediate selection

### Gaps Summary

No gaps. All observable truths are verified in the codebase. The 5 human-verification items are UX/browser behavioral checks that cannot be confirmed by static analysis — all supporting code (server actions, API routes, client state management, and toasts) is implemented and wired correctly.

---

_Verified: 2026-06-06T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
