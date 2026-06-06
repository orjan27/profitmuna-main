---
status: partial
phase: 03-profit-first-allocation
source: [03-VERIFICATION.md]
started: 2026-06-06T21:05:00Z
updated: 2026-06-06T21:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end allocation summary page

expected: Four cards (Profit 5%, Owner Pay 50%, Tax 15%, Operating Expenses 30%) with green/purple/amber/red left borders respectively, after login and navigating to /profit-first.
result: [pending]

### 2. Amount visibility persistence

expected: Toggling the Eye icon shows amounts; localStorage key 'pf-amounts-visible' persists the state across reloads; SSR renders masked (no hydration flash).
result: [pending]

### 3. Date preset filter updates URL and data

expected: Clicking 'This Month' changes the URL to ?from=YYYY-MM-DD&to=YYYY-MM-DD; balances re-render without full page reload; the preset button shows the active variant.
result: [pending]

### 4. Percentage editor 100% gate

expected: Setting percentages to a 101% total shows red 'Total: 101% — must equal 100% to save' and the Save button is disabled.
result: [pending]

### 5. Custom account CRUD flow

expected: Create custom account (name, 0%, preset color) → appears in grid; edit → updates; delete via confirmation dialog → disappears. Success toasts for each operation.
result: [pending]

### 6. Default account delete protection

expected: Three-dot menu on the 'Profit' account shows Delete disabled with tooltip 'Default accounts cannot be deleted.'
result: [pending]

### 7. Category filter with real income

expected: After recording a RECEIVED+allocated income with a known category, the Income categories filter button opens a Sheet listing that category as a selectable checkbox; checking it updates the URL categoryIds param and the summary re-fetches scoped to it.
result: [pending]

### 8. Category filter empty-state

expected: With a fresh account that has no income, a disabled outline 'Income categories' button is visible with 'No income categories yet' helper text; the Sheet does not open.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
