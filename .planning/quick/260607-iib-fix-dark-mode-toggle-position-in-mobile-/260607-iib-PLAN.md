---
phase: quick
plan: 260607-iib
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/DashboardNav.tsx
autonomous: false
requirements:
  - QUICK-260607-iib
user_setup: []

must_haves:
  truths:
    - 'On mobile (< md), the theme toggle sits flush at the right edge of the header bar, not floating in the center.'
    - 'On md+, the layout is unchanged: brand left, centered nav links, theme toggle right.'
    - 'Switching between mobile and desktop widths does not shift the toggle out of its right-edge position.'
  artifacts:
    - path: 'apps/web/src/components/DashboardNav.tsx'
      provides: 'Header bar with theme toggle pinned to the last grid track at all breakpoints'
      contains: 'ThemeToggle'
  key_links:
    - from: 'apps/web/src/components/DashboardNav.tsx'
      to: 'grid layout'
      via: 'explicit grid-column placement of the toggle wrapper'
      pattern: 'col-start|justify-self-end'
---

<objective>
Fix the dark mode toggle landing in the middle of the header on mobile. On viewports below `md`, the toggle must sit at the right edge of the header bar, consistent with conventional mobile header-action placement and matching its md+ position.

Purpose: Correct a CSS Grid auto-placement bug — purely a layout fix, no redesign and no new features.
Output: Updated `DashboardNav.tsx` with the toggle pinned to the trailing grid track across all breakpoints.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@apps/web/src/components/DashboardNav.tsx

<root_cause>
`DashboardNav` uses a three-track explicit grid:
`grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]` — brand | centered nav | toggle.

The center `<nav>` is hidden on mobile with `max-md:hidden`, which resolves to
`display:none` and removes that element from CSS Grid placement. With the nav
gone, only two children remain (BrandMark, ThemeToggle wrapper). Grid
auto-placement fills tracks left-to-right: BrandMark → track 1 (`1fr`),
ThemeToggle wrapper → track 2 (the centered `auto` track). `justify-self-end`
only aligns the toggle to the right edge of that center track, so it renders
mid-bar.

Fix: explicitly place the toggle wrapper in the trailing grid track
(`col-start-3`) so it is never auto-placed into the center track when the nav
is hidden. The brand stays in track 1; the empty center `auto` track collapses
to zero width on mobile, leaving brand-left / toggle-right.
</root_cause>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pin theme toggle to the trailing grid track</name>
  <files>apps/web/src/components/DashboardNav.tsx</files>
  <action>In the toggle wrapper `div` (currently `<div className="justify-self-end">` wrapping `<ThemeToggle />`), add an explicit grid-column start so the toggle is always placed in the third (trailing) track regardless of whether the center `<nav>` is rendered. Change the className to `col-start-3 justify-self-end`. Keep `justify-self-end` so the toggle hugs the right edge of that track. Do NOT change the grid template, the brand link, or the `<nav>` element — this is the minimal change that fixes mobile auto-placement without affecting the md+ centered layout. Do not touch `ThemeToggle.tsx` (the button itself is correct). Do not edit any `components/ui/*` file.</action>
  <verify>
    <automated>grep -q "col-start-3 justify-self-end" apps/web/src/components/DashboardNav.tsx &amp;&amp; cd apps/web &amp;&amp; npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>Toggle wrapper has `col-start-3`; type check passes; grid template, brand link, and nav block are unchanged.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>The theme toggle wrapper in DashboardNav is now pinned to the trailing grid column (`col-start-3 justify-self-end`), so it no longer auto-places into the empty center track when the mobile nav is hidden.</what-built>
  <how-to-verify>
    1. Run the web app dev server: `cd apps/web && npm run dev`.
    2. Open the app and sign in to reach any authenticated page (e.g. `/overview`).
    3. Resize the browser to a narrow/mobile width (or use device toolbar, e.g. iPhone width ~390px).
    4. Confirm the dark mode toggle (Sun/Moon icon) sits flush at the RIGHT edge of the top header bar, aligned with the bar's right padding — NOT floating in the middle.
    5. Confirm the brand lockup stays on the left.
    6. Widen the viewport past the `md` breakpoint (~768px+) and confirm the original layout is intact: brand left, centered text nav links, toggle on the right.
    7. Click the toggle in both widths to confirm it still switches light/dark.
  </how-to-verify>
  <resume-signal>Type "approved" if the toggle is right-aligned on mobile and the desktop layout is unchanged, or describe what looks off.</resume-signal>
</task>

</tasks>

<verification>
- `grep "col-start-3 justify-self-end" apps/web/src/components/DashboardNav.tsx` returns the toggle wrapper line.
- `cd apps/web && npx tsc --noEmit` passes with no new errors.
- Human verification confirms right-edge placement on mobile and unchanged md+ layout.
</verification>

<success_criteria>

- On mobile widths, the theme toggle is right-aligned in the header bar (no longer centered).
- The md+ three-zone header (brand | centered links | toggle) is visually unchanged.
- No files other than `DashboardNav.tsx` are modified; no new dependencies; `components/ui/*` untouched.
  </success_criteria>

<output>
Create `.planning/quick/260607-iib-fix-dark-mode-toggle-position-in-mobile-/260607-iib-SUMMARY.md` when done.
</output>
