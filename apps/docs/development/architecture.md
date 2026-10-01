# Architecture

Sky Style is an npm-workspace monorepo. Next.js serves the product and public API; VitePress builds the documentation independently.

## Source layout

| Location | Responsibility |
| --- | --- |
| `apps/web/src/app` | Product pages, server actions and API route handlers |
| `apps/web/src/components` | Style, Closet, Shop and shared interface components |
| `apps/web/src/lib` | Weather/AI adapters, validation, usage and domain logic |
| `apps/web/src/auth.ts` | Auth.js providers, adapter and JWT session callbacks |
| `apps/docs` | Public documentation source and VitePress configuration |
| `supabase` | Database SQL assets, migration records and database tests |

## Authentication and requests

Account pages use Auth.js JWT sessions. GitHub and Google are the available sign-in methods. Server pages use `auth()`; clients read `/api/auth/session`.

Session routes such as `/api/style` and `/api/shop` authenticate the account, validate input and enforce its available usage before provider work. The [public API](../api/) lives under `/api/v1` and uses API-key authentication. [Health endpoints](../api/health) are public read-only diagnostics and require no key.

## Providers and recommendations

Weather adapters normalise provider data before the AI receives it. The AI module defines model priorities, plan access and bring-your-own-key support. Provider availability depends on deployment configuration; a static model list is not evidence that a provider is connected.

Clothing actions resolve against the account's closet. Owned items open Closet; other items prepare an editable Shop search. Shop ranks source-supplied candidates and never uses AI text as a substitute for product prices, links or images.

## Data and usage

Supabase stores account profiles, settings, closet items, usage, support records and changelog posts. Its admin client is server-only. Route-level account authorization and ownership checks remain necessary alongside database policies. Upserts declare their conflict target.

Usage helpers enforce the account's applicable allowance or credits. The UI should display the server's current usage readout rather than calculating access from marketing copy. Credit purchases and checkout are unavailable.

Optional preferences and BYOK keys use browser storage with the `skystyle_` prefix. User-provided keys pass through the server for a requested provider call and are not saved in the database. See [Security & Privacy](../web-app/security-and-privacy).

## Developer tools and background work

The Dev Center uses a shared, server-protected layout with task-based navigation. Each workspace has its own URL. API handlers independently authorize developer actions. See the [Dev Center guide](../web-app/dev-center).

Automatic recommendations use a Supabase Cron worker. The [contributor overview](./index#hosting-and-background-jobs) describes scheduling. Jest tests live beside library, component and route code; use the [testing guide](./testing) to verify changes.
