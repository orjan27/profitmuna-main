---
phase: 4
slug: wallets
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| **Framework**          | vitest 3.0.0                        |
| **Config file**        | `apps/api/vitest.config.ts`         |
| **Quick run command**  | `npm run test --workspace=apps/api` |
| **Full suite command** | `npx turbo test typecheck lint`     |
| **Estimated runtime**  | ~30 seconds                         |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/api`
- **After every plan wave:** Run `npx turbo test typecheck lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID             | Plan | Wave | Requirement    | Threat Ref | Secure Behavior | Test Type | Automated Command                   | File Exists | Status     |
| ------------------- | ---- | ---- | -------------- | ---------- | --------------- | --------- | ----------------------------------- | ----------- | ---------- |
| (filled by planner) | —    | —    | WAL-01..WAL-05 | —          | —               | unit      | `npm run test --workspace=apps/api` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/api/tests/wallets.test.ts` — stubs for WAL-01..WAL-05 service behaviors
- [ ] Test helpers for D1/Drizzle test database setup (reuse existing patterns from `apps/api/tests/`)

---

## Manual-Only Verifications

| Behavior                                        | Requirement    | Why Manual                 | Test Instructions                                                                                   |
| ----------------------------------------------- | -------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| Wallet list/detail UI renders computed balances | WAL-03, WAL-05 | No web E2E harness in repo | Run dev servers, create wallet, record transactions, verify balance breakdown and paginated history |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
