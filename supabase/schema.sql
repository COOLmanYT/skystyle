-- ============================================================
-- Sky Style — Supabase (Postgres) Schema
-- ============================================================
-- Run this in your Supabase SQL Editor to create all tables.
-- Auth.js (NextAuth) with @auth/supabase-adapter manages the
-- users / accounts / sessions / verification_tokens tables
-- automatically.  The tables below extend that base schema.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend the users table with is_pro flag
-- ------------------------------------------------------------
-- @auth/supabase-adapter creates the `users` table; we just add
-- the extra column.
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
