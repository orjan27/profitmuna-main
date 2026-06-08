# Deployment

Profitmuna deploys to **Cloudflare Workers** (API + Web) with a **Cloudflare D1**
database. Deploys are automated: every push/merge to `master` triggers
`.github/workflows/deploy.yml`, which gates on typecheck + tests, applies D1
migrations, then deploys both Workers.

```
push → master
  └─ npm ci → typecheck → test
       └─ wrangler d1 migrations apply DB --remote --env production
            └─ wrangler deploy --env production           (apps/api → profitmuna-main-api)
                 └─ opennextjs-cloudflare deploy          (apps/web → profitmuna-main-web)
```

The API uses a `[env.production]` section in `apps/api/wrangler.toml`; local
`wrangler dev` keeps using the top-level dev config untouched. The web app is
built and bundled for Workers by `@opennextjs/cloudflare` using
`apps/web/wrangler.jsonc`.

## Hosts

| Worker                | Custom domain             | Notes                            |
| --------------------- | ------------------------- | -------------------------------- |
| `profitmuna-main-api` | `main-api.profitmuna.com` | Hono API + hourly cron trigger   |
| `profitmuna-main-web` | `main.profitmuna.com`     | Next.js (BFF proxies to the API) |

The browser only ever talks to `main.profitmuna.com`; the web Worker forwards
server-to-server to `main-api.profitmuna.com` via its `API_BASE_URL` var.

## One-time setup (CI assumes these are already done)

### 1. GitHub repository secrets

Settings → Secrets and variables → Actions:

| Secret                  | Value                    |
| ----------------------- | ------------------------ |
| `CLOUDFLARE_API_TOKEN`  | API token (scopes below) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID    |

API token scopes (dash.cloudflare.com/profile/api-tokens):

- Account → Workers Scripts → **Edit**
- Account → D1 → **Edit**
- Account → Workers Routes → **Edit** (required for `custom_domain` routes)
- User → User Details → **Read** (Account Settings Read)

### 2. Worker runtime secrets

Set once per secret on the **production** API Worker — they persist in
Cloudflare and are not re-set by CI:

```bash
cd apps/api
npx wrangler secret put JWT_ACCESS_SECRET   --env production
npx wrangler secret put RESEND_API_KEY      --env production
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

The web Worker requires no secrets.

### 3. Google OAuth

In the Google Cloud console, add the production redirect URI to the OAuth client:

```
https://main-api.profitmuna.com/api/auth/google/callback
```

### 4. Custom domains

`main-api.profitmuna.com` and `main.profitmuna.com` must resolve to zones on
this Cloudflare account. The
`custom_domain = true` routes in `apps/api/wrangler.toml` and
`apps/web/wrangler.jsonc` provision the hostnames automatically on first deploy.

## Verifying / rolling back

```bash
# Migrations are current (no pending):
cd apps/api && npx wrangler d1 migrations list DB --remote --env production

# Live logs / deployment history:
npx wrangler tail --env production
npx wrangler deployments list --env production

# Roll back the API Worker to the previous version:
npx wrangler rollback --env production
```

For the web Worker, roll back from `apps/web` (`npx wrangler deployments list` /
`npx wrangler rollback`) or re-deploy a known-good commit.

## Manual deploy (escape hatch)

```bash
npm ci
cd apps/api && npx wrangler d1 migrations apply DB --remote --env production
cd apps/api && npx wrangler deploy --env production
cd apps/web && npm run deploy
```
