-- Sky Style v5.0.3 — API key labels and folders
-- Safe to run more than once in the Supabase SQL Editor.
-- This restores the metadata columns expected by the API Dashboard.

ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS folder text;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS credits_remaining integer NOT NULL DEFAULT 50;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS credits_used integer NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
