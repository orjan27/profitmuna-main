---
phase: quick-260607-jcn
plan: '01'
subsystem: income-expenses-ui
tags: [bug-fix, client-state, router-refresh, react-hooks]
dependency_graph:
  requires: []
  provides: [income-list-live-update, expense-list-live-update, income-edit-live-update]
  affects: [income-overview, expenses-overview, edit-income-dialog]
tech_stack:
  added: []
  patterns: [useEffect-prop-sync, router-refresh-pattern]
key_files:
  created: []
  modified:
    - apps/web/src/app/(dashboard)/income/_components/income-overview.tsx
    - apps/web/src/app/(dashboard)/expenses/_components/expenses-overview.tsx
    - apps/web/src/app/(dashboard)/income/_components/edit-income-dialog.tsx
decisions:
  - 'useEffect keyed on initialData chosen over callback prop threading — keeps RSC pages and RecordSheet untouched; effect owns the page-0 baseline and fires whenever router.refresh() delivers a fresh prop'
  - 'router.refresh() added only on success paths in edit/delete — error paths do not trigger refresh to avoid confusing state transitions'
metrics:
  duration: '~5 min'
  completed: '2026-06-07T06:01:16Z'
  tasks_completed: 2
  tasks_total: 3
  files_modified: 3
---

# Phase quick-260607-jcn Plan 01: Fix newly-added income and expense records not appearing in lists Summary

**One-liner:** Re-sync income/expense accumulator state to fresh `initialData` prop via `useEffect`, and trigger `router.refresh()` after income edit/delete, so new/changed records appear immediately without a page reload.

---

## Tasks Completed

| Task | Name                                                                                       | Commit  | Files                                      |
| ---- | ------------------------------------------------------------------------------------------ | ------- | ------------------------------------------ |
| 1    | Re-sync income and expense overview state to fresh initialData after refresh               | 2601f27 | income-overview.tsx, expenses-overview.tsx |
| 2    | Trigger a route refresh after income edit/delete so the dialog change reflects immediately | d8e639b | edit-income-dialog.tsx                     |

---

## What Was Built

### Task 1 — useEffect prop-sync in income-overview.tsx and expenses-overview.tsx

Both client overview components seed their accumulator state (`items`/`expenses`, `currentPage`, `isLast`) with `useState(initialData.content)`. `useState` ignores prop changes after the initial mount, so `router.refresh()` calls from `RecordSheet` were delivering a fresh `initialData` from the re-rendered RSC parent — but the displayed list never updated.

Added a `useEffect` keyed on `[initialData]` to each component that re-syncs the three accumulator state slices:

```tsx
useEffect(() => {
  setItems(initialData.content); // income-overview.tsx
  setCurrentPage(initialData.page);
  setIsLast(initialData.last);
}, [initialData]);
```

```tsx
useEffect(() => {
  setExpenses(initialData.content); // expenses-overview.tsx
  setCurrentPage(initialData.page);
  setIsLast(initialData.last);
}, [initialData]);
```

The existing `handleFilterChange`, `handleLoadMore`, and `handleMutated` flows are unchanged. The effect resets to the page-0 baseline owned by the RSC parent — same behaviour as a full page reload, but without one.

### Task 2 — router.refresh() in edit-income-dialog.tsx

`updateIncomeAction` and `deleteIncomeAction` both call `revalidatePath('/income')` on success, but the dialog never triggered a client-side re-render of the RSC parent. Added `useRouter` from `next/navigation` and called `router.refresh()` on both success paths (after `toast.success` + `onClose()`), matching the pattern used in `RecordSheet.tsx`.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Pending Verification (Checkpoint — human-verify)

**Task 3 is a `checkpoint:human-verify` gate.** Per quick-task constraints, execution stops here and the orchestrator will relay the following steps to the user.

### What to verify

Run the app locally (dev API + web per local-dev-testing memory) and sign in as the seeded UAT user.

**Desktop (md+ width):**

1. Go to `/income`, click "Record income", record a new income, submit. Expected: new row appears in the list immediately (no reload), and the in-view total updates.
2. Go to `/expenses`, click "Record expense", record one, submit. Expected: new expense row appears immediately.
3. On `/income`, click an existing row to open the edit dialog, change the amount, Save Changes. Expected: updated amount shows in the list immediately. Then open a row and Delete it — it disappears immediately.

**Mobile (narrow width / device emulation):**

4. On `/income`, tap the floating + (RecordFab), record income in the sheet, submit. Expected: sheet closes and new row is visible immediately.
5. On `/expenses`, tap the floating +, record an expense, submit. Expected: new row visible immediately.

All five should pass with NO manual page refresh.

**Resume signal:** Reply "approved" if all flows show new/edited records immediately, or describe what still requires a refresh.

---

## Known Stubs

None.

---

## Threat Flags

None — changes are purely client-side React state management; no new network endpoints, auth paths, or schema changes.

---

## Self-Check

- [x] `2601f27` exists in git log
- [x] `d8e639b` exists in git log
- [x] `income-overview.tsx` contains `useEffect` and is importable
- [x] `expenses-overview.tsx` contains `useEffect` and is importable
- [x] `edit-income-dialog.tsx` contains 2x `router.refresh()`
- [x] TypeScript reports no errors in the three target files

## Self-Check: PASSED
