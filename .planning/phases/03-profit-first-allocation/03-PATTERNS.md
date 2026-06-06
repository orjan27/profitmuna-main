# Phase 3: Profit First Allocation - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 13 new/modified files
**Analogs found:** 11 / 13

---

## File Classification

| New/Modified File                                                                | Role       | Data Flow        | Closest Analog                                 | Match Quality |
| -------------------------------------------------------------------------------- | ---------- | ---------------- | ---------------------------------------------- | ------------- |
| `packages/db/src/schema.ts` (modify)                                             | model      | CRUD             | `packages/db/src/schema.ts` (existing tables)  | exact         |
| `apps/api/src/services/profit-first-service.ts`                                  | service    | CRUD             | `apps/api/src/services/auth-service.ts`        | exact         |
| `apps/api/src/routes/profit-first.ts`                                            | route      | request-response | `apps/api/src/routes/auth.ts`                  | exact         |
| `apps/api/src/schemas/profit-first.ts`                                           | utility    | transform        | `apps/api/src/schemas/auth.ts`                 | exact         |
| `apps/api/src/index.ts` (modify)                                                 | config     | request-response | `apps/api/src/index.ts` (existing)             | exact         |
| `apps/web/src/app/api/profit-first/[...path]/route.ts`                           | middleware | request-response | `apps/web/src/app/api/auth/[...path]/route.ts` | exact         |
| `apps/web/src/app/(dashboard)/profit-first/page.tsx`                             | component  | request-response | `apps/web/src/app/(auth)/login/page.tsx`       | role-match    |
| `apps/web/src/app/(dashboard)/profit-first/loading.tsx`                          | component  | request-response | `apps/web/src/app/(auth)/login/page.tsx`       | role-match    |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-overview.tsx`          | component  | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match    |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-percentage-editor.tsx` | component  | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match    |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-account-form.tsx`      | component  | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match    |
| `apps/web/src/server/profit-first-actions.ts`                                    | service    | request-response | `apps/web/src/server/auth.ts`                  | role-match    |
| `apps/web/src/components/amount-visibility.tsx`                                  | component  | event-driven     | none                                           | no-analog     |
| `apps/web/src/lib/format-currency.ts`                                            | utility    | transform        | `apps/web/src/lib/utils.ts`                    | partial       |
| `apps/api/tests/profit-first.test.ts`                                            | test       | CRUD             | `apps/api/tests/index.test.ts`                 | role-match    |

---

## Pattern Assignments

### `packages/db/src/schema.ts` (model, CRUD — additive)

**Analog:** `packages/db/src/schema.ts` (existing tables — `users`, `refreshTokens`, `authTokens`)

**Imports pattern** (lines 1-1):

```typescript
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
```

Note: add `uniqueIndex` to the existing import — not currently used in the file.

**FK + enum column pattern** (lines 17-29, `refreshTokens` table):

```typescript
userId: integer('user_id')
  .notNull()
  .references(() => users.id, { onDelete: 'cascade' }),
```

**Enum text column pattern** (lines 31-39, `authTokens.purpose`):

```typescript
purpose: text('purpose', { enum: ['verify_email', 'reset_password'] }).notNull(),
```

**Timestamp default pattern** (lines 14, 28):

```typescript
createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
```

**New table to add — full shape:**

```typescript
export const profitFirstAccounts = sqliteTable(
  'profit_first_accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    targetPercentage: integer('target_percentage').notNull(), // basis points (0–10000)
    color: text('color').notNull(), // hex from PF_DEFAULT_COLORS
    sortOrder: integer('sort_order').notNull().default(0),
    accountType: text('account_type', {
      enum: ['PROFIT', 'OWNERS_PAY', 'TAX', 'OPEX', 'CUSTOM'],
    })
      .notNull()
      .default('CUSTOM'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex('pfa_user_name_unique').on(table.userId, table.name)]
);
```

---

### `apps/api/src/services/profit-first-service.ts` (service, CRUD)

**Analog:** `apps/api/src/services/auth-service.ts`

**Imports pattern** (lines 1-14):

```typescript
import { HTTPException } from 'hono/http-exception';
import { eq, and } from 'drizzle-orm';

import { createDb } from '@app/db';
import { users, authTokens, ... } from '@app/db/schema';
```

For this file: import `{ eq, and, ne, sql }` from `drizzle-orm`, `createDb` from `@app/db`, and `{ profitFirstAccounts, incomes }` from `@app/db/schema`.

**Service function signature pattern** (lines 126-130):

```typescript
export async function register(
  d1: D1Database,
  appBaseUrl: string,
  input: RegisterInput
): Promise<RegisterResult> {
  const db = createDb(d1);
  // ... business logic
}
```

For the profit-first service, use the factory pattern instead (see RESEARCH.md Pattern 1): `export function createProfitFirstService(db: ReturnType<typeof createDb>)` — do NOT call `createDb` inside each method; receive `db` at factory construction time so the route can pass `createDb(c.env.DB)` once per request.

**D1 per-request binding pattern** (lines 131, and throughout):

```typescript
// ALWAYS inside the route handler, never at module scope:
const db = createDb(d1);
```

**HTTPException throw pattern** (lines 172, 280, 339):

```typescript
throw new HTTPException(404, { message: 'not_found' });
throw new HTTPException(400, { message: 'Cannot delete a default allocation account' });
throw new HTTPException(401, { message: 'unauthorized' });
```

**Drizzle insert + returning pattern** (lines 143-151):

```typescript
const inserted = await db
  .insert(users)
  .values({ email: input.email, name: input.name, passwordHash })
  .returning();
const user = inserted[0];
```

**Drizzle update pattern** (lines 176-178):

```typescript
await db
  .update(users)
  .set({ emailVerified: true, verifiedAt: new Date().toISOString() })
  .where(eq(users.id, token.userId));
```

**Drizzle delete pattern** (lines 107-109):

```typescript
await db
  .delete(authTokens)
  .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, 'verify_email')));
```

**Seed helper to export from this file** (called in `register` and `upsertGoogleUser` branch 3):

```typescript
export async function seedProfitFirstAccounts(
  db: ReturnType<typeof createDb>,
  userId: number
): Promise<void> {
  const defaults = [
    {
      name: 'Profit',
      targetPercentage: 500,
      color: '#10b981',
      sortOrder: 0,
      accountType: 'PROFIT' as const,
    },
    {
      name: 'Owner Pay',
      targetPercentage: 5000,
      color: '#8b5cf6',
      sortOrder: 1,
      accountType: 'OWNERS_PAY' as const,
    },
    {
      name: 'Tax',
      targetPercentage: 1500,
      color: '#f59e0b',
      sortOrder: 2,
      accountType: 'TAX' as const,
    },
    {
      name: 'Operating Expenses',
      targetPercentage: 3000,
      color: '#f43f5e',
      sortOrder: 3,
      accountType: 'OPEX' as const,
    },
  ] as const;
  await db.insert(profitFirstAccounts).values(defaults.map((d) => ({ ...d, userId })));
}
```

---

### `apps/api/src/services/auth-service.ts` (modify — add seeding calls)

**Analog:** `apps/api/src/services/auth-service.ts` (same file)

**Location of `register` new-user insertion** (lines 143-153):

```typescript
const inserted = await db
  .insert(users)
  .values({ ... })
  .returning();
const user = inserted[0];
// ADD HERE:
await seedProfitFirstAccounts(db, user.id);

const verifyUrl = await issueVerifyToken(db, user.id, appBaseUrl);
return { verifyUrl, email: user.email, name: user.name };
```

**Location of `upsertGoogleUser` branch 3 insertion** (lines 546-557):

```typescript
// 3. Brand-new Google user — auto-create verified account
const inserted = await db
  .insert(users)
  .values({ ... })
  .returning();
// ADD HERE (only branch 3 — NOT branches 1 or 2):
await seedProfitFirstAccounts(db, inserted[0].id);
return inserted[0].id;
```

---

### `apps/api/src/routes/profit-first.ts` (route, request-response)

**Analog:** `apps/api/src/routes/auth.ts`

**Router declaration pattern** (line 34):

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';

import { requireAuth } from '@/middleware/auth';
import { createProfitFirstService } from '@/services/profit-first-service';
import {
  createAccountSchema,
  updateAccountSchema,
  updatePercentagesSchema,
  summaryQuerySchema,
} from '@/schemas/profit-first';
import { createDb } from '@app/db';
import type { Bindings, Variables } from '@/types';

const profitFirstRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
profitFirstRouter.use('/*', requireAuth);
```

**zValidator hook pattern** (lines 40-44 — use on every route with a body):

```typescript
zValidator('json', createAccountSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
  }
}),
```

**Thin route handler pattern** (lines 45-56):

```typescript
async (c) => {
  const input = c.req.valid('json');
  const db = createDb(c.env.DB); // per-request binding
  const svc = createProfitFirstService(db);
  const userId = c.get('userId'); // from requireAuth middleware
  const result = await svc.createAccount(userId, input);
  return c.json({ data: result }, 201);
};
```

**Success response shape** (line 54-55, and throughout):

```typescript
return c.json({ data: result }); // 200
return c.json({ data: result }, 201); // created
return c.json({ data: null }); // delete success
```

**Error response shape** (lines 28-38, global handler in index.ts):
HTTPExceptions from the service layer are caught by the global `app.onError` handler in `apps/api/src/index.ts`. Routes do not need local try/catch — just let HTTPException propagate.

**Route registration** — in `apps/api/src/index.ts` add:

```typescript
import { profitFirstRouter } from '@/routes/profit-first';
// ...
app.route('/api/profit-first', profitFirstRouter);
// Also add PATCH, DELETE, PUT to the CORS allowMethods array
```

---

### `apps/api/src/schemas/profit-first.ts` (utility, transform)

**Analog:** `apps/api/src/schemas/auth.ts`

**Schema file pattern** (lines 1-43, full file — named exports, no default):

```typescript
import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  targetPercentage: z.number().int().min(0).max(10000), // basis points
  color: z.enum(PF_DEFAULT_COLORS),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  targetPercentage: z.number().int().min(0).max(10000).optional(),
  color: z.enum(PF_DEFAULT_COLORS).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updatePercentagesSchema = z.object({
  accounts: z
    .array(
      z.object({
        id: z.number().int().positive(),
        targetPercentage: z.number().int().min(0).max(10000),
      })
    )
    .min(1),
});

export const summaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  categoryIds: z.string().optional(), // comma-separated, parsed in service
});
```

**Zod v4 style** — same as `apps/api/src/schemas/auth.ts` (no `.nullable()` unless explicitly needed; use `.optional()` for optional fields; named exports only).

**PF_DEFAULT_COLORS** — define here or import from `@/lib/constants` (whichever the planner chooses; keep consistent with what the web lib also exports):

```typescript
const PF_DEFAULT_COLORS = [
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#f43f5e',
  '#3b82f6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const;
```

---

### `apps/web/src/app/api/profit-first/[...path]/route.ts` (middleware, request-response)

**Analog:** `apps/web/src/app/api/auth/[...path]/route.ts` (exact copy, minimal change)

**Full proxy function pattern** (lines 59-122 of auth proxy):

```typescript
async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const url = `${apiBaseUrl}/api/profit-first/${path.join('/')}${request.nextUrl.search}`;
  const apiRes = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    redirect: 'manual',
  });

  const nextRes = new NextResponse(apiRes.body, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
  return nextRes;
}
```

**Key differences from auth proxy:**

- Target path: `/api/profit-first/` not `/api/auth/`
- No transparent-refresh logic needed (all routes are authenticated; the middleware.ts already handles redirect to /login if no tokens)
- No Set-Cookie relay needed (profit-first routes don't set cookies)
- Export `GET`, `POST`, `PATCH`, `DELETE`, `PUT` handlers (auth only needed GET and POST)

**Route handler export pattern** (lines 124-132):

```typescript
export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
// Repeat for POST, PATCH, DELETE, PUT
```

---

### `apps/web/src/app/(dashboard)/profit-first/page.tsx` (component, request-response — RSC)

**Analog:** `apps/web/src/app/(auth)/login/page.tsx`

**RSC page pattern** (full file, 9 lines):

```typescript
// Default export required for Next.js route files
export default function LoginPage() {
  return (
    <main className="...">
      <LoginForm />
    </main>
  );
}
```

**Next.js 15 searchParams pattern** — `searchParams` is a Promise in Next.js 15; must await:

```typescript
// page.tsx RSC receives searchParams as a prop
export default async function ProfitFirstPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; categoryIds?: string }>;
}) {
  const params = await searchParams;
  // SSR fetch using params, pass to client component
}
```

**Server-side fetch to BFF pattern** (from `apps/web/src/server/auth.ts` lines 3-4):

```typescript
import { cookies } from 'next/headers';
// Read access_token for server-to-BFF call:
const cookieStore = await cookies();
const token = cookieStore.get('access_token')?.value;
```

---

### `apps/web/src/app/(dashboard)/profit-first/_components/pf-overview.tsx` (component, CRUD — client)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx`

**Client component declaration + imports pattern** (lines 1-10):

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
```

**Async mutation with loading state pattern** (lines 32-70):

```typescript
const [submitting, setSubmitting] = useState(false);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitting(true);
  try {
    const res = await fetch('/api/profit-first/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      toast.error(body.error?.message ?? 'Something went wrong.');
      return;
    }
    router.refresh(); // triggers RSC re-fetch
    toast.success('Account created.');
  } catch {
    toast.error('Could not reach the server. Please try again.');
  } finally {
    setSubmitting(false);
  }
}
```

**Toast error pattern** (lines 56-67): Always use `toast.error(...)` from `sonner` for user-facing errors. Never use `alert()`.

**`router.refresh()` for RSC invalidation**: After any successful mutation, call `router.refresh()` — this re-fetches the RSC and shows updated derived balances without a full page reload.

---

### `apps/web/src/app/(dashboard)/profit-first/_components/pf-percentage-editor.tsx` (component, CRUD — client)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx`

Follows same `'use client'` + useState + form submit pattern. Key domain rules:

- Input fields show percent (0–100), NOT basis points
- Validation: `total === 100` (not 10000) in the UI; the server action converts `Math.round(pct * 100)` to basis points before sending
- Live total computed from `accounts.reduce((sum, a) => sum + a.displayPercent, 0)`

---

### `apps/web/src/app/(dashboard)/profit-first/_components/pf-account-form.tsx` (component, CRUD — client)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx`

Dialog/sheet form pattern — same `'use client'` + form submission pattern. Color input renders the `PF_DEFAULT_COLORS` palette as swatch buttons (no free hex input, D-08).

---

### `apps/web/src/server/profit-first-actions.ts` (service, request-response)

**Analog:** `apps/web/src/server/auth.ts`

**Server-only module pattern** (line 1):

```typescript
// Server-only module — never import from client components.
'use server'; // or mark with server-only for non-action helpers
```

**Key conversion** — percent (UI) → basis points (API):

```typescript
export async function createAccountAction(input: {
  name: string;
  targetPercentage: number; // whole-number percent from UI
  color: string;
}) {
  const res = await fetch(`${process.env.API_BASE_URL}/api/profit-first/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...input,
      targetPercentage: Math.round(input.targetPercentage * 100), // pct → bp
    }),
  });
  if (!res.ok) throw new Error('Failed to create account');
}
```

---

### `apps/web/src/lib/format-currency.ts` (utility, transform)

**Analog:** `apps/web/src/lib/utils.ts`

**Pure utility function pattern** (line 1-6 of utils.ts — no framework import, named export):

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

New file shape (no imports needed):

```typescript
/**
 * Formats integer cents as a Philippine Peso display string.
 * Phase 6 will replace the hardcoded ₱ with a user currency setting.
 */
export function formatCurrency(cents: number): string {
  return `₱${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
```

---

### `apps/api/tests/profit-first.test.ts` (test, CRUD)

**Analog:** `apps/api/tests/index.test.ts`

**Test file structure pattern** (full file, 18 lines):

```typescript
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('API routes', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
```

For service unit tests, import the service factory directly (not via `app.request`). Use an in-memory `better-sqlite3` DB via a test helper (pattern from `apps/api/tests/helpers/db.ts` — to be extended with `profit_first_accounts` DDL). One assertion concept per test (`.claude/rules/testing.md`).

---

## Shared Patterns

### Authentication Guard

**Source:** `apps/api/src/middleware/auth.ts` (lines 19-35)
**Apply to:** All handlers in `apps/api/src/routes/profit-first.ts`

```typescript
import { requireAuth } from '@/middleware/auth';
// ...
profitFirstRouter.use('/*', requireAuth);
// Access userId inside handlers:
const userId = c.get('userId');
```

### Error Handling

**Source:** `apps/api/src/index.ts` (lines 28-38) — global `app.onError`
**Apply to:** All service functions — throw `HTTPException`; route handlers need no local try/catch

```typescript
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    const code = err.message || 'error';
    return c.json({ error: { code, message: code } }, err.status);
  }
  console.error('unhandled error:', { path: c.req.path, error: err });
  return c.json({ error: { code: 'internal_error', message: 'Something went wrong' } }, 500);
});
```

### Zod Validation + 422 Response

**Source:** `apps/api/src/routes/auth.ts` (lines 40-44)
**Apply to:** Every route handler with a request body in `profit-first.ts`

```typescript
zValidator('json', schema, (result, c) => {
  if (!result.success) {
    return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
  }
}),
```

### Response Shape

**Source:** `apps/api/src/routes/auth.ts` (lines 54-55, 69, 87, etc.)
**Apply to:** All route handlers

```typescript
// Success:
return c.json({ data: result });
return c.json({ data: result }, 201);
// Error (via HTTPException — let global handler format):
throw new HTTPException(404, { message: 'not_found' });
```

### D1 Per-Request Binding

**Source:** `apps/api/src/services/auth-service.ts` (line 131)
**Apply to:** Every route handler in `profit-first.ts`

```typescript
// CORRECT — inside handler:
const db = createDb(c.env.DB);
const svc = createProfitFirstService(db);
// WRONG — never at module scope
```

### Toast Notifications (Web)

**Source:** `apps/web/src/components/auth/LoginForm.tsx` (lines 5, 57-67)
**Apply to:** All client components that make mutations

```typescript
import { toast } from 'sonner';
// On success:
toast.success('Account updated.');
// On API error:
toast.error(body.error?.message ?? 'Something went wrong.');
// On network error:
toast.error('Could not reach the server. Please try again.');
```

### cn() Utility (Web)

**Source:** `apps/web/src/lib/utils.ts` (lines 1-6)
**Apply to:** All web components using conditional Tailwind classes

```typescript
import { cn } from '@/lib/utils';
// Usage: className={cn('base-class', condition && 'conditional-class')}
```

### Next.js Route Handler Export (Web BFF)

**Source:** `apps/web/src/app/api/auth/[...path]/route.ts` (lines 124-132)
**Apply to:** `apps/web/src/app/api/profit-first/[...path]/route.ts`

```typescript
export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
// Export: GET, POST, PATCH, DELETE, PUT
```

---

## No Analog Found

| File                                            | Role      | Data Flow    | Reason                                                                                                                                                     |
| ----------------------------------------------- | --------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/amount-visibility.tsx` | component | event-driven | No localStorage-backed visibility toggle exists in the codebase yet; reference implementation pattern from RESEARCH.md Code Examples must be used directly |

---

## Integration Checkpoints (flagged from RESEARCH.md)

These are dependencies on Phase 2 work with no current codebase analog. The planner must flag them:

1. **A1 — `incomes` table columns:** `profit-first-service.ts` `getTotalReceivedIncome` query references `incomes.userId`, `incomes.moneyStatus`, `incomes.profitFirstAllocated`, `incomes.incomeDate`, `incomes.categoryId`, `incomes.amount`. If Phase 2 schema uses different column names, `getSummary` will fail at TypeScript compile time (good — catch early).

2. **A2 — `(dashboard)` route group:** `profit-first/page.tsx` nests inside `(dashboard)/`. If Phase 2 has not created this route group and its `layout.tsx`, Phase 3 Wave 0 must create a minimal `apps/web/src/app/(dashboard)/layout.tsx` with auth guard.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/`, `packages/db/src/`
**Files scanned:** 21 source files
**Pattern extraction date:** 2026-06-06
