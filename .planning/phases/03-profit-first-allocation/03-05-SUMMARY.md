---
phase: 03-profit-first-allocation
plan: '05'
subsystem: profit-first-api
tags: [api, service, security, invariant, tests, gap-closure]
dependency_graph:
  requires: [03-02]
  provides:
    - updatePercentages full-set coverage enforcement (CR-01 closed)
    - partial-set 400 regression test pinning the invariant
  affects:
    - apps/api/src/services/profit-first-service.ts
    - apps/api/tests/profit-first.test.ts
tech_stack:
  added: []
  patterns:
    - server-authoritative ID set (fetch owned → build Set → require exact match)
    - coverage check before sum validation (reject before any writes)
key_files:
  created: []
  modified:
    - apps/api/src/services/profit-first-service.ts (updatePercentages hardened with full-set coverage)
    - apps/api/tests/profit-first.test.ts (partial-set regression test added to PF-03)
decisions:
  - Coverage check precedes sum validation — on partial submission, rejection happens before any DB update runs
  - Error message 'Submit all accounts exactly once.' is generic — reveals no account data or owned-ID list
  - ownedIds built from server-authoritative DB select scoped to userId — no client data trusted for the set
metrics:
  duration: ~8 min
  completed: '2026-06-06'
  tasks_completed: 2
  files_modified: 2
---

# Phase 03 Plan 05: Full-Set Coverage Enforcement for updatePercentages Summary

Server-enforced exact full-set coverage in `updatePercentages` — the service now fetches user-owned account IDs and rejects any submission that does not cover exactly that set, before validating the sum or writing any rows; a regression test pins the single-account partial submission as 400 with no partial write.

## Tasks Completed

| Task | Name                                                                       | Commit  | Files                                         |
| ---- | -------------------------------------------------------------------------- | ------- | --------------------------------------------- |
| 1    | Enforce exact full-set coverage in updatePercentages before sum validation | dc1b5a2 | apps/api/src/services/profit-first-service.ts |
| 2    | Add partial-set 400 regression test                                        | ce8dc62 | apps/api/tests/profit-first.test.ts           |

## What Was Built

### Task 1 — updatePercentages hardened (dc1b5a2)

`updatePercentages(userId, input)` in `apps/api/src/services/profit-first-service.ts` now enforces the sum-to-100% invariant against the user's full account set, not the submitted subset.

**Before:** The method reduced `input.accounts` to a sum and validated only the submitted rows. A single-account payload `[{ id, targetPercentage: 10000 }]` passed the `sum === 10000` check and updated only that row, leaving the persisted set over-allocated (the stale comment at line 382 explicitly acknowledged this as client-trust).

**After (4-step pattern):**

1. Fetch owned IDs: `db.select({ id }).from(profitFirstAccounts).where(eq(profitFirstAccounts.userId, userId))` → `Set<number>`
2. Build submitted ID set from `input.accounts.map(a => a.id)` → `Set<number>`
3. Reject with HTTPException 400 `'Submit all accounts exactly once.'` if: `submittedIds.size !== input.accounts.length` (duplicates), `ownedIds.size !== submittedIds.size` (count mismatch), or any submitted id is not in `ownedIds` (foreign id). **No DB writes occur on rejection.**
4. After coverage passes: existing sum validation + parallel updates + ordered return unchanged.

Stale comment "The caller is responsible for submitting ALL accounts" removed. JSDoc updated with two `@throws HTTPException 400` tags (coverage failure + sum failure).

### Task 2 — Partial-set regression test (ce8dc62)

New test `'rejects a partial-set submission (single account) with 400'` added inside the existing `describe('PF-03: percentage update (sum-to-100% validation)')` block.

- Seeds 4 default accounts for `partial@pf.test`
- Calls `updatePercentages` with a single-account payload `[{ id: profitId, targetPercentage: 10000 }]`
- Asserts rejection with `'Submit all accounts exactly once.'`
- Re-selects accounts and asserts `OWNERS_PAY.targetPercentage === 5000` (seeded value — no partial write occurred)

PF test count: 12 → 13. Full API suite: 82 → 133 (includes income/expense suites from concurrent session).

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `grep -n "Submit all accounts exactly once" apps/api/src/services/profit-first-service.ts` — 1 match (line 405, inside updatePercentages)
- `grep -n "caller is responsible for submitting ALL accounts" apps/api/src/services/profit-first-service.ts` — 0 matches (stale comment removed)
- `grep -n "profitFirstAccounts.userId" apps/api/src/services/profit-first-service.ts` — new occurrence at line 391 inside updatePercentages
- `cd apps/api && npx tsc --noEmit` — exit 0, no output
- `cd apps/api && npx vitest run tests/profit-first.test.ts` — 13 tests passed
- `cd apps/api && npx vitest run` — 133 tests passed (7 files), no regressions

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All modified surfaces are covered by the plan's threat model (T-03-05-01, T-03-05-02, T-03-05-03).

## Known Stubs

None. The coverage check is server-authoritative and fully wired.

## Self-Check: PASSED

- apps/api/src/services/profit-first-service.ts: FOUND (modified)
- apps/api/tests/profit-first.test.ts: FOUND (modified)
- Commits dc1b5a2, ce8dc62: verified in git log
