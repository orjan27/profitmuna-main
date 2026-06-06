---
phase: 04-wallets
verified: 2026-06-06T21:42:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: 'User can open a wallet detail view with a paginated transaction history'
    status: failed
    reason: >
      The paginated transaction history in getById() fetches each auto-source (income, expense, manual)
      with .limit(fetchLimit) but WITHOUT ORDER BY. SQLite/D1 return rows in unspecified order absent
      ORDER BY, so .limit() truncates an arbitrary subset — not the most-recent rows. Once any single
      source exceeds (page+1)*size rows, the merged history omits the genuinely newest entries and the
      page content is wrong. Additionally `total = merged.length` is computed from the already-truncated
      merged set, so totalPages is understated and later pages become unreachable via the UI pagination.
      Under autoDeductAllExpenses the per-category loop (one query per expense category) multiplies this
      problem: each category contributes up to fetchLimit unordered rows, producing duplicate-inflated
      or missing history. Code review finding CR-01 + CR-03 in 04-REVIEW.md.
    artifacts:
      - path: 'apps/api/src/services/wallet-service.ts'
        issue: >
          Lines 779-807 (income loop), 830-858 (expense loop), 862-869 (manual query):
          none of the three per-source queries have .orderBy(). Line 889: `total = merged.length`
          is computed from the truncated/unordered merge — not from a COUNT query per source.
          Lines 821-858: autoDeductAllExpenses fans out to one query per expense category instead
          of a single inArray query, each with independent .limit(fetchLimit) and no ORDER BY.
    missing:
      - 'Add .orderBy(desc(incomes.incomeDate), desc(incomes.id)).limit(fetchLimit) on the income source query'
      - 'Add .orderBy(desc(expenses.expenseDate), desc(expenses.id)).limit(fetchLimit) on the expense source query'
      - 'Add .orderBy(desc(walletTransactions.transactionDate), desc(walletTransactions.id)).limit(fetchLimit) on the manual source query'
      - 'Replace per-category expense query loop with a single .where(inArray(expenses.categoryId, expenseCatIdsForHistory)) query under autoDeductAllExpenses'
      - 'Compute total from dedicated COUNT(*) queries per source summed, not from merged.length'
human_verification:
  - test: 'Create a PROFIT_FIRST wallet linked to an existing allocation account'
    expected: 'Wallet appears in the list with a computed balance; creating a second wallet for the same account is rejected with a 409 error message'
    why_human: 'Requires running dev servers and a seeded user with allocation accounts'
  - test: 'Create a BLANK wallet, map income and expense categories, then view the wallet list'
    expected: 'Wallet card shows the computed balance using the formula (pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals); negative balance is shown in red'
    why_human: 'Requires running dev servers and real income/expense data to confirm balance formula renders correctly in UI'
  - test: "On a wallet with a single auto-deduct expense mapping, click 'Add Withdrawal' button"
    expected: "Button is disabled with tooltip 'This wallet auto-deducts matching expenses. Manual withdrawals would double-count — record an expense instead.'"
    why_human: 'WalletDetail.tsx uses a heuristic proxy (mappedExpensesCents > 0) not the actual mapping list. The button may incorrectly remain enabled if a wallet has expense mappings but zero expense amounts so far.'
  - test: 'Add a deposit to a BLANK wallet, then soft-delete it and use the Restore button in the history list'
    expected: 'Deleted row appears greyed/strikethrough with Restore button; clicking Restore removes the greying and the balance updates'
    why_human: 'Requires running dev servers to confirm real UI render and balance recomputation after restore'
  - test: 'Navigate to a wallet detail page and scroll through multiple pages of transactions'
    expected: 'Each page shows the correct chronologically ordered transactions; page count matches actual transaction count'
    why_human: 'Cannot verify pagination correctness without real data volume exceeding page size; CR-01 (missing ORDER BY) makes this explicitly UNCERTAIN for > 20 rows per source'
---

# Phase 4: Wallets Verification Report

**Phase Goal:** Users can create wallets linked to allocation accounts or standalone, map income and expense categories to wallets, record manual transactions, and see computed balances
**Verified:** 2026-06-06T21:42:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                              | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | User can create a PROFIT_FIRST wallet linked 1:1 to an allocation account, or a BLANK standalone wallet                                            | VERIFIED | `wallets_user_pf_account_unique` unique index in schema.ts; `hasWalletForPfAccount` + 409 `wallet_pf_account_already_linked` in wallet-service.ts:518; `NewWalletForm.tsx` type selector with conditional PF account picker; 35/35 tests pass incl. PROFIT_FIRST + BLANK create and duplicate-PF 409                                                                                                                                                                                                                                                                                                                                                                    |
| 2   | User can map income and expense categories to a wallet (each category maps to at most one wallet) and toggle auto-deduct-all-expenses for a wallet | VERIFIED | `setIncomeCategoryMappings` (409 `income_category_already_mapped`) and `setExpenseMappings` (409 `expense_category_already_mapped`, 409 `auto_deduct_all_already_set`) in wallet-service.ts; `wicm_income_category_unique` + `wecm_expense_category_unique` DB indexes in schema.ts; 3-mode expense RadioGroup in NewWalletForm.tsx; D-08 income section hidden for PROFIT_FIRST at line 266                                                                                                                                                                                                                                                                            |
| 3   | User can view all wallets with computed balance breakdowns (PF allocation + mapped income − mapped expenses + deposits − withdrawals)              | VERIFIED | `computeBalanceCents` in wallet-service.ts:33-48 (no clamp, D-13); 7-way Promise.all list() at line 434; `WalletCard.tsx` renders `formatCurrency(wallet.balanceCents)` with `text-destructive` when < 0; wallets/page.tsx RSC fetches `/api/wallets` via apiFetch and renders card grid                                                                                                                                                                                                                                                                                                                                                                                |
| 4   | User can record manual DEPOSIT or WITHDRAWAL transactions, edit them, soft-delete them, and restore soft-deleted transactions                      | VERIFIED | `assertCanInsertTransaction` (module-level, lines 56-73) blocks DEPOSIT on PF/income-mapped and WITHDRAWAL on expense-auto wallets; `createTransaction/updateTransaction/removeTransaction/restoreTransaction` all implemented and ownership-scoped; `removeTransaction` sets `deletedAt` ISO; `restoreTransaction` sets `deletedAt: null` (line 1091); WalletDetail.tsx renders soft-deleted rows with `opacity-50 line-through` + Restore button; transaction server actions all present in wallet-actions.ts                                                                                                                                                         |
| 5   | User can open a wallet detail view with a paginated transaction history                                                                            | FAILED   | Detail page and WalletDetail component exist and are wired; nuqs `useQueryState('page')` drives `?page=` URL param; `getById` merges 3 sources. HOWEVER: per-source history queries have no `.orderBy()` clause (CR-01), so `.limit(fetchLimit)` truncates an arbitrary subset under SQLite/D1 once a source exceeds one page. `total = merged.length` (line 889) is derived from the truncated set so `totalPages` is understated. Under `autoDeductAllExpenses`, a per-category query loop (CR-03) issues N unordered queries, potentially duplicating or dropping entries. History content correctness is broken for any wallet with > 20 rows in any single source. |

**Score:** 4/5 truths verified

---

### Required Artifacts

| Artifact                                                                       | Expected                                                                           | Status              | Details                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/schema.ts`                                                    | 4 wallet tables with unique indexes                                                | VERIFIED            | `wallets`, `walletIncomeCategoryMappings`, `walletExpenseCategoryMappings`, `walletTransactions` all present; `wallets_user_pf_account_unique`, `wicm_income_category_unique`, `wecm_expense_category_unique` indexes confirmed |
| `packages/db/migrations/0003_natural_mauler.sql`                               | Additive migration with 4 CREATE TABLE statements                                  | VERIFIED            | File exists, `grep -c "CREATE TABLE"` returns 4                                                                                                                                                                                 |
| `apps/api/src/schemas/wallets.ts`                                              | Zod schemas: createWalletSchema, updateWalletSchema, walletTransactionSchema, etc. | VERIFIED            | All 6 named exports confirmed; `walletBaseSchema` extracted for Zod v4 .partial() compatibility                                                                                                                                 |
| `apps/api/src/services/wallet-service.ts`                                      | createWalletService factory with all methods                                       | VERIFIED            | list, create, update, remove, getById, createTransaction, updateTransaction, removeTransaction, restoreTransaction, assertCanInsertTransaction, hasWalletForPfAccount all present                                               |
| `apps/api/src/routes/wallets.ts`                                               | CRUD + transaction route handlers; restore before generic txId                     | VERIFIED            | GET /, POST /, PUT /:walletId, DELETE /:walletId, GET /:walletId, PATCH /:walletId/transactions/:txId/restore (line 93), POST/PUT/DELETE transaction sub-routes; restore registered before generic handlers                     |
| `apps/web/src/app/api/wallets/[...path]/route.ts`                              | BFF proxy with 5 HTTP verbs                                                        | VERIFIED            | GET, POST, PUT, DELETE, PATCH exported; Authorization Bearer forwarded; `await cookies()` used                                                                                                                                  |
| `apps/web/src/types/wallet.ts`                                                 | WalletListItem, WalletDetailResponse, WalletTransaction etc.                       | VERIFIED            | All required types present                                                                                                                                                                                                      |
| `apps/web/src/lib/wallet-labels.ts`                                            | withdrawalLabel + sourceLabel                                                      | VERIFIED            | Both functions exported; sourceLabel used in WalletCard and WalletDetail                                                                                                                                                        |
| `apps/web/src/app/(dashboard)/wallets/page.tsx`                                | SSR wallet list page with card grid + empty state                                  | VERIFIED            | async RSC, getSession guard, apiFetch, grid, empty state with quick-create links                                                                                                                                                |
| `apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx`       | Create form with type/color/category/3-mode expense                                | VERIFIED            | 'use client', type selector, 8 color swatches, income category cmdk picker hidden for PROFIT_FIRST, 3-mode RadioGroup                                                                                                           |
| `apps/web/src/app/(dashboard)/wallets/_actions/wallet-actions.ts`              | Server actions for wallets + transactions                                          | VERIFIED            | 'use server', createWalletAction, deleteWalletAction, createTransactionAction, updateTransactionAction, deleteTransactionAction, restoreTransactionAction all present                                                           |
| `apps/web/src/app/(dashboard)/wallets/[walletId]/page.tsx`                     | SSR detail page with page param                                                    | VERIFIED            | async RSC, awaits both params and searchParams, getSession guard, apiFetch with ?page= and size=20                                                                                                                              |
| `apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx` | Detail component with collapsible breakdown + paginated history                    | VERIFIED (with gap) | 'use client', Collapsible breakdown, zero-row hiding, soft-delete inline rendering, Restore button, nuqs pagination; but history sort correctness blocked by CR-01                                                              |
| `apps/api/tests/wallets.test.ts`                                               | 35 tests passing, all WAL-01..05 real                                              | VERIFIED            | `cd apps/api && npx vitest run tests/wallets.test.ts` → 35 passed, 0 todo                                                                                                                                                       |

---

### Key Link Verification

| From                                              | To                              | Via                                                      | Status                                             | Details                                                                                |
| ------------------------------------------------- | ------------------------------- | -------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/api/src/index.ts`                           | `walletsRouter`                 | `app.route('/api/wallets', walletsRouter)`               | WIRED                                              | Line 76 confirms mount; requireAuth applied inside walletsRouter at line 19            |
| `apps/web/src/app/api/wallets/[...path]/route.ts` | Workers API `/api/wallets`      | fetch with Authorization Bearer from access_token cookie | WIRED                                              | `await cookies()` + Bearer forwarding confirmed                                        |
| `wallet-service.ts list()`                        | balance computation             | 7-way Promise.all aggregation                            | WIRED                                              | `Promise.all` at line 434; computeBalanceCents at line 33                              |
| `wallet-service.ts setIncomeCategoryMappings`     | `walletIncomeCategoryMappings`  | db.batch atomic clear-and-replace                        | WIRED                                              | `(db as any).batch([deleteStmt, insertStmt])` at lines 318-319                         |
| `NewWalletForm.tsx`                               | `/api/wallets`                  | Server Action createWalletAction                         | WIRED                                              | `createWalletAction` imported and called at line 132                                   |
| `wallets/page.tsx`                                | `/api/wallets`                  | apiFetch GET (server component)                          | WIRED                                              | `apiFetch<WalletListResponse>('/api/wallets')` at line 26                              |
| `WalletDetail.tsx createTransactionAction`        | `/api/wallets/:id/transactions` | fetch through wallet-actions server action               | WIRED                                              | createTransactionAction → apiFetch POST `/api/wallets/${walletId}/transactions`        |
| `wallet-service.ts createTransaction`             | `assertCanInsertTransaction`    | pre-insert blocking guard                                | WIRED                                              | Line 958: `assertCanInsertTransaction(input.type, wallet, {...})` called before insert |
| `wallet-service.ts getById`                       | merge-3-sources history         | sort+slice                                               | PARTIAL — missing ORDER BY on all 3 source queries | Lines 883-891: sort+slice present; lines 779-869: per-source queries lack `.orderBy()` |

---

### Data-Flow Trace (Level 4)

| Artifact           | Data Variable            | Source                                        | Produces Real Data                                                                          | Status            |
| ------------------ | ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------- |
| `wallets/page.tsx` | `wallets`                | apiFetch `/api/wallets` → list() → DB queries | Yes                                                                                         | FLOWING           |
| `WalletCard.tsx`   | `wallet.balanceCents`    | Passed from list() via page.tsx               | Yes — computeBalanceCents uses real DB aggregates                                           | FLOWING           |
| `WalletDetail.tsx` | `transactions` (history) | getById() merge-3-sources                     | Partially — data fetched from DB, but ORDER BY missing means page content non-deterministic | STATIC (ordering) |
| `WalletDetail.tsx` | `pagination.totalPages`  | getById() `total = merged.length`             | No — total is from truncated in-memory merge, not COUNT queries                             | HOLLOW            |
| `WalletDetail.tsx` | `breakdown`              | getById() separate balance queries            | Yes — deposits/withdrawals exclude deletedAt; breakdown components query DB correctly       | FLOWING           |

---

### Behavioral Spot-Checks

| Behavior                                     | Command                                                                        | Result                                                        | Status |
| -------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------ |
| 35 wallet tests pass                         | `cd apps/api && npx vitest run tests/wallets.test.ts`                          | 35 passed, 0 todo                                             | PASS   |
| walletsRouter mounted in API                 | `grep -n "app.route.*wallets" apps/api/src/index.ts`                           | line 76 confirms mount                                        | PASS   |
| CORS includes PATCH                          | `grep -n "allowMethods" apps/api/src/index.ts`                                 | `['GET', 'POST', 'PUT', 'DELETE', 'PATCH']`                   | PASS   |
| Restore route registered before generic txId | `grep -n "restore" apps/api/src/routes/wallets.ts`                             | line 93 (before line 121 generic PUT)                         | PASS   |
| History ORDER BY absent                      | `grep -n "orderBy" apps/api/src/services/wallet-service.ts`                    | Only line 439 (wallet list sortOrder) — zero on history fetch | FAIL   |
| Path params unvalidated                      | `grep -n "Number.isInteger\|zValidator.*param" apps/api/src/routes/wallets.ts` | No NaN guard found                                            | FAIL   |

---

### Requirements Coverage

| Requirement | Source Plan  | Description                                              | Status    | Evidence                                                                                                                                                                                                                  |
| ----------- | ------------ | -------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WAL-01      | 04-01, 04-02 | User can create PROFIT_FIRST or BLANK wallet             | SATISFIED | create() with PF uniqueness guard; NewWalletForm type selector; 35 tests pass                                                                                                                                             |
| WAL-02      | 04-01, 04-02 | User can map categories + toggle auto-deduct-all         | SATISFIED | setIncomeCategoryMappings, setExpenseMappings with conflict 409s; 3-mode RadioGroup in form                                                                                                                               |
| WAL-03      | 04-01, 04-02 | View all wallets with computed balance breakdowns        | SATISFIED | list() 7-way Promise.all; computeBalanceCents (locked formula); card grid with text-destructive for negative                                                                                                              |
| WAL-04      | 04-03        | Manual DEPOSIT/WITHDRAWAL + edit + soft-delete + restore | SATISFIED | createTransaction/updateTransaction/removeTransaction/restoreTransaction; assertCanInsertTransaction; 35 tests including blocking guard assertions                                                                        |
| WAL-05      | 04-03        | Wallet detail with paginated transaction history         | BLOCKED   | getById + detail page exist but CR-01 (missing ORDER BY) makes paginated history non-deterministic; CR-03 (per-category loop under autoDeductAllExpenses) compounds issue; total/totalPages computed from truncated merge |

---

### Anti-Patterns Found

| File                                                                           | Line                          | Pattern                                                                                         | Severity | Impact                                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/services/wallet-service.ts`                                      | 779-869                       | Per-source history queries missing `.orderBy()` (CR-01)                                         | BLOCKER  | History page content is non-deterministic for wallets with > 20 rows in any single source; WAL-05 correctness                                   |
| `apps/api/src/services/wallet-service.ts`                                      | 821-858                       | Per-category query loop under autoDeductAllExpenses instead of single inArray query (CR-03)     | BLOCKER  | N queries per category; combined with CR-01, can drop or duplicate entries; financial correctness defect                                        |
| `apps/api/src/services/wallet-service.ts`                                      | 889                           | `total = merged.length` derived from truncated merge (WR-02)                                    | WARNING  | totalPages understated when truncation occurs; pages unreachable in UI pagination                                                               |
| `apps/api/src/routes/wallets.ts`                                               | 55, 66, 82, 94, 111, 129, 141 | `Number(c.req.param(...))` with no NaN guard (CR-02)                                            | WARNING  | Non-integer path params coerce to NaN, reach DB queries; returns wrong HTTP code (404 not 422); violates `api-routes.md` validation requirement |
| `apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx`       | 155-158                       | Catch block unconditionally fires success toast — swallows real errors as false success (WR-04) | WARNING  | Network failures during wallet creation are silently shown as "Wallet created." toast                                                           |
| `apps/api/src/services/wallet-service.ts`                                      | 284-303                       | Dead `conflicts` query + `void conflicts;` suppression (WR-03)                                  | INFO     | Extra DB round-trip; dead code obscures intent                                                                                                  |
| `apps/web/src/lib/wallet-labels.ts`                                            | all                           | `withdrawalLabel` exported but never imported (IN-02)                                           | INFO     | Dead export                                                                                                                                     |
| `apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx` | 337-342                       | Dead `isDepositBlocked`/`hasIncomeMappings` locals suppressed with `void` (IN-03)               | INFO     | Lint suppression smell                                                                                                                          |

---

### Human Verification Required

#### 1. Create PROFIT_FIRST wallet linked to allocation account

**Test:** Run dev servers, create a PROFIT_FIRST wallet linked to an allocation account, then attempt to create a second wallet for the same account
**Expected:** First wallet appears in list with computed balance; second attempt shows error "This allocation account already has a wallet. Choose a different account."
**Why human:** Requires running dev servers with a seeded user + allocation accounts

#### 2. Verify balance formula renders correctly in UI

**Test:** Create a BLANK wallet, map income and expense categories, record manual deposits/withdrawals; observe wallet card balance
**Expected:** Balance card shows pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals; negative balance shown in red
**Why human:** Requires real data volume across income/expense/transaction tables to confirm all formula components render

#### 3. Verify withdrawal-blocked state when expense mapping exists but no amounts recorded yet

**Test:** Create a wallet with an expense category mapping but zero expenses recorded; open wallet detail and try "Add Withdrawal"
**Expected:** Button should be disabled (wallet has expense mapping); but WalletDetail.tsx uses `mappedExpensesCents > 0` as proxy — if no expenses yet, breakdown.mappedExpensesCents = 0 and button will NOT be disabled even though server would block the actual request
**Why human:** Conservative proxy in WalletDetail.tsx (03-SUMMARY known stub) may incorrectly enable the button; server enforces correctly but UI hint is wrong in the zero-amount case

#### 4. Verify soft-delete + restore end-to-end UI

**Test:** Add a manual deposit, soft-delete it, confirm the row is greyed/strikethrough with Restore button, click Restore
**Expected:** Row greys on delete; Restore button appears; clicking Restore removes greying and balance recalculates
**Why human:** Requires running dev servers to confirm visual render and balance refresh via router.refresh()

#### 5. Pagination correctness under high transaction volume (CR-01 human confirmation)

**Test:** Create a wallet and insert more than 20 income transactions in the same category; open wallet detail and navigate to page 2
**Expected:** Page 2 should show the next 20 most-recent transactions in date DESC order
**Why human:** CR-01 defect means this is expected to FAIL — pagination shows wrong transactions once source exceeds 20 rows; this test is needed to confirm the blocker is real and measure scope before gap-closure planning

---

### Gaps Summary

**One critical gap blocks SC-5 (paginated transaction history) from being correct under real data volumes.**

The `getById()` method in `wallet-service.ts` fetches three sources (auto-income, auto-expense, manual transactions) without `ORDER BY` on any of the per-source queries. The `.limit(fetchLimit)` constraint is supposed to fetch only the most-recent `(page+1)*size` rows from each source, then merge-sort them. Without `ORDER BY`, SQLite/D1 returns rows in physical storage order — the `.limit()` captures an arbitrary subset. Once any source has more rows than `fetchLimit`, the merge omits genuinely newer entries and the displayed page is wrong.

Compounding this: `total = merged.length` is derived from the in-memory merge (which is itself limited), so `totalPages` understates the real count. Once truncation occurs, the UI shows too few page buttons and later pages become unreachable.

Under `autoDeductAllExpenses`, a per-category query loop issues one query per expense category (each with its own `.limit(fetchLimit)` and no `ORDER BY`), multiplying the problem.

The code review (04-REVIEW.md) identifies this as CR-01 (critical) and CR-03 (critical). The test suite passes because the WAL-05 merge test seeds fewer than 20 rows per source — the tests are designed to fit within page 0 of the paginated result, so the ORDER BY absence does not manifest.

The four success criteria beyond SC-5 (wallet creation, category mapping, balance computation on the list page, manual transaction management) are VERIFIED — the balance formula itself and the list view are correct. Only the detail page history pagination is broken for production data volumes.

**Fix scope for gap-closure plan:** Add `orderBy` clauses to all three per-source history queries; replace the per-category expense loop with a single `inArray` query; compute `total` from `COUNT(*)` queries per source.

---

_Verified: 2026-06-06T21:42:00Z_
_Verifier: Claude (gsd-verifier)_
