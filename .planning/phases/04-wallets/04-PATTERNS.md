# Phase 4: Wallets - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 22 new/modified files
**Analogs found:** 22 / 22 (all have at least a role-match analog from Phases 1–3)

---

## File Classification

| New/Modified File                                                              | Role                 | Data Flow        | Closest Analog                                 | Match Quality            |
| ------------------------------------------------------------------------------ | -------------------- | ---------------- | ---------------------------------------------- | ------------------------ |
| `packages/db/src/schema.ts` (modify)                                           | model                | CRUD             | `packages/db/src/schema.ts` (existing)         | exact — append 4 tables  |
| `apps/api/src/schemas/wallets.ts`                                              | schema/validation    | request-response | `apps/api/src/schemas/auth.ts`                 | role-match               |
| `apps/api/src/services/wallet-service.ts`                                      | service              | CRUD + batch     | `apps/api/src/services/auth-service.ts`        | role-match               |
| `apps/api/src/routes/wallets.ts`                                               | route                | request-response | `apps/api/src/routes/auth.ts`                  | role-match               |
| `apps/api/src/index.ts` (modify)                                               | config               | request-response | `apps/api/src/index.ts` (existing)             | exact — mount route      |
| `apps/web/src/app/api/wallets/[...path]/route.ts`                              | middleware           | request-response | `apps/web/src/app/api/auth/[...path]/route.ts` | exact copy + path change |
| `apps/web/src/app/(dashboard)/wallets/page.tsx`                                | component (RSC page) | request-response | `apps/web/src/app/(auth)/login/page.tsx`       | role-match               |
| `apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx`              | component (client)   | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match               |
| `apps/web/src/app/(dashboard)/wallets/new/page.tsx`                            | component (RSC page) | request-response | `apps/web/src/app/(auth)/login/page.tsx`       | role-match               |
| `apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx`       | component (client)   | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match               |
| `apps/web/src/app/(dashboard)/wallets/[walletId]/page.tsx`                     | component (RSC page) | request-response | `apps/web/src/app/(auth)/login/page.tsx`       | role-match               |
| `apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx` | component (client)   | CRUD             | `apps/web/src/components/auth/LoginForm.tsx`   | role-match               |
| `apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts`              | server action        | request-response | Phase 2 `_actions/create-income.ts` pattern    | role-match               |
| `apps/web/src/lib/format-currency.ts`                                          | utility              | transform        | `apps/web/src/lib/utils.ts`                    | role-match               |
| `apps/web/src/lib/wallet-labels.ts`                                            | utility              | transform        | `apps/web/src/lib/utils.ts`                    | role-match               |
| `apps/web/src/types/wallet.ts`                                                 | type                 | —                | `apps/api/src/types/index.ts`                  | role-match               |
| `apps/api/tests/wallets.test.ts`                                               | test                 | CRUD             | `apps/api/tests/index.test.ts`                 | role-match               |

---

## Pattern Assignments

### `packages/db/src/schema.ts` (model, CRUD — additive)

**Analog:** `packages/db/src/schema.ts` (existing — append to same file)

**Imports pattern** (line 1 — current):

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
// Expand to:
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
```

**Existing table structural pattern** (lines 3–49 — integer PK, text ISO dates via `$defaultFn`, FK with `onDelete: 'cascade'`, enum text columns):

```typescript
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // ...
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
});

export const refreshTokens = sqliteTable('refresh_tokens', {
  // FK pattern:
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Enum text column pattern (from authTokens):
  purpose: text('purpose', { enum: ['verify_email', 'reset_password'] }).notNull(),
});
```

**Third-argument index array pattern** (Phase 2/3 PATTERNS.md established this extension — not yet in committed schema but confirmed needed):

```typescript
export const wallets = sqliteTable(
  'wallets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sourceType: text('source_type', { enum: ['PROFIT_FIRST', 'BLANK'] }).notNull(),
    profitFirstAccountId: integer('profit_first_account_id').references(
      () => profitFirstAccounts.id
    ),
    autoDeductAllExpenses: integer('auto_deduct_all_expenses', { mode: 'boolean' })
      .notNull()
      .default(false),
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .$defaultFn(() => new Date().toISOString())
      .$onUpdateFn(() => new Date().toISOString()),
  },
  (table) => [
    index('wallets_user_idx').on(table.userId),
    uniqueIndex('wallets_user_pf_account_unique').on(table.userId, table.profitFirstAccountId),
  ]
);
```

**Soft-delete column pattern** (established in Phase 2 expenses table — `deletedAt` text column):

```typescript
deletedAt: text('deleted_at'), // null = active; ISO string = soft-deleted
```

---

### `apps/api/src/schemas/wallets.ts` (schema/validation, request-response)

**Analog:** `apps/api/src/schemas/auth.ts` (lines 1–44)

**Full file pattern** (auth.ts lines 1–2 — imports, named exports only, no default):

```typescript
import { z } from 'zod';

// Named exports only — matches auth.ts convention
export const expenseModeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NONE') }),
  z.object({ kind: z.literal('ALL') }),
  z.object({ kind: z.literal('CATEGORIES'), ids: z.array(z.number().int().positive()).min(1) }),
]);

export const createWalletSchema = z
  .object({
    name: z.string().min(1).max(80),
    sourceType: z.enum(['PROFIT_FIRST', 'BLANK']),
    profitFirstAccountId: z.number().int().positive().optional().nullable(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    sortOrder: z.number().int().optional(),
    incomeCategoryIds: z.array(z.number().int().positive()).optional(),
    expenseMode: expenseModeSchema.optional(),
  })
  .refine(
    (d) =>
      d.sourceType !== 'PROFIT_FIRST' ||
      (d.profitFirstAccountId !== undefined && d.profitFirstAccountId !== null),
    {
      message: 'profitFirstAccountId is required when sourceType is PROFIT_FIRST',
      path: ['profitFirstAccountId'],
    }
  );

export const updateWalletSchema = createWalletSchema.partial();

export const walletTransactionSchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  amount: z.number().positive(),
  description: z.string().max(500).optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const updateWalletTransactionSchema = walletTransactionSchema.partial();

export const walletTransactionQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});
```

---

### `apps/api/src/services/wallet-service.ts` (service, CRUD + batch)

**Analog:** `apps/api/src/services/auth-service.ts` (full file)

**Imports pattern** (auth-service.ts lines 1–14):

```typescript
import { HTTPException } from 'hono/http-exception';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

import { createDb } from '@app/db';
import {
  wallets,
  walletIncomeCategoryMappings,
  walletExpenseCategoryMappings,
  walletTransactions,
  incomeCategories,
  expenseCategories,
  profitFirstAccounts,
  incomes,
  expenses,
} from '@app/db/schema';
```

**Service factory pattern** (Phase 2/3 established this; auth-service.ts uses named exports per function, but RESEARCH.md + prior PATTERNS.md specify factory for all Phase 2+ services):

```typescript
export function createWalletService(db: ReturnType<typeof createDb>) {
  // All methods close over db — never call createDb inside methods
  return {
    async list(userId: number) { ... },
    async getById(walletId: number, userId: number, params: { page: number; size: number }) { ... },
    async create(userId: number, input: CreateWalletInput) { ... },
    async update(walletId: number, userId: number, input: UpdateWalletInput) { ... },
    async remove(walletId: number, userId: number) { ... },
    async createTransaction(walletId: number, userId: number, input: CreateTransactionInput) { ... },
    async updateTransaction(walletId: number, txId: number, userId: number, input: UpdateTransactionInput) { ... },
    async removeTransaction(walletId: number, txId: number, userId: number) { ... },
    async restoreTransaction(walletId: number, txId: number, userId: number) { ... },
  };
}
```

**Ownership enforcement pattern** (auth-service.ts lines 57–82 — always filter by userId to prevent IDOR):

```typescript
const row = await db
  .select()
  .from(wallets)
  .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
if (!row[0]) throw new HTTPException(404, { message: 'not_found' });
```

**HTTPException error pattern** (auth-service.ts lines 68–69, 280–281 — throw for ALL expected errors; global handler formats response):

```typescript
throw new HTTPException(404, { message: 'not_found' });
throw new HTTPException(409, { message: 'wallet_pf_account_already_linked' });
throw new HTTPException(409, { message: 'income_category_already_mapped' });
throw new HTTPException(400, { message: 'manual_deposit_blocked_pf_wallet' });
```

**Soft delete / restore pattern** (established in Phase 2 expense-service.ts pattern excerpt from 02-PATTERNS.md):

```typescript
// Soft delete wallet_transactions: set deletedAt
await db
  .update(walletTransactions)
  .set({ deletedAt: new Date().toISOString() })
  .where(and(eq(walletTransactions.id, txId), eq(walletTransactions.userId, userId)));

// Restore: clear deletedAt
await db
  .update(walletTransactions)
  .set({ deletedAt: null })
  .where(and(eq(walletTransactions.id, txId), eq(walletTransactions.userId, userId)));
```

**db.batch() atomic clear-and-replace pattern** (no existing codebase analog — RESEARCH.md Pattern 2 is the source of truth; `(db as any).batch(...)` cast required per RESEARCH.md Pitfall 7):

```typescript
// Atomic delete-all + insert-new for mapping operations
const deleteStmt = db
  .delete(walletIncomeCategoryMappings)
  .where(
    and(
      eq(walletIncomeCategoryMappings.walletId, walletId),
      eq(walletIncomeCategoryMappings.userId, userId)
    )
  );
const insertStmt = db
  .insert(walletIncomeCategoryMappings)
  .values(ids.map((cid) => ({ walletId, incomeCategoryId: cid, userId })));
// intentional: Drizzle 0.45.2 D1 adapter doesn't type .batch() on the return of createDb
await (db as any).batch([deleteStmt, insertStmt]);
```

**Balance computation formula** (RESEARCH.md Pattern 6 — ported verbatim):

```typescript
// targetPercentage is basis points (e.g. 500 = 5.00%); divide by 10000 to get ratio
const pfAllocation =
  wallet.profitFirstAccountId && pfAccount
    ? Math.round((totalReceivedIncome * pfAccount.targetPercentage) / 10000)
    : 0;
const balance =
  pfAllocation + mappedIncome - mappedExpenses + txImpact.deposits - txImpact.withdrawals;
```

**7-way Promise.all for list** (RESEARCH.md Pattern 1 — N+1 avoidance on D1):

```typescript
const [
  walletRows,
  totalReceivedIncome,
  perWalletImpact,
  mappingsByWallet,
  totalAllExpenses,
  incomeByCategory,
  expenseByCategory,
] = await Promise.all([
  db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .orderBy(wallets.sortOrder, wallets.id),
  getTotalReceivedIncomeCents(userId),
  getPerWalletBalanceImpactCents(userId),
  getMappingsByWallet(userId),
  getAllExpensesCents(userId),
  getReceivedIncomeByCategoryCents(userId),
  getExpensesByCategoryCents(userId),
]);
```

**assertCanInsertTransaction blocking pattern** (RESEARCH.md Pattern 3 — ported verbatim; no codebase analog):

```typescript
function assertCanInsertTransaction(
  type: 'DEPOSIT' | 'WITHDRAWAL',
  wallet: typeof wallets.$inferSelect,
  mappings: { incomeCategories: number[]; expenseCategories: number[] }
): void {
  const incomeAuto = mappings.incomeCategories.length > 0;
  const expenseAuto = wallet.autoDeductAllExpenses || mappings.expenseCategories.length > 0;
  const hasPf = !!wallet.profitFirstAccountId;

  if (type === 'DEPOSIT') {
    if (hasPf) throw new HTTPException(400, { message: 'manual_deposit_blocked_pf_wallet' });
    if (incomeAuto)
      throw new HTTPException(400, { message: 'manual_deposit_blocked_income_mapped' });
  } else {
    if (expenseAuto)
      throw new HTTPException(400, { message: 'manual_withdrawal_blocked_expense_mapped' });
  }
}
```

**Transaction history merge from 3 sources** (RESEARCH.md Pattern 5 — no codebase analog; use verbatim):

```typescript
// Transaction history INCLUDES deleted rows (D-09); balance queries EXCLUDE them — different queries
const merged = [...incomeEntries, ...expenseEntries, ...manualEntries];
merged.sort((a, b) => {
  if (a.transactionDate < b.transactionDate) return 1;
  if (a.transactionDate > b.transactionDate) return -1;
  return b.id - a.id;
});
const content = merged.slice(page * size, (page + 1) * size);
```

---

### `apps/api/src/routes/wallets.ts` (route, request-response)

**Analog:** `apps/api/src/routes/auth.ts` (full file)

**Imports pattern** (auth.ts lines 1–14):

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';

import { createDb } from '@app/db';
import { requireAuth } from '@/middleware/auth';
import { createWalletService } from '@/services/wallet-service';
import {
  createWalletSchema,
  updateWalletSchema,
  walletTransactionSchema,
  updateWalletTransactionSchema,
  walletTransactionQuerySchema,
} from '@/schemas/wallets';
import type { Bindings, Variables } from '@/types';
```

**Router init + requireAuth at router level** (established in Phase 3 PATTERNS.md; Phase 3 used `profitFirstRouter.use('/*', requireAuth)`):

```typescript
const walletsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();
walletsRouter.use('/*', requireAuth);
```

**Thin handler pattern — validate → service → respond** (auth.ts lines 38–56):

```typescript
walletsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const svc = createWalletService(createDb(c.env.DB));
  const result = await svc.list(userId);
  return c.json({ data: result });
});

walletsRouter.post(
  '/',
  zValidator('json', createWalletSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
    }
  }),
  async (c) => {
    const input = c.req.valid('json');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.create(userId, input);
    return c.json({ data: result }, 201);
  }
);
```

**Query params validation** (from 02-PATTERNS.md — `zValidator('query', ...)` target):

```typescript
walletsRouter.get(
  '/:walletId',
  zValidator('query', walletTransactionQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_error', message: 'Invalid query params' } }, 422);
    }
  }),
  async (c) => {
    const walletId = Number(c.req.param('walletId'));
    const params = c.req.valid('query');
    const userId = c.get('userId');
    const svc = createWalletService(createDb(c.env.DB));
    const result = await svc.getById(walletId, userId, params);
    return c.json({ data: result });
  }
);
```

**Sub-resource + restore endpoint** (established in Phase 2 PATTERNS.md — `PATCH /:id/restore` must register before `/:id` to avoid param shadowing):

```typescript
// Register specific action endpoints BEFORE generic /:txId handlers
walletsRouter.patch('/:walletId/transactions/:txId/restore', async (c) => {
  const walletId = Number(c.req.param('walletId'));
  const txId = Number(c.req.param('txId'));
  const svc = createWalletService(createDb(c.env.DB));
  await svc.restoreTransaction(walletId, txId, c.get('userId'));
  return c.json({ data: { message: 'restored' } });
});
```

**Export pattern** (auth.ts line 306):

```typescript
export { walletsRouter };
```

---

### `apps/api/src/index.ts` — CORS expansion + route mount

**Analog:** `apps/api/src/index.ts` (existing — targeted modification; same change pattern as Phases 2 and 3)

**CORS expansion** (index.ts line 20 — current value `['GET', 'POST']`; Phase 2 established expanding to include `PUT`, `DELETE`, `PATCH`):

```typescript
// Change from (current):
allowMethods: ['GET', 'POST'],
// To (Phase 2 established this expansion; Phase 4 just confirms it's already applied):
allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
```

**Route mounting pattern** (index.ts line 49 — copy existing `app.route()` pattern):

```typescript
// Existing pattern from auth:
app.route('/api/auth', authRouter);

// Add for wallets (router already uses requireAuth internally — no outer middleware needed):
import { walletsRouter } from '@/routes/wallets';
app.route('/api/wallets', walletsRouter);
```

---

### `apps/web/src/app/api/wallets/[...path]/route.ts` (middleware, request-response)

**Analog:** `apps/web/src/app/api/auth/[...path]/route.ts` (exact pattern — full file)

**Core proxy function** (route.ts lines 59–122 — copy verbatim, change two things):

```typescript
// Change 1: URL target
const url = `${apiBaseUrl}/api/wallets/${path.join('/')}${request.nextUrl.search}`;
// (was: /api/auth/)

// Change 2: No UNAUTHED_PATHS / transparent-refresh logic needed
// All wallet routes require auth; access_token is always present or middleware.ts redirects first
async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8793';
  const cookieStore = await cookies(); // async in Next.js 15 — matches auth proxy line 64
  const accessToken = cookieStore.get('access_token')?.value;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const url = `${apiBaseUrl}/api/wallets/${path.join('/')}${request.nextUrl.search}`;
  const apiRes = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    redirect: 'manual',
  });

  return new NextResponse(apiRes.body, {
    status: apiRes.status,
    headers: { 'content-type': apiRes.headers.get('content-type') ?? 'application/json' },
  });
}
```

**Export pattern** (route.ts lines 124–132 — expand to all 5 verbs used by wallet routes):

```typescript
export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
```

---

### `apps/web/src/app/(dashboard)/wallets/page.tsx` (RSC page, request-response)

**Analog:** `apps/web/src/app/(auth)/login/page.tsx` (full file — 9 lines)

**RSC default export + session guard + SSR fetch pattern** (Phase 2 PATTERNS.md `income/page.tsx` pattern — established analog):

```typescript
import { getSession } from '@/server/auth';
import { redirect } from 'next/navigation';
import type { WalletListItem } from '@/types/wallet';
import { WalletCard } from './_components/WalletCard';

export default async function WalletsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Server-side fetch through same-origin BFF — never direct to Workers API
  const res = await fetch(
    `${process.env.API_BASE_URL}/api/wallets`,
    {
      headers: {
        // Forward access token from cookie (server component — reads process env / cookies via server/auth)
        // Alternative: use apiFetch helper if established by Phase 2
      },
    }
  );
  const { data } = (await res.json()) as { data: WalletListItem[] };

  return (
    <main>
      {/* WalletCard grid + empty state */}
    </main>
  );
}
```

**Note on data fetching:** Phase 2 will establish `apps/web/src/server/api.ts` with `apiFetch`. Phase 4 MUST use that helper rather than raw `fetch`. Pattern from 02-PATTERNS.md:

```typescript
import { apiFetch } from '@/server/api';
const wallets = await apiFetch<{ data: WalletListItem[] }>('/api/wallets');
```

**`searchParams` as Promise pattern** (Next.js 15 — established in Phase 3 PATTERNS.md `profit-first/page.tsx`):

```typescript
export default async function WalletsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const _params = await searchParams; // must await — Next.js 15
  // ...
}
```

---

### `apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx` (client component, CRUD)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx` (full file — 'use client', named export, Props interface)

**Client component declaration** (LoginForm.tsx lines 1–10):

```typescript
'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format-currency';
import type { WalletListItem } from '@/types/wallet';

interface WalletCardProps {
  wallet: WalletListItem;
  onClick?: () => void;
}

export function WalletCard({ wallet, onClick }: WalletCardProps) {
  // D-01: color accent left border, name, type badge, total balance
  // D-13: negative balances styled red — cn('text-destructive', balance < 0)
}
```

**cn() conditional class pattern** (utils.ts lines 1–6 — used throughout LoginForm.tsx):

```typescript
import { cn } from '@/lib/utils';
// D-13 negative balance:
<span className={cn('font-semibold', balance < 0 && 'text-destructive')}>
  {formatCurrency(wallet.balanceCents)}
</span>
```

---

### `apps/web/src/app/(dashboard)/wallets/new/page.tsx` (RSC page, request-response)

**Analog:** `apps/web/src/app/(auth)/login/page.tsx`

Same RSC default export + session guard pattern as wallets `page.tsx`. Fetches PF accounts (for PROFIT_FIRST source type selector) and income/expense categories (for mapping pickers) before rendering `NewWalletForm`.

```typescript
export default async function NewWalletPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [pfAccounts, incomeCategories, expenseCategories] = await Promise.all([
    apiFetch<{ data: PfAccount[] }>('/api/profit-first/accounts'),
    apiFetch<{ data: IncomeCategory[] }>('/api/income-categories'),
    apiFetch<{ data: ExpenseCategory[] }>('/api/expense-categories'),
  ]);
  return <NewWalletForm pfAccounts={pfAccounts.data} incomeCategories={incomeCategories.data} expenseCategories={expenseCategories.data} />;
}
```

---

### `apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx` (client component, CRUD)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx` (full file)

**Client component + controlled form + submitting state** (LoginForm.tsx lines 17–70):

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PfAccount, IncomeCategory, ExpenseCategory } from '@/types/wallet';

interface NewWalletFormProps {
  pfAccounts: PfAccount[];
  incomeCategories: IncomeCategory[];
  expenseCategories: ExpenseCategory[];
}

export function NewWalletForm({
  pfAccounts,
  incomeCategories,
  expenseCategories,
}: NewWalletFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [sourceType, setSourceType] = useState<'PROFIT_FIRST' | 'BLANK'>('BLANK');
  // D-08: hide income mapping section when sourceType === 'PROFIT_FIRST'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: { code?: string; message?: string } };
        toast.error(body.error?.message ?? 'Something went wrong.');
        return;
      }
      router.push('/wallets');
      router.refresh();
      toast.success('Wallet created.');
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }
}
```

**D-06 disabled-category picker pattern** (no direct codebase analog; follow reference `new-wallet-form.tsx` + cmdk):

- Categories already mapped to another wallet appear with `disabled` prop in the cmdk list
- Server enforces 409 on conflict; UI disables as UX hint only

**D-07 3-mode expense selector pattern** (no codebase analog — follow RESEARCH.md Pattern 3 reference exactly):

```typescript
// expenseMode state: 'NONE' | 'ALL' | 'CATEGORIES'
const [expenseMode, setExpenseMode] = useState<'NONE' | 'ALL' | 'CATEGORIES'>('NONE');
// 'CATEGORIES' mode validates: selectedExpenseCategoryIds.length >= 1
```

---

### `apps/web/src/app/(dashboard)/wallets/[walletId]/page.tsx` (RSC page, request-response)

**Analog:** `apps/web/src/app/(auth)/login/page.tsx`

**Dynamic segment + query param pattern** (Next.js 15 — both `params` and `searchParams` are Promises):

```typescript
export default async function WalletDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ walletId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { walletId } = await params;
  const { page = '0' } = await searchParams;

  const detail = await apiFetch<{ data: WalletDetailResponse }>(
    `/api/wallets/${walletId}?page=${page}&size=20`
  );
  return <WalletDetail wallet={detail.data} />;
}
```

---

### `apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx` (client component, CRUD)

**Analog:** `apps/web/src/components/auth/LoginForm.tsx` (full file — 'use client', named export, Props interface, toast, router.refresh)

**Client component with multiple dialogs** (LoginForm.tsx lines 17–151 — state management, form submit, toast pattern):

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format-currency';
import type { WalletDetailResponse, WalletTransaction } from '@/types/wallet';

interface WalletDetailProps {
  wallet: WalletDetailResponse;
}

export function WalletDetail({ wallet }: WalletDetailProps) {
  const router = useRouter();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editTx, setEditTx] = useState<WalletTransaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<WalletTransaction | null>(null);
  // D-09: soft-deleted transactions shown inline — no filter on deletedAt in the UI data
  // D-12: delete confirmation dialog before soft-delete call
}
```

**Mutation + router.refresh() pattern** (established in Phase 3 PATTERNS.md `pf-overview.tsx`):

```typescript
async function handleDeleteTransaction(txId: number) {
  const res = await fetch(`/api/wallets/${wallet.id}/transactions/${txId}`, { method: 'DELETE' });
  if (!res.ok) {
    toast.error('Could not delete transaction.');
    return;
  }
  router.refresh(); // triggers RSC re-fetch for updated balance
  toast.success('Transaction removed.');
}

async function handleRestoreTransaction(txId: number) {
  const res = await fetch(`/api/wallets/${wallet.id}/transactions/${txId}/restore`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    toast.error('Could not restore transaction.');
    return;
  }
  router.refresh();
  toast.success('Transaction restored.');
}
```

**D-09 inline soft-delete rendering pattern** (from Phase 2 PATTERNS.md `expense-list.tsx` — deleted rows greyed with inline restore):

```typescript
// D-09: soft-deleted transactions remain inline, greyed, with Restore button
<tr className={cn(tx.deletedAt && 'opacity-50 line-through text-muted-foreground')}>
  {/* ... */}
  {tx.deletedAt ? (
    <button onClick={() => handleRestoreTransaction(tx.id)}>Restore</button>
  ) : (
    <button onClick={() => setDeleteTx(tx)}>Delete</button>
  )}
</tr>
```

**D-02 collapsible balance breakdown pattern** (shadcn Collapsible or details/summary — no codebase analog; use shadcn Collapsible):

```typescript
// Zero-value rows hidden:
{breakdown.pfAllocationCents !== 0 && (
  <div className="flex justify-between">
    <span>PF Allocation</span>
    <span>{formatCurrency(breakdown.pfAllocationCents)}</span>
  </div>
)}
```

---

### `apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts` (server action, request-response)

**Analog:** Phase 2 `_actions/create-income.ts` pattern (from 02-PATTERNS.md lines 681–711)

**Server action module pattern** ('use server' + apiFetch + revalidatePath):

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/server/api';
import type { CreateWalletInput } from '@/types/wallet';

export async function createWalletAction(input: CreateWalletInput) {
  try {
    await apiFetch('/api/wallets', { method: 'POST', body: JSON.stringify(input) });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
  revalidatePath('/wallets');
  redirect('/wallets');
}

export async function deleteWalletAction(walletId: number) {
  try {
    await apiFetch(`/api/wallets/${walletId}`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.code };
    return { error: 'unknown' };
  }
  revalidatePath('/wallets');
  redirect('/wallets');
}
```

---

### `apps/web/src/lib/format-currency.ts` (utility, transform)

**Analog:** `apps/web/src/lib/utils.ts` (lines 1–6 — kebab-case filename, named export, no default, no framework imports)

**File pattern** (utils.ts lines 1–6):

```typescript
// kebab-case filename, named exports only (TypeScript rule: no default exports in shared libs)
// D-14: PHP default; Phase 6 swaps by reading user setting
export function formatCurrency(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Convert decimal peso input (from form) to integer cents for API */
export function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}
```

**Note:** Phase 2 PATTERNS.md and Phase 3 PATTERNS.md both include `format-currency.ts`. If either phase already created this file, Phase 4 must check for existence and extend rather than recreate. The D-14 PHP default is the locked behavior.

---

### `apps/web/src/lib/wallet-labels.ts` (utility, transform)

**Analog:** `apps/web/src/lib/utils.ts` (lines 1–6 — pure utility, named exports, no framework imports)

**File pattern** (no direct codebase analog — port from reference `lib/wallet-labels.ts` via RESEARCH.md Code Examples):

```typescript
// Pure utility — no React imports, no framework coupling (CLAUDE.md: lib/ for framework-agnostic utils)
import type { WalletSourceType, ProfitFirstAccountType } from '@/types/wallet';

export function withdrawalLabel(
  sourceType: WalletSourceType,
  accountType: ProfitFirstAccountType | null
): string {
  if (sourceType === 'PROFIT_FIRST') {
    switch (accountType) {
      case 'PROFIT':
        return 'Profit Distribution';
      case 'OWNERS_PAY':
        return "Owner's Draw";
      case 'TAX':
        return 'Tax Payment';
      case 'OPEX':
        return 'Expense';
      default:
        return 'Withdrawal';
    }
  }
  return 'Withdrawal';
}

export function sourceLabel(sourceType: WalletSourceType): string {
  return sourceType === 'PROFIT_FIRST' ? 'Profit First' : 'Standalone';
}
```

---

### `apps/web/src/types/wallet.ts` (type, —)

**Analog:** `apps/api/src/types/index.ts` (lines 1–16 — TypeScript types/interfaces only, no runtime code, named exports, `import type` for type-only imports)

**File pattern** (types/index.ts lines 1–16):

```typescript
// types/ is runtime-free — only type definitions (CLAUDE.md: types/ for shared TypeScript types)
// Use interface for extensible shapes; type for unions/aliases (typescript.md rule)

export type WalletSourceType = 'PROFIT_FIRST' | 'BLANK';
export type WalletTransactionType = 'DEPOSIT' | 'WITHDRAWAL';

export interface WalletListItem {
  id: number;
  name: string;
  sourceType: WalletSourceType;
  color: string;
  sortOrder: number;
  balanceCents: number; // derived — never stored
  profitFirstAccountId: number | null;
}

export interface WalletTransaction {
  id: number;
  type: WalletTransactionType | 'INCOME_AUTO' | 'EXPENSE_AUTO'; // merged view
  amount: number;
  description: string | null;
  transactionDate: string;
  deletedAt: string | null; // null = active; present = soft-deleted (D-09)
  source: 'manual' | 'income' | 'expense';
}

export interface WalletDetailResponse {
  wallet: WalletListItem;
  breakdown: {
    pfAllocationCents: number;
    mappedIncomeCents: number;
    mappedExpensesCents: number;
    depositsCents: number;
    withdrawalsCents: number;
  };
  transactions: WalletTransaction[];
  pagination: { page: number; size: number; total: number; totalPages: number };
}
```

---

### `apps/api/tests/wallets.test.ts` (test, CRUD)

**Analog:** `apps/api/tests/index.test.ts` (lines 1–18)

**Test structure pattern** (index.test.ts full file):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';

// Use app.request() for Hono in-process testing — no HTTP server needed
describe('wallets service', () => {
  describe('WAL-01: create wallet', () => {
    it('creates a PROFIT_FIRST wallet linked to a PF account', async () => {
      // ...
      expect(res.status).toBe(201);
    });
    it('returns 409 when PF account is already linked to another wallet', async () => {
      expect(res.status).toBe(409);
    });
  });
  describe('WAL-04: assertCanInsertTransaction', () => {
    it('blocks manual deposit on a PROFIT_FIRST wallet', async () => {
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('manual_deposit_blocked_pf_wallet');
    });
  });
});
```

**Test file location**: `apps/api/tests/wallets.test.ts` — mirrors the source path convention of `index.test.ts`.

---

## Shared Patterns

### Authentication Guard (requireAuth middleware)

**Source:** `apps/api/src/middleware/auth.ts` lines 19–35
**Apply to:** `apps/api/src/routes/wallets.ts` — mount at router level via `walletsRouter.use('/*', requireAuth)`

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
// Route handlers access userId via:
const userId = c.get('userId');
```

### Error Handling (structured shape + global handler)

**Source:** `apps/api/src/index.ts` lines 28–39
**Apply to:** All service functions — throw `HTTPException`; route handlers need no local try/catch

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
// In wallet-service.ts: throw new HTTPException(409, { message: 'income_category_already_mapped' });
```

### Validation (zValidator + explicit 422 hook)

**Source:** `apps/api/src/routes/auth.ts` lines 38–45
**Apply to:** All POST/PUT/PATCH handlers in `wallets.ts`; query params on GET detail endpoint

```typescript
// From apps/api/src/routes/auth.ts lines 38–45
zValidator('json', createWalletSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: { code: 'validation_error', message: 'Invalid request body' } }, 422);
  }
}),
```

### DB Instance Creation (per-request factory)

**Source:** `apps/api/src/routes/auth.ts` line 275; `packages/db/src/index.ts` lines 6–8
**Apply to:** All route handler functions in `wallets.ts` — create inside handler, never at module scope

```typescript
// From packages/db/src/index.ts lines 6–8
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
// Usage in route handlers:
const db = createDb(c.env.DB); // INSIDE handler — Workers binding is request-scoped
const svc = createWalletService(db);
```

### Session Guard in Server Components

**Source:** `apps/web/src/server/auth.ts` lines 18–35
**Apply to:** `wallets/page.tsx`, `wallets/new/page.tsx`, `wallets/[walletId]/page.tsx`

```typescript
// From apps/web/src/server/auth.ts lines 18–35
import { getSession } from '@/server/auth';
import { redirect } from 'next/navigation';
const session = await getSession();
if (!session) redirect('/login');
```

### Toast Notifications (client components)

**Source:** `apps/web/src/components/auth/LoginForm.tsx` lines 5, 63–65
**Apply to:** `WalletCard.tsx`, `NewWalletForm.tsx`, `WalletDetail.tsx`

```typescript
import { toast } from 'sonner'; // LoginForm.tsx line 5
toast.success('Wallet created.');
toast.error('Something went wrong. Please try again.');
toast.error('Could not reach the server. Please try again.');
```

### router.refresh() for RSC Invalidation

**Source:** Phase 3 PATTERNS.md `pf-overview.tsx` pattern (established)
**Apply to:** All mutation handlers in `WalletDetail.tsx` and `WalletCard.tsx`

```typescript
import { useRouter } from 'next/navigation';
const router = useRouter();
// After any successful mutation:
router.refresh(); // re-fetches RSC parent, shows updated balance
```

### cn() Conditional Classes

**Source:** `apps/web/src/lib/utils.ts` lines 1–6
**Apply to:** `WalletCard.tsx`, `WalletDetail.tsx` (D-13 negative balance red styling, D-09 deleted row greying)

```typescript
import { cn } from '@/lib/utils';
// D-13: negative balance = red
className={cn('font-semibold tabular-nums', balance < 0 && 'text-destructive')}
// D-09: deleted transaction = greyed + strikethrough
className={cn(tx.deletedAt && 'opacity-50 line-through text-muted-foreground')}
```

### Path Aliases

**Source:** `CLAUDE.md`, `tsconfig.base.json`
**Apply to:** Every new file in Phase 4

```typescript
// API files:
import { createDb } from '@app/db';
import { wallets } from '@app/db/schema';
import { requireAuth } from '@/middleware/auth';
// Web files:
import { apiFetch } from '@/server/api';
import { getSession } from '@/server/auth';
import { formatCurrency } from '@/lib/format-currency';
import type { WalletListItem } from '@/types/wallet';
// Never: import { wallets } from '../../../packages/db/src/schema';
```

---

## No Analog Found

Files with no close codebase match — planner must use RESEARCH.md patterns directly:

| File                                                   | Role             | Data Flow | Reason                                                                                                                      |
| ------------------------------------------------------ | ---------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `assertCanInsertTransaction` (in wallet-service.ts)    | utility function | —         | No double-count guard exists in any service; port verbatim from RESEARCH.md Pattern 3                                       |
| 7-way `Promise.all` in `list()` (in wallet-service.ts) | service method   | batch     | No multi-source aggregation pattern exists; port from RESEARCH.md Pattern 1                                                 |
| Transaction history merge-3-sources in `getById()`     | service method   | batch     | No cross-table merge sort exists; port from RESEARCH.md Pattern 5                                                           |
| `db.batch()` clear-and-replace (in wallet-service.ts)  | service utility  | batch     | No atomic multi-statement write exists in codebase yet; use RESEARCH.md Pattern 2 with `(db as any).batch(...)`             |
| `apps/web/src/app/(dashboard)/layout.tsx`              | component        | —         | `(dashboard)` route group not yet created; Phase 2/3 must create it, or Phase 4 Wave 0 creates a minimal auth-guarded shell |

---

## Integration Checkpoints (flagged from RESEARCH.md)

These Phase 4 files depend on Phase 2 and 3 work that is not yet committed code:

1. **`incomeCategories` and `expenseCategories` tables (Phase 2 A5):** `walletIncomeCategoryMappings.incomeCategoryId` and `walletExpenseCategoryMappings.expenseCategoryId` FK reference these. Phase 4 schema migration cannot run until Phase 2 has migrated these tables.

2. **`profitFirstAccounts` table (Phase 3 A4):** `wallets.profitFirstAccountId` FK references it. Phase 3 must be migrated first.

3. **`incomes` and `expenses` tables (Phase 2):** The balance computation in `wallet-service.ts` queries across these tables. Their exact column names must match Phase 2's schema — use `incomes.userId`, `incomes.moneyStatus`, `incomes.amount`, `incomes.categoryId`, `incomes.incomeDate` and `expenses.userId`, `expenses.amount`, `expenses.categoryId`, `expenses.deletedAt`.

4. **`apiFetch` helper (Phase 2 `apps/web/src/server/api.ts`):** All wallet RSC pages must import `apiFetch` from `@/server/api`. Phase 2 creates this file; Phase 4 depends on it being present.

5. **`(dashboard)` route group (Phase 2 or 3):** The `apps/web/src/app/(dashboard)/` path must exist before wallet pages can be added there. If not present after Phases 2/3, Phase 4 Wave 0 must create a minimal `(dashboard)/layout.tsx` with session guard.

6. **CORS `allowMethods` (Phase 2 task):** Phase 2 PATTERNS.md already planned expanding `allowMethods` to `['GET', 'POST', 'PUT', 'DELETE', 'PATCH']` in `apps/api/src/index.ts`. If Phase 2 applied this, Phase 4 need not repeat it. Planner must verify.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/`, `packages/db/src/`, `.planning/phases/02-income-expenses/02-PATTERNS.md`, `.planning/phases/03-profit-first-allocation/03-PATTERNS.md`
**Files scanned:** 18 existing source files + 2 prior PATTERNS.md documents
**Pattern extraction date:** 2026-06-06
