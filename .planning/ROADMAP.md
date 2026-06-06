# Roadmap: Profitmuna

**Project:** Profitmuna — personal finance app with Profit First percentage allocations
**Mode:** MVP (vertical slices — each phase delivers end-to-end DB + API + UI)
**Granularity:** Standard (6 phases)
**Coverage:** 30/30 requirements mapped

---

## Phases

- [ ] **Phase 1: Authentication** - Users can create accounts, log in, and manage credentials securely
- [ ] **Phase 2: Income & Expenses** - Users can record, browse, and manage income and expense entries with categories
- [ ] **Phase 3: Profit First Allocation** - Users can configure allocation accounts and view derived balance summaries
- [ ] **Phase 4: Wallets** - Users can create wallets, map categories, record transactions, and view computed balances
- [ ] **Phase 5: Dashboard** - Users land on a summary view showing totals, allocation balances, and recent transactions
- [ ] **Phase 6: Settings & Notifications** - Users can configure currency, set reminder schedules, and use the notification center

---

## Phase Details

### Phase 1: Authentication

**Goal**: Users can securely create accounts and log in via email/password or Google, with email verification and password recovery
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):

1. User can register with email/password, receive a verification email via Resend, and must verify before accessing the app
2. User can log in with email/password, stay logged in across browser sessions (JWT 30-min access / 7-day refresh in httpOnly cookies), and have tokens automatically refreshed
3. User can log in via Google OAuth — first login creates an account, subsequent logins sign in
4. User can reset a forgotten password by entering their email and following the Resend-delivered link
5. User can log out from any page and have all tokens cleared
6. User receives a welcome email after successful registration
   **Plans**: 4 plans

Plans:

**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: scaffold + register/verify/welcome email + login verification gate (AUTH-01, AUTH-06)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 01-02-PLAN.md — Login + JWT cookie sessions + transparent BFF refresh + logout (AUTH-02, AUTH-05)

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 01-03-PLAN.md — Password reset via emailed single-use link (AUTH-04)

**Wave 4** _(blocked on Wave 3 completion)_

- [ ] 01-04-PLAN.md — Google OAuth sign-in + account linking (AUTH-03)

**UI hint**: yes

### Phase 2: Income & Expenses

**Goal**: Users can record, browse, edit, and delete income and expense entries with customizable categories
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: INC-01, INC-02, INC-03, INC-04, INC-05, INC-06, EXP-01, EXP-02, EXP-03, EXP-04, EXP-05
**Success Criteria** (what must be TRUE):

1. User can record income with category, amount, date, description, and PENDING or RECEIVED status; PENDING income can be marked as RECEIVED, setting a received date and flagging it for Profit First allocation
2. User can browse a paginated income list with search and filters (status, date range) and edit or delete individual records
3. User can record an expense with category, amount, date, payment method, and description; soft-deleted expenses are excluded from totals but restorable
4. User can browse a paginated expense list filtered by date range and edit or soft-delete records
5. User can manage income and expense categories — create, edit, and delete custom categories; system default categories are protected and cannot be deleted
   **Plans**: TBD
   **UI hint**: yes

### Phase 3: Profit First Allocation

**Goal**: Users can configure Profit First allocation accounts with percentage targets and view derived balance summaries across their received income
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PF-01, PF-02, PF-03, PF-04
**Success Criteria** (what must be TRUE):

1. New users see four default allocation accounts seeded on first use — Profit 5%, Owner Pay 50%, Tax 15%, Operating Expenses 30%
2. User can update allocation percentages, with the system validating that all percentages sum to exactly 100% (stored as basis points)
3. User can create and delete custom allocation accounts; default accounts cannot be deleted; an account linked to a wallet cannot be deleted
4. User can view an allocation summary showing the derived balance per account (totalReceivedAllocatedIncome × targetPercentage / 10000), filterable by date range and income category
   **Plans**: TBD
   **UI hint**: yes

### Phase 4: Wallets

**Goal**: Users can create wallets linked to allocation accounts or standalone, map income and expense categories to wallets, record manual transactions, and see computed balances
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: WAL-01, WAL-02, WAL-03, WAL-04, WAL-05
**Success Criteria** (what must be TRUE):

1. User can create a PROFIT_FIRST wallet linked 1:1 to an allocation account, or a BLANK standalone wallet
2. User can map income and expense categories to a wallet (each category maps to at most one wallet) and toggle auto-deduct-all-expenses for a wallet
3. User can view all wallets with computed balance breakdowns (PF allocation + mapped income − mapped expenses + deposits − withdrawals)
4. User can record manual DEPOSIT or WITHDRAWAL transactions, edit them, soft-delete them, and restore soft-deleted transactions
5. User can open a wallet detail view with a paginated transaction history
   **Plans**: TBD
   **UI hint**: yes

### Phase 5: Dashboard

**Goal**: Users land on a summary page that surfaces the most important financial information without navigating to individual sections
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DASH-01
**Success Criteria** (what must be TRUE):

1. User sees income totals, expense totals, and Profit First allocation balances on the dashboard
2. User sees a list of recent transactions (income, expenses, wallet transactions) on the dashboard
3. Dashboard data reflects the user's current financial state without requiring a manual refresh
   **Plans**: TBD
   **UI hint**: yes

### Phase 6: Settings & Notifications

**Goal**: Users can configure their display currency and reminder schedule, and receive both in-app notifications and scheduled email reminders
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SET-01, SET-02, NOTIF-01, NOTIF-02
**Success Criteria** (what must be TRUE):

1. User can select their display currency and see all monetary values formatted in that currency throughout the app
2. User can configure an income reminder schedule and have reminder emails delivered on that schedule via Workers cron + Resend
3. User can open an in-app notification center, see unread notifications highlighted, and mark them as read
   **Plans**: TBD
   **UI hint**: yes

---

## Progress Table

| Phase                       | Plans Complete | Status      | Completed |
| --------------------------- | -------------- | ----------- | --------- |
| 1. Authentication           | 3/4 | In Progress|  |
| 2. Income & Expenses        | 0/0            | Not started | -         |
| 3. Profit First Allocation  | 0/0            | Not started | -         |
| 4. Wallets                  | 0/0            | Not started | -         |
| 5. Dashboard                | 0/0            | Not started | -         |
| 6. Settings & Notifications | 0/0            | Not started | -         |

---

## Coverage Map

| Requirement | Phase   |
| ----------- | ------- |
| AUTH-01     | Phase 1 |
| AUTH-02     | Phase 1 |
| AUTH-03     | Phase 1 |
| AUTH-04     | Phase 1 |
| AUTH-05     | Phase 1 |
| AUTH-06     | Phase 1 |
| INC-01      | Phase 2 |
| INC-02      | Phase 2 |
| INC-03      | Phase 2 |
| INC-04      | Phase 2 |
| INC-05      | Phase 2 |
| INC-06      | Phase 2 |
| EXP-01      | Phase 2 |
| EXP-02      | Phase 2 |
| EXP-03      | Phase 2 |
| EXP-04      | Phase 2 |
| EXP-05      | Phase 2 |
| PF-01       | Phase 3 |
| PF-02       | Phase 3 |
| PF-03       | Phase 3 |
| PF-04       | Phase 3 |
| WAL-01      | Phase 4 |
| WAL-02      | Phase 4 |
| WAL-03      | Phase 4 |
| WAL-04      | Phase 4 |
| WAL-05      | Phase 4 |
| DASH-01     | Phase 5 |
| SET-01      | Phase 6 |
| SET-02      | Phase 6 |
| NOTIF-01    | Phase 6 |
| NOTIF-02    | Phase 6 |

**Total:** 30/30 requirements mapped

---

_Roadmap created: 2026-06-05_
