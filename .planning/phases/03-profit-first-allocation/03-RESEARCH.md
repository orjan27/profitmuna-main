# Phase 3: Profit First Allocation - Research

**Researched:** 2026-06-06
**Domain:** Profit First allocation accounts — Drizzle/D1 schema, Hono services, Next.js UI with nuqs/date-fns
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Defaults are seeded **at registration** — a shared service function called from BOTH the email/password registration path AND the Google OAuth first-login (account-creation) path.
- **D-02:** **One-time data migration backfills** the four default accounts for any user who registered before this phase ships (Phase 1 users).
- **D-03:** Seed values: Profit 500 bp `#10b981` sort 0 PROFIT; Owner Pay 5000 bp `#8b5cf6` sort 1 OWNERS_PAY; Tax 1500 bp `#f59e0b` sort 2 TAX; Operating Expenses 3000 bp `#f43f5e` sort 3 OPEX.
- **D-04:** Validation semantics exactly match the reference:
  - `updatePercentages`: rejects unless submitted set totals exactly 10000 bp
  - `createAccount`: rejects only if adding would exceed 10000 bp
  - `updateAccount` (single): rejects only if new value + others would exceed 10000 bp
  - Delete may leave total under 100% — user rebalances in bulk editor
- **D-05:** PROFIT/OWNERS_PAY/TAX/OPEX accounts are not deletable; any account linked to a wallet is not deletable (wallet guard written Phase 3, activatable Phase 4).
- **D-06:** Replicate reference page layout with shadcn/ui primitives: account cards with color accent, derived balance, progress bar, per-account dropdown; bulk percentage editor with live total; account create/edit dialog.
- **D-07:** Amount-visibility (masking) toggle built as a **shared component** in `apps/web/src/components/`.
- **D-08:** Custom-account colors from a preset swatch palette (`PF_DEFAULT_COLORS`) — no free hex input.
- **D-09:** Date-range presets: This Month, Last Month, Last 3 Months, This Year, All Time — computed in Asia/Manila timezone using `date-fns` + `@date-fns/tz`.
- **D-10:** Income-category filter is **multi-select** (IN-list query); default = all categories. Rental/unit filters from reference are stripped.
- **D-11:** Filter state (date range, categories) lives in **URL search params via `nuqs`**.

### Claude's Discretion

- Exact wallet-guard implementation timing (stub in Phase 3 vs activate in Phase 4) — flag choice in plan.
- API route shape under `apps/api/src/routes/` (e.g., `profit-first.ts` with GET summary, POST/PATCH/DELETE accounts, PUT percentages).
- Error-message wording (reference messages are good templates).
- Whether `fromCents` conversion happens API-side or web-side — keep cents in DB and transport.

### Deferred Ideas (OUT OF SCOPE)

- Wallet linkage enforcement activates fully in Phase 4.
- Currency display setting remains in Phase 6.
- Dashboard widgets: Phase 5.
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID    | Description                                                                                                                  | Research Support                                                                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-01 | New users get default allocation accounts seeded — Profit 5%, Owner Pay 50%, Tax 15%, Operating Expenses 30%                 | D-01/D-03 decisions; `seedProfitFirstAccounts` pattern from reference seed.ts; hook into `register` and `upsertGoogleUser` in auth-service; Drizzle Kit backfill migration for D-02 |
| PF-02 | User can update allocation percentages, validated to sum to exactly 100% (basis points)                                      | D-04 bulk-editor validation; `updatePercentages` service method; `PFPercentageEditor` component pattern                                                                             |
| PF-03 | User can create, edit, delete custom allocation accounts (defaults not deletable; wallet-linked not deletable)               | D-05 guard logic; `createAccount`/`updateAccount`/`deleteAccount` service methods; `PFAccountForm` component; type guard on non-CUSTOM accounts                                     |
| PF-04 | User can view allocation summary with balances derived from received allocated income, filterable by date range and category | Balance formula `Math.round((totalIncomeCents * targetPercentage) / 10000)`; `getSummary` with parallel queries; `nuqs` URL filter state; Manila timezone presets                   |

</phase_requirements>

---

## Summary

Phase 3 adds the Profit First allocation layer on top of the income data established in Phase 2. The work is a straight port of the reference `profit-first-service.ts`, `profit_first_accounts` schema, and the reference `(dashboard)/profit-first/` UI page — adapted for Profitmuna's monorepo split (Hono API + Next.js frontend) and its single-user model (all `businessId` scopes become `userId`).

All behavioral rules are locked by the CONTEXT decisions and are fully validated against the reference codebase. No new npm dependencies are required: `date-fns`, `@date-fns/tz`, `nuqs`, `sonner`, `zod`, `@hono/zod-validator`, and `lucide-react` are already pinned. The schema addition is additive (new `profit_first_accounts` table) and a one-time Drizzle Kit migration backfills the four defaults for Phase 1 users.

The two most important implementation nuances: (1) the balance formula uses integer math with `Math.round` — never floating-point; (2) the percentage editor works in whole-number percent on the UI (0–100) but the API stores and validates in basis points (0–10000), so the conversion `Math.round(pct * 100)` must happen in the server action, not in the service.

**Primary recommendation:** Follow the reference service pattern exactly (`createProfitFirstService(db)` factory), adapt scope from `businessId` to `userId`, strip rental/unit filter paths from `getTotalReceivedIncome`, and extend the existing BFF proxy for the new `/api/profit-first/*` routes.

---

## Architectural Responsibility Map

| Capability                              | Primary Tier       | Secondary Tier                 | Rationale                                                                  |
| --------------------------------------- | ------------------ | ------------------------------ | -------------------------------------------------------------------------- |
| Default account seeding                 | API / Backend      | —                              | Registration is API-side; seed runs inside the same DB transaction context |
| Backfill migration                      | Database / Storage | —                              | Drizzle Kit migration; one-time SQL insert for existing users              |
| Sum-to-100% validation                  | API / Backend      | Frontend Server (client guard) | API is authoritative; UI provides live feedback to prevent round-trips     |
| Balance computation (derived)           | API / Backend      | —                              | Never stored; computed per request from income aggregation                 |
| Summary query (income aggregation)      | API / Backend      | —                              | DB-level SUM via Drizzle, filtered by RECEIVED + profitFirstAllocated      |
| Date-range preset computation           | Browser / Client   | —                              | Manila timezone computed client-side using date-fns/tz                     |
| Filter state persistence                | Browser / Client   | Frontend Server (SSR read)     | `nuqs` writes URL params; page.tsx reads searchParams for SSR fetch        |
| Amount masking toggle                   | Browser / Client   | —                              | localStorage-backed; client-only hook                                      |
| CRUD mutations (create/update/delete)   | API / Backend      | —                              | Business rules enforced server-side                                        |
| Delete guard (non-CUSTOM + wallet link) | API / Backend      | —                              | Security-sensitive; must not be client-only                                |
| Color palette enforcement               | Browser / Client   | API / Backend (Zod enum)       | UI limits choices; API validates accepted hex value is in the palette      |

---

## Standard Stack

### Core

| Library             | Version | Purpose                     | Why Standard                                 |
| ------------------- | ------- | --------------------------- | -------------------------------------------- |
| drizzle-orm         | 0.45.2  | Schema + queries for D1     | Already pinned; all DB access via Drizzle    |
| hono                | 4.12.9  | API routes + middleware     | Already pinned; edge-runtime compatible      |
| @hono/zod-validator | 0.7.6   | Request validation          | Already pinned; used in auth routes          |
| zod                 | 4.3.6   | Schema definition           | Already pinned; used across web + API        |
| date-fns            | 4.1.0   | Date arithmetic for presets | Already pinned                               |
| @date-fns/tz        | 1.4.1   | Asia/Manila timezone        | Already pinned; reference's `TZDate` pattern |
| nuqs                | 2.8.9   | URL search param state      | Already pinned; D-11 decision                |
| sonner              | 2.0.7   | Toast notifications         | Already pinned; used in auth UI              |
| lucide-react        | 1.8.0   | Icons                       | Already pinned                               |

### Supporting

| Library               | Version       | Purpose                  | When to Use                                             |
| --------------------- | ------------- | ------------------------ | ------------------------------------------------------- |
| drizzle-kit           | 0.31.10       | Migration generation     | Running `drizzle-kit generate` for new table + backfill |
| @tanstack/react-table | 8.21.3        | (not needed this phase)  | Future phases                                           |
| clsx / tailwind-merge | 2.1.1 / 3.5.0 | Class merging via `cn()` | All UI components                                       |

**No new dependencies required for this phase.** [VERIFIED: codebase inspection of packages/db/package.json, apps/api/package.json, apps/web/package.json]

---

## Package Legitimacy Audit

No new packages are introduced in this phase. All dependencies are already pinned in the repo's `package-lock.json`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  └─ /profit-first page (Next.js RSC)
       ├─ reads ?from,?to,?categoryIds from URL (nuqs / searchParams)
       ├─ SSR fetch → BFF proxy (apps/web/src/app/api/profit-first/[...path]/route.ts)
       │    └─ server-to-server → Hono API (apps/api/src/routes/profit-first.ts)
       │         ├─ requireAuth middleware → userId from JWT
       │         ├─ GET /api/profit-first/summary?from&to&categoryIds
       │         │    └─ profitFirstService.getSummary(userId, dateRange, filters)
       │         │         ├─ Parallel: SUM(amount) WHERE RECEIVED + profitFirstAllocated
       │         │         │            + date/category filters (Drizzle D1)
       │         │         └─ Parallel: SELECT * FROM profit_first_accounts ORDER BY sortOrder
       │         │    returns { totalIncome: number, accounts: AccountResponse[] }
       │         ├─ POST   /api/profit-first/accounts         → createAccount
       │         ├─ PATCH  /api/profit-first/accounts/:id     → updateAccount
       │         ├─ DELETE /api/profit-first/accounts/:id     → deleteAccount
       │         └─ PUT    /api/profit-first/percentages      → updatePercentages
       └─ Client components (ProfitFirstOverview, PFPercentageEditor, PFAccountForm)
            ├─ Server Actions (account-actions.ts) call BFF proxy
            ├─ router.refresh() triggers RSC re-fetch
            └─ AmountToggle / MaskedAmount (localStorage-backed visibility)

Registration paths (auth-service.ts):
  register()         → seedProfitFirstAccounts(db, userId) [NEW call]
  upsertGoogleUser() → seedProfitFirstAccounts(db, userId) [on creation only]

Backfill migration (Drizzle Kit):
  INSERT INTO profit_first_accounts WHERE userId NOT IN (existing accounts)
```

### Recommended Project Structure

```
packages/db/src/
└─ schema.ts                        # Add profitFirstAccounts table

apps/api/src/
├─ routes/
│   └─ profit-first.ts              # NEW: thin Hono router
├─ services/
│   └─ profit-first-service.ts      # NEW: factory createProfitFirstService(db)
├─ schemas/
│   └─ profit-first.ts              # NEW: Zod input schemas
└─ lib/
    └─ money.ts                     # NEW (or shared): toCents / fromCents helpers

apps/web/src/
├─ app/
│   ├─ (dashboard)/
│   │   └─ profit-first/
│   │       ├─ page.tsx             # NEW: RSC — fetches summary + categories
│   │       ├─ loading.tsx          # NEW: skeleton
│   │       └─ _components/
│   │           ├─ pf-overview.tsx          # NEW: main client component
│   │           ├─ pf-percentage-editor.tsx # NEW: bulk % editor
│   │           ├─ pf-account-form.tsx      # NEW: create account form
│   │           └─ pf-filters.tsx           # NEW: category filter sheet
│   │       └─ _actions/
│   │           └─ account-actions.ts       # NEW: server actions
│   └─ api/
│       └─ profit-first/
│           └─ [...path]/
│               └─ route.ts         # NEW: BFF proxy for profit-first routes
├─ components/
│   └─ amount-visibility.tsx        # NEW: shared useAmountVisibility + AmountToggle + MaskedAmount
└─ lib/
    └─ format-currency.ts           # NEW: cents → display string helper
        (or extend utils.ts)
```

### Pattern 1: Service Factory (matches existing auth pattern)

**What:** Service is a factory function accepting a Drizzle db instance and returning an object of methods.
**When to use:** All business logic for profit-first operations — getSummary, createAccount, updateAccount, deleteAccount, updatePercentages.

```typescript
// Source: reference /mnt/c/dev/profitfirst/practice/src/server/services/profit-first-service.ts
// Adapted: businessId → userId; rental/unit filter paths stripped

import { eq, and, ne, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { schema } from '@app/db/schema';
import { profitFirstAccounts, incomes } from '@app/db/schema';
import { HTTPException } from 'hono/http-exception';

type AppDb = DrizzleD1Database<typeof schema>;

export function createProfitFirstService(db: AppDb) {
  async function getTotalReceivedIncome(
    userId: number,
    dateRange?: { from?: string; to?: string },
    filters?: { categoryIds?: number[] }
  ): Promise<number> {
    const conditions = [
      sql`${incomes.userId} = ${userId}`,
      sql`${incomes.moneyStatus} = 'RECEIVED'`,
      sql`${incomes.profitFirstAllocated} = 1`,
    ];
    if (dateRange?.from) conditions.push(sql`${incomes.incomeDate} >= ${dateRange.from}`);
    if (dateRange?.to) conditions.push(sql`${incomes.incomeDate} <= ${dateRange.to}`);
    if (filters?.categoryIds?.length) {
      const idList = sql.join(
        filters.categoryIds.map((id) => sql`${id}`),
        sql`, `
      );
      conditions.push(sql`${incomes.categoryId} IN (${idList})`);
    }
    const rows = await db
      .select({ total: sql<number>`COALESCE(SUM(${incomes.amount}), 0)` })
      .from(incomes)
      .where(sql.join(conditions, sql` AND `));
    return (rows[0] as { total: number }).total;
  }

  // Balance formula: integer math, never float
  function computeBalance(totalIncomeCents: number, targetPercentage: number): number {
    return Math.round((totalIncomeCents * targetPercentage) / 10000);
  }

  return {
    async getSummary(userId, dateRange?, filters?) {
      /* parallel queries */
    },
    async createAccount(userId, input) {
      /* currentTotal + maxSortOrder in parallel with income total */
    },
    async updateAccount(accountId, userId, input) {
      /* fetch existing, check sum, update + income total in parallel */
    },
    async deleteAccount(accountId, userId) {
      /* guard non-CUSTOM, guard wallet link */
    },
    async updatePercentages(userId, input) {
      /* validate sum === 10000, parallel updates */
    },
  };
}
```

### Pattern 2: Drizzle Schema (profit_first_accounts table)

**What:** New table in `packages/db/src/schema.ts`, replacing `businessId` with `userId FK`.

```typescript
// Source: reference schema.ts §profitFirstAccounts, adapted for userId
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './schema';

export const profitFirstAccounts = sqliteTable(
  'profit_first_accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    targetPercentage: integer('target_percentage').notNull(), // basis points
    color: text('color').notNull(), // e.g. "#10b981"
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

### Pattern 3: Seeding at Registration

**What:** Call `seedProfitFirstAccounts(db, userId)` inside `register()` and inside the "new user" branch of `upsertGoogleUser()`.

```typescript
// Source: reference seed.ts + auth-service integration
// In apps/api/src/services/auth-service.ts

// After inserting the new user:
const user = inserted[0];
await seedProfitFirstAccounts(db, user.id); // NEW call
```

```typescript
// New shared helper — apps/api/src/services/profit-first-service.ts or a seed helper
export async function seedProfitFirstAccounts(db: AppDb, userId: number): Promise<void> {
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

### Pattern 4: BFF Proxy Extension (matches existing auth proxy)

**What:** A catch-all route at `apps/web/src/app/api/profit-first/[...path]/route.ts` that mirrors the auth BFF proxy — forwards Bearer token, relays Set-Cookie, no unit-owner scoping needed.

```typescript
// Reuse the same proxy() helper pattern from apps/web/src/app/api/auth/[...path]/route.ts
// Change: target path prefix is /api/profit-first/
// All methods: GET, POST, PATCH, DELETE, PUT
```

### Pattern 5: Server Action (UI → BFF)

**What:** Server actions in `_actions/account-actions.ts` convert UI percent (0–100) to basis points before calling the API.

```typescript
// Source: reference _actions/account-actions.ts
// Key conversion: targetPercentage: Math.round(input.targetPercentage * 100)
// (UI works in whole-number percent; API stores basis points)
export async function createAccountAction(input: {
  name: string;
  targetPercentage: number;
  color: string;
}) {
  const res = await fetch('/api/profit-first/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      targetPercentage: Math.round(input.targetPercentage * 100), // pct → bp
    }),
  });
  // ...
}
```

### Pattern 6: Manila Timezone Date Presets

**What:** Compute date preset ranges using `TZDate` from `@date-fns/tz`.

```typescript
// Source: reference lib/timezone.ts + pf-overview.tsx
import { TZDate } from '@date-fns/tz';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from 'date-fns';

const APP_TIMEZONE = 'Asia/Manila';

export function nowManila() {
  return new TZDate(new Date(), APP_TIMEZONE);
}

// In component:
const DATE_PRESETS = [
  {
    label: 'This Month',
    getRange: () => ({ from: fmt(startOfMonth(nowManila())), to: fmt(endOfMonth(nowManila())) }),
  },
  {
    label: 'Last Month',
    getRange: () => ({
      from: fmt(startOfMonth(subMonths(nowManila(), 1))),
      to: fmt(endOfMonth(subMonths(nowManila(), 1))),
    }),
  },
  {
    label: 'Last 3 Months',
    getRange: () => ({
      from: fmt(startOfMonth(subMonths(nowManila(), 2))),
      to: fmt(endOfMonth(nowManila())),
    }),
  },
  {
    label: 'This Year',
    getRange: () => ({ from: fmt(startOfYear(nowManila())), to: fmt(endOfYear(nowManila())) }),
  },
  { label: 'All Time', getRange: () => ({ from: undefined, to: undefined }) },
] as const;
```

### Anti-Patterns to Avoid

- **Storing computed balances:** Never persist `computedBalance` in the DB. Always derive as `Math.round((totalIncomeCents * targetPercentage) / 10000)`. Storing it would go stale when percentages change.
- **Float arithmetic for money:** Never `(totalIncome * targetPercentage / 100)` on decimal values. Stay in integer cents throughout: fetch cents from DB, compute in integer cents, `fromCents()` only for display.
- **`businessId` left in queries:** The reference queries filter by `businessId`. Profitmuna uses `userId`. Missing this substitution causes cross-user data leakage — security-critical.
- **Parallel updates without parallel query patterns:** The reference runs `Promise.all([getTotalReceivedIncome(...), db.select(...).from(profitFirstAccounts)...])` to avoid sequential round-trips to D1. Replicate this.
- **Percent editor sending basis points to UI:** The UI works in whole-number percent (0–100) for human readability. The conversion to basis points (`* 100`) happens in the server action before the API call. Never render basis points in the percentage editor inputs.
- **Skipping the non-CUSTOM delete guard:** Deleting a default account (PROFIT/OWNERS_PAY/TAX/OPEX) must be blocked at the service layer, not just the UI. The API must check `accountType !== 'CUSTOM'`.

---

## Don't Hand-Roll

| Problem               | Don't Build                           | Use Instead                                  | Why                                                                  |
| --------------------- | ------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| URL state for filters | Manual `window.location` manipulation | `nuqs` (already pinned)                      | Handles SSR-safe searchParams, type coercion, batch updates          |
| Timezone-aware dates  | Manual UTC offset math                | `@date-fns/tz` `TZDate` (already pinned)     | DST-safe; Manila DST history handled correctly                       |
| Request validation    | Manual `if (!body.name)` checks       | Zod + `@hono/zod-validator` (already pinned) | Type inference, 422 on failure, consistent shape                     |
| Color input           | Custom color picker                   | Preset swatch palette (D-08)                 | Matches reference; avoids invalid hex entries                        |
| Migration backfill    | Runtime check on every request        | Drizzle Kit migration file                   | Idempotent; runs once at deploy; no performance overhead on hot path |

---

## Common Pitfalls

### Pitfall 1: `businessId` → `userId` substitution gaps

**What goes wrong:** A query still uses `businessId` column or scope, either silently returning empty results or — worse — querying across users if the column doesn't exist.
**Why it happens:** Direct copy-paste from reference service without renaming.
**How to avoid:** Schema defines only `userId` (no `businessId` column). Drizzle types will error at compile time if you reference a non-existent column — TypeScript enforces this.
**Warning signs:** `getTotalReceivedIncome` returns 0 unexpectedly; accounts list is empty after seeding.

### Pitfall 2: Float leakage in balance computation

**What goes wrong:** `(totalIncome / 100) * (targetPercentage / 100)` introduces floating-point rounding errors.
**Why it happens:** Trying to "simplify" the formula.
**How to avoid:** Keep `totalIncomeCents` as integer cents from DB; compute `Math.round((totalIncomeCents * targetPercentage) / 10000)` — two integer multiplications before the single division. `fromCents()` converts only for the final display value.
**Warning signs:** Account balances show cents-off rounding differences.

### Pitfall 3: Percentage editor UI input vs API storage confusion

**What goes wrong:** The `PFPercentageEditor` shows `account.targetPercentage` directly — but in the reference the API response returns `targetPercentage / 100` (percent, not basis points). The Profitmuna API response should follow the same convention.
**Why it happens:** The reference `computeBalances` converts `targetPercentage / 100` before returning. If Profitmuna returns raw basis points, the editor total check `total === 100` will fail (it would be `total === 10000`).
**How to avoid:** Decide in the API response shape: either return percent (reference style) or basis points. The server action conversion `Math.round(pct * 100)` must match what the API returns. **Recommendation:** Return percent in API responses (matching reference `targetPercentage / 100`) and convert to bp in the service layer. Document this in the Zod response schema.
**Warning signs:** `PFPercentageEditor` total shows 10000 instead of 100; save button stays disabled.

### Pitfall 4: Seeding called in wrong branch of `upsertGoogleUser`

**What goes wrong:** `seedProfitFirstAccounts` called for returning Google users (googleId match or email link), creating duplicate rows and violating the unique(userId, name) index.
**Why it happens:** Seeding added to `upsertGoogleUser` without checking which branch executed.
**How to avoid:** Only seed in the "brand new Google user" branch (branch 3 of `upsertGoogleUser`). `register()` always creates a new user so seeding is unconditional there.
**Warning signs:** D1 unique constraint error on `pfa_user_name_unique` during Google login for returning users.

### Pitfall 5: `nuqs` hook used in RSC / non-client component

**What goes wrong:** `useQueryState` from nuqs throws because it requires a client boundary.
**Why it happens:** Filter state hook imported at page level (RSC).
**How to avoid:** Page.tsx reads `searchParams` directly (RSC-safe). Only client components (`ProfitFirstOverview`, `PFFilters`) call `useQueryState`. The `nuqs` `parseAsString`/`parseAsArrayOf` helpers are used in server components only for reading, not calling hooks.
**Warning signs:** "useState in server component" React error.

### Pitfall 6: Backfill migration not idempotent

**What goes wrong:** Re-running migrations inserts duplicate default accounts for existing users.
**Why it happens:** Plain `INSERT` without existence check.
**How to avoid:** Use `INSERT OR IGNORE` (SQLite) or a `NOT EXISTS` subquery:

```sql
INSERT INTO profit_first_accounts (name, target_percentage, color, sort_order, account_type, user_id, created_at, updated_at)
SELECT 'Profit', 500, '#10b981', 0, 'PROFIT', id, datetime('now'), datetime('now')
FROM users
WHERE id NOT IN (SELECT DISTINCT user_id FROM profit_first_accounts);
```

All four defaults can be done in 4 such statements, or a single `WITH` CTE.
**Warning signs:** Unique constraint violation on second deploy.

### Pitfall 7: Amount masking causes hydration mismatch

**What goes wrong:** `useAmountVisibility` reads from `localStorage` in `useEffect`. Before effect runs, `visible = false` (SSR). If rendered on server with a different value, React shows hydration warning.
**Why it happens:** SSR renders the component with `visible = false`; client hydrates with `visible = true` from localStorage.
**How to avoid:** The reference guards with a `mounted` flag — return `{ visible: mounted && visible, ... }`. The `MaskedAmount` component only shows real value when `mounted && visible`. SSR always renders the masked "••••" state, which matches the initial client render. This pattern is already in `amount-visibility.tsx` — replicate exactly.
**Warning signs:** React hydration mismatch warning in console.

### Pitfall 8: D1 Worker binding scope in service

**What goes wrong:** Drizzle `createDb(c.env.DB)` called at module scope instead of per-request inside the route handler.
**Why it happens:** Optimizing for "don't repeat yourself" at module level.
**How to avoid:** In Cloudflare Workers, `c.env.DB` is a per-request binding. Always call `createDb(c.env.DB)` inside the route handler or pass the D1 binding to the service constructor. The existing auth service pattern does this correctly — follow it.
**Warning signs:** D1 `TypeError: Cannot read properties of undefined` on the binding.

---

## Code Examples

### Balance Computation (non-negotiable formula)

```typescript
// Source: reference profit-first-service.ts computeBalances()
// totalIncomeCents: integer cents from DB SUM query
// targetPercentage: integer basis points (e.g. 500 = 5%)
function computeBalance(totalIncomeCents: number, targetPercentage: number): number {
  return Math.round((totalIncomeCents * targetPercentage) / 10000);
}
```

### Delete Guard (service layer)

```typescript
// Source: reference deleteAccount, adapted for Profitmuna (userId, no wallets yet)
async function deleteAccount(accountId: number, userId: number): Promise<void> {
  const existing = await db.query.profitFirstAccounts.findFirst({
    where: and(eq(profitFirstAccounts.id, accountId), eq(profitFirstAccounts.userId, userId)),
  });
  if (!existing) throw new HTTPException(404, { message: 'not_found' });
  if (existing.accountType !== 'CUSTOM') {
    throw new HTTPException(400, { message: 'Cannot delete a default allocation account' });
  }
  // Phase 4 wallet guard: uncomment when wallets table exists
  // const linkedWallet = await db.query.wallets.findFirst({
  //   where: and(eq(wallets.userId, userId), eq(wallets.profitFirstAccountId, accountId)),
  // });
  // if (linkedWallet) throw new HTTPException(400, { message: `Cannot delete "${existing.name}" — wallet "${linkedWallet.name}" is linked to it.` });
  await db
    .delete(profitFirstAccounts)
    .where(and(eq(profitFirstAccounts.id, accountId), eq(profitFirstAccounts.userId, userId)));
}
```

### Amount Visibility Shared Component

```typescript
// Source: reference components/shared/amount-visibility.tsx — replicate exactly
// File: apps/web/src/components/amount-visibility.tsx
'use client';
const STORAGE_KEY = 'pf-amounts-visible';

export function useAmountVisibility() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem(STORAGE_KEY) === 'true') setVisible(true);
  }, []);
  const toggle = useCallback(() => {
    setVisible((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);
  return { visible: mounted && visible, toggle, mounted };
}
// + AmountToggle and MaskedAmount components (see reference for full code)
```

### Currency Formatting Helper (web)

```typescript
// File: apps/web/src/lib/format-currency.ts
// Interim hardcoded ₱ (Phase 6 will inject user currency setting)
// Mirrors Phase 2 D-08 decision: cents → display
export function formatCurrency(cents: number): string {
  return `₱${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
```

### PF_DEFAULT_COLORS Constant

```typescript
// Source: reference lib/constants.ts PF_DEFAULT_COLORS
// File: apps/web/src/lib/constants.ts (or apps/api/src/lib/constants.ts for validation)
export const PF_DEFAULT_COLORS = [
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
] as const;
```

---

## State of the Art

| Old Approach                              | Current Approach                             | When Changed | Impact                                                                           |
| ----------------------------------------- | -------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| `pages/` router with `getServerSideProps` | App Router RSC + server actions              | Next.js 13+  | `searchParams` is a Promise in Next.js 15; must `await searchParams` in page.tsx |
| `nuqs` v1 syntax                          | `nuqs` v2 (`parseAsString`, `useQueryState`) | nuqs 2.0     | API stable in 2.x; `useQueryStates` for batching                                 |
| `date-fns` v2 timezone via `date-fns-tz`  | `@date-fns/tz` `TZDate` (v1.x)               | date-fns v3  | `TZDate` replaces `zonedTimeToUtc`; reference already uses this pattern          |

**Deprecated/outdated:**

- `date-fns-tz` package: Replaced by `@date-fns/tz` (already pinned). Do not import from `date-fns-tz`.
- `next/server` `ServerActions` (App Router v13-era naming): Use `"use server"` directive in action files. This is stable in Next.js 15.

---

## Assumptions Log

| #   | Claim                                                                                                                                                                              | Section                       | Risk if Wrong                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| A1  | Phase 2 `incomes` table will have columns `userId`, `moneyStatus`, `profitFirstAllocated`, `incomeDate`, `categoryId`, `amount` matching the reference schema (adapted for userId) | Standard Stack / Architecture | Summary query will fail to compile if column names differ — catch at typecheck time |
| A2  | Phase 2 will establish the `(dashboard)` route group and a shared dashboard layout that Phase 3's profit-first page can nest inside                                                | Architecture Patterns         | Phase 3 page would need to create the layout group if Phase 2 doesn't               |
| A3  | The `fromCents` display convention matches `(cents / 100)` with 2 decimal places                                                                                                   | Code Examples                 | Minor: display values would be wrong if cents convention differs                    |

**Note on A1 and A2:** Both are [ASSUMED] since Phase 2 has no plans yet. If Phase 2 schema or route structure deviates from the reference, the planner should flag these as integration checkpoints.

---

## Open Questions

1. **Wallet guard stub timing (Claude's Discretion)**
   - What we know: `deleteAccount` must eventually check for a linked wallet (Phase 4). The wallet table doesn't exist in Phase 3.
   - What's unclear: Whether to stub the guard with a comment (simpler) or write the check with a conditional `try/catch` around the DB query (safer at runtime).
   - Recommendation: Stub with a commented-out block (reference pattern verbatim) — the planner should document this as a Phase 4 activation task. At Phase 3 runtime the wallets table doesn't exist, so any live query would error.

2. **Dashboard layout group existence**
   - What we know: Phase 2 likely creates `apps/web/src/app/(dashboard)/` with a shared layout (sidebar nav, auth guard). Phase 2 has no plans yet.
   - What's unclear: Exact route group name and layout file.
   - Recommendation: Phase 3 planner should note the dependency — if Phase 2 hasn't been executed, a minimal `(dashboard)/layout.tsx` with auth guard must be added to Phase 3 Wave 0.

3. **API response shape for `targetPercentage`**
   - What we know: Reference returns `targetPercentage / 100` (percent) in API responses; UI then shows whole numbers. Server actions multiply by 100 to send basis points back.
   - What's unclear: Profitmuna hasn't yet committed to this convention in any code.
   - Recommendation: Planner should lock this — **return percent (0–100) in API responses for human-readable display; service layer stores basis points**. Document in Zod response schema.

---

## Environment Availability

| Dependency     | Required By            | Available                 | Version  | Fallback                                   |
| -------------- | ---------------------- | ------------------------- | -------- | ------------------------------------------ |
| Node.js        | Build + test           | Yes                       | v24.15.0 | —                                          |
| npm            | Install                | Yes                       | 11.12.1  | —                                          |
| Wrangler CLI   | D1 migrations + deploy | Yes                       | 4.98.0   | —                                          |
| Vitest         | API unit tests         | Yes (in package.json)     | 3.0.0    | —                                          |
| better-sqlite3 | In-process test DB     | Yes (test helper uses it) | pinned   | —                                          |
| Cloudflare D1  | Production DB          | Requires CF account       | —        | Local D1 via `wrangler d1 execute --local` |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** D1 in CI uses `wrangler d1 execute --local` or `better-sqlite3` in-process (as per existing test helper pattern).

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| Framework          | Vitest 3.0.0                                                                  |
| Config file        | `apps/api/vitest.config.ts`                                                   |
| Quick run command  | `cd apps/api && npx vitest run --reporter=verbose tests/profit-first.test.ts` |
| Full suite command | `npm run test` (turbo runs all workspaces)                                    |

### Phase Requirements → Test Map

| Req ID | Behavior                                                 | Test Type | Automated Command                                                                           | File Exists? |
| ------ | -------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- | ------------ |
| PF-01  | `register()` seeds 4 default accounts                    | unit      | `npx vitest run tests/profit-first.test.ts -t "seeds default accounts on register"`         | Wave 0       |
| PF-01  | `upsertGoogleUser()` seeds accounts only for new users   | unit      | `npx vitest run tests/profit-first.test.ts -t "seeds on Google OAuth first login"`          | Wave 0       |
| PF-02  | `updatePercentages` rejects if total != 10000 bp         | unit      | `npx vitest run tests/profit-first.test.ts -t "rejects percentages not summing to 10000"`   | Wave 0       |
| PF-02  | `updatePercentages` succeeds when total = 10000 bp       | unit      | `npx vitest run tests/profit-first.test.ts -t "accepts valid percentage distribution"`      | Wave 0       |
| PF-03  | `createAccount` rejects if total would exceed 10000 bp   | unit      | `npx vitest run tests/profit-first.test.ts -t "rejects account creation that exceeds 100%"` | Wave 0       |
| PF-03  | `deleteAccount` rejects for non-CUSTOM type              | unit      | `npx vitest run tests/profit-first.test.ts -t "cannot delete default account"`              | Wave 0       |
| PF-04  | `getSummary` returns `Math.round((total * pct) / 10000)` | unit      | `npx vitest run tests/profit-first.test.ts -t "computes balance with integer math"`         | Wave 0       |
| PF-04  | `getSummary` filters to RECEIVED + profitFirstAllocated  | unit      | `npx vitest run tests/profit-first.test.ts -t "excludes PENDING income from balance"`       | Wave 0       |
| PF-04  | `getSummary` filters by dateRange and categoryIds        | unit      | `npx vitest run tests/profit-first.test.ts -t "applies date range filter"`                  | Wave 0       |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/profit-first.test.ts`
- **Per wave merge:** `npm run test` (full turbo suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/tests/profit-first.test.ts` — covers PF-01 through PF-04 service unit tests
- [ ] `apps/api/tests/helpers/db.ts` — extend DDL with `profit_first_accounts` table and seeder helpers
- [ ] `apps/web/src/lib/format-currency.ts` — needed for display in UI tests (if any)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                           |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | `requireAuth` middleware already handles this                                                                                                              |
| V3 Session Management | no      | Handled by Phase 1 JWT infrastructure                                                                                                                      |
| V4 Access Control     | yes     | Every PF route must verify `userId` from JWT matches queried data — userId scoped queries in all Drizzle WHERE clauses                                     |
| V5 Input Validation   | yes     | Zod schemas at every route: percentage values (integer, 0–10000), name (string, max length), color (enum from PF_DEFAULT_COLORS), sortOrder (integer >= 0) |
| V6 Cryptography       | no      | No cryptographic operations in this phase                                                                                                                  |

### Known Threat Patterns for Profit First stack

| Pattern                                                            | STRIDE                 | Standard Mitigation                                                                                                     |
| ------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| IDOR — accessing another user's accounts via guessed ID            | Elevation of Privilege | All queries include `AND userId = <from_jwt>` — Drizzle enforces at compile time via typed schema                       |
| Basis-point overflow — sending `targetPercentage = 999999`         | Tampering              | Zod schema: `z.number().int().min(0).max(10000)` at route boundary                                                      |
| Account name injection — XSS via stored name                       | Tampering              | React renders names as text content (never `dangerouslySetInnerHTML`); Zod `z.string().max(100).trim()`                 |
| Stale `fromCents` value displayed — cached response after % change | Information Disclosure | Balances are always derived server-side, never cached client-side beyond the RSC render; `router.refresh()` on mutation |
| Bypass delete guard via direct API call                            | Elevation of Privilege | Service-layer check, not UI-only; `accountType !== 'CUSTOM'` enforced in `deleteAccount` service                        |

---

## Sources

### Primary (HIGH confidence)

- Reference codebase `/mnt/c/dev/profitfirst/practice/src/server/services/profit-first-service.ts` — behavioral contract, verified by direct read
- Reference codebase `/mnt/c/dev/profitfirst/practice/src/server/db/schema.ts §profitFirstAccounts` — table shape, verified by direct read
- Reference codebase `/mnt/c/dev/profitfirst/practice/src/server/db/seed.ts` — exact seed values, verified by direct read
- Reference codebase `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/profit-first/_components/` — all 4 UI components read directly
- Reference codebase `/mnt/c/dev/profitfirst/practice/src/components/shared/amount-visibility.tsx` — masking pattern read directly
- Reference codebase `/mnt/c/dev/profitfirst/practice/src/lib/constants.ts §PF_DEFAULT_COLORS` — 8 hex values verified
- Reference codebase `/mnt/c/dev/profitfirst/practice/src/lib/timezone.ts` — Manila timezone utilities verified
- Profitmuna codebase `apps/api/src/services/auth-service.ts` — `register` and `upsertGoogleUser` integration points
- Profitmuna codebase `packages/db/src/schema.ts` — current schema (no profit_first_accounts yet)
- Profitmuna codebase `.planning/phases/03-profit-first-allocation/03-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)

- Profitmuna codebase `.planning/phases/02-income-expenses/02-CONTEXT.md` — Phase 2 income schema decisions (plans not yet written — A1/A2 remain assumed)

### Tertiary (LOW confidence)

- None — all claims in this research are sourced from the reference codebase or existing Profitmuna code.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all deps already pinned and verified in package.json
- Architecture: HIGH — direct read of reference service, schema, seed, and all 4 UI components
- Pitfalls: HIGH — sourced from reference code patterns and common Cloudflare Workers edge-runtime issues
- Phase 2 schema dependency: MEDIUM — decisions documented but no implementation yet; see A1/A2

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (30 days; stable stack with pinned deps)
