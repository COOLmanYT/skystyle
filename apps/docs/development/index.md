# Development

Sky Style development guides and technical documentation.

The [approved V6 accounting foundation](./v6-entitlements) is installed but inactive. Exact migration approval is recorded; legacy writer replacement, verified Pro dates, integration/concurrency checks and separately reviewed activation remain gates. There is no live checkout.

## Local Development

From repository root:

```bash
npm install
npm run dev
```

This starts the Next.js web app in development mode.

## Project Structure

```
.
├── apps/
│   ├── web/         # Next.js production app (skystyle.app)
│   └── docs/        # VitePress documentation site
├── supabase/        # Database schema and migrations
└── package.json     # Root package with workspaces
```

## Testing

Sky Style uses Jest for unit testing.

### Running Tests

```bash
npm test
```

### Test Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:ci` | Run tests for CI (single run with coverage) |

### Test Coverage

Tests cover all major modules and API routes:

- AI module (model selection, tiering, BYOK)
- API keys (generation, hashing, verification)
- Credits system
- Weather data and caching
- Daily usage tracking
- API routes (style, followup)

## Deployment

- **Web app**: skystyle.app (Vercel)
- **Docs**: docs.skystyle.app (Vercel)

## Automatic recommendation scheduler

The automatic recommendation worker is scheduled by **Supabase Cron**, not Vercel Cron. This keeps the worker compatible with Vercel Hobby, which only permits one cron invocation each day. Delivery is best-effort; bounded jobs and provider latency can delay it.

Enable the **pg_cron** and **pg_net** extensions from Supabase Dashboard, add the same `CRON_SECRET` used by the web deployment to Vault as `skystyle_automatic_recommendations_cron_secret`, then run [`supabase/automatic-recommendations-cron.sql`](https://github.com/COOLmanYT/skystyle/blob/main/supabase/automatic-recommendations-cron.sql) in the Supabase SQL Editor. The job invokes the secure Vercel route each minute and can be monitored in `cron.job_run_details`.
- **Database**: Supabase

The exact `/api/cron/automatic-recommendations` path bypasses interactive-login middleware and instead requires `CRON_SECRET` in its handler. Look-alike paths do not inherit that bypass. Monitor worker JSON results (`claimed`, `completed`, `failed`), not just HTTP 200: a redirected login response is not a successful run. Daily/weekly jobs preserve local time and skip missed occurrences rather than backfilling repeated charges.

## Approved shopping source

The official eBay Browse adapter is disabled until production API access/usage rights are approved. Server-side `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, and `SHOP_SOURCE_APPROVED=true` enable it; no credentials belong in client variables or source control. Do not enable the flag without approval. Use direct retailer search while unconfigured. No scraping, affiliate program or shopping analytics is enabled.

Health API and web-session Shop requests are described in [API → Health and Shop](../api/health). Missing source data is labelled, never replaced by invented AI prices, stock, ratings or images.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request
