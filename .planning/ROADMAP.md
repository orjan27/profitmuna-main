# Roadmap: Profitmuna

**Project:** Profitmuna — personal finance app with Profit First percentage allocations
**Mode:** MVP (vertical slices — each phase delivers end-to-end DB + API + UI)
**Granularity:** Standard (6 phases)
**Coverage:** 30/30 requirements mapped

---

## Phases

- [x] **Phase 1: Authentication** - Users can create accounts, log in, and manage credentials securely (completed 2026-06-06)
- [x] **Phase 2: Income & Expenses** - Users can record, browse, and manage income and expense entries with categories (completed 2026-06-06)
- [x] **Phase 3: Profit First Allocation** - Users can configure allocation accounts and view derived balance summaries (completed 2026-06-06)
- [x] **Phase 4: Wallets** - Users can create wallets, map categories, record transactions, and view computed balances (completed 2026-06-06)
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
   **Plans**: 6 plans (4 original + 2 gap-closure)

Plans:

**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: scaffold + register/verify/welcome email + login verification gate (AUTH-01, AUTH-06)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 01-02-PLAN.md — Login + JWT cookie sessions + transparent BFF refresh + logout (AUTH-02, AUTH-05)

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 01-03-PLAN.md — Password reset via emailed single-use link (AUTH-04)

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 01-04-PLAN.md — Google OAuth sign-in + account linking (AUTH-03)

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
   **Plans**: 6 plans (4 original + 2 gap-closure)

Plans:

**Wave 0**

- [x] 02-01-PLAN.md — Foundation: 4 DB tables + applied migration, CORS expansion + stub routers mounted behind requireAuth, server-only apiFetch client, currency/date/constants helpers, NuqsAdapter, in-memory D1 test helper (INC-01…06, EXP-01…05 infra)

**Wave 1** _(blocked on Wave 0 completion; 02-02 and 02-03 run in parallel — no file overlap)_

- [x] 02-02-PLAN.md — Income slice: record/browse(search+status+date+load-more)/edit/delete/receive (INC-01, INC-02, INC-03, INC-04, INC-05)
- [x] 02-03-PLAN.md — Expense slice: record(payment method)/browse(date+load-more)/edit/soft-delete+restore (EXP-01, EXP-02, EXP-03, EXP-04)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 02-04-PLAN.md — Category management: lazy seeding + create/rename(cascade)/delete(block-in-use)/system-protection for income + expenses (INC-06, EXP-05)

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
   **Plans**: 6 plans (4 original + 2 gap-closure)

Plans:

**Wave 1**

- [x] 03-01-PLAN.md — Data foundation: profit_first_accounts + minimal incomes table, seedProfitFirstAccounts wired into register + Google first-login, additive migration + idempotent backfill, Wave 0 test scaffold + web leaf utilities (PF-01)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 03-02-PLAN.md — API layer: createProfitFirstService (summary/CRUD/percentages), Zod schemas, thin Hono router behind requireAuth, index registration + CORS methods, BFF proxy (PF-02, PF-03, PF-04)

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 03-03-PLAN.md — View UI: minimal (dashboard) layout, /profit-first RSC page + summary fetch, account cards with derived balances, shared amount-masking, date-range + category filters via nuqs (PF-01, PF-04)

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 03-04-PLAN.md — Mutation UI: percent→bp server actions, bulk percentage editor (100% gate), create/edit/delete account dialogs with preset swatches, wired per-account dropdown (PF-02, PF-03)

**Gap closure** _(VERIFICATION 2026-06-06: SC2 partial, SC4 partial)_

- [x] 03-05-PLAN.md — Gap 2 (CR-01): updatePercentages enforces exact user-owned account coverage before sum-to-100% validation; partial-set 400 regression test (PF-02)
- [x] 03-06-PLAN.md — Gap 1 (WR-01): getSummary returns distinct user income categories; page.tsx derives categoryOptions and passes to PfFilters; empty-state when no categories (PF-04)

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
   **Plans**: 4 plans

Plans:

**Wave 0**

- [x] 04-01-PLAN.md — Foundation: 4 wallet tables + applied migration [BLOCKING], Zod schemas, web type contracts, BFF proxy (5 verbs), stub router behind requireAuth, wallet-labels + formatCurrency utilities, WAL-01..05 test scaffold (WAL-01..05 infra)

**Wave 1** _(blocked on Wave 0 completion)_

- [x] 04-02-PLAN.md — Wallet CRUD + mapping + balance slice: createWalletService (list/create/update/remove, mapping conflict 409, auto-deduct-all uniqueness, balance computation), create-wallet form (type/color/category/3-mode expense, PF income hidden), card-grid list with computed balances + PF-suggesting empty state + impact delete dialog (WAL-01, WAL-02, WAL-03)

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 04-03-PLAN.md — Transactions + detail slice: getById (breakdown + merged paginated history), createTransaction/update/remove/restore with assertCanInsertTransaction double-count guard, transaction routes (incl. PATCH restore), detail page with collapsible breakdown + inline soft-delete/restore + add/edit/delete dialogs + nuqs pagination (WAL-04, WAL-05)

**Wave 3** _(gap closure — blocked on Wave 2 completion)_

- [ ] 04-04-PLAN.md — Gap closure (SC-5): order + COUNT-back paginated history in getById, single inArray expense-history query (CR-01/CR-03/WR-02); co-fix CR-02 Zod param 422 validation + WR-04 NewWalletForm redirect-aware error toast; regression tests for >1-page failure mode (WAL-05)

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
4. All authenticated pages (Dashboard, Income, Expenses, Profit First, Wallets) share a navigation shell with links to each section; a Settings link appears once Phase 6 ships
   **Plans**: 3 plans

Plans:

**Wave 0** _(05-01 and 05-03 run in parallel — no file overlap)_

- [ ] 05-01-PLAN.md — Dashboard data backend: failing test scaffold → createDashboardService (income CASE aggregate, period-scoped wallet balance, PF summary reuse, unified recent-transactions feed) → /api/dashboard/summary route behind requireAuth + index mount + web DashboardSummary types + BFF proxy (DASH-01)
- [ ] 05-03-PLAN.md — Nav shell + landing: Dashboard nav entry → /dashboard, authenticated `/` redirects to /dashboard (marketing page preserved for logged-out) (DASH-01)

**Wave 1** _(blocked on 05-01 completion)_

- [ ] 05-02-PLAN.md — Dashboard UI slice: DashboardFilters (This Month default, Manila tz, nuqs) + DashboardContent (5 stat cards, read-only PF section, unified color-coded feed with client-side Load more, zeroed/getting-started empty state) + /dashboard RSC page (fresh SSR fetch) (DASH-01)

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
   **Plans**: 4 plans

Plans:

**Wave 0**

- [ ] 06-01-PLAN.md — Foundation: notifications table + users settings columns + incomes.pendingDueNotifiedAt [BLOCKING migration], test DDL sync, RED test scaffolds, currency-aware formatCurrency + shared web contract types (SET-01, SET-02, NOTIF-01, NOTIF-02 infra)

**Wave 1** _(blocked on 06-01; 06-02 and 06-03 run in parallel — no file overlap)_

- [ ] 06-02-PLAN.md — Settings slice: settings service/schema/router behind requireAuth, BFF proxy, SSR settings page + form (currency + Daily/Weekly/Monthly reminder schedule), CurrencyProvider wired into layout, Settings nav link (SET-01, SET-02)
- [ ] 06-03-PLAN.md — Notification center slice: notification service (list/unread-count/markAsRead/markAllAsRead/create)/router behind requireAuth, BFF proxy, NotificationBell + NotificationList, bell wired into nav with SSR unread count (NOTIF-01)

**Wave 2** _(blocked on 06-02 + 06-03 completion)_

- [ ] 06-04-PLAN.md — Cron slice: dependency-free Manila-time helper + runCron (due-user reminders mirrored as INCOME_REMINDER, one-time PENDING_INCOME_DUE dedup), sendIncomeReminderEmail, Module Worker scheduled export + hourly cron trigger (NOTIF-02)

   **UI hint**: yes

---

## Progress Table

| Phase                       | Plans Complete | Status      | Completed  |
| --------------------------- | -------------- | ----------- | ---------- |
| 1. Authentication           | 4/4            | Complete    | 2026-06-06 |
| 2. Income & Expenses        | 4/4            | Complete    | 2026-06-06 |
| 3. Profit First Allocation  | 6/6            | Complete    | 2026-06-06 |
| 4. Wallets                  | 3/3            | Complete    | 2026-06-06 |
| 5. Dashboard                | 0/3            | Planned     | -          |
| 6. Settings & Notifications | 0/0            | Not started | -          |

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
