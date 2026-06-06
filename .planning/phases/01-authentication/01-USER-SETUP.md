# Phase 1: User Setup Required

**Generated:** 2026-06-06
**Phase:** 01-authentication
**Status:** Incomplete

Complete these items for the integration to function. Claude automated everything possible; these items require human access to external dashboards/accounts.

## Environment Variables

| Status | Variable              | Source                                                                              | Add to                                                    |
| ------ | --------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [ ]    | `RESEND_API_KEY`      | Resend Dashboard → API Keys → Create API Key                                        | `apps/api/.dev.vars` (dev) / `wrangler secret put` (prod) |
| [ ]    | `JWT_ACCESS_SECRET`   | Generate locally: `openssl rand -hex 32`                                            | `apps/api/.dev.vars` / `wrangler secret put`              |
| [ ]    | `JWT_REFRESH_SECRET`  | Generate locally: `openssl rand -hex 32`                                            | `apps/api/.dev.vars` / `wrangler secret put`              |
| [ ]    | `GOOGLE_CLIENT_ID`    | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID          | `apps/api/wrangler.toml [vars]`                           |
| [ ]    | `GOOGLE_REDIRECT_URI` | The exact callback URL, e.g. `http://localhost:8793/api/auth/google/callback` (dev) | `apps/api/wrangler.toml [vars]`                           |

## Secrets

| Status | Secret                 | Source                                                                     | Add to                                                                         |
| ------ | ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [ ]    | `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID | `apps/api/.dev.vars` (dev) / `wrangler secret put GOOGLE_CLIENT_SECRET` (prod) |

## Account Setup

- [ ] **Create Resend account**
  - URL: https://resend.com/signup
  - Skip if: Already have account

## Dashboard Configuration

- [ ] **Sender address (RESEND_FROM_EMAIL)**
  - Location: Resend Dashboard → Domains
  - Set to: Use `onboarding@resend.dev` for dev (already the default in `wrangler.toml [vars]`); verify a real domain for production and update `RESEND_FROM_EMAIL`
  - Notes: Verification + welcome emails will not deliver until the API key is set

- [ ] **Google OAuth client + authorized redirect URI**
  - Location: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
  - Create an OAuth 2.0 Client ID (type: Web application) if one does not exist
  - Under **Authorized redirect URIs**, add the exact callback URL — it must equal `GOOGLE_REDIRECT_URI` character-for-character (e.g. `http://localhost:8793/api/auth/google/callback` for dev; the production URL for prod)
  - Notes: Google sign-in (AUTH-03) will return `redirect_uri_mismatch` until this URI is registered

## Google OAuth (AUTH-03) — Live Verification

The Google sign-in code (authorize + callback routes, `upsertGoogleUser` account linking, session
issuance, login-page link) is fully implemented and unit-tested with the Google calls mocked. The
live end-to-end consent flow cannot be unit-tested — it requires the real Google consent screen — and
is **deferred to UAT**. To verify once credentials are in place:

1. Set `GOOGLE_CLIENT_ID` + `GOOGLE_REDIRECT_URI` in `apps/api/wrangler.toml [vars]`; set the secret with `wrangler secret put GOOGLE_CLIENT_SECRET` (or add it to `apps/api/.dev.vars` for dev).
2. In Google Cloud Console, add the exact redirect URI (e.g. `http://localhost:8793/api/auth/google/callback`) to **Authorized redirect URIs**.
3. Run the API (`npm run dev` in `apps/api`) and web (`npm run dev` in `apps/web`).
4. Visit the login page, click **Sign in with Google**, complete consent.
5. Confirm: you land back signed in (access + refresh cookies set) and a `users` row exists with `google_id` set and `email_verified=true`.
6. Repeat with an email that already had a password account and confirm it **LINKS** (the same row gets `google_id`) rather than creating a duplicate.

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
