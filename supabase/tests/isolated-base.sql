-- ONLY for a fresh disposable local PostgreSQL cluster. No real identities.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
CREATE TABLE public.users (id uuid PRIMARY KEY, name text, is_pro boolean NOT NULL DEFAULT false,
  is_dev boolean NOT NULL DEFAULT false, pending_deletion boolean NOT NULL DEFAULT false);
CREATE TABLE public.credits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE REFERENCES public.users ON DELETE CASCADE,
  current_balance integer NOT NULL DEFAULT 50, last_reset_date date DEFAULT current_date);
CREATE TABLE public.api_keys (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.users ON DELETE CASCADE,
  key_hash text, key_preview text, nickname text, folder text, revoked boolean NOT NULL DEFAULT false,
  credits_remaining integer NOT NULL DEFAULT 100, credits_used integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.daily_usage (user_id uuid REFERENCES public.users ON DELETE CASCADE, usage_date date NOT NULL,
  ai_uses integer NOT NULL DEFAULT 0, follow_ups integer NOT NULL DEFAULT 0, model_switches integer NOT NULL DEFAULT 0,
  closet_uses integer NOT NULL DEFAULT 0, source_picks integer NOT NULL DEFAULT 0, PRIMARY KEY(user_id,usage_date));
CREATE TABLE public.user_access_controls (user_id uuid PRIMARY KEY REFERENCES public.users ON DELETE CASCADE,
  app_blocked boolean NOT NULL DEFAULT false, api_blocked boolean NOT NULL DEFAULT false, banned_at timestamptz,
  app_blocked_until timestamptz, api_blocked_until timestamptz, app_daily_ai_limit integer, api_rate_limit_per_min integer);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users, public.credits, public.api_keys, public.daily_usage, public.user_access_controls TO service_role;
