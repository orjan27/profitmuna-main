---
phase: 03-profit-first-allocation
plan: '02'
subsystem: profit-first-api
tags: [api, service, routes, bff, hono, zod, tests]
dependency_graph:
  requires: [03-01, phase-01-auth]
  provides:
    [
      createProfitFirstService factory,
      profit-first Zod schemas,
      profitFirstRouter (5 routes),
      BFF proxy for profit-first,
      PF-02/PF-03/PF-04 tests green,
    ]
  affects: [apps/api/src/index.ts CORS + routing, apps/web BFF layer]
tech_stack:
  added: []
  patterns:
    [
      service factory pattern (db at construction),
      Promise.all parallel D1 queries,
      integer basis-point balance math,
      zValidator 422 hook pattern,
      Next.js 15 BFF proxy,
    ]
key_files:
  created:
    - apps/api/src/services/profit-first-service.ts (extended with createProfitFirstService)
    - apps/api/src/schemas/profit-first.ts
    - apps/api/src/routes/profit-first.ts
    - apps/web/src/app/api/profit-first/[...path]/route.ts
  modified:
    - apps/api/src/index.ts (route registration)
    - apps/api/tests/profit-first.test.ts (PF-02/03/04 tests filled)
decisions:
  - getSummary returns targetPercentage as percent (bp/100) not basis points — UI editor uses total===100 check (Pitfall 3)
  - Phase 4 wallet-link guard stubbed as commented block in deleteAccount — wallets table does not exist yet
  - BFF proxy has no transparent-refresh or Set-Cookie relay — middleware.ts handles auth redirect
  - CORS allowMethods was already ['GET','POST','PUT','DELETE','PATCH'] — no change needed
metrics:
  duration: '~20 min'
  completed: '2026-06-06'
  tasks_completed: 2
  files_modified: 6
---

# Phase 03 Plan 02: Profit First API Layer Summary

Profit First service factory with reference-exact validation semantics and integer balance math; Zod input schemas; thin Hono router with all 5 routes behind requireAuth; route registration in index.ts; and a simplified Next.js BFF proxy — PF-02/PF-03/PF-04 unit tests all green.

## Tasks Completed

| Task | Name                                                             | Commit  | Files                                                                                                   |
| ---- | ---------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| 1    | createProfitFirstService factory + Zod schemas + PF-02/03/04 tests | 297338d | apps/api/src/services/profit-first-service.ts, apps/api/src/schemas/profit-first.ts, apps/api/tests/profit-first.test.ts |
| 2    | Thin Hono router + index registration + CORS + BFF proxy         | 6fa4549 | apps/api/src/routes/profit-first.ts, apps/api/src/index.ts, apps/web/src/app/api/profit-first/[...path]/route.ts |

## What Was Built

### Service Factory (Task 1)

`apps/api/src/services/profit-first-service.ts` now exports both `seedProfitFirstAccounts` (unchanged from Plan 01) and `createProfitFirstService(db)`:

**`getSummary(userId, dateRange?, filters?)`**
- Parallel `Promise.all`: total received income query + accounts SELECT by sortOrder
- `getTotalReceivedIncome`: SUM(amount) WHERE moneyStatus='RECEIVED' AND profitFirstAllocated=1, optional incomeDate range and categoryId IN-list, all scoped to userId
- `computeBalance`: `Math.round((totalIncomeCents * targetPercentage) / 10000)` — integer math only, no float (D-08)
- Returns `targetPercentage` as percent (bp/100) so the UI's `total === 100` check works (Pitfall 3)

**`createAccount(userId, input)`**
- Parallel fetch: current SUM of basis points + MAX sortOrder for user
- Rejects 400 "Adding this account would exceed 100%..." if currentSum + input.targetPercentage > 10000
- Surfaces unique(userId,name) constraint as 400 "An account with this name already exists."

**`updateAccount(accountId, userId, input)`**
- 404 when row missing or userId mismatch (IDOR guard, T-03-04)
- If targetPercentage changes: fetches SUM of OTHER accounts via `ne(id, accountId)`; rejects 400 if new total > 10000

**`deleteAccount(accountId, userId)`**
- 404 when missing/not owned; 400 "Default accounts cannot be deleted." for non-CUSTOM
- Phase 4 wallet-link guard present as commented stub block

**`updatePercentages(userId, input)`**
- Validates `sum === 10000` exactly; 400 "Percentages must total 100%. Current total: {sum/100}%."
- Parallel updates, each scoped to (id, userId); returns updated accounts by sortOrder

### Zod Schemas (Task 1)

`apps/api/src/schemas/profit-first.ts` exports:
- `createAccountSchema`: name 1-100 trim, targetPercentage int 0-10000, color z.enum(8 values), sortOrder int >=0 optional
- `updateAccountSchema`: all optional
- `updatePercentagesSchema`: accounts array min 1, each { id positive int, targetPercentage 0-10000 }
- `summaryQuerySchema`: from, to, categoryIds (comma-separated string) all optional
- `PF_DEFAULT_COLORS` 8-value tuple — byte-for-byte identical to `apps/web/src/lib/constants.ts`

### Router (Task 2)

`apps/api/src/routes/profit-first.ts` — thin Hono router:
- `profitFirstRouter.use('/*', requireAuth)` — every route authenticated (T-03-09)
- `GET /summary` — zValidator query, parses comma-separated categoryIds to number[]
- `POST /accounts` — zValidator json, returns 201
- `PATCH /accounts/:id` — zValidator json, parses :id param to number
- `DELETE /accounts/:id` — parses :id, returns `{ data: null }`
- `PUT /percentages` — zValidator json
- All zValidator hooks return 422 `{ error: { code: 'validation_error', ... } }`
- No local try/catch — HTTPException propagates to global onError in index.ts

### Index Registration (Task 2)

`apps/api/src/index.ts`: added `app.route('/api/profit-first', profitFirstRouter)`. CORS allowMethods was already `['GET','POST','PUT','DELETE','PATCH']` — no change required.

### BFF Proxy (Task 2)

`apps/web/src/app/api/profit-first/[...path]/route.ts`:
- Reads `access_token` cookie, sets `Authorization: Bearer` header
- Forwards to `${API_BASE_URL}/api/profit-first/${path}${search}`
- No transparent-refresh (middleware.ts handles auth redirect)
- No Set-Cookie relay (PF routes set no cookies)
- Exports: GET, POST, PATCH, DELETE, PUT

### Tests (Task 1)

12 tests pass (3 PF-01 + 9 new):
- PF-02: rejects exceeding 100% on create, cannot delete default, deletes custom, 404 for other user's account
- PF-03: rejects non-10000 sum with exact error message "97%", accepts valid redistribution
- PF-04: integer balance math (100000 cents × 500 bp / 10000 = 5000), excludes PENDING + profitFirstAllocated=false income, applies date range filter

## Deviations from Plan

### Deviation 1: CORS allowMethods already complete

**Found during:** Task 2 implementation
**Issue:** The plan specified adding PATCH/DELETE/PUT to `allowMethods`, but index.ts already had `['GET', 'POST', 'PUT', 'DELETE', 'PATCH']` — all five methods already present.
**Fix:** No change needed.
**Rule:** Auto-fixed (Rule 3 — pre-existing state already satisfies the requirement)

## Verification Results

- `cd apps/api && npx tsc --noEmit` — exits 0
- `cd apps/api && npx vitest run tests/profit-first.test.ts` — 12 tests pass
- `npm run test` — 82 tests pass (3 files), full suite green
- grep gates:
  - `profitFirstRouter.use('/*', requireAuth)` — present (1 occurrence)
  - `app.route('/api/profit-first'` — present (1 occurrence)
  - BFF exports GET/POST/PATCH/DELETE/PUT — all present
  - No transparent-refresh/Set-Cookie code in BFF (comment only)
  - PF_DEFAULT_COLORS diff between API and web — empty (identical 8 values)
  - `Math.round((totalIncomeCents * targetPercentage) / 10000)` — present (1 occurrence)
  - `accountType !== 'CUSTOM'` delete guard — present (1 occurrence)
  - No `businessId` in service — 0 occurrences

## Known Stubs

- Phase 4 wallet-link guard in `deleteAccount` is a commented block — will be activated in Phase 4 when the `wallets` table is created. Does not affect Plan 02 completeness.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: authenticated-endpoints | apps/api/src/routes/profit-first.ts | 5 new API endpoints behind requireAuth (T-03-09 mitigated via profitFirstRouter.use('/*', requireAuth)) |
| threat_flag: IDOR-guard | apps/api/src/services/profit-first-service.ts | All queries scoped to userId; deleteAccount/updateAccount return 404 on ownership mismatch (T-03-04 mitigated) |

All flagged surfaces are covered by the plan's threat model (T-03-04, T-03-05, T-03-06, T-03-07, T-03-08, T-03-09).

## Self-Check: PASSED

- apps/api/src/services/profit-first-service.ts: FOUND
- apps/api/src/schemas/profit-first.ts: FOUND
- apps/api/src/routes/profit-first.ts: FOUND
- apps/web/src/app/api/profit-first/[...path]/route.ts: FOUND
- apps/api/src/index.ts: FOUND (route registered)
- apps/api/tests/profit-first.test.ts: FOUND (12 tests pass)
- Commits 297338d, 6fa4549: verified in git log
