---
phase: 2
slug: income-expenses
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| **Framework**          | vitest 3.0.0 (apps/api)                                                  |
| **Config file**        | `apps/api/vitest.config.ts`                                              |
| **Quick run command**  | `npm run test --workspace=apps/api`                                      |
| **Full suite command** | `npm run test --workspace=apps/api && npm run typecheck && npm run lint` |
| **Estimated runtime**  | ~30 seconds                                                              |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/api`
- **After every plan wave:** Run `npm run test --workspace=apps/api && npm run typecheck && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID                                   | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status     |
| ----------------------------------------- | ---- | ---- | ----------- | ---------- | --------------- | --------- | ----------------- | ----------- | ---------- |
| _Populated by planner — one row per task_ |      |      |             |            |                 |           |                   |             | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] Test stubs for income/expense/category services — to be determined by planner from RESEARCH.md Validation Architecture
- [ ] Existing vitest infrastructure in `apps/api` covers the runner; no framework install needed

---

## Manual-Only Verifications

| Behavior               | Requirement | Why Manual | Test Instructions |
| ---------------------- | ----------- | ---------- | ----------------- |
| _Populated by planner_ |             |            |                   |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
