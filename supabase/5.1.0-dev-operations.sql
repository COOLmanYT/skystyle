-- Sky Style v5.1.0 — Operations metadata
-- Safe to run repeatedly in the Supabase SQL Editor.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pending_deletion boolean NOT NULL DEFAULT false;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Web app';

CREATE INDEX IF NOT EXISTS idx_feedback_user_created_at ON public.feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users (created_at DESC);

NOTIFY pgrst, 'reload schema';
