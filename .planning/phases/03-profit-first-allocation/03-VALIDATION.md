---
phase: 3
slug: profit-first-allocation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Framework**          | Vitest 3.0.0                                                                  |
| **Config file**        | `apps/api/vitest.config.ts`                                                   |
| **Quick run command**  | `cd apps/api && npx vitest run --reporter=verbose tests/profit-first.test.ts` |
| **Full suite command** | `npm run test` (turbo runs all workspaces)                                    |
| **Estimated runtime**  | ~30 seconds                                                                   |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run tests/profit-first.test.ts`
- **After every plan wave:** Run `npm run test` (full turbo suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior                                 | Test Type | Automated Command                                                                           | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ---------- | ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- | ----------- | ---------- |
| TBD     | TBD  | TBD  | PF-01       | —          | seeding scoped to the registering user only     | unit      | `npx vitest run tests/profit-first.test.ts -t "seeds default accounts on register"`         | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PF-01       | —          | Google OAuth seeds only on new-user branch      | unit      | `npx vitest run tests/profit-first.test.ts -t "seeds on Google OAuth first login"`          | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PF-02       | —          | rejects percentage totals != 10000 bp           | unit      | `npx vitest run tests/profit-first.test.ts -t "rejects percentages not summing to 10000"`   | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PF-02       | —          | accepts valid distribution summing to 10000 bp  | unit      | `npx vitest run tests/profit-first.test.ts -t "accepts valid percentage distribution"`      | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PF-03       | —          | rejects account creation exceeding 100%         | unit      | `npx vitest run tests/profit-first.test.ts -t "rejects account creation that exceeds 100%"` | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PF-03       | —          | default (non-CUSTOM) accounts cannot be deleted | unit      | `npx vitest run tests/profit-first.test.ts -t "cannot delete default account"`              | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PF-04       | —          | integer-only balance math, no float drift       | unit      | `npx vitest run tests/profit-first.test.ts -t "computes balance with integer math"`         | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PF-04       | —          | PENDING income excluded from balances           | unit      | `npx vitest run tests/profit-first.test.ts -t "excludes PENDING income from balance"`       | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | PF-04       | —          | date range / category filters scoped to user    | unit      | `npx vitest run tests/profit-first.test.ts -t "applies date range filter"`                  | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/api/tests/profit-first.test.ts` — stubs covering PF-01 through PF-04 service unit tests
- [ ] `apps/api/tests/helpers/db.ts` — extend DDL with `profit_first_accounts` table and seeder helpers
- [ ] `apps/web/src/lib/format-currency.ts` — needed for display in UI tests (if any)

---

## Manual-Only Verifications

| Behavior                                                      | Requirement | Why Manual                                                | Test Instructions                                                                                        |
| ------------------------------------------------------------- | ----------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Allocation summary page renders derived balances with filters | PF-04       | Visual rendering across filters not covered by unit tests | Log in, open allocation summary, apply date range + category filter, confirm per-account balances update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
