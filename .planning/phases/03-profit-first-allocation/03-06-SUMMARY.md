---
phase: 03-profit-first-allocation
plan: '06'
subsystem: profit-first
tags: [gap-closure, category-filter, api, frontend]
dependency_graph:
  requires: [03-05]
  provides: [PF-04-complete]
  affects:
    [
      apps/api/src/services/profit-first-service.ts,
      apps/web/src/app/(dashboard)/profit-first/page.tsx,
      apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx,
    ]
tech_stack:
  added: []
  patterns: [selectDistinct, parallel-Promise.all, RSC-prop-drilling, nuqs-string-ids]
key_files:
  modified:
    - apps/api/src/services/profit-first-service.ts
    - apps/web/src/app/(dashboard)/profit-first/page.tsx
    - apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx
    - apps/api/tests/profit-first.test.ts
decisions:
  - category list is unfiltered (ignores active date/categoryIds filters) so options stay complete when a filter is already applied
  - category ids mapped to strings in page.tsx to match nuqs parseAsArrayOf(parseAsString) contract
  - getIncomeCategories runs in parallel with the income sum and accounts queries via Promise.all
  - empty-state uses a disabled button + muted-foreground text span rather than hiding the filter control entirely
metrics:
  duration: '~10 min'
  completed: '2026-06-06'
  tasks: 2
  files: 4
---

# Phase 03 Plan 06: Category Filter Gap Closure Summary

**One-liner:** Backend-wired category filter made reachable end-to-end — getSummary now returns distinct income categories; page.tsx maps them to CategoryOption[] and passes to PfFilters, with explicit empty-state when none exist.

---

## What Was Built

### Task 1: Return distinct income categories from getSummary (TDD)

**Commit:** `72bd68c`

Extended `profit-first-service.ts` to close the backend gap:

1. `ProfitFirstSummary` type extended with `categories: Array<{ id: number; name: string }>`.
2. `getIncomeCategories(userId)` private helper added using `db.selectDistinct({ id: incomes.categoryId, name: incomes.categoryName })` scoped to `userId + RECEIVED + profitFirstAllocated`, ordered by `incomes.categoryName`. Deliberately does NOT apply date-range or categoryIds filters — the option list must show all categories regardless of the active filter.
3. `getSummary` now runs `getIncomeCategories` in the existing `Promise.all` alongside `getTotalReceivedIncome` and the accounts query.
4. Test added in `PF-04: allocation summary` block: seeds two distinct categories, two RECEIVED+allocated incomes, asserts `summary.categories` has length 2 and contains both names with correct ids.

TDD gate: test written first (RED — 1 failed, 13 passed), then implementation (GREEN — 14 passed).

### Task 2: Wire categoryOptions through page.tsx into PfFilters with empty-state

**Commit:** `75d7e2a`

Two files updated:

**`apps/web/src/app/(dashboard)/profit-first/page.tsx`:**

- Imports `CategoryOption` type from `./_components/pf-filters`
- `SummaryResponse.data` extended with `categories: Array<{ id: number; name: string }>`
- `let categoryOptions: CategoryOption[] = []` initialized before fetch
- In the `res.ok` branch: `categoryOptions = json.data.categories.map((c) => ({ id: String(c.id), label: c.name }))` — string ids for nuqs compatibility
- `<PfFilters />` changed to `<PfFilters categoryOptions={categoryOptions} />`

**`apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx`:**

- `{categoryOptions.length > 0 && <Sheet>}` pattern changed to a ternary
- When populated: existing Sheet with multi-select checkboxes (unchanged)
- When empty (`categoryOptions.length === 0`): disabled outline Button with Filter icon and `<span className="text-xs text-muted-foreground">No income categories yet</span>` — explicit visible indicator replacing the invisible dead filter

---

## Verification

- `cd apps/api && npx tsc --noEmit` — exit 0
- `cd apps/web && npx tsc --noEmit` — exit 0
- `cd apps/api && npx vitest run tests/profit-first.test.ts` — 14 passed (including new categories test)

Reasoning trace confirmed: page.tsx fetch → summary returns `categories` → `categoryOptions` mapped with string ids → PfFilters renders Sheet (populated) or disabled+empty-state (none) → selecting a category sets `categoryIds` in URL → RSC re-fetch scopes the summary.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — the category filter is fully wired end-to-end. No hollow props or placeholder data remain in the modified files.

---

## Threat Flags

No new security surface introduced beyond what the threat model covers. The `getIncomeCategories` query is scoped to `eq(incomes.userId, userId)` — T-03-06-01 mitigation applied. Category labels render as React JSX text children — T-03-06-03 XSS-safe confirmed. The existing `categoryIds` parameterized parsing in the route is unchanged — T-03-06-02 retained.

---

## Self-Check: PASSED

- `apps/api/src/services/profit-first-service.ts` — modified (categories field + getIncomeCategories helper)
- `apps/api/tests/profit-first.test.ts` — modified (new test in PF-04 block)
- `apps/web/src/app/(dashboard)/profit-first/page.tsx` — modified (categoryOptions derived and passed)
- `apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx` — modified (empty-state added)
- Commit `72bd68c` — exists (Task 1)
- Commit `75d7e2a` — exists (Task 2)
