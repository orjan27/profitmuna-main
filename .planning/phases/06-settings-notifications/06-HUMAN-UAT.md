---
status: partial
phase: 06-settings-notifications
source: [06-VERIFICATION.md]
started: 2026-06-07T08:10:00.000Z
updated: 2026-06-07T08:10:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Currency selection app-wide rendering

expected: Log in, change currency to USD on /settings, Save, visit Income/Expenses/Wallets pages — all monetary amounts render with `$` and en-US formatting.
result: [pending]

### 2. Notification bell interaction

expected: With a test notification row inserted, the bell badge shows the unread count; the dropdown row shows unread styling + dot; clicking marks it read and navigates to its `link`; "Mark all read" clears the badge.
result: [pending]

### 3. Income reminder cron end-to-end

expected: With a daily reminder set at the current Manila hour, `curl "http://localhost:8793/cdn-cgi/handler/scheduled"` sends the Resend email and creates an INCOME_REMINDER notification row in D1.
result: [pending]

### 4. Pending income due dedup (live D1)

expected: A PENDING income due today triggers exactly one PENDING_INCOME_DUE notification (no email) and stamps `pendingDueNotifiedAt`; triggering the cron a second time creates no duplicate.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
