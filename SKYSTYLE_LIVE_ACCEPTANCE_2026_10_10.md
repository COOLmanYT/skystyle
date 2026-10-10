# Sky Style live acceptance — 10 October 2026

The full 6.3.2 candidate is on `codex/skystyle-6.3.0` and remains undeployed. Production changes in this acceptance follow-up are isolated from its wardrobe and accounting migrations. Local commit preparation is recorded in the candidate review; it does not change these live acceptance boundaries.

## Authentication and scheduler repairs

- Production originally had no Vercel `CRON_SECRET`, while Supabase Vault contained a placeholder. A new shared credential was configured through the Vercel and Supabase connectors without displaying or committing its value.
- The existing production commit `7539751d1d50e5cf73a2a89c0f60639123ea42e4` was redeployed with the secret. An authorized invocation subsequently returned HTTP 200.
- Live GitHub sign-in exposed an OAuth issuer mismatch. `AUTH_GITHUB_ISSUER=https://github.com/login/oauth` was configured and the same commit redeployed. The existing account then reached its authenticated dashboard. Issuer validation remains enabled; no credential or account-linking bypass was introduced. [GitHub issuer documentation](https://docs.github.com/en/apps/github-authentication-discovery-endpoints).
- Supabase's default HTTP timeout was five seconds. The existing candidate runner-invocation function was applied as migration `repair_automatic_runner_timeout_and_secret_guard`: explicit 65-second timeout, placeholder/short-secret rejection, and no execution privileges for `anon` or `authenticated`. This installs only the invocation function, not the 6.3 wardrobe/finalization/diagnostic schema.
- The first authorized scheduled generation failed because the Dev default selected OpenAI without a configured OpenAI key. The failure and its error Inbox message are retained. A configured-provider selector now skips absent/blank hosted keys while respecting Free/Pro model access; it does not change explicit BYOK selection.

The isolated 6.1.1 hotfix was exported from the exact production revision and uploaded through the authenticated Vercel connector. Deployment `dpl_9Z2NT9UpAGP7Kg9VJKraA1mnHoE2` reached READY and was assigned `skystyle.app`. Its build passed compilation and TypeScript. It includes configured-provider selection and private stage diagnostics, but none of the complete 6.3 candidate's schema-dependent changes. The [reproducible hotfix patch](SKYSTYLE_6_1_1_SCHEDULER_HOTFIX.patch) records its source changes.

Invocation `46269` returned HTTP 200 with `claimed: 1`, `completed: 1`, `failed: 0`. Independent readback verified completed run `4101e605-bb96-4c86-84b9-d84608019d26`: stored weather, a 258-character outfit, 296-character reasoning, model `gemini-2.5-flash`, and exactly one recommendation Inbox message. The placeholder parser failure text was absent. This Dev account does not consume paid credits, so this result does not establish paid-account charging acceptance.

Cron was resumed only after that verification. The schedule has no lock or overdue occurrence; its next run is 11 October at 9 am Australia/Sydney. Two failed attempts and their error messages remain in history. One failed after provider selection was repaired, while direct synthetic Gemini generation and model-list health were successful; its original generic error did not establish a cause. The instrumented retry succeeded. Continued monitoring is therefore still required before claiming sustained reliability.

The 10:22 and 10:23 UTC cron invocations independently returned HTTP 200 with no due work, and the successful run still had exactly one Inbox recommendation. Onboarding cloud persistence was also independently confirmed in the database for the earlier authenticated browser save.

Production health independently reported configured Gemini/Mistral model-list reachability and read-only Supabase connectivity as healthy; OpenAI remained unconfigured. A public Sydney city-centre weather check returned five sources and 48 hourly forecasts. Model-list health is not generation acceptance for every configured provider.

## Live acceptance established

Earlier in this session, Edge verified GitHub sign-in, cloud wardrobe reads, onboarding/settings save, public-city geocoding, weather from five providers, and a usable Gemini outfit displayed with a single legacy AI allowance increment. Precise-location sharing remained off. These checks concern the existing production flows; they do not establish cloud acceptance of the undeployed structured wardrobe or saved-outfit schema.

## Local verification

The 6.3.2 candidate passed 542 Jest tests across 53 suites, lint, and the production build with synthetic database settings. Five new tests cover missing OpenAI credentials, Mistral-only hosting, Pro priority, Free model access, and blank/missing credentials. The frozen V6 foundation hash remains `2E5EA8B6DC0223AF895A418CA6CDB79B6C9B4AE910EF3F1941EC0586E2A8B998`.

## Remaining acceptance gates

- Actual Safari and physical-device testing requires a connected Apple/Android device or an available remote device service. No such surface was available; viewport emulation is not counted as physical-device acceptance.
- Full 6.3 cloud wardrobe/saved-outfit/comfort acceptance requires the separately reviewed schema and coordinated writer cutover before deploying the complete candidate.
- Real Free/Pro accounting, BYOK cross-account/sign-out checks, paid-provider cost evaluation, and newcomer/returning-user acceptance remain separate from the Dev scheduler smoke test.
- Sustained scheduler monitoring must establish continued delivery and absence of overdue/duplicate work; a single successful invocation cannot establish 24-hour reliability.

Accounting rollout and checkout remain disabled. No commit, push, full-candidate deployment or billing activation is part of this follow-up. The Supabase folder gained the applied function-only SQL receipt and the 6.3.2 development changelog statement. Changelog entry `827351b9-bfec-4d65-9675-545b754bc833` was inserted and independently verified as published Development, with login announcement disabled.
