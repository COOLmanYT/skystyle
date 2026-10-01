# V6 candidate readiness

## 6.1.0 staged accounting integration — 1 October 2026

Active-accounting branches now connect Style, follow-ups, Shop, scheduled generation, public API middleware and key creation to the shared reservation/settlement adapter. Allocation and legacy Dev plan/balance writes are rejected while active. Account/Dashboard/API/Credit Center, daily limits, settings access, privacy/support and read-only Dev views use effective dated access and source-separated balances. Profile sync does not write Pro status or credits. This supersedes the older “adapter not connected” status below; **production accounting and checkout remain off**.

Current automated evidence: **38 Jest suites / 427 tests passed**, full lint **zero errors/warnings**, explicit TypeScript and Next.js production build passed, VitePress temporary-output build passed, whitespace checks passed. **15 isolated PostgreSQL scenarios passed** using genuine concurrent sessions and a separate controlled-clock database for UTC rollover/expiry/renewal. The exact approved foundation was unchanged; the clock injection was test-only, not a host-clock change or production rollover test. No real provider/account data was used.

Live readback found zero current non-Dev Pro accounts and zero recorded Pro periods. No current date backfill is needed; future assignments require explicit verified dates. The proposed atomic revocation SQL passed local tests but is **not approved or installed**. Its active route fails closed when absent. Coordinated legacy-writer drain, atomic access-transition review, durable scheduled-history finalization/recovery, cost evidence, exact activation SQL approval and real-account/browser/production acceptance remain gates. See [accounting status](./v6-entitlements).

Supabase-folder additions include `supabase/review/v6-atomic-key-revocation.sql`, `supabase/tests/run-entitlements.mjs` and `supabase/tests/isolated-base.sql`. These are local review/test artifacts; no additional production migration was applied. Approved migration hashes remain unchanged. No deployment, commit, push, merge or real account balance/date changes occurred.

The existing 6.1.0 changelog draft was consolidated and independently read back: `cac55664-e417-4c79-ba5c-e3d285f25100`, updated `2026-10-01T00:20:35.011809Z`, still `published=false` and `show_on_next_login=false`. All three V6 Notion pages record the verified evidence and retain the remaining gates unchecked. Overall V6 remains In progress.

## 6.1.0 accounting foundation — 29 September 2026

The approved Free/Pro/PAYG values are now centralized and shown consistently as **approved but inactive** in the README, homepage, pricing, account plan cards and Terms. See [V6 accounting status](./v6-entitlements) for exact values, file mapping and remaining cutover gates. This continues the same uncommitted 6.1.0 candidate; it does not activate entitlements or payments.

Two separately approved migrations were applied and verified: the seven-table/eight-RPC accounting foundation (`20260928221124`) and server-only scheduler permission/index hardening (`20260928223310`). Matching records and a rollback-only regression script were added under `supabase/migrations/` and `supabase/tests/`. Browser roles cannot access the new tables/functions or claim scheduled jobs. Enforcement=false, checkout=false and zero regression fixture accounts were independently read back; no real Pro dates, balances or scheduled jobs were changed.

A staged transaction adapter, source-separated account snapshot and authenticated admin-managed Pro-period API/modal are implemented and tested. **The legacy charging routes still use legacy enforcement.** Their coordinated replacement/drain, verified real Pro dates, concurrent-session and UTC rollover integration checks, and exact final activation SQL remain open. No deployment, commit, push or merge occurred.

Current automated evidence: **35 Jest suites / 368 tests passed**, full lint passed with zero errors/warnings, the Next.js production build including TypeScript passed, a temporary-output VitePress build passed, and `git diff --check` passed. Database regression checks were sequential and rollback-only, not concurrency or deployed browser acceptance.

The existing 6.1.0 changelog draft was consolidated and independently read back: `cac55664-e417-4c79-ba5c-e3d285f25100`, updated `2026-09-28T22:56:52.146572Z`, still `published=false` and `show_on_next_login=false`. It records current checks and the inactive accounting/remaining cutover gates without publishing a release or creating another version entry.

## Historical 6.1.0 candidate — 28 September 2026

On 28 September the working tree was **6.1.0**, building on the committed 6.0.0 baseline. This dated section is local implementation evidence, not a deployment or a claim that all production acceptance gates are closed. The 29 September section above supersedes its pricing/migration status.

### Implemented in 6.1.0

- Edge-to-edge Style / Shop navigation and account-scoped browser preferences for both, Style only, or Shop only. Onboarding and Settings share this preference with the sidebar. There is no Dashboard setup-guide menu entry.
- A unified first-use spotlight tour on the real Dashboard, replay from Settings, guided/advanced controls, optional completion sound, focus containment and keyboard dismissal. Location, preferences, generation and Shop steps highlight their corresponding sections.
- Budget moved to Shop, with user-entered minimum/maximum amounts. Shop exposes the same hosted model choices and BYOK providers as Style, plus clothing query, size, clothing preference, occasion and custom prompt controls subject to existing access rules.
- Authenticated `POST /api/shop`, server validation, existing usage enforcement and a grounded eBay Australia Browse API adapter. AI selects supplied product IDs; listing names, prices, images and timestamps remain source-owned. Ratings and missing fields are explicitly unavailable rather than fabricated. Direct links have no affiliate parameters or Sky Style click tracking.
- Anthropic BYOK for Style, follow-ups and Shop; provider-specific dispatch never sends a key to a different provider. Keys are not persisted in the database. Public health endpoints use bounded, cached, sanitized connectivity checks without paid AI generations.
- Private-feedback recording in an accessible modal, while storage, deletion and the editable summary remain in Settings. Dev pages use shared navigation and a clearer operations layout. Homepage, privacy disclosures and product/API documentation reflect these changes.
- Automatic recommendations check access and allowances, handle failures without rapid retry, skip missed recurrence periods, and claim one job per invocation. The exact cron route now reaches its existing secret authorization instead of being redirected to interactive login.

### Verified and remaining gates

Demo browser checks verified first-use/replay, real section spotlights, completion, Style-only and Shop-only preferences with matching sidebar entries, feedback modal keyboard dismissal/focus restoration, and a 390px mobile layout without horizontal overflow. At a 1280px desktop breakpoint, the Style/Shop bar matched the available viewport width (1264.8px vs 1265px). The unconfigured Shop API displays a clear unavailable state without charging usage. These checks do **not** substitute for a fresh real-account flow or real product-source acceptance.

The returning-user browser completion fallback was restored after the initial UI pass and is covered by regression tests. Healthy account state takes precedence; browser completion is used only if durable settings are unavailable, while explicit replay always opens the tour. The last interactive re-check encountered a browser policy boundary after preview restart; no retry or workaround was used. That final fallback change remains interactively unverified.

Live database checks found an active minute-based scheduler and a due schedule, but no run records in the preceding day. Its latest HTTP 200 response contained login-page content, not a worker result. The local routing fix returns 401 for unauthenticated worker requests; secret-authorized dispatch is tested with mocked jobs. Actual production delivery remains open until this code is deployed and a genuine completed run and inbox item are verified. No due live job was executed during QA.

Remaining external/production gates: approved product-source credentials and terms, real listing/image/availability checks, fresh real-account onboarding and cloud feedback QA, storage-disabled browser QA, optional audio behavior, and production scheduler delivery. Product ratings are not available from the current listing adapter; FX conversion and verified size-level stock remain deferred. Prices stay in their original currency, never relabelled.

No Supabase-folder file was changed and no migration was applied for 6.1.0. The 6.0.0 approval below does not authorize new migrations. Pricing, entitlements, payments, AI images, age collection, add-ons and public UGC remain unchanged/deferred. No new commit, push, deployment or merge was requested for 6.1.0.

### Final automated evidence

- `npm test -- --runInBand`: **31 suites, 310 tests passed**.
- `npm run lint`: **zero errors, zero warnings**.
- `npm run build`: passed after the final returning-user fix, including TypeScript, `/api/shop` and all four public health routes.
- `npm run docs:build -- --outDir <new temporary directory>`: passed; no tracked generated-site output changed.
- `git diff --check`: passed. Repository HEAD remains `f661837`; 6.1.0 changes remain uncommitted.
- Existing ts-jest configuration deprecation warnings are non-blocking; no coverage percentage or complete production acceptance is claimed.

### 6.1.0 changelog evidence

One changelog draft was inserted and independently read back: `cac55664-e417-4c79-ba5c-e3d285f25100`, created `2026-09-28T11:42:35.800807Z`, version **6.1.0**, `published=false`, `show_on_next_login=false`. It does not announce unreleased code or trigger a login popup. No migration or Supabase-folder edit accompanied this entry.

## Historical 6.0.0 verification

Last verified: 28 September 2026. Version: **6.0.0**. This records local verification of the commit candidate, not full production release acceptance.

## Implemented

- Authenticated three-step onboarding, skip/replay, optional sound, and guided/advanced controls. Account completion takes precedence over user-scoped browser fallback; database/network failures allow the fallback.
- Two-day hourly forecasts with provider-location time zones, next-available-hour filtering, and midnight/DST handling.
- User-entered minimum/maximum outfit budget, occasion, event date/time/time zone, and fragrance preferences. Server validation and follow-up continuity are tested. Budget is advisory, not a verified basket total; Budget/Designer/Niche fragrance labels are style preferences, not fixed spend bands.
- Dashboard **Style / Shop** split. Shop has direct Australian retailer search and safe Markdown product-link widgets. All query/fragment parameters are stripped from product links. No affiliate links, Sky Style analytics, referral codes, or shopping click logging are added.
- Private thumbs feedback, optional notes, limited rated-outfit excerpts, local/cloud storage choice, default local, editable Mistral Small summary, and individual/all deletion. Deleting a vote clears its derived summary. Saved summaries replace older summaries in subsequent recommendations and follow-ups.
- Cloud writes derive ownership from the authenticated session, validate bounded data, and check the previous timestamp to prevent stale-device overwrites. Transfers keep a device copy until cloud acknowledgement; moving back requires successful device storage before cloud deletion. Demo feedback is local-only.
- Feedback has no scheduled expiry. Cloud records cascade on account deletion. Offline browser copies cannot be remotely erased and must be removed in each browser. Storage capacity is not unlimited: cloud requests support up to 10,000 records and never silently evict older entries. Only the most recent 20 votes are processed per summary request.
- Privacy export includes cloud feedback and reports failures rather than omitting it silently. The UI discloses Mistral processing; deletion cannot recall already processed provider requests.
- Login changelog popups consider only the latest published post; older flagged posts do not become fallback popups.
- The 10 pre-existing lint errors and remaining unused-variable warnings are resolved without changing unrelated product behavior. Manifests, lockfiles, and agent version references are synchronized at 6.0.0.

## Verified automatically

- `npm test -- --runInBand`: 22 suites, 249 tests passed.
- `npm run lint`: passed, zero errors and zero warnings.
- `npm run build`: passed, including TypeScript and both feedback routes.
- `npm run docs:build`: passed. Generated output was removed from the candidate diff; source documentation is retained.
- `git diff --check`: passed.
- API tests cover auth, forged ownership, validation, default-local/demo behavior, storage failures, deletion, stale-device conflicts, summary provider failures, privacy export, and combined recommendation context.
- Render tests check feedback labels/disclosures and safe product-link widgets. They are not interactive browser tests. No current coverage percentage is claimed.

## Database evidence

The user explicitly approved the exact cloud-feedback SQL before it was applied to the connected **What2wear / Sky Style** project. Column/table types, account-deletion cascade, RLS, and role privileges were checked afterwards: anonymous and authenticated Supabase roles have no direct table access; service-role access is available only through authenticated server routes.

`supabase/schema.sql` includes these additions. The earlier approved `supabase/5.3.0-v6-core.sql` remains unchanged. The feedback migration is recorded in the remote migration history; no unapproved pricing or entitlement migration was applied.

```sql
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS feedback_storage_mode text NOT NULL DEFAULT 'local'
  CHECK (feedback_storage_mode IN ('local', 'cloud'));

CREATE TABLE IF NOT EXISTS public.style_feedback_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(entries) = 'array'),
  summary text NOT NULL DEFAULT ''
    CHECK (char_length(summary) <= 600),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.style_feedback_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.style_feedback_preferences FROM anon, authenticated;
```

The security advisor reports an informational no-policy notice for the intentionally server-only feedback table. Existing unrelated warnings concern [public-schema extensions](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) and [public execution of `claim_due_automated_recommendation_schedules`](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). No extra SQL was applied to change them.

## Gates still open

- Fresh real-account browser QA: onboarding/returning-user/replay, blocked browser storage, local/cloud transfers and deletion, mobile, keyboard and accessibility. Prior demo screenshots are historical and do not verify the new feedback flow. The recent browser sign-in attempt hit a policy boundary; no workaround was used.
- Product price, rating, image, stock, and FX data are not sourced. Widgets display names and direct links, with unavailable metadata clearly labelled. Product links are suggestions, not verified listings. No product-image licensing or global retailer coverage is claimed.
- Measured unit economics and final entitlement launch approval are still missing. No V6 target limits or pricing have been activated, and no payment platform or checkout was implemented.
- Feedback summary limiting is currently a best-effort per-server-process 10 attempts per UTC day. A durable shared limiter/cost gate must be verified before scaled production activation.
- AI images, age collection, add-ons, advanced source processing, and public UGC remain deferred. Existing colour tokens are preserved; no new colour scheme is claimed.
- Commit and push are authorized, including automatic Vercel deployment on push. No manual deployment, merge, or public release announcement was performed. The final commit/push and automatic-deployment outcome are tracked in the Notion phase plan; they do not close the browser acceptance gates.

## Changelog outcome

One 6.0.0 changelog draft was inserted and read back in Supabase at `2026-09-28T06:43:47.643175Z`. It is **unpublished**, with `show_on_next_login=false`, so it does not announce unreleased work or open a login popup. Supabase remains the only changelog source; no JSON fallback was created.
