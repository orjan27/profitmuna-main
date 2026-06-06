---
phase: 04-wallets
plan: 01
subsystem: wallets-foundation
tags: [schema, migration, bff-proxy, zod-schemas, types, test-scaffold]
dependency_graph:
  requires: [03-01, 03-02, 03-03, 02-01, 02-02]
  provides:
    [
      wallets-schema,
      wallets-migration,
      wallets-bff-proxy,
      wallets-zod-schemas,
      wallets-web-types,
      wallet-labels,
      wallets-test-scaffold,
    ]
  affects: [packages/db/src/schema.ts, apps/api/src/index.ts, apps/api/tests/helpers/db.ts]
tech_stack:
  added: []
  patterns:
    - Drizzle sqliteTable with third-argument index array (uniqueIndex + index)
    - Hono stub router with walletsRouter.use('/*', requireAuth) at router level
    - Next.js 15 BFF catch-all proxy (5 verbs) with await cookies() and Bearer forwarding
    - it.todo test scaffold for Wave 0 requirements
key_files:
  created:
    - packages/db/migrations/0003_natural_mauler.sql
    - apps/api/src/schemas/wallets.ts
    - apps/api/src/routes/wallets.ts
    - apps/web/src/app/api/wallets/[...path]/route.ts
    - apps/web/src/types/wallet.ts
    - apps/web/src/lib/wallet-labels.ts
    - apps/api/tests/wallets.test.ts
  modified:
    - packages/db/src/schema.ts
    - apps/api/src/index.ts
    - apps/api/tests/helpers/db.ts
decisions:
  - 'wallets_user_pf_account_unique index on (userId, profitFirstAccountId) — enforces one wallet per PF account at DB level (WAL-01 D-01)'
  - 'profitFirstAccountId FK has no onDelete cascade — wallet delete-guard in Plan 02 service can block it (D-16)'
  - '(dashboard) layout already existed from Phases 2/3 — left unchanged'
  - 'format-currency.ts already had both formatCurrency and toCents — left unchanged'
  - 'CORS allowMethods already had all 5 verbs from Phase 2 — only verified, no change'
  - 'walletsRouter uses self-contained requireAuth at router level matching profitFirstRouter pattern (T-04-01)'
metrics:
  duration: '~6 minutes active'
  completed: '2026-06-06'
  tasks: 3
  files: 10
---

# Phase 04 Plan 01: Wallet Foundation Slice Summary

**One-liner:** Four wallet DB tables with additive migration, authenticated BFF proxy (5 verbs), stub router behind requireAuth, Zod request schemas, web TypeScript contracts, wallet-labels utility, and WAL-01..05 test scaffold.

---

## Tasks Completed

| Task | Name                                                                               | Commit    | Files                                                                                                                                                                                                                |
| ---- | ---------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Add 4 wallet schema tables to Drizzle schema                                       | `1e0461c` | `packages/db/src/schema.ts`                                                                                                                                                                                          |
| 2    | Zod schemas, web types, lib utilities, BFF proxy, stub router + mount, CORS verify | `d9fed5a` | `apps/api/src/schemas/wallets.ts`, `apps/api/src/routes/wallets.ts`, `apps/api/src/index.ts`, `apps/web/src/app/api/wallets/[...path]/route.ts`, `apps/web/src/types/wallet.ts`, `apps/web/src/lib/wallet-labels.ts` |
| 3    | [BLOCKING] Generate + apply migration; extend test DDL + wallets test scaffold     | `64f559d` | `packages/db/migrations/0003_natural_mauler.sql`, `apps/api/tests/helpers/db.ts`, `apps/api/tests/wallets.test.ts`                                                                                                   |

---

## Verification Results

- `cd packages/db && npx tsc --noEmit` — passed (0 errors)
- `cd apps/api && npm run typecheck` — passed (0 errors)
- `cd apps/web && npm run typecheck` — passed (0 errors)
- `wrangler d1 execute DB --local` — confirmed all 4 wallet tables present in live local D1
- `npx vitest run tests/wallets.test.ts` — 28 todo (all green, non-failing)
- `cd apps/api && npm run test` — 138 passed, 28 todo (full suite green)

---

## Deviations from Plan

None — plan executed exactly as written.

Additional notes:

- `(dashboard)/layout.tsx` already existed from Phase 3 — left untouched (plan Branch A: leave unchanged)
- `apps/web/src/lib/format-currency.ts` already exported `formatCurrency` and `toCents` — left unchanged (plan: extend only if missing)
- `apps/api/src/index.ts` CORS `allowMethods` already contained all 5 verbs (`['GET', 'POST', 'PUT', 'DELETE', 'PATCH']`) from Phase 2 — only verified, no modification needed

---

## Threat Surface Scan

No new network endpoints beyond what was planned. The following planned mitigations are in place:

| Threat ID | Mitigation                                                                                              | Status                 |
| --------- | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| T-04-01   | `walletsRouter.use('/*', requireAuth)` applied at router level                                          | Applied in Task 2      |
| T-04-02   | CORS `allowMethods` verified (no wildcard added)                                                        | Verified in Task 2     |
| T-04-03   | `wallets_user_pf_account_unique`, `wicm_income_category_unique`, `wecm_expense_category_unique` indexes | Applied in Tasks 1 + 3 |
| T-04-04   | `amount` stored as integer (cents); Zod `z.number().positive()`                                         | Applied in Tasks 1 + 2 |
| T-04-05   | `color: z.string().regex(/^#[0-9a-fA-F]{6}$/)` in createWalletSchema                                    | Applied in Task 2      |

---

## Known Stubs

- `apps/api/src/routes/wallets.ts` — stub router with no route handlers (intentional; Plans 02 and 03 fill in handlers)
- `apps/api/tests/wallets.test.ts` — 28 `it.todo` entries (intentional; Plans 02 and 03 convert to real assertions)

These stubs are by design for this Wave 0 foundation plan. They do not prevent the plan goal (spine + contracts) from being achieved.

---

## Self-Check: PASSED

Files created/verified present:

- packages/db/migrations/0003_natural_mauler.sql — FOUND
- apps/api/src/schemas/wallets.ts — FOUND
- apps/api/src/routes/wallets.ts — FOUND
- apps/web/src/app/api/wallets/[...path]/route.ts — FOUND
- apps/web/src/types/wallet.ts — FOUND
- apps/web/src/lib/wallet-labels.ts — FOUND
- apps/api/tests/wallets.test.ts — FOUND
- packages/db/src/schema.ts (modified) — FOUND

Commits present:

- 1e0461c — FOUND
- d9fed5a — FOUND
- 64f559d — FOUND
