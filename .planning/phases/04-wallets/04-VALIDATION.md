---
phase: 4
slug: wallets
status: draft
nyquist_compliant: true
wave_0_complete: true
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

| Task ID | Plan  | Wave | Requirement         | Threat Ref                      | Secure Behavior                                                              | Test Type | Automated Command                                                                                                                                                                  | File Exists | Status     |
| ------- | ----- | ---- | ------------------- | ------------------------------- | ---------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 01-T1   | 04-01 | 0    | WAL-01..05 (schema) | T-04-03,T-04-04,T-04-05         | Unique indexes enforce one-wallet invariants; integer cents; no balance col  | typecheck | `cd packages/db && npx tsc --noEmit -p tsconfig.json`                                                                                                                              | ✅          | ⬜ pending |
| 01-T2   | 04-01 | 0    | WAL-01..05 (wiring) | T-04-01,T-04-02                 | Router self-guards requireAuth; BFF forwards Bearer; CORS verbs verified     | typecheck | `cd apps/api && npm run typecheck && cd ../web && npm run typecheck`                                                                                                               | ✅          | ⬜ pending |
| 01-T3   | 04-01 | 0    | WAL-01..05 (DB)     | T-04-SC                         | Additive migration applied to live local D1; test DDL mirrors schema         | unit      | `cd apps/api && npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'wallet%';" && npx vitest run tests/wallets.test.ts` | ✅ W0       | ⬜ pending |
| 02-T1a  | 04-02 | 1    | WAL-01, WAL-03      | T-04-06                         | CRUD + balance + list COUNT; `eq(wallets.userId)` scoping; no negative clamp | unit      | `cd apps/api && npx vitest run tests/wallets.test.ts && npm run typecheck`                                                                                                         | ✅          | ⬜ pending |
| 02-T1b  | 04-02 | 1    | WAL-02              | T-04-07,T-04-08,T-04-09         | Mapping conflict 409s; auto-deduct-all uniqueness; category ownership; D-08  | unit      | `cd apps/api && npx vitest run tests/wallets.test.ts && npm run typecheck`                                                                                                         | ✅          | ⬜ pending |
| 02-T2   | 04-02 | 1    | WAL-01, WAL-02      | T-04-10                         | Create form submits via Server Action; Zod-whitelisted fields                | typecheck | `cd apps/web && npm run typecheck && npm run lint`                                                                                                                                 | ✅          | ⬜ pending |
| 02-T3   | 04-02 | 1    | WAL-03              | T-04-06                         | List card grid; computed balances; D-16 dialog from `transactionCount`       | typecheck | `cd apps/web && npm run typecheck && npm run lint`                                                                                                                                 | ✅          | ⬜ pending |
| 03-T1   | 04-03 | 2    | WAL-04, WAL-05      | T-04-11,T-04-12,T-04-13,T-04-14 | assertCanInsertTransaction double-count guard; soft-delete; userId scoping   | unit      | `cd apps/api && npx vitest run tests/wallets.test.ts && npm run typecheck`                                                                                                         | ✅          | ⬜ pending |
| 03-T2   | 04-03 | 2    | WAL-04              | T-04-13                         | Transaction Server Actions revalidate detail path                            | typecheck | `cd apps/web && npm run typecheck && npm run lint`                                                                                                                                 | ✅          | ⬜ pending |
| 03-T3   | 04-03 | 2    | WAL-04, WAL-05      | T-04-15                         | Detail breakdown + paginated history; blocked Add buttons; inline restore    | typecheck | `cd apps/web && npm run typecheck && npm run lint`                                                                                                                                 | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

> File-Exists ✅ = the file is created/extended within this same task (interface-first or Wave 0 scaffold), so the automated command becomes runnable on task completion. 01-T3 is the Wave 0 (W0) gate that makes the `wallets.test.ts` scaffold live.

---

## Wave 0 Requirements

- [x] `apps/api/tests/wallets.test.ts` — stubs for WAL-01..WAL-05 service behaviors (created in 04-01 Task 3)
- [x] Test helpers for D1/Drizzle test database setup — `apps/api/tests/helpers/db.ts` DDL extended with the 4 wallet tables in 04-01 Task 3

---

## Manual-Only Verifications

| Behavior                                        | Requirement    | Why Manual                 | Test Instructions                                                                                   |
| ----------------------------------------------- | -------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| Wallet list/detail UI renders computed balances | WAL-03, WAL-05 | No web E2E harness in repo | Run dev servers, create wallet, record transactions, verify balance breakdown and paginated history |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`wallets.test.ts` scaffold + test DDL created in 04-01 Task 3, the [BLOCKING] Wave 0 gate)
- [x] No watch-mode flags (all commands use `vitest run` / `tsc --noEmit`)
- [x] Feedback latency < 60s (~30s estimated runtime)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete — Per-Task Verification Map filled; nyquist_compliant + wave_0_complete set true.
