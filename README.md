# skystyle (Sky Style) 🌤️

AI-powered outfit recommendations based on hyper-local weather data. Never overdress or underdress again.

Current live site (WIP / proof of concept): **https://what2wear-two.vercel.app**

[![Buy Me A Coffee](https://img.shields.io/badge/Support_Me!-Buy%20Me%20A%20Coffee-yellow)](https://buymeacoffee.com/coolmanyt)

## Features

- **Multi-source weather** — aggregates data from OpenWeatherMap, Open-Meteo, and Bureau of Meteorology (Australia) for accuracy, with hourly forecasts
- **AI outfit recommendations** — uses OpenAI GPT-4o or Google Gemini to suggest what to wear
- **Follow-ups** — ask follow-up questions like "should I bring an umbrella?" or "what if I need formal shoes?"
- **Digital closet** — add your wardrobe items so the AI knows what you own
- **Bring Your Own Key** — Pro users can use their own AI API key (never stored)
- **Custom weather sources** — Pro users can add their own weather data sources
- **GPS & manual location** — use your browser's location or search for any city
- **Dark mode** — automatic, based on system preference

## Plans

| | Free | Pro Monthly |
|---|---|---|
| Price | A$0 | A$4/mo |
| AI uses | 20/day | 50 credits/week |
| Follow-ups | 40/day | 400/day |
| Closet | 4 uses/day | Unlimited |
| Source picker | 4/day | Unlimited |
| BYOK AI key | — | ✅ |
| Custom prompts | — | ✅ |

## Screenshots

| Dashboard | Weather Flow |
|---|---|
| ![Dashboard overview](apps/docs/images/dashboard-1.png) | ![Weather and recommendation flow](apps/docs/images/dashboard-2.png) |

| Usage + Limits | Account + Security |
|---|---|
| ![Usage and limits panel](apps/docs/images/dashboard-3.png) | ![Account settings overview](apps/docs/images/account.png) |

![Settings page](apps/docs/images/settings.png)

## Architecture

This repository is now organized as a single monorepo for multiple deployable projects.

```text
/
├── apps/
│   ├── web/        # Sky Style main app (Next.js)
│   ├── docs/       # VitePress docs website
│   └── api/        # Future standalone API placeholder (api.skystyle.app)
├── packages/       # Shared packages for future reuse
├── supabase/       # Database schema and SQL assets
└── ...root config files
```

Project targets:
- `apps/web` -> `skystyle.app` (or current preview domain)
- `apps/docs` -> `https://skystyle-docs.vercel.app`
- `apps/api` -> `api.skystyle.app` (future)

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router + Turbopack)
- [Supabase](https://supabase.com) (Postgres + Auth adapter)
- [NextAuth v5](https://authjs.dev) (GitHub + Google OAuth)
- [OpenAI](https://openai.com) / [Google Gemini](https://ai.google.dev) (AI)
- [OpenWeatherMap](https://openweathermap.org) + [Open-Meteo](https://open-meteo.com) (weather)
- [Tailwind CSS](https://tailwindcss.com) 4
- [Vercel](https://vercel.com) (hosting + analytics)

## Getting started

See **[SETUP.md](SETUP.md)** for full deployment and local development instructions.

Quick start:

```bash
cp .env.example apps/web/.env.local # or use vercel env pull
# fill in values in apps/web/.env.local
npm install
npm run dev
```

Docs quick start:

```bash
npm run docs:dev
```

## Security

- **SSRF protection** — custom weather source URLs are validated against private/internal hosts
- **HTTPS only** — custom source URLs must use HTTPS
- **No secrets in client** — all API keys are server-side only
- **BYOK keys are never stored** — user-provided AI API keys are used for the single request and discarded
- **Row Level Security** — Supabase RLS policies restrict data access to the owning user
- **JWT sessions** — NextAuth uses JWT strategy; the database adapter is wrapped in a safe fallback
- **Input validation** — coordinates, API inputs, and user content are validated before use
- **Rate limiting** — daily usage limits prevent abuse of AI and weather APIs

## Contributing

Issues and pull requests are welcome. Please be respectful and follow the [People First Design](https://github.com/COOLmanYT/people-first-design) principles.

## Legal

- [Terms of Service](/terms)
- [Privacy Policy](/privacy)

Both follow the [People First Design](https://github.com/COOLmanYT/people-first-design) principles — plain language, minimum data collection, no dark patterns.

## License

See [LICENSE](LICENSE).

## Support the project

If you like my project and want to support the development:

☕ Buy me a coffee  
https://buymeacoffee.com/coolmanyt

:)