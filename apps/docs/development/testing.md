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
| `npm run build` | Verify the Next.js production build |
| `npm run docs:build` | Build VitePress documentation |

The production build uses the web environment configured in [setup](https://github.com/COOLmanYT/skystyle/blob/main/SETUP.md). Jest uses test credentials instead of real provider keys.

## Test layout and mocks

- `apps/web/src/__tests__/setup.ts` supplies test environment variables and shared Next.js, fetch, and localStorage mocks.
- `apps/web/src/__tests__/mocks.ts` contains shared fixtures.
- Library, component and API suites are colocated in their own `__tests__` directories.
- Supabase and Auth.js are mocked by the suites that use them; they are not universally mocked by global setup.

Jest uses a Node environment. Component suites must explicitly provide any DOM or rendering support they require. Account and usage suites explicitly select the behavior they exercise; adapter suites unmock the module when needed.

## Writing useful tests

Choose an existing suite near the code you change as a starting point. Assert observable behavior: response status and body, ownership rejection, accounting changes, or user-visible results. Include the relevant error and boundary cases.

For route tests, mock `@/auth` and database/provider operations deliberately. Supply actual request data and fixtures defined in the test; use the request methods the handler reads. Reset changed environment variables and mocks so a suite does not affect the next one. The test filename should end in `.test.ts` or `.test.tsx`.

Avoid real network calls, production secrets, or production writes in Jest. Database regression checks have a separate [rollback-only SQL fixture guide](https://github.com/COOLmanYT/skystyle/blob/main/supabase/tests/README.md); they are not run by `npm test` and require their own review.

## Verification evidence

Record the date, revision, commands, and failures for the candidate you tested. Rerun checks for the current checkout before claiming it passes. Generate coverage before quoting a percentage.

A passing mocked suite does not prove live OAuth callbacks, provider credentials, shopping-source acceptance, mobile behavior, keyboard access, or a safe accounting cutover. Record browser and real-account acceptance separately with the exact tested domain and deployment revision. Automated tests do not enable purchases or change account entitlements.

VitePress rejects missing internal page links. Check image paths, external URLs and the rendered navigation as well. Edit Markdown source rather than generated HTML; new build output is ignored by Git.
