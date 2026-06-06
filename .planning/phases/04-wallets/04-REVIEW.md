---
phase: 04-wallets
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - apps/api/src/index.ts
  - apps/api/src/routes/wallets.ts
  - apps/api/src/schemas/wallets.ts
  - apps/api/src/services/wallet-service.ts
  - apps/api/tests/helpers/db.ts
  - apps/api/tests/wallets.test.ts
  - apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx
  - apps/web/src/app/(dashboard)/wallets/[walletId]/page.tsx
  - apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts
  - apps/web/src/app/(dashboard)/wallets/_components/WalletCard.tsx
  - apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx
  - apps/web/src/app/(dashboard)/wallets/new/page.tsx
  - apps/web/src/app/(dashboard)/wallets/page.tsx
  - apps/web/src/app/api/wallets/[...path]/route.ts
  - apps/web/src/components/ui/collapsible.tsx
  - apps/web/src/components/ui/command.tsx
  - apps/web/src/lib/wallet-labels.ts
  - apps/web/src/types/wallet.ts
  - packages/db/migrations/0003_natural_mauler.sql
  - packages/db/src/schema.ts
findings:
  critical: 3
  warning: 8
  info: 5
  total: 16
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 4 (Wallets) is broadly well-structured: routes are thin, business logic lives in `wallet-service.ts`, auth is enforced at the router level, all queries are ownership-scoped, and Drizzle parameterization keeps SQL injection off the table. The test suite covers the headline behaviors (CRUD, balance formula, guards, soft-delete).

However, adversarial tracing of the balance/history code surfaces three correctness defects that produce **wrong financial numbers** under realistic data: (1) the paginated transaction history reads auto-source rows without `ORDER BY`, so pagination silently shows the wrong transactions once a source exceeds one page; (2) non-numeric `walletId`/`txId` path params coerce to `NaN` and flow into queries, producing 200/404 ambiguity and bypassing the 422-validation contract; (3) the auto-expense history fan-out re-issues an unbounded per-category query loop that can duplicate-count under `autoDeductAllExpenses`. Several WARNING-level issues around N+1 conflict checks, dead/duplicated guard code, and a fragile redirect-in-try/catch flow follow.

## Critical Issues

### CR-01: Paginated transaction history fetches auto-source rows without ORDER BY — wrong page contents

**File:** `apps/api/src/services/wallet-service.ts:765-869`
**Issue:** `fetchLimit = (page + 1) * size` caps each source query with `.limit(fetchLimit)` but **none of the per-source queries specify `ORDER BY`**. SQLite (and D1) return rows in unspecified order absent an `ORDER BY`. The intent (per the "Pitfall 3" comment) is to fetch only enough of the most-recent rows from each source to fill the requested page, then merge-sort by date DESC. Without an `ORDER BY transactionDate DESC, id DESC LIMIT` on each source, the `.limit()` truncates an arbitrary subset, so once any single source has more than `fetchLimit` rows, the merge can omit the genuinely newest entries and the page is wrong. `total` (line 889) is also computed from the truncated/merged set, so `totalPages` is understated whenever truncation occurs. This corrupts the history view a user relies on to reconcile money.

**Fix:** Add deterministic ordering matched to the final sort, and fetch only what is needed, on every source query:

```ts
.orderBy(desc(incomes.incomeDate), desc(incomes.id))
.limit(fetchLimit)
```

```ts
.orderBy(desc(expenses.expenseDate), desc(expenses.id))
.limit(fetchLimit)
```

```ts
.orderBy(desc(walletTransactions.transactionDate), desc(walletTransactions.id))
.limit(fetchLimit)
```

Note this still cannot produce a correct global `total` without a separate count query — compute `total` via `COUNT(*)` per source summed, not from the truncated merge (see also WR-02).

### CR-02: Non-numeric path params coerce to NaN and reach the database

**File:** `apps/api/src/routes/wallets.ts:55, 66, 82, 94-95, 111, 129-130, 141-142`
**Issue:** `walletId` and `txId` are produced via `Number(c.req.param('walletId'))` with no validation. A request to `GET /api/wallets/abc` yields `walletId = NaN`. `NaN` is then passed into `eq(wallets.id, NaN)`; the comparison never matches, so the handler returns a 404 (`not_found`) instead of the contractual 422 validation error, and for list-style aggregations (`getById` history fan-out) NaN is silently threaded through multiple queries. The project's `api-routes.md` and `security.md` both require validating every path parameter at the route boundary and returning 422 on validation failure — this is unvalidated input reaching persistence. The `:walletId` GET handler validates the query string with Zod but not the path param.

**Fix:** Validate path params with a Zod coercion schema via `zValidator('param', ...)`, or guard explicitly:

```ts
const walletId = Number(c.req.param('walletId'));
if (!Number.isInteger(walletId) || walletId <= 0) {
  return c.json({ error: { code: 'validation_error', message: 'Invalid walletId' } }, 422);
}
```

Apply to every handler that reads `walletId`/`txId`.

### CR-03: Auto-expense history fan-out duplicates rows and re-queries unbounded under autoDeductAllExpenses

**File:** `apps/api/src/services/wallet-service.ts:821-860`
**Issue:** When `wallet.autoDeductAllExpenses` is true, `expenseCatIdsForHistory` is set to **every** expense category id for the user, then the code loops `for (const catId of expenseCatIdsForHistory)` issuing one query per category, each `.limit(fetchLimit)`. Two defects: (a) an expense whose category is not in the list cannot appear, but more importantly any expense is fetched via its own category query so the per-category `.limit(fetchLimit)` interacts with CR-01 to drop newest rows; (b) the loop pattern issues N queries (one per category) instead of a single `inArray` query, and combined with the missing `ORDER BY` the merged set is non-deterministic. Because the same wallet's `mappedExpensesCents` (line 729-731) is computed by summing **all** category totals while the history is built per-category with truncation, the breakdown total and the visible history can disagree — the user sees a balance that the listed transactions do not reconcile to. This is a financial-correctness defect, not just performance.

**Fix:** Replace the per-category loops with a single ownership-scoped query using `inArray(expenses.categoryId, expenseCatIdsForHistory)` (and likewise for income), add the `ORDER BY ... DESC LIMIT fetchLimit` from CR-01, and ensure the same category set drives both the breakdown sum and the history rows so they always reconcile.

## Warnings

### WR-01: N+1 conflict-check queries inside mapping setters

**File:** `apps/api/src/services/wallet-service.ts:284-301, 390-398`
**Issue:** `setIncomeCategoryMappings` and `setExpenseMappings` loop over `ids` issuing one `SELECT` per id to detect cross-wallet conflicts (`for (const id of ids) { await db.select()... }`). On the edge runtime each round-trip adds latency, and the unique index (`wicm_income_category_unique` / `wecm_expense_category_unique`) already guarantees one wallet per category — the manual check races against concurrent writers anyway. Correctness is salvaged by the DB constraint, but the loop is redundant work.
**Fix:** Use a single `inArray(...incomeCategoryId, ids)` query, or drop the manual check and translate the unique-constraint violation into the 409 error code in a catch.

### WR-02: `total` / `totalPages` computed from a truncated, merged set

**File:** `apps/api/src/services/wallet-service.ts:889-891`
**Issue:** `total = merged.length` is the size of the in-memory merge, which is itself capped by the per-source `.limit(fetchLimit)`. Once truncation kicks in (CR-01), `total` and `totalPages` understate the real count, so the UI pagination (`WalletDetail.tsx:586`) renders too few page buttons and later pages become unreachable.
**Fix:** Compute `total` from dedicated `COUNT(*)` queries per source (active income, active expense, all manual incl. soft-deleted) summed together, independent of the windowed fetch.

### WR-03: Dead `conflicts` query and `void conflicts` suppression in income mapping setter

**File:** `apps/api/src/services/wallet-service.ts:284-304`
**Issue:** A first conflict query selects rows for `ids[0]` into `conflicts`, which is never used — the real check is the per-id loop directly below. `void conflicts;` is added solely to silence the unused-variable lint. This is dead code that issues an extra DB round-trip and obscures intent.
**Fix:** Delete the `conflicts` query and the `void conflicts;` line.

### WR-04: `createWalletAction` redirect-in-try relies on catch-as-success control flow

**File:** `apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx:131-160`; `apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts:18-30`
**Issue:** `createWalletAction` calls `redirect('/wallets')` on success, which throws `NEXT_REDIRECT`. The client `handleSubmit` wraps the call in `try/catch` and, in the `catch`, unconditionally fires `toast.success('Wallet created.')` with the comment "redirect() throws — this is expected on success." Any genuine thrown error (network failure, server action transport error) is also swallowed into a false "success" toast. The error-vs-redirect distinction is not checked.
**Fix:** Do not depend on catch-as-success. Either return a typed result from the action and navigate client-side, or in the catch re-throw when the error is not a redirect (`if (isRedirectError(err)) throw err;`) before showing any toast.

### WR-05: BFF proxy forwards raw upstream error bodies and a guessed content-type

**File:** `apps/web/src/app/api/wallets/[...path]/route.ts:33-37`
**Issue:** The proxy streams `apiRes.body` straight back and sets `content-type` to the upstream value or defaults to `application/json`. The upstream 500 path (`index.ts:45`) returns a generic message, which is fine, but the proxy applies no allowlist on response headers and does not strip anything — if the Workers API ever attaches a header carrying internal detail it is relayed verbatim. Lower risk than the API itself, but the proxy is the trust boundary the browser sees.
**Fix:** Explicitly construct the response with only the headers you intend to expose (already done for content-type); confirm no `Set-Cookie`/`Server` style headers can be reflected, and consider validating that `content-type` is a known value rather than echoing upstream.

### WR-06: `mappedIncome` history vs balance use inconsistent income filters

**File:** `apps/api/src/services/wallet-service.ts:208-223 vs 92-104`
**Issue:** `getReceivedIncomeByCategoryCents` (used for `mappedIncomeCents` balance component and history) filters only `moneyStatus = 'RECEIVED'`, while `getTotalReceivedIncomeCents` (used for PF allocation) additionally filters `profitFirstAllocated = true`. For a BLANK wallet with an income-category mapping, an income row with `profitFirstAllocated = false` still credits the wallet balance and appears in history — this may be intended, but the asymmetry is undocumented and easy to regress. Confirm against the locked balance spec.
**Fix:** Add a comment justifying the deliberate filter difference, or align the filters if the spec requires PF-allocated-only income to credit mapped wallets.

### WR-07: `updateWalletTransactionSchema` allows empty `type` change but service ignores it, and allows `type` switch without re-running the guard

**File:** `apps/api/src/schemas/wallets.ts:45`; `apps/api/src/services/wallet-service.ts:987-1023`
**Issue:** `updateWalletTransactionSchema = walletTransactionSchema.partial()` permits a client to send `type: 'DEPOSIT' -> 'WITHDRAWAL'` on update, but `updateTransaction` only copies `amount`, `description`, `transactionDate` into `updateData` — a submitted `type` is silently dropped (no error, no effect). Either the field should be rejected (so callers know it is immutable) or honored with `assertCanInsertTransaction` re-run. Silently ignoring a submitted field is a contract bug.
**Fix:** Drop `type` from the update schema (immutable), or handle it and re-run the insertion guard before persisting.

### WR-08: Test DB shim diverges from production schema guarantees ($onUpdate, defaults)

**File:** `apps/api/tests/helpers/db.ts:13-173`
**Issue:** The hand-written `DDL` omits the `$onUpdateFn`/`$defaultFn` behaviors and column defaults expressed in Drizzle (`created_at`/`updated_at` are plain `TEXT` with no default). Tests that assert on timestamps would pass against the shim but behave differently against D1, and any schema drift between `schema.ts` and this DDL is silent. The comment acknowledges "keep in sync" but nothing enforces it.
**Fix:** Generate the test schema from the Drizzle schema (e.g. run migrations against the in-memory DB) instead of maintaining parallel DDL, or add a test that diffs the two.

## Info

### IN-01: Misleading "balance excludes soft-deleted" relies on `Math.round(input.amount)` of an already-cent value

**File:** `apps/api/src/services/wallet-service.ts:963, 1008`
**Issue:** `amountCents = Math.round(input.amount)` is applied even though the Zod schema already requires `amount` to be a positive number and the client (`WalletDetail.tsx:138`) sends integer cents via `toCents`. The rounding is harmless but signals uncertainty about whether the boundary receives pesos or cents. Document that `amount` is cents at this layer.

### IN-02: `withdrawalLabel` is exported but never used

**File:** `apps/web/src/lib/wallet-labels.ts:12-31`
**Issue:** `withdrawalLabel` is a fully built, documented export with no importer in the reviewed file set (only `sourceLabel` is consumed by `WalletCard`/`WalletDetail`). Dead export unless a later task wires it in.
**Fix:** Remove until needed, or wire it into the transaction-type labeling in `WalletDetail`.

### IN-03: Redundant/confusing blocking-state derivation with dead locals

**File:** `apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx:336-363`
**Issue:** `isDepositBlocked` and `hasIncomeMappings` are computed and then discarded via `void isDepositBlocked; void hasIncomeMappings;`. The real blocking flags are `depositBlocked`/`withdrawalBlocked`. The dead locals plus the long explanatory comment block make the heuristic harder to follow and are lint-suppression smell.
**Fix:** Delete the unused locals and keep only `depositBlocked`/`withdrawalBlocked` with a one-line comment.

### IN-04: `DeleteTxDialog` typeLabel uses fragile manual title-casing

**File:** `apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx:257-263`
**Issue:** `tx.type.charAt(0) + tx.type.slice(1).toLowerCase()` reimplements title-casing inline; `transactionTypeBadgeLabel` already maps types to labels. Two label sources can drift.
**Fix:** Reuse `transactionTypeBadgeLabel(tx.type)` (lowercased where needed) for a single source of truth.

### IN-05: Magic basis-point divisor `10000` repeated without a named constant

**File:** `apps/api/src/services/wallet-service.ts:466, 713`
**Issue:** `(totalReceived * pfAccount.targetPercentage) / 10000` hardcodes the basis-point scale in two places. A named constant (`BASIS_POINTS_DIVISOR = 10_000`) documents intent and prevents one site drifting from the other.
**Fix:** Extract a module constant and use it in both `list()` and `getById()`.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
