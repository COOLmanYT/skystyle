-- ============================================================
-- Sky Style — Supabase (Postgres) Schema
-- ============================================================
-- Run this in your Supabase SQL Editor to create all tables.
-- This creates the base Auth.js (NextAuth) tables used by
-- @auth/supabase-adapter, then extends them for Sky Style.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Base Auth.js tables (required by @auth/supabase-adapter)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text,
  email         text UNIQUE,
  "emailVerified" timestamptz,
  image         text
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" text NOT NULL UNIQUE,
  "userId"       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires        timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier text NOT NULL,
  token      text NOT NULL UNIQUE,
  expires    timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ------------------------------------------------------------
-- 1. Extend the users table with is_pro flag
-- ------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2. Credits  (Pro users: 50 per week)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_balance  integer NOT NULL DEFAULT 50,
  last_reset_date  date    NOT NULL DEFAULT current_date,
  UNIQUE (user_id)
);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credits"
  ON credits FOR SELECT
  USING (auth.uid() = user_id);

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
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own closet"
  ON closet FOR UPDATE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. Settings  (unit preference + Pro-only overrides)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_preference      text NOT NULL DEFAULT 'metric'
                         CHECK (unit_preference IN ('metric', 'imperial')),
  custom_system_prompt text,          -- Pro only
  custom_source_url    text,          -- Pro only
  UNIQUE (user_id)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON settings FOR UPDATE
  USING (auth.uid() = user_id);
