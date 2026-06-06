---
phase: quick-260606-tln
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/app/(dashboard)/income/
  - apps/web/src/app/(dashboard)/expenses/
  - apps/web/src/components/DashboardNav.tsx
  - apps/web/src/app/(dashboard)/layout.tsx
  - .planning/ROADMAP.md
autonomous: true
requirements: [DASH-01]

must_haves:
  truths:
    - 'Every authenticated page (Dashboard, Income, Expenses, Profit First, Wallets) renders a shared navigation bar'
    - 'The nav link matching the current route is visually highlighted as active'
    - '/income and /expenses URLs still resolve after being moved into the (dashboard) route group'
    - 'ROADMAP Phase 5 success criteria explicitly include the navigation shell'
  artifacts:
    - path: 'apps/web/src/components/DashboardNav.tsx'
      provides: 'Shared client nav with five links and active-state highlighting'
      contains: 'usePathname'
    - path: 'apps/web/src/app/(dashboard)/layout.tsx'
      provides: 'Server-component shell rendering DashboardNav above children'
      contains: 'DashboardNav'
    - path: 'apps/web/src/app/(dashboard)/income/page.tsx'
      provides: 'Income page relocated into the dashboard route group'
    - path: 'apps/web/src/app/(dashboard)/expenses/page.tsx'
      provides: 'Expenses page relocated into the dashboard route group'
  key_links:
    - from: 'apps/web/src/app/(dashboard)/layout.tsx'
      to: 'apps/web/src/components/DashboardNav.tsx'
      via: 'import + render in layout'
      pattern: 'import.*DashboardNav'
    - from: 'apps/web/src/components/DashboardNav.tsx'
      to: 'next/navigation usePathname'
      via: 'active-state detection'
      pattern: 'usePathname'
---

<objective>
Add a shared navigation bar to the authenticated app shell so users can move between Dashboard, Income, Expenses, Profit First, and Wallets from any authenticated page, with the current section highlighted.

Purpose: The four feature areas built in Phases 1–4 currently have no cross-navigation. /income and /expenses also live outside the (dashboard) route group, so they don't share the authenticated shell. This unifies them.

Output:

- /income and /expenses route trees relocated into the (dashboard) route group (URLs unchanged).
- A shared `DashboardNav` client component with active-state highlighting.
- `(dashboard)/layout.tsx` extended to render the nav (and its stale Phase-5 comment corrected).
- ROADMAP Phase 5 success criteria updated to include the navigation shell.
  </objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@./CLAUDE.md

# Current shell (Server Component — must stay one; comment is stale post-this-plan)

@apps/web/src/app/(dashboard)/layout.tsx

# Auth guard — verify matcher still covers /income and /expenses after the move

@apps/web/src/middleware.ts

<interfaces>
<!-- Verified facts the executor needs — no codebase exploration required. -->

Route inventory to MOVE (entire subtrees, including \_components/ and \_actions/):
apps/web/src/app/income/ → apps/web/src/app/(dashboard)/income/
apps/web/src/app/expenses/ → apps/web/src/app/(dashboard)/expenses/

income/ contents: page.tsx, new/page.tsx, new/\_actions/create-income.ts, \_components/_.tsx (income-overview, income-list, income-filters, income-form, edit-income-dialog, receive-income-dialog, manage-categories-dialog, income-actions.ts, category-actions.ts)
expenses/ contents: page.tsx, new/page.tsx, new/\_actions/create-expense.ts, \_components/_.tsx (expenses-overview, expense-list, expense-form, edit-expense-dialog, manage-categories-dialog, expense-actions.ts, category-actions.ts)

Import-safety (verified): all imports in these trees use either `@/*` aliases (alias-stable across the move) or `./_components/...` co-located relative paths (move with their parent). No file outside these trees references their internal paths. Route groups are URL-transparent, so /income, /income/new, /expenses, /expenses/new URLs are unchanged.

Nav links (label → href) — five items per the task description:
Dashboard → / (LoginForm redirects to '/' after login; confirmed in apps/web/src/components/auth/LoginForm.tsx)
Income → /income
Expenses → /expenses
Profit First → /profit-first
Wallets → /wallets

Active state requires usePathname() → DashboardNav MUST be a Client Component ('use client'). The layout stays a Server Component and imports it.

No existing logout affordance exists anywhere in apps/web/src (grep confirmed). Per plan constraints: do NOT build new auth UI / logout. Links only.

Existing layout (to extend, keep as Server Component):

```
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-12 pb-16 px-4 md:px-8 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
```

Available UI tooling: lucide-react icons, Tailwind CSS 4, shadcn/ui primitives in apps/web/src/components/ui/, `cn` helper at @/lib/utils.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move /income and /expenses into the (dashboard) route group</name>
  <files>apps/web/src/app/(dashboard)/income/ (moved from apps/web/src/app/income/), apps/web/src/app/(dashboard)/expenses/ (moved from apps/web/src/app/expenses/)</files>
  <action>Move the entire `apps/web/src/app/income/` subtree to `apps/web/src/app/(dashboard)/income/` and `apps/web/src/app/expenses/` to `apps/web/src/app/(dashboard)/expenses/`, preserving every nested file (`new/`, `_components/`, `_actions/`). Use `git mv` per file or per directory so history is preserved; the source `app/income` and `app/expenses` directories must no longer exist afterward. Do NOT edit any file contents — all imports use `@/*` aliases or co-located `./_components/` relative paths, both of which remain valid after the move (route groups do not change `@/*` resolution and co-located paths move with their parent). After moving, leave no empty `app/income` or `app/expenses` directory behind.</action>
  <verify>
    <automated>test ! -e "apps/web/src/app/income" && test ! -e "apps/web/src/app/expenses" && test -f "apps/web/src/app/(dashboard)/income/page.tsx" && test -f "apps/web/src/app/(dashboard)/income/new/page.tsx" && test -f "apps/web/src/app/(dashboard)/expenses/page.tsx" && test -f "apps/web/src/app/(dashboard)/expenses/new/_actions/create-expense.ts"</automated>
  </verify>
  <done>Both route trees live under (dashboard) with all nested files intact; the old top-level income/ and expenses/ directories are gone; no file contents changed.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create DashboardNav and wire it into the layout</name>
  <files>apps/web/src/components/DashboardNav.tsx, apps/web/src/app/(dashboard)/layout.tsx</files>
  <action>Create `apps/web/src/components/DashboardNav.tsx` as a Client Component (`'use client'` directive at top). Define a module-level `readonly` array of nav items `{ label, href }` covering exactly: Dashboard `/`, Income `/income`, Expenses `/expenses`, Profit First `/profit-first`, Wallets `/wallets`. Render a `<nav>` containing `next/link` `<Link>` elements for each item, each with a lucide-react icon (LayoutDashboard, ArrowDownToLine/TrendingUp, ArrowUpFromLine/TrendingDown, PieChart, Wallet — pick reasonable lucide icons that exist). Use `usePathname()` from `next/navigation` to compute the active item: an item is active when `pathname === href` for `/`, and `pathname === href || pathname.startsWith(href + '/')` for the others (so /income/new highlights Income). Apply active styling via the `cn` helper from `@/lib/utils` (e.g. active = foreground text + subtle bg/border, inactive = muted-foreground with hover). Make it simply responsive: a horizontal bar on desktop and a horizontal scroll/wrap row on mobile (icons + labels; no hamburger/drawer — keep it minimal, no over-engineering). Use a named export `function DashboardNav()` with an explicit return type. Do NOT add any logout/auth control. Then edit `apps/web/src/app/(dashboard)/layout.tsx`: keep it a Server Component (no `'use client'`), import `DashboardNav` from `@/components/DashboardNav`, and render `<DashboardNav />` as a sticky/top bar above the existing `<main>` (adjust `<main>` top padding as needed so content isn't hidden behind the nav). Preserve the existing `max-w-7xl` content container and background.</action>
  <verify>
    <automated>cd apps/web && npx tsc --noEmit -p tsconfig.json && grep -q "use client" src/components/DashboardNav.tsx && grep -q "usePathname" src/components/DashboardNav.tsx && grep -q "DashboardNav" "src/app/(dashboard)/layout.tsx" && ! grep -q "use client" "src/app/(dashboard)/layout.tsx"</automated>
  </verify>
  <done>DashboardNav exists as a client component using usePathname for active state with all five links; layout.tsx (still a server component) imports and renders it; `tsc --noEmit` passes for apps/web.</done>
</task>

<task type="auto">
  <name>Task 3: Update layout comment and ROADMAP Phase 5 success criteria</name>
  <files>apps/web/src/app/(dashboard)/layout.tsx, .planning/ROADMAP.md</files>
  <action>In `apps/web/src/app/(dashboard)/layout.tsx`, update the stale header comment: it currently says "Phase 5 will extend this layout with a sidebar nav and full dashboard chrome." Replace that sentence to reflect reality — the shared navigation bar now exists in this layout (via DashboardNav), and Phase 5 will extend it with full dashboard chrome (e.g. summary widgets / dashboard page), not add the nav from scratch. In `.planning/ROADMAP.md`, under `### Phase 5: Dashboard` → `**Success Criteria**`, add a new numbered criterion stating that all authenticated pages share a navigation shell linking Dashboard, Income, Expenses, Profit First, Wallets, and Settings (Settings link lands once Phase 6 ships). Do not renumber or alter the existing criteria; append the new one.</action>
  <verify>
    <automated>grep -q "navigation" ".planning/ROADMAP.md" && grep -iq "Settings" ".planning/ROADMAP.md" && ! grep -q "will extend this layout with a sidebar nav" "apps/web/src/app/(dashboard)/layout.tsx"</automated>
  </verify>
  <done>Layout comment no longer claims Phase 5 will add the nav; ROADMAP Phase 5 has a success criterion describing the shared navigation shell including Settings.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                 | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| browser → Next.js routes | Authenticated page requests; auth already enforced by middleware.ts |

## STRIDE Threat Register

| Threat ID | Category               | Component                                      | Disposition | Mitigation Plan                                                                                                                                          |
| --------- | ---------------------- | ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-tln-01  | Elevation of Privilege | /income, /expenses after move into (dashboard) | accept      | URLs are unchanged by route groups; middleware.ts matcher already covers all non-public paths (verified). No auth surface change.                        |
| T-tln-02  | Tampering              | npm/dependency installs                        | mitigate    | No new dependencies added — lucide-react, next, tailwind, cn helper all already present and pinned. Task 2 verify runs `tsc --noEmit` (no install step). |

</threat_model>

<verification>
- `npx tsc --noEmit` passes for apps/web (no broken imports after the move, nav typechecks).
- Old `apps/web/src/app/income` and `apps/web/src/app/expenses` directories no longer exist.
- DashboardNav is a client component (`usePathname`); layout remains a server component importing it.
- ROADMAP Phase 5 mentions the navigation shell including Settings.
- No new npm dependency introduced.
</verification>

<success_criteria>

- Authenticated pages (Dashboard, Income, Expenses, Profit First, Wallets) all render the shared nav bar with the current section highlighted.
- /income, /income/new, /expenses, /expenses/new URLs still resolve (route-group move is URL-transparent).
- No logout/auth UI added.
- Layout stays a Server Component; nav active-state logic lives in the Client Component.
- ROADMAP Phase 5 success criteria updated; stale layout comment corrected.
  </success_criteria>

<output>
Create `.planning/quick/260606-tln-add-shared-navbar-to-authenticated-app-s/260606-tln-SUMMARY.md` when done.
</output>
