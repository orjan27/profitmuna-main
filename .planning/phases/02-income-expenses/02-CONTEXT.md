# Phase 2: Income & Expenses - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A full vertical slice for recording and managing income and expenses, mirroring the reference implementation (minus rentals/tenancy):

- **DB:** `income_categories`, `incomes`, `expense_categories`, `expenses` tables in `packages/db/src/schema.ts` (per-user via `userId`, replacing the reference's `businessId`)
- **API:** Hono routes + services + Zod schemas for income CRUD (incl. `PUT /:id/receive`), expense CRUD (incl. soft delete + `PATCH /:id/restore`), and category CRUD for both
- **UI:** income and expense list pages with search/filters/load-more, `/new` pages, edit dialogs, receive-income dialog, category management

Covers requirements **INC-01 … INC-06** and **EXP-01 … EXP-05**.

**Not in this phase:** Profit First allocation accounts/summaries (Phase 3), wallets (Phase 4), dashboard (Phase 5), currency setting & notifications (Phase 6). Income written here must carry the `profitFirstAllocated` flag and PENDING/RECEIVED status so Phase 3 can consume it — but no allocation math happens in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Default Categories & Seeding

- **D-01:** Default income categories (system, protected): **Salary, Freelance, Business, Gifts, Other** — personal-flavored, replacing the reference's rental-specific set.
- **D-02:** Default expense categories (system, protected): **Housing, Food, Transportation, Utilities, Healthcare, Entertainment, Other**.
- **D-03:** **Drop the reference's income-category `type` enum** (`CAPITAL`/`LOAN`/`BOOKING_REVENUE`/…). Categories are just `name` + `system` flag (+ `userId`). Nothing downstream needs the type.
- **D-04:** **Lazy idempotent seeding**: defaults are check-and-seeded when a user first hits income/expense endpoints. One mechanism covers existing Phase 1 users and all future signup paths (email + Google). No registration hook, no backfill migration.

### List & Form UX

- **D-05:** **Match the reference layout**: separate `/income/new` and `/expenses/new` pages for adding; editing happens in a **dialog** opened from the list row.
- **D-06:** Lists use a **"Load more" button** (append on demand) — not numbered pages, not infinite scroll. Changing search/filters resets the loaded list.
- **D-07:** Income list search is **debounced live search (~300ms)** across description and category name; combined with status and date-range filters (INC-02). Expense list filters by date range (EXP-02).
- **D-08:** Interim currency display is **hardcoded ₱**, implemented through a **single formatting helper in `apps/web/src/lib/`** (cents → display string) so the Phase 6 user-selectable currency swap is a one-line change. Amount inputs accept decimal pesos and convert to integer cents.

### Payment Methods (expenses)

- **D-09:** Fixed list, **exact reference fidelity**: Cash, GCash, Bank Transfer, Maya, Check (`cash`, `gcash`, `bank_transfer`, `maya`, `check`).
- **D-10:** Payment method is **optional, but validated**: the API Zod schema accepts only the 5 known values when provided (reference allowed any string; we tighten it). Stored as nullable text.

### Category Management

- **D-11:** Categories are managed **where they're used**: a "manage categories" dialog reachable from the income/expense pages, plus a quick "+ new category" affordance inside the record forms. No dedicated categories page.
- **D-12:** **Deleting a category that has transactions is blocked** with an error directing the user to reassign/delete those records first. System categories are never deletable (reference behavior). No dangling `categoryId`.
- **D-13:** **Renaming a category cascades**: the denormalized `categoryName` on existing income/expense rows is updated so lists stay consistent with the dropdown.
- **D-14:** **Receive income via confirm dialog**: the "Receive" action on a PENDING income opens a small dialog with received date defaulting to today (editable for backdating), then confirms — sets `receivedDate`, flips `moneyStatus` to RECEIVED.

### Claude's Discretion

- Soft-deleted expense surfacing/restore UI (e.g., "show deleted" toggle + restore action) — pick a sensible pattern consistent with the reference's `PATCH /:id/restore`.
- Empty states, loading skeletons, overview/totals headers on list pages — follow the reference where it has them.
- Exact Zod limits (description length, max amount), index choices, and pagination page size.
- Whether income hard-delete shows a confirm dialog (recommended: yes).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs

- `.planning/PROJECT.md` — Reference-fidelity mandate, money-as-cents / basis-points rules, locked Key Decisions, out-of-scope list
- `.planning/REQUIREMENTS.md` §Income, §Expenses — INC-01…06, EXP-01…05 acceptance text
- `.planning/ROADMAP.md` §"Phase 2: Income & Expenses" — goal + 5 success criteria
- `.planning/phases/01-authentication/01-CONTEXT.md` — BFF proxy, auth middleware, and session decisions this phase builds on

### Reference implementation (PRIMARY fidelity source)

- `/mnt/c/dev/profitfirst/practice/src/server/db/schema.ts` — `incomeCategories`, `incomes`, `expenseCategories`, `expenses` table shapes (lines ~304–405); replace `businessId` with `userId`, drop `bookingId`/`unitId`/category `type`
- `/mnt/c/dev/profitfirst/practice/src/server/services/income-service.ts` + `income-category-service.ts` — income CRUD, receive transition, category protection logic
- `/mnt/c/dev/profitfirst/practice/src/server/services/expense-service.ts` + `expense-category-service.ts` — expense CRUD, soft delete/restore, `resolveCategoryName` pattern
- `/mnt/c/dev/profitfirst/practice/src/server/routes/income.ts`, `income-categories.ts`, `expenses.ts`, `expense-categories.ts` — route surface to replicate (GET/POST/PUT, `PUT /:id/receive`, `DELETE`, `PATCH /:id/restore`)
- `/mnt/c/dev/profitfirst/practice/src/app/(dashboard)/income/` and `expenses/` — page/dialog/filter component structure to mirror
- `/mnt/c/dev/profitfirst/practice/src/lib/constants.ts` — `PAYMENT_METHODS` (lines 136–142): cash, gcash, bank_transfer, maya, check

### Codebase maps & standards

- `.planning/codebase/STRUCTURE.md` + `CLAUDE.md` + `.claude/rules/structure.md` — STRICT folder rules (routes/services/schemas/lib split, hook-enforced)
- `STANDARDS.md` — naming, error shape `{ error: { code, message, details? } }`, validation conventions

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `requireAuth` middleware (`apps/api/src/middleware/auth.ts`) — every Phase 2 route mounts behind it; user id from the verified access token replaces the reference's `businessId` scoping
- BFF proxy (`apps/web/src/app/api/auth/[...path]/route.ts`) — pattern for browser → Next.js → Hono calls with transparent refresh; Phase 2 either extends it to a general API proxy or follows the same pattern
- `getSession()` (`apps/web/src/server/auth.ts`) — server-component session access for protected pages
- shadcn/ui setup + `cn` util — list tables, dialogs, selects, date inputs build on existing primitives
- Pinned-but-unused deps ready for this phase: `@tanstack/react-table` (lists), `nuqs` (filter state in URL), `date-fns` (+ `@date-fns/tz`), `sonner` (toasts)

### Established Patterns

- Thin routes → `services/` business logic → Zod `schemas/` per resource (auth.ts files in each dir show the pattern)
- Drizzle schema single source of truth in `packages/db/src/schema.ts`; D1 with FK references, ISO-string dates, `$defaultFn(() => new Date().toISOString())` timestamps; migrations via Drizzle Kit (`/run-migrations`)
- Service factory style in reference (`createIncomeService(db)`) aligns with existing `auth-service.ts` structure

### Integration Points

- `packages/db/src/schema.ts` — add 4 tables, all FK'd to `users.id` (integer autoincrement)
- `apps/api/src/index.ts` — mount new route groups (e.g., `/api/incomes`, `/api/income-categories`, `/api/expenses`, `/api/expense-categories`) behind `requireAuth`
- `apps/web/src/app/` — new authenticated pages: income list/new, expenses list/new (middleware redirect guard already covers protection)
- Phase 3 dependency: `incomes.moneyStatus`, `receivedDate`, `profitFirstAllocated` must match reference semantics exactly — allocation math reads them

</code_context>

<specifics>
## Specific Ideas

- **Reference fidelity is the standing instruction**: when a Phase 2 behavior question isn't answered by the decisions above, do what `/mnt/c/dev/profitfirst/practice` does (minus rentals/tenancy fields)
- Deviations from reference explicitly chosen here: generic personal category defaults (D-01/D-02), dropped category `type` (D-03), load-more instead of reference pagination (D-06), Zod-validated payment methods (D-10), block-delete-in-use categories (D-12)
- ₱ display matches the reference's hardcoded peso prefix until Phase 6

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Currency setting remains Phase 6; allocation consumption of RECEIVED income remains Phase 3.)

</deferred>

---

_Phase: 2-income-expenses_
_Context gathered: 2026-06-06_
