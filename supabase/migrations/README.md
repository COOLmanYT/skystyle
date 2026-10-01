# Approved V6 accounting migrations

These files record already-applied, explicitly approved remote migrations with the same remote version IDs. The foundation file is byte-for-byte the approved SQL (SHA-256 `2E5EA8B6DC0223AF895A418CA6CDB79B6C9B4AE910EF3F1941EC0586E2A8B998`); its original review comments are retained for provenance, not current status.

- `20260928221124_v6_entitlement_foundation.sql`: inactive server-only accounting foundation.
- `20260928223310_v6_entitlement_scheduler_hardening.sql`: separately approved scheduler privilege restriction and two foreign-key indexes.

The folder is not a complete reconstruction of older remote migration history. Existing baseline SQL remains outside this directory. Do not blindly apply these already-recorded files again or automatically push a partial migration chain. No activation statement, checkout provider, backfill, existing balance reset or real account period is included.

`../tests/v6-entitlements-regression.sql` is a rollback-only verification fixture. It creates synthetic accounts, temporarily enables the flag only inside that uncommitted transaction, tests service-role operations, rolls back, and checks that both flags are false and no fixture accounts remain. It is not a deployment migration or a concurrency test.
