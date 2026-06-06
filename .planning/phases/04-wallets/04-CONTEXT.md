# Phase 4: Wallets - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create wallets — **PROFIT_FIRST** (linked 1:1 to a Profit First allocation account) or **BLANK** (standalone) — map income/expense categories to wallets (each category maps to at most one wallet), toggle auto-deduct-all-expenses, record manual DEPOSIT/WITHDRAWAL transactions (editable, soft-deletable, restorable), and view computed balances: a wallet list with totals and a detail view with full balance breakdown plus paginated transaction history.

Covers requirements **WAL-01 … WAL-05**.

**Balance formula (locked, derived — never stored):** `pfAllocation + mappedIncome − mappedExpenses + deposits − withdrawals`.

**Fidelity constraint:** wallet _behavior_ must match the reference implementation at `/mnt/c/dev/profitfirst/practice` exactly, minus rentals features and multi-tenancy (`businessId` scoping becomes single-user `userId` scoping). The reference schema (`wallets`, `wallet_income_category_mappings`, `wallet_expense_category_mappings`, `wallet_transactions`) and `wallet-service.ts` (1,484 lines) are the behavioral source of truth — including conditional manual-transaction blocking by wallet type + mappings, the one-wallet-per-PF-account unique constraint, and the one-wallet-per-category unique constraints.

**Not in this phase:** dashboard (Phase 5), currency _setting_ UI (Phase 6 — but see D-14), notifications, any income/expense/PF-account CRUD (Phases 2–3). **Dependency note:** Phase 4 depends on Phases 2 (income/expense categories) and 3 (PF accounts), which are not yet built — planning must sequence after them.

</domain>

<decisions>
## Implementation Decisions

### Wallet list & balance display

- **D-01:** Wallet list is a **card grid** (reference `wallet-card.tsx` pattern) — name, color accent, type badge, total balance; negative balances styled red.
- **D-02:** Full balance breakdown (PF allocation, mapped income, mapped expenses, manual deposits, manual withdrawals) lives on the **detail page only, behind a collapsible disclosure**; zero-value rows hidden. Cards show total balance only.
- **D-03:** Wallets ordered by the **`sortOrder`** field; new wallets append at the end. (Reordering UI can be minimal — set at creation; drag-to-reorder not required.)
- **D-04:** Empty state **suggests PF wallets**: alongside the explainer + "Create wallet" CTA, offer one-click creation of a wallet for each _unlinked_ allocation account (Profit, Owner Pay, Tax, OpEx). One-click creation goes through the standard create path pre-filled — no new service behavior.

### Category mapping flow

- **D-05:** Category mapping is **inline in the wallet form** — pick categories during create; edit mappings on the wallet detail page. No separate mapping screen.
- **D-06:** Mapping conflicts are **blocked**: categories already mapped to another wallet appear disabled in the picker; the server enforces with a **409 Conflict** ("already mapped to wallet X — remove it there first"). No move/steal flow.
- **D-07:** Expense side uses the reference's **3-mode selector**: no expenses / auto-deduct ALL expenses (`autoDeductAllExpenses = true`) / specific categories. "Specific" mode validates at least one category selected.
- **D-08:** **PROFIT_FIRST wallets hide the income-category mapping section** in both create and detail (they're funded by the PF % allocation); server leaves any existing mappings untouched. Expense mapping remains available on PF wallets.

### Transaction management UX

- **D-09:** Soft-deleted transactions stay **inline in the history, greyed/strikethrough, with a one-click Restore button** (reference pattern). No hidden-behind-toggle view.
- **D-10:** Transaction history uses **page-based pagination controls** (matches reference `PaginationControls`; consistent with Phase 2 income/expense lists; use `nuqs` for URL page state).
- **D-11:** Add/edit manual transactions via **dialog/modal**: "Add deposit" / "Add withdrawal" buttons open a dialog (amount, date, description); editing a row opens the same dialog pre-filled.
- **D-12:** Deleting a manual transaction shows a **confirmation dialog** first (user's explicit choice — even though soft delete is restorable), followed by a sonner toast.

### Reference divergences

- **D-13:** **Negative balances allowed** — withdrawals are not blocked by computed balance (reference validates only amount > 0). Red styling signals overdraw.
- **D-14:** **Shared currency formatter**: build a `formatCurrency` helper in `apps/web/src/lib/` that reads a currency setting with **₱ (PHP) as default**. Phase 6 (SET-01) just flips the setting — no rework of wallet screens.
- **D-15:** Wallet **color picked from a preset palette** (8–12 curated swatches) in the wallet form; stored as a hex string, same schema as reference.
- **D-16:** Wallet deletion **cascades** (mappings + transactions hard-deleted with the wallet, per reference schema `onDelete: cascade`) with an **impact-detailing confirm dialog** that spells out what's lost (N transactions, mappings) before deleting. No soft delete for wallets.

### Claude's Discretion

- Exact card layout details, breakdown row labels, dialog field layout — follow the reference closely where it exists, shadcn/ui conventions otherwise.
- Page size for transaction pagination (align with whatever Phase 2 establishes).
- Exact preset palette colors (legible on light backgrounds; include the reference's defaults like `#10b981`).
- Manual-transaction blocking _messages_ per wallet mode — reuse the reference's explainer copy (PF wallets block manual deposits; income+expense-mapped wallets block both; income-mapped block deposits; expense-mapped block withdrawals).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference implementation (behavioral source of truth — fidelity required)

- `/mnt/c/dev/profitfirst/practice/src/server/services/wallet-service.ts` — ALL wallet behavior: balance computation helpers, mapping conflict checks (`setIncomeCategoryMappings`, `setExpenseMappings`), `assertCanInsertTransaction` blocking rules, CRUD + transaction methods (`list`, `getById`, `create`, `update`, `remove`, `createTransaction`, `updateTransaction`, `removeTransaction`, `restoreTransaction`, `hasWalletForPfAccount`)
- `/mnt/c/dev/profitfirst/practice/src/server/db/schema.ts` §Wallets (lines ~482–585) — `wallets`, `wallet_income_category_mappings`, `wallet_expense_category_mappings`, `wallet_transactions` tables, unique indexes (one wallet per PF account; one wallet per category). Strip `businessId` → scope by `userId`.
- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/wallets/` — UI reference: `page.tsx` (list), `_components/wallet-card.tsx`, `new/_components/new-wallet-form.tsx` (3-mode expense selector, disabled mapped categories, PF income-section hiding), `[walletId]/_components/wallet-detail.tsx` (collapsible breakdown, inline restore, mode explainer copy)

### Project planning docs

- `.planning/PROJECT.md` — Reference Implementation section (wallet mechanics summary), locked Key Decisions (integer cents, basis points, derived balances), constraints
- `.planning/REQUIREMENTS.md` §Wallets — WAL-01…WAL-05 acceptance text
- `.planning/ROADMAP.md` §"Phase 4: Wallets" — goal + 5 success criteria
- `.planning/phases/01-authentication/01-CONTEXT.md` — established BFF proxy, structure, and auth patterns that wallet routes inherit

### Codebase maps & rules

- `.planning/codebase/STRUCTURE.md` + `CLAUDE.md` + `STANDARDS.md` — STRICT folder rules (routes thin / `services/` / `schemas/` / `lib/`), path aliases, error shape

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/api/src/middleware/auth.ts` (`requireAuth`) — wallet routes are all authenticated; reuse as in Phase 1
- `apps/web/src/app/api/auth/[...path]/route.ts` — BFF proxy pattern with transparent refresh; wallet API calls follow the same browser → Next.js → Hono path
- shadcn/ui stack (`components.json`, `cn` in `apps/web/src/lib/utils.ts`), `sonner` (toasts), `nuqs` (URL pagination state), `cmdk` (searchable category picker), `date-fns` — all pinned and available
- Phase 2 will establish pagination + list patterns and category CRUD; Phase 3 establishes PF accounts — wallets consume both

### Established Patterns

- STRICT structure (PreToolUse-enforced): routes in `apps/api/src/routes/wallets.ts` (thin), business logic in `apps/api/src/services/wallet-service.ts`, Zod schemas in `apps/api/src/schemas/wallets.ts`
- Single Drizzle schema source of truth at `packages/db/src/schema.ts`; migrations via Drizzle Kit (`/run-migrations`)
- Service factory pattern: reference uses `createWalletService(db)` — consistent with framework-agnostic services rule
- Money as integer cents; soft delete via `deletedAt` text column (same as expenses)

### Integration Points

- **Schema additions** in `packages/db/src/schema.ts`: 4 new tables (wallets, two mapping tables, wallet_transactions) — port reference definitions, replace `businessId` FKs with `userId` → `users.id`, keep unique indexes (`userId + profitFirstAccountId` unique; `incomeCategoryId` unique; `expenseCategoryId` unique)
- **Cross-phase coupling**: PF-account deletion guard ("cannot delete an account linked to a wallet", PF-03) lands in Phase 3 but is only testable once wallets exist — Phase 4 must verify it
- **Balance computation** needs income (RECEIVED + allocated, by category) and expense aggregates from Phase 2 tables, plus PF percentages from Phase 3 — wallet service queries across all of them
- New API surface: `apps/api/src/routes/wallets.ts` mounted in `apps/api/src/index.ts`; web pages under `apps/web/src/app/` (likely a `(dashboard)` group once one exists)

</code_context>

<specifics>
## Specific Ideas

- "Exactly like the reference, minus rentals/tenancy" is the standing instruction — when in doubt about wallet behavior, read `wallet-service.ts` rather than inventing
- Empty-state PF wallet suggestions (D-04) is the one deliberate UX addition beyond the reference — keep it thin (pre-filled create, no new service logic)
- Delete flows skew cautious: confirm dialog for transactions (D-12) and impact-detailing confirm for wallets (D-16)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Currency _selection_ UI remains Phase 6; D-14 only builds the shared formatter with a ₱ default.)

</deferred>

---

_Phase: 4-wallets_
_Context gathered: 2026-06-06_
