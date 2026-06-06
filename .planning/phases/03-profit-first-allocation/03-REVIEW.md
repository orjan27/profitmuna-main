---
phase: 03-profit-first-allocation
reviewed: 2026-06-06T12:00:00Z
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
  critical: 0
  warning: 6
  info: 6
  total: 12
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-06T12:00:00Z (incremental re-review after gap-closure plans 03-05 and 03-06)
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Incremental re-review covering four files changed in commits dc1b5a2, ce8dc62, 72bd68c, and 75d7e2a:
`profit-first-service.ts`, `profit-first.test.ts`, `page.tsx`, and `pf-filters.tsx`.

**CR-01 is resolved.** The exact-coverage check in `updatePercentages` now correctly
rejects missing, foreign, and duplicate IDs server-side; the partial-set regression
test confirms the guard fires before any write. **WR-01 is resolved.** `page.tsx`
now derives `categoryOptions` from the summary response and passes them to `PfFilters`,
making the category filter genuinely reachable.

One new warning (WR-08) was found in the gap-closure code: `getIncomeCategories`
uses `selectDistinct` on the `(categoryId, categoryName)` pair, which returns
multiple rows for the same category when the denormalized name was ever updated —
turning one logical category into two filter options. WR-02 through WR-07 remain
open unchanged. One new info item (IN-06) documents the `searchParams` type annotation
issue in `page.tsx`.

## Critical Issues

_No open critical issues. CR-01 resolved — see resolution note below._

### ~~CR-01: `updatePercentages` validates only the submitted subset — the 100% invariant can be bypassed~~ — RESOLVED

**Resolved in:** `apps/api/src/services/profit-first-service.ts` (commits dc1b5a2 / ce8dc62)

The three-condition guard at lines 435–443 now correctly enforces exact coverage:

1. `submittedIds.size !== input.accounts.length` — catches duplicate IDs in the payload
2. `ownedIds.size !== submittedIds.size` — catches any count mismatch (missing or extra accounts)
3. `[...submittedIds].some((id) => !ownedIds.has(id))` — catches foreign IDs

All three cases (missing, foreign, duplicate) throw `400 "Submit all accounts exactly once."` before any DB write occurs. The regression test `PF-03: rejects a partial-set submission (single account) with 400` (test file lines 312–351) passes a single account set whose percentage sum equals 10000 — the old code would have accepted this; the new guard correctly rejects it and the post-rejection assertion confirms no writes occurred (OWNERS_PAY retains 5000 bp).

## Warnings

### WR-02: Default accounts can be renamed and re-percentaged via PATCH, with no `accountType` protection

**File:** `apps/api/src/services/profit-first-service.ts:322-366`
**Issue:** `updateAccount` only checks ownership; it allows changing `name`,
`color`, `sortOrder`, and `targetPercentage` of **any** account including the
four defaults. Renaming a default (e.g. "Profit" → "Foo") is silently allowed.
This breaks two assumptions:

1. The web UI (`pf-overview.tsx`) maps a fixed `accountType` to a label but
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

**File:** `apps/api/src/services/profit-first-service.ts:304-311`
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
comment acknowledges this coupling is undesirable).

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

**File:** `apps/web/src/app/(dashboard)/profit-first/page.tsx:69-87`
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
throttling responses and sets security headers via `securityHeaders` middleware;
none of these survive the proxy. A client hitting the rate limit through the BFF
gets a 429 with no `Retry-After`, and the security headers the API carefully sets
are stripped on this path. The status code is forwarded, but the header loss
defeats the documented throttling contract.

**Fix:** Forward the relevant upstream headers — at minimum `Retry-After` on 429,
and the security headers — by copying `apiRes.headers` (filtering hop-by-hop
headers) into the `NextResponse` rather than constructing a one-key object.

### WR-08: `getIncomeCategories` uses `selectDistinct` on `(categoryId, categoryName)` — stale denormalized names produce duplicate filter options

**File:** `apps/api/src/services/profit-first-service.ts:191-205`
**Issue:** The query selects `DISTINCT (categoryId, categoryName)`. Because
`categoryName` is a denormalized column that is updated on category rename (D-13),
a category that has ever been renamed will have incomes with two different
`categoryName` values for the same `categoryId`. `selectDistinct` on both columns
returns one row per distinct pair, producing two filter options for what the user
sees as a single category (e.g. "Sales" and "Old Name" both appearing for
category ID 7).

```ts
// current — returns two rows if categoryName was ever changed on cat.id 7
.selectDistinct({ id: incomes.categoryId, name: incomes.categoryName })
```

The mapped result `rows.map((r) => ({ id: r.id, name: r.name }))` then exposes
both names to the UI. The test at lines 538–609 seeds fresh categories with no
renames, so it does not catch this regression path.

**Fix:** Aggregate by `categoryId` and take the latest name:

```ts
const rows = await db
  .select({
    id: incomes.categoryId,
    name: sql<string>`MAX(${incomes.categoryName})`,
  })
  .from(incomes)
  .where(
    and(
      eq(incomes.userId, userId),
      eq(incomes.moneyStatus, 'RECEIVED'),
      eq(incomes.profitFirstAllocated, true)
    )
  )
  .groupBy(incomes.categoryId)
  .orderBy(sql`MAX(${incomes.categoryName})`);
```

Alternatively, join to `incomeCategories` on `categoryId` and select the
canonical `incomeCategories.name` — that is always current and avoids the
denormalization problem entirely. Add a test that renames a category, inserts
income under both names for the same `categoryId`, and asserts `categories` has
length 1.

## Info

### IN-01: Date-range filter relies on lexicographic string comparison of `income_date`

**File:** `apps/api/src/services/profit-first-service.ts:155-169`
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

**File:** `apps/api/src/services/profit-first-service.ts:156,159,165-169`
**Issue:** The `sql\`...\``fragments are cast`as ReturnType<typeof eq>`to push
them into the`conditions`array. This is a type assertion that bypasses the
checker rather than typing the array as`SQL[]`. Per the no-`any`/no-unsafe-cast
spirit, prefer a correctly typed array.

**Fix:** Type `conditions` as `SQL[]` (import `SQL` from `drizzle-orm`) so both
`eq(...)` and `sql\`...\`` fit without casts.

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

### IN-06: `searchParams` type annotation in `page.tsx` under-declares `categoryIds` as `string`

**File:** `apps/web/src/app/(dashboard)/profit-first/page.tsx:46-48`
**Issue:** The Next.js App Router types `searchParams` as
`Promise<{ [key: string]: string | string[] | undefined }>`, but the page
annotation narrows `categoryIds` to `string`. When a URL contains repeated keys
(`?categoryIds=1&categoryIds=2`), Next.js provides an array, not a string. The
call `query.set('categoryIds', params.categoryIds)` would then receive a
`string[]` and silently coerce it to `"1,2"` via `Array.toString()`. This happens
to produce the comma-separated format the API expects, so it works accidentally in
the happy path — but TypeScript strict mode should reject the call as a type error.
In practice `nuqs` serializes `parseAsArrayOf(parseAsString)` as a single
comma-separated value so repeated keys do not arise from the current UI, but the
type lie creates a latent risk for anyone adding new navigation sources.

**Fix:** Widen the annotation to `string | string[] | undefined` and handle the
array case explicitly:

```ts
searchParams: Promise<{ from?: string; to?: string; categoryIds?: string | string[] }>;
// ...
const rawCategoryIds = params.categoryIds;
if (rawCategoryIds) {
  query.set(
    'categoryIds',
    Array.isArray(rawCategoryIds) ? rawCategoryIds.join(',') : rawCategoryIds
  );
}
```

---

_Reviewed: 2026-06-06T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
