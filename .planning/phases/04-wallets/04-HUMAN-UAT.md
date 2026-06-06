---
status: partial
phase: 04-wallets
source: [04-VERIFICATION.md]
started: 2026-06-06T22:20:00Z
updated: 2026-06-06T22:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Create PROFIT_FIRST wallet + duplicate rejection
expected: With allocation accounts present, creating a PROFIT_FIRST wallet linked to an account succeeds; attempting a second wallet linked to the same account is rejected with a clear error
result: [pending]

### 2. Balance formula renders correctly in UI
expected: Wallet card and detail breakdown show PF allocation + mapped income − mapped expenses + deposits − withdrawals with real multi-source data
result: [pending]

### 3. Withdrawal button disabled-state proxy
expected: Withdrawal blocked-state hint correct when expense mapping exists but amounts are zero (UI uses mappedExpensesCents > 0 proxy; server enforces correctly)
result: [pending]

### 4. Soft-delete + restore end-to-end UI
expected: Deleted transaction shows greyed inline with Restore button; restore returns it to normal; balances update accordingly
result: [pending]

### 5. Pagination under real D1 data volume
expected: With >20 history entries, page 1 shows newest 20, page 2 shows remainder, page buttons reflect true total (confidence check of the SC-5 fix on real D1)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
