# Phase 2: Income & Expenses - Research

**Researched:** 2026-06-06
**Domain:** Finance CRUD (income, expenses, categories) — Hono API + Drizzle D1 + Next.js 15 App Router
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Default income categories (system, protected): Salary, Freelance, Business, Gifts, Other
- **D-02:** Default expense categories (system, protected): Housing, Food, Transportation, Utilities, Healthcare, Entertainment, Other
- **D-03:** Drop the reference's income-category `type` enum. Categories are just `name` + `system` flag (+ `userId`). Nothing downstream needs the type.
- **D-04:** Lazy idempotent seeding: defaults are check-and-seeded when a user first hits income/expense endpoints. One mechanism covers existing Phase 1 users and all future signup paths. No registration hook, no backfill migration.
- **D-05:** Match the reference layout: separate `/income/new` and `/expenses/new` pages for adding; editing happens in a dialog opened from the list row.
- **D-06:** Lists use a "Load more" button (append on demand) — not numbered pages, not infinite scroll. Changing search/filters resets the loaded list.
- **D-07:** Income list search is debounced live search (~300ms) across description and category name; combined with status and date-range filters. Expense list filters by date range only.
- **D-08:** Interim currency display is hardcoded ₱, implemented through a single formatting helper in `apps/web/src/lib/` (cents → display string) so Phase 6 currency swap is a one-line change. Amount inputs accept decimal pesos and convert to integer cents.
- **D-09:** Fixed payment methods: Cash, GCash, Bank Transfer, Maya, Check (`cash`, `gcash`, `bank_transfer`, `maya`, `check`).
- **D-10:** Payment method is optional but validated: Zod schema accepts only the 5 known values when provided. Stored as nullable text.
- **D-11:** Categories managed where they're used: a "manage categories" dialog reachable from the income/expense pages, plus a quick "+ new category" affordance inside record forms. No dedicated categories page.
- **D-12:** Deleting a category that has transactions is blocked with an error. System categories never deletable. No dangling `categoryId`.
- **D-13:** Renaming a category cascades: the denormalized `categoryName` on existing income/expense rows is updated so lists stay consistent.
- **D-14:** Receive income via confirm dialog with receivedDate defaulting to today (editable for backdating), then confirms — sets `receivedDate`, flips `moneyStatus` to RECEIVED.

### Claude's Discretion

- Soft-deleted expense surfacing/restore UI (e.g., "show deleted" toggle + restore action) — pick a sensible pattern consistent with the reference's `PATCH /:id/restore`.
- Empty states, loading skeletons, overview/totals headers on list pages — follow the reference where it has them.
- Exact Zod limits (description length, max amount), index choices, and pagination page size.
- Whether income hard-delete shows a confirm dialog (recommended: yes).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (Currency setting remains Phase 6; allocation consumption of RECEIVED income remains Phase 3.)
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                             | Research Support                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| INC-01 | User can record income with category, amount, date, description, and money status (PENDING or RECEIVED) | Schema `incomes` table; `createIncomeService.create()`; `/income/new` page + `IncomeForm`                                                          |
| INC-02 | User can browse a paginated income list with search and filters (status, date range)                    | `incomeService.list()` with `search`, `moneyStatus`, `from`, `to` query params; debounced `IncomeFilters` component; load-more pattern             |
| INC-03 | User can edit an income record                                                                          | `incomeService.update()`; `EditIncomeDialog` opened from list row; `PUT /api/incomes/:id`                                                          |
| INC-04 | User can delete an income record                                                                        | `incomeService.delete()`; confirm dialog; `DELETE /api/incomes/:id` (hard delete)                                                                  |
| INC-05 | User can mark PENDING income as RECEIVED — sets received date and feeds Profit First allocation         | `incomeService.receive()` with `receivedDate` body param (D-14 enhancement); `PUT /api/incomes/:id/receive`                                        |
| INC-06 | User can manage income categories (create/edit/delete custom; generic system defaults protected)        | `incomeCategoryService`; D-11 dialog from list page; D-12 block-delete-in-use; D-13 cascade-rename                                                 |
| EXP-01 | User can record an expense with category, amount, date, payment method, and description                 | Schema `expenses` table; `createExpenseService.create()`; `/expenses/new` page + `ExpenseForm`                                                     |
| EXP-02 | User can browse a paginated expense list with date-range filters                                        | `expenseService.list()` with `from`/`to`; load-more; `DateFilter` component                                                                        |
| EXP-03 | User can edit an expense                                                                                | `expenseService.update()`; edit dialog from list row; `PUT /api/expenses/:id`                                                                      |
| EXP-04 | User can soft-delete an expense (restorable; excluded from totals)                                      | `expenseService.delete()` sets `deletedAt`; `expenseService.restore()` clears it; `PATCH /api/expenses/:id/restore`; inline restore UI in list row |
| EXP-05 | User can manage expense categories (custom + protected system defaults)                                 | `expenseCategoryService`; same management dialog pattern as INC-06                                                                                 |

</phase_requirements>

---

## Summary

Phase 2 is a full-stack CRUD slice: four new database tables, four Hono route groups with services and Zod schemas, a server-only API client in Next.js, and multiple UI pages and dialogs. The reference implementation at `/mnt/c/dev/profitfirst/practice` provides the complete service, route, and UI blueprint — the primary adaptation work is (1) replacing `businessId` with `userId` everywhere, (2) removing rental-specific fields (`bookingId`, `unitId`, category `type` enum), and (3) layering in the three Profitmuna-specific enhancements: personal default category sets (D-01/D-02), load-more pagination (D-06), Zod-validated payment methods (D-10), block-delete-in-use categories (D-12), cascade-rename (D-13), and backdatable receive-income dialog (D-14).

The existing Phase 1 codebase provides the full auth foundation: `requireAuth` middleware reads `userId` from the JWT, `getSession()` reads it for server components, and the BFF proxy handles transparent token refresh for browser calls. Phase 2 adds a server-only API client (`apps/web/src/server/api.ts`) for server actions and server components to call the Hono API directly (server-to-server), which is the correct split: browser forms use the Next.js same-origin BFF; server actions call the Workers API directly with the access token from cookies.

The load-more UX (D-06) diverges from the reference's numbered pagination: the API still returns offset/limit pages, but the UI accumulates content arrays client-side and passes an incrementing `page` counter. Filter/search changes reset the accumulator. This pattern works well with `nuqs` for URL-persisted filter state and `useQueryState` for the `page` counter.

**Primary recommendation:** Follow the reference services and routes almost line-for-line (substituting `userId` for `businessId`), then wire the UI per D-05 through D-14. The reference code is the authoritative implementation guide — read each service function before implementing its counterpart.

---

## Architectural Responsibility Map

| Capability                               | Primary Tier          | Secondary Tier        | Rationale                                                                                  |
| ---------------------------------------- | --------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| DB schema (4 tables)                     | Database / Storage    | —                     | Drizzle schema in `packages/db/src/schema.ts`; migrations via Drizzle Kit                  |
| Income CRUD + receive transition         | API / Backend         | —                     | Business logic in services; routes thin; no DB access from web                             |
| Expense CRUD + soft delete/restore       | API / Backend         | —                     | Same as above; `deletedAt` soft delete in service layer                                    |
| Category CRUD + seeding + protection     | API / Backend         | —                     | Idempotent seed function called from service on first access                               |
| Category cascade-rename                  | API / Backend         | —                     | `UPDATE incomes/expenses SET categoryName` when category renamed                           |
| URL filter state (search, status, dates) | Browser / Client      | Frontend Server (SSR) | Client: nuqs `useQueryState`; Server: searchParams read for initial SSR render             |
| Load-more accumulator                    | Browser / Client      | —                     | Client-side array accumulation; server only delivers one page at a time                    |
| Server actions (create/update/delete)    | Frontend Server (SSR) | API / Backend         | Next.js server actions call Workers API server-to-server; mutation result revalidates path |
| Currency formatting helper               | Frontend Server (SSR) | Browser / Client      | Shared `formatCurrency` in `apps/web/src/lib/`; used in both server and client components  |
| Auth guard                               | Frontend Server (SSR) | API / Backend         | Middleware redirects; `requireAuth` re-validates every API request                         |

---

## Standard Stack

### Core

| Library             | Version | Purpose                                       | Why Standard                                                |
| ------------------- | ------- | --------------------------------------------- | ----------------------------------------------------------- |
| drizzle-orm         | 0.45.2  | Schema definition, typed queries, D1 adapter  | Project-pinned; existing pattern in Phase 1                 |
| hono                | 4.12.9  | API routing, middleware, request context      | Project-pinned; existing pattern                            |
| @hono/zod-validator | 0.7.6   | Route-level request validation                | Project-pinned; used in auth routes                         |
| zod                 | 4.3.6   | Schema definition for validation              | Project-pinned; used across stack                           |
| next                | 15.4.11 | App Router, server actions, server components | Project-pinned                                              |
| nuqs                | 2.8.9   | URL search param state for filter UI          | Pinned in web package; purpose-built for Next.js App Router |
| date-fns            | 4.4.0   | Date math (default date ranges)               | Pinned; used in reference for date-range defaults           |
| @date-fns/tz        | 1.4.1   | Asia/Manila timezone for `todayManila()`      | Pinned; reference uses for receivedDate                     |
| sonner              | 2.0.7   | Toast notifications                           | Pinned; used in reference for success/error feedback        |

### Supporting

| Library               | Version | Purpose                               | When to Use                                                                                         |
| --------------------- | ------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| @tanstack/react-table | 8.21.3  | Headless table                        | Available but NOT required for load-more list pattern; use only if table headers/sorting are needed |
| lucide-react          | 1.8.0   | Icons (Plus, RotateCcw, Search, etc.) | Use for Add Income/Expense buttons, restore icon, search icon                                       |

### No New Dependencies Required

All libraries needed for Phase 2 are already pinned in `package.json`. No new `npm install` is needed.

---

## Package Legitimacy Audit

No new packages are being added in this phase. All libraries are existing workspace dependencies pinned in `package.json`. The package legitimacy gate is not applicable.

| Package          | Status                                             |
| ---------------- | -------------------------------------------------- |
| All dependencies | Pre-existing, pinned in workspace; no new installs |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  ├─ [client components: IncomeFilters, EditIncomeDialog, ReceiveIncomeDialog]
  │    └─ fetch('/api/income-proxy/...') via BFF (GET requests for load-more)
  │    └─ Server Actions (POST/PUT/DELETE mutations)
  │
Next.js Server
  ├─ Middleware → redirect /income, /expenses to /login if unauthenticated
  ├─ Page (RSC) → getSession() → fetch from Workers API → render initial data
  ├─ /api/income-proxy/[...path]/route.ts (BFF extension for GET with auth)
  └─ Server Actions → read access_token from cookies → POST/PUT/DELETE to Workers API
        └─ revalidatePath('/income') | revalidatePath('/expenses')
          │
Workers API (Hono)
  ├─ requireAuth middleware → sets c.var.userId
  ├─ /api/incomes → incomeRouter
  │    ├─ GET /          → incomeService.list(userId, params)
  │    ├─ POST /         → incomeService.create(userId, body)
  │    ├─ GET /:id       → incomeService.getById(id, userId)
  │    ├─ PUT /:id       → incomeService.update(id, userId, body)
  │    ├─ PUT /:id/receive → incomeService.receive(id, userId, {receivedDate})
  │    └─ DELETE /:id    → incomeService.delete(id, userId)
  ├─ /api/income-categories → incomeCategoryRouter
  │    ├─ GET /           → incomeCategoryService.list(userId) [+ seed if empty]
  │    ├─ POST /          → incomeCategoryService.create(userId, body)
  │    ├─ PUT /:id        → incomeCategoryService.update(id, userId, body) [cascade rename]
  │    └─ DELETE /:id     → incomeCategoryService.delete(id, userId) [blocks if in use]
  ├─ /api/expenses → expenseRouter
  │    ├─ GET /           → expenseService.list(userId, params)
  │    ├─ POST /          → expenseService.create(userId, body)
  │    ├─ GET /:id        → expenseService.getById(id, userId)
  │    ├─ PUT /:id        → expenseService.update(id, userId, body)
  │    ├─ DELETE /:id     → expenseService.delete(id, userId) [sets deletedAt]
  │    └─ PATCH /:id/restore → expenseService.restore(id, userId) [clears deletedAt]
  └─ /api/expense-categories → expenseCategoryRouter
       ├─ GET /           → expenseCategoryService.list(userId) [+ seed if empty]
       ├─ POST /          → expenseCategoryService.create(userId, body)
       ├─ PUT /:id        → expenseCategoryService.update(id, userId, body) [cascade rename]
       └─ DELETE /:id     → expenseCategoryService.delete(id, userId) [blocks if in use]
          │
Cloudflare D1
  ├─ income_categories (id, name, system, userId)
  ├─ incomes (id, categoryId, categoryName, amount[cents], description, incomeDate, moneyStatus, expectedReleaseDate, receivedDate, profitFirstAllocated, userId, createdAt, updatedAt)
  ├─ expense_categories (id, name, system, userId)
  └─ expenses (id, categoryId, categoryName, amount[cents], description, expenseDate, paymentMethod, deletedAt, userId, createdAt, updatedAt)
```

### Recommended Project Structure

New files only — existing directories preserved:

```
packages/db/src/
└─ schema.ts              # Add 4 new tables (incomeCategories, incomes, expenseCategories, expenses)

apps/api/src/
├─ routes/
│   ├─ incomes.ts         # GET / POST PUT /:id PUT /:id/receive DELETE /:id
│   ├─ income-categories.ts  # GET / POST PUT /:id DELETE /:id
│   ├─ expenses.ts        # GET / POST GET /:id PUT /:id DELETE /:id PATCH /:id/restore
│   └─ expense-categories.ts # GET / POST PUT /:id DELETE /:id
├─ services/
│   ├─ income-service.ts
│   ├─ income-category-service.ts
│   ├─ expense-service.ts
│   └─ expense-category-service.ts
├─ schemas/
│   ├─ income.ts          # incomeQuerySchema, createIncomeSchema, updateIncomeSchema,
│   │                     #   createIncomeCategorySchema, updateIncomeCategorySchema,
│   │                     #   receiveIncomeSchema
│   ├─ expense.ts         # paginationWithDateSchema, createExpenseSchema, updateExpenseSchema,
│   │                     #   createExpenseCategorySchema, updateExpenseCategorySchema
│   └─ common.ts          # paginationSchema, paginationWithDateSchema, idParamSchema (new file)
└─ index.ts               # Mount new route groups; expand CORS allowMethods

apps/web/src/
├─ server/
│   └─ api.ts             # Server-only API client (NEW — fetch to Workers API with access_token)
├─ lib/
│   ├─ format-currency.ts # formatCurrency(cents): string — hardcoded ₱ prefix (D-08)
│   ├─ format-date.ts     # formatDate(isoString): string — human-readable date
│   └─ constants.ts       # PAYMENT_METHODS array (D-09)
├─ app/
│   ├─ income/
│   │   ├─ page.tsx                           # SSR: fetch list + categories; render IncomeOverview
│   │   ├─ new/
│   │   │   ├─ page.tsx                       # SSR: fetch categories; render IncomeForm
│   │   │   └─ _actions/create-income.ts      # "use server" — POST /api/incomes; redirect to /income
│   │   └─ _components/
│   │       ├─ income-overview.tsx            # Header + totals card + filters + list + load-more
│   │       ├─ income-list.tsx                # Maps rows; click opens EditIncomeDialog
│   │       ├─ income-filters.tsx             # Search input + status select; debounced 300ms
│   │       ├─ edit-income-dialog.tsx         # Dialog: update form + delete action
│   │       ├─ receive-income-dialog.tsx      # Dialog: receivedDate input + confirm (D-14)
│   │       └─ income-actions.ts             # "use server" — update/delete/receive server actions
│   └─ expenses/
│       ├─ page.tsx                           # SSR: fetch list; render ExpensesOverview
│       ├─ new/
│       │   ├─ page.tsx                       # SSR: fetch categories; render ExpenseForm
│       │   └─ _actions/create-expense.ts     # "use server" — POST /api/expenses; redirect
│       └─ _components/
│           ├─ expenses-overview.tsx          # Header + totals card + date filter + list + load-more
│           ├─ expense-list.tsx               # Maps rows; deleted rows show inline restore; click opens edit dialog
│           ├─ edit-expense-dialog.tsx        # Dialog: update form + delete action
│           ├─ expense-form.tsx               # Category + amount + date + payment method + description
│           └─ expense-actions.ts            # "use server" — update/delete/restore server actions
```

### Pattern 1: Service Factory (from Phase 1 + reference)

**What:** Service functions created via a factory accepting a Drizzle db instance.
**When to use:** All Phase 2 services.

```typescript
// Source: apps/api/src/services/auth-service.ts (existing Phase 1 pattern)
// + /mnt/c/dev/profitfirst/practice/src/server/services/income-service.ts
import { eq, and, desc, like, or, sql, isNull } from 'drizzle-orm';
import { createDb } from '@app/db';
import { incomes, incomeCategories } from '@app/db/schema';
import { HTTPException } from 'hono/http-exception';

export function createIncomeService(db: ReturnType<typeof createDb>) {
  return {
    async list(userId: number, params: ListParams) { ... },
    async create(userId: number, input: CreateIncomeInput) { ... },
    async receive(id: number, userId: number, receivedDate: string) { ... },
    // ...
  };
}
```

### Pattern 2: Lazy Idempotent Seeding (D-04)

**What:** Check whether the user already has categories; if not, insert defaults in a single operation. Called at the start of the `list` function in the category service.
**When to use:** First call to `GET /api/income-categories` and `GET /api/expense-categories`.

```typescript
// Source: D-04 decision; pattern is idiomatic Drizzle D1
async function seedDefaultsIfNeeded(db: ReturnType<typeof createDb>, userId: number) {
  const existing = await db
    .select({ id: incomeCategories.id })
    .from(incomeCategories)
    .where(eq(incomeCategories.userId, userId))
    .limit(1);

  if (existing.length > 0) return; // already seeded

  await db
    .insert(incomeCategories)
    .values(DEFAULT_INCOME_CATEGORIES.map((name) => ({ name, system: true, userId })));
}
```

### Pattern 3: Category Cascade Rename (D-13)

**What:** When `PUT /api/income-categories/:id` renames a category, also update `categoryName` on all existing `incomes` rows for that userId.
**When to use:** category update service function only.

```typescript
// Source: D-13 decision; Drizzle update syntax from docs
async update(id: number, userId: number, name: string) {
  const existing = await db.query.incomeCategories.findFirst({
    where: and(eq(incomeCategories.id, id), eq(incomeCategories.userId, userId)),
  });
  if (!existing) throw new HTTPException(404, { message: 'not_found' });
  if (existing.system) throw new HTTPException(400, { message: 'cannot_edit_system_category' });

  // Cascade rename across existing income rows
  await Promise.all([
    db.update(incomeCategories).set({ name }).where(eq(incomeCategories.id, id)),
    db.update(incomes)
      .set({ categoryName: name })
      .where(and(eq(incomes.categoryId, id), eq(incomes.userId, userId))),
  ]);
}
```

### Pattern 4: Block Delete In-Use Category (D-12)

**What:** Before deleting a custom category, check if any income/expense rows reference it.
**When to use:** `DELETE /api/income-categories/:id` and `DELETE /api/expense-categories/:id`.

```typescript
// Source: D-12 decision; Drizzle count query
const usage = await db
  .select({ count: sql<number>`COUNT(*)` })
  .from(incomes)
  .where(and(eq(incomes.categoryId, id), eq(incomes.userId, userId)));

const count = usage[0]?.count ?? 0;
if (count > 0) {
  throw new HTTPException(400, { message: 'category_in_use' });
}
```

### Pattern 5: Load-More Pagination (D-06)

**What:** API returns standard offset pages; UI accumulates results client-side.
**When to use:** Income list and expense list pages.

```typescript
// Source: D-06 decision + nuqs docs (https://github.com/47ng/nuqs/blob/next/)
'use client';
import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';
import { useState, useTransition } from 'react';

// Filter state in URL (persisted across navigation)
const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));
const [status, setStatus] = useQueryState('status', parseAsString.withDefault(''));

// Page counter — NOT persisted in URL (reset on filter change)
const [page, setPage] = useState(0);
const [items, setItems] = useState(initialItems); // from SSR

async function loadMore() {
  const nextPage = page + 1;
  const res = await fetch(`/api/income-proxy?page=${nextPage}&search=${search}&...`);
  const data = await res.json();
  setItems((prev) => [...prev, ...data.content]);
  setPage(nextPage);
}

// Filter change: reset accumulator
function handleSearchChange(value: string) {
  setSearch(value);
  setPage(0);
  // Page re-renders from SSR with new filter — items reset via RSC re-render
}
```

**Note:** Filter changes trigger a full server re-render (shallow: false in nuqs, or router.replace). Load-more appends to the client-side array. This hybrid avoids full page navigation on "Load more" while keeping filters URL-shareable.

### Pattern 6: Server-Only API Client (new for Phase 2)

**What:** A `server-only` module in `apps/web/src/server/api.ts` that server actions and server components use to call the Workers API directly (server-to-server).
**When to use:** All server actions (create-income, create-expense, update, delete, restore, receive).

```typescript
// Source: Phase 1 BFF proxy pattern adapted for server-to-server
// apps/web/src/server/api.ts
import 'server-only';
import { cookies } from 'next/headers';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8793';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string
  ) {
    super(code);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: { code: 'unknown' } }))) as {
      error?: { code?: string };
    };
    throw new ApiError(res.status, body.error?.code ?? 'unknown');
  }
  return res.json() as Promise<T>;
}
```

### Pattern 7: Drizzle Soft Delete (expenses)

```typescript
// Source: /mnt/c/dev/profitfirst/practice/src/server/services/expense-service.ts (verified)
// Soft delete
await db
  .update(expenses)
  .set({ deletedAt: new Date().toISOString() })
  .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));

// Restore
await db
  .update(expenses)
  .set({ deletedAt: null })
  .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));

// List query — show all (including deleted) for display; sum only active
const activeWhere = and(eq(expenses.userId, userId), isNull(expenses.deletedAt));
```

### Pattern 8: CORS Expansion (required fix)

The existing CORS config in `apps/api/src/index.ts` only allows `['GET', 'POST']`. Phase 2 adds `PUT`, `DELETE`, and `PATCH` endpoints. The CORS `allowMethods` array must be expanded.

```typescript
// Source: apps/api/src/index.ts (existing, must be updated)
allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
```

### Pattern 9: D-14 Receive Income — Body with receivedDate

The reference `PUT /:id/receive` accepts no body and always uses `todayManila()`. D-14 requires a dialog where the user can edit the received date (for backdating). The Profitmuna implementation passes `receivedDate` in the request body with a fallback to today.

```typescript
// Schema
export const receiveIncomeSchema = z.object({
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Service
async receive(id: number, userId: number, receivedDate?: string) {
  const date = receivedDate ?? todayISOString(); // date-fns format(new Date(), 'yyyy-MM-dd')
  // ...set moneyStatus: 'RECEIVED', receivedDate: date
}
```

### Anti-Patterns to Avoid

- **Storing balances:** Allocation and wallet balances are derived. Never add a `balance` column to income or expense tables.
- **Direct DB access from web:** All DB operations go through the Hono API. `packages/db` is only imported from `apps/api`.
- **businessId in schema:** Replace with `userId` everywhere. Leaving any `businessId` reference breaks Phase 3 allocation.
- **Float amounts:** `amount` is always stored as integer cents. `toCents(decimal)` = `Math.round(decimal * 100)`. Never divide or compare floats against the stored integer.
- **Deleting active categories:** Always check usage count before deleting custom categories (D-12).
- **Not expanding CORS:** PUT/DELETE/PATCH routes will return CORS errors in the browser if `allowMethods` is not updated.
- **Allowing `profitFirstAllocated` reset on receive:** When marking as received, do NOT change `profitFirstAllocated` — it was set at creation time and Phase 3 reads it.

---

## Don't Hand-Roll

| Problem                   | Don't Build                            | Use Instead                                     | Why                                                              |
| ------------------------- | -------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| Request validation        | Custom parse logic                     | `@hono/zod-validator` + Zod schema              | Consistent 422 errors; type inference                            |
| URL filter state          | useState + manual URL writes           | `nuqs` `useQueryState`                          | SSR-compatible; URL-shareable filters                            |
| Date math (today, format) | `new Date().toISOString().slice(0,10)` | `date-fns` + `@date-fns/tz` for Manila timezone | DST-safe; consistent with reference                              |
| Pagination metadata       | Custom page math                       | `buildPaginatedResponse` helper from reference  | Tested; avoids off-by-one                                        |
| Toast notifications       | Custom alert system                    | `sonner` (already wired)                        | Consistent UX; zero config                                       |
| Money formatting          | Inline template strings                | `formatCurrency` helper in `apps/web/src/lib/`  | Single swap point for Phase 6 currency (D-08)                    |
| Category existence checks | Try/catch on FK constraint             | Explicit query before insert/update             | D1 FK errors are not typed; explicit gives better error messages |

**Key insight:** The reference services contain all the edge cases already solved — date handling, cents conversion, pagination, category protection, cascade rename. Copying the service logic and adapting `businessId` → `userId` is faster and safer than reimplementing from scratch.

---

## Common Pitfalls

### Pitfall 1: CORS allowMethods Not Expanded

**What goes wrong:** The browser's preflight OPTIONS request for `PUT /api/incomes/:id` returns a CORS error because `allowMethods` only includes GET and POST.
**Why it happens:** Phase 1 only used GET and POST for auth.
**How to avoid:** Update `allowMethods` in `apps/api/src/index.ts` before writing any PUT/DELETE/PATCH routes.
**Warning signs:** 405 errors on PUT/DELETE from browser (not from Vitest tests, which bypass CORS).

### Pitfall 2: Cents Conversion Skipped in Server Actions

**What goes wrong:** Amount is stored as the raw decimal string from FormData (e.g., `"1500.50"`) instead of `150050` cents.
**Why it happens:** `Number(formData.get('amount'))` returns `1500.5`; forgetting `toCents()` stores the wrong value.
**How to avoid:** Always call `toCents(Number(formData.get('amount')))` in server actions, or validate with a Zod transform on the client before API call.
**Warning signs:** Amounts appear 100x too large or too small in the UI.

### Pitfall 3: BFF Proxy Not Extended for GET Requests

**What goes wrong:** Client components that need to fetch list data (load-more) call `/api/income-proxy/...` which doesn't exist — only `/api/auth/[...path]` is proxied.
**Why it happens:** Phase 1 only proxied auth routes. Phase 2 client components need authenticated GET requests from the browser.
**How to avoid:** Create `apps/web/src/app/api/[...path]/route.ts` as a general-purpose BFF proxy (or extend the existing one), or restructure load-more to use server actions returning data instead of client fetch.
**Warning signs:** 404 on fetch calls from client components to `/api/incomes?...`.

**Recommended approach:** For Phase 2, use server actions for all mutations (POST/PUT/DELETE/PATCH) and restrict client-side fetching to the initial SSR-rendered data. The load-more "Load More" button triggers a server action that returns the next page of data rather than a client-side fetch. This avoids the BFF proxy complexity entirely.

### Pitfall 4: Seeding Race Condition

**What goes wrong:** Two simultaneous requests for a new user's categories each detect zero categories and both try to insert the defaults, resulting in duplicate system categories.
**Why it happens:** D1 SQLite check-then-insert is non-atomic without a transaction.
**How to avoid:** Use `INSERT OR IGNORE` (Drizzle: `.onConflictDoNothing()`) on a unique constraint on `(userId, name, system)` for the seed inserts, or use a D1 transaction. Alternatively, rely on a unique index on `(userId, name)` which prevents duplicates at the DB level.
**Warning signs:** User has 10 "Salary" entries in their income categories dropdown.

### Pitfall 5: profitFirstAllocated Default Mismatch

**What goes wrong:** New income records have `profitFirstAllocated: false` when they should default to `true`.
**Why it happens:** Zod default not set, or Switch component initial state misconfigured.
**How to avoid:** Set `profitFirstAllocated: z.boolean().default(true)` in `createIncomeSchema` and initialize the Switch component with `useState(true)`.
**Warning signs:** Phase 3 allocation summaries show $0 for all received income.

### Pitfall 6: updatedAt Not Added to Schema

**What goes wrong:** Drizzle Kit migration fails or `updatedAt` is missing from tables that need it for audit purposes.
**Why it happens:** The reference uses a `timestamps` spread helper; Profitmuna's Phase 1 schema did not include a reusable `timestamps` helper.
**How to avoid:** Add `updatedAt: text('updated_at').$onUpdate(() => new Date().toISOString())` to all four new tables, consistent with the reference pattern.
**Warning signs:** Queries that filter by `updatedAt` in later phases fail.

---

## Code Examples

### Schema Definition (4 new tables)

```typescript
// Source: /mnt/c/dev/profitfirst/practice/src/server/db/schema.ts lines 303-405 (verified)
// Adapted: businessId → userId; drop type enum (D-03); drop bookingId/unitId

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './schema'; // existing

export const incomeCategories = sqliteTable(
  'income_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    system: integer('system', { mode: 'boolean' }).notNull().default(false),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [index('ic_user_idx').on(t.userId)]
);

export const incomes = sqliteTable(
  'incomes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => incomeCategories.id),
    categoryName: text('category_name').notNull(),
    amount: integer('amount').notNull(), // integer cents
    description: text('description'),
    incomeDate: text('income_date').notNull(),
    moneyStatus: text('money_status', { enum: ['RECEIVED', 'PENDING'] })
      .notNull()
      .default('PENDING'),
    expectedReleaseDate: text('expected_release_date'),
    receivedDate: text('received_date'),
    profitFirstAllocated: integer('profit_first_allocated', { mode: 'boolean' })
      .notNull()
      .default(true),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index('incomes_user_status_idx').on(t.userId, t.moneyStatus),
    index('incomes_user_date_idx').on(t.userId, t.incomeDate),
    index('incomes_user_status_pf_idx').on(t.userId, t.moneyStatus, t.profitFirstAllocated),
    index('incomes_user_category_idx').on(t.userId, t.categoryId),
  ]
);

export const expenseCategories = sqliteTable(
  'expense_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    system: integer('system', { mode: 'boolean' }).notNull().default(false),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [index('ec_user_idx').on(t.userId)]
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => expenseCategories.id),
    categoryName: text('category_name').notNull(),
    amount: integer('amount').notNull(), // integer cents
    description: text('description'),
    expenseDate: text('expense_date').notNull(),
    paymentMethod: text('payment_method'), // nullable; validated to enum when present (D-10)
    deletedAt: text('deleted_at'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    index('expenses_user_idx').on(t.userId),
    index('expenses_user_date_idx').on(t.userId, t.expenseDate),
    index('expenses_user_category_idx').on(t.userId, t.categoryId),
  ]
);
```

### Zod Schemas (API layer)

```typescript
// Source: /mnt/c/dev/profitfirst/practice/src/server/validations/income.ts (verified)
// Source: /mnt/c/dev/profitfirst/practice/src/server/validations/expense.ts (verified)
// Adapted: D-03 removes type enum from category schema; D-10 tightens paymentMethod

const PAYMENT_METHOD_VALUES = ['cash', 'gcash', 'bank_transfer', 'maya', 'check'] as const;

export const createIncomeSchema = z.object({
  categoryId: z.number().int().positive(),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  incomeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moneyStatus: z.enum(['RECEIVED', 'PENDING']),
  expectedReleaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  profitFirstAllocated: z.boolean().default(true),
});

export const receiveIncomeSchema = z.object({
  receivedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const createIncomeCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export const createExpenseSchema = z.object({
  categoryId: z.number().int().positive(),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional().nullable(), // D-10: validated enum
});

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100),
});
```

### Currency Formatter (apps/web/src/lib/)

```typescript
// Source: D-08 decision; reference formatCurrency() in /mnt/c/dev/profitfirst/practice/src/lib/utils.ts
// Single swap point for Phase 6 user-selectable currency

/** Format integer cents as a display string with hardcoded ₱ prefix (Phase 6 will parameterize) */
export function formatCurrency(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
```

---

## State of the Art

| Old Approach                                          | Current Approach              | When Changed                | Impact                                                 |
| ----------------------------------------------------- | ----------------------------- | --------------------------- | ------------------------------------------------------ |
| `useSearchParams` + `router.replace` for filter state | `nuqs` `useQueryState`        | nuqs v2 (stable)            | Type-safe, SSR-compatible, no manual URL serialization |
| Numbered pagination controls                          | Load-more button (D-06)       | Project decision            | Simpler UX; accumulates client-side                    |
| `revalidateTag` for mutations                         | `revalidatePath` per resource | Still current in Next.js 15 | Simple and effective for page-scoped cache             |

**Deprecated/outdated:**

- `router.push` with manual searchParams string building: use nuqs instead
- `pages/` directory data patterns: App Router only (existing baseline)

---

## Assumptions Log

| #   | Claim                                                                                                                                                           | Section                           | Risk if Wrong                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Server actions calling Workers API directly (server-to-server) is the correct pattern for mutations; no general BFF proxy route is needed for server-side calls | Architecture Patterns / Pitfall 3 | If wrong, need to create a general `apps/web/src/app/api/[...path]/route.ts` proxy; low risk since server-to-server is standard Next.js App Router pattern |
| A2  | `$onUpdate` in Drizzle for `updatedAt` works correctly with Cloudflare D1 SQLite dialect                                                                        | Code Examples (Schema)            | If wrong, updatedAt may not auto-update; can fall back to explicit `.set({ updatedAt: new Date().toISOString() })` in every update call                    |
| A3  | Load-more using server actions returning data arrays (rather than client fetch) avoids the BFF proxy extension                                                  | Architecture Patterns (Pattern 5) | If wrong (e.g., due to server action response size limits), need to create a BFF GET proxy                                                                 |

---

## Open Questions

1. **Load-more: server action vs client fetch**
   - What we know: Server actions can return data; client components can receive it via `useActionState` or direct call
   - What's unclear: For load-more, calling a server action to fetch the next page of results is clean but unorthodox; the reference uses server components for initial load and numbered pagination
   - Recommendation: Use server actions returning `{ content, last }` for load-more fetches; this avoids creating a new BFF proxy route and keeps all API calls server-side

2. **nuqs NuqsAdapter placement**
   - What we know: nuqs requires `NuqsAdapter` from `nuqs/adapters/next/app` in the layout
   - What's unclear: Whether the root `apps/web/src/app/layout.tsx` already has it (it does not — Phase 1 didn't need it)
   - Recommendation: Add `NuqsAdapter` wrapper in root layout as a Wave 0 task (no UI changes, just provider setup)

---

## Environment Availability

| Dependency                         | Required By               | Available        | Version           | Fallback                          |
| ---------------------------------- | ------------------------- | ---------------- | ----------------- | --------------------------------- |
| Cloudflare D1 (local via wrangler) | All API integration tests | ✓ (wrangler dev) | wrangler 4.78.0   | miniflare in-memory D1 for Vitest |
| Node.js 22                         | Dev/build                 | ✓                | 22.x (per .nvmrc) | —                                 |
| npm 10                             | Package management        | ✓                | 10.x              | —                                 |

No missing dependencies with blocking impact.

---

## Validation Architecture

### Test Framework

| Property           | Value                            |
| ------------------ | -------------------------------- |
| Framework          | Vitest 3.0.0                     |
| Config file        | `apps/api/vitest.config.ts`      |
| Quick run command  | `cd apps/api && npm run test`    |
| Full suite command | `npm run test` (turbo workspace) |

### Phase Requirements → Test Map

| Req ID | Behavior                                                          | Test Type | Automated Command                                 | File Exists? |
| ------ | ----------------------------------------------------------------- | --------- | ------------------------------------------------- | ------------ |
| INC-01 | POST /api/incomes creates record with correct cents               | unit      | `cd apps/api && npm run test -- income`           | ❌ Wave 0    |
| INC-02 | GET /api/incomes with search/filter/date params                   | unit      | `cd apps/api && npm run test -- income`           | ❌ Wave 0    |
| INC-03 | PUT /api/incomes/:id updates record                               | unit      | `cd apps/api && npm run test -- income`           | ❌ Wave 0    |
| INC-04 | DELETE /api/incomes/:id removes record                            | unit      | `cd apps/api && npm run test -- income`           | ❌ Wave 0    |
| INC-05 | PUT /api/incomes/:id/receive sets receivedDate + RECEIVED status  | unit      | `cd apps/api && npm run test -- income`           | ❌ Wave 0    |
| INC-06 | Category CRUD + system protection + cascade rename + block-in-use | unit      | `cd apps/api && npm run test -- income-category`  | ❌ Wave 0    |
| EXP-01 | POST /api/expenses creates record                                 | unit      | `cd apps/api && npm run test -- expense`          | ❌ Wave 0    |
| EXP-02 | GET /api/expenses with date range filters                         | unit      | `cd apps/api && npm run test -- expense`          | ❌ Wave 0    |
| EXP-03 | PUT /api/expenses/:id updates record                              | unit      | `cd apps/api && npm run test -- expense`          | ❌ Wave 0    |
| EXP-04 | DELETE sets deletedAt; PATCH /restore clears it                   | unit      | `cd apps/api && npm run test -- expense`          | ❌ Wave 0    |
| EXP-05 | Expense category CRUD + protection + cascade                      | unit      | `cd apps/api && npm run test -- expense-category` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/api && npm run test -- <module-name>`
- **Per wave merge:** `npm run test` (full workspace)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/tests/income.test.ts` — unit tests for income service and routes (INC-01 through INC-05)
- [ ] `apps/api/tests/income-category.test.ts` — category CRUD, protection, cascade rename, block-in-use (INC-06)
- [ ] `apps/api/tests/expense.test.ts` — expense service and routes including soft delete/restore (EXP-01 through EXP-04)
- [ ] `apps/api/tests/expense-category.test.ts` — category CRUD, protection, cascade (EXP-05)
- [ ] `apps/api/tests/helpers/db.ts` — in-memory D1 test helper (mock or miniflare-based D1 instance)

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category         | Applies                        | Standard Control                                                          |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| V2 Authentication     | yes (every route)              | `requireAuth` middleware — existing Phase 1 pattern                       |
| V3 Session Management | no (tokens handled in Phase 1) | —                                                                         |
| V4 Access Control     | yes                            | Every service function checks `userId` ownership before read/write/delete |
| V5 Input Validation   | yes                            | Zod schemas on every POST/PUT/PATCH body and GET query                    |
| V6 Cryptography       | no                             | No new crypto in this phase                                               |

### Ownership Enforcement Pattern

Every service function MUST scope queries to `userId`. The API guarantees a user cannot read or mutate another user's records:

```typescript
// Pattern: scope every query to userId (verified from reference + Phase 1 auth pattern)
const row = await db.query.incomes.findFirst({
  where: and(
    eq(incomes.id, id),
    eq(incomes.userId, userId) // NEVER omit this condition
  ),
});
if (!row) throw new HTTPException(404, { message: 'not_found' });
// Note: return 404 (not 403) so the existence of other users' records is not leaked
```

### Known Threat Patterns

| Pattern                                                             | STRIDE                 | Standard Mitigation                                                                                  |
| ------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| IDOR (accessing other user's records)                               | Elevation of Privilege | Every DB query includes `eq(table.userId, userId)` from `requireAuth`                                |
| Amount tampering (negative amounts)                                 | Tampering              | Zod `.positive()` on amount; stored as unsigned-in-practice cents                                    |
| Category injection (invalid categoryId from another user)           | Tampering              | `resolveCategoryName` validates category ownership before insert                                     |
| Mass assignment (setting profitFirstAllocated or system via update) | Tampering              | System flag never in update schema; profitFirstAllocated only in income create/update (not category) |
| SQL injection                                                       | Tampering              | Drizzle parameterized queries only; no raw SQL string concatenation                                  |

---

## Project Constraints (from CLAUDE.md)

- **No new top-level directories** — all new files go in existing `apps/api/src/`, `apps/web/src/`, `packages/db/src/`
- **Thin routes** — business logic in `services/`; HTTP concerns (`c.req`, `c.json`) stay in routes
- **No `apps/*/src/utils/`** — formatters go in `lib/`
- **Path aliases** — use `@/*` and `@app/db`; no `../../..` imports
- **TypeScript strict** — no `any`; narrow `unknown` at boundary
- **Zod validation** at route entry; return 422 for validation failures
- **Conventional commits** — `feat:`, `fix:`, `chore:`
- **No new deps without user approval** — Phase 2 uses only pinned packages; this constraint is satisfied

---

## Sources

### Primary (HIGH confidence)

- Reference implementation: `/mnt/c/dev/profitfirst/practice/src/server/services/income-service.ts` — income CRUD, receive transition, pagination
- Reference implementation: `/mnt/c/dev/profitfirst/practice/src/server/services/expense-service.ts` — expense CRUD, soft delete, restore, `resolveCategoryName`
- Reference implementation: `/mnt/c/dev/profitfirst/practice/src/server/services/income-category-service.ts` — category protection logic
- Reference implementation: `/mnt/c/dev/profitfirst/practice/src/server/services/expense-category-service.ts` — category protection logic
- Reference implementation: `/mnt/c/dev/profitfirst/practice/src/server/db/schema.ts` lines 303–405 — table shapes
- Reference implementation: `/mnt/c/dev/profitfirst/practice/src/server/validations/income.ts`, `expense.ts`, `common.ts` — Zod schemas
- Existing codebase: `apps/api/src/middleware/auth.ts` — `requireAuth` pattern
- Existing codebase: `apps/api/src/index.ts` — CORS config (allowMethods gap identified)
- Existing codebase: `packages/db/src/schema.ts` — existing schema pattern
- Context7 `/47ng/nuqs` — NuqsAdapter setup, useQueryState, options
- Context7 `/drizzle-team/drizzle-orm-docs` — limit/offset pagination, update returning, soft delete patterns

### Secondary (MEDIUM confidence)

- `npm view nuqs`, `npm view @tanstack/react-table`, `npm view date-fns`, `npm view sonner` — version verification
- `npm view drizzle-orm` — version verification (0.45.2 confirmed)

### Tertiary (LOW confidence)

- None — all key claims verified against codebase or official documentation

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified against npm registry; project-pinned
- Architecture: HIGH — directly derived from existing Phase 1 patterns and reference implementation
- Pitfalls: HIGH — sourced from code review of reference and existing codebase (CORS gap directly observed)
- Schema: HIGH — copied and adapted from reference schema (verified by direct file read)
- Load-more pattern: MEDIUM — pattern is sound but server-action-based load-more is slightly non-standard; fallback documented

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable stack; 30-day validity)
