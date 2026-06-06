---
phase: 03-profit-first-allocation
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - apps/api/src/index.ts
  - apps/api/src/routes/profit-first.ts
  - apps/api/src/schemas/profit-first.ts
  - apps/api/src/services/auth-service.ts
  - apps/api/src/services/profit-first-service.ts
  - apps/api/tests/helpers/db.ts
  - apps/api/tests/profit-first.test.ts
  - apps/web/src/app/(dashboard)/layout.tsx
  - apps/web/src/app/(dashboard)/profit-first/_components/pf-account-form.tsx
  - apps/web/src/app/(dashboard)/profit-first/_components/pf-content.tsx
  - apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx
  - apps/web/src/app/(dashboard)/profit-first/_components/pf-overview.tsx
  - apps/web/src/app/(dashboard)/profit-first/_components/pf-percentage-editor.tsx
  - apps/web/src/app/(dashboard)/profit-first/loading.tsx
  - apps/web/src/app/(dashboard)/profit-first/page.tsx
  - apps/web/src/app/api/profit-first/[...path]/route.ts
  - apps/web/src/app/layout.tsx
  - apps/web/src/components/amount-visibility.tsx
  - apps/web/src/lib/constants.ts
  - apps/web/src/lib/format-currency.ts
  - apps/web/src/server/profit-first-actions.ts
  - packages/db/migrations/0002_narrow_lethal_legion.sql
  - packages/db/src/schema.ts
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the Profit First allocation slice: API route group, service layer, Zod
schemas, DB schema/migration, the BFF proxy, server actions, and the dashboard
UI. Ownership scoping (IDOR guards), integer money math, the bp↔percent
conversion boundary, and XSS-safe text rendering are handled correctly and are
well tested.

The most serious problem is in `updatePercentages`: the sum-to-100% invariant is
validated only against the _submitted_ subset, so a client (or a tampered
request) can update a subset and leave the user's allocations summing to more or
less than 100% — silently corrupting every downstream balance computation. There
is also a non-trivial cluster of warnings around an incomplete/dead category
filter, a default-account-name editing gap, and a couple of robustness issues in
the auth-service rate-limit reuse.

## Critical Issues

### CR-01: `updatePercentages` validates only the submitted subset — the 100% invariant can be bypassed

**File:** `apps/api/src/services/profit-first-service.ts:387-413` (schema: `apps/api/src/schemas/profit-first.ts:52-62`)
**Issue:** The bulk-update sums **only** `input.accounts` and then updates only
those rows:

```ts
const sum = input.accounts.reduce((acc, a) => acc + a.targetPercentage, 0);
if (sum !== 10000) { throw ... }
await Promise.all(input.accounts.map((a) => db.update(...).where(id == a.id)));
```

The Zod schema requires only `.min(1)`. So a request containing a single
account `{ id, targetPercentage: 10000 }` passes the `sum === 10000` check and
updates just that one row, while the other accounts retain their existing
percentages. Result: the persisted set sums to far more than 10000 bp. Every
`computeBalance` then over-allocates income (e.g. multiple accounts each getting
their full share of the same income), violating the core product invariant
("the user always knows exactly how much belongs to each bucket"). The inline
comment ("The caller is responsible for submitting ALL accounts") explicitly
acknowledges trusting the client for a security/correctness invariant — which is
exactly the anti-pattern `security.md` warns against.

This is reachable through the public `PUT /api/profit-first/percentages` endpoint
with any authenticated token; it does not require the official UI.

**Fix:** Validate against the user's _full_ account set inside the service, not
the request payload. Fetch all of the user's accounts, require the submitted set
to cover exactly that set, and validate the resulting total in the DB:

```ts
async updatePercentages(userId, input) {
  const owned = await db.select({ id: profitFirstAccounts.id })
    .from(profitFirstAccounts)
    .where(eq(profitFirstAccounts.userId, userId));
  const ownedIds = new Set(owned.map((a) => a.id));
  const submittedIds = new Set(input.accounts.map((a) => a.id));

  // Must submit exactly the user's accounts — no missing, no foreign ids
  if (submittedIds.size !== input.accounts.length /* no dup ids */ ||
      ownedIds.size !== submittedIds.size ||
      [...ownedIds].some((id) => !submittedIds.has(id))) {
    throw new HTTPException(400, { message: 'Submit all accounts exactly once.' });
  }

  const sum = input.accounts.reduce((acc, a) => acc + a.targetPercentage, 0);
  if (sum !== 10000) { throw new HTTPException(400, { message: `Percentages must total 100%.` }); }
  // ...proceed with updates
}
```

At minimum, reject any request whose `id` set is not exactly the user's owned
account ids.

## Warnings

### WR-01: Category filter is dead — `page.tsx` never passes `categoryOptions` to `PfFilters`

**File:** `apps/web/src/app/(dashboard)/profit-first/page.tsx:96` and `apps/web/src/app/(dashboard)/profit-first/_components/pf-filters.tsx:98,149`
**Issue:** `PfFilters` renders the category multi-select only when
`categoryOptions.length > 0`, but `page.tsx` calls `<PfFilters />` with no
props, so `categoryOptions` defaults to `[]` and the category UI never appears.
Meanwhile `page.tsx:57` reads `params.categoryIds` and forwards it to the API,
and the route/service fully implement category filtering. The user has no way to
set `categoryIds` through the UI — the feature is wired end-to-end on the backend
but unreachable from the front end. This is either dead code or an unfinished
feature shipped as if complete.
**Fix:** Either (a) derive `categoryOptions` server-side (e.g. from the income
categories endpoint or distinct category ids in the summary) and pass them into
`PfFilters`, or (b) remove the category-filter branch and the `categoryIds`
plumbing until Phase 2 categories are available, so the codebase does not carry
an unreachable path.

### WR-02: Default accounts can be renamed and re-percentaged via PATCH, with no `accountType` protection

**File:** `apps/api/src/services/profit-first-service.ts:286-330`
**Issue:** `updateAccount` only checks ownership; it allows changing `name`,
`color`, `sortOrder`, and `targetPercentage` of **any** account including the
four defaults. Renaming a default (e.g. "Profit" → "Foo") is silently allowed.
This breaks two assumptions:

1. The web UI (`pf-overview.tsx:56-61`) maps a fixed `accountType` to a label but
   shows `account.name` as the title — a renamed default still shows its type
   badge, which is fine, but the migration backfill and `seedProfitFirstAccounts`
   rely on canonical names for the `unique(userId, name)` invariant. A user who
   renames "Profit" to "Owner Pay" hits a UNIQUE violation that surfaces only as
   a generic 500 (PATCH has no UNIQUE-catch, unlike `createAccount`).
2. There is no guard that `accountType` defaults stay structurally distinct from
   custom accounts.
   **Fix:** Decide the product rule explicitly. If default names are immutable,
   reject `name` changes when `existing.accountType !== 'CUSTOM'`. Regardless, wrap
   the `db.update(...)` in the same `UNIQUE`-constraint catch used in
   `createAccount` so a name collision returns a 400, not a 500.

### WR-03: `createAccount` UNIQUE detection relies on substring match of a driver error message

**File:** `apps/api/src/services/profit-first-service.ts:268-276`
**Issue:** `err.message.includes('UNIQUE')` is brittle: it depends on the exact
wording of the underlying driver (D1 in prod, better-sqlite3 in tests). D1 and
better-sqlite3 do not necessarily produce identical messages
(`UNIQUE constraint failed: ...` vs other phrasings/casing across versions), so a
real name collision in production may fall through to the generic 500 handler
instead of the intended 400. No test covers the duplicate-name path, so this is
unverified.
**Fix:** Pre-check existence with a scoped `SELECT ... WHERE userId AND name`
before insert (accepting the small race), or match more defensively
(`/unique/i`), and add a test asserting the 400 on duplicate name.

### WR-04: `register` self-DoS — email cooldown blocks legitimate re-registration and lets one client lock an address

**File:** `apps/api/src/services/auth-service.ts:127-157, 58-83`
**Issue:** `enforceEmailCooldown` is keyed on `__register__${email}` and runs
_before_ the existence check, throwing 429 if the same email was used within
`EMAIL_SEND_COOLDOWN_MS` (60s). Because the key is the target email (not the
caller's IP/identity), any anonymous client can send one register request for
`victim@example.com` and thereby 429 every other registration attempt for that
address for 60 seconds. While framed as anti-abuse, keying the throttle purely on
the _target_ email turns it into a griefing vector against arbitrary addresses
and gives no per-caller fairness. The login-lockout namespace is also reused via
string-prefixed keys (`__register__`, `__verify__`, `__reset__`) in the same
`login_attempts` table, which couples unrelated rate-limit domains (the code
comment at lines 461-466 acknowledges this coupling is undesirable).
**Fix:** Incorporate a per-caller dimension (IP/anonymized client id) into the
cooldown key, or move email-send throttling to a dedicated table/column rather
than overloading `login_attempts.email` with magic prefixes. At minimum document
the griefing trade-off as accepted with a tracked follow-up.

### WR-05: Auth lockout/login-attempt updates are explicitly non-atomic (race) — accept-with-test or fix

**File:** `apps/api/src/services/auth-service.ts:256-282`
**Issue:** The failed-login counter is a read-then-write (`SELECT` then
`UPDATE`/`INSERT`) with no transaction or atomic increment. Concurrent failed
logins can interleave so the count is undercounted, weakening the brute-force
lockout (the comment "D-10: non-atomic race accepted for v1" acknowledges this).
On D1 there is no multi-statement transaction guarantee here. Flagging because
this directly affects an authentication security control, not just performance.
**Fix:** Use an atomic SQL increment (`UPDATE ... SET count = count + 1`) and
compute lockout from the returned value, or a conditional `UPDATE` with a WHERE on
the previously read count. If genuinely deferred, ensure a follow-up issue tracks
it and that lockout thresholds account for the slack.

### WR-06: SSR summary fetch in `page.tsx` swallows non-2xx and all errors into a silent empty state

**File:** `apps/web/src/app/(dashboard)/profit-first/page.tsx:67-83`
**Issue:** Any non-`res.ok` (401 from an expired token, 500, etc.) and any thrown
error are silently discarded — the page renders with `totalIncome = 0` and
`accounts = []`. `PfOverview` then shows "No allocation accounts yet… contact
support," which is misleading: a logged-in user with a transient API error or an
expired access token is told they have no accounts. Because the fetch goes
direct to the API (not the BFF proxy that handles refresh), a stale access token
produces a permanent-looking empty dashboard until the next navigation refreshes
the cookie. There is no distinction between "genuinely empty," "auth expired,"
and "server error."
**Fix:** Branch on status: on 401 trigger a re-auth/redirect (or route through the
BFF proxy that already implements refresh); on other non-2xx render an explicit
error state with a retry, distinct from the empty state. Log the failure
server-side with context per `STANDARDS.md`.

### WR-07: BFF proxy returns the raw upstream body but hardcodes a single response header and drops the rest

**File:** `apps/web/src/app/api/profit-first/[...path]/route.ts:34-37`
**Issue:** The proxy reconstructs the response with only `content-type`,
discarding every other upstream header. The API attaches `Retry-After` on 429
throttling responses (see `apps/api/src/index.ts:39-41`) and sets security
headers via `securityHeaders` middleware; none of these survive the proxy. A
client hitting the rate limit through the BFF gets a 429 with no `Retry-After`,
and the security headers the API carefully sets are stripped on this path. The
status code is forwarded, but the header loss defeats the documented throttling
contract (`security.md`: "Return 429 … with a Retry-After header").
**Fix:** Forward the relevant upstream headers — at minimum `Retry-After` on 429,
and the security headers — by copying `apiRes.headers` (filtering hop-by-hop
headers) into the `NextResponse` rather than constructing a one-key object.

## Info

### IN-01: Date-range filter relies on lexicographic string comparison of `income_date`

**File:** `apps/api/src/services/profit-first-service.ts:149-154`
**Issue:** `incomeDate >= from` / `<= to` are string comparisons. This is correct
only while every value is a zero-padded `YYYY-MM-DD` string. The schema
(`summaryQuerySchema`) accepts any string for `from`/`to` with no format
validation, so a malformed `from` (e.g. `2026-1-5` or a full ISO datetime) would
compare incorrectly and silently return wrong totals rather than erroring.
**Fix:** Validate `from`/`to` against a `YYYY-MM-DD` regex (or `z.coerce.date`) in
`summaryQuerySchema` and return 422 on malformed input.

### IN-02: `targetPercentage` input precision is inconsistent between the two editors

**File:** `apps/web/src/app/(dashboard)/profit-first/_components/pf-account-form.tsx:75,80` vs `pf-percentage-editor.tsx:66`
**Issue:** The account form uses `parseFloat` and accepts any number 0–100
(fractional percents allowed → `Math.round(x*100)` bp), while the bulk editor uses
`parseInt` and `step={1}`, only allowing whole percents. A user can set 5.5% via
the form but the bulk editor will display/round it inconsistently. Minor UX/data
inconsistency, not a correctness bug given integer-bp storage.
**Fix:** Pick one precision rule (whole percent vs. 2-decimal) and apply it in
both editors and the server Zod bound.

### IN-03: Color palette duplicated across web and API with only a comment to keep them in sync

**File:** `apps/web/src/lib/constants.ts:27-36` and `apps/api/src/schemas/profit-first.ts:12-21`
**Issue:** `PF_DEFAULT_COLORS` is copy-pasted in two packages, guarded only by a
"must change in the same commit" comment. Drift is a latent bug (a UI swatch the
API rejects). Acknowledged as intentional, but worth a test that asserts the two
arrays are equal, or a shared constant exported from `@app/db`.
**Fix:** Add a unit test importing both and asserting deep equality, so drift
fails CI.

### IN-04: `as ReturnType<typeof eq>` casts on raw SQL conditions

**File:** `apps/api/src/services/profit-first-service.ts:150,153,159-163`
**Issue:** The `sql\`...\``fragments are cast`as ReturnType<typeof eq>`to push
them into the`conditions`array. This is a type assertion that bypasses the
checker rather than typing the array as`SQL[]`. Per `typescript.md` ("narrow at
the boundary; do not leak unknown") and the no-`any`/no-unsafe-cast spirit, prefer
a correctly typed array.
**Fix:** Type `conditions`as`SQL[]`(import`SQL`from`drizzle-orm`) so both
`eq(...)`and`sql\`...\`` fit without casts.

### IN-05: Test DDL is hand-maintained and can drift from the Drizzle schema

**File:** `apps/api/tests/helpers/db.ts:12-117`
**Issue:** The test harness re-declares all tables as raw DDL "keep in sync with
the Drizzle schema." Any future schema change that is not mirrored here will make
tests pass against a stale schema (false confidence). The `profit_first_accounts`
DDL currently matches the migration, so no active bug — flagging the maintenance
risk.
**Fix:** Generate the test schema from Drizzle (e.g. push the schema into the
in-memory sqlite via drizzle-kit) instead of hand-writing DDL, or add a test that
diffs the two.

---

_Reviewed: 2026-06-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
