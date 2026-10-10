-- Synthetic tables only; this file is loaded into a disposable localhost cluster.
CREATE TABLE public.closet(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE NOT NULL REFERENCES public.users ON DELETE CASCADE,items jsonb NOT NULL DEFAULT '[]');
CREATE TABLE public.settings(user_id uuid PRIMARY KEY REFERENCES public.users ON DELETE CASCADE);
CREATE TABLE public.changelog_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.automated_recommendation_schedules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,active boolean NOT NULL DEFAULT true,next_run_at timestamptz NOT NULL,recurrence text NOT NULL DEFAULT 'daily',locked_at timestamptz,last_run_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.automated_recommendation_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),schedule_id uuid REFERENCES public.automated_recommendation_schedules ON DELETE SET NULL,user_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,status text NOT NULL CHECK(status IN ('running','completed','failed')),weather jsonb,recommendation jsonb,error text,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz);
CREATE TABLE public.user_inbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.users ON DELETE CASCADE,category text NOT NULL,title text NOT NULL,body text NOT NULL,metadata jsonb NOT NULL);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.closet,public.settings,public.changelog_posts,public.automated_recommendation_schedules,public.automated_recommendation_runs,public.user_inbox TO service_role;
-- Extension stand-ins test SQL compilation and aggregation; they do not contact HTTP.
CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
CREATE SCHEMA net;
CREATE TABLE net._http_response(id bigint,status_code integer,timed_out boolean,error_msg text);
CREATE FUNCTION net.http_get(url text,headers jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE sql AS $$SELECT 9001::bigint$$;
