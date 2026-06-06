---
phase: 03-profit-first-allocation
verified: 2026-06-06T21:00:00Z
status: human_needed
score: 4/4
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - 'PUT /api/profit-first/percentages rejects (400) unless submitted basis-point set covers exactly the user-owned accounts AND totals 10000'
    - 'User can open the income-category filter from the Profit First page and select one or more categories'
  gaps_remaining: []
  regressions: []
deferred:
  - truth: 'An account linked to a wallet cannot be deleted (PF-03 / ROADMAP SC 3 partial clause)'
    addressed_in: 'Phase 4'
    evidence: "Guard stubbed as commented block in deleteAccount (lines 360-370) with explicit 'Uncomment in Phase 4' note; wallets table does not exist in Phase 3; planner documented deferral in 03-02-PLAN.md and 03-02-SUMMARY.md."
human_verification:
  - test: 'Log in; navigate to /profit-first; verify seeded accounts appear as cards with correct names, target percentages, and color accents.'
    expected: 'Four cards (Profit 5%, Owner Pay 50%, Tax 15%, Operating Expenses 30%) with green/purple/amber/red left borders respectively.'
    why_human: 'Visual layout, color rendering, and card composition cannot be verified programmatically.'
  - test: 'Toggle the Eye icon to show amounts; reload the page; verify amounts are still visible.'
    expected: "localStorage key 'pf-amounts-visible' persists the state across reloads; SSR renders masked (no hydration flash)."
    why_human: 'localStorage behavior and hydration mismatch detection require a real browser.'
  - test: "Click 'This Month' preset; verify the URL updates with from/to params and the summary data refreshes."
    expected: "URL changes to ?from=YYYY-MM-DD&to=YYYY-MM-DD; account balances re-render without full page reload; 'This Month' button shows active variant."
    why_human: 'URL state updates and RSC re-render behavior require a browser.'
  - test: "Open 'Edit Percentages'; change one account to an invalid total (e.g. set all to 25 then change one to 26 — total 101%); verify Save is disabled."
    expected: "Total line shows red 'Total: 101% — must equal 100% to save'; Save button is disabled/non-interactive."
    why_human: 'Live input interaction and button disabled state require a browser.'
  - test: 'Create a new custom account (any name, 0%, any preset color); edit it; delete it via confirmation dialog.'
    expected: 'Account appears in the grid after create; updates after edit; disappears after delete. Success toasts appear for each operation.'
    why_human: 'Full CRUD flow with dialogs, toasts, and router.refresh() invalidation requires a browser.'
  - test: "Click the three-dot menu on the 'Profit' account (accountType: PROFIT); hover over the Delete item."
    expected: "Delete item is disabled with tooltip 'Default accounts cannot be deleted.'"
    why_human: 'Disabled state and tooltip rendering require a browser.'
  - test: 'Record a RECEIVED+allocated income with a known category; navigate to /profit-first; verify the Income categories filter button is interactive and the category appears in the Sheet.'
    expected: 'A Sheet opens listing the category name as a selectable checkbox. Checking it updates the URL categoryIds param and the summary re-fetches scoped to that category.'
    why_human: 'Category Sheet visibility, checkbox interaction, and URL param update require a browser.'
  - test: 'Navigate to /profit-first with a fresh account that has no income; verify the Income categories filter shows the empty-state.'
    expected: "A disabled outline 'Income categories' button is visible alongside 'No income categories yet' helper text. The Sheet does not open."
    why_human: 'Empty-state visibility and disabled-button behavior require a browser.'
---

# Phase 3: Profit First Allocation Verification Report

**Phase Goal:** Users can configure Profit First allocation accounts with percentage targets and view derived balance summaries across their received income
**Verified:** 2026-06-06T21:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 03-05 and 03-06; commits dc1b5a2 / ce8dc62 / 72bd68c / 75d7e2a)

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                        | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | New users get 4 default accounts seeded (Profit 5%, Owner Pay 50%, Tax 15%, OPEX 30%)        | VERIFIED | `seedProfitFirstAccounts` in profit-first-service.ts; wired into `register()` and `upsertGoogleUser()` branch 3; migration backfill confirmed; PF-01 tests (3) green                                                                                                                                                                                                                    |
| 2   | User can update allocation percentages with sum-to-100% validation (server-enforced)         | VERIFIED | `updatePercentages` fetches owned account IDs server-side (line 424-428), builds Set, rejects (400 "Submit all accounts exactly once.") on any mismatch BEFORE any write (line 435-443), then validates sum === 10000. Regression test confirms partial bypass → 400                                                                                                                    |
| 3   | User can create/edit/delete custom accounts; defaults not deletable                          | VERIFIED | `deleteAccount` guards `accountType !== 'CUSTOM'` (line 356); wallet-link guard deferred to Phase 4 (commented stub, explicitly documented); service tests confirm default protection                                                                                                                                                                                                   |
| 4   | User can view allocation summary with derived balances filterable by date range and category | VERIFIED | Date-range filtering: verified (TZDate Manila presets, nuqs URL state, API honors from/to). Category filtering: `getSummary` returns distinct categories via `getIncomeCategories` selectDistinct; `page.tsx` maps to `CategoryOption[]` and passes to `<PfFilters categoryOptions={categoryOptions} />`; Sheet renders with real labels; explicit empty-state when no categories exist |

**Score:** 4/4 truths verified

---

### Re-verification: Gap Closure Evidence

#### Gap 1 (Closed) — Category filter dead UI wire (plan 03-06, commits 72bd68c / 75d7e2a)

**Prior status:** FAILED — `page.tsx` rendered `<PfFilters />` with no props; `categoryOptions` defaulted to `[]`; category Sheet was permanently hidden.

**Fix verified:**

1. `apps/api/src/services/profit-first-service.ts` — `ProfitFirstSummary` type extended with `categories: Array<{ id: number; name: string }>` (line 97). Private `getIncomeCategories(userId)` helper uses `db.selectDistinct({ id: incomes.categoryId, name: incomes.categoryName })` scoped to `userId + RECEIVED + profitFirstAllocated`, ordered by `incomes.categoryName` (lines 191-205). `getSummary` runs it in the existing `Promise.all` (line 241). The option list intentionally ignores active date/category filters so options remain complete while a filter is applied.

2. `apps/web/src/app/(dashboard)/profit-first/page.tsx` — `SummaryResponse.data` extended with `categories: Array<{ id: number; name: string }>` (line 23). `let categoryOptions: CategoryOption[] = []` initialized (line 67); in the `res.ok` branch maps `json.data.categories.map((c) => ({ id: String(c.id), label: c.name }))` (line 83). Renders `<PfFilters categoryOptions={categoryOptions} />` (line 100). String ids match nuqs `parseAsArrayOf(parseAsString)` contract.

3. `apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx` — Ternary replaces the `&&` gate: when `categoryOptions.length > 0`, renders the Sheet with Checkbox items (lines 149-187); when empty, renders a disabled outline Button + `<span className="text-xs text-muted-foreground">No income categories yet</span>` (lines 188-197).

4. New test in PF-04 describe block (`'returns distinct income categories present in user income'`) seeds two categories, asserts `summary.categories` has length 2 and correct names/ids (lines 538-607 in tests/profit-first.test.ts). Test suite: 13 → 14 passing.

#### Gap 2 (Closed) — updatePercentages subset bypass (plan 03-05, commits dc1b5a2 / ce8dc62)

**Prior status:** PARTIAL — sum validated only against submitted subset; partial submission with a single 10000 bp account passed validation.

**Fix verified:**

`updatePercentages` in `apps/api/src/services/profit-first-service.ts` (lines 422-471) now enforces exact coverage:

- Step 1: Fetches all `profitFirstAccounts.id` owned by `userId` → `Set<number>` (lines 424-428)
- Step 2: Builds `submittedIds` from `input.accounts.map(a => a.id)` (line 431)
- Step 3: Rejects with HTTPException 400 `'Submit all accounts exactly once.'` if: `submittedIds.size !== input.accounts.length` (duplicates), `ownedIds.size !== submittedIds.size` (count mismatch), or any submitted id is not in `ownedIds` (foreign id). No DB writes on rejection. (lines 435-443)
- Step 4: Existing sum validation and parallel updates unchanged.

Stale comment "The caller is responsible for submitting ALL accounts" confirmed removed (grep returns 0 matches).

Regression test `'rejects a partial-set submission (single account) with 400'` (line 312-353 in tests/profit-first.test.ts): submits `[{ id: profitId, targetPercentage: 10000 }]` for a user with 4 accounts, asserts `rejects.toThrow('Submit all accounts exactly once.')`, re-selects accounts and asserts OWNERS_PAY still has seeded value 5000 bp (no partial write). Test suite: 12 → 13 passing (then 14 after plan 06 test).

---

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| #   | Item                                                   | Addressed In | Evidence                                                                                                                                                                                       |
| --- | ------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Wallet-linked account cannot be deleted (PF-03 clause) | Phase 4      | Guard stubbed as commented block in `deleteAccount` with explicit "Uncomment in Phase 4" note; `wallets` table does not exist in Phase 3; planner documented deferral in 03-02-PLAN.md/SUMMARY |

---

### Required Artifacts

| Artifact                                                                         | Expected                                                                | Status   | Details                                                                                                                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/schema.ts`                                                      | profitFirstAccounts + incomes tables                                    | VERIFIED | Both tables present with correct columns, FKs, and enums                                                                              |
| `apps/api/src/services/profit-first-service.ts`                                  | Full service with hardened updatePercentages + categories in getSummary | VERIFIED | Coverage enforcement at lines 422-471; getIncomeCategories at lines 191-205; getSummary returns categories in Promise.all at line 241 |
| `apps/api/tests/profit-first.test.ts`                                            | 14 tests covering PF-01–04 + partial-set + categories                   | VERIFIED | 14 tests pass; partial-set 400 regression at line 312; categories test at line 538                                                    |
| `apps/api/src/routes/profit-first.ts`                                            | Thin Hono router behind requireAuth                                     | VERIFIED | No structural change required; getSummary returns categories through existing `{ data: result }` envelope                             |
| `apps/api/src/index.ts`                                                          | Route registration                                                      | VERIFIED | `app.route('/api/profit-first', profitFirstRouter)` present                                                                           |
| `apps/web/src/app/api/profit-first/[...path]/route.ts`                           | BFF proxy exporting GET/POST/PATCH/DELETE/PUT                           | VERIFIED | All 5 methods exported; Bearer forwarded from access_token cookie                                                                     |
| `apps/web/src/app/(dashboard)/profit-first/page.tsx`                             | RSC with categoryOptions derived and passed                             | VERIFIED | `categoryOptions` mapped from `json.data.categories` at line 83; `<PfFilters categoryOptions={categoryOptions} />` at line 100        |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx`           | Sheet (populated) or explicit empty-state                               | VERIFIED | Ternary on `categoryOptions.length > 0` at line 149; empty-state at lines 191-197 with disabled button + "No income categories yet"   |
| `apps/web/src/server/profit-first-actions.ts`                                    | Server actions with percent→bp conversion                               | VERIFIED | Unchanged from initial verification; 'use server'; Math.round(pct \* 100) present                                                     |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-percentage-editor.tsx` | Bulk editor with live 100% gate                                         | VERIFIED | Unchanged from initial verification; total === 100 gate; router.refresh() on success                                                  |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-account-form.tsx`      | Create/edit dialog with preset color swatches                           | VERIFIED | Unchanged from initial verification; PF_DEFAULT_COLORS swatches; error messages surfaced                                              |

---

### Key Link Verification

| From                               | To                                   | Via                                                                    | Status | Details                                                                                     |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| auth-service.ts register()         | seedProfitFirstAccounts              | direct call after user insert                                          | WIRED  | Confirmed at line 153                                                                       |
| auth-service.ts upsertGoogleUser() | seedProfitFirstAccounts              | direct call after insert (branch 3)                                    | WIRED  | Branch 3 only; branches 1/2 return early                                                    |
| apps/api/src/index.ts              | profitFirstRouter                    | `app.route('/api/profit-first', profitFirstRouter)`                    | WIRED  | Route registered                                                                            |
| profit-first.ts routes             | createProfitFirstService             | createDb(c.env.DB) per request inside each handler                     | WIRED  | No module-scope DB                                                                          |
| page.tsx RSC                       | /api/profit-first/summary            | direct fetch with Bearer to API_BASE_URL, cache: 'no-store'            | WIRED  | Lines 70-84                                                                                 |
| getSummary                         | getIncomeCategories                  | Promise.all at line 241                                                | WIRED  | Runs in parallel with income sum and accounts queries                                       |
| page.tsx                           | PfFilters categoryOptions prop       | `json.data.categories.map(c => ({ id: String(c.id), label: c.name }))` | WIRED  | Line 83 in res.ok branch; prop passed at line 100                                           |
| pf-filters.tsx                     | URL categoryIds param                | nuqs useQueryState + toggleCategory handler                            | WIRED  | Sheet checkboxes call toggleCategory which updates the nuqs state and triggers RSC re-fetch |
| updatePercentages                  | profitFirstAccounts (user-owned IDs) | db.select scoped to userId at lines 424-428                            | WIRED  | Owned IDs fetched before sum validation or any writes                                       |
| pf-percentage-editor.tsx           | updatePercentagesAction              | server action call                                                     | WIRED  | Unchanged from initial verification                                                         |

---

### Data-Flow Trace (Level 4)

| Artifact                 | Data Variable         | Source                                                                                        | Produces Real Data                                                      | Status  |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| pf-overview.tsx          | accounts, totalIncome | RSC page.tsx → API GET /summary → DB SUM(incomes) + SELECT profitFirstAccounts                | Yes — Drizzle queries with COALESCE SUM and SELECT                      | FLOWING |
| pf-filters.tsx           | categoryOptions       | RSC page.tsx → API GET /summary → DB selectDistinct(incomes.categoryId, incomes.categoryName) | Yes — selectDistinct scoped to userId + RECEIVED + profitFirstAllocated | FLOWING |
| pf-percentage-editor.tsx | rows                  | accounts prop from RSC (server-fetched)                                                       | Yes — same as pf-overview above                                         | FLOWING |

---

### Behavioral Spot-Checks

| Behavior                              | Command                                                                                                       | Result                                                                     | Status |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ |
| API test suite: all 14 PF tests green | `cd apps/api && npx vitest run tests/profit-first.test.ts`                                                    | 14 tests passed (was 12 before gap closure: +1 partial-set, +1 categories) | PASS   |
| Full API test suite                   | `cd apps/api && npx vitest run`                                                                               | 139 tests passed (7 files), 28 todo, 1 skipped — no regressions            | PASS   |
| API TypeScript compile                | `cd apps/api && npx tsc --noEmit`                                                                             | Exit 0, no output                                                          | PASS   |
| Web TypeScript compile                | `cd apps/web && npx tsc --noEmit`                                                                             | Exit 0, no output                                                          | PASS   |
| Partial-set rejection asserted        | `grep -n "rejects a partial-set submission" apps/api/tests/profit-first.test.ts`                              | Line 312 — test present with no-write assertion                            | PASS   |
| Stale client-trust comment removed    | `grep -n "caller is responsible for submitting ALL accounts" apps/api/src/services/profit-first-service.ts`   | 0 matches                                                                  | PASS   |
| Coverage check message present        | `grep -n "Submit all accounts exactly once" apps/api/src/services/profit-first-service.ts`                    | 1 match at line 441                                                        | PASS   |
| categoryOptions prop wired            | `grep -n "PfFilters categoryOptions=" apps/web/src/app/\\(dashboard\\)/profit-first/page.tsx`                 | 1 match at line 100                                                        | PASS   |
| Empty-state text present              | `grep -n "No income categories yet" apps/web/src/app/\\(dashboard\\)/profit-first/_components/pf-filters.tsx` | 1 match at line 196                                                        | PASS   |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files found. Phase does not declare probes.

---

### Requirements Coverage

| Requirement | Source Plan                                 | Description                                                                                             | Status                       | Evidence                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PF-01       | 03-01-PLAN.md                               | New users get 4 default allocation accounts seeded                                                      | SATISFIED                    | seedProfitFirstAccounts in auth-service; migration backfill; PF-01 tests green                                                                                                                                                       |
| PF-02       | 03-02-PLAN.md, 03-04-PLAN.md, 03-05-PLAN.md | User can update allocation percentages, validated to sum to exactly 100%                                | SATISFIED                    | Server-enforced full-set coverage in updatePercentages (03-05); sum validated against owned account set, not submitted subset; partial submission → 400 before any writes; regression test pins invariant; UI enforces full-set too  |
| PF-03       | 03-02-PLAN.md, 03-04-PLAN.md                | User can create, edit, and delete custom accounts (defaults not deletable; wallet-linked not deletable) | SATISFIED (partial deferral) | Create/edit/delete custom accounts: SATISFIED. Default protection: SATISFIED. Wallet-link guard: DEFERRED to Phase 4 per documented plan deferral.                                                                                   |
| PF-04       | 03-02-PLAN.md, 03-03-PLAN.md, 03-06-PLAN.md | User can view allocation summary with balances, filterable by date range and category                   | SATISFIED                    | Balance computation: SATISFIED. Date-range filter: SATISFIED. Category filter: SATISFIED (03-06) — getSummary returns distinct categories; page.tsx passes to PfFilters; Sheet renders with real labels; empty-state when none exist |

---

### Anti-Patterns Found

| File                                                 | Line    | Pattern                                                                                                      | Severity | Impact                                                                                                                                     |
| ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| apps/api/src/services/profit-first-service.ts        | 268-276 | `err.message.includes('UNIQUE')` — substring match on driver error message (WR-03)                           | Warning  | May fall through to 500 in production if D1 error message differs from better-sqlite3                                                      |
| apps/web/src/app/(dashboard)/profit-first/page.tsx   | 85-87   | Empty catch block — network errors silently produce empty state (WR-06)                                      | Warning  | Users with expired tokens or transient errors see "No allocation accounts yet" instead of a meaningful error state; no server-side logging |
| apps/web/src/app/api/profit-first/[...path]/route.ts | 34-37   | BFF proxy only forwards content-type header, dropping Retry-After and security headers from upstream (WR-07) | Warning  | Security headers and throttling contract partially defeated on client-side fetch path                                                      |

Prior blocker (line 385 stale client-trust comment in profit-first-service.ts) is REMOVED — confirmed by grep returning 0 matches.

No unreferenced `TBD`, `FIXME`, or `XXX` markers found in phase-modified files — no debt-marker blockers.

---

### Human Verification Required

### 1. End-to-end allocation summary page

**Test:** Log in; navigate to /profit-first; verify seeded accounts appear as cards with correct names, target percentages, and color accents.
**Expected:** Four cards (Profit 5%, Owner Pay 50%, Tax 15%, Operating Expenses 30%) with green/purple/amber/red left borders respectively.
**Why human:** Visual layout, color rendering, and card composition cannot be verified programmatically.

### 2. Amount masking persistence

**Test:** Toggle the Eye icon to show amounts; reload the page; verify amounts are still visible.
**Expected:** localStorage key `pf-amounts-visible` persists the state across reloads; SSR renders masked (no hydration flash).
**Why human:** localStorage behavior and hydration mismatch detection require a real browser.

### 3. Date range filter re-fetch

**Test:** Click "This Month" preset; verify the URL updates with from/to params and the summary data refreshes.
**Expected:** URL changes to `?from=YYYY-MM-DD&to=YYYY-MM-DD`; account balances re-render without full page reload; "This Month" button shows active variant.
**Why human:** URL state updates and RSC re-render behavior require a browser.

### 4. Bulk percentage editor 100% gate

**Test:** Open "Edit Percentages"; change one account to an invalid total (e.g. set all to 25 then change one to 26 — total 101%); verify Save is disabled.
**Expected:** Total line shows red "Total: 101% — must equal 100% to save"; Save button is disabled/non-interactive.
**Why human:** Live input interaction and button disabled state require a browser.

### 5. Create/edit/delete custom account end-to-end

**Test:** Create a new custom account (any name, 0%, any preset color); edit it; delete it via confirmation dialog.
**Expected:** Account appears in the grid after create; updates after edit; disappears after delete. Success toasts appear for each operation.
**Why human:** Full CRUD flow with dialogs, toasts, and router.refresh() invalidation requires a browser.

### 6. Default account delete disabled in UI

**Test:** Click the three-dot menu on the "Profit" account (accountType: PROFIT); hover over the Delete item.
**Expected:** Delete item is disabled with tooltip "Default accounts cannot be deleted."
**Why human:** Disabled state and tooltip rendering require a browser.

### 7. Category filter with real data

**Test:** Record a RECEIVED+allocated income with a known category; navigate to /profit-first; verify the Income categories filter button is interactive and the category appears in the Sheet.
**Expected:** A Sheet opens listing the category name as a selectable checkbox. Checking it updates the URL `categoryIds` param and the summary re-fetches scoped to that category.
**Why human:** Category Sheet visibility, checkbox interaction, and URL param update require a browser.

### 8. Category filter empty-state

**Test:** Navigate to /profit-first with a fresh account that has no income; verify the Income categories filter shows the empty-state.
**Expected:** A disabled outline "Income categories" button is visible alongside "No income categories yet" helper text. The Sheet does not open.
**Why human:** Empty-state visibility and disabled-button behavior require a browser.

---

### Gaps Summary

No gaps remain. Both prior blockers are closed:

- **Gap 1 (Category filter dead):** Closed in plan 03-06 (commits 72bd68c / 75d7e2a). `getSummary` now returns distinct income categories via `selectDistinct`; `page.tsx` maps them to `CategoryOption[]` with string ids and passes to `<PfFilters categoryOptions={...} />`; the category Sheet renders with real labels; an explicit empty-state appears when no categories exist. Data-flow confirmed: DB → service → API → RSC → component.

- **Gap 2 (updatePercentages subset bypass):** Closed in plan 03-05 (commits dc1b5a2 / ce8dc62). Server now fetches owned account IDs, builds a Set, and rejects any payload that does not exactly cover that set before validating the sum or executing any writes. Regression test pins the invariant. The previous client-trust comment is removed.

Automated checks all pass (14 PF tests, 139 total, TypeScript clean on both apps). Eight human verification items remain (visual, browser interaction, URL state) — same as initial verification with two new category-filter checks added.

---

_Verified: 2026-06-06T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure (03-05 / 03-06)_
