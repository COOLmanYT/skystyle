import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { runIdleSchedulerScenarios } from './idle-scheduler-scenarios.mjs';

// In-memory PostgreSQL, synthetic data and a stubbed HTTP queue only.
const db = new PGlite();
let passed = 0;
async function sql(query) {
  await db.exec('RESET ROLE;');
  try { return await db.exec(query); }
  finally { await db.exec('RESET ROLE;'); }
}
async function value(query) {
  const results = await sql(query);
  return Object.values(results.at(-1).rows[0])[0];
}
try {
  await sql(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA vault; CREATE SCHEMA net;
    CREATE TABLE vault.decrypted_secrets(name text, decrypted_secret text);
    CREATE TABLE public.automated_recommendation_schedules(
      id uuid PRIMARY KEY,user_id uuid NOT NULL,active boolean NOT NULL DEFAULT true,
      next_run_at timestamptz NOT NULL,locked_at timestamptz);
    CREATE TABLE public.automated_recommendation_runs(
      id uuid PRIMARY KEY,user_id uuid NOT NULL,schedule_id uuid NOT NULL,
      status text NOT NULL,delivery_pending boolean NOT NULL DEFAULT false);
    CREATE TABLE public.automatic_runner_invocations(
      request_id bigint,created_at timestamptz NOT NULL DEFAULT now());
  `);
  await runIdleSchedulerScenarios({ sql, value, account: async () => randomUUID(),
    check: async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); },
  });
  console.log(`${passed} scheduler scenarios passed (isolated PostgreSQL; no network requests).`);
} finally { await db.close(); }
