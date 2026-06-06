---
phase: 03-profit-first-allocation
plan: '04'
subsystem: profit-first-mutations
tags: [ui, nextjs, server-actions, dialogs, shadcn, percent-bp-conversion]
dependency_graph:
  requires: [03-03, 03-02]
  provides:
    [
      profit-first-actions server module (createAccountAction, updateAccountAction, deleteAccountAction, updatePercentagesAction),
      PfPercentageEditor bulk editor with 100% gate,
      PfAccountForm create/edit dialog with preset swatches,
      delete confirmation dialog,
      wired per-account dropdown Edit/Delete handlers,
      Add Account + Edit Percentages entry points in PfContent,
    ]
  affects:
    [
      apps/web/src/app/(dashboard)/profit-first/_components/pf-content.tsx,
      apps/web/src/app/(dashboard)/profit-first/_components/pf-overview.tsx,
    ]
tech_stack:
  added: []
  patterns:
    [
      'use server' Next.js server actions in apps/web/src/server/,
      percent→bp conversion Math.round(pct * 100) at action boundary,
      preset color swatch palette (PF_DEFAULT_COLORS; no free hex),
      controlled dialog open state lifted to PfContent / AccountCard,
      router.refresh() RSC invalidation after every mutation,
    ]
key_files:
  created:
    - apps/web/src/server/profit-first-actions.ts
    - apps/web/src/app/(dashboard)/profit-first/_components/pf-percentage-editor.tsx
    - apps/web/src/app/(dashboard)/profit-first/_components/pf-account-form.tsx
  modified:
    - apps/web/src/app/(dashboard)/profit-first/_components/pf-overview.tsx (dropdown wired, delete dialog added)
    - apps/web/src/app/(dashboard)/profit-first/_components/pf-content.tsx (Add Account, Edit Percentages, editor mount)
decisions:
  - Server actions in apps/web/src/server/ (not route-group _actions/) per CLAUDE.md STRICT structure — mirrors auth.ts server-only module pattern
  - percent→bp conversion (Math.round(pct * 100)) done exclusively in server actions, never in UI components — Pitfall 3 containment
  - Delete confirmation dialog mounted inside AccountCard (co-located with state) rather than lifted to PfContent — keeps delete state local to the card
  - PfPercentageEditor mounted inline in PfContent, replacing cards area — matches reference inline behavior; no Sheet/Drawer needed
  - "Add Account" dialog state owned by PfContent; edit/delete dialog state owned by individual AccountCard — natural ownership boundary
metrics:
  duration: '~4 min'
  completed: '2026-06-06'
  tasks_completed: 2
  files_modified: 5
---

# Phase 03 Plan 04: Profit First Mutation UI Summary

Server actions with percent→basis-point conversion at the action boundary; bulk percentage editor with a live 100% total gate; create/edit account dialog with preset color swatches; delete confirmation dialog; per-account dropdown handlers fully wired — completing the interactive allocation management UI.

## Tasks Completed

| Task | Name                                                             | Commit  | Files                                                                          |
| ---- | ---------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| 1    | Server actions (percent→bp) + bulk percentage editor             | ff4010e | apps/web/src/server/profit-first-actions.ts, pf-percentage-editor.tsx          |
| 2    | Create/edit account dialog + delete confirmation + wire dropdown | a136d7c | pf-account-form.tsx (new), pf-overview.tsx (updated), pf-content.tsx (updated) |

## What Was Built

### Server Actions (Task 1)

`apps/web/src/server/profit-first-actions.ts` — `'use server'` module in `apps/web/src/server/` per CLAUDE.md STRICT structure (server-only modules). Mirrors `auth.ts` pattern: reads `access_token` cookie, forwards as `Authorization: Bearer` to `${API_BASE_URL}`.

Exports:

- **`createAccountAction({ name, targetPercentage (pct), color })`** — POST `/api/profit-first/accounts`; converts `Math.round(pct * 100)` to bp
- **`updateAccountAction(id, { name?, targetPercentage? (pct), color? })`** — PATCH `/api/profit-first/accounts/:id`; converts pct→bp only when targetPercentage present
- **`deleteAccountAction(id)`** — DELETE `/api/profit-first/accounts/:id`
- **`updatePercentagesAction(items[])`** — PUT `/api/profit-first/percentages`; maps each item's pct→bp
- All return `{ ok: boolean, message?: string }` — callers toast the message on `!ok`

**Pitfall 3 containment:** The conversion `Math.round(pct * 100)` appears 3 times in this file (one per action that sends targetPercentage). No UI component ever computes basis points.

### Bulk Percentage Editor (Task 1)

`pf-percentage-editor.tsx` (`'use client'`):

- One row per account: color dot + name + number `<Input>` (min=0 max=100, integer)
- Live total computed from `rows.reduce(...)` in percent (never basis points)
- Total line: `"Total: 100% ✓"` in `text-green-600` when `total === 100`; `"Total: {n}% — must equal 100% to save"` in `text-destructive` otherwise
- Save button disabled and `opacity-50 pointer-events-none` when `total !== 100`
- On save: calls `updatePercentagesAction`, toasts `"Allocation percentages saved."`, `router.refresh()`, calls `onCancel()` to return to cards

### Create/Edit Account Dialog (Task 2)

`pf-account-form.tsx` (`'use client'`) — single component reused for both modes:

- Create mode: no `account` prop; title "Add Account"; empty fields; calls `createAccountAction`
- Edit mode: `account` prop supplied; title "Edit Account"; pre-filled fields; calls `updateAccountAction`
- Fields: Account Name (text, max 100), Target % (number 0–100), Color (8 preset swatches from `PF_DEFAULT_COLORS` as filled circle buttons with ring on selected — no `type="color"`, no free hex, D-08/T-03-11)
- On success: `toast.success("Account created.")` / `"Account updated."`, `router.refresh()`
- On API error: `toast.error(result.message)` — API messages ("Adding this account would exceed 100%...", "An account with this name already exists.") surface verbatim

### Delete Confirmation Dialog (Task 2)

Mounted inside `AccountCard` in `pf-overview.tsx`:

- shadcn `Dialog`; title "Delete Account"; body `Delete "{name}"? This cannot be undone.`
- Confirm button: `variant="destructive"`, label "Delete Account"
- Calls `deleteAccountAction(id)`; on success `toast.success("Account deleted.")` + `router.refresh()`
- Only reachable for CUSTOM accounts (dropdown Delete item disabled for non-CUSTOM, T-03-07)

### Wired Dropdown + Entry Points (Task 2)

`pf-overview.tsx` dropdown items:

- **Edit** — `onClick={() => setEditOpen(true)}` opens `PfAccountForm` in edit mode (pre-filled with current account data)
- **Delete (CUSTOM)** — `onClick={() => setDeleteOpen(true)}` opens delete confirmation; `className="text-destructive"`
- **Delete (non-CUSTOM)** — `disabled` + shadcn `Tooltip` with "Default accounts cannot be deleted." (T-03-07 defense-in-depth)

`pf-content.tsx` action row:

- **"Add Account"** button (default/accent variant) opens `PfAccountForm` in create mode
- **"Edit Percentages"** button (outline variant) replaces cards area with `PfPercentageEditor` inline; hidden while editor is visible
- `AmountToggle` moved to the action row (`ml-auto`), preserving its existing behavior

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `cd apps/web && npx tsc --noEmit`: exits 0
- `npm run lint`: 1 successful, 1 cached — all workspaces pass
- Acceptance criteria:
  - `profit-first-actions.ts` exists in `apps/web/src/server/`; exports `createAccountAction`, `updateAccountAction`, `deleteAccountAction`, `updatePercentagesAction`; marked `'use server'`
  - `grep -c "Math.round" profit-first-actions.ts` returns 3 (pct→bp conversion present)
  - `pf-percentage-editor.tsx`: live total gated on `total === 100`; no `10000` in logic (comment only, documenting the pitfall guard)
  - Success toast `"Allocation percentages saved."` and `router.refresh()` present in editor
  - `pf-account-form.tsx` renders `PF_DEFAULT_COLORS` as swatches (5 references); `grep 'type="color"'` returns 0
  - Delete confirm button uses `variant="destructive"`, label "Delete Account"
  - `pf-overview.tsx` dropdown wires Edit + Delete (disabled with tooltip for non-CUSTOM)
  - `pf-content.tsx` has "Add Account" + "Edit Percentages" entry points

## Known Stubs

None — all plan goals achieved. No data flowing through empty/mock values.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced by this plan. All surfaces are UI mutations calling existing API endpoints from Plan 02 (authenticated via cookie-forwarded Bearer token). Threat mitigations applied:

| Threat ID | Mitigation Applied                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| T-03-05   | Number inputs bounded 0–100 in UI; server action converts to bp; API Zod re-validates                                      |
| T-03-06   | Account name in form/cards always text content; no dangerouslySetInnerHTML                                                 |
| T-03-07   | Delete disabled in dropdown for non-CUSTOM (UI convenience); `deleteAccountAction` server guard (Plan 02) is authoritative |
| T-03-11   | Color restricted to `PF_DEFAULT_COLORS` swatches; no free hex input                                                        |

## Self-Check: PASSED

- apps/web/src/server/profit-first-actions.ts: FOUND
- apps/web/src/app/(dashboard)/profit-first/\_components/pf-percentage-editor.tsx: FOUND
- apps/web/src/app/(dashboard)/profit-first/\_components/pf-account-form.tsx: FOUND
- apps/web/src/app/(dashboard)/profit-first/\_components/pf-overview.tsx: FOUND (updated)
- apps/web/src/app/(dashboard)/profit-first/\_components/pf-content.tsx: FOUND (updated)
- Commits ff4010e, a136d7c: verified in git log
