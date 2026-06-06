---
phase: 05
slug: dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Framework**          | vitest 3.0.0 (apps/api)                                  |
| **Config file**        | apps/api/vitest.config.ts                                |
| **Quick run command**  | `npx vitest run tests/dashboard.test.ts` (from apps/api) |
| **Full suite command** | `npx vitest run` (from apps/api)                         |
| **Estimated runtime**  | ~20 seconds                                              |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/dashboard.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID             | Plan | Wave | Requirement | Threat Ref | Secure Behavior                             | Test Type | Automated Command                        | File Exists | Status     |
| ------------------- | ---- | ---- | ----------- | ---------- | ------------------------------------------- | --------- | ---------------------------------------- | ----------- | ---------- |
| (filled by planner) | —    | —    | DASH-01     | —          | dashboard data scoped to authenticated user | unit      | `npx vitest run tests/dashboard.test.ts` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/api/tests/dashboard.test.ts` — stubs for DASH-01 (summary aggregates, recent feed, user scoping)
- [ ] Reuse existing `apps/api/tests/helpers/db.ts` in-memory D1 helper — no new fixtures needed

---

## Manual-Only Verifications

| Behavior                                                              | Requirement | Why Manual                                   | Test Instructions                                                |
| --------------------------------------------------------------------- | ----------- | -------------------------------------------- | ---------------------------------------------------------------- |
| Dashboard renders totals, allocation balances, recent feed in browser | DASH-01     | Visual RSC composition — no web test harness | Log in, land on dashboard, verify cards + feed match seeded data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
