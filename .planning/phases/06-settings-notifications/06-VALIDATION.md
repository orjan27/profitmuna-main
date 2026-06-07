---
phase: 6
slug: settings-notifications
status: planned
nyquist_compliant: true
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

| Task ID | Plan  | Wave | Requirement     | Threat Ref                     | Secure Behavior                                       | Test Type        | Automated Command                                            | File Exists | Status     |
| ------- | ----- | ---- | --------------- | ------------------------------ | ----------------------------------------------------- | ---------------- | ------------------------------------------------------------ | ----------- | ---------- |
| 06-01-1 | 06-01 | 0    | SET/NOTIF infra | T-6-01, T-6-02                 | Additive migration only; live-DB verified             | CLI (wrangler)   | `npx wrangler d1 execute DB --local ...` (MIGRATION_OK)      | ❌ new      | ⬜ pending |
| 06-01-2 | 06-01 | 0    | SET/NOTIF infra | T-6-02                         | Test DDL mirrors schema                               | source assertion | grep DDL + test files (SCAFFOLD_OK)                          | ❌ new      | ⬜ pending |
| 06-01-3 | 06-01 | 0    | SET-01          | —                              | No call-site breakage                                 | type-check       | `npx tsc -b apps/web/tsconfig.json` (TYPES_OK)               | ❌ new      | ⬜ pending |
| 06-02-1 | 06-02 | 1    | SET-01, SET-02  | T-6-03, T-6-04                 | requireAuth + userId scope; Zod bounds                | unit (vitest)    | `npm run test --workspace=apps/api -- --run settings`        | ❌ Wave 0   | ⬜ pending |
| 06-02-2 | 06-02 | 1    | SET-01, SET-02  | T-6-04                         | Validated form → BFF; conditional schedule fields     | type-check       | `npx tsc -b apps/web/tsconfig.json` (SETTINGS_UI_OK)         | ❌ new      | ⬜ pending |
| 06-02-3 | 06-02 | 1    | SET-01          | —                              | PHP fallback on layout fetch error                    | type-check+lint  | `npx tsc -b apps/web/tsconfig.json && npm run lint`          | ❌ new      | ⬜ pending |
| 06-03-1 | 06-03 | 1    | NOTIF-01        | T-6-06, T-6-07, T-6-08, T-6-09 | requireAuth; dual id+userId predicate; query bounds   | unit (vitest)    | `npm run test --workspace=apps/api -- --run notification`    | ❌ Wave 0   | ⬜ pending |
| 06-03-2 | 06-03 | 1    | NOTIF-01        | —                              | Optimistic mark-read; exact UI-SPEC copy              | type-check       | `npx tsc -b apps/web/tsconfig.json` (NOTIF_UI_OK)            | ❌ new      | ⬜ pending |
| 06-03-3 | 06-03 | 1    | NOTIF-01        | T-6-09                         | SSR unread count, try/catch fallback                  | type-check+lint  | `npx tsc -b apps/web/tsconfig.json && npm run lint`          | ❌ new      | ⬜ pending |
| 06-04-1 | 06-04 | 2    | NOTIF-02        | T-6-10, T-6-11, T-6-12, T-6-13 | No module-scope env; isNull dedup; per-item try/catch | unit (vitest)    | `npm run test --workspace=apps/api -- --run cron`            | ❌ Wave 0   | ⬜ pending |
| 06-04-2 | 06-04 | 2    | NOTIF-02        | T-6-10                         | Reminder email no PII in logs                         | unit (vitest)    | `npm run test --workspace=apps/api -- --run cron` (EMAIL_OK) | ❌ new      | ⬜ pending |
| 06-04-3 | 06-04 | 2    | NOTIF-02        | T-6-13                         | Module Worker scheduled export; waitUntil             | full suite       | `npm run test --workspace=apps/api` (CRON_WIRED_OK)          | ❌ new      | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `apps/api/tests/` — test stubs for settings service (SET-01, SET-02), notification service (NOTIF-01), and cron due-user/Manila-hour logic (NOTIF-02) — planned in 06-01 Task 2
- [x] Test DB helper DDL kept in sync with new `notifications` table + `users` settings columns + `incomes.pendingDueNotifiedAt` — planned in 06-01 Task 2

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned
