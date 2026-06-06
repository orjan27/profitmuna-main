---
phase: 05-dashboard
verified: 2026-06-06T00:00:00Z
status: gaps_found
score: 2/10 must-haves verified
overrides_applied: 0
re_verification: false
gaps:
  - truth: 'User sees income totals (received + pending), expense totals, and per-account Profit First allocation balances (computedBalance) on the dashboard'
    status: failed
    reason: 'The overview page shows only a single hero total-wallet-balance and a PF allocation percentage bar. No income totals, no expense totals, and no per-account computedBalance amounts are surfaced. SC-1 and D-01 require five distinct stat cards.'
    artifacts:
      - path: 'apps/web/src/app/(dashboard)/overview/_components/overview-content.tsx'
        issue: 'Shows PfAllocationBar (percentages only) with no computedBalance per account. No income total or expense total displayed.'
    missing:
      - 'Five stat cards: Total Income (received), Pending Income, Total Expenses, Net Income, Total Wallet Balance — each with a MaskedAmount'
      - 'Per-account Profit First derived balance (computedBalance) display'

  - truth: 'User sees a unified recent-transactions feed combining income, expenses, AND wallet transactions (deposits/withdrawals)'
    status: failed
    reason: 'The recent feed in overview-content.tsx mixes income and expense entries only. Wallet transactions (DEPOSIT/WITHDRAWAL from walletTransactions table) are completely absent. overview/page.tsx fetches /api/wallets (for balance sum) and /api/incomes and /api/expenses but does not fetch wallet transactions. SC-2 and D-03 explicitly require wallet deposits/withdrawals in the feed.'
    artifacts:
      - path: 'apps/web/src/app/(dashboard)/overview/page.tsx'
        issue: 'Fetches /api/wallets, /api/profit-first/summary, /api/incomes, /api/expenses — no wallet transactions endpoint called'
      - path: 'apps/web/src/app/(dashboard)/overview/_components/overview-content.tsx'
        issue: "RecentEntry type has kind: 'income' | 'expense' only — no 'wallet_deposit' | 'wallet_withdrawal'"
    missing:
      - 'Fetch /api/wallets/{id}/transactions or equivalent to pull DEPOSIT/WITHDRAWAL entries into the feed'
      - 'wallet_deposit and wallet_withdrawal kinds in RecentEntry type'
      - 'wallet tx rows in the feed renderer'

  - truth: 'A date filter (This Month default, Asia/Manila timezone) governs all sections of the dashboard page'
    status: failed
    reason: 'No date filter exists on the overview page. The overview is not parameterized by date at all — it always shows all-time data (wallets sum all-time balanceCents; income/expenses are latest 6 records sorted by date, not a period). D-07 and D-08 require one date filter governing stat cards, PF balances, wallet balance, and the recent feed.'
    artifacts:
      - path: 'apps/web/src/app/(dashboard)/overview/page.tsx'
        issue: 'No searchParams, no from/to parameters, no nuqs filter — fetches unconditional all-time data'
    missing:
      - 'DashboardFilters component with This Month default and Manila timezone presets'
      - 'Date range propagated via URL params (nuqs) to all four data fetches'
      - 'Income/expense/wallet aggregates scoped to the selected date range'

  - truth: 'The wallet balance card is period-scoped (shows the computed balance within the selected date range) with a date sub-label making the period explicit'
    status: failed
    reason: 'overview/page.tsx computes totalBalanceCents = wallets.reduce((sum, w) => sum + w.balanceCents, 0), which is the all-time computed balance from the wallets endpoint, not a period-scoped recomputation. D-02 requires the wallet balance to be derived from transactions within the selected date range, not the all-time balance.'
    artifacts:
      - path: 'apps/web/src/app/(dashboard)/overview/page.tsx'
        issue: 'Line 78: const totalBalanceCents = wallets.reduce((sum, w) => sum + w.balanceCents, 0) — all-time, not period-scoped'
    missing:
      - 'Period-scoped wallet balance computation (pfAllocation + mappedIncome - mappedExpenses + deposits - withdrawals within the date range)'
      - "Date sub-label on the balance card (e.g. 'Period total (2026-06-01 – 2026-06-30)')"

  - truth: 'The feed paginates via a client-side Load more button; the initial load shows a bounded page of entries'
    status: failed
    reason: "The overview page fetches /api/incomes?page=0&limit=6 and /api/expenses?page=0&limit=6 server-side, merges them, sorts, and slices to 8. There is no Load more button, no feedPage state, and no client-side pagination mechanism. D-04 requires Load more pagination matching Phase 2's pattern."
    artifacts:
      - path: 'apps/web/src/app/(dashboard)/overview/page.tsx'
        issue: 'Line 101: .slice(0, 8) — static 8-row cap, no pagination'
      - path: 'apps/web/src/app/(dashboard)/overview/_components/overview-content.tsx'
        issue: 'No useState for feedPage/hasMore, no Load more button rendered'
    missing:
      - 'Client-side feedPage state and hasMore flag'
      - "Load more button (variant='outline') that fetches the next page via BFF proxy"
      - 'hasMore flag from the API to control button visibility'

  - truth: 'Feed rows navigate to the relevant section when clicked (/income for income rows, /expenses for expense rows, /wallets/{id} for wallet tx rows)'
    status: failed
    reason: 'Feed rows in overview-content.tsx are plain <li> elements with no href or Link wrapper. D-05 requires each row to be a navigation link. The section headers link to /income and /expenses in aggregate, but individual rows are not clickable/navigable.'
    artifacts:
      - path: 'apps/web/src/app/(dashboard)/overview/_components/overview-content.tsx'
        issue: 'Lines 172-193: <li> elements, no <Link> wrapping, no href per row'
    missing:
      - "Each feed row wrapped in <Link href={tx.href}> that navigates to the item's section"
      - 'href field in RecentEntry type (currently absent)'

  - truth: 'Authenticated users visiting / are redirected to the dashboard; unauthenticated visitors still see the marketing page'
    status: failed
    reason: 'apps/web/src/app/page.tsx contains no session check and no redirect. It is a pure marketing server component with no authentication guard. A logged-in user visiting / always sees the marketing page. D-10 (authenticated / redirects to dashboard) and 05-03 plan must_have are not met.'
    artifacts:
      - path: 'apps/web/src/app/page.tsx'
        issue: "No redirect('/overview') or redirect('/dashboard'), no getSession() call, no cookies() access — renders marketing content unconditionally"
    missing:
      - "Session check at top of page.tsx (getSession() or cookies().get('access_token'))"
      - "redirect('/overview') when access_token cookie is present"

  - truth: 'GET /api/dashboard/summary endpoint exists, returning income totals, expense totals, net income, period-scoped wallet balance, PF account balances, and paginated recent transactions feed'
    status: failed
    reason: 'No dashboard API endpoint exists. apps/api/src/index.ts has no /api/dashboard route. apps/api/src/routes/ contains no dashboard.ts. apps/api/src/services/ contains no dashboard-service.ts. apps/api/src/schemas/ contains no dashboard.ts. The implementation bypasses the planned dedicated endpoint entirely by composing existing endpoints in the server component — but this means the unified aggregation (date-scoped totals, period-scoped wallet balance, cross-type paginated feed) required by DASH-01 is not implemented.'
    artifacts:
      - path: 'apps/api/src/routes/dashboard.ts'
        issue: 'MISSING — file does not exist'
      - path: 'apps/api/src/services/dashboard-service.ts'
        issue: 'MISSING — file does not exist'
      - path: 'apps/api/src/schemas/dashboard.ts'
        issue: 'MISSING — file does not exist'
    missing:
      - 'createDashboardService(db) factory with getSummary(userId, dateRange?, feedPage, feedSize)'
      - 'GET /api/dashboard/summary route behind requireAuth'
      - 'dashboardQuerySchema with date regex validation'
      - "app.route('/api/dashboard', dashboardRouter) in index.ts"

  - truth: 'Web type contract (DashboardSummary, RecentTransaction, FeedPagination) and BFF proxy for /api/dashboard/* exist'
    status: failed
    reason: 'apps/web/src/types/dashboard.ts does not exist. apps/web/src/app/api/dashboard/[...path]/route.ts does not exist. These were required by 05-01 Plan Task 3.'
    artifacts:
      - path: 'apps/web/src/types/dashboard.ts'
        issue: 'MISSING — file does not exist'
      - path: 'apps/web/src/app/api/dashboard/[...path]/route.ts'
        issue: 'MISSING — BFF proxy for client-side Load more does not exist'
    missing:
      - 'DashboardSummary, RecentTransaction, FeedPagination interface exports in apps/web/src/types/dashboard.ts'
      - 'BFF proxy at apps/web/src/app/api/dashboard/[...path]/route.ts'

  - truth: 'DASH-01 test coverage exists: dashboard.test.ts covers income/expense aggregates, period-scoped wallet balance, recent transactions feed, soft-delete exclusion, and cross-user isolation'
    status: failed
    reason: 'apps/api/tests/dashboard.test.ts does not exist. The VALIDATION.md confirms this was wave 0 required. No automated test coverage for DASH-01 behaviors.'
    artifacts:
      - path: 'apps/api/tests/dashboard.test.ts'
        issue: 'MISSING — file does not exist'
    missing:
      - 'Test suite covering all 8 DASH-01 assertions from 05-01-PLAN Task 1'
      - 'Cross-user isolation assertion'

human_verification:
  - test: 'Navigate to /overview after login and verify the page renders financial data'
    expected: 'Page loads with hero balance, PF allocation bar, and recent income/expense entries'
    why_human: 'RSC composition and visual layout cannot be verified by grep'
  - test: 'Visit / while logged in and verify marketing page shows (no redirect)'
    expected: 'Marketing page renders — this is a confirmed deviation from D-10 (no authenticated redirect implemented)'
    why_human: 'Session-conditional rendering requires browser testing'
  - test: 'Verify /overview is protected — navigate to /overview without a session'
    expected: "Middleware redirects to /login (middleware covers /overview since it's not in PUBLIC_ROUTES)"
    why_human: 'Middleware behavior requires a running server'
---

# Phase 5: Dashboard Verification Report

**Phase Goal:** Users land on a summary page that surfaces the most important financial information without navigating to individual sections
**Verified:** 2026-06-06
**Status:** gaps_found
**Re-verification:** No — initial verification

## Context: Adopted Implementation

Phase 5 plans (05-01, 05-02, 05-03) were never executed by GSD executors. A parallel redesign session built an alternative overview page that was adopted as the Phase 5 base (commit d51c994). No SUMMARY.md files exist, which is expected. This report verifies the actual codebase against the ROADMAP success criteria and plan must_haves.

**Deviation map:**

- Dashboard at `/overview` (not `/dashboard` per D-10)
- Nav label is "Overview" (not "Dashboard" per D-11)
- No dedicated `/api/dashboard/summary` endpoint (composites existing endpoints instead)
- Root `/` does NOT redirect authenticated users (D-10 not implemented)
- No date filter (D-07, D-08 not implemented)

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                        | Status   | Evidence                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | User sees income totals, expense totals, and PF allocation balances (SC-1, D-01)                             | FAILED   | Overview shows hero wallet balance + PF % bar only; no income/expense stat cards, no per-account computedBalance                                             |
| 2   | User sees a unified feed: income + expenses + wallet transactions (SC-2, D-03)                               | FAILED   | Feed has income + expenses only; wallet DEPOSIT/WITHDRAWAL absent from RecentEntry type and from data fetching                                               |
| 3   | Dashboard data reflects current state without manual refresh (SC-3, D-09)                                    | VERIFIED | apiFetch calls on every RSC render; Next.js 15 fetch defaults to no-store                                                                                    |
| 4   | All authenticated pages share a navigation shell with links to all sections (SC-4, D-11)                     | VERIFIED | DashboardNav with 5 items (Overview/Income/Expenses/Profit First/Wallets); no Settings (deferred to Phase 6)                                                 |
| 5   | Date filter (This Month default, Manila tz) governs all sections (D-07, D-08)                                | FAILED   | No date filter component exists; overview is not date-parameterized                                                                                          |
| 6   | Wallet balance is period-scoped with date sub-label (D-02)                                                   | FAILED   | totalBalanceCents sums all-time wallet.balanceCents from list endpoint; not period-scoped                                                                    |
| 7   | Feed has Load more client-side pagination (D-04)                                                             | FAILED   | Static .slice(0, 8) on server; no feedPage state, no Load more button                                                                                        |
| 8   | Feed rows navigate to /income, /expenses, /wallets/{id} (D-05)                                               | FAILED   | <li> elements, no Link wrapper, no href per row                                                                                                              |
| 9   | Authenticated / redirects to dashboard; unauthenticated users see marketing (D-10, 05-03)                    | FAILED   | page.tsx has no session check or redirect; logged-in users always see marketing page                                                                         |
| 10  | New user sees zeroed cards + getting-started CTAs linking to /income/new, /expenses/new, /wallets/new (D-12) | PARTIAL  | First-run state shows welcome text + "Record your first income" button (opens RecordSheet, not /income/new link); /expenses/new and /wallets/new CTAs absent |

**Score:** 2/10 truths verified

---

## Required Artifacts

### 05-01 Plan Artifacts (ALL MISSING)

| Artifact                                            | Expected                                            | Status  | Details             |
| --------------------------------------------------- | --------------------------------------------------- | ------- | ------------------- |
| `apps/api/src/services/dashboard-service.ts`        | createDashboardService factory                      | MISSING | File does not exist |
| `apps/api/src/routes/dashboard.ts`                  | GET /summary route behind requireAuth               | MISSING | File does not exist |
| `apps/api/src/schemas/dashboard.ts`                 | dashboardQuerySchema                                | MISSING | File does not exist |
| `apps/web/src/types/dashboard.ts`                   | DashboardSummary, RecentTransaction, FeedPagination | MISSING | File does not exist |
| `apps/web/src/app/api/dashboard/[...path]/route.ts` | BFF proxy for Load more                             | MISSING | File does not exist |
| `apps/api/tests/dashboard.test.ts`                  | DASH-01 unit assertions                             | MISSING | File does not exist |

### 05-02 Plan Artifacts (LOCATION DEVIATION + INCOMPLETE)

| Artifact                                                                  | Expected                             | Status                  | Details                                                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx`                         | RSC page at /dashboard               | MISSING at planned path | Exists as /overview/page.tsx instead                                                                                        |
| `apps/web/src/app/(dashboard)/dashboard/_components/DashboardFilters.tsx` | Date filter with nuqs                | MISSING                 | No equivalent in /overview                                                                                                  |
| `apps/web/src/app/(dashboard)/dashboard/_components/DashboardContent.tsx` | 5 stat cards + PF + feed + Load more | MISSING at planned path | Partial equivalent at /overview/\_components/overview-content.tsx but lacks 5 cards, date filter, Load more, navigable rows |

### 05-03 Plan Artifacts (PARTIAL)

| Artifact                                   | Expected                                            | Status  | Details                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/DashboardNav.tsx` | Dashboard nav → /dashboard                          | PARTIAL | Nav exists with 5 links; links to /overview (deviation from /dashboard), nav label is "Overview" not "Dashboard" — the navigation itself works |
| `apps/web/src/app/page.tsx`                | root redirect to /dashboard for authenticated users | FAILED  | No session check, no redirect — pure marketing page                                                                                            |

---

## Key Link Verification

| From                        | To                             | Via         | Status    | Details                                                                         |
| --------------------------- | ------------------------------ | ----------- | --------- | ------------------------------------------------------------------------------- |
| `overview/page.tsx`         | `/api/profit-first/summary`    | apiFetch    | WIRED     | Returns accounts with computedBalance; accounts are passed but only % bar shown |
| `overview/page.tsx`         | `/api/wallets`                 | apiFetch    | WIRED     | Returns wallet list with all-time balanceCents                                  |
| `overview/page.tsx`         | `/api/incomes?page=0&limit=6`  | apiFetch    | WIRED     | Recent income entries fetched                                                   |
| `overview/page.tsx`         | `/api/expenses?page=0&limit=6` | apiFetch    | WIRED     | Recent expense entries fetched                                                  |
| `overview/page.tsx`         | `/api/wallets/*/transactions`  | Not fetched | NOT_WIRED | Wallet transactions not included in feed                                        |
| `apps/api/src/index.ts`     | `/api/dashboard`               | app.route   | NOT_WIRED | No dashboard route mounted                                                      |
| `apps/web/src/app/page.tsx` | `/overview`                    | redirect    | NOT_WIRED | No authenticated redirect exists                                                |
| `DashboardNav.tsx`          | `/overview`                    | href        | WIRED     | Nav item href: '/overview' (deviation from planned /dashboard)                  |

---

## Data-Flow Trace (Level 4)

| Artifact               | Data Variable       | Source                            | Produces Real Data             | Status                                   |
| ---------------------- | ------------------- | --------------------------------- | ------------------------------ | ---------------------------------------- |
| `overview-content.tsx` | `totalBalanceCents` | wallets list endpoint sum         | Yes (all-time wallet balances) | HOLLOW — all-time, not period-scoped     |
| `overview-content.tsx` | `accounts`          | /api/profit-first/summary         | Yes (with computedBalance)     | FLOWING but computedBalance not rendered |
| `overview-content.tsx` | `recent[]`          | incomes + expenses (first 6 each) | Yes                            | FLOWING but incomplete (no wallet tx)    |

---

## Behavioral Spot-Checks

| Behavior                                | Command                                                                                   | Result                  | Status           |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- | ---------------- |
| Dashboard API endpoint exists           | `grep -r "api/dashboard" apps/api/src/index.ts`                                           | Not found               | FAIL             |
| dashboard-service.ts exists             | `ls apps/api/src/services/dashboard-service.ts`                                           | Not found               | FAIL             |
| Dashboard test file exists              | `ls apps/api/tests/dashboard.test.ts`                                                     | Not found               | FAIL             |
| Root page redirects authenticated users | `grep "redirect" apps/web/src/app/page.tsx`                                               | Not found               | FAIL             |
| Overview nav links to /overview         | `grep "href: '/overview'" apps/web/src/components/DashboardNav.tsx`                       | Found (line 18)         | PASS (deviation) |
| Feed row navigation                     | `grep "Link href" apps/web/src/app/(dashboard)/overview/_components/overview-content.tsx` | Not in feed row context | FAIL             |

---

## Requirements Coverage

| Requirement | Source Plan         | Description                                                                             | Status  | Evidence                                                                                       |
| ----------- | ------------------- | --------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| DASH-01     | 05-01, 05-02, 05-03 | User lands on dashboard showing income/expense totals, PF balances, recent transactions | BLOCKED | Income totals absent, expense totals absent, wallet tx absent, no date filter, no period-scope |

---

## Anti-Patterns Found

| File                                                                     | Line    | Pattern                                                                                          | Severity | Impact                                                  |
| ------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------- |
| `apps/web/src/app/(dashboard)/overview/_components/overview-content.tsx` | 101     | `.slice(0, 8)` — static cap, no Load more                                                        | Warning  | Feed truncated; user cannot see more than 8 entries     |
| `apps/web/src/app/(dashboard)/overview/_components/overview-content.tsx` | 199-207 | Empty state CTA opens RecordSheet instead of linking to /income/new, /expenses/new, /wallets/new | Warning  | D-12 specifies direct navigation CTAs, not sheet opener |

No unreferenced TBD/FIXME/XXX debt markers found in the modified files.

---

## D-Decision Verdict

| Decision | Description                                                                                | Status            | Evidence                                                                        |
| -------- | ------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------- |
| D-01     | Five stat cards (Total Income, Pending Income, Total Expenses, Net Income, Wallet Balance) | FAILED            | Overview has a single hero balance, no 5 stat cards                             |
| D-02     | Wallet balance period-scoped with date sub-label                                           | FAILED            | All-time balance from wallet list; no period label                              |
| D-03     | Unified feed: income + expense + wallet deposit/withdrawal                                 | PARTIAL           | Income + expense present; wallet tx absent                                      |
| D-04     | Load more pagination                                                                       | FAILED            | Static 8-row slice; no Load more button                                         |
| D-05     | Feed rows navigate to section on click                                                     | FAILED            | <li> elements with no Link wrapping                                             |
| D-06     | Soft-deleted records excluded                                                              | VERIFIED          | expenses filtered by deletedAt === null (line 91)                               |
| D-07     | One date filter governs all sections                                                       | FAILED            | No date filter exists                                                           |
| D-08     | This Month default + Manila tz                                                             | FAILED            | No date filter; Manila tz used only for greeting                                |
| D-09     | Fresh data per visit (no manual refresh)                                                   | VERIFIED          | apiFetch on every RSC render; Next.js 15 no-store default                       |
| D-10     | Dashboard at /dashboard; authenticated / redirects                                         | PARTIAL DEVIATION | Route is /overview; / does NOT redirect; post-login redirect to /overview works |
| D-11     | Nav shell finalized, 5 entries, no Settings                                                | VERIFIED          | DashboardNav has Overview/Income/Expenses/Profit First/Wallets                  |
| D-12     | Zeroed cards + getting-started CTAs (/income/new, /expenses/new, /wallets/new)             | PARTIAL           | First-run state exists; CTAs use RecordSheet button not direct links            |

---

## Human Verification Required

### 1. Visual layout of /overview

**Test:** Log in and navigate to /overview. Visually inspect the page.
**Expected:** The adopted layout (hero balance, PF split bar, recent ledger) is present and renders real financial data.
**Why human:** RSC composition and visual rendering cannot be verified by grep.

### 2. /overview protection by middleware

**Test:** Clear all cookies and navigate directly to /overview.
**Expected:** Middleware redirects to /login (PUBLIC_ROUTES does not include /overview, so the auth gate fires).
**Why human:** Middleware behavior requires a running server.

### 3. Root page behavior for authenticated users

**Test:** Log in, then navigate to /. Observe whether a redirect occurs.
**Expected (current state):** Marketing page renders with no redirect — this is a confirmed gap.
**Why human:** Session-conditional behavior requires a running browser session.

---

## Gaps Summary

The adopted implementation delivers a functional home page at `/overview` that covers two of the four ROADMAP success criteria (fresh data on every visit + shared nav shell). However it misses the core financial summary obligations:

**Critical missing behaviors (8 of 10 truths failed):**

1. **No income/expense stat cards** — the page headline metric is total wallet balance; income received, pending income, total expenses, and net income as separate displayable figures are absent.
2. **No per-account PF balance amounts** — the PF section shows a percentage bar but not the derived `computedBalance` per account that SC-1 requires.
3. **No wallet transactions in feed** — wallet deposits and withdrawals are absent from the recent activity list; only income and expenses appear.
4. **No date filter** — the page is not parameterized by date at all; D-07/D-08 (one date filter governing all sections, This Month default, Manila tz) are unimplemented.
5. **All-time wallet balance** — the hero balance is the sum of all-time wallet computed balances, not a period-scoped recomputation.
6. **No Load more** — the feed is statically capped at 8 entries with no pagination.
7. **Feed rows not navigable** — clicking a recent entry does nothing; rows are `<li>` elements.
8. **No authenticated redirect from /** — D-10's requirement that authenticated `/` redirects to the dashboard is unimplemented; logged-in users always see the marketing page.

**Backend entirely missing:** The dedicated `/api/dashboard/summary` endpoint, `createDashboardService`, `dashboardQuerySchema`, web type contract (`DashboardSummary`, `RecentTransaction`, `FeedPagination`), BFF proxy, and `dashboard.test.ts` were never created. The composition-based approach (calling existing endpoints) is a valid alternative architecture for the data retrieval, but the current implementation is incomplete even with that approach (missing date scoping, wallet transactions, period-scoped balance).

**Route deviation is acceptable IF the missing features are added:** The `/overview` route with "Overview" nav label deviates from D-10's `/dashboard` specification, but this is a cosmetic/routing difference that does not affect the functional requirements. The adopted design delivers the correct intent (a signed-in home page).

---

_Verified: 2026-06-06T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
