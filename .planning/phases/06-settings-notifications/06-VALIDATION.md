---
phase: 6
slug: settings-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| **Framework**          | vitest 3.0.0 (apps/api)                                           |
| **Config file**        | `apps/api/vitest.config.ts`                                       |
| **Quick run command**  | `npm run test --workspace=apps/api`                               |
| **Full suite command** | `npm run test --workspace=apps/api && npx tsc -b && npm run lint` |
| **Estimated runtime**  | ~30 seconds                                                       |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/api`
- **After every plan wave:** Run `npm run test --workspace=apps/api && npx tsc -b && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID                                  | Plan | Wave | Requirement                        | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status     |
| ---------------------------------------- | ---- | ---- | ---------------------------------- | ---------- | --------------- | --------- | ----------------- | ----------- | ---------- |
| _(filled by planner — one row per task)_ |      |      | SET-01, SET-02, NOTIF-01, NOTIF-02 |            |                 |           |                   |             | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/api/tests/` — test stubs for settings service (SET-01, SET-02), notification service (NOTIF-01), and cron due-user/Manila-hour logic (NOTIF-02)
- [ ] Test DB helper DDL kept in sync with new `notifications` table + `users` settings columns + `incomes.pendingDueNotifiedAt` (per RESEARCH.md)

_Existing vitest infrastructure (apps/api/tests/) covers the framework — no install needed._

---

## Manual-Only Verifications

| Behavior                                               | Requirement | Why Manual                           | Test Instructions                                                                                                         |
| ------------------------------------------------------ | ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Reminder email actually delivered via Resend           | NOTIF-02    | Requires live Resend API key + inbox | Configure schedule for current Manila hour, trigger `curl "http://localhost:8793/cdn-cgi/handler/scheduled"`, check inbox |
| Currency formatting visible across all screens         | SET-01      | Visual sweep across pages            | Change currency in settings, visit income/expense/allocation/wallet pages, confirm symbol/format updates                  |
| Notification center unread highlight + mark-as-read UX | NOTIF-01    | Visual/interaction                   | Generate notifications via cron trigger, open bell, verify unread styling, click → navigates + marks read                 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
