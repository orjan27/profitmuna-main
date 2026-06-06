# Phase 3: Profit First Allocation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 3-profit-first-allocation
**Areas discussed:** Default account seeding, 100% validation semantics, Percentage editor & summary UI, Summary filters

---

## Default Account Seeding

| Option                                | Description                                                                                                            | Selected |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| Lazy on first PF access (Recommended) | GET /profit-first seeds 4 defaults inline if user has zero accounts; idempotent, covers Phase 1 users, no auth changes |          |
| At registration                       | Auth service seeds on register (mirrors reference seed-on-business-create); requires touching Phase 1 auth + backfill  | ✓        |
| Both                                  | Registration seed + lazy safety net; most robust, duplicate logic                                                      |          |

**User's choice:** At registration

| Option                       | Description                                                        | Selected |
| ---------------------------- | ------------------------------------------------------------------ | -------- |
| Data migration (Recommended) | One-time migration backfills 4 defaults for users without accounts | ✓        |
| No backfill — dev data only  | Existing users are dev/test; wipe or ignore                        |          |
| Lazy safety-net check        | PF endpoints also seed if zero accounts found                      |          |

**User's choice:** Data migration
**Notes:** Assumption accepted without objection: Google OAuth first-login counts as registration — one shared seeding function called from both registration paths.

---

## 100% Validation Semantics

| Option                            | Description                                                                                  | Selected |
| --------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| Replicate reference (Recommended) | Exactly-100% only in bulk editor; create/single-edit can't exceed 100% (total may dip below) | ✓        |
| Strict 100% everywhere            | Every mutation must leave total at exactly 100%; forces simultaneous rebalance on create     |          |
| Strict + atomic rebalance UI      | Strict invariant via create/delete inside bulk editor flow                                   |          |

**User's choice:** Replicate reference
**Notes:** Deleting a custom account may also leave total under 100% — consistent consequence, user rebalances in editor.

---

## Percentage Editor & Summary UI

| Option                                   | Description                                                                                                                     | Selected |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Replicate reference layout (Recommended) | Color-accented account cards, target %, derived balance, progress bar; bulk editor; create/edit dialog — rebuilt with shadcn/ui | ✓        |
| Simplified table view                    | Single table with inline edit; deviates from reference look                                                                     |          |
| You decide                               | Planner picks layout, behavior preserved                                                                                        |          |

**User's choice:** Replicate reference layout

| Option                        | Description                                                                  | Selected |
| ----------------------------- | ---------------------------------------------------------------------------- | -------- |
| Yes, include it (Recommended) | Amount-masking toggle as shared component; income/expense/wallet pages reuse | ✓        |
| Skip for this phase           | Show amounts plainly; defer masking                                          |          |

**User's choice:** Yes, include it
**Notes:** Assumption accepted: custom-account colors from preset swatch palette replicating reference `PF_DEFAULT_COLORS` (no free hex input).

---

## Summary Filters

| Option                                    | Description                                                | Selected |
| ----------------------------------------- | ---------------------------------------------------------- | -------- |
| Asia/Manila, like reference (Recommended) | Presets computed via Manila time (`nowManila()` semantics) | ✓        |
| User's browser timezone                   | Client-side presets in browser timezone                    |          |
| You decide                                | Planner picks based on Phase 2 date storage                |          |

**User's choice:** Asia/Manila

| Option                                     | Description                                                       | Selected |
| ------------------------------------------ | ----------------------------------------------------------------- | -------- |
| Multi-select, like reference (Recommended) | Any combination of income categories; IN-list filter; default all | ✓        |
| Single-select dropdown                     | One category at a time                                            |          |

**User's choice:** Multi-select
**Notes:** Assumption accepted: filter state in URL search params via nuqs (matches reference searchParams approach; nuqs already pinned).

---

## Claude's Discretion

- Wallet-guard implementation timing (stub in Phase 3 vs activate in Phase 4) — flag in plan
- API route shape under `apps/api/src/routes/` (follow reference service surface)
- Error-message wording (reference messages as templates)
- `fromCents` conversion location (API-side vs web-side; cents in DB/transport regardless)

## Deferred Ideas

None — discussion stayed within phase scope.
