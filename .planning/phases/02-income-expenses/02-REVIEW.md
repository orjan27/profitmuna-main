---
phase: 02-income-expenses
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - apps/api/src/index.ts
  - apps/api/src/routes/expense-categories.ts
  - apps/api/src/routes/expenses.ts
  - apps/api/src/routes/income-categories.ts
  - apps/api/src/routes/incomes.ts
  - apps/api/src/schemas/common.ts
  - apps/api/src/schemas/expense.ts
  - apps/api/src/schemas/income.ts
  - apps/api/src/services/expense-category-service.ts
  - apps/api/src/services/expense-service.ts
  - apps/api/src/services/income-category-service.ts
  - apps/api/src/services/income-service.ts
  - apps/api/tests/expense-category.test.ts
  - apps/api/tests/expense.test.ts
  - apps/api/tests/helpers/db.ts
  - apps/api/tests/income-category.test.ts
  - apps/api/tests/income.test.ts
  - apps/web/src/app/expenses/_components/category-actions.ts
  - apps/web/src/app/expenses/_components/edit-expense-dialog.tsx
  - apps/web/src/app/expenses/_components/expense-actions.ts
  - apps/web/src/app/expenses/_components/expense-form.tsx
  - apps/web/src/app/expenses/_components/expense-list.tsx
  - apps/web/src/app/expenses/_components/expenses-overview.tsx
  - apps/web/src/app/expenses/_components/manage-categories-dialog.tsx
  - apps/web/src/app/expenses/new/_actions/create-expense.ts
  - apps/web/src/app/expenses/new/page.tsx
  - apps/web/src/app/expenses/page.tsx
  - apps/web/src/app/income/_components/category-actions.ts
  - apps/web/src/app/income/_components/edit-income-dialog.tsx
  - apps/web/src/app/income/_components/income-actions.ts
  - apps/web/src/app/income/_components/income-filters.tsx
  - apps/web/src/app/income/_components/income-form.tsx
  - apps/web/src/app/income/_components/income-list.tsx
  - apps/web/src/app/income/_components/income-overview.tsx
  - apps/web/src/app/income/_components/manage-categories-dialog.tsx
  - apps/web/src/app/income/_components/receive-income-dialog.tsx
  - apps/web/src/app/income/new/_actions/create-income.ts
  - apps/web/src/app/income/new/page.tsx
  - apps/web/src/app/income/page.tsx
  - apps/web/src/app/layout.tsx
  - apps/web/src/lib/constants.ts
  - apps/web/src/lib/format-currency.ts
  - apps/web/src/lib/format-date.ts
  - apps/web/src/lib/utils.ts
  - apps/web/src/server/api.ts
  - apps/web/src/types/income.ts
  - packages/db/src/index.ts
  - packages/db/src/schema.ts
findings:
  critical: 5
  warning: 9
  info: 6
  total: 20
resolved:
  critical: 5
  warning: 9
open:
  info: 6
status: fixed
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 44
**Status:** fixed (all Critical + Warning resolved; Info left open)

## Summary

Phase 02 implements income/expense CRUD plus category management across the Hono API,
service layer, and Next.js web layer. Ownership scoping (IDOR protection) is consistently
applied in the service layer — every query carries `eq(table.userId, userId)`, and the test
suite covers cross-user access for both resources. System-category protection and cascade
rename are implemented and tested.

However, the review surfaces multiple defects that will break behavior in production:

- The web layer expects a **bare array** from `/api/expense-categories` while the API returns
  `{ data: [...] }`. `categories.map(...)` runs against an object — the expense list page and the
  new-expense page render zero categories (or crash). This is a shipped contract mismatch.
- Income `amount` validation allows **non-integer cents**, violating the money-as-integer-cents
  invariant the whole app depends on. The expense schema correctly uses `.int()`; income does not.
- A Radix `<SelectItem value="">` in the expense form triggers a **runtime error** — Radix Select
  forbids empty-string item values.
- The income router does **not** validate the `:id` path param (unlike the expenses router), so
  malformed IDs silently degrade to 404 and bypass the documented 422 contract.
- The category-rename cascade does **not** update soft-deleted expense rows consistently with the
  delete-blocking logic, and the in-use check counts soft-deleted rows — producing a state where a
  category cannot be deleted because of rows the UI treats as gone.

There are no structural findings provided for this phase, so all findings below are narrative.

## Critical Issues

### CR-01: Expense-category API returns `{ data }` but the web layer consumes it as a bare array

**File:** `apps/web/src/app/expenses/page.tsx:57` and `apps/web/src/app/expenses/new/page.tsx:23`
**Issue:** The expense-categories route returns a wrapped envelope:
`return c.json({ data });` (`apps/api/src/routes/expense-categories.ts:17`). Both expense pages
call `apiFetch<ExpenseCategory[]>('/api/expense-categories')` and pass the result straight into
`<ExpensesOverview categories={categories}>` / `<ExpenseForm categories={categories}>`. At runtime
`categories` is `{ data: [...] }`, not an array. `localCategories.map(...)` in `ExpenseForm`
(`expense-form.tsx:138`) and the category list in `ManageCategoriesDialog` iterate over a non-array,
so either no categories render or `.map` throws. Note the income side does this correctly
(`income/page.tsx:40` uses `categoriesData.data`), which confirms the expense pages are wrong.
**Fix:**

```ts
// expenses/page.tsx
const [expensesData, categoriesData] = await Promise.all([
  apiFetch<PaginatedExpenses>(`/api/expenses?${qs.toString()}`),
  apiFetch<{ data: ExpenseCategory[] }>('/api/expense-categories'),
]);
// ...
<ExpensesOverview initialData={expensesData} categories={categoriesData.data} />

// expenses/new/page.tsx
const categoriesData = await apiFetch<{ data: ExpenseCategory[] }>('/api/expense-categories');
<ExpenseForm categories={categoriesData.data} action={createExpenseAction} />
```

**Resolution:** fixed in 0cde93f — both expense pages now consume `{ data }`.

### CR-02: Income `amount` schema allows fractional cents — breaks the integer-cents invariant

**File:** `apps/api/src/schemas/income.ts:6`
**Issue:** `amount: z.number().positive()` accepts non-integer values (e.g. `100.5`). The whole app
treats `amount` as integer cents (schema column is `integer('amount')`, `formatCurrency` does
`cents / 100`, `toCents` rounds to int). The expense schema correctly uses
`z.number().int().positive()` (`schemas/expense.ts:9`). A client (or a future caller bypassing the
web `toCents` rounding) can persist `100.5` cents; SQLite will store the float in an INTEGER column
with implementation-defined coercion, corrupting money values. This is a data-integrity defect.
**Fix:**

```ts
amount: z.number().int().positive(),
```

**Resolution:** fixed in ca4f7a4 — income amount now requires integer cents.

### CR-03: `<SelectItem value="">` throws a runtime error in the expense form

**File:** `apps/web/src/app/expenses/_components/expense-form.tsx:223`
**Issue:** Radix UI `Select.Item` forbids an empty-string `value` (it reserves `""` to clear the
selection and throws: "A <Select.Item /> must have a value prop that is not an empty string").
`<SelectItem value="">None</SelectItem>` will crash the form whenever the Select renders its
content. The income status filter has the same pattern at
`apps/web/src/app/income/_components/income-filters.tsx:84` (`<SelectItem value="">All Status</SelectItem>`).
**Fix:** Use a sentinel value and translate it in the handler/action:

```tsx
<SelectItem value="none">None</SelectItem>
// in the action: paymentMethod === 'none' ? null : paymentMethod
```

Apply the same fix to the income status filter (map `"all"` → cleared filter).

**Resolution:** fixed in f9afa16 — expense payment method uses `'none'` sentinel
(mapped to null in both actions); income status filter uses `'all'` sentinel.

### CR-04: Expense category in-use check counts soft-deleted expenses, blocking deletion of effectively-empty categories

**File:** `apps/api/src/services/expense-category-service.ts:121-128`
**Issue:** Delete is blocked when `COUNT(*)` of expenses referencing the category is `> 0`, but the
count does **not** filter `isNull(expenses.deletedAt)`. The expense feature uses soft-delete
(`deletedAt`), and the UI treats soft-deleted rows as gone. A user who deletes every expense in a
custom category (soft delete) then tries to delete the now-empty category gets a misleading
`category_in_use` error and can never remove it (the only way to clear it is to restore + hard
delete, which the UI does not offer). This contradicts the soft-delete semantics the rest of the
phase enforces.
**Fix:**

```ts
import { isNull } from 'drizzle-orm';
const [usageRow] = await db
  .select({ count: sql<number>`COUNT(*)` })
  .from(expenses)
  .where(and(eq(expenses.categoryId, id), eq(expenses.userId, userId), isNull(expenses.deletedAt)));
```

Decide and document the intended rule (block on active rows only, or on all rows including deleted);
either way it must be consistent with the cascade-rename below (CR-05) and the UI behavior.

**Resolution:** fixed in cc58f90 — in-use check now filters `isNull(deletedAt)`, blocking
only on active rows. Soft-deleted rows are purged on category delete (see CR-05) to satisfy
the FK constraint, keeping behavior consistent with soft-delete semantics.

### CR-05: Cascade rename and update operate on soft-deleted rows inconsistently, and the rename is not atomic

**File:** `apps/api/src/services/expense-category-service.ts:86-97` and
`apps/api/src/services/expense-service.ts:173-200`
**Issue (two related defects):**

1. **Non-atomic cascade.** The rename runs the two updates via `Promise.all([...])`
   (`expense-category-service.ts:86`, mirrored in `income-category-service.ts:84`). D1/SQLite has no
   shared transaction across these two independent statements, and they are issued concurrently. If
   the second update (denormalized `categoryName` on `expenses`/`incomes`) fails, the category row is
   already renamed, leaving denormalized names permanently stale — the exact inconsistency the
   denormalization + cascade was designed to prevent (D-13). These must run in a `db.batch([...])`
   (D1's atomic primitive) or sequentially with rollback handling, not `Promise.all`.
2. **Soft-deleted rows.** The rename updates `categoryName` on all matching rows including
   soft-deleted ones (no `deletedAt` filter), while CR-04's delete-block counts them too — but
   `expense-service.update()` (line 173) and `delete()` happily mutate a row regardless of its
   `deletedAt` state. A client can `PUT /api/expenses/:id` on a soft-deleted expense and silently
   resurrect-edit it without going through `restore`, bypassing the soft-delete state machine.
   **Fix:**

```ts
// atomic cascade (D1)
await db.batch([
  db
    .update(expenseCategories)
    .set({ name })
    .where(and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId))),
  db
    .update(expenses)
    .set({ categoryName: name })
    .where(and(eq(expenses.categoryId, id), eq(expenses.userId, userId))),
]);
// then re-select the renamed category to return it.

// expense-service.update(): reject edits on soft-deleted rows
if (existing.deletedAt) throw new HTTPException(409, { message: 'expense_deleted' });
```

**Resolution:** fixed in 1db071a — cascade rename now uses `db.batch` (D1 atomic) on both
category services; `expense.update()` rejects edits on soft-deleted rows with 409
`expense_deleted`; category delete purges soft-deleted expenses in the same batch. Test
helper exposes a D1-driver drizzle (`dbD1`) so `db.batch` works under better-sqlite3.

## Warnings

### WR-01: Income router does not validate the `:id` path param

**File:** `apps/api/src/routes/incomes.ts:62, 72-78, 89, 99-105`
**Issue:** Every income route reads the id with `Number(c.req.param('id'))` and never applies
`idParamSchema` (which the expenses and category routers do). `Number('abc')` → `NaN`,
`Number('')` → `0`, `Number('1.5')` → `1.5`. These flow into `eq(incomes.id, NaN)` etc., silently
returning 404 instead of the documented 422 validation error, and produce inconsistent behavior with
the rest of the API. `/:id/receive` has the same gap.
**Fix:** Add `zValidator('param', idParamSchema, hook)` to each `:id` income route and read
`c.req.valid('param').id`, mirroring `routes/expenses.ts`.

**Resolution:** fixed in 67e915a — all income `:id` routes now validate via `idParamSchema`
and read `c.req.valid('param').id`, returning 422 on malformed ids.

### WR-02: Empty/zero amount silently sent as `toCents(0)` from the web actions

**File:** `apps/web/src/app/expenses/_components/expense-actions.ts:50,57`,
`apps/web/src/app/expenses/new/_actions/create-expense.ts:19,26`,
`apps/web/src/app/income/_components/income-actions.ts:51`,
`apps/web/src/app/income/new/_actions/create-income.ts:14-15`
**Issue:** `Number(formData.get('amount'))` returns `NaN` for empty input and `0`/negatives for bad
input. `toCents(NaN)` → `NaN`; `toCents(0)` → `0`. There is no server-action-side guard, so the only
defense is the HTML `min="0.01"` attribute (trivially bypassable) and the API's `.positive()` check.
On `NaN`, `JSON.stringify({ amount: NaN })` emits `"amount":null`, which fails API validation with a
generic error rather than a useful field message.
**Fix:** Validate in the action before calling the API: if `!Number.isFinite(rawAmount) || rawAmount <= 0`,
return `{ error: 'invalid_amount' }` (or parse with a Zod schema in the action).

**Resolution:** fixed in 69bb2b4 — all four create/update actions guard
`!Number.isFinite(rawAmount) || rawAmount <= 0` before calling the API; income form maps
`invalid_amount` to a specific toast.

### WR-03: `formatDate(new Date(iso))` mis-parses `YYYY-MM-DD` as UTC, causing off-by-one day display

**File:** `apps/web/src/lib/format-date.ts:10`
**Issue:** `new Date('2026-06-06')` is parsed as UTC midnight. In any timezone west of UTC
(e.g. America), `format(...)` renders the **previous** day. Income/expense dates are stored as
`YYYY-MM-DD` (date-only) and displayed throughout the lists, so users in negative-offset timezones
see dates shifted back one day.
**Fix:** Parse date-only strings as local:

```ts
import { parseISO, parse } from 'date-fns';
export function formatDate(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parse(iso, 'yyyy-MM-dd', new Date()) : parseISO(iso);
  return format(d, 'MMM d, yyyy');
}
```

**Resolution:** fixed in 350e166 — `formatDate` parses `YYYY-MM-DD` with `parse(...)` in
local time, falling back to `parseISO` for datetimes.

### WR-04: Creating a duplicate or system-named category surfaces a generic 500, not a clean conflict

**File:** `apps/api/src/services/income-category-service.ts:58-64`,
`apps/api/src/services/expense-category-service.ts:60-66`
**Issue:** `create()` inserts directly with no duplicate-name check. The DB has
`uniqueIndex(userId, name)`. A user creating a category whose name collides with an existing one
(including a seeded system default like "Salary"/"Food", or a previously-created custom name)
triggers a unique-constraint violation that escapes as an unhandled error → generic 500
(`index.ts:43-44`). The web quick-add and Manage dialog show "Failed to create category" with no
indication it is a duplicate.
**Fix:** Catch the conflict (or pre-check) and throw `HTTPException(409, { message: 'category_exists' })`,
then surface a specific toast in the dialogs.

**Resolution:** fixed in 14a3dcd — both category services pre-check the (userId, name) unique
index and throw 409 `category_exists`; manage dialogs and quick-add handlers surface a
specific toast.

### WR-05: `updateExpenseAction` always overwrites description/paymentMethod, cannot represent "leave unchanged"

**File:** `apps/web/src/app/expenses/_components/expense-actions.ts:53-68`
**Issue:** The action always sends `categoryId, amount, expenseDate, description, paymentMethod` on
every edit. Because the form is the full edit form this is usually fine, but `description` is set to
`undefined` when blank (omitted from JSON) while `paymentMethod` is sent as explicit `null`. The
asymmetry means clearing a description is impossible through this path (omitted → server leaves it),
whereas clearing payment method works. Behavior is inconsistent and surprising.
**Fix:** Decide on PUT-as-full-replace semantics and send `description: description ?? null`
consistently with `paymentMethod`, or document that blanks are ignored.

**Resolution:** fixed in 0fe00c5 — `updateExpenseAction` now sends `description: ... || null`
(full-replace), matching `paymentMethod`.

### WR-06: `restore()` does not guard against restoring an already-active expense

**File:** `apps/api/src/services/expense-service.ts:225-241`
**Issue:** `restore` clears `deletedAt` without checking the row is currently soft-deleted. Calling
restore on an active expense is a no-op write that returns 200 success, and bumps `updatedAt`. Minor
state-machine looseness, but it lets the UI/API report "Expense restored" for a row that was never
deleted.
**Fix:** `if (!existing.deletedAt) throw new HTTPException(409, { message: 'not_deleted' });`

**Resolution:** fixed in 2bf6f0f — `restore()` rejects an already-active expense with 409
`not_deleted`.

### WR-07: Income `update` re-validates category on every call but duplicates a redundant branch

**File:** `apps/api/src/services/income-service.ts:194-217`
**Issue:** Both branches of the `if (input.categoryId !== undefined && input.categoryId !== existing.categoryId)`
/ `else if (input.categoryId !== undefined)` perform the identical category lookup and assignment.
This is dead-branch duplication — the condition split has no behavioral effect. Beyond being a code
smell, it doubles the maintenance surface and obscures intent. (The expense service correctly does a
single `if (input.categoryId !== undefined)` check at `expense-service.ts:183`.)
**Fix:** Collapse to a single `if (input.categoryId !== undefined) { categoryName = await resolve... }`.

**Resolution:** fixed in 8da382f — collapsed to a single `if (input.categoryId !== undefined)`
branch in the income service update.

### WR-08: `IncomeForm` quick-add appends a category but the income status filter / list does not validate against stale local state

**File:** `apps/web/src/app/income/_components/income-form.tsx:78-90`
**Issue:** Quick-add inserts a placeholder `userId: 0` category into local state and selects it. If
the create succeeds at the API but `revalidatePath('/income')` re-renders the RSC with a different
ordering/id set, the locally-held `userId: 0` object lingers until next full load. Functionally the
id is correct so submit works, but the fabricated `userId: 0` is a latent foot-gun if any child ever
reads `userId`. Low risk; flag for hygiene.
**Fix:** Use the real category returned by the action (it already has the right id/name); drop the
`userId: 0` placeholder or carry the real userId.

**Resolution:** fixed in f31872d — `createIncomeCategoryAction` returns the full `IncomeCategory`
echoed by the API; the form inserts it directly, dropping the `userId: 0` placeholder.

### WR-09: List `total`/pagination does two full-table scans and `last` math can mislead on exact-boundary pages

**File:** `apps/api/src/services/income-service.ts:113-131`
**Issue (correctness, not perf):** `last = offset + content.length >= total`. When the page is exactly
full and total is an exact multiple of limit, the final page computes `last = true` correctly, but a
client paging past the end (offset > total) gets `content: []` with `last = true` only if
`offset >= total`; for `offset` between `total` and `total+limit` with zero rows it still reports
`last = true`, which is fine — but the expense service uses a different scheme (`limit+1` look-ahead)
so the two list endpoints report `last` with different edge semantics. Align them to avoid client
bugs when the income vs expense overviews share load-more logic assumptions.
**Fix:** Standardize both services on one pagination strategy (prefer the `limit+1` look-ahead used
by expenses; it avoids the second COUNT query and has unambiguous `last`).

**Resolution:** fixed in f0ccfe6 — income list now uses the `limit+1` look-ahead (no second
COUNT), matching the expense service.

## Info

> Info findings (IN-01..IN-06) are intentionally left open — out of the
> Critical+Warning fix scope for this pass.

### IN-01: `console.error` logs the full error object on unhandled errors

**File:** `apps/api/src/index.ts:43`
**Issue:** `console.error('unhandled error:', { path: c.req.path, error: err })` logs the entire error.
security.md says log correlation/resource IDs, never full request context that may contain PII. The
path is generally safe, but ensure `err` never contains request bodies. Consider logging
`err.message`/stack only.
**Fix:** Log a correlation id + `err instanceof Error ? err.stack : String(err)`, not the raw object.

### IN-02: Duplicated payment-method value list across web and API

**File:** `apps/web/src/lib/constants.ts:6-12` and `apps/api/src/schemas/expense.ts:4`
**Issue:** `PAYMENT_METHODS` (web) and `PAYMENT_METHOD_VALUES` (API) hardcode the same five values in
two places with no shared source. Drift will cause the form to offer a value the API rejects.
**Fix:** Acceptable given the package boundary (db does not export it), but add a cross-file sync
comment as already done for `PF_DEFAULT_COLORS`, or centralize.

### IN-03: `todayLocal()` / `todayISO()` duplicated in three components with differing UTC/local semantics

**File:** `apps/web/src/app/income/_components/income-form.tsx:35`,
`apps/web/src/app/income/_components/receive-income-dialog.tsx:28`,
`apps/web/src/app/expenses/_components/expense-form.tsx:49`
**Issue:** Income forms use a local-time `todayLocal()`; the expense form uses
`new Date().toISOString().slice(0,10)` (UTC). Near midnight in non-UTC zones these disagree by a day.
Inconsistent default dates between income and expense entry.
**Fix:** Extract one `todayLocal()` into `apps/web/src/lib/format-date.ts` and use it everywhere.

### IN-04: Magic pagination default `20` duplicated across layers

**File:** `apps/web/src/app/income/page.tsx:26`, `apps/web/src/app/expenses/page.tsx:51`,
`apps/web/src/app/expenses/_components/expenses-overview.tsx:37` (`PAGE_LIMIT`),
`apps/api/src/schemas/common.ts:6`
**Issue:** The page size `20` is hardcoded in multiple places. `expenses-overview` defines
`PAGE_LIMIT = 20` but the RSC initial fetch hardcodes `'20'` separately. Drift risk.
**Fix:** Single shared constant per layer.

### IN-05: Test DDL is hand-maintained and can drift from the Drizzle schema

**File:** `apps/api/tests/helpers/db.ts:12-117`
**Issue:** The raw `DDL` string mirrors `packages/db/src/schema.ts` by hand (comment acknowledges it).
If a column/index changes in the schema, tests pass against a stale shape and mask real bugs. This is
a known fragility, not a current defect.
**Fix:** Generate the test schema from Drizzle (e.g. `drizzle-kit` push to the in-memory db) or add a
schema-parity assertion test.

### IN-06: `apiFetch` always sets `Content-Type: application/json` even for body-less GET/DELETE

**File:** `apps/web/src/server/api.ts:40`
**Issue:** Setting `Content-Type: application/json` on GET requests with no body is harmless but
non-idiomatic and could confuse strict intermediaries. Minor.
**Fix:** Only set the header when `init.body` is present.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
