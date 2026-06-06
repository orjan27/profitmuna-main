# Phase 3: Profit First Allocation - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can configure Profit First allocation accounts and view derived balance summaries:

- Four default accounts seeded per user — Profit 5%, Owner Pay 50%, Tax 15%, Operating Expenses 30% (types PROFIT / OWNERS_PAY / TAX / OPEX; stored as basis points: 500/5000/1500/3000)
- Update allocation percentages via a bulk editor validated to sum to exactly 100% (10000 bp)
- Create/edit/delete CUSTOM accounts (name, target %, color, sortOrder); default accounts not deletable; accounts linked to a wallet not deletable
- Allocation summary with **derived** per-account balances: `totalReceivedAllocatedIncome × targetPercentage / 10000`, filterable by date range and income category

Covers requirements **PF-01 … PF-04**. Depends on Phase 2 (income with RECEIVED status + `profitFirstAllocated` flag and income categories must exist).

**Not in this phase:** wallets (Phase 4 — but the delete-guard contract matters, see decisions), dashboard widgets (Phase 5), currency setting (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Default Account Seeding

- **D-01:** Defaults are seeded **at registration** — a shared service function called from BOTH the email/password registration path AND the Google OAuth first-login (account-creation) path. Mirrors the reference's seed-on-business-create, with user replacing business.
- **D-02:** **One-time data migration backfills** the four default accounts for any user who registered before this phase ships (Phase 1 users). Production-safe, runs once at deploy.
- **D-03:** Seed values replicate the reference exactly: Profit 500 bp `#10b981` sort 0 PROFIT; Owner Pay 5000 bp `#8b5cf6` sort 1 OWNERS_PAY; Tax 1500 bp `#f59e0b` sort 2 TAX; Operating Expenses 3000 bp `#f43f5e` sort 3 OPEX (see reference `seed.ts`).

### Sum-to-100% Validation Semantics

- **D-04:** **Replicate the reference exactly:**
  - Bulk percentage editor (`updatePercentages`): rejects unless submitted set totals exactly 10000 bp
  - Create account: rejects only if adding would _exceed_ 10000 bp (total may sit below 100% afterward)
  - Single-account edit: rejects only if new value + other accounts would exceed 10000 bp
  - Deleting a custom account may leave the total under 100% — user rebalances afterward in the bulk editor
- **D-05:** Defaults (non-CUSTOM types) are **not deletable**; any account **linked to a wallet** is not deletable. Wallets don't exist until Phase 4 — the wallet-linkage guard should be written so Phase 4 can activate it (planner decides: stub now vs add check in Phase 4; deviation from reference's wallet check must be flagged).

### Percentage Editor & Summary UI

- **D-06:** **Replicate the reference page layout**, rebuilt with Profitmuna's shadcn/ui primitives: account cards with color accent, target %, derived balance, progress bar, per-account edit/delete dropdown; bulk percentage editor with live total; account create/edit dialog. (Reference components: `pf-overview.tsx`, `pf-percentage-editor.tsx`, `pf-account-form.tsx`.)
- **D-07:** Include the **amount-visibility (masking) toggle** in this phase, built as a **shared component** (`apps/web/src/components/`) — income/expense/wallet pages will reuse it. Mirrors reference `amount-visibility.tsx` (MaskedAmount / AmountToggle).
- **D-08:** Custom-account colors come from a **preset swatch palette** replicated from the reference's `PF_DEFAULT_COLORS` — no free hex input.

### Summary Filters

- **D-09:** Date-range presets replicate the reference: This Month, Last Month, Last 3 Months, This Year, All Time — computed in **Asia/Manila** timezone (reference `nowManila()`; `date-fns` + `@date-fns/tz` already pinned).
- **D-10:** Income-category filter is **multi-select** (IN-list filter in the summary query, matching the reference service); default = all categories. Rental unit/ownership filters from the reference are stripped.
- **D-11:** Filter state (date range, categories) lives in **URL search params via `nuqs`** (already pinned) — refresh-safe and shareable, matching the reference's searchParams-driven approach.

### Claude's Discretion

- Exact wallet-guard implementation timing (stub in Phase 3 vs activate in Phase 4) — flag the choice in the plan
- API route shape under `apps/api/src/routes/` (e.g., `profit-first.ts` with GET summary, POST/PATCH/DELETE accounts, PUT percentages) — follow reference service surface: `getSummary`, `createAccount`, `updateAccount`, `deleteAccount`, `updatePercentages`
- Error-message wording (reference messages are good templates: "Percentages must total 100%. Current total: X%")
- Whether `fromCents` conversion happens API-side (as in reference) or web-side — keep money as integer cents in DB and transport per project convention

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs

- `.planning/PROJECT.md` — locked decisions: integer cents + basis points, derived (never stored) balances, single-user (reference `businessId` scoping becomes `userId`), reference-fidelity constraint
- `.planning/REQUIREMENTS.md` §Profit First — PF-01…PF-04 acceptance text
- `.planning/ROADMAP.md` §"Phase 3: Profit First Allocation" — goal + 4 success criteria

### Reference implementation (fidelity source of truth)

- `/mnt/c/dev/profitfirst/practice/src/server/services/profit-first-service.ts` — THE behavioral contract: summary computation, validation semantics, balance formula `Math.round((totalIncomeCents * targetPercentage) / 10000)`, parallel-query patterns
- `/mnt/c/dev/profitfirst/practice/src/server/db/schema.ts` §profitFirstAccounts — table shape: name, targetPercentage (bp), color, sortOrder, accountType enum, unique(scope, name) index
- `/mnt/c/dev/profitfirst/practice/src/server/db/seed.ts` §seedProfitFirstAccounts — exact default values
- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/profit-first/` — page + `_components/` (pf-overview, pf-percentage-editor, pf-account-form, pf-filters) — UI layout to replicate
- `/mnt/c/dev/profitfirst/practice/src/components/shared/amount-visibility.tsx` — masking toggle to replicate as shared component

### Prior phase context

- `.planning/phases/01-authentication/01-CONTEXT.md` — BFF proxy pattern (D-01…D-03), registration paths that must call the seeding function
- Phase 2 CONTEXT/plans (when they exist) — income schema this phase aggregates over (`moneyStatus = 'RECEIVED'`, `profitFirstAllocated = 1`, `incomeDate`, `categoryId`)

### Codebase rules

- `CLAUDE.md` + `STANDARDS.md` + `.claude/rules/structure.md` — STRICT structure: routes thin in `apps/api/src/routes/`, logic in `services/`, Zod in `schemas/`, schema in `packages/db/src/schema.ts`

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/api/src/middleware/auth.ts` — auth guard for the new PF routes
- `apps/api/src/services/auth-service.ts` — registration + Google first-login code paths where the seeding call hooks in
- `apps/web/src/app/api/auth/[...path]` BFF proxy pattern — extend/replicate for PF API calls
- shadcn/ui setup (`components.json`) + `cn` utility — UI primitives for cards, dialogs, progress
- Pinned deps already cover everything needed: `date-fns` + `@date-fns/tz` (Manila presets), `nuqs` (URL filter state), `sonner` (toasts), `zod` + `@hono/zod-validator` (validation). **No new dependencies required.**

### Established Patterns

- STRICT structure (PreToolUse-enforced): route handlers thin, business logic in `services/profit-first-service.ts`, Zod schemas in `schemas/`, DB only via `@app/db`
- Single Drizzle schema source of truth in `packages/db/src/schema.ts`; migrations via Drizzle Kit (`/run-migrations`) — the backfill migration (D-02) follows this path
- Reference service pattern: factory `createProfitFirstService(db)` returning method object — matches Profitmuna's service style

### Integration Points

- `packages/db/src/schema.ts`: new `profit_first_accounts` table — reference shape minus `businessId`, plus `userId` FK; unique index on (userId, name)
- Depends on Phase 2's `incomes` table (`moneyStatus`, `profitFirstAllocated`, `incomeDate`, `categoryId`, amount in cents) and `income_categories` — Phase 2 has no plans yet; if schemas drift, the summary query is the contact point
- `apps/api/src/routes/`: new `profit-first.ts` route file registered in `apps/api/src/index.ts`
- `apps/web/src/app/`: new authenticated profit-first page (dashboard shell may be established by Phase 2 — coordinate)

</code_context>

<specifics>
## Specific Ideas

- Fidelity to the reference is the dominant theme: every decision defaulted to "replicate reference" — validation semantics, UI layout, seed values, color palette, Manila timezone, multi-select filters
- The balance formula is exact and non-negotiable: `Math.round((totalReceivedAllocatedIncomeCents × targetPercentage) / 10000)`, where only `RECEIVED` + `profitFirstAllocated` income counts
- Amount-masking toggle is wanted app-wide eventually — build it shared from day one

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Wallet linkage enforcement activates fully in Phase 4; currency display setting remains in Phase 6.)

</deferred>

---

_Phase: 3-profit-first-allocation_
_Context gathered: 2026-06-06_
