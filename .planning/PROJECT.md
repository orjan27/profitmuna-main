# Profitmuna

## What This Is

A personal finance app that automatically applies Profit First percentage allocations to your income for proper budgeting. Users record income and expenses, configure allocation percentages across accounts (Profit, Owner Pay, Tax, Operating Expenses, plus custom), and track money across wallets with computed balances. Single-user — each user manages their own finances.

## Core Value

When income is recorded as received, it is automatically split across the user's Profit First allocation percentages — the user always knows exactly how much belongs to each bucket.

## Reference Implementation

The finance functionality must work **exactly like** the existing rentals app at `/mnt/c/dev/profitfirst/practice` (income, expense, Profit First allocation, wallets) — with rentals features (bookings, units, partners, deposits) stripped out and multi-tenancy removed. Key mechanics to replicate:

- **Money as integer cents**; percentages as **basis points** (500 = 5.00%)
- **Income**: categories (user-manageable, generic defaults), `PENDING`/`RECEIVED` money status with `expectedReleaseDate`/`receivedDate`, `profitFirstAllocated` flag; only RECEIVED + allocated income feeds allocation
- **Expenses**: categories, payment method, soft delete (`deletedAt`)
- **Profit First accounts**: defaults Profit 5%, Owner Pay 50%, Tax 15%, Operating Expenses 30%; types PROFIT/OWNERS_PAY/TAX/OPEX/CUSTOM; color + sortOrder; percentages must sum to exactly 100%; custom accounts creatable/deletable (defaults not deletable); cannot delete an account linked to a wallet
- **Allocation balances are derived, not stored**: `balance = totalReceivedAllocatedIncome × targetPercentage / 10000`, with date-range and category filters
- **Wallets**: `PROFIT_FIRST` (linked 1:1 to a PF account) or `BLANK`; income/expense category mappings (each category maps to at most one wallet); `autoDeductAllExpenses` flag; manual DEPOSIT/WITHDRAWAL transactions (soft-deletable, restorable); balance always computed: `pfAllocation + mappedIncome − mappedExpenses + deposits − withdrawals`

## Requirements

### Validated

- ✓ Monorepo scaffold: Next.js 15 web app, Hono API on Cloudflare Workers, Drizzle/D1 db package — existing
- ✓ Tooling: TypeScript strict, Turbo, ESLint, Vitest, path aliases (`@/*`, `@app/db`) — existing
- ✓ Email/password registration with email verification (Resend) — Validated in Phase 1: Authentication
- ✓ Login with JWT auth: 30-min access token, 7-day refresh token (opaque, hashed, rotated), httpOnly cookies, transparent BFF auto-refresh — Validated in Phase 1: Authentication
- ✓ Google OAuth login (arctic PKCE, email-keyed account linking; live consent flow pending UAT credentials) — Validated in Phase 1: Authentication
- ✓ Password reset via email link (Resend) — Validated in Phase 1: Authentication
- ✓ Welcome email after registration (Resend) — Validated in Phase 1: Authentication
- ✓ Profit First accounts with configurable percentages (server-enforced sum-to-100% validation), custom accounts — Validated in Phase 3: Profit First Allocation
- ✓ Allocation summary with derived balances, date-range and category filters — Validated in Phase 3: Profit First Allocation

### Active

- [ ] Income CRUD with categories, PENDING/RECEIVED status, receive transition
- [ ] Expense CRUD with categories, payment method, soft delete
- [ ] Wallets with PF-account linking, category mappings, manual transactions, computed balances
- [ ] In-app notification center (read/unread)
- [ ] Scheduled income-logging reminder emails based on user preference (Workers cron)
- [ ] User-selectable currency setting

### Out of Scope

- Rentals features (bookings, units, partners, security deposits, calendar, Agoda sync) — reference app baggage; Profitmuna is finance-only
- Multi-tenancy / businesses / roles / member invites — personal, single-user app
- Direct messaging — explicitly excluded in repo scope
- Per-event activity emails (income added, expense added, % changed) — user chose reminder emails instead
- Bank integrations / automatic transaction import — manual entry only for v1

## Context

- **Brownfield scaffold**: codebase map at `.planning/codebase/`. The scaffold is bare (placeholder routes/schema) — all features are net-new.
- **Reference codebase**: `/mnt/c/dev/profitfirst/practice` — Next.js single-app with Hono routes in `src/server/`. Profitmuna splits this into `apps/web` (UI) + `apps/api` (Hono) + `packages/db` (Drizzle schema). Key reference files: `src/server/db/schema.ts`, `src/server/services/{income,expense,profit-first,wallet}-service.ts`, `src/server/routes/`, `src/app/(dashboard)/{income,expenses,profit-first,wallets}/`.
- Reference app has no email integration — Resend integration is net-new design.
- Timezone: reference uses Asia/Manila ISO strings; currency display is user-selectable in Profitmuna (reference hardcodes ₱).

## Constraints

- **Tech stack**: Next.js 15.4.11 + Hono 4.12.9 on Cloudflare Workers + Drizzle 0.45.2/D1 — already pinned; no new deps without user approval (Resend SDK will need approval/addition)
- **Structure**: STRICT project structure per CLAUDE.md, enforced by PreToolUse hook; routes thin, business logic in `services/`
- **Edge runtime**: API runs on Cloudflare Workers — no Node-only APIs; scheduled emails need Workers cron triggers
- **Fidelity**: Finance behavior must match the reference implementation exactly (minus rentals/tenancy)

## Key Decisions

| Decision                                                         | Rationale                                                                     | Outcome   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------- |
| Single-user (no businesses/roles)                                | Personal finance app; tenancy adds complexity with no v1 value                | — Pending |
| Keep PENDING/RECEIVED income status                              | User wants reference mechanics preserved minus rentals                        | — Pending |
| Derived (not stored) allocation & wallet balances                | Matches reference; percentage changes retroactively recompute; simpler schema | — Pending |
| JWT 30-min access / 7-day refresh, httpOnly cookies              | User-specified standard                                                       | — Pending |
| Resend for all email (verification, reset, welcome, reminders)   | User-specified provider                                                       | — Pending |
| Reminder emails on user-set schedule instead of per-event emails | User preference from questioning                                              | — Pending |
| Money in integer cents, percentages in basis points              | Matches reference; avoids float errors                                        | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-06-06 — Phase 3 (Profit First Allocation) complete: account seeding, CRUD, server-enforced percentage editing, allocation summary with date/category filters; 8 browser UAT items tracked in 03-HUMAN-UAT.md_
