# Phase 1: User Setup Required

**Generated:** 2026-06-06
**Phase:** 01-authentication
**Status:** Incomplete

Complete these items for the integration to function. Claude automated everything possible; these items require human access to external dashboards/accounts.

## Environment Variables

| Status | Variable             | Source                                       | Add to                                                    |
| ------ | -------------------- | -------------------------------------------- | --------------------------------------------------------- |
| [ ]    | `RESEND_API_KEY`     | Resend Dashboard → API Keys → Create API Key | `apps/api/.dev.vars` (dev) / `wrangler secret put` (prod) |
| [ ]    | `JWT_ACCESS_SECRET`  | Generate locally: `openssl rand -hex 32`     | `apps/api/.dev.vars` / `wrangler secret put`              |
| [ ]    | `JWT_REFRESH_SECRET` | Generate locally: `openssl rand -hex 32`     | `apps/api/.dev.vars` / `wrangler secret put`              |

## Account Setup

- [ ] **Create Resend account**
  - URL: https://resend.com/signup
  - Skip if: Already have account

## Dashboard Configuration

- [ ] **Sender address (RESEND_FROM_EMAIL)**
  - Location: Resend Dashboard → Domains
  - Set to: Use `onboarding@resend.dev` for dev (already the default in `wrangler.toml [vars]`); verify a real domain for production and update `RESEND_FROM_EMAIL`
  - Notes: Verification + welcome emails will not deliver until the API key is set

## Production Database (deploy-time)

- [ ] **Create the remote D1 database and apply migrations**
  - Run: `npx wrangler login`, then `npx wrangler d1 create profitmuna-main-db`
  - Replace `database_id = "local"` in `apps/api/wrangler.toml` with the real id
  - Apply: `cd apps/api && npx wrangler d1 migrations apply profitmuna-main-db --remote`
  - Skip if: Only developing locally (local migrations already applied)

## Verification

After completing setup, verify with:

```bash
cd apps/api && npx wrangler dev --port 8793
# In another terminal:
curl -X POST http://localhost:8793/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","name":"You","password":"password123"}'
```

Expected results:

- 201 response with `{"data":{"message":"registration_received"}}`
- Verification + welcome emails arrive at the registered address via Resend

---

**Once all items complete:** Mark status as "Complete" at top of file.
