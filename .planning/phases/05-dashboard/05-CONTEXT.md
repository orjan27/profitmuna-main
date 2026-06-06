# Phase 5: Dashboard - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users land on a summary page at `/dashboard` that surfaces the most important financial information without navigating to individual sections:

- **Stat cards** with income totals, expense totals, and a total wallet balance — all governed by a date filter
- **Profit First allocation balances** (per-account cards, reference layout)
- **Recent transactions feed** combining income, expenses, and wallet deposits/withdrawals — this part is **net-new vs the reference** (the reference dashboard has no transactions feed)
- Fresh data computed live on every visit (derived balances, no stored aggregates)

Covers requirement **DASH-01**. Depends on Phase 4 (and transitively Phases 2–3) — the dashboard reads income, expenses, PF accounts, and wallets built there.

**Fidelity note:** the reference at `/mnt/c/dev/profitfirst/practice` HAS a dashboard (`(dashboard)/dashboard/`). Its stat grid, PF accounts section, DateFilter, and amount-masking carry over directly; its rentals content (Ads Spent, Partner Commissions, Units Booked, Avg Daily Bookings cards and the entire "Upcoming Collections" forecast section) is stripped. The recent transactions feed is Profitmuna's deliberate addition.

**Not in this phase:** currency setting UI, notification center, reminder schedules (all Phase 6); any income/expense/PF/wallet CRUD (Phases 2–4).

</domain>

<decisions>
## Implementation Decisions

### Stat cards

- **D-01:** Five stat cards: **Total Income (received), Pending Income, Total Expenses, Net Income, Total Wallet Balance**. The first four replicate the reference cards (icons, colors, conditional red Net Income styling); Total Wallet Balance is added to replace the stripped rentals cards.
- **D-02:** The **Total Wallet Balance card respects the date filter** — the wallet balance formula (`pfAllocation + mappedIncome − mappedExpenses + deposits − withdrawals`) is recomputed limited to the selected range (transactions/income/expenses filtered by date). It is NOT the all-time balance shown on wallet pages; label/subtitle should make the period clear.

### Recent transactions feed (net-new)

- **D-03:** **Unified chronological feed** — one list mixing all three types (income, expense, wallet deposit/withdrawal), each row badged by type with color-coded amounts.
- **D-04:** Feed paginates with a **"Load more" button**, matching Phase 2's list pattern (02-CONTEXT D-06). Initial page size aligns with whatever Phase 2 establishes.
- **D-05:** Clicking a feed row **navigates to its section** — income → `/income`, expense → `/expenses`, wallet transaction → that wallet's detail page. No inline editing on the dashboard.
- **D-06:** **Soft-deleted records are excluded** from the feed (consistent with totals). Restore flows stay on the list/detail pages (Phase 2/4 patterns).

### Date filter & freshness

- **D-07:** One date filter governs **everything on the page** — stat cards, PF balances, wallet balance card, AND the recent transactions feed. The whole dashboard answers "what happened in this period?"
- **D-08:** Default range is **This Month** (Asia/Manila, matching the reference `getDefaultDateRange` and Phase 3's preset/timezone decisions D-09); filter state in URL search params via `nuqs` (Phase 3 D-11 pattern).
- **D-09:** Freshness = **fresh dynamic SSR per visit** — server component fetches on every navigation, no caching, no polling, no focus-revalidation. Matches the reference pattern and satisfies "no manual refresh" since balances are always derived live.

### Landing route & navigation

- **D-10:** Dashboard lives at **`/dashboard`**; authenticated `/` redirects to `/dashboard`; post-login redirect targets `/dashboard`. Matches the reference's `(dashboard)` route-group structure.
- **D-11:** **Phase 5 owns finalizing the nav shell**: add the Dashboard nav entry, make it the default landing, and verify all section links (Income, Expenses, Profit First, Wallets) are wired. The Settings nav entry waits for Phase 6. If Phases 2–4 left shell gaps, Phase 5 closes them.
- **D-12:** Brand-new users (zero data) see **zeroed cards + getting-started hints**: ₱0.00 stat cards, seeded PF accounts at ₱0, and the empty feed area shows CTAs like "Record your first income" linking to `/income/new`. No full-page welcome takeover.

### Claude's Discretion

- Exact feed row layout (icon/badge/description/amount/date columns), type badge styling, and sort tie-breaking — follow shadcn/ui conventions and Phase 2/4 row styling
- Initial feed page size (align with Phase 2's list page size)
- Dashboard API shape (e.g., single `GET /api/dashboard/summary` like the reference vs composing existing endpoints) — reference `dashboard-service.ts` `getSummary` with parallel queries is the model; `getBadgeCounts`/`getActionItems` are rentals-only and stripped
- Whether PF section card links to `/profit-first` and exact progress-bar semantics (reference uses share-of-total-balance)
- Exact getting-started CTA copy and which CTAs appear (income/expense/wallet)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference implementation (fidelity source of truth)

- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/dashboard/page.tsx` — server component pattern: searchParams (from/to/period), default date range, summary fetch, empty-state fallback
- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/dashboard/_components/dashboard-content.tsx` — stat card grid (labels, icons, colors, MaskedAmount usage), PF accounts section with progress bars, PageHeader + AmountToggle + DateFilter composition
- `/mnt/c/dev/profitfirst/practice/src/server/services/dashboard-service.ts` — `getSummary` parallel-query pattern (income received/pending aggregates, expense totals, PF summary reuse); strip bookings/commissions/ads queries and `getBadgeCounts`/`getActionItems`
- `/mnt/c/dev/profitfirst/practice/src/types/dashboard.ts` — `DashboardSummary` shape; keep `totalIncomeReceived`, `totalIncomePending`, `totalExpenses`, `netIncome`, `profitFirstAccounts`; strip rentals fields; add wallet-balance + recent-transactions fields
- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/layout.tsx` — nav shell / sidebar structure Phase 5 finalizes

### Project planning docs

- `.planning/PROJECT.md` — reference-fidelity mandate, integer cents / basis points, derived-balance rules
- `.planning/REQUIREMENTS.md` §Dashboard — DASH-01 acceptance text
- `.planning/ROADMAP.md` §"Phase 5: Dashboard" — goal + 3 success criteria
- `.planning/phases/02-income-expenses/02-CONTEXT.md` — load-more pattern (D-06), currency helper (D-08), list/filter conventions the feed reuses
- `.planning/phases/03-profit-first-allocation/03-CONTEXT.md` — derived PF balance formula, Manila date presets (D-09), nuqs URL filters (D-11), shared amount-masking component (D-07)
- `.planning/phases/04-wallets/04-CONTEXT.md` — wallet balance formula, `formatCurrency` helper (D-14), wallet detail routes the feed links to

### Codebase rules

- `CLAUDE.md` + `STANDARDS.md` + `.claude/rules/structure.md` — STRICT structure: thin route in `apps/api/src/routes/`, logic in `services/dashboard-service.ts`, Zod in `schemas/`

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `requireAuth` middleware (`apps/api/src/middleware/auth.ts`) — dashboard route mounts behind it
- BFF proxy pattern (`apps/web/src/app/api/auth/[...path]/route.ts`) + `getSession()` (`apps/web/src/server/auth.ts`) — server-component data fetching path
- Phase 3's shared **amount-masking component** (`apps/web/src/components/`) and Phase 4's **`formatCurrency`** helper (`apps/web/src/lib/`) — dashboard consumes both
- Phase 3's **date-filter presets** (Manila tz, `date-fns` + `@date-fns/tz`, `nuqs`) — reuse as the dashboard DateFilter
- shadcn/ui Card/Progress primitives, `lucide-react` icons, `sonner` — all pinned; **no new dependencies required**

### Established Patterns

- STRICT structure (hook-enforced): thin `apps/api/src/routes/dashboard.ts` → `apps/api/src/services/dashboard-service.ts` (factory `createDashboardService(db)`) → Zod `schemas/`
- Reference dashboard service runs aggregate queries in `Promise.all` and reuses the PF summary service — replicate, scoped by `userId` instead of `businessId`
- All balances derived at read time — the dashboard adds NO new tables or stored aggregates

### Integration Points

- New API route `apps/api/src/routes/dashboard.ts` mounted in `apps/api/src/index.ts` behind `requireAuth`
- Dashboard service queries Phase 2 tables (incomes, expenses), Phase 3 (profit_first_accounts + summary logic), Phase 4 (wallets, wallet_transactions, mappings)
- `apps/web/src/app/` — new `/dashboard` page inside the `(dashboard)` route group; `/` redirect; login redirect target update (Phase 1's flow); middleware guard already covers protection
- Nav shell (`(dashboard)` layout) — Phase 5 adds Dashboard entry and verifies Income/Expenses/Profit First/Wallets links

</code_context>

<specifics>
## Specific Ideas

- Reference fidelity remains the standing instruction for everything that exists in the reference dashboard (stat card styling, PF section, DateFilter, masking); the feed is the one net-new surface — keep it visually consistent with the Phase 2/4 list rows
- The wallet balance card deliberately diverges from wallet-page semantics: it is **period-scoped** (D-02), not all-time — make the period explicit in the UI so it doesn't read as a current balance

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Settings nav entry and currency selection remain Phase 6.)

</deferred>

---

_Phase: 5-dashboard_
_Context gathered: 2026-06-06_
