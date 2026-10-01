# V6 accounting: approved, staged, not activated

Status: 1 October 2026, ongoing **6.1.0** candidate. Numeric values, admin-managed Pro periods, the exact foundation SQL and a separate scheduler/index hardening patch were explicitly approved. Both migrations were applied and independently inspected. **Enforcement and checkout are false.** Charging routes and account displays now have staged active-accounting branches. No real user balances or Pro dates were migrated; no deployment occurred.

## Authoritative values

| | Free | Pro | PAYG (purchases unavailable) |
| --- | --- | --- | --- |
| Price (AUD) | A$0 | A$6.99/month | A$5 minimum top-up |
| Recommendations | 5/day and 60/month | 25/day and 250/month | 2 credits each |
| Follow-ups | 10/day and 120/month | 50/day and 500/month | 1 credit each |
| Active API keys | 3 | 20 | 20 |
| Account credit grant | 10 at signup, once | 50 each admin-configured monthly period | None |

Closet/source setup and editing have no planned usage caps; any AI generation still uses the appropriate allowance. Style, Shop and scheduled generations share recommendation caps. Daily reset is 00:00 UTC, monthly reset is the UTC calendar month. Both caps apply; included use does not also debit credits or silently become paid use.

50 credits convert from A$1 under the approved proposal; no conversion purchase or live payment collection is implemented. Existing API costs remain recommend 2, recweather 3, weather 1, closet 1 and health 0. No premium-model/image charges are enabled. Existing Free/PAYG model switches remain 2/day. Preview demo limits stay 200 recommendations/400 follow-ups/40 closet/40 source/20 model switches per day; Dev is unlimited with server authorization.

## Admin-managed Pro dates

Admins can record or cancel explicit verified periods from **Dev → Users → Pro periods**. The server requires both a whitelisted authenticated email and an active database Dev identity. Caller IDs are derived server-side, dates require a time zone, impossible calendar dates are rejected, request attempts are audited before mutation, and IDs are stable on retries.

Each period is exactly one UTC calendar month, with month-end clipping. It grants 50 credits once, available from its start and expiring at its end. There is no automatic renewal or payment. Configuring a period while rollout is off **does not grant current legacy Pro access** or change `users.is_pro`. No real account periods were configured during development. Legacy Pro accounts without verified dates fail closed after cutover; known expired/cancelled periods fall back to Free.

## Transaction contract

`entitlement-policy.ts` is the application policy source, with tests comparing every field to the frozen migration seeds. `accounting.ts` selects the staged active branch only when the database rollout flag is explicitly true. `entitlements.ts` validates identities, hashes validated input with a keyed fingerprint, reserves before provider work, never reruns duplicate IDs, rechecks account/access controls around provider work, releases errors/empty Shop results, and awaits settlement before returning a result. Database failures never silently fall back to old accounting or paid use. Provider work must finish before the ten-minute reservation lease expires.

Style, follow-ups, Shop, automatic generation and public v1 middleware now use this adapter in their active branch. Scheduled occurrence IDs are stable across retries. Key creation uses the account-scoped RPC; allocation and legacy Dev balance/plan mutations are rejected while active. Account/Dashboard/API/Credit Center, daily limits, settings access, privacy export and read-only Dev views use effective dated access and the shared wallet. Dev list/detail/export reads never initialize accounts or grant credits. Profile sync does not write Pro status or balances. Existing legacy behavior remains available only while rollout is explicitly false.

Initialization at the future coordinated cutover imports legacy App/API balances once under explicit legacy labels, never relabels them as purchased, and archives revoked-key balances. Old rows remain unchanged. Earlier grant evidence fulfils the signup grant. New keys start with zero per-key credits and use the shared account wallet after cutover. Expiring grants spend first; refunds preserve their source, expiry and archived status. Account deletion cascades owned lots, receipts and allocations. Accounting stores no raw requests, generated outfits, product links, clicks, feedback or credentials.

## Database evidence

- `20260928221124_v6_entitlement_foundation`: seven RLS-protected tables and eight SECURITY INVOKER functions with empty search paths. Browser roles have no table/function privileges; service-role permissions are explicit and do not include table truncation or rollout/rule updates.
- Exact foundation SHA-256: `2E5EA8B6DC0223AF895A418CA6CDB79B6C9B4AE910EF3F1941EC0586E2A8B998`.
- `20260928223310_v6_entitlement_scheduler_hardening`: separately approved; removes PUBLIC/anonymous/authenticated access to the existing due-schedule RPC and retains server execution. Adds the plan/configured-admin foreign-key indexes.
- Rollback-only service-role SQL regression checks passed for once-only grants, key limits/recreation, daily/monthly cap rejection, included-vs-metered accounting, duplicate requests/settlement, failures, partial API refunds, revoked keys, expired leases, legacy preservation, admin authorization, period overlap/expiry/cancellation, Dev bypass and deletion cascades. Independent readback found **zero fixture accounts**, enforcement=false and checkout=false. No real schedule was claimed or run.
- On 1 October, a disposable local PostgreSQL 17.11 cluster passed **15 scenarios**. Actual simultaneous connections tested the byte-identical approved foundation: once-only initialization/period grants, daily caps, idempotency, credit overspending/partial refunds, key slots and model-switch limits. A separately clock-injected disposable database tested concurrent monthly caps, UTC daily/month/year rollover, original-day refunds, leap-year period expiry and explicit renewal. Host time and production were not changed. The stopped synthetic cluster/logs are retained outside the repository.
- The proposed atomic key-revocation SQL also passed local pending-reservation/refund, role-denial and settlement-race checks. It is staged in `supabase/review/v6-atomic-key-revocation.sql`, **not installed or approved**. It is outside automatic migrations. Its active application path fails closed if the RPC is absent. These checks are not deployed real-account or actual production wall-clock acceptance.

## Cutover gates — still open

1. Review/deploy the staged route replacements, then stop/drain every in-flight legacy charging request before any balance import. Flag checks alone are not an atomic drain. Health remains unmetered.
2. Obtain explicit approval and install the exact proposed atomic key-revocation SQL. Review database-level timed-block expiry/ban and in-flight entitlement changes before activation; application rechecks are not a substitute for an atomic database authorization transition.
3. Live readback on 1 October found **zero current non-Dev Pro accounts and zero recorded periods**. No backfill is currently needed; recheck before cutover. Future Pro assignments require explicit admin-verified dates, never account-creation or legacy-boolean estimates.
4. Verify browser/mobile/admin flows and production scheduler delivery. Automatic work settles before completed-history persistence; a storage failure after settlement needs durable finalization/recovery before cutover. Local concurrency and controlled-clock tests do not prove those external acceptance gates.
5. Complete cost evidence, final current-copy review and the exact final activation SQL approval. **No activation statement is included in the approved migrations.** Checkout remains disabled even after an accounting cutover.

Current legacy enforcement is still Free 20 recommendations/day and 40 follow-ups/day, Pro daily App Credits, stable preview demo limits and Dev unlimited. Current legacy API grants/balances are not the approved V6 wallet. Public plan cards show approved inactive values; do not claim V6 caps or account credits are already live.
