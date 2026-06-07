# Phase 2: Income & Expenses - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 26 new/modified files
**Analogs found:** 26 / 26 (all have at least a role-match analog from Phase 1)

---

## File Classification

| New/Modified File                                               | Role                 | Data Flow        | Closest Analog                                 | Match Quality                            |
| --------------------------------------------------------------- | -------------------- | ---------------- | ---------------------------------------------- | ---------------------------------------- |
| `packages/db/src/schema.ts`                                     | schema               | CRUD             | `packages/db/src/schema.ts` (existing)         | exact — add tables to same file          |
| `apps/api/src/schemas/common.ts`                                | schema/validation    | request-response | `apps/api/src/schemas/auth.ts`                 | role-match                               |
| `apps/api/src/schemas/income.ts`                                | schema/validation    | request-response | `apps/api/src/schemas/auth.ts`                 | role-match                               |
| `apps/api/src/schemas/expense.ts`                               | schema/validation    | request-response | `apps/api/src/schemas/auth.ts`                 | role-match                               |
| `apps/api/src/services/income-service.ts`                       | service              | CRUD             | `apps/api/src/services/auth-service.ts`        | role-match                               |
| `apps/api/src/services/income-category-service.ts`              | service              | CRUD             | `apps/api/src/services/auth-service.ts`        | role-match                               |
| `apps/api/src/services/expense-service.ts`                      | service              | CRUD             | `apps/api/src/services/auth-service.ts`        | role-match                               |
| `apps/api/src/services/expense-category-service.ts`             | service              | CRUD             | `apps/api/src/services/auth-service.ts`        | role-match                               |
| `apps/api/src/routes/incomes.ts`                                | route                | request-response | `apps/api/src/routes/auth.ts`                  | role-match                               |
| `apps/api/src/routes/income-categories.ts`                      | route                | request-response | `apps/api/src/routes/auth.ts`                  | role-match                               |
| `apps/api/src/routes/expenses.ts`                               | route                | request-response | `apps/api/src/routes/auth.ts`                  | role-match                               |
| `apps/api/src/routes/expense-categories.ts`                     | route                | request-response | `apps/api/src/routes/auth.ts`                  | role-match                               |
| `apps/api/src/index.ts`                                         | config               | request-response | `apps/api/src/index.ts` (existing)             | exact — modify CORS + mount routes       |
| `apps/web/src/server/api.ts`                                    | service              | request-response | `apps/web/src/app/api/auth/[...path]/route.ts` | data-flow-match (server-to-server fetch) |
| `apps/web/src/lib/format-currency.ts`                           | utility              | transform        | `apps/web/src/lib/utils.ts`                    | role-match                               |
| `apps/web/src/lib/format-date.ts`                               | utility              | transform        | `apps/web/src/lib/utils.ts`                    | role-match                               |
| `apps/web/src/lib/constants.ts`                                 | utility              | —                | `apps/web/src/lib/utils.ts`                    | role-match                               |
| `apps/web/src/app/income/page.tsx`                              | component (RSC page) | request-response | `apps/web/src/app/(auth)/login/page.tsx`       | role-match                               |
| `apps/web/src/app/income/new/page.tsx`                          | component (RSC page) | request-response | `apps/web/src/app/(auth)/login/page.tsx`       | role-match                               |
| `apps/web/src/app/income/new/_actions/create-income.ts`         | server action        | request-response | `apps/web/src/app/api/auth/[...path]/route.ts` | data-flow-match                          |
| `apps/web/src/app/income/_components/income-overview.tsx`       | component (client)   | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match                               |
| `apps/web/src/app/income/_components/income-filters.tsx`        | component (client)   | request-response | `apps/web/src/components/auth/LoginForm.tsx`   | role-match                               |
| `apps/web/src/app/income/_components/edit-income-dialog.tsx`    | component (client)   | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match                               |
| `apps/web/src/app/income/_components/receive-income-dialog.tsx` | component (client)   | request-response | `apps/web/src/components/auth/LoginForm.tsx`   | role-match                               |
| `apps/web/src/app/expenses/page.tsx`                            | component (RSC page) | request-response | `apps/web/src/app/(auth)/login/page.tsx`       | role-match                               |
| `apps/web/src/app/expenses/new/page.tsx`                        | component (RSC page) | request-response | `apps/web/src/app/(auth)/login/page.tsx`       | role-match                               |
| `apps/web/src/app/expenses/new/_actions/create-expense.ts`      | server action        | request-response | `apps/web/src/app/api/auth/[...path]/route.ts` | data-flow-match                          |
| `apps/web/src/app/expenses/_components/expenses-overview.tsx`   | component (client)   | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match                               |
| `apps/web/src/app/expenses/_components/edit-expense-dialog.tsx` | component (client)   | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match                               |
| `apps/api/tests/income.test.ts`                                 | test                 | —                | `apps/api/tests/index.test.ts`                 | exact                                    |
| `apps/api/tests/income-category.test.ts`                        | test                 | —                | `apps/api/tests/index.test.ts`                 | exact                                    |
| `apps/api/tests/expense.test.ts`                                | test                 | —                | `apps/api/tests/index.test.ts`                 | exact                                    |
| `apps/api/tests/expense-category.test.ts`                       | test                 | —                | `apps/api/tests/index.test.ts`                 | exact                                    |

---

## Pattern Assignments

### `packages/db/src/schema.ts` (schema, CRUD)

**Analog:** `packages/db/src/schema.ts` (existing — append to same file)

**Imports pattern** (lines 1):

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
// index is new — add to existing import from 'drizzle-orm/sqlite-core'
```

**Core table pattern** (lines 3–49):

```typescript
// Existing pattern: integer PK autoIncrement, text ISO dates via $defaultFn, FK references(() => users.id, { onDelete: 'cascade' })
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // ...
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});
```

**New tables follow the same shape, adding:**

- `index()` call in the third `sqliteTable` argument (array of index definitions)
- `$onUpdate(() => new Date().toISOString())` for `updatedAt` columns
- `integer(col, { mode: 'boolean' })` for boolean flags (`system`, `profitFirstAllocated`)
- `text(col, { enum: [...] })` for constrained text columns (`moneyStatus`)

---

### `apps/api/src/schemas/common.ts` (schema/validation, request-response)

**Analog:** `apps/api/src/schemas/auth.ts`

**Imports pattern** (line 1):

```typescript
import { z } from 'zod';
```

**Core pattern** (lines 1–44 of auth.ts):

```typescript
// Named exports only, no default export
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
```

---

### `apps/api/src/schemas/income.ts` (schema/validation, request-response)

**Analog:** `apps/api/src/schemas/auth.ts`

**Imports pattern** (line 1 of auth.ts):

```typescript
import { z } from 'zod';
```

**Core validation pattern** (lines 3–43 of auth.ts — named Zod object exports):

```typescript
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

export const updateIncomeSchema = createIncomeSchema.partial();

export const receiveIncomeSchema = z.object({
  receivedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const createIncomeCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateIncomeCategorySchema = createIncomeCategorySchema;

export const incomeQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  moneyStatus: z.enum(['RECEIVED', 'PENDING']).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
```

---

### `apps/api/src/schemas/expense.ts` (schema/validation, request-response)

**Analog:** `apps/api/src/schemas/auth.ts`

**Core pattern** (same as income.ts shape):

```typescript
import { z } from 'zod';

const PAYMENT_METHOD_VALUES = ['cash', 'gcash', 'bank_transfer', 'maya', 'check'] as const;

export const createExpenseSchema = z.object({
  categoryId: z.number().int().positive(),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema;

export const expenseQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
```

---

### `apps/api/src/services/income-service.ts` (service, CRUD)

**Analog:** `apps/api/src/services/auth-service.ts`

**Imports pattern** (lines 1–14 of auth-service.ts):

```typescript
import { HTTPException } from 'hono/http-exception';
import { eq, and, desc, like, or, sql, isNull, gte, lte } from 'drizzle-orm';
import { createDb } from '@app/db';
import { incomes, incomeCategories } from '@app/db/schema';
```

**Service factory pattern** (auth-service uses named exports per function; Phase 2 uses factory — see RESEARCH.md Pattern 1):

```typescript
// Factory function accepting the Drizzle db instance (not the raw D1 binding)
export function createIncomeService(db: ReturnType<typeof createDb>) {
  return {
    async list(userId: number, params: IncomeListParams) { ... },
    async create(userId: number, input: CreateIncomeInput) { ... },
    async getById(id: number, userId: number) { ... },
    async update(id: number, userId: number, input: UpdateIncomeInput) { ... },
    async receive(id: number, userId: number, receivedDate?: string) { ... },
    async delete(id: number, userId: number) { ... },
  };
}
```

**Ownership enforcement pattern** — scope every query to `userId` (from auth-service.ts, applied uniformly):

```typescript
// From auth-service.ts lines 57–82: always filter by the user's own data
const row = await db.query.incomes.findFirst({
  where: and(
    eq(incomes.id, id),
    eq(incomes.userId, userId) // NEVER omit — IDOR prevention
  ),
});
if (!row) throw new HTTPException(404, { message: 'not_found' });
```

**Error pattern** (auth-service.ts lines 68–69, 280–281):

```typescript
// Throw HTTPException for expected domain errors; generic 500 caught by app.onError
throw new HTTPException(404, { message: 'not_found' });
throw new HTTPException(400, { message: 'category_in_use' });
throw new HTTPException(400, { message: 'cannot_edit_system_category' });
```

**Drizzle update pattern** (auth-service.ts lines 176–178):

```typescript
await db
  .update(incomes)
  .set({ moneyStatus: 'RECEIVED', receivedDate: date })
  .where(and(eq(incomes.id, id), eq(incomes.userId, userId)));
```

---

### `apps/api/src/services/income-category-service.ts` (service, CRUD)

**Analog:** `apps/api/src/services/auth-service.ts`

**Factory + seeding pattern** (RESEARCH.md Pattern 2):

```typescript
export function createIncomeCategoryService(db: ReturnType<typeof createDb>) {
  async function seedDefaultsIfNeeded(userId: number) {
    const existing = await db
      .select({ id: incomeCategories.id })
      .from(incomeCategories)
      .where(eq(incomeCategories.userId, userId))
      .limit(1);
    if (existing.length > 0) return;
    await db
      .insert(incomeCategories)
      .values(DEFAULT_INCOME_CATEGORIES.map((name) => ({ name, system: true, userId })))
      .onConflictDoNothing(); // race-safe (Pitfall 4)
  }

  return {
    async list(userId: number) {
      await seedDefaultsIfNeeded(userId);
      return db.select().from(incomeCategories).where(eq(incomeCategories.userId, userId));
    },
    // ...
  };
}
```

**Cascade rename pattern** (RESEARCH.md Pattern 3):

```typescript
await Promise.all([
  db.update(incomeCategories).set({ name }).where(eq(incomeCategories.id, id)),
  db
    .update(incomes)
    .set({ categoryName: name })
    .where(and(eq(incomes.categoryId, id), eq(incomes.userId, userId))),
]);
```

**Block-delete-in-use pattern** (RESEARCH.md Pattern 4):

```typescript
const usage = await db
  .select({ count: sql<number>`COUNT(*)` })
  .from(incomes)
  .where(and(eq(incomes.categoryId, id), eq(incomes.userId, userId)));
const count = usage[0]?.count ?? 0;
if (count > 0) throw new HTTPException(400, { message: 'category_in_use' });
```

---

### `apps/api/src/services/expense-service.ts` (service, CRUD)

**Analog:** `apps/api/src/services/auth-service.ts`

Same factory pattern as income-service.ts, plus:

**Soft delete / restore pattern** (RESEARCH.md Pattern 7):

```typescript
// Soft delete: set deletedAt
await db
  .update(expenses)
  .set({ deletedAt: new Date().toISOString() })
  .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));

// Restore: clear deletedAt
await db
  .update(expenses)
  .set({ deletedAt: null })
  .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));

// List — isNull guard to exclude deleted from totals
import { isNull } from 'drizzle-orm';
const activeWhere = and(eq(expenses.userId, userId), isNull(expenses.deletedAt));
```

---

### `apps/api/src/services/expense-category-service.ts` (service, CRUD)

**Analog:** `apps/api/src/services/auth-service.ts`

Identical factory + seeding + cascade-rename + block-delete pattern as `income-category-service.ts`, applied to `expenseCategories` / `expenses` tables.

---

### `apps/api/src/routes/incomes.ts` (route, request-response)

**Analog:** `apps/api/src/routes/auth.ts`

**Imports pattern** (lines 1–5 of auth.ts):

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { createDb } from '@app/db';
import { createIncomeService } from '@/services/income-service';
import {
  incomeQuerySchema,
  createIncomeSchema,
  updateIncomeSchema,
  receiveIncomeSchema,
} from '@/schemas/income';
import type { Bindings, Variables } from '@/types';
```

**Router init pattern** (auth.ts line 34):

```typescript
const incomesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
```

**Auth guard — applied at router level** (not per-route; mounted behind `requireAuth` in index.ts):

```typescript
// In apps/api/src/index.ts:
app.use('/api/incomes/*', requireAuth);
app.route('/api/incomes', incomesRouter);
// userId is available in every handler via c.get('userId')
```

**Validation hook pattern** (auth.ts lines 38–45 — explicit 422 on validation failure):

```typescript
incomesRouter.post(
  '/',
  zValidator('json', createIncomeSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const db = createDb(c.env.DB);
    const svc = createIncomeService(db);
    const result = await svc.create(userId, input);
    return c.json({ data: result }, 201);
  }
);
```

**Query params validation** (same zValidator hook, target 'query'):

```typescript
incomesRouter.get(
  '/',
  zValidator('query', incomeQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid query params' } }, 422);
    }
  }),
  async (c) => {
    const params = c.req.valid('query');
    const userId = c.get('userId');
    const svc = createIncomeService(createDb(c.env.DB));
    const result = await svc.list(userId, params);
    return c.json({ data: result });
  }
);
```

**Special action endpoint** (`PUT /:id/receive` — must be registered before `PUT /:id` to avoid param shadowing):

```typescript
incomesRouter.put('/:id/receive',
  zValidator('json', receiveIncomeSchema, (result, c) => { ... }),
  async (c) => {
    const id = Number(c.req.param('id'));
    const { receivedDate } = c.req.valid('json');
    const svc = createIncomeService(createDb(c.env.DB));
    await svc.receive(id, c.get('userId'), receivedDate);
    return c.json({ data: { message: 'received' } });
  }
);
```

**Export pattern** (auth.ts line 306):

```typescript
export { incomesRouter };
```

---

### `apps/api/src/routes/income-categories.ts` (route, request-response)

**Analog:** `apps/api/src/routes/auth.ts`

Same router pattern as incomes.ts. Standard CRUD: GET `/`, POST `/`, PUT `/:id`, DELETE `/:id`. No sub-actions.

---

### `apps/api/src/routes/expenses.ts` (route, request-response)

**Analog:** `apps/api/src/routes/auth.ts`

Same router pattern as incomes.ts. Extra endpoint:

```typescript
// PATCH /:id/restore — must register before any /:id handler
expensesRouter.patch('/:id/restore', async (c) => {
  const id = Number(c.req.param('id'));
  const svc = createExpenseService(createDb(c.env.DB));
  await svc.restore(id, c.get('userId'));
  return c.json({ data: { message: 'restored' } });
});
```

---

### `apps/api/src/routes/expense-categories.ts` (route, request-response)

**Analog:** `apps/api/src/routes/auth.ts`

Identical shape to `income-categories.ts` with expense schema/service imports.

---

### `apps/api/src/index.ts` — CORS + route mount modification

**Analog:** `apps/api/src/index.ts` (existing — targeted modification)

**CORS expansion** (line 20 — current value is `['GET', 'POST']`):

```typescript
// Change from:
allowMethods: ['GET', 'POST'],
// To:
allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
```

**Route mounting pattern** (lines 49 — copy existing pattern):

```typescript
// Existing:
app.route('/api/auth', authRouter);

// Add (each group behind requireAuth):
app.use('/api/incomes/*', requireAuth);
app.route('/api/incomes', incomesRouter);

app.use('/api/income-categories/*', requireAuth);
app.route('/api/income-categories', incomeCategoriesRouter);

app.use('/api/expenses/*', requireAuth);
app.route('/api/expenses', expensesRouter);

app.use('/api/expense-categories/*', requireAuth);
app.route('/api/expense-categories', expenseCategoriesRouter);
```

---

### `apps/web/src/server/api.ts` (service, request-response)

**Analog:** `apps/web/src/app/api/auth/[...path]/route.ts` (server-to-server fetch with access_token cookie)

**Core pattern** (route.ts lines 59–66 and 90–105 — server-only fetch with Bearer token):

```typescript
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
  const cookieStore = await cookies(); // async in Next.js 15 — matches route.ts line 64
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

Key alignment points with existing route.ts:

- `await cookies()` (line 64 of route.ts — async in Next.js 15)
- `process.env.API_BASE_URL` (line 61 of route.ts)
- Bearer token header (line 96 of route.ts: `headers.set('authorization', `Bearer ${token}`)`)

---

### `apps/web/src/lib/format-currency.ts` (utility, transform)

**Analog:** `apps/web/src/lib/utils.ts`

**File + export pattern** (utils.ts lines 1–6):

```typescript
// kebab-case filename, named export, no default export
export function formatCurrency(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Convert decimal pesos input to integer cents for storage */
export function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}
```

---

### `apps/web/src/lib/format-date.ts` (utility, transform)

**Analog:** `apps/web/src/lib/utils.ts`

```typescript
import { format } from 'date-fns';

/** Format an ISO date string (YYYY-MM-DD) or ISO datetime for display */
export function formatDate(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy');
}
```

---

### `apps/web/src/lib/constants.ts` (utility, config)

**Analog:** `apps/web/src/lib/utils.ts`

```typescript
// as const for literal inference (typescript.md rule)
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'maya', label: 'Maya' },
  { value: 'check', label: 'Check' },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value'];
```

---

### `apps/web/src/app/income/page.tsx` (RSC page, request-response)

**Analog:** `apps/web/src/app/(auth)/login/page.tsx`

**Page pattern** (login/page.tsx lines 1–9 — RSC, default export, no 'use client'):

```typescript
// Default export required for Next.js App Router route files
import { getSession } from '@/server/auth';
import { apiFetch } from '@/server/api';
import { redirect } from 'next/navigation';
import { IncomeOverview } from './_components/income-overview';

export default async function IncomePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  // SSR data fetch — runs server-side, no client exposure
  const data = await apiFetch<IncomeListResponse>('/api/incomes?page=0&limit=20');
  const categories = await apiFetch<CategoryListResponse>('/api/income-categories');
  return <IncomeOverview initialData={data} categories={categories} />;
}
```

---

### `apps/web/src/app/income/new/page.tsx` (RSC page, request-response)

**Analog:** `apps/web/src/app/(auth)/login/page.tsx`

Same RSC default export pattern. Fetches categories for the form select, renders a form component.

---

### `apps/web/src/app/income/new/_actions/create-income.ts` (server action, request-response)

**Analog:** `apps/web/src/app/api/auth/[...path]/route.ts` (server-to-server fetch pattern)

**Server action pattern:**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/server/api';
import { toCents } from '@/lib/format-currency';

export async function createIncomeAction(formData: FormData) {
  const amount = toCents(Number(formData.get('amount'))); // cents conversion (Pitfall 2)
  const body = {
    categoryId: Number(formData.get('categoryId')),
    amount,
    description: formData.get('description') as string | undefined,
    incomeDate: formData.get('incomeDate') as string,
    moneyStatus: formData.get('moneyStatus') as 'PENDING' | 'RECEIVED',
    profitFirstAllocated: formData.get('profitFirstAllocated') === 'true',
  };

  try {
    await apiFetch('/api/incomes', { method: 'POST', body: JSON.stringify(body) });
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.code };
    }
    return { error: 'unknown' };
  }

  revalidatePath('/income');
  redirect('/income');
}
```

---

### `apps/web/src/app/income/_components/income-overview.tsx` (client component, CRUD)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx`

**Client component pattern** (LoginForm.tsx lines 1–7 — 'use client', named export, Props interface):

```typescript
'use client';

import { useState, useTransition } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { toast } from 'sonner'; // LoginForm.tsx line 5

// Props interface with Props suffix (CLAUDE.md convention)
interface IncomeOverviewProps {
  initialData: IncomeListResponse;
  categories: CategoryListResponse;
}

export function IncomeOverview({ initialData, categories }: IncomeOverviewProps) {
  // ...
}
```

**toast pattern** (LoginForm.tsx lines 64, 67):

```typescript
toast.error('Something went wrong. Please try again.');
toast.success('Income recorded successfully.');
```

**submitting/pending state pattern** (LoginForm.tsx lines 21, 137):

```typescript
const [isPending, startTransition] = useTransition();
// Disable submit button while pending
<Button type="submit" disabled={isPending}>
  {isPending ? 'Saving…' : 'Save'}
</Button>
```

---

### `apps/web/src/app/income/_components/income-filters.tsx` (client component, request-response)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx`

Uses `useQueryState` from `nuqs` for URL-persisted filter state. Debounced search input (300ms via `setTimeout` / `useEffect`). Named export, 'use client', Props interface.

---

### `apps/web/src/app/income/_components/edit-income-dialog.tsx` (client component, CRUD)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx`

Dialog wrapping an edit form. Same 'use client', named export, toast pattern. Uses shadcn Dialog primitive. Calls a server action for update and delete. Confirm pattern for delete (same approach as login validation flow in LoginForm.tsx).

---

### `apps/web/src/app/income/_components/receive-income-dialog.tsx` (client component, request-response)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx`

Small dialog with a single date input (D-14). Same 'use client', named export, toast + pending state pattern.

---

### `apps/web/src/app/income/_components/income-actions.ts` (server actions module, request-response)

**Analog:** `apps/web/src/app/api/auth/[...path]/route.ts` (server-to-server pattern)

```typescript
'use server';
// Named server actions: updateIncomeAction, deleteIncomeAction, receiveIncomeAction
// Each calls apiFetch, catches ApiError, revalidatePath('/income')
```

---

### `apps/web/src/app/expenses/page.tsx`, `new/page.tsx` (RSC page, request-response)

**Analog:** `apps/web/src/app/(auth)/login/page.tsx`

Identical RSC default export pattern as income pages. `page.tsx` fetches expense list; `new/page.tsx` fetches expense categories.

---

### `apps/web/src/app/expenses/new/_actions/create-expense.ts` (server action, request-response)

**Analog:** Same as `create-income.ts` — 'use server', apiFetch, toCents, revalidatePath('/expenses'), redirect.

---

### `apps/web/src/app/expenses/_components/expenses-overview.tsx` and `edit-expense-dialog.tsx` (client components, CRUD)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx`

Same 'use client', Props interface, toast, pending state pattern. `expense-list.tsx` additionally renders deleted rows with inline restore action (soft delete — shows `deletedAt` rows with greyed styling + RotateCcw icon button).

---

### `apps/web/src/app/expenses/_components/expense-actions.ts` (server actions module, request-response)

**Analog:** `apps/web/src/app/api/auth/[...path]/route.ts`

```typescript
'use server';
// updateExpenseAction, deleteExpenseAction, restoreExpenseAction
// restoreExpenseAction calls apiFetch with method: 'PATCH' on /:id/restore
```

---

### `apps/api/tests/income.test.ts`, `income-category.test.ts`, `expense.test.ts`, `expense-category.test.ts` (tests)

**Analog:** `apps/api/tests/index.test.ts`

**Test structure pattern** (index.test.ts lines 1–18):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';

// app.request() for Hono in-process testing — no HTTP server needed
describe('incomes routes', () => {
  describe('POST /api/incomes', () => {
    it('creates an income record and returns 201', async () => {
      const res = await app.request('/api/incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer <test-token>' },
        body: JSON.stringify({
          /* ... */
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data).toHaveProperty('id');
    });
  });
});
```

**Path aliases** in vitest config (`apps/api/vitest.config.ts`):

```typescript
// Already configured:
'@': path.resolve(__dirname, './src'),
'@app/db/schema': path.resolve(__dirname, '../../packages/db/src/schema.ts'),
'@app/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
```

Test helper for in-memory D1 (`apps/api/tests/helpers/db.ts`) should use miniflare or Vitest mock — no existing analog; see RESEARCH.md §Wave 0 Gaps.

---

## Shared Patterns

### Authentication (requireAuth middleware)

**Source:** `apps/api/src/middleware/auth.ts` (lines 1–35)
**Apply to:** All 4 route files — mount via `app.use('/api/<resource>/*', requireAuth)` in `index.ts`

```typescript
// From apps/api/src/middleware/auth.ts lines 19–35
export const requireAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'unauthorized' });
    }
    const token = authHeader.slice(7);
    try {
      const payload = await verifyAccessToken(token, c.env.JWT_ACCESS_SECRET);
      c.set('userId', Number(payload.sub));
    } catch {
      throw new HTTPException(401, { message: 'unauthorized' });
    }
    await next();
  }
);
// In route handlers: const userId = c.get('userId');
```

### Error Handling (structured error shape + global handler)

**Source:** `apps/api/src/index.ts` lines 28–39
**Apply to:** All route handlers — throw `HTTPException`; the global `app.onError` shapes the response

```typescript
// From apps/api/src/index.ts lines 28–39
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const code = err.message || 'error';
    const retryAfter = err.res?.headers.get('Retry-After');
    const headers = retryAfter ? { 'Retry-After': retryAfter } : undefined;
    return c.json({ error: { code, message: code } }, err.status, headers);
  }
  console.error('unhandled error:', { path: c.req.path, error: err });
  return c.json({ error: { code: 'internal_error', message: 'Something went wrong' } }, 500);
});
// Routes: throw new HTTPException(404, { message: 'not_found' });
// Routes: throw new HTTPException(400, { message: 'category_in_use' });
```

### Validation (zValidator with explicit 422 hook)

**Source:** `apps/api/src/routes/auth.ts` lines 38–45
**Apply to:** All POST/PUT/PATCH handlers in all 4 route files; query params on GET list endpoints

```typescript
// From apps/api/src/routes/auth.ts lines 38–45
zValidator('json', someSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
  }
}),
```

### DB Instance Creation (per-request factory)

**Source:** `apps/api/src/routes/auth.ts` line 275; `packages/db/src/index.ts` lines 6–8
**Apply to:** All route handler functions in all 4 route files

```typescript
// From apps/api/src/routes/auth.ts — createDb called inline in handler
const db = createDb(c.env.DB);
// Pass db to service factory:
const svc = createIncomeService(db);
```

### Session Access in Server Components

**Source:** `apps/web/src/server/auth.ts` lines 18–35
**Apply to:** All RSC page files (`income/page.tsx`, `income/new/page.tsx`, `expenses/page.tsx`, `expenses/new/page.tsx`)

```typescript
// From apps/web/src/server/auth.ts lines 18–35
import { getSession } from '@/server/auth';
import { redirect } from 'next/navigation';

const session = await getSession();
if (!session) redirect('/login');
```

### Toast Notifications

**Source:** `apps/web/src/components/auth/LoginForm.tsx` lines 5, 64–65
**Apply to:** All client components with mutations

```typescript
import { toast } from 'sonner'; // line 5 of LoginForm.tsx
// Success:
toast.success('Income saved successfully.');
// Error:
toast.error('Something went wrong. Please try again.');
```

### Path Aliases

**Source:** `CLAUDE.md`, `tsconfig.base.json`
**Apply to:** Every new file

```typescript
// ✅ use always:
import { createDb } from '@app/db';
import { incomes } from '@app/db/schema';
import { requireAuth } from '@/middleware/auth';
import { apiFetch } from '@/server/api';
// ❌ never:
import { createDb } from '../../../packages/db/src/index';
```

---

## No Analog Found

All Phase 2 files have at least a role-match analog from Phase 1. The following have no direct codebase precedent but are fully specified in RESEARCH.md:

| File                                                     | Role               | Data Flow | Reason                                                                                           |
| -------------------------------------------------------- | ------------------ | --------- | ------------------------------------------------------------------------------------------------ |
| `apps/api/tests/helpers/db.ts`                           | test helper        | —         | No in-memory D1 test helper exists yet; use miniflare or Vitest mock per RESEARCH.md Wave 0 Gaps |
| `apps/web/src/app/income/_components/income-list.tsx`    | component (client) | CRUD      | No existing list/table component; follow load-more pattern from RESEARCH.md Pattern 5            |
| `apps/web/src/app/expenses/_components/expense-list.tsx` | component (client) | CRUD      | Same as income-list; additionally render deleted rows with inline restore button                 |
| `apps/web/src/app/income/_components/income-form.tsx`    | component (client) | CRUD      | No existing multi-field form component; copy LoginForm.tsx structure, add category select        |
| `apps/web/src/app/expenses/_components/expense-form.tsx` | component (client) | CRUD      | Same as income-form; add payment method select using `PAYMENT_METHODS` from `@/lib/constants`    |

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/`, `packages/db/src/`
**Files scanned:** 22 existing source files
**Pattern extraction date:** 2026-06-06
