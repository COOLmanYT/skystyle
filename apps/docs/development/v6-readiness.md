# V6 candidate readiness

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
