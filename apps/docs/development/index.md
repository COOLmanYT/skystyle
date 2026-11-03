# Contributing to Sky Style

The web app and public API run in the same Next.js application. The documentation site is a separate VitePress build. Start with the [repository setup guide](https://github.com/COOLmanYT/skystyle/blob/main/SETUP.md) to configure a development environment.

## Choose a guide

- [Architecture](./architecture): where pages, API routes, provider adapters and data access live.
- [Testing](./testing): run checks and write useful regression tests.
- [Dev Center](../web-app/dev-center): use the restricted account, support and monitoring tools.
- [API reference](../api/): build an integration with an API key.

## Run locally

From the repository root, install dependencies with `npm ci`. Configure `apps/web/.env.local` using `.env.example`, then run `npm run dev`. Set local origin variables and registered GitHub/Google callbacks to the port you use.

The docs need no product credentials: run `npm run docs:dev` and open the URL printed by VitePress.

## Make a change

Use the existing code near your change as a starting point. Keep server credentials on the server, validate input, and check authentication and ownership before accessing account data. Update the relevant user guide or API reference when behavior changes.

Run the checks in [Testing](./testing) before submitting a pull request. Documentation builds reject missing internal page links. Generated documentation output is built during deployment and is not maintained as source.

## Hosting and background jobs

The web app is hosted at [skystyle.app](https://skystyle.app); the docs are hosted at [docs.skystyle.app](https://docs.skystyle.app). Deployments use the corresponding app workspace.

Automatic recommendations use Supabase Cron to call the authenticated web worker. Running the app does not install a recurring job. Keep scheduler credentials in server-side secret storage, use the worker's required authorization, and review deployment-specific setup before scheduling requests.
