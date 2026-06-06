# Phase 2: Income & Expenses - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 2-income-expenses
**Areas discussed:** Default categories, List & form UX, Payment methods, Category management

---

## Default Categories

### Default income categories

| Option            | Description                                                                       | Selected |
| ----------------- | --------------------------------------------------------------------------------- | -------- |
| Business-flavored | Sales, Services, Capital, Loan, Other — fits Profit First's small-business origin |          |
| Personal-flavored | Salary, Freelance, Business, Gifts, Other — leans personal-finance                | ✓        |
| Minimal           | Just 'General' and 'Other'                                                        |          |
| You decide        | Claude picks during planning                                                      |          |

**User's choice:** Personal-flavored

### Income category `type` enum

| Option                 | Description                                           | Selected |
| ---------------------- | ----------------------------------------------------- | -------- |
| Drop it                | Categories are just named labels (name + system flag) | ✓        |
| Keep a simplified type | EARNED / PASSIVE / OTHER for future reporting         |          |
| You decide             | Claude picks during planning                          |          |

**User's choice:** Drop it

### Default expense categories

| Option              | Description                                                                | Selected |
| ------------------- | -------------------------------------------------------------------------- | -------- |
| Personal essentials | Housing, Food, Transportation, Utilities, Healthcare, Entertainment, Other | ✓        |
| Lean set            | Bills, Living, Leisure, Other                                              |          |
| Business-flavored   | Rent, Utilities, Supplies, Payroll, Marketing, Other                       |          |
| You decide          | Claude picks during planning                                               |          |

**User's choice:** Personal essentials

### Seeding timing

| Option                     | Description                                                                                                        | Selected |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| Lazy on first use          | Idempotent check-and-seed on first income/expense endpoint hit; covers existing Phase 1 users and all signup paths | ✓        |
| At registration + backfill | Hook register + Google-first-login, plus one-time migration                                                        |          |
| You decide                 | Claude picks during planning                                                                                       |          |

**User's choice:** Lazy on first use

---

## List & Form UX

### Add/edit interaction

| Option               | Description                                                    | Selected |
| -------------------- | -------------------------------------------------------------- | -------- |
| Match reference      | Separate /new pages for adding; edit in a dialog from the list | ✓        |
| Dialogs for both     | Add and edit both in dialogs                                   |          |
| Sheets (side panels) | Slide-over sheet for add/edit                                  |          |
| You decide           | Claude picks during planning                                   |          |

**User's choice:** Match reference

### Pagination

| Option           | Description                                     | Selected |
| ---------------- | ----------------------------------------------- | -------- |
| Numbered pages   | Prev/next + page numbers, state in URL via nuqs |          |
| Load more button | Append rows on demand                           | ✓        |
| Infinite scroll  | Auto-load on scroll                             |          |
| You decide       | Claude picks during planning                    |          |

**User's choice:** Load more button

### Search behavior

| Option                | Description                                                      | Selected |
| --------------------- | ---------------------------------------------------------------- | -------- |
| Debounced live search | Search as you type (~300ms) across description and category name | ✓        |
| Search on submit      | Type then press Enter                                            |          |
| You decide            | Claude picks during planning                                     |          |

**User's choice:** Debounced live search

### Interim currency display

| Option      | Description                                                                | Selected |
| ----------- | -------------------------------------------------------------------------- | -------- |
| ₱ hardcoded | Match reference's ₱ prefix; single lib/ formatting helper for Phase 6 swap | ✓        |
| $ hardcoded | USD symbol until Phase 6                                                   |          |
| No symbol   | Plain formatted numbers                                                    |          |
| You decide  | Claude picks during planning                                               |          |

**User's choice:** ₱ hardcoded

---

## Payment Methods

### Method list

| Option                | Description                                                   | Selected |
| --------------------- | ------------------------------------------------------------- | -------- |
| Same as reference     | Cash, GCash, Bank Transfer, Maya, Check                       | ✓        |
| Reference + cards     | Add Credit Card and Debit Card                                |          |
| Generic international | Cash, Bank Transfer, Credit Card, Debit Card, E-Wallet, Check |          |
| You decide            | Claude picks during planning                                  |          |

**User's choice:** Same as reference

### Validation

| Option               | Description                                                       | Selected |
| -------------------- | ----------------------------------------------------------------- | -------- |
| Optional + validated | Optional field; Zod accepts only the 5 known values when provided | ✓        |
| Optional free text   | Exact reference behavior — any string accepted                    |          |
| Required + validated | Every expense must have a method                                  |          |
| You decide           | Claude picks during planning                                      |          |

**User's choice:** Optional + validated

---

## Category Management

### Management surface

| Option                  | Description                                                                    | Selected |
| ----------------------- | ------------------------------------------------------------------------------ | -------- |
| Inline + manage dialog  | 'Manage categories' dialog on income/expense pages + '+ new category' in forms | ✓        |
| Dedicated settings page | A /categories page listing both sets                                           |          |
| Inline only             | Only '+ new category' in forms                                                 |          |
| You decide              | Claude picks during planning                                                   |          |

**User's choice:** Inline + manage dialog

### Delete category in use

| Option            | Description                                              | Selected |
| ----------------- | -------------------------------------------------------- | -------- |
| Block if in use   | Error directs user to reassign/delete records first      | ✓        |
| Allow, keep names | Reference behavior — delete proceeds, categoryId dangles |          |
| Reassign to Other | Transactions move to system 'Other'                      |          |
| You decide        | Claude picks during planning                             |          |

**User's choice:** Block if in use

### Rename cascade

| Option            | Description                                                   | Selected |
| ----------------- | ------------------------------------------------------------- | -------- |
| Update everywhere | Rename cascades to denormalized categoryName on existing rows | ✓        |
| Keep snapshot     | Old transactions keep recorded name                           |          |
| You decide        | Claude picks during planning                                  |          |

**User's choice:** Update everywhere

### Receive-income flow

| Option            | Description                                                            | Selected |
| ----------------- | ---------------------------------------------------------------------- | -------- |
| Confirm dialog    | Dialog with received date defaulting to today (editable), then confirm | ✓        |
| One-click receive | Immediately sets receivedDate = today                                  |          |
| You decide        | Claude picks during planning                                           |          |

**User's choice:** Confirm dialog

---

## Claude's Discretion

- Soft-deleted expense surfacing/restore UI pattern
- Empty states, loading skeletons, list overview/totals headers
- Exact Zod limits, DB indexes, pagination page size
- Confirm dialog for income hard-delete

## Deferred Ideas

None — discussion stayed within phase scope.
