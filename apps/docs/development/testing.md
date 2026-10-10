# Testing

Jest runs TypeScript tests from `apps/web/src` using the root `jest.config.js`. Install dependencies with `npm ci`, then run commands from the repository root.

## Commands

| Command | Purpose |
| --- | --- |
| `npm test -- --runInBand` | Run all suites serially |
| `npm test -- --runInBand --runTestsByPath apps/web/src/lib/__tests__/daily-usage.test.ts` | Run one existing suite |
| `npm run test:watch` | Re-run tests while editing |
| `npm run test:coverage` | Generate current text, HTML and LCOV coverage in `coverage/` |
| `npm run test:ci` | Run serially with coverage |
| `npm run lint` | Lint web source and Next.js configuration |
| `npm run typecheck` | Type-check production web code without test globals |
| `npm run typecheck:tests` | Type-check tests with Jest types from the root installation |
| `npm run test:release-gate` | Verify release gate rejection and success behavior |
| `npm run release:gate -- <full-commit-sha>` | Require the latest Sky Style app preview to succeed for that exact commit |
| `npm run build` | Verify the Next.js production build |
| `npm run docs:build` | Build VitePress documentation |

The production build uses the web environment configured in [setup](https://github.com/COOLmanYT/skystyle/blob/main/SETUP.md). Jest uses test credentials instead of real provider keys.

## Mandatory Vercel preview gate

Every release candidate must have a successful Sky Style app preview for the exact commit being released. After the candidate is committed and pushed to a non-production branch, wait for the `Vercel preview release gate` check. It verifies GitHub's Vercel deployment records for `Preview – skystyle`, the exact commit and Vercel bot, then requires the newest deployment's latest status to be successful with a Sky Style preview URL. The workflow waits up to 15 minutes for a missing or building preview; failures and inaccessible evidence block the gate.

Run `npm run release:gate -- <full-commit-sha>` immediately before a release and retain its commit SHA, deployment ID and URL. Running without a SHA verifies `HEAD` and rejects tracked changes. New code needs a new preview. A local build, documentation preview, older successful attempt or production deployment cannot satisfy the gate. Release merges, production pushes and manual promotions must obey this mandatory release procedure. The gate uses GitHub's read-only API and needs no Vercel token. In GitHub Actions it uses the job's read-only token; local public-repository reads can run without a token.

This proves the hosted preview build succeeded. It does not replace authenticated cloud, schema, real-provider or device acceptance, and does not authorize accounting or checkout activation.

## Test layout and mocks

- `apps/web/src/__tests__/setup.ts` supplies test environment variables and shared Next.js, fetch, and localStorage mocks.
- `apps/web/src/__tests__/mocks.ts` contains shared fixtures.
- Library, component and API suites are colocated in their own `__tests__` directories.
- Production `tsconfig.json` excludes test files and restricts ambient types to application dependencies. Jest uses `tsconfig.test.json`, which restores Jest types and includes the test files. Vercel's web installation does not need the root test tooling to build the product.
- Supabase and Auth.js are mocked by the suites that use them; they are not universally mocked by global setup.

Jest uses a Node environment. Component suites must explicitly provide any DOM or rendering support they require. Account and usage suites explicitly select the behavior they exercise; adapter suites unmock the module when needed.

## Writing useful tests

Choose an existing suite near the code you change as a starting point. Assert observable behavior: response status and body, ownership rejection, accounting changes, or user-visible results. Include the relevant error and boundary cases.

For route tests, mock `@/auth` and database/provider operations deliberately. Supply actual request data and fixtures defined in the test; use the request methods the handler reads. Reset changed environment variables and mocks so a suite does not affect the next one. The test filename should end in `.test.ts` or `.test.tsx`.

Avoid real network calls, production secrets, or production writes in Jest. Database checks have a separate [isolated PostgreSQL guide](https://github.com/COOLmanYT/skystyle/blob/main/supabase/tests/README.md); they are not run by `npm test` and require their own review. The sequential rollback fixture and disposable concurrent runner provide different evidence.

## Everyday outfit regression checks

Verify missing weather independently from real zeroes, compatible rain periods, provider deadlines, and usable AI output before charging. Check wardrobe ownership, conflicting revisions, availability, saved-outfit reuse and a single-item swap that preserves the rest of the outfit and checklist.

For [clothing references](../api/clothing-references), cover names, stable IDs, renamed/duplicate/deleted items, escaped Markdown characters, and malformed destinations. Owned references open and focus the matching closet item; unowned references prepare Shop without automatically running an AI search.

## Browser acceptance

Test Style, Shop, Closet, Saved outfits, automatic recommendations, Inbox, Settings and plan information at phone, tablet, desktop and landscape sizes. Check horizontal overflow, readable inputs, touch targets, loading/retry states, light/dark themes, reduced motion, keyboard navigation and modal focus. Exercise form changes and saves, rather than relying only on screenshots.

Use synthetic local fixtures for repeatable component checks and remove disposable routes before the production build. Record the browser engine, viewport dimensions, credentials/data scope and unavailable dependencies. A local demo is not authenticated cloud acceptance; physical-device and Safari checks must be recorded separately. Development previews support both `localhost` and `127.0.0.1`.

## Verification evidence

Record the date, revision, commands, and failures for the candidate you tested. Rerun checks for the current checkout before claiming it passes. Generate coverage before quoting a percentage.

A passing mocked suite does not prove live OAuth callbacks, provider credentials, shopping-source acceptance, mobile behavior, keyboard access, or a safe accounting cutover. Record browser and real-account acceptance separately with the exact tested domain and deployment revision. Automated tests do not enable purchases or change account entitlements.

VitePress rejects missing internal page links. Check image paths, external URLs and the rendered navigation as well. Edit Markdown source rather than generated HTML; new build output is ignored by Git.
