---
status: complete
phase: 04-wallets
source: [04-VERIFICATION.md]
started: 2026-06-06T22:20:00Z
updated: 2026-06-06T23:00:00Z
---

## Current Test

[all tests executed via live browser session — Playwright-driven UAT against dev servers]

## Tests

### 1. Create PROFIT_FIRST wallet + duplicate rejection
expected: With allocation accounts present, creating a PROFIT_FIRST wallet linked to an account succeeds; attempting a second wallet linked to the same account is rejected with a clear error
result: pass — quick-create from empty state worked (after fix: ?pfAccountId now preselects PF type, commit 1f16678); duplicate prevented via disabled "(already linked)" option in selector; server 409 covered by unit test

### 2. Balance formula renders correctly in UI
expected: Wallet card and detail breakdown show PF allocation + mapped income − mapped expenses + deposits − withdrawals with real multi-source data
result: pass — Profit Wallet ₱750.00 (exactly 5% of ₱15,000 RECEIVED income); Ops Wallet ₱8,000.00 (₱10,000 mapped income − ₱2,000 mapped expenses); Cash Wallet tracked deposits exactly; breakdown hides zero rows (D-02)

### 3. Withdrawal button disabled-state proxy
expected: Withdrawal blocked-state hint correct when expense mapping exists but amounts are zero
result: pass (after fix, commit "blocked-state hints mirror server guard") — getById now returns mapping ids; UI derives blocked state from mapping presence, identical inputs to assertCanInsertTransaction; verified disabled with correct copy on zero-amount mapping

### 4. Soft-delete + restore end-to-end UI
expected: Deleted transaction shows greyed inline with Restore button; restore returns it to normal; balances update accordingly
result: pass — delete dialog with restore hint (D-12); row stayed inline with opacity-50 line-through text-muted-foreground + Restore button (D-09); balance excluded deleted (₱600→₱0) and restored (₱0→₱600)

### 5. Pagination under real D1 data volume
expected: With >20 history entries, page 1 shows newest 20, page 2 shows remainder, page buttons reflect true total
result: pass (after fix: nuqs shallow:false so page clicks re-fetch the RSC) — 25 transactions: page 1 = newest 20 descending (Jun 6 → May 6), page 2 = oldest 5 (May 5 → May 1), page buttons [1,2], totals exact

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None — all gaps found during UAT were fixed and committed in-session:
- fix(04): quick-create preselects PF type (D-04)
- fix(04): remove dead Edit link on detail header
- fix(04): pagination buttons re-fetch via shallow:false (D-10)
- feat(04): disable already-mapped categories in pickers (D-06)
- fix(04): blocked-state hints mirror server guard (zero-amount mapping case)
