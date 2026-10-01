# Setup guide

Run commands from the repository root. The web app and docs share npm workspaces and the root lockfile.

## Before you start

Use Node.js 20.9 or later and npm. Check with `node --version` and `npm --version`. The web app needs a Supabase database, an Auth.js secret, and credentials for the sign-in and AI providers you test. The docs site needs no web-app credentials.

## Run the web app locally

1. Install the locked dependencies with `npm ci`.
2. Copy the environment template into the web workspace.

   PowerShell:

   ```powershell
   Copy-Item .env.example apps/web/.env.local
   ```

   macOS/Linux:

   ```bash
   cp .env.example apps/web/.env.local
   ```

3. Edit `apps/web/.env.local`. Replace the production defaults for `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` with `http://localhost:3000`. Generate a random `AUTH_SECRET`:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

4. Fill in the server credentials below and register the matching OAuth callbacks.
5. Run `npm run dev` and open `http://localhost:3000`.

If you use another port, update both URL variables and your OAuth registrations to match. Restart the server after editing environment variables.

## Environment configuration

[`.env.example`](.env.example) is the full template. Keep secrets in `apps/web/.env.local` or your deployment environment; never commit them or give server secrets a `NEXT_PUBLIC_` prefix.

| Variables | Purpose |
| --- | --- |
| `AUTH_SECRET` | Signs Auth.js JWT sessions; required for the web app |
| `AUTH_URL`, `NEXT_PUBLIC_SITE_URL` | Local or production origin, including the correct port |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server database access; the service-role key must stay server-side |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | GitHub OAuth credentials |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth credentials |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY` | Hosted AI providers; configure the providers needed by the models you test |
| `OPENWEATHER_API_KEY` | OpenWeatherMap weather source |
| `WEATHERAPI_KEY`, `VISUALCROSSING_API_KEY`, `PIRATEWEATHER_API_KEY` | Optional additional weather sources; Open-Meteo needs no API key |
| `DEV_EMAILS` | Optional developer accounts; grants privileged access and bypasses usage limits |
| `CRON_SECRET` | Authenticates the automatic-recommendation worker when its scheduler is configured |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `SHOP_SOURCE_APPROVED` | Official Shop source; leave approval disabled until production access and source rights are approved |

The Free model list uses Gemini or Mistral. An OpenAI key alone does not configure those Free models.

## Database setup

[`supabase/schema.sql`](supabase/schema.sql) contains baseline tables. It is not a complete replay of the deployed database. Review the SQL assets required by your environment before executing them.

Read the [migration notes](supabase/migrations/README.md), and [database regression guide](supabase/tests/README.md). The migration folder does not reconstruct all older remote history. Do not blindly reapply recorded migrations or push the partial chain to an existing project.

Checkout is unavailable. Local setup does not activate purchases or change the deployed account policy.

## OAuth callbacks

Register the exact callback for each environment. For local GitHub and Google sign-in:

```text
http://localhost:3000/api/auth/callback/github
http://localhost:3000/api/auth/callback/google
```

For production, replace the origin with `https://skystyle.app`. Use a separately registered preview callback when testing those providers on previews.

## Run the documentation site

After `npm ci`, run:

```bash
npm run docs:dev
```

Open the local URL printed by VitePress. To verify and preview the static output:

```bash
npm run docs:build
npm run docs:preview
```

## Verify a change

```bash
npm test -- --runInBand
npm run lint
npm run build
npm run docs:build
```

See the [testing guide](apps/docs/development/testing.md) for focused checks and the distinction between mocked tests and live acceptance.

## Deployment configuration

| Project | Vercel root directory | Intended domain |
| --- | --- | --- |
| Web | `apps/web` | `https://skystyle.app` |
| Docs | `apps/docs` | `https://docs.skystyle.app` |

The public API runs in the web app at `/api/v1` and requires no separate API deployment.

Configure variables for the intended Vercel environment and register its OAuth callbacks before deploying. Production uses the production origin; previews use their own origin. Redeploy after changing deployment variables.

Automatic recommendations use Supabase Cron and Vault. Follow the [scheduler guide](apps/docs/development/index.md#hosting-and-background-jobs); starting the app alone does not install a recurring job.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing environment variable | Put the value in `apps/web/.env.local` and restart the server |
| Sign-in redirects to production or fails callback validation | Local URL variables, port, and registered callback must agree |
| Missing table or column | Check baseline SQL and migration history against the feature being tested |
| AI model unavailable | Confirm its provider is configured and allowed for the account tier |
| Shop offers a retailer-search fallback | Expected while the approved source is unconfigured; see the [Shop guide](apps/docs/web-app/shop.md) |
| Tests pass but a provider fails | Tests mock provider calls; verify real credentials and callbacks separately |
