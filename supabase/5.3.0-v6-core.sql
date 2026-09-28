-- Sky Style 5.3.0 V6 core schema preparation.
-- Applied to What2wear / Sky Style after explicit approval on 2026-09-27.

BEGIN;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS custom_weather_api_key text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS experience_mode text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.settings'::regclass
      AND conname = 'settings_experience_mode_check'
  ) THEN
    ALTER TABLE public.settings
      ADD CONSTRAINT settings_experience_mode_check
      CHECK (experience_mode IS NULL OR experience_mode IN ('guided', 'advanced'));
  END IF;
END
$$;

ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS model_switches integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.settings.onboarding_completed_at IS
  'When the authenticated user completed or skipped the V6 onboarding flow.';
COMMENT ON COLUMN public.settings.custom_weather_api_key IS
  'Optional user-provided WeatherAPI key referenced by the existing settings API.';
COMMENT ON COLUMN public.settings.experience_mode IS
  'User dashboard preference: guided or advanced.';
COMMENT ON COLUMN public.daily_usage.model_switches IS
  'Existing model-switch rate-limit counter referenced by application code.';

COMMIT;
