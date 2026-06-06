# Phase 4: Wallets - Research

**Researched:** 2026-06-06
**Domain:** Finance wallet management — schema, balance computation, category mapping, transaction management, Next.js UI
**Confidence:** HIGH

## Summary

Phase 4 adds the wallet layer to Profitmuna: PROFIT_FIRST wallets linked 1:1 to a Profit First allocation account, and BLANK standalone wallets. Each wallet maintains a derived balance (`pfAllocation + mappedIncome − mappedExpenses + deposits − withdrawals`) that is never stored but computed fresh on every read. Category-to-wallet mappings are 1:1 (conflict-blocked), and manual transactions can be inserted only when they would not double-count automatically sourced entries.

The behavioral source of truth is `/mnt/c/dev/profitfirst/practice/src/server/services/wallet-service.ts` (1,484 lines, fully read). The reference is a close fit; the only structural difference is replacing `businessId` scoping with single-user `userId` scoping. The Zod validation schemas (`/mnt/c/dev/profitfirst/practice/src/server/validations/wallet.ts`) and TypeScript types (`/mnt/c/dev/profitfirst/practice/src/types/wallet.ts`) can be ported almost verbatim. The reference UI components (wallet-card.tsx, new-wallet-form.tsx, wallet-detail.tsx) provide a pixel-close UI reference that uses the same shadcn/ui primitives already available in the project.

The project stack is already complete for this phase: Drizzle 0.45.2/D1 with `db.batch()` for atomic multi-statement writes (confirmed by Context7), Hono 4.12.9, zod 4.3.6 with `@hono/zod-validator`, nuqs for URL pagination state, sonner for toasts, cmdk for searchable category pickers, and date-fns for date formatting. No new dependencies are required.

**Primary recommendation:** Port the reference service directly (scoped to `userId` instead of `businessId`), use `db.batch()` for all clear-and-replace mapping operations, and place the list query's 7-way `Promise.all` in the service exactly as the reference does — this is the correct N+1 avoidance pattern for D1.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Wallet list is a card grid (reference `wallet-card.tsx` pattern) — name, color accent, type badge, total balance; negative balances styled red.
- **D-02:** Full balance breakdown lives on the detail page only, behind a collapsible disclosure; zero-value rows hidden. Cards show total balance only.
- **D-03:** Wallets ordered by `sortOrder` field; new wallets append at the end. Drag-to-reorder not required.
- **D-04:** Empty state suggests PF wallets: alongside the explainer + "Create wallet" CTA, offer one-click creation of a wallet for each unlinked allocation account. One-click creation goes through the standard create path pre-filled — no new service behavior.
- **D-05:** Category mapping is inline in the wallet form — pick categories during create; edit mappings on the wallet detail page. No separate mapping screen.
- **D-06:** Mapping conflicts are blocked: categories already mapped to another wallet appear disabled in the picker; server enforces with 409 Conflict ("already mapped to wallet X — remove it there first"). No move/steal flow.
- **D-07:** Expense side uses the reference's 3-mode selector: no expenses / auto-deduct ALL expenses (`autoDeductAllExpenses = true`) / specific categories. "Specific" mode validates at least one category selected.
- **D-08:** PROFIT_FIRST wallets hide the income-category mapping section in both create and detail (they're funded by the PF % allocation); server leaves any existing mappings untouched. Expense mapping remains available on PF wallets.
- **D-09:** Soft-deleted transactions stay inline in the history, greyed/strikethrough, with a one-click Restore button. No hidden-behind-toggle view.
- **D-10:** Transaction history uses page-based pagination controls (consistent with Phase 2; use `nuqs` for URL page state).
- **D-11:** Add/edit manual transactions via dialog/modal: "Add deposit" / "Add withdrawal" buttons open a dialog (amount, date, description); editing a row opens the same dialog pre-filled.
- **D-12:** Deleting a manual transaction shows a confirmation dialog first, followed by a sonner toast.
- **D-13:** Negative balances allowed — withdrawals are not blocked by computed balance (reference validates only amount > 0). Red styling signals overdraw.
- **D-14:** Shared currency formatter: build a `formatCurrency` helper in `apps/web/src/lib/` that reads a currency setting with ₱ (PHP) as default.
- **D-15:** Wallet color picked from a preset palette (8–12 curated swatches); stored as a hex string.
- **D-16:** Wallet deletion cascades (mappings + transactions hard-deleted) with an impact-detailing confirm dialog. No soft delete for wallets.
- **Balance formula (locked, derived — never stored):** `pfAllocation + mappedIncome − mappedExpenses + deposits − withdrawals`.
- **Fidelity constraint:** wallet behavior must match the reference implementation exactly, minus rentals features and multi-tenancy (replace `businessId` with `userId`).

### Claude's Discretion

- Exact card layout details, breakdown row labels, dialog field layout — follow the reference closely where it exists, shadcn/ui conventions otherwise.
- Page size for transaction pagination (align with whatever Phase 2 establishes).
- Exact preset palette colors (legible on light backgrounds; include the reference's defaults like `#10b981`).
- Manual-transaction blocking messages per wallet mode — reuse the reference's explainer copy.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (Currency selection UI remains Phase 6; D-14 only builds the shared formatter with a ₱ default.)
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                                                           | Research Support                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| WAL-01 | User can create a wallet — PROFIT_FIRST type (linked 1:1 to an allocation account) or BLANK                                           | Schema section + `create()` service method patterns                                                     |
| WAL-02 | User can map income/expense categories to a wallet (each category maps to at most one wallet) and toggle auto-deduct-all-expenses     | `setIncomeCategoryMappings()` + `setExpenseMappings()` + 3-mode expense selector                        |
| WAL-03 | User can view all wallets with computed balance breakdowns (PF allocation + mapped income − mapped expenses + deposits − withdrawals) | `list()` 7-way `Promise.all` + `computeBalanceCents()` patterns                                         |
| WAL-04 | User can record manual DEPOSIT/WITHDRAWAL transactions, edit them, soft-delete and restore them                                       | `assertCanInsertTransaction()` blocking rules + `removeTransaction()` / `restoreTransaction()` patterns |
| WAL-05 | User can view wallet detail with paginated transaction history                                                                        | `getById()` merge-three-sources pattern + `buildPaginatedResponse()` + nuqs page state                  |

</phase_requirements>

## Architectural Responsibility Map

| Capability                                       | Primary Tier                   | Secondary Tier             | Rationale                                                                            |
| ------------------------------------------------ | ------------------------------ | -------------------------- | ------------------------------------------------------------------------------------ |
| Wallet CRUD                                      | API / Backend                  | —                          | All DB mutations via Hono service layer; no direct DB from Next.js                   |
| Balance computation                              | API / Backend                  | —                          | Derived on every read in wallet-service; never stored                                |
| Category mapping conflict enforcement            | API / Backend                  | Frontend (disabled picker) | Server is authoritative; client disables already-mapped categories as UX hint only   |
| Transaction insert blocking (double-count guard) | API / Backend                  | —                          | `assertCanInsertTransaction()` runs server-side; cannot be bypassed by client        |
| Wallet list / card grid                          | Frontend Server (SSR)          | —                          | Server component fetches list from API, renders cards                                |
| Wallet detail + transaction history              | Frontend Server (SSR) + Client | —                          | Server fetches detail; client handles transaction dialogs + edit state               |
| Pagination URL state                             | Browser / Client               | —                          | nuqs syncs page param to URL search params                                           |
| Color picker / category multiselect              | Browser / Client               | —                          | Interactive form state managed client-side                                           |
| formatCurrency helper                            | Frontend Server (SSR) + Client | —                          | Pure utility in `apps/web/src/lib/`; callable from both server and client components |

## Standard Stack

### Core

| Library             | Version         | Purpose                               | Why Standard                                                                          |
| ------------------- | --------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| drizzle-orm         | 0.45.2 (pinned) | Schema definition, queries, batch API | Already in `packages/db`; `db.batch()` is the only atomic multi-write mechanism on D1 |
| hono                | 4.12.9 (pinned) | API routing                           | Already the API framework                                                             |
| @hono/zod-validator | 0.7.6 (pinned)  | Request validation                    | Already used in `apps/api/src/routes/auth.ts`                                         |
| zod                 | 4.3.6 (pinned)  | Schema validation                     | Already used in all schemas                                                           |
| nuqs                | 2.8.9 (pinned)  | URL search params for pagination      | Already pinned; D-10 requires page state in URL                                       |

### Supporting

| Library      | Version        | Purpose                                                      | When to Use                                                         |
| ------------ | -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| sonner       | 2.0.7 (pinned) | Toast notifications                                          | All success/error feedback (D-11, D-12)                             |
| cmdk         | 1.1.1 (pinned) | Searchable multiselect for category picker                   | Category mapping UX in form (D-05, D-07)                            |
| date-fns     | 4.1.0 (pinned) | Date formatting in transaction history                       | `formatDate()` in wallet-detail                                     |
| @date-fns/tz | 1.4.1 (pinned) | Timezone-aware date utils                                    | If timezone-aware display needed (same as reference `nowManilaISO`) |
| lucide-react | 1.8.0 (pinned) | Icons (ArrowDownLeft, ArrowUpRight, Trash2, RotateCcw, etc.) | Transaction type icons in detail view                               |

**No new dependencies are required for this phase.** All libraries above are already pinned.

**Installation:** None needed.

## Package Legitimacy Audit

> No new packages are installed in this phase. All required libraries are already pinned in the workspace `package.json` files. Audit section is N/A.

| Package    | Registry | Status | Notes                                                    |
| ---------- | -------- | ------ | -------------------------------------------------------- |
| (none new) | —        | —      | All libraries already verified as workspace dependencies |

## Architecture Patterns

### System Architecture Diagram

```
Browser
  |
  | (same-origin fetch)
  v
Next.js BFF proxy (apps/web/src/app/api/auth/[...path]/route.ts)
  |-- transparently extended to /api/wallets/* (new proxy scope)
  |
  | (server-to-server, with Bearer access token)
  v
Hono API (apps/api/src/)
  |
  +-- GET  /api/wallets          → walletService.list(userId)
  +-- POST /api/wallets          → walletService.create(userId, input)
  +-- GET  /api/wallets/:id      → walletService.getById(userId, {page,size})
  +-- PUT  /api/wallets/:id      → walletService.update(userId, input)
  +-- DELETE /api/wallets/:id    → walletService.remove(userId)
  +-- POST /api/wallets/:id/transactions    → walletService.createTransaction(...)
  +-- PUT  /api/wallets/:id/transactions/:txId
  +-- DELETE /api/wallets/:id/transactions/:txId  (soft-delete)
  +-- PATCH  /api/wallets/:id/transactions/:txId/restore
  |
  v
Cloudflare D1 (via packages/db)
  wallets
  wallet_income_category_mappings  (unique: incomeCategoryId)
  wallet_expense_category_mappings (unique: expenseCategoryId)
  wallet_transactions              (soft-delete via deletedAt)
  + cross-joins: incomes, expenses, profit_first_accounts (Phases 2+3)
```

### Recommended Project Structure

```
packages/db/src/
  schema.ts                  ← add 4 new tables here

apps/api/src/
  routes/wallets.ts          ← thin route handler (9 endpoints)
  schemas/wallets.ts         ← Zod schemas (port from reference validations/wallet.ts)
  services/wallet-service.ts ← full wallet business logic (port from reference)
  types/                     ← add WalletSourceType, WalletTransactionType (or re-export from db)

apps/web/src/
  lib/
    format-currency.ts       ← formatCurrency helper (D-14, PHP default)
    wallet-labels.ts         ← sourceLabel, withdrawalLabel, sourceBadgeClasses (port from reference)
  types/
    wallet.ts                ← WalletListItem, WalletTransaction, WalletDetailResponse, etc.
  app/
    (dashboard)/
      wallets/
        page.tsx             ← server component: fetch list, render WalletCard grid + empty state
        _components/
          WalletCard.tsx     ← card (D-01): name, color accent, type badge, balance
        new/
          page.tsx           ← server component: fetch PF accounts + categories, render form
          _components/
            NewWalletForm.tsx  ← client component: source type selector, category pickers, color picker
        [walletId]/
          page.tsx           ← server component: fetch detail (with page), render WalletDetail
          _components/
            WalletDetail.tsx ← client component: breakdown disclosure, tx list, dialogs
        _actions/
          wallet-actions.ts  ← Next.js Server Actions wrapping API calls
```

### Pattern 1: Service factory with userId scoping

The reference uses `businessId`; Profitmuna replaces this with `userId` everywhere. The service factory pattern is identical.

```typescript
// Source: verified from /mnt/c/dev/profitfirst/practice/src/server/services/wallet-service.ts
// Adapted: businessId → userId, AppDatabase = ReturnType<typeof createDb>

export function createWalletService(db: ReturnType<typeof createDb>) {
  async function list(userId: number): Promise<WalletListItem[]> {
    // 7-way Promise.all to avoid N+1 on D1 — critical for list performance
    const [walletRows, totalReceivedIncome, perWalletImpact, mappingsByWallet,
           totalAllExpenses, incomeByCategory, expenseByCategory] =
      await Promise.all([
        db.select().from(wallets).leftJoin(...).where(eq(wallets.userId, userId)).orderBy(wallets.sortOrder, wallets.id),
        getTotalReceivedIncomeCents(userId),
        getPerWalletBalanceImpactCents(userId),
        getMappingsByWallet(userId),
        getAllExpensesCents(userId),
        getReceivedIncomeByCategoryCents(userId),
        getExpensesByCategoryCents(userId),
      ]);
    // ... compute per-wallet balance in JS from the shared aggregates
  }
}
```

[VERIFIED: read directly from reference service file]

### Pattern 2: Atomic clear-and-replace via db.batch()

Category mappings are always replaced atomically: delete all existing + insert new set.

```typescript
// Source: verified from reference wallet-service.ts setIncomeCategoryMappings()
// Drizzle D1 batch: all-or-nothing semantics [VERIFIED: Context7 drizzle-orm-docs]

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

await db.batch([deleteStmt, insertStmt]);
```

### Pattern 3: assertCanInsertTransaction blocking rules

This is the core double-count guard. Must be ported exactly.

```typescript
// Source: verified from reference wallet-service.ts assertCanInsertTransaction()
function assertCanInsertTransaction(
  type: WalletTransactionType,
  wallet: typeof wallets.$inferSelect,
  mappings: WalletMappings
): void {
  const incomeAuto = mappings.incomeCategories.length > 0;
  const expenseAuto = wallet.autoDeductAllExpenses || mappings.expenseCategories.length > 0;
  const hasPf = !!wallet.profitFirstAccountId;

  if (type === 'DEPOSIT') {
    if (hasPf)
      throw new BadRequestError(
        'Profit First wallets do not accept manual deposits — they derive their allocation from received income.'
      );
    if (incomeAuto)
      throw new BadRequestError(
        'This wallet auto-credits matching income. Manual deposits would double-count — record the income instead.'
      );
  } else {
    if (expenseAuto)
      throw new BadRequestError(
        'This wallet auto-deducts matching expenses. Manual withdrawals would double-count — record an expense instead.'
      );
  }
}
```

### Pattern 4: BFF proxy extension for wallet routes

The existing BFF proxy at `apps/web/src/app/api/auth/[...path]/route.ts` catches `/api/auth/*`. Wallet routes (`/api/wallets/*`) need a separate catch-all proxy at `apps/web/src/app/api/[...path]/route.ts` OR the existing proxy can be widened to cover all API routes. The reference uses Next.js Server Actions (not a BFF proxy) — this is a divergence to plan carefully.

**Recommended approach:** Use Next.js Server Actions (files in `_actions/wallet-actions.ts`) that call the Hono API server-to-server, forwarding the session cookie. This matches the reference pattern and avoids adding another BFF route. The `getSession()` helper in `apps/web/src/server/auth.ts` provides the userId; the server action reads the access token from the cookie and adds it as a Bearer header.

[ASSUMED] — exact server action → API call forwarding mechanism not yet established in Phases 2/3; may be superseded by those phases' patterns.

### Pattern 5: Transaction history merge from three sources

The detail view merges three sources in JS after fetching each bounded by `(page+1)*size`:

1. Auto-credited incomes (from `incomes` table, `moneyStatus='RECEIVED'`, mapped categories)
2. Auto-debited expenses (from `expenses` table, non-deleted, auto-deduct-all or mapped categories)
3. Manual wallet_transactions (including soft-deleted ones for inline restore — D-09)

Merge sort key: `transactionDate DESC`, then `id DESC`. Slice to `[page*size, (page+1)*size)`.

```typescript
// Source: verified from reference wallet-service.ts getById()
const merged = [...incomeEntries, ...expenseEntries, ...manualEntries];
merged.sort((a, b) => {
  if (a.transactionDate < b.transactionDate) return 1;
  if (a.transactionDate > b.transactionDate) return -1;
  return b.id - a.id;
});
const content = merged.slice(page * size, page * size + size);
```

### Pattern 6: Balance computation formula

```typescript
// Source: verified from reference wallet-service.ts computeBalanceCents()
const pfAllocation =
  wallet.profitFirstAccountId && pfAccount
    ? Math.round((totalReceivedIncome * pfAccount.targetPercentage) / 10000)
    : 0;

const balance =
  pfAllocation + mappedIncome - mappedExpenses + txImpact.deposits - txImpact.withdrawals;
```

Note: `targetPercentage` is stored as basis points (e.g., 500 = 5.00%). Division by 10000 converts to a ratio. [VERIFIED: confirmed from reference schema and STATE.md locked decisions]

### Anti-Patterns to Avoid

- **Storing the computed balance:** The balance is always derived. Never add a `balance` column to the `wallets` table. [VERIFIED: locked decision in STATE.md + CONTEXT.md]
- **N+1 aggregation queries:** On the list endpoint, running individual per-wallet aggregation queries kills D1 performance. Use the 7-way `Promise.all` with business-wide aggregations, then sum per-wallet in JS.
- **Single-statement mapping replace:** D1 has no multi-statement transactions via the ORM's `.transaction()` helper — use `db.batch()` for atomic clear-and-replace. [VERIFIED: Context7 drizzle-orm-docs]
- **Storing `businessId` in new schema:** This is a single-user app — use `userId` referencing `users.id`. Strip all `businessId` references from the ported schema.
- **Blocking withdrawals at negative balance:** D-13 explicitly allows negative balances — never add balance-check guards to the service.

## Don't Hand-Roll

| Problem                                     | Don't Build                         | Use Instead                                                            | Why                                                                   |
| ------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Atomic multi-statement writes on D1         | Custom retry/transaction logic      | `db.batch([...])`                                                      | D1's only safe multi-statement primitive; Drizzle exposes it directly |
| Pagination shape                            | Custom pagination object            | Port `buildPaginatedResponse()` from reference                         | Already battle-tested shape; planner expects consistent output        |
| Category conflict checking                  | Per-insert uniqueness queries       | Unique database indexes (`uniqueIndex`) + service-layer conflict check | DB enforces at write; service provides user-friendly 409 message      |
| formatCurrency                              | Intl.NumberFormat inline everywhere | `lib/format-currency.ts` (D-14)                                        | Single place to swap currency in Phase 6                              |
| Type-safe wallet label mapping              | Inline switch/case                  | Port `lib/wallet-labels.ts` from reference                             | Centralized; covers all PF account types                              |
| Searchable multiselect for category pickers | Custom dropdown                     | cmdk (already pinned)                                                  | Reference uses `SearchableMultiselect` built on cmdk                  |

**Key insight:** The reference service is not a "nice-to-have" reference — it is the behavioral source of truth. Port it; don't rewrite it.

## Common Pitfalls

### Pitfall 1: autoDeductAllExpenses uniqueness constraint not enforced by index alone

**What goes wrong:** Two wallets may both have `autoDeductAllExpenses = true` if the service check is skipped.
**Why it happens:** There is no database-level unique partial index on `autoDeductAllExpenses = 1` in D1/SQLite (not supported). The constraint is service-layer only.
**How to avoid:** In `setExpenseMappings()`, when `kind === 'ALL'`, query for any other wallet with `autoDeductAllExpenses = true` before updating. Throw `ConflictError` if one exists. Port the reference check verbatim.
**Warning signs:** Two wallets both deducting all expenses silently (no DB error, would double-count all expenses).

### Pitfall 2: Mapping operations not atomic — race condition window

**What goes wrong:** A concurrent request could read the mapping state between the delete and insert, seeing zero categories briefly.
**Why it happens:** `db.batch()` is atomic in D1 but `setIncomeCategoryMappings()` does a pre-check query before the batch. The window is between the check and the batch.
**How to avoid:** Accept this (reference accepts it too for v1). The unique index enforces the invariant — the second concurrent insert will fail with a constraint error. For v1 the race is acceptable.
**Warning signs:** Occasional 409 errors on concurrent edits (acceptable behavior, not a bug).

### Pitfall 3: Transaction history merge uses fetch-limit, not true DB-level merge pagination

**What goes wrong:** On high page numbers, `fetchLimit = (page+1)*size` fetches an increasingly large dataset into memory from three sources before slicing.
**Why it happens:** True DB-level cross-table pagination requires UNION ALL, which Drizzle's query builder doesn't support elegantly for this mixed schema.
**How to avoid:** Accept the reference's approach (bounded by `fetchLimit`). For v1 with typical transaction volumes this is fine. Document it as a known limitation.
**Warning signs:** Slow wallet detail loads for users with thousands of transactions. (Acceptable for v1.)

### Pitfall 4: Soft-deleted transactions must appear inline (D-09)

**What goes wrong:** The manual transactions fetch filters out deleted rows (e.g., `isNull(walletTransactions.deletedAt)`), causing restored transactions to "reappear" confusingly.
**Why it happens:** Copy-pasting the balance computation query (which excludes deleted) into the transaction history query.
**How to avoid:** The balance computation EXCLUDES deleted transactions (`isNull(deletedAt)`); the transaction history INCLUDES deleted ones (no filter on `deletedAt`). These are intentionally different queries.
**Warning signs:** Soft-deleted transactions not visible in the list; Restore button missing from UI.

### Pitfall 5: PF wallets should not expose income mapping fields

**What goes wrong:** The create form or edit form sends `incomeCategoryIds` for a PROFIT_FIRST wallet, which the service would accept (it doesn't reject them, per D-08).
**Why it happens:** The form doesn't hide the income section when `sourceType === 'PROFIT_FIRST'`.
**How to avoid:** In `NewWalletForm`, conditionally hide the income mapping section when `sourceType === 'PROFIT_FIRST'`. In `WalletDetail.saveEdit()`, do not send `incomeCategoryIds` when `hasPf` is true (match the reference: `...(hasPf ? {} : { incomeCategoryIds: ... })`).
**Warning signs:** PF wallets displaying an income mapping section; or income mappings being silently added to PF wallets.

### Pitfall 6: CORS and allowMethods for new HTTP verbs

**What goes wrong:** `PATCH` requests for `/transactions/:txId/restore` are rejected by CORS preflight.
**Why it happens:** The existing CORS config in `apps/api/src/index.ts` currently allows only `['GET', 'POST']`. The wallet routes need `PUT`, `DELETE`, and `PATCH`.
**How to avoid:** Update `allowMethods` to include `['GET', 'POST', 'PUT', 'DELETE', 'PATCH']` before or as part of adding wallet routes.
**Warning signs:** 405 Method Not Allowed or CORS preflight failures in browser.

### Pitfall 7: db.batch() type mismatch with existing codebase

**What goes wrong:** The existing auth service calls `(db as any).batch([...])` to work around the type. This must be replicated since the Drizzle D1 adapter typing doesn't natively expose `batch` on the typed return of `createDb`.
**Why it happens:** `createDb()` returns a Drizzle instance whose batch API may not be typed in the project's Drizzle version (0.45.2). The reference also uses `(db as any).batch(...)`.
**How to avoid:** Follow the reference pattern: cast to `any` at the `.batch()` call site and add a brief comment explaining it.
**Warning signs:** TypeScript error `Property 'batch' does not exist on type '...'`.

## Code Examples

### Schema additions (4 tables)

```typescript
// Source: verified from /mnt/c/dev/profitfirst/practice/src/server/db/schema.ts §Wallets
// Adapted: businessId → userId, references(() => users.id)

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users, incomeCategories, expenseCategories, profitFirstAccounts } from './schema';

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
    color: text('color').notNull(), // hex string e.g. "#10b981"
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('wallets_user_idx').on(table.userId),
    uniqueIndex('wallets_user_pf_account_unique').on(table.userId, table.profitFirstAccountId),
  ]
);

export const walletIncomeCategoryMappings = sqliteTable(
  'wallet_income_category_mappings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    walletId: integer('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    incomeCategoryId: integer('income_category_id')
      .notNull()
      .references(() => incomeCategories.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('wicm_income_category_unique').on(table.incomeCategoryId),
    index('wicm_user_idx').on(table.userId),
    index('wicm_wallet_idx').on(table.walletId),
  ]
);

export const walletExpenseCategoryMappings = sqliteTable(
  'wallet_expense_category_mappings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    walletId: integer('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    expenseCategoryId: integer('expense_category_id')
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('wecm_expense_category_unique').on(table.expenseCategoryId),
    index('wecm_user_idx').on(table.userId),
    index('wecm_wallet_idx').on(table.walletId),
  ]
);

export const walletTransactions = sqliteTable(
  'wallet_transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    walletId: integer('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type', { enum: ['DEPOSIT', 'WITHDRAWAL'] }).notNull(),
    amount: integer('amount').notNull(), // cents, always positive
    description: text('description'),
    transactionDate: text('transaction_date').notNull(), // YYYY-MM-DD
    deletedAt: text('deleted_at'), // soft delete
    createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('wt_user_wallet_idx').on(table.userId, table.walletId),
    index('wt_wallet_date_idx').on(table.walletId, table.transactionDate),
  ]
);
```

[VERIFIED: derived directly from reference schema, adapted for single-user scoping]

### Zod schemas (port from reference)

```typescript
// Source: verified from /mnt/c/dev/profitfirst/practice/src/server/validations/wallet.ts

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

export const walletTransactionQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});
```

### API route shape (9 endpoints)

```
GET    /api/wallets                                    → list(userId)
POST   /api/wallets                                    → create(userId, body)
GET    /api/wallets/:walletId?page=N&size=N            → getById(walletId, userId, {page,size})
PUT    /api/wallets/:walletId                          → update(walletId, userId, body)
DELETE /api/wallets/:walletId                          → remove(walletId, userId)
POST   /api/wallets/:walletId/transactions             → createTransaction(walletId, userId, body)
PUT    /api/wallets/:walletId/transactions/:txId       → updateTransaction(walletId, txId, userId, body)
DELETE /api/wallets/:walletId/transactions/:txId       → removeTransaction(walletId, txId, userId)  [soft]
PATCH  /api/wallets/:walletId/transactions/:txId/restore → restoreTransaction(walletId, txId, userId)
```

### Wallet label utilities (port from reference)

```typescript
// Source: verified from /mnt/c/dev/profitfirst/practice/src/lib/wallet-labels.ts
// Location: apps/web/src/lib/wallet-labels.ts

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
```

### formatCurrency helper (D-14)

```typescript
// Location: apps/web/src/lib/format-currency.ts
// PHP default; Phase 6 (SET-01) replaces the default by reading user settings

const DEFAULT_CURRENCY = 'PHP';
const DEFAULT_LOCALE = 'en-PH';

export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
```

[ASSUMED] — exact locale/format options; PHP/₱ default is locked (D-14).

## State of the Art

| Old Approach                           | Current Approach      | When Changed                  | Impact                                                                 |
| -------------------------------------- | --------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| DB-level transaction for atomic writes | `db.batch()` for D1   | D1-specific                   | Only batch is available; Drizzle's `.transaction()` doesn't work on D1 |
| Storing computed balance               | Derived on every read | Always the reference approach | Percentage changes retroactively update all balances                   |
| Page-based pagination via offset       | DB offset queries     | Standard                      | The merged-in-JS approach on detail avoids UNION ALL complexity        |

**Deprecated/outdated:**

- `businessId` scoping: replaced with `userId` for all 4 new tables. Do not use the reference schema verbatim — strip every `businessId` column and replace with `userId`.

## Assumptions Log

| #   | Claim                                                                                                                                                       | Section                           | Risk if Wrong                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Server Actions calling Hono API server-to-server (forwarding access token) is the correct pattern for Phase 4, consistent with whatever Phase 2 establishes | Architecture Patterns — Pattern 4 | Phase 2 may establish a different approach (direct DB from server components, or a different proxy); planner must verify Phase 2's pattern before locking Phase 4's client→server strategy |
| A2  | `formatCurrency` with PHP default and Intl.NumberFormat API is the correct implementation for D-14                                                          | Code Examples                     | Locale `en-PH` may not produce exactly ₱ symbol — should be validated in browser                                                                                                           |
| A3  | Phase 2 establishes pagination page size (planner should align WAL-05 page size with INC-02 page size)                                                      | Standard Stack — nuqs             | If Phase 2 uses a different default (e.g., 25 instead of 20), WAL-05 should match                                                                                                          |
| A4  | `profitFirstAccounts` table will exist in `packages/db/src/schema.ts` after Phase 3 completes                                                               | Schema additions code example     | If Phase 3 uses a different table/column name, the FK reference must be updated                                                                                                            |
| A5  | `incomeCategories` and `expenseCategories` tables will exist after Phase 2                                                                                  | Schema additions code example     | Phase 2 must complete before Phase 4 can be executed                                                                                                                                       |

## Open Questions

1. **Server Action vs. BFF proxy for wallet API calls from Next.js**
   - What we know: Phase 1 uses a BFF catch-all proxy (`/api/auth/[...path]`) for the auth routes. The reference uses Next.js Server Actions calling the API server-side.
   - What's unclear: Phases 2 and 3 haven't been planned yet — they will establish the pattern for all non-auth API calls.
   - Recommendation: Planner should note that the first task of Phase 4 wave 0 must verify Phase 3's established server→API call pattern and conform to it.

2. **Timestamps pattern in new tables**
   - What we know: Existing schema uses `createdAt` as a standalone field with `$defaultFn`. The reference uses a `timestamps` spread object.
   - What's unclear: Whether an `updatedAt` column needs a trigger or can be set manually on update.
   - Recommendation: Follow the existing project pattern (manual `createdAt` only, or manually set `updatedAt` in service `update()` calls). Do not add DB triggers (D1 supports them but Drizzle Kit doesn't generate them).

## Environment Availability

| Dependency          | Required By                 | Available                             | Version | Fallback                                                     |
| ------------------- | --------------------------- | ------------------------------------- | ------- | ------------------------------------------------------------ |
| Cloudflare D1       | Wallet data persistence     | ✓ (assumed — Phase 1 already uses it) | —       | —                                                            |
| drizzle-kit         | Schema migration generation | ✓                                     | 0.31.10 | —                                                            |
| nuqs                | URL pagination state        | ✓ (pinned in package.json)            | 2.8.9   | —                                                            |
| Phases 2 + 3 tables | FKs from wallets schema     | Pending                               | —       | Phase 4 cannot run migrations until Phases 2+3 schema exists |

**Missing dependencies with no fallback:**

- Phases 2 (income/expense categories) and 3 (profit_first_accounts) schema must be migrated to D1 before Phase 4 migration can succeed. Phase 4 execution depends on these phases being complete.

## Validation Architecture

### Test Framework

| Property           | Value                                        |
| ------------------ | -------------------------------------------- |
| Framework          | Vitest 3.0.0                                 |
| Config file        | `apps/api/vitest.config.ts` (exists)         |
| Quick run command  | `npm run test --workspace=apps/api -- --run` |
| Full suite command | `npm run test` (turbo runs all workspaces)   |

### Phase Requirements → Test Map

| Req ID | Behavior                                                                               | Test Type | Automated Command                                                  | File Exists? |
| ------ | -------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ | ------------ |
| WAL-01 | `POST /api/wallets` creates PROFIT_FIRST wallet with linked PF account                 | unit      | `npm run test --workspace=apps/api -- --run tests/wallets.test.ts` | ❌ Wave 0    |
| WAL-01 | `POST /api/wallets` creates BLANK wallet                                               | unit      | same                                                               | ❌ Wave 0    |
| WAL-01 | `POST /api/wallets` rejects duplicate PF account link (409)                            | unit      | same                                                               | ❌ Wave 0    |
| WAL-02 | Category mapping conflict returns 409                                                  | unit      | same                                                               | ❌ Wave 0    |
| WAL-02 | 3-mode expense selector (NONE/ALL/CATEGORIES) persists correctly                       | unit      | same                                                               | ❌ Wave 0    |
| WAL-02 | autoDeductAllExpenses uniqueness enforced (only one wallet per user)                   | unit      | same                                                               | ❌ Wave 0    |
| WAL-03 | Balance formula: pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals | unit      | same                                                               | ❌ Wave 0    |
| WAL-03 | Negative balance allowed (D-13)                                                        | unit      | same                                                               | ❌ Wave 0    |
| WAL-04 | `assertCanInsertTransaction` blocks PF wallet deposit                                  | unit      | same                                                               | ❌ Wave 0    |
| WAL-04 | Soft delete sets deletedAt; restore clears it                                          | unit      | same                                                               | ❌ Wave 0    |
| WAL-05 | Paginated transaction history merges 3 sources, sorts by date DESC                     | unit      | same                                                               | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npm run test --workspace=apps/api -- --run tests/wallets.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/tests/wallets.test.ts` — covers WAL-01 through WAL-05 service-layer behavior
- [ ] Test fixtures: mock D1 database with Phase 2+3 tables seeded (incomeCategories, expenseCategories, profitFirstAccounts)

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category         | Applies | Standard Control                                                                                                        |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | yes     | `requireAuth` middleware — all 9 wallet endpoints require valid Bearer JWT                                              |
| V3 Session Management | no      | Session handled by Phase 1 auth layer; wallet routes are stateless                                                      |
| V4 Access Control     | yes     | Ownership check: every query scoped to `userId` from JWT (`c.get('userId')`); no wallet from another user is accessible |
| V5 Input Validation   | yes     | Zod schemas at route entry point (name max 80, color regex, amount positive, date YYYY-MM-DD)                           |
| V6 Cryptography       | no      | No new crypto; amounts stored as integers, not encrypted                                                                |

### Known Threat Patterns

| Pattern                                                             | STRIDE                 | Standard Mitigation                                                                                                |
| ------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| IDOR — access wallet of another user                                | Elevation of Privilege | All queries include `eq(wallets.userId, userId)` where userId comes from the verified JWT, never from request body |
| Category ID injection — reference category from another user's data | Tampering              | In `setIncomeCategoryMappings`, validate category belongs to the authenticated user before inserting               |
| Negative amount for transaction                                     | Tampering              | `amount: z.number().positive()` in Zod schema; service also rejects `toCents(amount) <= 0`                         |
| Balance double-count via concurrent deposit+income                  | Tampering              | `assertCanInsertTransaction` blocks manual deposits when income auto-credit is active                              |
| Mass wallet delete / data destruction                               | Tampering              | Confirmation dialog (D-16) is client-side UX only; DELETE endpoint requires valid JWT ownership check              |
| Invalid color injection                                             | Tampering              | Color validated as `/^#[0-9a-fA-F]{6}$/` in Zod schema                                                             |

**Additional security note:** The CORS `allowMethods` in `apps/api/src/index.ts` must be updated to include `PUT`, `DELETE`, `PATCH` to support wallet mutation endpoints. Currently only `GET` and `POST` are allowed. Failing to do this blocks wallet updates/deletes silently at the CORS preflight level.

## Sources

### Primary (HIGH confidence)

- `/mnt/c/dev/profitfirst/practice/src/server/services/wallet-service.ts` — read in full (1,484 lines); behavioral source of truth for all wallet service methods
- `/mnt/c/dev/profitfirst/practice/src/server/db/schema.ts` lines 481–580 — verified schema for all 4 wallet tables
- `/mnt/c/dev/profitfirst/practice/src/server/validations/wallet.ts` — verified Zod schemas
- `/mnt/c/dev/profitfirst/practice/src/types/wallet.ts` — verified TypeScript types
- `/mnt/c/dev/profitfirst/practice/src/server/routes/wallets.ts` — verified 9-endpoint route structure
- `/mnt/c/dev/profitfirst/practice/src/lib/wallet-labels.ts` — verified label utilities
- Context7 `/drizzle-team/drizzle-orm-docs` — confirmed `db.batch()` semantics for D1 (all-or-nothing implicit transaction)
- `.planning/phases/04-wallets/04-CONTEXT.md` — locked user decisions D-01 through D-16

### Secondary (MEDIUM confidence)

- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/wallets/_components/wallet-card.tsx` — read in full; reference card UI
- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/wallets/new/_components/new-wallet-form.tsx` — read substantially; reference create form with 3-mode expense selector
- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/wallets/[walletId]/_components/wallet-detail.tsx` — read first 250 lines; reference detail component
- `/mnt/c/dev/profitfirst/practice/src/server/lib/pagination.ts` — verified `buildPaginatedResponse()` shape

### Tertiary (LOW confidence)

- A1–A5 assumptions in the Assumptions Log above

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already pinned; confirmed against CLAUDE.md and package.json
- Schema: HIGH — read directly from reference; adaptation (businessId→userId) is mechanical
- Service layer patterns: HIGH — wallet-service.ts read in full; all key functions verified
- Architecture: MEDIUM — server action vs. BFF proxy for Phase 4 depends on Phases 2+3 decisions (A1)
- Pitfalls: HIGH — all identified from direct reference code inspection

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (30 days — stable library versions, locked decisions)
