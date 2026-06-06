# Phase 4: Wallets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 4-wallets
**Areas discussed:** Wallet list & balance display, Category mapping flow, Transaction management UX, Reference divergences

---

## Wallet list & balance display

### How should the wallet list page present wallets?

| Option                  | Description                                                                                               | Selected |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| Card grid (Recommended) | Matches reference wallet-card.tsx: one card per wallet with name, color accent, type badge, total balance | ✓        |
| Table/list rows         | Denser; uses @tanstack/react-table; diverges from reference layout                                        |          |
| You decide              | Let planning pick based on Phase 2-3 list patterns                                                        |          |

**User's choice:** Card grid

### Where should the full balance breakdown be visible?

| Option                                 | Description                                                                                      | Selected |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| Detail only, collapsible (Recommended) | Matches reference: cards show total only; detail has collapsible Breakdown with zero rows hidden | ✓        |
| Also on list cards                     | Mini-breakdown per card; busier, diverges                                                        |          |
| Always expanded in detail              | Breakdown open by default instead of disclosure                                                  |          |

**User's choice:** Detail only, collapsible

### How should wallets be ordered on the list page?

| Option                              | Description                                              | Selected |
| ----------------------------------- | -------------------------------------------------------- | -------- |
| sortOrder field (Recommended)       | Reference schema field; stored order, new wallets append | ✓        |
| Fixed: PF wallets first, then blank | Group by type, alphabetical within                       |          |
| Creation order                      | Simplest, no ordering controls                           |          |

**User's choice:** sortOrder field

### What should the wallets page show when the user has no wallets yet?

| Option                          | Description                                                                       | Selected |
| ------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Empty state + CTA (Recommended) | Explainer + prominent "Create wallet" button                                      |          |
| Suggest PF wallets              | Additionally offer one-click creation of a wallet per unlinked allocation account | ✓        |
| Just the create button          | Minimal, no explainer                                                             |          |

**User's choice:** Suggest PF wallets
**Notes:** Goes beyond the bare reference but stays behavior-compliant — one-click creation reuses the standard create path pre-filled.

---

## Category mapping flow

### Where should category mapping live in the UI?

| Option                              | Description                                                       | Selected |
| ----------------------------------- | ----------------------------------------------------------------- | -------- |
| Inline in wallet form (Recommended) | Matches reference: pick categories at create, edit on detail page | ✓        |
| Separate mapping screen             | Dedicated matrix view of all categories; more build, diverges     |          |
| You decide                          | Defer to planning                                                 |          |

**User's choice:** Inline in wallet form

### When a category is already mapped to another wallet, how should the picker behave?

| Option                        | Description                                                               | Selected |
| ----------------------------- | ------------------------------------------------------------------------- | -------- |
| Block + disable (Recommended) | Matches reference: disabled in picker, server 409 "remove it there first" | ✓        |
| Offer to move                 | "Move from wallet X?" prompt; needs new service logic, diverges           |          |

**User's choice:** Block + disable

### Keep the reference's three-mode expense selector?

| Option                             | Description                                                                   | Selected |
| ---------------------------------- | ----------------------------------------------------------------------------- | -------- |
| Keep 3-mode selector (Recommended) | none / auto-deduct all / specific categories; "specific" requires ≥1 category | ✓        |
| Simplify to toggle + picker        | Same data model, looser UX, ambiguous states possible                         |          |

**User's choice:** Keep 3-mode selector

### For PROFIT_FIRST wallets, hide the income-category mapping section?

| Option                            | Description                                                                                        | Selected |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| Hide for PF wallets (Recommended) | Matches reference: PF wallets funded by allocation %; income mapping hidden, expense mapping stays | ✓        |
| Show everywhere                   | Math composes but muddies the PF bucket mental model                                               |          |

**User's choice:** Hide for PF wallets

---

## Transaction management UX

### How should soft-deleted transactions appear in the wallet's history?

| Option                                 | Description                                              | Selected |
| -------------------------------------- | -------------------------------------------------------- | -------- |
| Inline, greyed + Restore (Recommended) | Matches reference: muted styling + inline Restore button | ✓        |
| Hidden behind a toggle                 | "Show deleted" filter; cleaner list, extra state         |          |

**User's choice:** Inline, greyed + Restore

### Pagination style for the wallet detail transaction history?

| Option                            | Description                                                                         | Selected |
| --------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Page-based controls (Recommended) | Matches reference PaginationControls; consistent with Phase 2 lists; nuqs URL state | ✓        |
| Load more button                  | Append-style; inconsistent with INC-02/EXP-02 lists                                 |          |
| You decide                        | Align with whatever Phase 2 ships                                                   |          |

**User's choice:** Page-based controls

### How should users add and edit manual transactions on the wallet detail page?

| Option                          | Description                                                                   | Selected |
| ------------------------------- | ----------------------------------------------------------------------------- | -------- |
| Dialog/modal form (Recommended) | Add deposit/withdrawal buttons open dialog; edit opens same dialog pre-filled | ✓        |
| Inline form on page             | Always-visible entry form; fewer clicks, busier page                          |          |
| You decide                      | Match reference's exact pattern                                               |          |

**User's choice:** Dialog/modal form

### Should deleting a manual transaction ask for confirmation?

| Option                                     | Description                                         | Selected |
| ------------------------------------------ | --------------------------------------------------- | -------- |
| No confirm — it's restorable (Recommended) | Soft delete reversible in one click; toast confirms |          |
| Confirm dialog                             | Extra safety, extra friction                        | ✓        |

**User's choice:** Confirm dialog
**Notes:** User chose extra safety against the no-confirm recommendation.

---

## Reference divergences

### Keep reference behavior allowing withdrawals to push balances negative?

| Option                       | Description                                                         | Selected |
| ---------------------------- | ------------------------------------------------------------------- | -------- |
| Allow negative (Recommended) | Exact fidelity; wallets are envelopes, red styling signals overdraw | ✓        |
| Block overdraw               | 422 when amount exceeds computed balance; diverges                  |          |
| Warn but allow               | Client-side warning, server accepts                                 |          |

**User's choice:** Allow negative

### Wallet color: how should users pick it?

| Option                       | Description                                       | Selected |
| ---------------------------- | ------------------------------------------------- | -------- |
| Preset palette (Recommended) | Curated 8-12 swatches; stored as hex, same schema | ✓        |
| Free color picker            | Full hex input; risk of unreadable choices        |          |
| Auto-assign                  | Cycle palette automatically, no user choice       |          |

**User's choice:** Preset palette

### Currency display in Phase 4 (user-selectable currency ships in Phase 6)?

| Option                                    | Description                                                                                          | Selected |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| Shared formatter, ₱ default (Recommended) | formatCurrency helper in apps/web/src/lib/ reading a setting with PHP default; Phase 6 flips setting | ✓        |
| Hardcode ₱ for now                        | Literal reference match; Phase 6 retrofits every money display                                       |          |
| USD default                               | Same formatter approach, $ default                                                                   |          |

**User's choice:** Shared formatter, ₱ default

### Wallet deletion cascade + UX?

| Option                                | Description                                                                            | Selected |
| ------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| Cascade + typed confirm (Recommended) | Keep reference cascade; dialog details impact (N transactions, mappings) before delete | ✓        |
| Cascade + simple confirm              | Standard "Are you sure?" without impact detail                                         |          |
| Soft-delete wallets                   | Restorable wallets; schema + service divergence                                        |          |

**User's choice:** Cascade + typed confirm

---

## Claude's Discretion

- Exact card layout, breakdown row labels, dialog field layout — follow reference, shadcn conventions otherwise
- Transaction pagination page size (align with Phase 2)
- Exact preset palette colors (legible; include reference defaults like #10b981)
- Manual-transaction blocking explainer copy per wallet mode — reuse reference copy

## Deferred Ideas

None — discussion stayed within phase scope.
