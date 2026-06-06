# Requirements: Profitmuna

**Defined:** 2026-06-05
**Core Value:** When income is recorded as received, it is automatically split across the user's Profit First allocation percentages — the user always knows exactly how much belongs to each bucket.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases. Finance behavior must match the reference implementation at `/mnt/c/dev/profitfirst/practice` (minus rentals and multi-tenancy).

### Authentication

- [x] **AUTH-01**: User can create an account with email/password and must verify their email via a Resend-sent link before logging in
- [ ] **AUTH-02**: User can log in with email/password and stay logged in via JWT — 30-min access token, 7-day refresh token, httpOnly cookies, automatic refresh
- [ ] **AUTH-03**: User can log in with Google (account auto-created on first OAuth login)
- [ ] **AUTH-04**: User can reset their password via an emailed reset link
- [ ] **AUTH-05**: User can log out from any page (tokens cleared)
- [x] **AUTH-06**: User receives a welcome email after registration

### Income

- [ ] **INC-01**: User can record income with category, amount, date, description, and money status (PENDING or RECEIVED)
- [ ] **INC-02**: User can browse a paginated income list with search and filters (status, date range)
- [ ] **INC-03**: User can edit an income record
- [ ] **INC-04**: User can delete an income record
- [ ] **INC-05**: User can mark PENDING income as RECEIVED — sets received date and feeds Profit First allocation
- [ ] **INC-06**: User can manage income categories (create/edit/delete custom; generic system defaults protected)

### Expenses

- [ ] **EXP-01**: User can record an expense with category, amount, date, payment method, and description
- [ ] **EXP-02**: User can browse a paginated expense list with date-range filters
- [ ] **EXP-03**: User can edit an expense
- [ ] **EXP-04**: User can soft-delete an expense (restorable; excluded from totals)
- [ ] **EXP-05**: User can manage expense categories (custom + protected system defaults)

### Profit First Allocation

- [ ] **PF-01**: New users get default allocation accounts seeded — Profit 5%, Owner Pay 50%, Tax 15%, Operating Expenses 30%
- [ ] **PF-02**: User can update allocation percentages, validated to sum to exactly 100% (stored as basis points)
- [ ] **PF-03**: User can create, edit, and delete custom allocation accounts (defaults not deletable; accounts linked to wallets not deletable)
- [ ] **PF-04**: User can view an allocation summary with balances derived from received allocated income, filterable by date range and category

### Wallets

- [ ] **WAL-01**: User can create a wallet — PROFIT_FIRST type (linked 1:1 to an allocation account) or BLANK
- [ ] **WAL-02**: User can map income/expense categories to a wallet (each category maps to at most one wallet) and toggle auto-deduct-all-expenses
- [ ] **WAL-03**: User can view all wallets with computed balance breakdowns (PF allocation + mapped income − mapped expenses + deposits − withdrawals)
- [ ] **WAL-04**: User can record manual DEPOSIT/WITHDRAWAL transactions, edit them, soft-delete and restore them
- [ ] **WAL-05**: User can view wallet detail with paginated transaction history

### Notifications

- [ ] **NOTIF-01**: User has an in-app notification center with read/unread states
- [ ] **NOTIF-02**: User receives scheduled income-logging reminder emails based on their configured preference (Workers cron + Resend)

### Settings

- [ ] **SET-01**: User can select their display currency
- [ ] **SET-02**: User can configure their income reminder schedule

### Dashboard

- [ ] **DASH-01**: User lands on a dashboard showing income/expense totals, Profit First balances, and recent transactions

## v2 Requirements

None deferred yet.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                                                      | Reason                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------- |
| Rentals features (bookings, units, partners, deposits, calendar, Agoda sync) | Reference app baggage; Profitmuna is finance-only |
| Multi-tenancy / businesses / roles / member invites                          | Personal, single-user app                         |
| Per-event activity emails (income added, expense added, % changed)           | User chose scheduled reminder emails instead      |
| Bank integrations / automatic transaction import                             | Manual entry only for v1                          |
| Direct messaging                                                             | Explicitly excluded in repo scope                 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase   | Status  |
| ----------- | ------- | ------- |
| AUTH-01     | Phase 1 | Complete |
| AUTH-02     | Phase 1 | Pending |
| AUTH-03     | Phase 1 | Pending |
| AUTH-04     | Phase 1 | Pending |
| AUTH-05     | Phase 1 | Pending |
| AUTH-06     | Phase 1 | Complete |
| INC-01      | Phase 2 | Pending |
| INC-02      | Phase 2 | Pending |
| INC-03      | Phase 2 | Pending |
| INC-04      | Phase 2 | Pending |
| INC-05      | Phase 2 | Pending |
| INC-06      | Phase 2 | Pending |
| EXP-01      | Phase 2 | Pending |
| EXP-02      | Phase 2 | Pending |
| EXP-03      | Phase 2 | Pending |
| EXP-04      | Phase 2 | Pending |
| EXP-05      | Phase 2 | Pending |
| PF-01       | Phase 3 | Pending |
| PF-02       | Phase 3 | Pending |
| PF-03       | Phase 3 | Pending |
| PF-04       | Phase 3 | Pending |
| WAL-01      | Phase 4 | Pending |
| WAL-02      | Phase 4 | Pending |
| WAL-03      | Phase 4 | Pending |
| WAL-04      | Phase 4 | Pending |
| WAL-05      | Phase 4 | Pending |
| DASH-01     | Phase 5 | Pending |
| SET-01      | Phase 6 | Pending |
| SET-02      | Phase 6 | Pending |
| NOTIF-01    | Phase 6 | Pending |
| NOTIF-02    | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---

_Requirements defined: 2026-06-05_
_Last updated: 2026-06-05 after roadmap creation_
