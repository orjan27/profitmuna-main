---
phase: quick-260607-izx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/WalletFab.tsx
  - apps/web/src/app/(dashboard)/wallets/page.tsx
autonomous: false
requirements: [QUICK-IZX]
must_haves:
  truths:
    - "On the Wallets page in mobile viewport, the inline 'New wallet' button is hidden"
    - 'On the Wallets page in mobile viewport, a circular FAB with a Wallet icon and a small + sits at the lower right above BottomNav'
    - 'Tapping the FAB navigates to /wallets/new'
    - "On desktop (md+), the inline 'New wallet' button still shows and the FAB is hidden"
  artifacts:
    - path: 'apps/web/src/components/WalletFab.tsx'
      provides: 'Mobile-only floating action button linking to /wallets/new, styled like RecordFab'
      exports: ['WalletFab']
    - path: 'apps/web/src/app/(dashboard)/wallets/page.tsx'
      provides: 'Wallets page rendering WalletFab and hiding inline button on mobile'
  key_links:
    - from: 'apps/web/src/app/(dashboard)/wallets/page.tsx'
      to: 'apps/web/src/components/WalletFab.tsx'
      via: 'import { WalletFab } and render'
      pattern: 'WalletFab'
    - from: 'apps/web/src/components/WalletFab.tsx'
      to: '/wallets/new'
      via: 'next/link href'
      pattern: '/wallets/new'
---

<objective>
On the Wallets page, replace the mobile "New wallet" affordance with a floating action button (FAB) matching RecordFab's placement, size, and styling, but using a lucide Wallet icon with a small +. The FAB navigates to /wallets/new. Desktop keeps its existing inline "New wallet" button.

Purpose: Give the Wallets page the same thumb-zone primary action pattern used on the record pages, where RecordFab does not render (RECORD_ROUTES omits /wallets), so there is no FAB conflict to resolve.
Output: A new shared WalletFab component and updated Wallets page.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@apps/web/src/components/RecordFab.tsx
@apps/web/src/components/BottomNav.tsx
@apps/web/src/app/(dashboard)/layout.tsx
@apps/web/src/app/(dashboard)/wallets/page.tsx

<interfaces>
RecordFab's exact mobile FAB styling (the WalletFab must match placement, size, shadow, focus, and md:hidden behavior) — from apps/web/src/components/RecordFab.tsx:

The button className:
`fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/25 transition-transform outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden`

RecordFab renders a `<button>` opening a sheet via a hook. WalletFab differs: it navigates, so it renders a `next/link` `<Link href="/wallets/new">` styled identically (Link accepts className directly; no asChild needed).

lucide-react exports `Wallet` and `Plus` (both already used in BottomNav.tsx / RecordFab.tsx — no new dependency).

RecordFab is NOT shown on /wallets (RECORD_ROUTES = /expenses, /income, /overview only), so WalletFab does not coexist or conflict with RecordFab on this route.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create WalletFab shared component</name>
  <files>apps/web/src/components/WalletFab.tsx</files>
  <action>Create a shared, mobile-only floating action button named WalletFab in apps/web/src/components/. Mirror RecordFab's structure and styling exactly (see RecordFab.tsx in context) with these differences: (1) it is a navigation control, so render a next/link Link with href="/wallets/new" instead of a button with an onClick; apply RecordFab's button className string directly to the Link (the same fixed/right-4/bottom-[calc(4.75rem+env(safe-area-inset-bottom))]/z-20/size-14/rounded-full/bg-primary/text-primary-foreground/shadow/active:scale-95/focus-visible/md:hidden classes) so size, placement above BottomNav, thumb-zone position, and md:hidden hide-on-desktop behavior are identical. (2) Inside, render a lucide-react Wallet icon as the primary glyph plus a small Plus glyph to read as "add wallet". Use a relative wrapper around the Wallet icon (className "size-7" strokeWidth 2.25 like RecordFab's Plus) and overlay the Plus as a small badge in the corner (e.g. absolute -right-1 -top-1, size-3.5 or similar, on a small rounded badge using bg-primary/text-primary-foreground so it stays legible) — keep the visual within the same 14-size circle. Add aria-label="New wallet" on the Link and aria-hidden on both icons. This is a presentational navigation component with no hooks, so it does not strictly require 'use client', but matching RecordFab and keeping the file safe to colocate, do NOT add a sheet hook import. Use the @/* alias if importing cn from @/lib/utils (only if you compose classes). Export it as a named export: export function WalletFab(): React.JSX.Element. Do not add it to the dashboard layout — it is mounted by the Wallets page only (Task 2).</action>
  <verify>
    <automated>cd /home/orjanbognot/projects/orjan/profitmuna-main && grep -q 'export function WalletFab' apps/web/src/components/WalletFab.tsx && grep -q '/wallets/new' apps/web/src/components/WalletFab.tsx && grep -q 'md:hidden' apps/web/src/components/WalletFab.tsx && grep -q 'Wallet' apps/web/src/components/WalletFab.tsx && grep -q 'Plus' apps/web/src/components/WalletFab.tsx && echo OK</automated>
  </verify>
  <done>WalletFab.tsx exists in components/, exports WalletFab, links to /wallets/new, is md:hidden (mobile-only), and renders both a Wallet and a Plus icon. Matches RecordFab placement/size/styling.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Mount WalletFab and hide inline New wallet button on mobile</name>
  <files>apps/web/src/app/(dashboard)/wallets/page.tsx</files>
  <action>In the Wallets page: (1) Import WalletFab from @/components/WalletFab. (2) Make the existing inline "New wallet" Button (the size="sm" asChild Button linking to /wallets/new, currently rendered only when wallets.length > 0) hidden on mobile and visible at md+. The cleanest way: add className="max-md:hidden" (or "hidden md:inline-flex") to that Button so desktop keeps it and mobile drops it. Leave the empty-state CTAs (the "Create wallet" button and the quick-create bucket buttons in the wallets.length === 0 branch) UNCHANGED — those own the action when there are no wallets and the FAB is a complement, not a replacement, for the populated list view. (3) Render <WalletFab /> once near the end of the page's returned JSX (e.g. just before the closing wrapper div), so it appears on /wallets in the mobile thumb zone. The FAB itself is md:hidden, so it is automatically desktop-hidden; no conditional needed. Keep it rendered regardless of wallets.length (mobile users with zero wallets still get a primary add affordance, and the empty-state Create wallet button coexisting with it is acceptable — but if you prefer one primary on the empty mobile state, only render WalletFab when wallets.length > 0 to mirror the inline button; choose the wallets.length > 0 gate to keep parity with the inline button it replaces). Do not modify the dashboard layout.</action>
  <verify>
    <automated>cd /home/orjanbognot/projects/orjan/profitmuna-main && grep -q "import { WalletFab } from '@/components/WalletFab'" apps/web/src/app/\(dashboard\)/wallets/page.tsx && grep -q '<WalletFab' apps/web/src/app/\(dashboard\)/wallets/page.tsx && grep -Eq 'max-md:hidden|hidden md:' apps/web/src/app/\(dashboard\)/wallets/page.tsx && npx tsc -p apps/web/tsconfig.json --noEmit && echo OK</automated>
  </verify>
  <done>Wallets page imports and renders WalletFab; the inline "New wallet" button carries a responsive class hiding it on mobile while keeping it at md+; empty-state CTAs unchanged; type-check passes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>A mobile-only WalletFab (Wallet icon + small +) on the /wallets page that navigates to /wallets/new, matching RecordFab's circle placement/size; the inline "New wallet" button is now hidden on mobile and kept on desktop.</what-built>
  <how-to-verify>
    1. Run the web app dev server (e.g. `npm run dev` from repo root or the appropriate workspace command) and open /wallets.
    2. In a mobile viewport (DevTools device toolbar, e.g. iPhone width): confirm the inline "New wallet" button at the top-right of the header is GONE, and a circular FAB with a Wallet icon and a small + badge sits at the lower right, just above the BottomNav, in the same spot RecordFab uses on Income/Expenses.
    3. Tap the FAB → it navigates to /wallets/new.
    4. Resize to desktop (md+, ~>=768px): confirm the FAB DISAPPEARS and the inline "New wallet" button REAPPEARS in the header.
    5. (Optional) Visit /income or /expenses on mobile and confirm RecordFab still works and looks identical in placement to the new WalletFab.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any visual/placement issues.</resume-signal>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary   | Description                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| (none new) | This change is presentational client-side navigation only. No new input, network, auth, or data crosses a trust boundary. |

## STRIDE Threat Register

| Threat ID | Category               | Component                   | Disposition | Mitigation Plan                                                                                                               |
| --------- | ---------------------- | --------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| T-izx-01  | Tampering              | WalletFab navigation target | accept      | Static internal href "/wallets/new"; no user input interpolated into the URL. Route is already auth-guarded by middleware.ts. |
| T-izx-02  | Information Disclosure | Wallets page render         | accept      | No data added/exposed; only UI affordance relocation.                                                                         |

No package installs in this plan — Package Legitimacy Gate not applicable (Wallet/Plus already imported from existing lucide-react dependency).
</threat_model>

<verification>
- `npx tsc -p apps/web/tsconfig.json --noEmit` passes (no type errors).
- `grep` gates in tasks confirm component existence, import wiring, /wallets/new link, mobile-only classes, and both icons.
- Human checkpoint confirms mobile FAB appears/navigates, mobile inline button hidden, desktop inline button restored.
</verification>

<success_criteria>

- Mobile /wallets: inline "New wallet" button hidden; WalletFab (Wallet + small +) shown lower-right above BottomNav; tapping it opens /wallets/new.
- Desktop /wallets: inline "New wallet" button visible; WalletFab hidden.
- WalletFab matches RecordFab's placement, size (size-14), shadow, and md:hidden behavior.
- No new dependencies; STRICT structure honored (shared component in components/, route mount in app/); @/\* aliases used.
- Type-check passes.
  </success_criteria>

<output>
Create `.planning/quick/260607-izx-remove-wallet-new-button-add-wallet-fab/260607-izx-SUMMARY.md` when done.
</output>
