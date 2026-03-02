-- ============================================================
-- Sky Style — Supabase (Postgres) Schema
-- ============================================================
-- Run this in your Supabase SQL Editor to create all tables.
--
-- Section 0 creates the "next_auth" schema with the tables
-- required by @auth/supabase-adapter (it queries next_auth.*).
--
-- Section 1+ creates the application tables in the default
-- "public" schema used by the API routes.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Base Auth.js tables (required by @auth/supabase-adapter)
--    These MUST live in the "next_auth" schema.
--
--    Only `users` and `accounts` are needed:
--    - sessions is NOT used (NextAuth uses JWT strategy)
--    - verification_tokens is NOT used (OAuth-only, no email auth)
-- ------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS next_auth;

GRANT USAGE ON SCHEMA next_auth TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA next_auth TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA next_auth GRANT ALL ON TABLES TO service_role;

CREATE TABLE IF NOT EXISTS next_auth.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text,
  email         text UNIQUE,
  "emailVerified" timestamptz,
  image         text
);

CREATE TABLE IF NOT EXISTS next_auth.accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"            uuid NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  type                text NOT NULL,
  provider            text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  UNIQUE (provider, "providerAccountId")
);

-- ------------------------------------------------------------
-- 1. Application "users" table (public schema) with is_pro flag
--    API routes query public.users for app-specific data.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text,
  email         text UNIQUE,
  "emailVerified" timestamptz,
  image         text,
  is_pro        boolean NOT NULL DEFAULT false,
  is_dev        boolean NOT NULL DEFAULT false
);

-- ------------------------------------------------------------
-- 2. Credits  (Pro users: 50 per week)
--    Actively used: /api/style deducts 1 credit per AI call for
--    Pro users. Balance is shown in the dashboard and weekly
--    reset is handled by src/lib/credits.ts.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_balance  integer NOT NULL DEFAULT 50,
  last_reset_date  date    NOT NULL DEFAULT current_date,
  UNIQUE (user_id)
);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own credits" ON credits;
CREATE POLICY "Users can read own credits"
  ON credits FOR SELECT
  USING ((select auth.uid()) = user_id);

-- Service role can do everything (used by the API routes).

-- ------------------------------------------------------------
-- 3. Digital Closet  (JSONB array of clothing descriptions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS closet (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items    jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id)
);

ALTER TABLE closet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own closet"
  ON closet FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own closet"
  ON closet FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 4. Settings  (unit preference + Pro-only overrides)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_preference      text NOT NULL DEFAULT 'metric'
                         CHECK (unit_preference IN ('metric', 'imperial')),
  custom_system_prompt text,          -- Pro only
  custom_source_url    text,          -- Pro only (saved weather source API key/URL)
  custom_weather_api_key text,        -- Pro only (saved weather source API key)
  UNIQUE (user_id)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own settings" ON settings;
CREATE POLICY "Users can read own settings"
  ON settings FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON settings;
CREATE POLICY "Users can update own settings"
  ON settings FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 5. Daily usage tracking  (follow-ups, AI uses, closet, source picks)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_usage (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date          date NOT NULL DEFAULT current_date,
  ai_uses             integer NOT NULL DEFAULT 0,
  follow_ups          integer NOT NULL DEFAULT 0,
  closet_uses         integer NOT NULL DEFAULT 0,
  source_picks        integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, usage_date)
);

ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own daily_usage" ON daily_usage;
CREATE POLICY "Users can read own daily_usage"
  ON daily_usage FOR SELECT
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- MIGRATIONS — Run once in Supabase SQL Editor if upgrading
-- ============================================================
-- If your users table was created before is_dev was added,
-- run this to add the column:
--
--    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_dev boolean NOT NULL DEFAULT false;
--
-- Then reload the PostgREST schema cache (Settings > API > Reload):
--    NOTIFY pgrst, 'reload schema';
-- ============================================================

-- ============================================================
-- MANUAL CLEANUP — Run once in Supabase SQL Editor
-- ============================================================
-- These statements clean up unused tables that may have been
-- created in the database. Safe to run even if the tables
-- don't exist (IF EXISTS).
--
-- 1. Drop unused next_auth tables (JWT strategy = no sessions
--    table needed; OAuth-only = no verification_tokens needed):
--
--    DROP TABLE IF EXISTS next_auth.sessions;
--    DROP TABLE IF EXISTS next_auth.verification_tokens;
--
-- 2. Drop any accidentally-created public-schema duplicates
--    of the next_auth tables (these are never referenced by
--    application code):
--
--    DROP TABLE IF EXISTS public.sessions;
--    DROP TABLE IF EXISTS public.verification_tokens;
--    DROP TABLE IF EXISTS public.accounts;
--
-- 3. Update existing RLS policies to use (select auth.uid())
--    instead of auth.uid() for better performance. Re-run the
--    DROP POLICY / CREATE POLICY statements above, or run:
--
--    -- credits
--    DROP POLICY IF EXISTS "Users can read own credits" ON credits;
--    CREATE POLICY "Users can read own credits"
--      ON credits FOR SELECT USING ((select auth.uid()) = user_id);
--
--    -- closet
--    DROP POLICY IF EXISTS "Users can read own closet" ON closet;
--    CREATE POLICY "Users can read own closet"
--      ON closet FOR SELECT USING ((select auth.uid()) = user_id);
--    DROP POLICY IF EXISTS "Users can update own closet" ON closet;
--    CREATE POLICY "Users can update own closet"
--      ON closet FOR UPDATE USING ((select auth.uid()) = user_id);
--
--    -- settings
--    DROP POLICY IF EXISTS "Users can read own settings" ON settings;
--    CREATE POLICY "Users can read own settings"
--      ON settings FOR SELECT USING ((select auth.uid()) = user_id);
--    DROP POLICY IF EXISTS "Users can update own settings" ON settings;
--    CREATE POLICY "Users can update own settings"
--      ON settings FOR UPDATE USING ((select auth.uid()) = user_id);
--
--    -- daily_usage
--    DROP POLICY IF EXISTS "Users can read own daily_usage" ON daily_usage;
--    CREATE POLICY "Users can read own daily_usage"
--      ON daily_usage FOR SELECT USING ((select auth.uid()) = user_id);
-- ============================================================
