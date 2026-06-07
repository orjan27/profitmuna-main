---
phase: quick-260607-jcn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/app/(dashboard)/income/_components/income-overview.tsx
  - apps/web/src/app/(dashboard)/expenses/_components/expenses-overview.tsx
  - apps/web/src/app/(dashboard)/income/_components/edit-income-dialog.tsx
autonomous: false
requirements:
  - QUICK-260607-jcn
must_haves:
  truths:
    - 'After recording income via the mobile RecordFab/RecordSheet, the new row appears in the income list without a page reload'
    - 'After recording income via the desktop Record button/RecordSheet, the new row appears in the income list without a page reload'
    - 'After recording an expense via the mobile or desktop RecordSheet, the new row appears in the expense list without a page reload'
    - 'After editing an income record via the edit dialog, the change appears in the income list without a page reload'
  artifacts:
    - path: 'apps/web/src/app/(dashboard)/income/_components/income-overview.tsx'
      provides: 'useEffect sync of items/page/last state to fresh initialData prop'
      contains: 'useEffect'
    - path: 'apps/web/src/app/(dashboard)/expenses/_components/expenses-overview.tsx'
      provides: 'useEffect sync of expenses/page/last state to fresh initialData prop'
      contains: 'useEffect'
    - path: 'apps/web/src/app/(dashboard)/income/_components/edit-income-dialog.tsx'
      provides: 'router.refresh() after successful update/delete'
      contains: 'router.refresh'
  key_links:
    - from: 'RecordSheet.handleSubmit'
      to: 'IncomeOverview / ExpensesOverview state'
      via: 'router.refresh() re-renders RSC parent → new initialData prop → useEffect re-syncs accumulator'
      pattern: 'useEffect'
---

<objective>
Fix the bug where newly created income and expense records do not appear in their lists until a manual page refresh, in both the desktop inline Record flow and the mobile RecordFab/RecordSheet flow.

Purpose: Restore the core expectation that a recorded entry shows up immediately. The data is already being re-fetched on the server (the Record sheet calls `router.refresh()` and the server actions call `revalidatePath`); the list just never re-syncs its client state to the freshly fetched server prop.

Output: Two overview components that re-sync their accumulated-list state to fresh `initialData` after a `router.refresh()`, plus the income edit dialog triggering that refresh.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

<root_cause>
Both list pages are React Server Components (`income/page.tsx`, `expenses/page.tsx`) that fetch a page of records and pass it as `initialData` to a client overview component. The client component seeds its accumulator state ONCE:

const [items, setItems] = useState<Income[]>(initialData.content); // income-overview.tsx
const [expenses, setExpenses] = useState<ExpenseRow[]>(initialData.content); // expenses-overview.tsx

After a create, `RecordSheet` (IncomeEntryForm / ExpenseEntryForm) calls `router.refresh()`, and the record-sheet server actions call `revalidatePath('/income'|'/expenses'|...)`. This DOES re-run the RSC parent and produce a new `initialData` prop containing the new record — but `useState` ignores prop changes after the first render, so the displayed list never updates. The new record only appears after a full reload (fresh mount → fresh `useState`).

Same gap blocks the income EDIT dialog: `updateIncomeAction`/`deleteIncomeAction` call `revalidatePath('/income')` but the dialog never calls `router.refresh()`, and even if it did, the sync gap would swallow it.

Expense EDIT already works because `EditExpenseDialog` calls `onMutated()` → `handleMutated()` refetches page 0 into state. The expense CREATE path (RecordSheet) does NOT go through `onMutated` — it only calls `router.refresh()`, which the sync gap swallows. So expenses also need the prop-sync fix.
</root_cause>

<fix_strategy>
Canonical Next.js App Router pattern: when client state is derived from an RSC prop that can change via `router.refresh()`, re-sync that state in an effect keyed on the prop. Sync only the page-0 baseline (`initialData.content`), because that is what the RSC always returns and what `router.refresh()` regenerates. Load-more accumulation past page 0 is intentionally transient and is reset by a refresh — acceptable and matches the existing filter-change reset behavior.
</fix_strategy>

<interfaces>
income-overview.tsx state (current):
  const [items, setItems] = useState<Income[]>(initialData.content);
  const [currentPage, setCurrentPage] = useState(initialData.page);
  const [isLast, setIsLast] = useState(initialData.last);

expenses-overview.tsx state (current):
const [expenses, setExpenses] = useState<ExpenseRow[]>(initialData.content);
const [currentPage, setCurrentPage] = useState(initialData.page);
const [isLast, setIsLast] = useState(initialData.last);

edit-income-dialog.tsx already imports nothing from next/navigation; add useRouter from 'next/navigation' (pattern used in RecordSheet.tsx).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Re-sync income and expense overview state to fresh initialData after refresh</name>
  <files>apps/web/src/app/(dashboard)/income/_components/income-overview.tsx, apps/web/src/app/(dashboard)/expenses/_components/expenses-overview.tsx</files>
  <action>
In income-overview.tsx: add `useEffect` to the existing `react` import. After the three accumulator `useState` declarations (items/currentPage/isLast), add an effect that re-syncs them to the incoming `initialData` whenever that prop changes:

useEffect(() => {
setItems(initialData.content);
setCurrentPage(initialData.page);
setIsLast(initialData.last);
}, [initialData]);

This makes a `router.refresh()` (fired by the Record sheet after a successful create) flow through to the displayed list. The RSC parent (`income/page.tsx`) re-runs on refresh and returns a fresh `initialData` object, so the effect fires and the new record renders. The existing `handleFilterChange` reset and `handleLoadMore` append logic are unchanged — page-0/refresh is the baseline this effect owns.

In expenses-overview.tsx: same change. Add `useEffect` to the `react` import (currently `useState, useTransition, useCallback`). After the expenses/currentPage/isLast `useState` declarations, add:

useEffect(() => {
setExpenses(initialData.content);
setCurrentPage(initialData.page);
setIsLast(initialData.last);
}, [initialData]);

This fixes the expense CREATE path (RecordSheet → router.refresh()), which never went through the existing `onMutated` callback. The `applyFilter`, `handleLoadMore`, and `handleMutated` flows remain unchanged.

Do NOT change the RSC pages, the server actions, or RecordSheet — they already re-fetch correctly; the only defect is the client never re-syncing to the new prop. Do NOT add any new dependency. Keep imports ordered per project convention (external before internal).
</action>
<verify>
<automated>cd /home/orjanbognot/projects/orjan/profitmuna-main && npx tsc -p apps/web/tsconfig.json --noEmit 2>&1 | grep -E "income-overview|expenses-overview" ; test $? -ne 0 && echo "NO_TYPE_ERRORS_IN_TARGET_FILES"</automated>
</verify>
<done>Both overview components import and use `useEffect` keyed on `[initialData]` that resets the accumulator (content/page/last) to the prop. `npx tsc -p apps/web/tsconfig.json --noEmit` reports no new errors in these two files.</done>
</task>

<task type="auto">
  <name>Task 2: Trigger a route refresh after income edit/delete so the dialog change reflects immediately</name>
  <files>apps/web/src/app/(dashboard)/income/_components/edit-income-dialog.tsx</files>
  <action>
The income edit dialog mutates via `updateIncomeAction`/`deleteIncomeAction` (which call `revalidatePath('/income')`) but never tells the router to re-render the RSC parent, so the change does not surface until reload. With Task 1's prop-sync in place, a `router.refresh()` will now propagate.

Import `useRouter` from `'next/navigation'` (same pattern as RecordSheet.tsx). Inside `EditIncomeDialog`, create `const router = useRouter();`. In `handleUpdate`, after the success path (`toast.success('Income updated.'); onClose();`) add `router.refresh();`. In `handleDelete`, after the success path (`toast.success('Income deleted.'); onClose();`) add `router.refresh();`. Do not call refresh on the error paths.

This mirrors how RecordSheet's IncomeEntryForm/ExpenseEntryForm already finish (toast → close → router.refresh()). Do not add dependencies; do not touch IncomeForm or the actions.
</action>
<verify>
<automated>cd /home/orjanbognot/projects/orjan/profitmuna-main && grep -v '^[[:space:]]\*//' "apps/web/src/app/(dashboard)/income/\_components/edit-income-dialog.tsx" | grep -c "router.refresh()"</automated>
</verify>
<done>`edit-income-dialog.tsx` imports `useRouter`, instantiates `router`, and calls `router.refresh()` on both the successful update and successful delete paths (grep count >= 2). No new dependencies added.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Income and expense lists now re-sync to freshly re-fetched server data after a create (RecordSheet, mobile + desktop) and after an income edit/delete. The underlying re-fetch (router.refresh + revalidatePath) was already firing; the lists were ignoring the new data because client state was seeded once from a prop.
  </what-built>
  <how-to-verify>
Run the app locally (dev API + web per local-dev-testing memory) and sign in as the seeded UAT user.

Desktop (md+ width):

1. Go to /income, click "Record income", record a new income, submit. Expected: the new row appears in the list immediately (no reload), and the in-view total updates.
2. Go to /expenses, click "Record expense", record one, submit. Expected: new expense row appears immediately.
3. On /income, click an existing row to open the edit dialog, change the amount, Save Changes. Expected: the updated amount shows in the list immediately. Then open a row and Delete it — it disappears immediately.

Mobile (narrow width / device emulation): 4. On /income, tap the floating + (RecordFab), record income in the sheet, submit. Expected: sheet closes and the new row is visible immediately. 5. On /expenses, tap the floating +, record an expense, submit. Expected: new row visible immediately.

All five should work with NO manual page refresh.
</how-to-verify>
<resume-signal>Type "approved" if all flows show new/edited records immediately, or describe what still requires a refresh.</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc -p apps/web/tsconfig.json --noEmit` reports no new type errors.
- `npm run lint` passes (no unused-import or hook-deps violations introduced).
- Manual checkpoint confirms create (mobile + desktop) and income edit/delete reflect immediately.
</verification>

<success_criteria>

- Recording income or an expense through the RecordSheet (mobile RecordFab and desktop Record button) shows the new record in the relevant list with no page reload.
- Editing or deleting an income record via the edit dialog reflects in the list with no page reload.
- No new dependencies; changes confined to the two overview components and the income edit dialog; RSC pages, server actions, and RecordSheet untouched.
  </success_criteria>

<output>
Create `.planning/quick/260607-jcn-fix-newly-added-income-and-expense-recor/260607-jcn-SUMMARY.md` when done.
</output>
