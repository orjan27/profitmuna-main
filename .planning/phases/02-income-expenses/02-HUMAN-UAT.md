---
status: partial
phase: 02-income-expenses
source: [02-VERIFICATION.md]
started: 2026-06-06T13:07:49Z
updated: 2026-06-06T13:07:49Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Income CRUD end-to-end

expected: Record income with category/amount/date/description/status; list filters by search, status, and date range; load-more appends rows; edit dialog updates a record; receive dialog marks PENDING income RECEIVED with a backdatable date; delete removes after confirm.
result: [pending]

### 2. Expense CRUD end-to-end

expected: Record expense with payment method; date-range filter works; soft-delete removes the row from active totals but shows it as restorable; restore returns it to the list and totals.
result: [pending]

### 3. Income category management

expected: System default categories appear seeded on first visit; creating a custom category works; renaming a category cascades the new name into existing income records; deleting an in-use category is blocked with a toast; system categories' edit/delete controls are disabled.
result: [pending]

### 4. Expense category management

expected: Same flow as income categories, for expenses — seeding, create, cascade rename, block-delete-in-use, system protection.
result: [pending]

### 5. Quick-add category affordance

expected: The "+" affordance in /income/new and /expenses/new creates a new category and selects it immediately without a page reload.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
