---
phase: quick-260606-tln
plan: '01'
subsystem: web/navigation
tags: [navigation, layout, route-groups, next.js, client-component]
dependency_graph:
  requires: []
  provides: [shared-nav-shell, dashboard-route-group]
  affects: [apps/web/src/app/(dashboard), apps/web/src/components]
tech_stack:
  added: []
  patterns: [sticky-nav, server-component-shell-with-client-nav, route-group-colocation]
key_files:
  created:
    - apps/web/src/components/DashboardNav.tsx
  modified:
    - apps/web/src/app/(dashboard)/layout.tsx
    - apps/web/src/app/(dashboard)/income/ (moved from apps/web/src/app/income/)
    - apps/web/src/app/(dashboard)/expenses/ (moved from apps/web/src/app/expenses/)
    - .planning/ROADMAP.md
decisions:
  - "DashboardNav uses prefix match (pathname.startsWith(href + '/')) for multi-segment routes (Income, Expenses, Profit First, Wallets) so /income/new highlights the Income link"
  - "Exact match used for Dashboard (/) only, to avoid '/' matching every pathname"
  - 'Layout main top padding reduced from pt-12 to pt-4 — sticky nav bar takes ~48px vertical space'
  - 'No logout/auth control added — plan constraint; links only'
  - 'Route groups are URL-transparent: /income and /expenses URLs unchanged after move into (dashboard)'
metrics:
  duration: ~10 min
  completed: '2026-06-06'
  tasks_completed: 3
  files_changed: 24
---

# Phase quick-260606-tln Plan 01: Add Shared Navbar to Authenticated App Shell

**One-liner:** Sticky horizontal nav (DashboardNav, client component) wired into the (dashboard) Server Component layout with usePathname active-state highlighting for five links.

## Tasks Completed

| Task | Name                                                       | Commit    | Files                                         |
| ---- | ---------------------------------------------------------- | --------- | --------------------------------------------- |
| 1    | Move /income and /expenses into (dashboard) route group    | `424968d` | 22 files renamed via git mv                   |
| 2    | Create DashboardNav and wire into layout                   | `14fb3e6` | DashboardNav.tsx (new), layout.tsx (modified) |
| 3    | Update layout comment and ROADMAP Phase 5 success criteria | `f4f0c07` | .planning/ROADMAP.md                          |

## What Was Built

- **DashboardNav.tsx** (`apps/web/src/components/DashboardNav.tsx`) — `'use client'` component with five nav links (Dashboard, Income, Expenses, Profit First, Wallets), `usePathname` for active detection, lucide-react icons, `cn`-based Tailwind active/inactive styling, sticky top bar with backdrop blur, horizontally scrollable on mobile.
- **Updated (dashboard)/layout.tsx** — imports and renders `<DashboardNav />` as the top sticky bar; remains a Server Component (no `'use client'`); main content area padding adjusted to `pt-4`.
- **Route group move** — `apps/web/src/app/income/` and `apps/web/src/app/expenses/` fully relocated to `apps/web/src/app/(dashboard)/income/` and `apps/web/src/app/(dashboard)/expenses/` via `git mv`. URLs /income, /income/new, /expenses, /expenses/new are unchanged (route groups are URL-transparent). All 22 files preserved; no content edits needed (all imports use `@/*` aliases or co-located `./` relative paths).
- **ROADMAP Phase 5** — new success criterion 4 added: all authenticated pages share a navigation shell with links including a future Settings link once Phase 6 ships.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale .next/types cache caused false tsc errors**

- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** `.next/types/app/expenses/` and `.next/types/app/income/` still referenced the old pre-move paths, causing TS2307 module-not-found errors. These are auto-generated Next.js type stubs that go stale after route moves.
- **Fix:** Deleted the four stale generated files from `.next/types/app/expenses/` and `.next/types/app/income/`. After deletion, `tsc --noEmit` passes cleanly.
- **Files modified:** `.next/types/app/expenses/new/page.ts`, `.next/types/app/expenses/page.ts`, `.next/types/app/income/new/page.ts`, `.next/types/app/income/page.ts` (deleted — will regenerate on next `next dev`/`next build`)
- **Commit:** N/A — generated files, not tracked

**2. [Note] Task 1 commit was already in HEAD before this execution**

- The income/expenses move in commit `424968d` was included in a prior agent's commit alongside wallet-actions work. The task was already complete; verified via automated checks and git history. No re-commit needed.

**3. [Note] Task 3 ROADMAP change was auto-included in a concurrent commit**

- The ROADMAP.md edit was staged and picked up by `f4f0c07 docs(phase-6): add validation strategy` which was committed by a concurrent agent run. The change is correctly committed; no standalone Task 3 code commit was needed.

## Known Stubs

None — all five nav links point to real routes. `/profit-first` and `/wallets` already exist; `/income` and `/expenses` were just moved. Dashboard `/` redirects users after login (confirmed in LoginForm.tsx).

## Self-Check

- [x] `apps/web/src/components/DashboardNav.tsx` exists
- [x] `apps/web/src/app/(dashboard)/income/page.tsx` exists
- [x] `apps/web/src/app/(dashboard)/expenses/page.tsx` exists
- [x] `apps/web/src/app/income` does NOT exist
- [x] `apps/web/src/app/expenses` does NOT exist
- [x] `tsc --noEmit` passes for apps/web
- [x] Commits 424968d, 14fb3e6, f4f0c07 exist in git log
- [x] ROADMAP.md Phase 5 criterion 4 present
- [x] Layout has no stale "sidebar nav" comment

## Self-Check: PASSED
