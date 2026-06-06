---
phase: 03-profit-first-allocation
verified: 2026-06-06T12:05:00Z
status: gaps_found
score: 3/4
overrides_applied: 0
gaps:
  - truth: 'User can view an allocation summary filterable by date range AND income category'
    status: failed
    reason: 'Category filter is backend-wired but frontend-unreachable. page.tsx calls <PfFilters /> with no props, so categoryOptions defaults to [] and the category Sheet never renders. The user has no way to set categoryIds through the UI. The API and URL-param plumbing are complete, but the entry point is dead.'
    artifacts:
      - path: 'apps/web/src/app/(dashboard)/profit-first/page.tsx'
        issue: 'Line 96 renders <PfFilters /> with zero props — categoryOptions is never derived and passed down. The RSC reads params.categoryIds (line 57) and forwards it to the API, but there is no UI to set that value.'
      - path: 'apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx'
        issue: 'categoryOptions defaults to [] (line 98). The Sheet rendering is gated on categoryOptions.length > 0 (line 149), so it is never shown.'
    missing:
      - 'Derive categoryOptions server-side in page.tsx (e.g. from distinct categoryIds in the summary response or from the income_categories API) and pass them to <PfFilters categoryOptions={...} />'
      - 'Alternatively, descope the category filter to Phase 2 and remove the dead plumbing in this phase so the codebase does not carry an unreachable path'
  - truth: 'PUT /api/profit-first/percentages rejects (400) unless submitted basis-point set totals exactly 10000'
    status: partial
    reason: "CR-01 (code review): updatePercentages validates only the SUBMITTED subset, not the user's full account set. A request submitting a single account with targetPercentage 10000 passes the sum check and updates only that row while others retain their existing values — leaving the persisted set summing to more than 10000 bp. This silently over-allocates income across multiple accounts and violates the core product invariant. The UI bulk editor always sends all accounts (enforced by PfPercentageEditor), but the API endpoint is directly reachable with any authenticated token."
    artifacts:
      - path: 'apps/api/src/services/profit-first-service.ts'
        issue: "Lines 387-413: sum is computed from input.accounts only. No check that the submitted set covers exactly the user's owned accounts. Comment at line 385 explicitly acknowledges: 'The caller is responsible for submitting ALL accounts' — this is client-trust for a server-side invariant."
      - path: 'apps/api/src/schemas/profit-first.ts'
        issue: 'Line 61: updatePercentagesSchema requires .min(1) on the accounts array — allows partial submissions.'
    missing:
      - 'In updatePercentages: fetch all user-owned account IDs, validate the submitted set covers exactly those IDs (no missing, no foreign, no duplicates), then validate sum === 10000'
      - 'Add a test that submits a single-account partial set and asserts 400'
deferred:
  - truth: 'An account linked to a wallet cannot be deleted (PF-03 / ROADMAP SC 3 partial clause)'
    addressed_in: 'Phase 4'
    evidence: "Phase 4 goal: 'Users can create wallets linked to allocation accounts or standalone'. The wallets table does not exist in Phase 3. The guard is present as a commented block in deleteAccount (profit-first-service.ts lines 360-370) with an explicit 'Uncomment in Phase 4' instruction. The planner documented this deferral in 03-02-PLAN.md and 03-02-SUMMARY.md. No Phase 4 SC explicitly names the delete guard, but Phase 4 Plan 02 (PLAN frontmatter in .planning/phases/04-wallets/) is expected to activate the stub when the wallets table is created."
---

# Phase 3: Profit First Allocation Verification Report

**Phase Goal:** Users can configure Profit First allocation accounts with percentage targets and view derived balance summaries across their received income
**Verified:** 2026-06-06T12:05:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                        | Status        | Evidence                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | New users get 4 default accounts seeded (Profit 5%, Owner Pay 50%, Tax 15%, OPEX 30%)        | VERIFIED      | `seedProfitFirstAccounts` present in profit-first-service.ts; wired into `register()` line 153 and `upsertGoogleUser()` branch 3 line 561; migration backfill confirmed in D1; PF-01 tests (3) green                                                                                 |
| 2   | User can update allocation percentages with sum-to-100% validation                           | PARTIAL       | `updatePercentages` validates the submitted subset (not the user's full account set) — CR-01: a partial submission bypasses the invariant. UI layer enforces full-set submission but the API endpoint is directly exploitable                                                        |
| 3   | User can create/edit/delete custom accounts; defaults not deletable                          | VERIFIED      | `deleteAccount` guards `accountType !== 'CUSTOM'` (line 356); wallet-link guard deferred to Phase 4 (commented stub, explicitly documented); service tests confirm default protection                                                                                                |
| 4   | User can view allocation summary with derived balances filterable by date range and category | PARTIAL (gap) | Date-range filtering: VERIFIED (TZDate Manila presets, nuqs URL state, API honors from/to, tests green). Category filtering: FAILED — `page.tsx` passes no `categoryOptions` to `<PfFilters />`, so the category Sheet never renders. Backend is fully wired; UI entry point is dead |

**Score:** 3/4 truths verified (SC2 and SC4 have deficiencies; SC2 is partial/exploitable; SC4 has a missing UI wire for category filter)

---

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| #   | Item                                                   | Addressed In | Evidence                                                                                                                                                                                                                |
| --- | ------------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Wallet-linked account cannot be deleted (PF-03 clause) | Phase 4      | Guard stubbed as commented block in deleteAccount (lines 360-370) with explicit "Uncomment in Phase 4" note; wallets table does not exist in Phase 3; planner documented deferral in 03-02-PLAN.md and 03-02-SUMMARY.md |

---

### Required Artifacts

| Artifact                                                                         | Expected                                             | Status   | Details                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/schema.ts`                                                      | profitFirstAccounts table + incomes table            | VERIFIED | Both tables present; profitFirstAccounts has correct enum, unique index, FK; incomes is the full Phase 2 table (more than the minimal stub planned — acceptable deviation) |
| `apps/api/src/services/profit-first-service.ts`                                  | seedProfitFirstAccounts + createProfitFirstService   | VERIFIED | Both exported; D-03 seed values exact; computeBalance formula correct; getSummary, createAccount, updateAccount, deleteAccount, updatePercentages all implemented          |
| `apps/api/src/schemas/profit-first.ts`                                           | Zod schemas with basis-point + color-enum bounds     | VERIFIED | createAccountSchema, updateAccountSchema, updatePercentagesSchema, summaryQuerySchema all present; PF_DEFAULT_COLORS matches web copy exactly (diff empty)                 |
| `apps/api/src/routes/profit-first.ts`                                            | Thin Hono router behind requireAuth                  | VERIFIED | profitFirstRouter with `use('/*', requireAuth)` at top; all 5 routes (GET summary, POST/PATCH/DELETE accounts, PUT percentages); zValidator 422 hooks                      |
| `apps/api/src/index.ts`                                                          | Route registration                                   | VERIFIED | `app.route('/api/profit-first', profitFirstRouter)` at line 72; CORS allowMethods already includes PATCH/DELETE/PUT                                                        |
| `apps/web/src/app/api/profit-first/[...path]/route.ts`                           | BFF proxy exporting GET/POST/PATCH/DELETE/PUT        | VERIFIED | All 5 methods exported; Bearer forwarded from access_token cookie; no transparent-refresh or Set-Cookie relay                                                              |
| `packages/db/migrations/0002_narrow_lethal_legion.sql`                           | Additive migration + idempotent backfill             | VERIFIED | Creates profit_first_accounts table; 4 backfill INSERT...SELECT with NOT IN guard; confirmed applied to local D1                                                           |
| `apps/web/src/app/(dashboard)/layout.tsx`                                        | Authenticated dashboard shell                        | VERIFIED | Default export rendering {children} inside min-h-screen container                                                                                                          |
| `apps/web/src/app/(dashboard)/profit-first/page.tsx`                             | RSC that awaits searchParams and SSR-fetches summary | VERIFIED | Awaits searchParams; fetches direct to API_BASE_URL with Bearer (not BFF); no nuqs hooks (Pitfall 5 clean)                                                                 |
| `apps/web/src/components/amount-visibility.tsx`                                  | useAmountVisibility + AmountToggle + MaskedAmount    | VERIFIED | All three exported; storage key 'pf-amounts-visible'; mounted && visible guard present (4 occurrences)                                                                     |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-overview.tsx`          | Account cards with derived balances                  | VERIFIED | 2-col grid; left border in account.color; MaskedAmount in Display slot; Progress bar; aria-label="Account options" dropdown; delete disabled for non-CUSTOM with tooltip   |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx`           | Date-range + category multi-select via nuqs          | PARTIAL  | Date presets via TZDate Manila timezone: VERIFIED. Category Sheet: STUB (never shown because categoryOptions always []). useQueryState present for all three params        |
| `apps/web/src/server/profit-first-actions.ts`                                    | Server actions with percent→bp conversion            | VERIFIED | 'use server'; exports all 4 actions; Math.round(pct \* 100) present 3 times; API errors surfaced to callers                                                                |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-percentage-editor.tsx` | Bulk editor with live 100% gate                      | VERIFIED | total === 100 gate; no "10000" in logic (comment only); "Allocation percentages saved." toast; router.refresh() on success                                                 |
| `apps/web/src/app/(dashboard)/profit-first/_components/pf-account-form.tsx`      | Create/edit dialog with preset color swatches        | VERIFIED | PF_DEFAULT_COLORS as swatches; no type="color"; "Account created."/"Account updated." toasts; API error messages surfaced verbatim                                         |

---

### Key Link Verification

| From                                        | To                                        | Via                                                       | Status                                    | Details                                                                                                                                                            |
| ------------------------------------------- | ----------------------------------------- | --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| auth-service.ts register()                  | seedProfitFirstAccounts                   | direct call after user insert (line 153)                  | WIRED                                     | Confirmed at line 153; before issueVerifyToken                                                                                                                     |
| auth-service.ts upsertGoogleUser() branch 3 | seedProfitFirstAccounts                   | direct call after insert (line 561)                       | WIRED                                     | Branch 3 only; branches 1/2 return early before reaching the call                                                                                                  |
| apps/api/src/index.ts                       | profitFirstRouter                         | app.route('/api/profit-first', profitFirstRouter) line 72 | WIRED                                     | Route registered                                                                                                                                                   |
| profit-first.ts routes                      | createProfitFirstService                  | createDb(c.env.DB) per request inside each handler        | WIRED                                     | No module-scope DB (Pitfall 8 clean)                                                                                                                               |
| page.tsx RSC                                | /api/profit-first/summary                 | direct fetch with Bearer to API_BASE_URL                  | WIRED                                     | Lines 61-83; cache: 'no-store'                                                                                                                                     |
| pf-filters.tsx                              | URL search params (from, to, categoryIds) | nuqs useQueryState + router.refresh()                     | WIRED (date range) / NOT_WIRED (category) | Date range params flow to RSC re-render. categoryIds param is read by page.tsx and forwarded to API, but UI never sets it (no categoryOptions passed to PfFilters) |
| pf-percentage-editor.tsx                    | updatePercentagesAction                   | server action call at line 75                             | WIRED                                     | Correct conversion via action                                                                                                                                      |
| profit-first-actions.ts                     | /api/profit-first/percentages             | PUT fetch with Math.round(pct \* 100) conversion          | WIRED                                     | 3 conversion sites confirmed                                                                                                                                       |
| pf-account-form.tsx                         | PF_DEFAULT_COLORS                         | import from @/lib/constants (line 18)                     | WIRED                                     | Swatches rendered from constant                                                                                                                                    |

---

### Data-Flow Trace (Level 4)

| Artifact                 | Data Variable         | Source                                                                         | Produces Real Data                                 | Status                                                   |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------- |
| pf-overview.tsx          | accounts, totalIncome | RSC page.tsx → API GET /summary → DB SUM(incomes) + SELECT profitFirstAccounts | Yes — Drizzle queries with COALESCE SUM and SELECT | FLOWING                                                  |
| pf-percentage-editor.tsx | rows                  | accounts prop from RSC (server-fetched)                                        | Yes — same as above                                | FLOWING                                                  |
| pf-filters.tsx           | categoryOptions       | Never passed from page.tsx (always [])                                         | No — prop hardcoded empty at call site             | HOLLOW_PROP (category filter only; date filters flowing) |

---

### Behavioral Spot-Checks

| Behavior                              | Command                                                                                                                                             | Result                                                                  | Status |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| API test suite: all 12 PF tests green | `cd apps/api && npx vitest run tests/profit-first.test.ts`                                                                                          | 12 tests passed                                                         | PASS   |
| Full API test suite                   | `cd apps/api && npx vitest run`                                                                                                                     | 82 tests passed (3 files)                                               | PASS   |
| API TypeScript compile                | `cd apps/api && npx tsc --noEmit`                                                                                                                   | Exit 0, no output                                                       | PASS   |
| Web TypeScript compile                | `cd apps/web && npx tsc --noEmit`                                                                                                                   | Exit 0, no output                                                       | PASS   |
| D1 tables present                     | `npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('profit_first_accounts','incomes');"` | Both tables returned                                                    | PASS   |
| Category filter UI reachable          | Inspect page.tsx call to PfFilters — categoryOptions not passed                                                                                     | `<PfFilters />` at line 96 has no props; categoryOptions defaults to [] | FAIL   |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files found. Phase does not declare probes.

---

### Requirements Coverage

| Requirement | Source Plan                  | Description                                                                                             | Status             | Evidence                                                                                                                                                                        |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-01       | 03-01-PLAN.md                | New users get 4 default allocation accounts seeded                                                      | SATISFIED          | seedProfitFirstAccounts in auth-service; migration backfill; PF-01 tests green                                                                                                  |
| PF-02       | 03-02-PLAN.md, 03-04-PLAN.md | User can update allocation percentages, validated to sum to exactly 100%                                | PARTIAL            | Sum validation present server-side, but only on submitted subset (CR-01). UI enforces full-set submission. Stored as basis points. CRUD otherwise correct.                      |
| PF-03       | 03-02-PLAN.md, 03-04-PLAN.md | User can create, edit, and delete custom accounts (defaults not deletable; wallet-linked not deletable) | PARTIAL (deferred) | Create/edit/delete custom accounts: SATISFIED. Default protection: SATISFIED. Wallet-link guard: DEFERRED to Phase 4 (commented stub, wallets table does not exist in Phase 3). |
| PF-04       | 03-02-PLAN.md, 03-03-PLAN.md | User can view allocation summary with balances, filterable by date range and category                   | PARTIAL            | Balance computation: SATISFIED. Date-range filter: SATISFIED. Category filter: FAILED — UI entry point missing (categoryOptions never passed to PfFilters).                     |

---

### Anti-Patterns Found

| File                                                 | Line    | Pattern                                                                                                      | Severity            | Impact                                                                                                                                     |
| ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| apps/api/src/services/profit-first-service.ts        | 385     | Comment "The caller is responsible for submitting ALL accounts" — client-trust for a server invariant        | BLOCKER (via CR-01) | Allows authenticated bypass of the sum-to-100% invariant                                                                                   |
| apps/api/src/services/profit-first-service.ts        | 268-276 | `err.message.includes('UNIQUE')` — substring match on driver error message (WR-03)                           | Warning             | May fall through to 500 in production if D1 error message differs from better-sqlite3                                                      |
| apps/web/src/app/(dashboard)/profit-first/page.tsx   | 81-83   | Empty catch block — network errors silently produce empty state (WR-06)                                      | Warning             | Users with expired tokens or transient errors see "No allocation accounts yet" instead of a meaningful error state; no server-side logging |
| apps/web/src/app/api/profit-first/[...path]/route.ts | 34-37   | BFF proxy only forwards content-type header, dropping Retry-After and security headers from upstream (WR-07) | Warning             | Security headers and throttling contract partially defeated on client-side fetch path                                                      |

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
**Expected:** URL changes to `?from=YYYY-MM-DD&to=YYYY-MM-DD`; account balances re-render without full page reload; "This Month" button shows filled/default variant.
**Why human:** URL state updates and RSC re-render behavior require a browser.

### 4. Bulk percentage editor 100% gate

**Test:** Open "Edit Percentages"; change one account to an invalid total (e.g. set all to 25 → total 100% ✓, then change one to 26 → total 101%); verify Save is disabled.
**Expected:** Total line shows red "Total: 101% — must equal 100% to save"; Save button is disabled/non-interactive.
**Why human:** Live input interaction and button disabled state require a browser.

### 5. Create/edit/delete custom account end-to-end

**Test:** Create a new custom account (any name, 0%, any preset color); edit it; delete it via confirmation dialog.
**Expected:** Account appears in the grid after create; updates after edit; disappears after delete. Success toasts appear for each operation.
**Why human:** Full CRUD flow with dialogs, toasts, and router.refresh() invalidation requires a browser.

### 6. Default account delete disabled in UI

**Test:** Click the ⋮ menu on the "Profit" account (accountType: PROFIT); hover over the Delete item.
**Expected:** Delete item is disabled with tooltip "Default accounts cannot be deleted."
**Why human:** Disabled state and tooltip rendering require a browser.

---

### Gaps Summary

**Two gaps block full goal achievement:**

**Gap 1 — Category filter UI is dead (BLOCKER for full SC4):**
The phase goal includes "filterable by date range and income category." Date-range filtering is fully functional. Category filtering is backend-complete but frontend-unreachable: `page.tsx` renders `<PfFilters />` with no `categoryOptions` prop, so the category Sheet never appears. The URL param `categoryIds` is read and forwarded to the API, but there is no UI to set it. This was acknowledged in 03-03-SUMMARY.md as a known stub ("Category multi-select options: Phase 2 will provide full labels"), but the summary under-states the impact — the filter is not just missing labels, it is missing the entry point entirely.

Whether this blocks the phase or is acceptable depends on the team's interpretation of "filterable by category" in Phase 3 vs Phase 2. If the team accepts that category filtering is deferred until Phase 2 provides income categories, this can be overridden. Otherwise, the fix is to derive category options from either the summary response (distinct categoryIds) or the income-categories endpoint and pass them to PfFilters.

**Gap 2 — updatePercentages subset bypass (BLOCKER per CR-01):**
The sum-to-100% invariant is validated only against the submitted set of accounts, not the user's full account set. An authenticated client sending a single account with targetPercentage=10000 bypasses the validation and corrupts all downstream balance computations. This breaks the core product invariant ("the user always knows exactly how much belongs to each bucket"). The UI always sends the full set, but the API endpoint is directly reachable. Fix: fetch the user's owned account IDs in the service, require the submitted set to exactly match them, then validate the sum.

---

_Verified: 2026-06-06T12:05:00Z_
_Verifier: Claude (gsd-verifier)_
