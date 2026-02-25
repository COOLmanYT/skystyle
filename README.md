# what2wear
A cool vibe-coded weather website that tells you what to wear!

## Deploying to Vercel

### 1. Set up external services

Before deploying, create accounts and obtain credentials for:

| Service | Purpose | Link |
|---|---|---|
| [Supabase](https://supabase.com) | Database & auth adapter | [Dashboard](https://supabase.com/dashboard) |
| [GitHub OAuth App](https://github.com/settings/developers) | Sign-in with GitHub | New OAuth App |
| [Google OAuth App](https://console.cloud.google.com/) | Sign-in with Google | APIs & Services → Credentials |
| [OpenAI](https://platform.openai.com) | AI outfit recommendations | API Keys |
| [OpenWeatherMap](https://openweathermap.org/api) | Weather data (non-Australia) | Free tier |

### 2. Create the Supabase database

1. Create a new Supabase project.
2. In the Supabase **SQL Editor**, run the contents of [`supabase/schema.sql`](supabase/schema.sql) to create all required tables.

### 3. Configure OAuth redirect URIs

- **GitHub** — set *Homepage URL* to `https://<your-domain>` and *Authorization callback URL* to `https://<your-domain>/api/auth/callback/github`
- **Google** — add `https://<your-domain>/api/auth/callback/google` as an *Authorised redirect URI*

### 4. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/COOLmanYT/what2wear)

Or manually:

```bash
npm i -g vercel
vercel
```

### 5. Add environment variables

In your Vercel project go to **Settings → Environment Variables** and add every variable listed in [`.env.example`](.env.example):

| Variable | Where to find it |
|---|---|
| `AUTH_SECRET` | Run `npx auth secret` locally and copy the output |
| `AUTH_URL` | Your deployment URL, e.g. `https://your-domain.vercel.app` |
| `AUTH_GITHUB_ID` | GitHub OAuth App → Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App → Client Secret |
| `AUTH_GOOGLE_ID` | Google OAuth App → Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth App → Client Secret |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` secret |
| `OPENAI_API_KEY` | OpenAI → API Keys |
| `OPENWEATHER_API_KEY` | OpenWeatherMap → My API Keys |

### 6. Redeploy

After saving the environment variables, trigger a redeployment from the Vercel dashboard so the new values take effect.

---

## Local development

```bash
cp .env.example .env.local
# fill in values in .env.local
npm install
npm run dev
```
