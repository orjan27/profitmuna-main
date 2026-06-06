---
phase: 2
slug: income-expenses
status: approved
nyquist_compliant: true
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

| Task ID  | Plan  | Wave | Requirement            | Threat Ref        | Secure Behavior                                                                           | Test Type      | Automated Command                                                                        | File Exists | Status     |
| -------- | ----- | ---- | ---------------------- | ----------------- | ----------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------- | ----------- | ---------- |
| 02-01-01 | 02-01 | 0    | infra (all)            | —                 | N/A (schema + applied migration)                                                          | migration      | `cd packages/db && npx drizzle-kit generate` + `wrangler d1 migrations apply DB --local` | ✅          | ⬜ pending |
| 02-01-02 | 02-01 | 0    | infra (all)            | T-02-01 / T-02-02 | All new routes mounted behind requireAuth; CORS stays scoped                              | typecheck+unit | `cd apps/api && npm run typecheck && npm run test`                                       | ✅          | ⬜ pending |
| 02-01-03 | 02-01 | 0    | infra (all)            | —                 | `apiFetch` is server-only (Bearer token never reaches client)                             | typecheck      | `cd apps/web && npm run typecheck && cd ../api && npm run typecheck`                     | ✅          | ⬜ pending |
| 02-02-01 | 02-02 | 1    | INC-01..05             | T-02-05 / T-02-08 | userId-scoped queries (404 on foreign id); receive schema excludes `profitFirstAllocated` | unit (tdd)     | `cd apps/api && npm run test -- income && npm run typecheck`                             | ❌ W1       | ⬜ pending |
| 02-02-02 | 02-02 | 1    | INC-01, INC-02         | —                 | Filters validated via Zod query schema                                                    | typecheck+lint | `cd apps/web && npm run typecheck && npm run lint`                                       | ❌ W1       | ⬜ pending |
| 02-02-03 | 02-02 | 1    | INC-03, INC-04, INC-05 | T-02-08           | Receive action sends only `receivedDate`                                                  | typecheck+lint | `cd apps/web && npm run typecheck && npm run lint`                                       | ❌ W1       | ⬜ pending |
| 02-03-01 | 02-03 | 1    | EXP-01..04             | T-02-10           | userId-scoped queries; payment method enum-validated (D-10)                               | unit (tdd)     | `cd apps/api && npm run test -- expense && npm run typecheck`                            | ❌ W1       | ⬜ pending |
| 02-03-02 | 02-03 | 1    | EXP-01, EXP-02         | —                 | Date-range filter validated via Zod query schema                                          | typecheck+lint | `cd apps/web && npm run typecheck && npm run lint`                                       | ❌ W1       | ⬜ pending |
| 02-03-03 | 02-03 | 1    | EXP-03, EXP-04         | —                 | Soft-delete/restore authorized by userId scope                                            | typecheck+lint | `cd apps/web && npm run typecheck && npm run lint`                                       | ❌ W1       | ⬜ pending |
| 02-04-01 | 02-04 | 2    | INC-06, EXP-05         | T-02-16 / T-02-17 | userId-scoped category CRUD; `system` not mass-assignable; block-delete-in-use            | unit (tdd)     | `cd apps/api && npm run test -- category && npm run typecheck`                           | ❌ W2       | ⬜ pending |
| 02-04-02 | 02-04 | 2    | INC-06, EXP-05         | —                 | System categories show no delete affordance                                               | typecheck+lint | `cd apps/web && npm run typecheck && npm run lint`                                       | ❌ W2       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_
_File Exists: ❌ W1/W2 = test file is created by that wave's own task (interface-first; `createTestDb` helper lands in Wave 0 task 02-01-03)._

---

## Wave 0 Requirements

- [ ] `apps/api/tests/helpers/test-db.ts` (`createTestDb` in-memory D1 helper) — created in plan 02-01 Task 3
- [x] Existing vitest infrastructure in `apps/api` covers the runner; no framework install needed

---

## Manual-Only Verifications

| Behavior                                                   | Requirement    | Why Manual                               | Test Instructions                                                        |
| ---------------------------------------------------------- | -------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| Income slice end-to-end in browser (record/browse/receive) | INC-01..05     | Visual/UX checkpoint (plan 02-02 task 4) | Run dev servers, record income, filter list, mark RECEIVED, edit, delete |
| Expense slice end-to-end in browser                        | EXP-01..04     | Visual/UX checkpoint (plan 02-03 task 4) | Record expense with payment method, filter by date, soft-delete, restore |
| Category management dialog                                 | INC-06, EXP-05 | Visual/UX checkpoint (plan 02-04 task 3) | Create/rename/delete custom category; confirm system defaults protected  |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-06 (plan-checker pass; `wave_0_complete` flips during execute-phase)
