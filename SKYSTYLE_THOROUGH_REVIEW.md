# Sky Style 6.3.4 thorough review

Reviewed on 10 October 2026 on `codex/skystyle-6.3.0`, compared with `a6457c0`. Scope: authorized review, commit and branch push. Full deployment, merging, schema installation and accounting/checkout activation remain separate gates. The unrelated marketing draft is excluded.

## Repairs

- Updated Next.js and lint configuration to 16.4.0, NextAuth to 5.0.0-beta.32 and Auth.js Supabase adapter to 1.11.3. Applied compatible dependency patches and refreshed root and standalone locks. [Next.js advisories](https://github.com/vercel/next.js/security/advisories), [Auth.js advisory](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-x445-f3h2-j279).
- Legacy closet add/delete uses stable item operations instead of replacing arrays. Duplicate structured descriptions and metadata survive unrelated changes; ambiguous array replacement returns a conflict. Invalid revisions are rejected before storage access. Five regressions cover these cases.
- Style and Followup enforce model/BYOK eligibility under legacy and V6 accounting. Free accounts cannot request Pro-only models. Pro BYOK acceptance tests use explicit profiles and assert successful responses.
- Late comfort-setting loads preserve edits, resets and saves. Three async regressions cover these cases.
- Removed redundant model-counter state, corrected daily/weekly wording and single-item grammar, and moved clock updates outside rendering. Initial UI work is deferred with cleanup where the updated React lint rules identified synchronous effect updates. Framework-generated agent instructions are disabled; root instructions remain canonical.
- Updated everyday-outfit documentation and review status. No allowance or rollout policy values changed.

## Requirement evidence

| Requirement | Review and evidence |
| --- | --- |
| Scheduler | Earlier isolated 6.1.1 production hotfix delivered once. Reviewed candidate staging, locks, leases, access rechecks and recovery. Disposable SQL checks cover storage failure, expired workers, cancellation and settlement. Full cloud cutover pending. |
| Weather | Reviewed nullable observations, comparable rain periods, aggregation, five-second requests/eight-second overall deadline and reused OpenWeather metadata. Weather regressions cover missing values, real zeroes and unavailable providers. |
| Charging | Shared validators precede Style/Followup settlement; incomplete owned-only results are non-chargeable. Accounting/parser/swap/scheduler tests cover failures and reservation release. |
| BYOK | Reviewed account/provider scoping, session defaults, remembered retention, legacy-key removal and sign-out/cross-tab clearing. BYOK tests pass; live cross-account credential acceptance remains pending. |
| Wardrobe | Reviewed RPC/API revisions, duplicate labels and editor draft/error retention. New adapter tests pass. Concurrent SQL edits conflict and retry without losing changes. |
| Saved outfits and references | Reviewed ownership/revisions, availability, canonical IDs and unknown/deleted references. Existing tests and isolated owner/replay/conflict scenarios pass. Demo owned links focus/highlight Closet; unowned links prepare editable Shop searches. |
| Comfort and time windows | Existing coverage/context/DST/validation tests and three new delayed-load regressions pass. Demo save/reload retains comfort values; missing window endpoints show validation. Cloud removal failures were source-reviewed, not tested with a real account in a browser. |
| UI | Chromium demo at 320x740, 390x844 and 1440x900: inspected flows have no horizontal overflow. Wardrobe add/edit/availability/reload works. Keyboard reference navigation focuses its row. Shop failure restores submission and preserves the query. Final inspected browser console has no captured errors. Dark-theme screenshots saved outside the repository. |
| Documentation | Cross-checked release status, limits, reference syntax, privacy/storage and schema gates. No user-facing “approved V6 plans” claim found. VitePress internal-link build passes. Earlier dated verification remains historical. |

## Verification

Final checks passed: 557 tests across 56 suites, lint, the production app build with synthetic database configuration, and the documentation build into temporary output. Disposable PostgreSQL 17.11 passed all 29 scenarios with productionTouched=false. Foundation and three candidate SQL hashes match the recorded unchanged hashes.

Development changelog row `05cbe1d9-b503-4eb7-a6cc-3519b09a2e5e` was inserted and independently verified: 6.3.4, Development, published, login announcement disabled. The only Supabase-folder addition during this review is `supabase/review/v634-thorough-review-changelog.sql`, an execution receipt. No production schema was installed.

## Remaining deployment gates

The lockfile-based production audit (`npm audit --omit=dev --package-lock-only --workspaces=false --json`) reports four low findings in the SimpleWebAuthn server/Auth.js chain. Complete lockfile audit: 44 findings (4 low, 7 moderate, 33 high), primarily Jest/lint/docs tooling. Standalone web/docs lock checks report 9 and 3. Earlier non-lockfile checks inconsistently returned zero and are discarded. Critical Next.js/Auth.js findings are removed; this is not a clean all-dependency audit.

Suggested remaining resolutions include major authentication/test-tool changes, unsupported downgrades or no stable fix. No forced update, disabled lint rule or framework downgrade was used. Review these risks and verify subsequent migrations before deploying the full candidate.

Safari, actual physical devices, broader tablet/landscape/light-theme checks and complete authenticated 6.3 cloud/provider acceptance remain unverified. Demo and synthetic tests do not establish these results. Production remains on the isolated 6.1.1 hotfix; accounting/checkout remain disabled in the last verified live state.
