---
phase: 260607-hci
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/db/src/schema.ts
  - packages/db/migrations/0004_*.sql
  - packages/db/migrations/meta/_journal.json
  - apps/api/src/schemas/wallets.ts
  - apps/api/src/services/wallet-service.ts
  - apps/api/tests/helpers/db.ts
  - apps/api/tests/wallets.test.ts
  - apps/api/tests/dashboard.test.ts
  - apps/web/src/types/wallet.ts
  - apps/web/src/lib/wallet-labels.ts
  - apps/web/src/app/(dashboard)/wallets/_components/WalletRow.tsx
  - apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx
  - apps/web/src/app/(dashboard)/wallets/[walletId]/_components/EditWalletDialog.tsx
  - apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx
autonomous: true
requirements: [QUICK-260607-hci]

must_haves:
  truths:
    - 'The wallets table has no source_type column; profitFirstAccountId nullability is the sole PF discriminator.'
    - 'Creating a wallet with a profitFirstAccountId produces an auto-funded (PF) wallet; creating one without produces a standalone wallet.'
    - 'PF wallets (profitFirstAccountId != null) still cannot have income-category mappings (D-08).'
    - "A wallet's profitFirstAccountId remains immutable on update."
    - 'The wallet creation form has no type picker; an optional Allocation account selector (blank = standalone) replaces it.'
    - 'API Vitest suite passes with no remaining sourceType references.'
  artifacts:
    - path: 'packages/db/migrations/0004_*.sql'
      provides: 'Migration dropping wallets.source_type via SQLite table-rebuild'
      contains: 'wallets'
    - path: 'apps/api/src/services/wallet-service.ts'
      provides: 'PF logic keyed on profitFirstAccountId, not sourceType'
    - path: 'apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx'
      provides: 'Optional allocation-account selector replacing the type picker'
  key_links:
    - from: 'apps/api/src/services/wallet-service.ts'
      to: 'wallets.profitFirstAccountId'
      via: 'null-check discriminator'
      pattern: 'profitFirstAccountId'
    - from: 'apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx'
      to: 'createWalletAction'
      via: 'profitFirstAccountId (no sourceType)'
      pattern: 'profitFirstAccountId'
---

<objective>
Remove the redundant `sourceType` enum from the wallets feature end to end. The nullable
`profitFirstAccountId` column becomes the sole discriminator: non-null = wallet auto-funded by its
Profit First allocation; null = standalone wallet.

Purpose: Eliminate a derivable, drift-prone column. Today `sourceType` can disagree with
`profitFirstAccountId` (zombie `PROFIT_FIRST` rows with null account id). One source of truth removes
that class of bug and simplifies create/update/UI paths.

Output: Migration dropping `wallets.source_type`; service, schema, types, labels, and UI keyed on
`profitFirstAccountId` nullability; API Vitest suite green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

<working_tree_warning>
The working tree is DIRTY — several wallet files already have uncommitted in-flight edits unrelated
to this change. RULES for this plan:

- Make SURGICAL edits only to sourceType-related code. Do NOT revert, reformat, or "clean up"
  unrelated uncommitted changes in the files you touch.
- When committing, stage ONLY the files this plan modifies, BY EXPLICIT PATH. NEVER run
  `git add -A` or `git add .` — doing so would sweep in unrelated in-flight work.
- If a file you must edit also contains unrelated pending edits, keep those edits intact and add
  only your sourceType-removal changes.
  </working_tree_warning>

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase — no exploration required. -->

DB schema (packages/db/src/schema.ts ~line 197) — line to DELETE inside the `wallets` table:
sourceType: text('source_type', { enum: ['PROFIT_FIRST', 'BLANK'] }).notNull(),
Keep `profitFirstAccountId` (line ~199, nullable, no cascade) and the unique index
`wallets_user_pf_account_unique` (line ~217) exactly as-is (D-05).

Zod schema (apps/api/src/schemas/wallets.ts):

- walletBaseSchema currently has `sourceType: z.enum(['PROFIT_FIRST', 'BLANK'])` (DELETE) and keeps
  `profitFirstAccountId: z.number().int().positive().optional().nullable()`.
- `createWalletSchema` is `walletBaseSchema.refine(...)` enforcing PF→account-required. After removing
  sourceType, the refine is meaningless — DELETE it; `createWalletSchema = walletBaseSchema` directly.
  (`.partial()` on a non-refined object schema still works, so `updateWalletSchema` is unaffected.)

Service (apps/api/src/services/wallet-service.ts) — `wallet.profitFirstAccountId` is `number | null`:

- `assertCanInsertTransaction` (line ~63) ALREADY uses `const hasPf = !!wallet.profitFirstAccountId;`
  — leave it; it is correct.
- `setIncomeCategoryMappings(walletId, userId, sourceType: string, ids)` (line ~250). The D-08 guard at
  line ~257 is `if (sourceType === 'PROFIT_FIRST') return;`. Change the signature's discriminator from
  `sourceType: string` to `profitFirstAccountId: number | null` and the guard to
  `if (profitFirstAccountId != null) return;`. Update both call sites: create() at line ~550 passes
  `created.sourceType` → pass `created.profitFirstAccountId`; update() at line ~596 passes
  `wallet.sourceType` → pass `wallet.profitFirstAccountId`.
- list() pfAllocation gate (line ~463):
  `if (wallet.sourceType === 'PROFIT_FIRST' && wallet.profitFirstAccountId != null)`
  → `if (wallet.profitFirstAccountId != null)`.
- create() PF-uniqueness gate (line ~518):
  `if (input.sourceType === 'PROFIT_FIRST' && input.profitFirstAccountId != null)`
  → `if (input.profitFirstAccountId != null)`.
- create() insert .values(...) at line ~540 includes `sourceType: input.sourceType,` — DELETE that line.
- getById() pfAllocation gate (line ~703):
  `if (wallet.sourceType === 'PROFIT_FIRST' && wallet.profitFirstAccountId != null)`
  → `if (wallet.profitFirstAccountId != null)`.
- update() (line ~573) already does NOT write profitFirstAccountId — keep it that way (decision 3:
  PF link immutable). Do not add profitFirstAccountId to updateData.

Test helper DDL (apps/api/tests/helpers/db.ts line ~124) has `source_type TEXT NOT NULL,` inside the
`CREATE TABLE wallets (...)` block — DELETE that line so the shim matches the new schema.

Web type (apps/web/src/types/wallet.ts):

- `export type WalletSourceType = 'PROFIT_FIRST' | 'BLANK';` (line 4) — DELETE.
- `WalletListItem.sourceType: WalletSourceType;` (line 11) — DELETE field. Keep
  `profitFirstAccountId: number | null;`.
- `CreateWalletInput.sourceType: WalletSourceType;` (line 58) — DELETE field. Keep optional
  `profitFirstAccountId?: number | null;`.

Web labels (apps/web/src/lib/wallet-labels.ts):

- `sourceLabel(sourceType: WalletSourceType)` — re-key to derive from PF link. New signature suggestion:
  `sourceLabel(profitFirstAccountId: number | null): string` returning `'Profit First'` when non-null
  else `'Standalone'`.
- `withdrawalLabel(sourceType, accountType)` is EXPORTED BUT NEVER IMPORTED anywhere (grep confirms zero
  consumers). Re-key its first param to `profitFirstAccountId: number | null` (PF branch when non-null)
  to keep it type-clean after WalletSourceType is deleted, OR delete the function — executor's
  discretion; deleting is acceptable since it is dead code, but if kept it must compile.

UI consumers:

- WalletRow.tsx line 78: `sourceLabel(wallet.sourceType)` → `sourceLabel(wallet.profitFirstAccountId)`.
- WalletDetail.tsx line 389: `sourceLabel(wallet.sourceType)` → `sourceLabel(wallet.profitFirstAccountId)`.
  line 368: `const isPfWallet = wallet.sourceType === 'PROFIT_FIRST';`
  → `const isPfWallet = wallet.profitFirstAccountId != null;`.
- EditWalletDialog.tsx line 80: `const isPfWallet = wallet.sourceType === 'PROFIT_FIRST';`
  → `const isPfWallet = wallet.profitFirstAccountId != null;`. (Edit already keeps PF link immutable.)
- NewWalletForm.tsx: remove the "Wallet Type" Select (lines ~189-223) and the local `sourceType` state
  (lines ~76-78). Keep the Allocation Account selector but make it ALWAYS visible and OPTIONAL
  (blank = standalone). Derive PF-ness from whether an account is chosen:
  `const isPf = pfAccountId != null && pfAccountId !== '';`. Submit
  `profitFirstAccountId: isPf ? Number(pfAccountId) : null` and DROP `sourceType` from the
  createWalletAction payload. Income-categories section currently gated on `sourceType !== 'PROFIT_FIRST'`
  → gate on `!isPf`. Drop the client validation that required a PF account for PROFIT_FIRST (decision 6:
  blank is now valid). If `Select` from shadcn cannot represent an empty/clear choice cleanly, add a
  leading "Standalone (no allocation)" item with a sentinel value and map it to null.
  </interfaces>

Test commands run from `apps/api`. Migration generation runs from `packages/db`.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Drop source_type from the schema, generate the migration, and sync the test DDL</name>
  <files>packages/db/src/schema.ts, packages/db/migrations/, packages/db/migrations/meta/_journal.json, apps/api/tests/helpers/db.ts</files>
  <action>
Remove the `sourceType` line from the `wallets` table in packages/db/src/schema.ts (see
&lt;interfaces&gt;). Leave `profitFirstAccountId`, the `wallets_user_idx`, and the
`wallets_user_pf_account_unique` unique index untouched (decisions 1 and 5).

Generate a new migration with drizzle-kit so the column drop is captured: run
`npm run generate -w packages/db` (drizzle-kit reads drizzle.config.ts; dialect sqlite, out
./migrations). This produces `0004_*.sql` plus an updated `meta/_journal.json` and snapshot.
SQLite cannot `ALTER TABLE ... DROP COLUMN` for all cases — drizzle-kit emits table-rebuild
semantics (create-new / copy / drop-old / rename); accept whatever it generates. Inspect the
generated 0004 SQL and confirm it (a) does not drop `profit_first_account_id`, (b) preserves the
`wallets_user_pf_account_unique` unique index, and (c) preserves the FK to
`profit_first_accounts(id)`. If the generated migration would drop the unique index or FK, hand-fix
the generated SQL to re-create them (still inside the same 0004 file).

Then update the in-memory test DDL in apps/api/tests/helpers/db.ts: delete the
`source_type TEXT NOT NULL,` line (~line 124) from the `CREATE TABLE wallets (...)` block so the shim
matches the new schema. Do not touch any other table in the DDL.

Do NOT apply the migration to a remote/production D1 (decision 7 covers data: column drop loses no
information; legacy zombie rows become standalone wallets — accepted). Generation only.
</action>
<verify>
<automated>cd /home/orjanbognot/projects/orjan/profitmuna-main && ls packages/db/migrations/0004\_\*.sql && grep -L "source_type" packages/db/src/schema.ts | grep -q schema.ts && ! grep -q "source_type" apps/api/tests/helpers/db.ts && npm run typecheck -w packages/db</automated>
</verify>
<done>schema.ts has no source_type; a 0004 migration exists and preserves profit_first_account_id + the unique index + FK; test DDL has no source_type; packages/db typecheck passes.</done>
</task>

<task type="auto">
  <name>Task 2: Re-key the API (Zod schema + service) onto profitFirstAccountId and green the Vitest suite</name>
  <files>apps/api/src/schemas/wallets.ts, apps/api/src/services/wallet-service.ts, apps/api/tests/wallets.test.ts, apps/api/tests/dashboard.test.ts</files>
  <action>
Schema (apps/api/src/schemas/wallets.ts): delete the `sourceType` enum field from `walletBaseSchema`
and delete the `.refine(...)` on `createWalletSchema` (decision 4). Set
`export const createWalletSchema = walletBaseSchema;`. Keep `profitFirstAccountId` optional/nullable
and leave `updateWalletSchema = walletBaseSchema.partial()` as-is.

Service (apps/api/src/services/wallet-service.ts): apply all six edits in &lt;interfaces&gt;:

1. Change `setIncomeCategoryMappings` third param from `sourceType: string` to
   `profitFirstAccountId: number | null`; D-08 guard becomes `if (profitFirstAccountId != null) return;`
   (decision 2 — PF-linked wallets still cannot have income-category mappings).
2. create() call site: pass `created.profitFirstAccountId` instead of `created.sourceType`.
3. update() call site: pass `wallet.profitFirstAccountId` instead of `wallet.sourceType`.
4. list() pfAllocation gate → `if (wallet.profitFirstAccountId != null)`.
5. create() PF-uniqueness gate → `if (input.profitFirstAccountId != null)`.
6. create() insert .values(): delete the `sourceType: input.sourceType,` line.
7. getById() pfAllocation gate → `if (wallet.profitFirstAccountId != null)`.
   Do NOT add profitFirstAccountId to update()'s updateData (decision 3 — PF link immutable). Leave
   `assertCanInsertTransaction`'s existing `!!wallet.profitFirstAccountId` check unchanged.

Tests: remove every `sourceType: 'PROFIT_FIRST' | 'BLANK'` from the seedWallet helper in
dashboard.test.ts (the helper type field AND the `.values({ sourceType: ... })` line) and drop the
`sourceType:` keys from its three call sites — PF-ness is now implied by `profitFirstAccountId`.
In wallets.test.ts, remove all `sourceType: 'PROFIT_FIRST'` / `sourceType: 'BLANK'` keys from the
~30 `svc.create(...)` and seed call sites; where a test was `PROFIT_FIRST` it must pass a
`profitFirstAccountId` (most already do), and where it was `BLANK` it simply omits both.
Replace any `expect(wallet.sourceType).toBe(...)` assertions with equivalent assertions on
`wallet.profitFirstAccountId` (non-null for PF, null for standalone). Keep the D-08 test ("PROFIT_FIRST
wallet does not apply income mappings") meaningful by linking a profitFirstAccountId and asserting no
income mappings were written. Do not weaken or delete behavioral assertions — only re-key the
discriminator.

Run the API suite and fix until green.
</action>
<verify>
<automated>cd /home/orjanbognot/projects/orjan/profitmuna-main/apps/api && ! grep -rn "sourceType\|source_type\|PROFIT_FIRST" src tests && npm run typecheck && npm test</automated>
</verify>
<done>No sourceType/source_type/PROFIT_FIRST string remains in apps/api/src or apps/api/tests; API typecheck passes; full Vitest suite passes.</done>
</task>

<task type="auto">
  <name>Task 3: Re-key the web layer (types, labels, UI) and drop the wallet-type picker</name>
  <files>apps/web/src/types/wallet.ts, apps/web/src/lib/wallet-labels.ts, apps/web/src/app/(dashboard)/wallets/_components/WalletRow.tsx, apps/web/src/app/(dashboard)/wallets/[walletId]/_components/WalletDetail.tsx, apps/web/src/app/(dashboard)/wallets/[walletId]/_components/EditWalletDialog.tsx, apps/web/src/app/(dashboard)/wallets/new/_components/NewWalletForm.tsx</files>
  <action>
Types (apps/web/src/types/wallet.ts): delete `WalletSourceType` (line 4); delete the `sourceType`
field from `WalletListItem` (keep `profitFirstAccountId: number | null`); delete `sourceType` from
`CreateWalletInput` (keep optional `profitFirstAccountId?: number | null`). `UpdateWalletInput` is a
Partial of CreateWalletInput — no change needed.

Labels (apps/web/src/lib/wallet-labels.ts): re-key `sourceLabel` to
`sourceLabel(profitFirstAccountId: number | null): string` returning `'Profit First'` when non-null,
else `'Standalone'`. For `withdrawalLabel` (dead code — zero importers): either delete it, or re-key
its first param to `profitFirstAccountId: number | null` so the file still compiles after
WalletSourceType is gone (executor's discretion; whichever is chosen must typecheck and lint clean).

UI:

- WalletRow.tsx: `sourceLabel(wallet.sourceType)` → `sourceLabel(wallet.profitFirstAccountId)`.
- WalletDetail.tsx: `sourceLabel(wallet.sourceType)` → `sourceLabel(wallet.profitFirstAccountId)`;
  `isPfWallet = wallet.sourceType === 'PROFIT_FIRST'` → `isPfWallet = wallet.profitFirstAccountId != null`.
- EditWalletDialog.tsx: `isPfWallet = wallet.sourceType === 'PROFIT_FIRST'`
  → `isPfWallet = wallet.profitFirstAccountId != null`. (PF link already immutable in edit — keep so.)
- NewWalletForm.tsx (decision 6): remove the "Wallet Type" Select block and the `sourceType` state.
  Make the Allocation Account selector ALWAYS visible and OPTIONAL — blank means standalone. Compute
  `const isPf = !!pfAccountId;`. Gate the Income Categories section on `!isPf` (was
  `sourceType !== 'PROFIT_FIRST'`). In `createWalletAction({...})`, drop `sourceType` and send
  `profitFirstAccountId: isPf ? Number(pfAccountId) : null` and
  `incomeCategoryIds: !isPf ? selectedIncomeCategoryIds : undefined`. Remove the client-side validation
  that required a PF account (a blank account is now valid). If shadcn `Select` cannot clear to empty,
  add a leading item like "Standalone (no allocation)" with a sentinel value mapped to null. Keep the
  `linkedPfAccountIds` disabling behavior on PF account options intact (one wallet per PF account).
  The `prefilledPfAccountId` quick-create path (?pfAccountId=...) must still pre-select that account.

Typecheck and lint the web app.
</action>
<verify>
<automated>cd /home/orjanbognot/projects/orjan/profitmuna-main && ! grep -rn "sourceType\|WalletSourceType\|PROFIT_FIRST" apps/web/src && npm run typecheck -w apps/web && npm run lint -w apps/web</automated>
</verify>
<done>No sourceType/WalletSourceType/PROFIT_FIRST remains in apps/web/src; the new-wallet form has no type picker and an optional allocation selector (blank = standalone); web typecheck and lint pass.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary              | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| web client → Hono API | wallet create/update payloads cross here (now without sourceType) |
| API → D1              | wallet rows persisted/queried (schema column dropped)             |

## STRIDE Threat Register

| Threat ID | Category  | Component                       | Disposition | Mitigation Plan                                                                                                                                              |
| --------- | --------- | ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-hci-01  | Tampering | createWalletSchema (Zod)        | mitigate    | profitFirstAccountId stays validated as positive int / nullable; removing the enum does not loosen any other field. Route validation unchanged.              |
| T-hci-02  | Elevation | wallet update() PF link         | mitigate    | update() continues to NOT write profitFirstAccountId (decision 3) — a user cannot reassign a wallet's funding source by editing.                             |
| T-hci-03  | Tampering | D-08 income-mapping guard       | mitigate    | Guard re-keyed to `profitFirstAccountId != null`; PF-linked wallets still rejected from income mappings — behavior preserved, covered by the kept D-08 test. |
| T-hci-SC  | Tampering | npm/drizzle-kit (migration gen) | accept      | No new dependencies installed; `npm run generate` uses already-pinned drizzle-kit. No package-manager install tasks in this plan.                            |

</threat_model>

<verification>
- `cd packages/db && npm run typecheck` passes; a `0004_*.sql` migration exists that drops
  `source_type` while preserving `profit_first_account_id`, the unique index, and the FK.
- `cd apps/api && npm run typecheck && npm test` — full Vitest suite green, zero sourceType references.
- `npm run typecheck -w apps/web && npm run lint -w apps/web` pass, zero sourceType references.
- Repo-wide (excluding build artifacts) the only remaining `source_type` mentions are inside historical
  migrations 0000–0003 and their meta snapshots (immutable history — leave them).
</verification>

<success_criteria>

- `wallets` schema and test DDL have no `source_type`; a forward migration drops the column.
- All PF behavior (allocation in list/getById, create uniqueness, D-08 income-mapping block,
  manual-deposit block) keys on `profitFirstAccountId != null`.
- `profitFirstAccountId` remains immutable on update.
- The wallet creation form drops the type picker and uses an optional allocation-account selector
  (blank = standalone); income-category section gated on absence of a PF link.
- API Vitest suite passes; web typecheck + lint pass.
- Only the files listed in `files_modified` were staged/committed (by explicit path; no `git add -A`).
  </success_criteria>

<output>
Create `.planning/quick/260607-hci-remove-wallet-sourcetype-enum/260607-hci-SUMMARY.md` when done.
</output>
