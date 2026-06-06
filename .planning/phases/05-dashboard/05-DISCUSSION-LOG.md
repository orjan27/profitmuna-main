# Phase 5: Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 5-dashboard
**Areas discussed:** Stat cards after rentals strip, Recent transactions feed, Date filter scope & freshness, Landing route & navigation

---

## Stat cards after rentals strip

| Option                         | Description                                                             | Selected |
| ------------------------------ | ----------------------------------------------------------------------- | -------- |
| Just the 4 reference cards     | Most faithful; Total Income, Pending Income, Total Expenses, Net Income |          |
| 4 cards + Total Wallet Balance | Adds a 5th card summing all wallet computed balances                    | ✓        |
| You decide                     | Claude picks during planning                                            |          |

**User's choice:** 4 cards + Total Wallet Balance

| Option                  | Description                                             | Selected |
| ----------------------- | ------------------------------------------------------- | -------- |
| Always current/all-time | Real present-day total regardless of date filter        |          |
| Respect the date filter | Recompute balance formula limited to the selected range | ✓        |
| You decide              | Claude picks during planning                            |          |

**User's choice:** Respect the date filter
**Notes:** Wallet card is period-scoped — deposits/withdrawals/mapped income/expenses filtered by date. UI must make the period explicit.

---

## Recent transactions feed

| Option                | Description                                                     | Selected |
| --------------------- | --------------------------------------------------------------- | -------- |
| Unified feed          | One chronological list mixing all three types, type-badged rows | ✓        |
| Tabs per type         | Income / Expenses / Wallet tabs in one card                     |          |
| Side-by-side sections | One mini-list per type in columns                               |          |

**User's choice:** Unified feed (recommended option)

| Option                      | Description                               | Selected |
| --------------------------- | ----------------------------------------- | -------- |
| 10 items + "View all" links | Fixed 10 most recent, links to list pages |          |
| 5 items + "View all" links  | Tighter, compact dashboard                |          |
| Load-more on the dashboard  | Matches Phase 2 list pattern (D-06)       | ✓        |

**User's choice:** Load-more on the dashboard

| Option                    | Description                                                     | Selected |
| ------------------------- | --------------------------------------------------------------- | -------- |
| Navigate to its section   | Income → /income, expense → /expenses, wallet txn → detail page | ✓        |
| Open edit dialog in place | Reuse Phase 2/4 edit dialogs on the dashboard                   |          |
| Rows not clickable        | Read-only glance info                                           |          |

**User's choice:** Navigate to its section (recommended option)

| Option                   | Description                                             | Selected |
| ------------------------ | ------------------------------------------------------- | -------- |
| Exclude deleted          | Feed shows only active records, matching totals         | ✓        |
| Show greyed like Phase 4 | Inline strikethrough + restore (wallet history pattern) |          |

**User's choice:** Exclude deleted (recommended option)

---

## Date filter scope & freshness

| Option                          | Description                                                 | Selected |
| ------------------------------- | ----------------------------------------------------------- | -------- |
| Everything incl. feed           | One range governs cards, PF balances, wallet card, and feed | ✓        |
| Totals only; feed always latest | Feed shows most recent activity regardless of range         |          |

**User's choice:** Everything including the feed (recommended option)

| Option       | Description                                          | Selected |
| ------------ | ---------------------------------------------------- | -------- |
| This Month   | Matches reference default and Phase 3 Manila presets | ✓        |
| All Time     | Lifetime totals by default                           |          |
| Last 30 days | Rolling window                                       |          |

**User's choice:** This Month (recommended option)

| Option                 | Description                                        | Selected |
| ---------------------- | -------------------------------------------------- | -------- |
| Fresh SSR per visit    | Dynamic server render every navigation, no caching | ✓        |
| SSR + refetch on focus | Also revalidates on tab focus                      |          |
| Polling auto-refresh   | Periodic background refetch                        |          |

**User's choice:** Fresh SSR per visit (recommended option)

---

## Landing route & navigation

| Option                  | Description                                                | Selected |
| ----------------------- | ---------------------------------------------------------- | -------- |
| /dashboard, / redirects | Matches reference structure; login redirects to /dashboard | ✓        |
| Dashboard at /          | Root page is the dashboard                                 |          |

**User's choice:** /dashboard with redirects (recommended option)

| Option                        | Description                                                    | Selected |
| ----------------------------- | -------------------------------------------------------------- | -------- |
| Yes — Phase 5 finalizes shell | Add Dashboard entry, default landing, verify all section links | ✓        |
| Dashboard entry only          | Assume earlier phases fully built the shell                    |          |
| You decide                    | Planner checks what Phases 2–4 actually built                  |          |

**User's choice:** Phase 5 finalizes the nav shell (recommended option); Settings entry waits for Phase 6

| Option                               | Description                                             | Selected |
| ------------------------------------ | ------------------------------------------------------- | -------- |
| Zeroed cards + getting-started hints | ₱0.00 cards, PF accounts at ₱0, CTA links in empty feed | ✓        |
| Plain zeroed dashboard               | Everything at zero, simple "No transactions yet"        |          |
| Full-page welcome state              | Welcome panel until first transaction exists            |          |

**User's choice:** Zeroed cards + getting-started hints (recommended option)

---

## Claude's Discretion

- Exact feed row layout, type badge styling, sort tie-breaking
- Initial feed page size (align with Phase 2)
- Dashboard API shape (single summary endpoint vs composed endpoints — reference `getSummary` is the model)
- PF section card link target and progress-bar semantics
- Getting-started CTA copy and which CTAs appear

## Deferred Ideas

None — discussion stayed within phase scope.
