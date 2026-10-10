# Sky Style 6.3.3 candidate review

Review date: 4 October 2026. Branch: `codex/skystyle-6.3.0`, based on `a6457c0`.

Scheduler and live acceptance follow-up: 10 October 2026. The candidate is now 6.3.3; see [the live acceptance record](SKYSTYLE_LIVE_ACCEPTANCE_2026_10_10.md) for current production changes and remaining device/cloud gates. The 4 October verification below remains historical.

## Final review — 10 October

Final review repaired hosted AI item swaps that selected OpenAI even when its credentials were absent. Hosted swaps now select a configured provider within the account's available models; BYOK retains its provider-specific selection and requires no hosted credentials. Three route regression tests cover configured Gemini, BYOK-only access and recoverable missing-provider failure.

Fresh checks passed: 545 tests across 54 suites, lint and production app build with synthetic database settings. The documentation build passed during the immediately preceding commit preparation; this review changes no documentation-site content. The reviewed schema candidates and frozen foundation remain unchanged. A local Chromium demo check at 390 × 844 verifies the dashboard layout and temporary wardrobe flow; it does not establish physical-device, Safari or cloud acceptance.

The 6.3.3 development changelog was inserted and independently verified: `881402dd-47fb-4522-8cd1-c9ed8a4cdaab`, published Development with login announcement disabled. Its SQL receipt is `supabase/review/v633-final-review-changelog.sql`; the Supabase folder changed. Production remains on the isolated 6.1.1 hotfix. This review prepares only the separate branch for the user's requested push; full deployment, reviewed schema installation and accounting activation remain separate gates.

The post-push `npm audit --omit=dev` readback on 10 October reported 13 findings in the current production dependency tree: 4 critical, 7 high, 1 moderate and 1 low. Critical packages include Next.js, NextAuth and the Auth.js Supabase adapter/core dependency chain. Dependency versions were inherited from the comparison base; the candidate's manifest/lockfile changes only update its release markers. This supersedes the historical 4 October clean-audit result. Address and verify these advisories before deploying the full candidate; the branch push does not establish deployment readiness. GitHub's separate 131-alert default-branch summary is not this candidate audit count.

## Commit preparation — 10 October

The 6.3.2 candidate is prepared for a local commit on the requested branch. Fresh checks passed: 542 tests across 53 suites, lint, production app build with synthetic database settings, and documentation build into a temporary output directory. Version markers agree. The three reviewed schema hashes and frozen V6 foundation hash match the recorded values. Changed files passed a credential-pattern scan. Source whitespace checks exclude the reproducible hotfix patch, whose context preserves the original production source's whitespace; its unified-diff structure was independently parsed successfully.

The unrelated `MARKETING_X_DRAFTS.md` is excluded. This commit does not authorize a push, merge, full-candidate deployment, schema installation or accounting/checkout activation. Safari, physical-device and full 6.3 cloud acceptance remain pending as recorded below and in the live acceptance follow-up. The 4 October uncommitted-state references describe that historical review.

## Candidate status

This is a development candidate. The new database schema has not been applied to production, and this branch has not been deployed. Accounting enforcement and checkout were independently read back as disabled on 4 October 2026. The published development changelog is an announcement of branch work, not a deployed release.

## What changed

- Weather measurements distinguish missing values from real zeroes. Provider collection has request and overall deadlines, reuses OpenWeather metadata, and averages only comparable valid rain periods. Existing public API numeric fields remain compatible; additive `measurements` fields expose unavailable values explicitly.
- Recommendations must contain usable outfit and reasoning text before an allowance is consumed. Malformed output produces a recoverable error. Owned-only advice uses canonical, available wardrobe IDs and explains gaps without silently inventing owned clothes.
- Wardrobe items have stable IDs, category, colour, warmth, waterproofing and availability. Atomic item operations and revision checks preserve concurrent edits; failed saves preserve the draft and reset the busy state.
- Users can save and reuse outfits, swap one item manually, or request one AI swap. Saved outfits retain their checklist and identify missing or unavailable wardrobe items when reused. Manual swaps do not use AI allowance; a usable AI swap uses one follow-up.
- Optional time windows and explicit comfort preferences support advice across changing conditions. Cloud preferences have a device-only option and explicit deletion. Privacy export includes the new private data, and account deletion uses cascading ownership relationships.
- BYOK defaults to session storage, scoped to both account and provider. Remember-on-device is explicit, switching providers clears the active credential, and sign-out clears session credentials. Storage failures are shown rather than claiming a saved key was removed.
- Scheduled generation stores its output before atomic usage finalization. Stable occurrence IDs, leases, durable receipts and independent inbox retries prevent repeat generation or charging on supported recovery paths. Cancellation, rescheduling, plan changes and account restrictions are rechecked before finalization.
- Scheduler health distinguishes overdue schedules, stuck work, pending delivery and unsuccessful HTTP invocation. Closet responses expose aggregate request timings without adding retained behavioural tracking. Changelog pages distinguish development announcements from deployed releases.

Photos, packing/planner flows, virtual try-on, social features, extra AI providers and broad retailer expansion are deferred. The proposed positioning is “Know what to wear from morning to evening, using clothes you already own”; usefulness is still a hypothesis to test.

## 6.3.1 review fixes

- Clothing references use `[label](clothing:URL_ENCODED_NAME)` or `[label](clothing:id/UUID)`. The shared renderer resolves current ownership, displays the canonical label, highlights owned clothes and focuses their Closet row. Unknown/deleted items prepare Shop without automatically searching. Escaped punctuation, Unicode and Markdown tables are covered.
- Style, follow-ups, saved outfits, checklists, Inbox and scheduled results use the same reference rules. An illustrative first outfit gives newcomers a useful starting point before requesting weather or using AI.
- Closet editing is shared between the dashboard and Closet page. Demo clothes stay in the current tab, save errors preserve drafts, duplicate labels retain separate IDs, and manual swaps clear the replacement selection while preserving the checklist.
- Plan cards read verified public metadata instead of advertising inactive prices or labelled future plans. Pricing, How It Works and plan metadata are available without sign-in. The browser model catalog no longer imports server provider code.
- Settings no longer report failed saves as success. Device and account outcomes are separate; Unicode custom context, default selections, demo unit persistence and hydration are repaired. Reduced motion survives reloads and also honours the operating-system preference.
- Touch controls, readable inputs, keyboard focus, modal navigation, landscape scrolling and muted text were improved. Documentation uses consistent current allowances, privacy/storage descriptions, navigation and release status. Tablet navigation overflow and the screenshot used as a logo were removed.

## Verification

| Check | Result |
| --- | --- |
| Full Jest suite | 537 tests across 52 suites passed |
| Lint | Passed without warnings |
| Production app build | Passed, including TypeScript and page generation; two local workers |
| Documentation build | Passed |
| Disposable PostgreSQL checks | 29 scenarios passed; actual parallel connections, rollback faults and controlled-clock boundaries |
| Local browser flows | Demo wardrobe add/edit/availability, owned-row focus, unowned Shop context, manual swap/checklist, comfort save/delete, BYOK provider clearing, settings persistence, reduced motion and modal focus passed |
| App layouts | 54 checks: nine views at 320 × 740, 390 × 844, 768 × 1024, 1024 × 768, 1440 × 900 and 844 × 390; no horizontal overflow or framework error overlay |
| Documentation layouts | 18 checks: three guides at the same six sizes; no horizontal overflow or missing images after the tablet menu repair |
| Documentation navigation | Phone and tablet menus, local search and rendered links passed |
| Production dependency audit | No reported production vulnerabilities |
| Repository checks | Version markers agree, patch whitespace check passed, no missing local documentation images, and the disposable verification route was removed |

The app checks used Chromium in the Codex in-app browser against a synthetic localhost demo, plus a disposable component page for controlled outfit/BYOK checks. The documentation checks used the exact rebuilt static output. The component page and local servers were removed/stopped after verification; screenshots and measurement JSON are retained outside the repository in the task visualization folder. Source documentation changes are retained, while tracked generated documentation was restored to its baseline.

These checks do not establish physical-device or Safari acceptance, authenticated cloud storage, live OAuth, production provider behaviour or a delivered automatic recommendation. Saved-outfit cloud operations remain covered by mocked API and isolated SQL checks; the browser demo cannot save across devices. The schedule failure check preserved its synthetic input and reset the busy state after an authentication rejection. Native datetime editing was insufficient to establish a complete valid time-window browser flow; validation boundaries, overnight and DST behaviour have automated coverage.

The production build passed TypeScript and generated all 52 static pages with synthetic database settings and two workers (`CIRCLE_NODE_TOTAL=3`). It did not establish production connectivity. Development previews accept both loopback hostnames so browser updates are applied during verification.

Twenty-four synthetic evaluation cases exercise recommendation contracts, weather boundaries, wardrobe availability, comfort restrictions, and overnight/DST windows with a mocked provider. They do not measure actual recommendation quality, provider token costs or retention. No production provider was called by these evaluations.

The isolated SQL runner creates a temporary localhost-only PostgreSQL cluster and stops it afterwards, retaining synthetic fixtures and logs for inspection. It tests ownership, revisions, idempotency, concurrent finalization, usage rollback, recovery, private grants and scheduler diagnostics. It never accepts a production database URL. The frozen V6 foundation remains byte-identical:

`supabase/migrations/20260928221124_v6_entitlement_foundation.sql`

SHA-256: `2E5EA8B6DC0223AF895A418CA6CDB79B6C9B4AE910EF3F1941EC0586E2A8B998`.

## Exact production SQL candidates

These files are review candidates, not applied migrations. Any edit invalidates the hashes and requires renewed SQL review and isolated checks.

| Apply order | File | SHA-256 |
| --- | --- | --- |
| 1 | `supabase/review/v63-daily-outfits.sql` | `0D62368857E66674E5F33C159B300D91E345481B6A5442BA0CB5814A747CD555` |
| 2 | `supabase/review/v63-scheduled-finalization.sql` | `EF86EA228B59EC57F8F822B0289161DCE20770D43A35CD82A3FD8561577C6210` |
| 3 | `supabase/review/v63-scheduler-diagnostics.sql` | `D8D75EA4F348E051AA007FA57962B692CA8D1E46E67089C2E772BA62BB289877` |

The first file adds canonical wardrobe data and revision checks, private saved outfits, comfort preferences, and optional changelog release status. The second adds durable scheduled occurrences and finalization using the existing V6 reservation functions while leaving their rollout disabled. The third adds bounded operational invocation records and aggregate diagnostics. `supabase/automatic-recommendations-cron.sql` is also updated to reject placeholder authentication and bound HTTP execution.

Production schema installation requires approval of the exact reviewed artifacts; approval to implement the branch does not install them. The separately authorized 10 October scheduler secret and invocation-function repair is recorded in the live acceptance follow-up.

## Ordered rollout and acceptance gates

1. Review the exact SQL files above, including service-only grants, ownership checks, legacy allowance behaviour, and how the current production tables differ from isolated fixtures. Confirm a recoverable database backup and record the current deployment and scheduler configuration.
2. Pause the scheduler and drain existing runner requests. Drain old closet writers, including previously loaded tabs and integrations that replace whole arrays. Establish a maintenance boundary so old writers cannot race the canonical backfill or new revision operations.
3. Apply the reviewed SQL in order. Verify backfill stability, private table/RPC grants, owner isolation, conflict responses, and the two unchanged rollout flags before allowing writes. Existing V6 tables/functions are prerequisites; this work does not approve their accounting activation.
4. Deploy the reviewed branch with the old writers still drained. Check authenticated cloud wardrobe/outfit saves, concurrent tabs, comfort save/device-only/delete, privacy export and account deletion, BYOK sign-out/account/provider isolation, keyboard use and mobile flows. Verify public API compatibility and unavailable-weather displays.
5. Replace the placeholder scheduler credential through the approved secret-management path and ensure the destination and runner share the same credential. Do not expose either credential in SQL reports, screenshots or logs. Resume one controlled schedule and independently verify authorized HTTP execution, stored completed output, one usage settlement where applicable, and one delivered inbox result. Then inspect the next 24 hours for overdue work, duplicate output/charging and pending delivery.
6. Run controlled real-provider evaluations for cold mornings/warm afternoons, rain uncertainty, sparse wardrobes, unavailable items, comfort restrictions and dress codes. Record usefulness, latency, malformed-output rate and minimal token/cost accounting without new behavioural tracking. User acceptance must include newcomers and returning users.
7. Review the existing V6 acceptance gates separately before accounting activation: coordinated writer drain, revocation SQL approval, atomic access/finalization review, real-account checks and cost evidence. Checkout remains disabled until its independent acceptance and approval are complete.
8. Only after deployment and acceptance evidence exists, publish a deployed-release changelog entry or update the development entry with an explicit deployed status. Do not infer release status for historical entries.

If acceptance fails, pause scheduler traffic and affected writes, retain stored results and receipts, and recover pending delivery. Keep the additive schema and private data intact while investigating. An older deployment must not resume whole-array closet writes after canonical migration. Do not drop new columns or reset usage as a rollback shortcut.

## Live evidence and remaining decisions

- The 4 October live readback found authentication unconfigured, one overdue schedule, zero run history and 360 retained `401` responses. Earlier inspection identified the literal placeholder secret at the correct scheduler destination. This branch rejects placeholders and adds delivery-aware diagnostics; it has not repaired the live secret or demonstrated an authorized production delivery.
- `/api/v1/closet` timings are now available for authentication, accounting lookup, database work, handler and total duration. The accounting field covers the lookup; it does not claim to time later legacy charging or V6 settlement. Investigate actual timings before adding further indexes. Traffic volume still does not establish consumer adoption.
- PR #56 (`feat: add public /api/health, /api/health/ai, /api/health/weather endpoints`) is open and conflicted; health functionality is already integrated. Reconcile or close that stale proposal separately. No PR was merged by this task.
- PR #57 (`Add Vercel Web Analytics integration`) remains a draft and subject to tracking-policy review. No analytics integration or new retained behavioural schema was introduced here.
- GitHub issue search found no open issues in the repository on 4 October 2026. PR #56 and draft #57 remain separate proposals; this review did not close or merge them.
- Full authenticated, real-provider, cloud privacy and production mobile acceptance remains open. No paid usage or pricing change is activated by this candidate.

## Repository and changelog handoff — 4 October

Package manifests, lockfiles, `AGENTS.md` and `.github/copilot-instructions.md` use version 6.3.1. The Supabase folder changed: three review SQL candidates, scheduler setup SQL, isolated database fixtures/scenarios and the local runner, plus both development changelog statements and the updated database-test guide. The frozen V6 migration did not change. The candidate remains local and uncommitted; no push, PR creation, merge or deployment was performed.

The development changelog statement at `supabase/review/v63-development-changelog.sql` was executed once and independently read back from `changelog_posts`: entry `ba8078b9-7593-4d2f-b3f7-8d97881ef9ad`, version `6.3.0`, category `🚧 Development`, published, with login announcement disabled. Its title is 43 characters and body is 160 characters; the content explicitly states that the branch has not been deployed. It was the live mutation for the 6.3.0 implementation pass.

The 6.3.1 review statement at `supabase/review/v631-development-changelog.sql` was executed once and independently read back: entry `d513e866-01ae-4e57-84e7-9e879636f247`, version `6.3.1`, category `🚧 Development`, published, with login announcement disabled. Its title is 46 characters and body is 183 characters. The readback confirmed one matching entry, explicitly pending deployment, and both rollout flags still disabled. Publishing this development announcement was the only live mutation in the review pass.
