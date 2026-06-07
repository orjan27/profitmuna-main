---
phase: quick-260607-iy4
plan: 01
subsystem: web-ui
tags: [branding, ui, cleanup]
requires: []
provides: [BrandMark full-logo lockup]
affects:
  - apps/web/src/components/BrandMark.tsx
  - apps/web/src/components/DashboardNav.tsx
  - apps/web/src/app/(auth)/login/page.tsx
  - apps/web/src/app/(auth)/register/page.tsx
  - apps/web/src/app/(auth)/verify-email/page.tsx
  - apps/web/src/app/(auth)/forgot-password/page.tsx
  - apps/web/src/app/(auth)/reset-password/page.tsx
tech-stack:
  added: []
  patterns: [single-image brand lockup via next/image]
key-files:
  created: []
  modified:
    - apps/web/src/components/BrandMark.tsx
    - apps/web/src/components/DashboardNav.tsx
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/src/app/(auth)/register/page.tsx
    - apps/web/src/app/(auth)/verify-email/page.tsx
    - apps/web/src/app/(auth)/forgot-password/page.tsx
    - apps/web/src/app/(auth)/reset-password/page.tsx
  deleted:
    - apps/web/public/profitmuna-mark.webp
decisions:
  - DashboardNav uses h-8 (32px) for the stacked lockup in the horizontal nav bar
  - Auth-page headers use h-12 (48px) so the full lockup reads as the page brand
metrics:
  duration: ~6 min
  completed: 2026-06-07
---

# Quick Task 260607-iy4: Use Original Full ProfitMuna Logo in BrandMark Summary

Replaced the cropped-glyph + typeset-wordmark BrandMark lockup with the original full
ProfitMuna logo image (`/profitmuna-logo.webp`, 189x94) rendered as-is via next/image,
dropping the dead `withWordmark`/`wordmarkClassName` props and the orphaned crop asset.

## What Changed

- **BrandMark.tsx** — Rewritten to render a single `next/image` of `/profitmuna-logo.webp`
  (width=189, height=94, real `alt="ProfitMuna"`). Props reduced to `className?` and
  `markClassName?` (size override preserved to minimize call-site churn). Removed
  `withWordmark`, `wordmarkClassName`, the inline-flex span, the typeset name span, and the
  obsolete JSDoc about cropping / the "One Sans Rule". Default sizing `h-9 w-auto`.
- **7 call sites resized** for the taller stacked lockup:
  - `DashboardNav.tsx:50` — bare `<BrandMark />` → `<BrandMark markClassName="h-8" />` (32px,
    compact for the horizontal nav bar).
  - 6 auth-page usages (login, register, verify-email, forgot-password, reset-password x2):
    `markClassName="h-6"` → `markClassName="h-12"` (48px page-header brand).
- **Deleted** `apps/web/public/profitmuna-mark.webp` — the orphaned cropped-glyph asset, now
  unreferenced anywhere in `apps/web/src` (grep-confirmed before delete).

## Decisions Made

- **Nav height h-8 (not h-7):** The stacked lockup at 32px fits the nav row without dominating
  it; h-8 chosen over h-7 as the more legible of the two plan-sanctioned options.
- **Auth height h-12:** Full stacked lockup reads clearly as the centered page-header brand.

## Deviations from Plan

None — plan executed exactly as written.

Note: Task 1 `<verify>` expected `grep -c "profitmuna-logo.webp"` to be 1, but the count is 2
because the path appears in both the `src=` attribute and the JSDoc comment. Both references
are correct and intentional; the key_links pattern (`profitmuna-logo\.webp` via next/image
src) is satisfied. Not a functional deviation.

## Verification Results

- `cd apps/web && npx tsc --noEmit` — exit 0, no errors.
- `grep -rn "profitmuna-mark.webp\|withWordmark\|wordmarkClassName" apps/web/src` — empty.
- `grep -rn ">Profitmuna<\|Profitmuna<" apps/web/src/components/BrandMark.tsx` — empty.
- `apps/web/public/profitmuna-mark.webp` — does not exist.
- BrandMark renders `/profitmuna-logo.webp` via next/image (width=189, height=94).

## Commits

- `a307fda` refactor(quick-260607-iy4): render full ProfitMuna logo in BrandMark
- `c85529a` fix(quick-260607-iy4): resize BrandMark call sites for stacked logo
- `c4c2b20` chore(quick-260607-iy4): delete orphaned profitmuna-mark.webp

## Self-Check: PASSED

- FOUND: apps/web/src/components/BrandMark.tsx (renders /profitmuna-logo.webp)
- FOUND: commit a307fda, c85529a, c4c2b20
- CONFIRMED: apps/web/public/profitmuna-mark.webp deleted
