---
phase: 03-profit-first-allocation
plan: '03'
subsystem: profit-first-ui
tags: [ui, nextjs, shadcn, nuqs, rsc, amount-masking, filters]
dependency_graph:
  requires: [03-02, phase-01-auth]
  provides:
    [
      (dashboard)/layout.tsx minimal shell,
      /profit-first RSC page,
      PfOverview account cards,
      PfFilters date-range + category,
      PfContent client boundary,
      useAmountVisibility hook,
      AmountToggle,
      MaskedAmount,
      9 shadcn primitives,
    ]
  affects: [apps/web root layout (TooltipProvider), eslint.config.mjs (workspace .next/ ignore)]
tech_stack:
  added: []
  patterns:
    [
      RSC direct API fetch with Bearer cookie,
      client-boundary wrapper pattern (PfContent owns visibility state),
      nuqs useQueryState URL filter state,
      TZDate Manila timezone presets,
      localStorage-backed amount masking with mounted hydration guard,
    ]
key_files:
  created:
    - apps/web/src/app/(dashboard)/layout.tsx
    - apps/web/src/app/(dashboard)/profit-first/page.tsx
    - apps/web/src/app/(dashboard)/profit-first/loading.tsx
    - apps/web/src/app/(dashboard)/profit-first/_components/pf-overview.tsx
    - apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx
    - apps/web/src/app/(dashboard)/profit-first/_components/pf-content.tsx
    - apps/web/src/components/amount-visibility.tsx
    - apps/web/src/components/ui/dialog.tsx
    - apps/web/src/components/ui/select.tsx
    - apps/web/src/components/ui/badge.tsx
    - apps/web/src/components/ui/separator.tsx
    - apps/web/src/components/ui/sheet.tsx
    - apps/web/src/components/ui/checkbox.tsx
    - apps/web/src/components/ui/dropdown-menu.tsx
    - apps/web/src/components/ui/progress.tsx
    - apps/web/src/components/ui/tooltip.tsx
  modified:
    - apps/web/src/app/layout.tsx (TooltipProvider added)
    - eslint.config.mjs (apps/**/.next/ ignore added)
decisions:
  - RSC page.tsx fetches direct to API_BASE_URL (not BFF proxy) — server-to-server avoids unnecessary hop
  - PfContent is a thin client wrapper that owns useAmountVisibility state and passes visible/mounted to PfOverview
  - Category multi-select renders only when categoryOptions.length > 0 — Phase 2 provides full labels
  - eslint.config.mjs updated to add apps/**/.next/ ignore (pre-existing ESLint 9 flat config workspace resolution gap)
  - useQueryState + router.refresh() pattern chosen over nuqs shallow routing for RSC re-fetch
metrics:
  duration: '~30 min'
  completed: '2026-06-06'
  tasks_completed: 2
  files_modified: 18
---

# Phase 03 Plan 03: Profit First View UI Summary

Filterable allocation summary page with account cards (color accents, derived balances, progress bars), maskable amounts persisted across reloads, and Manila timezone date-range + category filters backed by URL state via nuqs — on top of the Plan 02 API.

## Tasks Completed

| Task | Name                                                                              | Commit  | Files                           |
| ---- | --------------------------------------------------------------------------------- | ------- | ------------------------------- |
| 1    | Install shadcn primitives + dashboard layout + amount-visibility shared component | 7100ca1 | 14 files                        |
| 2    | Profit-first RSC page + loading + overview cards + filters                        | 8a13555 | 6 files + eslint.config.mjs fix |

## What Was Built

### Task 1: Shadcn Primitives, Dashboard Layout, Amount Visibility

**Shadcn primitives installed (all from official registry):** dialog, select, badge, separator, sheet, checkbox, dropdown-menu, progress, tooltip — added to `apps/web/src/components/ui/`.

**Root layout updated:** `TooltipProvider` wrapper added around `NuqsAdapter` + `Toaster` in `apps/web/src/app/layout.tsx` (required by shadcn tooltip per its install output).

**`apps/web/src/app/(dashboard)/layout.tsx`** — minimal authenticated dashboard shell:

- Renders `{children}` inside a `<main>` with page padding tokens (pt-12 pb-16 px-4 md:px-8, max-w-7xl centered)
- Auth is enforced by `middleware.ts` (redirects to /login) — layout does NOT re-implement the guard
- Phase 5 extends this layout with sidebar nav when it ships

**`apps/web/src/components/amount-visibility.tsx`** — shared masking component (`'use client'`):

- `useAmountVisibility()` — returns `{ visible: mounted && visible, toggle, mounted }`; default visible=false; `mounted` set in `useEffect`; reads/writes localStorage key `'pf-amounts-visible'`
- `AmountToggle` — icon button (Eye/EyeOff lucide icons, `aria-label`, 44px touch target, shadcn Tooltip)
- `MaskedAmount` — renders `formatCurrency(cents)` when `mounted && visible`, else `••••••` in same slot; SSR always renders masked to prevent hydration mismatch (Pitfall 7 guard: `mounted && visible`)

### Task 2: RSC Page, Loading, Overview Cards, Filters

**`apps/web/src/app/(dashboard)/profit-first/page.tsx`** — async RSC:

- Awaits `searchParams: Promise<{ from?, to?, categoryIds? }>`
- Reads `access_token` cookie via `cookies()` for server-side auth
- Fetches DIRECT to `${process.env.API_BASE_URL}/api/profit-first/summary` with `Authorization: Bearer` header (NOT through BFF proxy — server-to-server avoids unnecessary hop; BFF reserved for client-side fetches/Plan 04 server actions)
- `cache: 'no-store'` ensures fresh balances on every render (T-03-08)
- Zero nuqs hooks (Pitfall 5 guard — `grep "useQueryState" page.tsx` returns 0)
- Page heading "Profit First" and sub-heading "Configure allocation percentages and track your income distribution."
- Composes `<PfFilters />` (client) + `<PfContent>` (client boundary)

**`apps/web/src/app/(dashboard)/profit-first/loading.tsx`** — Suspense skeleton:

- Skeleton card grid matching 2-col md / 1-col mobile layout (4 card skeletons + header + filter bar skeletons)

**`apps/web/src/app/(dashboard)/profit-first/_components/pf-content.tsx`** (`'use client'`):

- Thin client boundary that owns `useAmountVisibility` state
- Renders `AmountToggle` + `PfOverview`, passing `visible`/`mounted` down
- Allows the RSC page to pass server-fetched data to client components without lifting state into the RSC

**`apps/web/src/app/(dashboard)/profit-first/_components/pf-overview.tsx`** (`'use client'`):

- 2-col grid on md+, 1-col on mobile
- Each card: 4px left `borderLeft` in account `color` hex; `CardTitle` (account name, text content only — T-03-06 XSS guard); type `Badge` (variant="secondary") for non-CUSTOM accounts; "Target: N%"; `MaskedAmount` in Display slot (28px semibold); `Progress` bar (value=targetPercentage); "of {total} total received income"
- Per-account `DropdownMenu` with `aria-label="Account options"` trigger (⋮); Edit + Delete items; Delete is `disabled` for non-CUSTOM accounts (D-05 guard); Plan 04 Task 2 wires the handlers
- Empty state: "No allocation accounts yet" heading + body per UI-SPEC Copywriting

**`apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx`** (`'use client'`):

- 5 Manila-timezone date-range preset buttons computed via `TZDate` from `@date-fns/tz` (RESEARCH Pattern 6)
- Active preset shows `variant="default"` (filled); unselected shows `variant="outline"`
- Category multi-select in a `Sheet` with `Checkbox` list — renders only when `categoryOptions.length > 0`
- `from`, `to`, `categoryIds` persisted in URL via `useQueryState` / `parseAsArrayOf(parseAsString)` (nuqs D-11)
- `router.refresh()` on any change triggers RSC re-fetch to update derived balances

## Deviations from Plan

### Deviation 1: pf-content.tsx client boundary wrapper not in plan files list

**Found during:** Task 2 implementation
**Issue:** The plan listed only `page.tsx`, `loading.tsx`, `pf-overview.tsx`, `pf-filters.tsx`. However, composing `useAmountVisibility` (a client hook) with the RSC page requires a client boundary component. Without `pf-content.tsx`, the RSC would need to import `useAmountVisibility` directly — which would fail at runtime (hooks in RSC).
**Fix:** Added `apps/web/src/app/(dashboard)/profit-first/_components/pf-content.tsx` as a thin client boundary wrapper that owns visibility state and passes it to `PfOverview` and `AmountToggle`. This is the canonical Next.js App Router pattern for composing client state with RSC-passed data.
**Rule:** Rule 2 — missing critical functionality for correct RSC/client boundary operation.

### Deviation 2: eslint.config.mjs workspace .next/ ignore fix

**Found during:** Task 2 verification (lint step)
**Issue:** Pre-existing bug — `npm run lint` via turbo ran `eslint .` from `apps/web/`, but the root `eslint.config.mjs` `ignores` entry `'.next/'` resolved relative to the project root (not the workspace directory). This meant `apps/web/.next/` build artifacts were linted, producing hundreds of false errors.
**Fix:** Added `'apps/**/.next/'` to the `ignores` array in `eslint.config.mjs`. This is an ESLint 9 flat config behavior: all `ignores` patterns resolve relative to the config file location (project root), so workspace sub-paths require explicit glob prefixes.
**Files modified:** `eslint.config.mjs`
**Rule:** Rule 3 — pre-existing blocking issue that prevented the `npm run lint` verification step from passing.

### Deviation 3: Category filter placeholder (Phase 2 stub)

**Found during:** Task 2 implementation
**Issue:** The plan noted that income_categories labels are a Phase 2 artifact. `PfFilters` receives `categoryOptions?: CategoryOption[]` defaulting to `[]` — the category multi-select sheet is conditionally rendered only when options are available.
**Impact:** The category sheet does not appear until Phase 2 provides the category list. Date-range filters work fully. This matches the plan's NOTE exactly.
**Rule:** No deviation — plan explicitly acknowledged this and instructed to flag in SUMMARY.

## Verification Results

- `cd apps/web && npx tsc --noEmit`: exits 0
- `npm run lint`: 1 successful, 1 cached — all workspaces pass
- All acceptance criteria verified:
  - 9 shadcn components exist in `apps/web/src/components/ui/`
  - `(dashboard)/layout.tsx` exists with default export rendering `{children}`
  - `amount-visibility.tsx` exports `useAmountVisibility`, `AmountToggle`, `MaskedAmount`; `grep "mounted && visible"` returns 4 occurrences
  - `page.tsx` awaits searchParams; fetches `API_BASE_URL/api/profit-first/summary` directly; 0 nuqs hooks
  - `pf-filters.tsx`: `useQueryState` count ≥ 1; `TZDate` count ≥ 1
  - `pf-overview.tsx`: imports `MaskedAmount`; `Progress` present; empty-state copy present; `aria-label="Account options"` present
  - Page heading "Profit First" + sub-heading present

## Known Stubs

- **Category multi-select options:** `PfFilters` renders the category sheet only when `categoryOptions.length > 0`. The RSC page passes an empty array because income_categories labels are a Phase 2 artifact. Full category labels will be provided in Phase 2 when the income_categories table is seeded and the summary response includes category metadata. Does not block the plan's goal — date-range filtering is fully functional.
- **Per-account dropdown Edit/Delete handlers:** `DropdownMenu` in `pf-overview.tsx` has the shell (trigger + items) but handlers are wired by Plan 04 Task 2. Both Edit and Delete items are currently `disabled`. Does not affect the "user can see allocations" PF-04 requirement of this plan.

## Threat Surface Scan

| Flag                             | File                                               | Description                                                                                                                                                                |
| -------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| threat_flag: server-fetch-bearer | apps/web/src/app/(dashboard)/profit-first/page.tsx | SSR fetch forwards access_token Bearer to API — T-03-09 (unauthenticated users redirected by middleware.ts before page renders; server-side only, never exposed to client) |
| threat_flag: localStorage-client | apps/web/src/components/amount-visibility.tsx      | localStorage stores visibility preference only (not financial data) — T-03-08 mitigated (balances always from server fetch, never client-cached)                           |

All flagged surfaces are covered by the plan's threat model (T-03-06, T-03-08, T-03-09, T-03-10).

## Self-Check: PASSED
