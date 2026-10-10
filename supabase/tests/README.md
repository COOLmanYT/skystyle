# Isolated accounting and everyday-outfit verification

`v6-entitlements-regression.sql` is the existing sequential rollback fixture. It is not a migration or concurrency proof.

`run-entitlements.mjs` runs only against a newly created disposable PostgreSQL cluster bound to `127.0.0.1` on a random free port. It accepts an absolute PostgreSQL binary directory via `--pg-bin`, never a remote connection URL. `isolated-base.sql` defines the minimum synthetic legacy schema. No provider calls, real accounts or production database are involved.

The runner verifies the frozen approved foundation hash before testing real simultaneous connections. A separate disposable database injects a test-only clock into its own copy of the functions for deterministic UTC rollover and period expiry/renewal. The production migration file and host clock are never changed. The monthly-cap race uses a fixed date so it is reliable even when invoked on the first day of a month.

The proposed `../review/v6-atomic-key-revocation.sql` is loaded **locally only** to test source-preserving refunds, role denial and settlement races. That does not approve or install the proposal in production. It stays outside automatic migrations.

Add `--v63` to load the three exact SQL review candidates under `supabase/review` into the disposable cluster and check wardrobe revisions, private grants, saved outfits, durable scheduled finalization, delivery recovery and scheduler diagnostics. For example: `node supabase/tests/run-entitlements.mjs --pg-bin "C:/path/to/PostgreSQL/bin" --v63`. The runner rejects remote connection URLs.

On 4 October 2026 all 29 combined scenarios passed on PostgreSQL 17.11. The runner stops its synthetic cluster in `finally` and retains the stopped cluster and logs in the system temporary directory for inspection. Match the SQL hashes to the candidate review before reusing this evidence. These tests do not close live browser, real provider, actual wall-clock or production scheduler acceptance gates.
